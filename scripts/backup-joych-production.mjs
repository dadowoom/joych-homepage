import { spawn, spawnSync } from "node:child_process";
import { createReadStream, createWriteStream } from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import zlib from "node:zlib";

import {
  acquireBackupLock,
  acquireDatabaseBackupLock,
  assertSafeBackupLayout,
  buildBackupManifest,
  captureChildStdout,
  cleanupPartialBackups,
  cleanupStagingDirectory,
  createBackupPaths,
  ensureBackupSpace,
  finalizeStagingDirectory,
  installAbortExitWatchdog,
  parseIntegerSetting,
  pruneExpiredBackups,
  resolveUploadsDir,
  rewriteManifestAtomically,
  timestamp,
} from "./backup-joych-safety.mjs";

const backupRoot =
  process.env.JOYCH_BACKUP_DIR || "/var/backups/joych-homepage";
const appDir = process.env.JOYCH_APP_DIR || "/var/www/joych-homepage";
const uploadsDir = resolveUploadsDir(process.env.UPLOAD_DIR, process.cwd());
const keepDays = Number.parseInt(
  process.env.JOYCH_BACKUP_KEEP_DAYS || "30",
  10
);
const minSafeBackups = parseIntegerSetting(
  process.env.JOYCH_BACKUP_MIN_SAFE_COUNT,
  2,
  "JOYCH_BACKUP_MIN_SAFE_COUNT",
  1
);
const minFreeBytes = parseIntegerSetting(
  process.env.JOYCH_BACKUP_MIN_FREE_BYTES,
  1024 * 1024 * 1024,
  "JOYCH_BACKUP_MIN_FREE_BYTES",
  0
);
const lockStaleHours = parseIntegerSetting(
  process.env.JOYCH_BACKUP_LOCK_STALE_HOURS,
  36,
  "JOYCH_BACKUP_LOCK_STALE_HOURS",
  1
);
const abortExitSeconds = parseIntegerSetting(
  process.env.JOYCH_BACKUP_ABORT_EXIT_SECONDS,
  30,
  "JOYCH_BACKUP_ABORT_EXIT_SECONDS",
  1
);
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for production backup.");
}

function findDumpBinary() {
  for (const candidate of ["mysqldump", "mariadb-dump"]) {
    const result = spawnSync(candidate, ["--version"], { stdio: "ignore" });
    if (result.status === 0) return candidate;
  }
  throw new Error("mysqldump or mariadb-dump was not found on this server.");
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ["ignore", "inherit", "inherit"],
      ...options,
    });
    child.once("error", reject);
    child.once("close", code => {
      if (code === 0) resolve();
      else reject(new Error(`${command} exited with code ${code}`));
    });
  });
}

async function dumpDatabase(command, args, outputFile, env, signal) {
  const out = createWriteStream(outputFile, { mode: 0o600 });
  const child = spawn(command, args, {
    stdio: ["ignore", "pipe", "inherit"],
    env,
    signal,
  });
  await captureChildStdout(child, out, command);
}

async function gzipFile(source, signal) {
  const target = `${source}.gz`;
  await pipeline(
    createReadStream(source),
    zlib.createGzip({ level: 9 }),
    createWriteStream(target, { mode: 0o600 }),
    { signal }
  );
  await fs.unlink(source);
  return target;
}

