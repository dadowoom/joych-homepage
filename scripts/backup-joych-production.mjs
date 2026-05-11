import { spawn, spawnSync } from "node:child_process";
import { createReadStream, createWriteStream } from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import zlib from "node:zlib";

const backupRoot = process.env.JOYCH_BACKUP_DIR || "/var/backups/joych-homepage";
const appDir = process.env.JOYCH_APP_DIR || "/var/www/joych-homepage";
const keepDays = Number.parseInt(process.env.JOYCH_BACKUP_KEEP_DAYS || "30", 10);
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for production backup.");
}

function timestamp() {
  return new Date().toISOString().replace(/[-:]/g, "").replace(/\..+$/, "Z");
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
    const child = spawn(command, args, { stdio: ["ignore", "inherit", "inherit"], ...options });
    child.on("error", reject);
    child.on("close", code => {
      if (code === 0) resolve();
      else reject(new Error(`${command} exited with code ${code}`));
    });
  });
}

function dumpDatabase(command, args, outputFile, env) {
  return new Promise((resolve, reject) => {
    const out = createWriteStream(outputFile, { mode: 0o600 });
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "inherit"], env });

    child.stdout.pipe(out);
    child.on("error", reject);
    out.on("error", reject);
    child.on("close", code => {
      out.end();
      if (code === 0) resolve();
      else reject(new Error(`${command} exited with code ${code}`));
    });
  });
}

async function gzipFile(source) {
  const target = `${source}.gz`;
  await pipeline(createReadStream(source), zlib.createGzip({ level: 9 }), createWriteStream(target, { mode: 0o600 }));
  await fs.unlink(source);
  return target;
}

async function pruneOldBackups() {
  if (!Number.isFinite(keepDays) || keepDays <= 0) return [];

  const cutoff = Date.now() - keepDays * 24 * 60 * 60 * 1000;
  const entries = await fs.readdir(backupRoot, { withFileTypes: true }).catch(() => []);
  const removed = [];

  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("joych-")) continue;
    const fullPath = path.join(backupRoot, entry.name);
    const stat = await fs.stat(fullPath);
    if (stat.mtimeMs >= cutoff) continue;
    await fs.rm(fullPath, { recursive: true, force: true });
    removed.push(entry.name);
  }

  return removed;
}

async function main() {
  const parsed = new URL(databaseUrl);
  const dbName = parsed.pathname.replace(/^\//, "");
  if (!dbName) throw new Error("DATABASE_URL must include a database name.");

  const dumpBinary = findDumpBinary();
  const stamp = timestamp();
  const backupDir = path.join(backupRoot, `joych-${stamp}`);
  await fs.mkdir(backupDir, { recursive: true, mode: 0o700 });

  const dbSql = path.join(backupDir, "database.sql");
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

  await dumpDatabase(dumpBinary, dumpArgs, dbSql, {
    ...process.env,
    MYSQL_PWD: decodeURIComponent(parsed.password),
  });
  const dbArchive = await gzipFile(dbSql);

  const uploadsDir = path.join(appDir, "uploads");
  let uploadsArchive = null;
  try {
    const stat = await fs.stat(uploadsDir);
    if (stat.isDirectory()) {
      uploadsArchive = path.join(backupDir, "uploads.tar.gz");
      await run("tar", ["-czf", uploadsArchive, "-C", appDir, "uploads"]);
      await fs.chmod(uploadsArchive, 0o600);
    }
  } catch {
    uploadsArchive = null;
  }

  const removed = await pruneOldBackups();
  const manifest = {
    createdAt: new Date().toISOString(),
    host: os.hostname(),
    appDir,
    database: {
      host: parsed.hostname,
      port: parsed.port || "3306",
      name: dbName,
      archive: path.basename(dbArchive),
    },
    uploadsArchive: uploadsArchive ? path.basename(uploadsArchive) : null,
    keepDays,
    prunedBackups: removed,
  };

  await fs.writeFile(path.join(backupDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
  console.log(`[joych-backup] completed: ${backupDir}`);
}

main().catch(error => {
  console.error("[joych-backup] failed:", error.message);
  process.exit(1);
});
