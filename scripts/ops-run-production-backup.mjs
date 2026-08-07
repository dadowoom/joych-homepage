import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_APP_DIR = "/var/www/joych-homepage";
const DEFAULT_BACKUP_DIR = "/var/backups/joych-homepage";
const DEFAULT_SKIP_FRESH_HOURS = 12;
const DEFAULT_LOCK_WAIT_MINUTES = 90;
const DEFAULT_POLL_SECONDS = 30;
const DEFAULT_COMMAND_TIMEOUT_MINUTES = 105;
const MAX_CLOCK_SKEW_MS = 5 * 60 * 1_000;
const MAX_MANIFEST_BYTES = 1_048_576;
const MAX_CAPTURE_BYTES = 1_048_576;
const REQUIRED_BACKUP_FILES = Object.freeze([
  "database.sql.gz",
  "uploads.tar.gz",
  "manifest.json",
]);

const BACKUP_SHELL = [
  "set -Eeuo pipefail",
  "umask 077",
  'readonly OPS_TARGET_APP_DIR="$JOYCH_OPS_TARGET_APP_DIR"',
  'readonly OPS_TARGET_BACKUP_DIR="$JOYCH_OPS_TARGET_BACKUP_DIR"',
  'cd -- "$OPS_TARGET_APP_DIR"',
  'if [[ ! -f ".env" ]]; then exit 90; fi',
  'if [[ ! -f "scripts/backup-joych-production.mjs" ]]; then exit 91; fi',
  "set -a",
  '. "./.env"',
  "set +a",
  'export JOYCH_APP_DIR="$OPS_TARGET_APP_DIR"',
  'export JOYCH_BACKUP_DIR="$OPS_TARGET_BACKUP_DIR"',
  'exec node "./scripts/backup-joych-production.mjs"',
].join("\n");

function parseNumberSetting(value, fallback, name, { minimum, maximum }) {
  const raw = value === undefined || value === "" ? fallback : value;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`${name} must be between ${minimum} and ${maximum}.`);
  }
  return parsed;
}

function parseAbsoluteDirectory(value, fallback, name) {
  const configured = (value || fallback).trim();
  if (!path.isAbsolute(configured)) {
    throw new Error(`${name} must be an absolute path.`);
  }
  return path.resolve(configured);
}

export function readBackupRunnerConfig(env = process.env) {
  return {
    appDir: parseAbsoluteDirectory(
      env.JOYCH_APP_DIR,
      DEFAULT_APP_DIR,
      "JOYCH_APP_DIR"
    ),
    backupDir: parseAbsoluteDirectory(
      env.JOYCH_BACKUP_DIR,
      DEFAULT_BACKUP_DIR,
      "JOYCH_BACKUP_DIR"
    ),
    force: env.JOYCH_OPS_BACKUP_FORCE === "1",
    skipFreshHours: parseNumberSetting(
      env.JOYCH_OPS_BACKUP_SKIP_FRESH_HOURS,
      DEFAULT_SKIP_FRESH_HOURS,
      "JOYCH_OPS_BACKUP_SKIP_FRESH_HOURS",
      { minimum: 0, maximum: 48 }
    ),
    lockWaitMinutes: parseNumberSetting(
      env.JOYCH_OPS_BACKUP_LOCK_WAIT_MINUTES,
      DEFAULT_LOCK_WAIT_MINUTES,
      "JOYCH_OPS_BACKUP_LOCK_WAIT_MINUTES",
      { minimum: 1, maximum: 180 }
    ),
    pollSeconds: parseNumberSetting(
      env.JOYCH_OPS_BACKUP_POLL_SECONDS,
      DEFAULT_POLL_SECONDS,
      "JOYCH_OPS_BACKUP_POLL_SECONDS",
      { minimum: 5, maximum: 300 }
    ),
    commandTimeoutMinutes: parseNumberSetting(
      env.JOYCH_OPS_BACKUP_COMMAND_TIMEOUT_MINUTES,
      DEFAULT_COMMAND_TIMEOUT_MINUTES,
      "JOYCH_OPS_BACKUP_COMMAND_TIMEOUT_MINUTES",
      { minimum: 5, maximum: 115 }
    ),
  };
}