async function main() {
  const parsed = new URL(databaseUrl);
  const dbName = parsed.pathname.replace(/^\//, "");
  if (!dbName) throw new Error("DATABASE_URL must include a database name.");

  const dumpBinary = findDumpBinary();
  await fs.mkdir(backupRoot, { recursive: true, mode: 0o700 });
  const actualBackupRoot = await fs.realpath(backupRoot);
  const actualUploadsDir = await fs.realpath(uploadsDir);
  const uploadsStat = await fs.stat(actualUploadsDir);
  if (!uploadsStat.isDirectory()) {
    throw new Error(`${actualUploadsDir} is not an uploads directory.`);
  }
  assertSafeBackupLayout(actualBackupRoot, actualUploadsDir);

  const databaseLock = await acquireDatabaseBackupLock(databaseUrl);
  const stopAbortExitWatchdog = installAbortExitWatchdog(databaseLock.signal, {
    timeoutMs: abortExitSeconds * 1000,
  });
  let releaseLock;
  try {
    releaseLock = await acquireBackupLock(actualBackupRoot, {
      staleAfterMs: lockStaleHours * 60 * 60 * 1000,
      recoveryLease: databaseLock.recoveryLease,
    });
    databaseLock.assertHealthy();
  } catch (error) {
    if (releaseLock) {
      await releaseLock().catch(cleanupError => {
        console.warn(
          `[joych-backup] failed to release filesystem lock after setup error: ${cleanupError.message}`
        );
      });
    }
    await databaseLock.release().catch(cleanupError => {
      console.warn(
        `[joych-backup] failed to release database lock after setup error: ${cleanupError.message}`
      );
    });
    stopAbortExitWatchdog();
    throw error;
  }
  let stagingDir;
  try {
    const stalePartials = await cleanupPartialBackups(actualBackupRoot);
    if (stalePartials.length > 0) {
      console.warn(
        `[joych-backup] removed stale partial backup(s): ${stalePartials.join(", ")}`
      );
    }

    const preflight = await ensureBackupSpace({
      backupRoot: actualBackupRoot,
      uploadsDir: actualUploadsDir,
      databaseUrl,
      keepDays,
      minSafeBackups,
      minFreeBytes,
    });
    databaseLock.assertHealthy();
    console.log(
      `[joych-backup] preflight available=${preflight.availableBytes} required=${preflight.requiredBytes}`
    );

    const paths = createBackupPaths(actualBackupRoot, timestamp());
    stagingDir = paths.stagingDir;
    await fs.mkdir(stagingDir, { mode: 0o700 });

    const dumpArgs = [
      "--single-transaction",
      "--routines",
      "--triggers",
      "--events",
      "--hex-blob",
      "--host",
      parsed.hostname,
      "--port",
      parsed.port || "3306",
      "--user",
      decodeURIComponent(parsed.username),
      dbName,
    ];

    const dbSql = path.join(stagingDir, "database.sql");
    await dumpDatabase(
      dumpBinary,
      dumpArgs,
      dbSql,
      {
        ...process.env,
        MYSQL_PWD: decodeURIComponent(parsed.password),
      },
      databaseLock.signal
    );
    databaseLock.assertHealthy();
    const dbArchive = await gzipFile(dbSql, databaseLock.signal);
    databaseLock.assertHealthy();
    const dbArchiveStat = await fs.stat(dbArchive);
    if (!dbArchiveStat.isFile() || dbArchiveStat.size === 0) {
      throw new Error("Database backup archive is empty.");
    }

    const uploadsArchive = path.join(stagingDir, "uploads.tar.gz");
    await run(
      "tar",
      [
        "-czf",
        uploadsArchive,
        "-C",
        path.dirname(actualUploadsDir),
        "--",
        path.basename(actualUploadsDir),
      ],
      { signal: databaseLock.signal }
    );
    databaseLock.assertHealthy();
    await fs.chmod(uploadsArchive, 0o600);
    const uploadsArchiveStat = await fs.stat(uploadsArchive);
    if (!uploadsArchiveStat.isFile() || uploadsArchiveStat.size === 0) {
      throw new Error("Uploads backup archive is empty.");
    }

    const manifest = buildBackupManifest({
      createdAt: new Date().toISOString(),
      host: os.hostname(),
      appDir,
      parsedDatabaseUrl: parsed,
      databaseName: dbName,
      databaseArchive: path.basename(dbArchive),
      uploadsArchive: path.basename(uploadsArchive),
      uploadsDir: actualUploadsDir,
      keepDays,
      minSafeBackups,
      prunedBackups: preflight.prunedBackups,
      preflight,
      databaseArchiveBytes: dbArchiveStat.size,
      uploadsArchiveBytes: uploadsArchiveStat.size,
    });
    await fs.writeFile(
      path.join(stagingDir, "manifest.json"),
      `${JSON.stringify(manifest, null, 2)}\n`,
      { mode: 0o600, flag: "wx" }
    );
    databaseLock.assertHealthy();

    await finalizeStagingDirectory(stagingDir, paths.finalDir);
    stagingDir = undefined;

    try {
      const expired = await pruneExpiredBackups({
        backupRoot: actualBackupRoot,
        keepDays,
        minSafeBackups,
      });
      if (expired.length > 0) {
        manifest.prunedBackups.push(...expired);
        manifest.retention.prunedAfterBackup = expired;
        await rewriteManifestAtomically(paths.finalDir, manifest);
      }
    } catch (error) {
      console.warn(
        `[joych-backup] retention cleanup failed after backup: ${error.message}`
      );
    }

    console.log(`[joych-backup] completed: ${paths.finalDir}`);
  } catch (error) {
    await cleanupStagingDirectory(stagingDir).catch(cleanupError => {
      console.warn(
        `[joych-backup] failed to clean partial backup: ${cleanupError.message}`
      );
    });
    throw error;
  } finally {
    try {
      await releaseLock();
    } finally {
      try {
        await databaseLock.release();
      } finally {
        stopAbortExitWatchdog();
      }
    }
  }
}

main().catch(error => {
  console.error("[joych-backup] failed:", error.message);
  process.exit(1);
});