async function readCompletedBackup(backupRoot, entry, fsApi) {
  if (
    !entry.isDirectory() ||
    !entry.name.startsWith("joych-") ||
    entry.name.includes(".partial-")
  ) {
    return null;
  }

  const directoryPath = path.join(backupRoot, entry.name);
  try {
    const directoryStat = await fsApi.lstat(directoryPath);
    if (!directoryStat.isDirectory() || directoryStat.isSymbolicLink()) {
      return null;
    }
    const fileStats = await Promise.all(
      REQUIRED_BACKUP_FILES.map(fileName =>
        fsApi.lstat(path.join(directoryPath, fileName))
      )
    );
    if (
      fileStats.some(
        fileStat =>
          !fileStat.isFile() || fileStat.isSymbolicLink() || fileStat.size <= 0
      ) ||
      fileStats[2].size > MAX_MANIFEST_BYTES
    ) {
      return null;
    }

    const manifest = JSON.parse(
      await fsApi.readFile(path.join(directoryPath, "manifest.json"), "utf8")
    );
    const createdAtMs = Date.parse(manifest?.createdAt);
    const recordedDatabaseBytes = manifest?.archiveSizes?.databaseBytes;
    const recordedUploadsBytes = manifest?.archiveSizes?.uploadsBytes;
    if (
      manifest?.status !== "complete" ||
      !Number.isFinite(createdAtMs) ||
      manifest?.database?.archive !== "database.sql.gz" ||
      manifest?.uploads?.archive !== "uploads.tar.gz" ||
      !Number.isSafeInteger(recordedDatabaseBytes) ||
      recordedDatabaseBytes <= 0 ||
      recordedDatabaseBytes !== fileStats[0].size ||
      !Number.isSafeInteger(recordedUploadsBytes) ||
      recordedUploadsBytes <= 0 ||
      recordedUploadsBytes !== fileStats[1].size
    ) {
      return null;
    }
    return {
      name: entry.name,
      directoryPath,
      createdAt: new Date(createdAtMs).toISOString(),
      createdAtMs,
    };
  } catch {
    return null;
  }
}

export async function findLatestCompleteBackup(
  backupRoot,
  { fsApi = fs, allowMissing = false } = {}
) {
  let entries;
  try {
    const rootStat = await fsApi.stat(backupRoot);
    if (!rootStat.isDirectory()) throw new Error("not-directory");
    entries = await fsApi.readdir(backupRoot, { withFileTypes: true });
  } catch (error) {
    if (allowMissing && error?.code === "ENOENT") return null;
    throw new Error("Production backup directory is unavailable.");
  }

  const inspected = await Promise.all(
    entries.map(entry => readCompletedBackup(backupRoot, entry, fsApi))
  );
  return inspected
    .filter(Boolean)
    .sort(
      (left, right) =>
        left.createdAtMs - right.createdAtMs ||
        left.name.localeCompare(right.name)
    )
    .at(-1);
}

export function verifyBackupArchives(backup, spawnSyncImpl = spawnSync) {
  if (!backup?.directoryPath) {
    throw new Error(
      "Completed backup location is unavailable for verification."
    );
  }

  const databaseArchive = path.join(backup.directoryPath, "database.sql.gz");
  const uploadsArchive = path.join(backup.directoryPath, "uploads.tar.gz");
  const commands = [
    ["gzip", ["-t", "--", databaseArchive]],
    ["gzip", ["-t", "--", uploadsArchive]],
    ["tar", ["-tzf", uploadsArchive]],
  ];

  for (const [command, args] of commands) {
    const result = spawnSyncImpl(command, args, {
      encoding: "utf8",
      maxBuffer: 65_536,
      stdio: ["ignore", "ignore", "pipe"],
      timeout: 15 * 60_000,
    });
    if (result.error || result.status !== 0) {
      throw new Error("Completed backup archive integrity check failed.");
    }
  }

  return { checkedArchives: 2 };
}

function isFreshBackup(backup, nowMs, maxAgeHours) {
  if (!backup) return false;
  const ageMs = nowMs - backup.createdAtMs;
  return ageMs >= -MAX_CLOCK_SKEW_MS && ageMs <= maxAgeHours * 3_600_000;
}

function isBackupFromThisRun(backup, before, startedAtMs, nowMs) {
  return (
    backup &&
    (!before || backup.createdAtMs > before.createdAtMs) &&
    backup.createdAtMs >= startedAtMs - MAX_CLOCK_SKEW_MS &&
    backup.createdAtMs <= nowMs + MAX_CLOCK_SKEW_MS
  );
}

function appendCapped(buffer, chunk) {
  const combined = `${buffer}${String(chunk)}`;
  return combined.length > MAX_CAPTURE_BYTES
    ? combined.slice(-MAX_CAPTURE_BYTES)
    : combined;
}

function killProcessGroup(child, signal) {
  if (!child.pid) return;
  try {
    process.kill(-child.pid, signal);
  } catch {
    try {
      child.kill(signal);
    } catch {
      // The process may already have exited.
    }
  }
}

export async function runBackupCommand(config, spawnImpl = spawn) {
  return new Promise((resolve, reject) => {
    const child = spawnImpl("/bin/bash", ["-c", BACKUP_SHELL], {
      cwd: config.appDir,
      detached: true,
      env: {
        ...process.env,
        JOYCH_OPS_TARGET_APP_DIR: config.appDir,
        JOYCH_OPS_TARGET_BACKUP_DIR: config.backupDir,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let output = "";
    let timedOut = false;
    let killTimer;
    child.stdout?.on("data", chunk => {
      output = appendCapped(output, chunk);
    });
    child.stderr?.on("data", chunk => {
      output = appendCapped(output, chunk);
    });

    const timeout = setTimeout(() => {
      timedOut = true;
      killProcessGroup(child, "SIGTERM");
      killTimer = setTimeout(() => killProcessGroup(child, "SIGKILL"), 5_000);
    }, config.commandTimeoutMinutes * 60_000);

    child.once("error", () => {
      clearTimeout(timeout);
      if (killTimer) clearTimeout(killTimer);
      reject(new Error("Production backup command could not be started."));
    });
    child.once("close", code => {
      clearTimeout(timeout);
      if (killTimer) clearTimeout(killTimer);
      const locked =
        output.includes("Another production backup is already running.") ||
        output.includes(
          "Timed out while acquiring the database backup lock."
        ) ||
        output.includes("Backup is already running (");
      output = "";
      resolve({ code, locked, timedOut });
    });
  });
}

const defaultSleep = milliseconds =>
  new Promise(resolve => setTimeout(resolve, milliseconds));

export async function orchestrateProductionBackup({
  config,
  now = Date.now,
  findLatest = directory =>
    findLatestCompleteBackup(directory, { allowMissing: true }),
  runBackup = runBackupCommand,
  sleep = defaultSleep,
  log = console,
}) {
  const before = await findLatest(config.backupDir);
  if (
    !config.force &&
    config.skipFreshHours > 0 &&
    isFreshBackup(before, now(), config.skipFreshHours)
  ) {
    return { status: "skipped-fresh", backup: before };
  }

  const startedAtMs = now();
  log.log("[ops-backup] starting production backup");
  const commandResult = await runBackup(config);
  if (commandResult.timedOut) {
    throw new Error("Production backup command exceeded its safe time limit.");
  }

  if (commandResult.code === 0) {
    const completed = await findLatest(config.backupDir);
    if (!isBackupFromThisRun(completed, before, startedAtMs, now())) {
      throw new Error(
        "Production backup command finished without a newly completed backup."
      );
    }
    return { status: "completed", backup: completed };
  }

  if (!commandResult.locked) {
    throw new Error(
      `Production backup command failed with exit code ${commandResult.code ?? "unknown"}.`
    );
  }

  log.log("[ops-backup] another backup owns the lock; waiting for completion");
  const deadlineMs = startedAtMs + config.lockWaitMinutes * 60_000;
  while (now() < deadlineMs) {
    await sleep(config.pollSeconds * 1_000);
    const completed = await findLatest(config.backupDir);
    if (isBackupFromThisRun(completed, before, startedAtMs, now())) {
      return { status: "completed-by-concurrent-run", backup: completed };
    }
  }

  throw new Error(
    "Concurrent production backup did not produce a completed backup before the wait limit."
  );
}

async function main() {
  try {
    const config = readBackupRunnerConfig();
    const result = await orchestrateProductionBackup({ config });
    verifyBackupArchives(result.backup);
    console.log(
      `[ops-backup] ${result.status}: OK latest=${result.backup.createdAt} archiveIntegrity=ok`
    );
  } catch (error) {
    console.error(`[ops-backup] FAIL ${error.message}`);
    process.exitCode = 1;
  }
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (
  process.argv[1] === "-" ||
  (invokedPath && invokedPath === fileURLToPath(import.meta.url))
) {
  await main();
}
