import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_APP_DIR = "/var/www/joych-homepage";
const DEFAULT_BACKUP_DIR = "/var/backups/joych-homepage";
const DEFAULT_PM2_APP = "joych-homepage";
const DEFAULT_MAX_BACKUP_AGE_HOURS = 30;
const DEFAULT_MIN_DISK_FREE_PERCENT = 15;
const MAX_MANIFEST_BYTES = 1_048_576;
const MAX_CLOCK_SKEW_MS = 5 * 60 * 1_000;
const REQUIRED_BACKUP_FILES = Object.freeze([
  "database.sql.gz",
  "uploads.tar.gz",
  "manifest.json",
]);

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

function parsePm2App(value) {
  const app = (value || DEFAULT_PM2_APP).trim();
  if (!/^[A-Za-z0-9._-]{1,100}$/.test(app)) {
    throw new Error("JOYCH_PM2_APP contains unsupported characters.");
  }
  return app;
}

export function readRemoteCheckConfig(env = process.env) {
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
    pm2App: parsePm2App(env.JOYCH_PM2_APP),
    maxBackupAgeHours: parseNumberSetting(
      env.JOYCH_OPS_BACKUP_MAX_AGE_HOURS,
      DEFAULT_MAX_BACKUP_AGE_HOURS,
      "JOYCH_OPS_BACKUP_MAX_AGE_HOURS",
      { minimum: 1, maximum: 720 }
    ),
    minDiskFreePercent: parseNumberSetting(
      env.JOYCH_OPS_MIN_DISK_FREE_PERCENT,
      DEFAULT_MIN_DISK_FREE_PERCENT,
      "JOYCH_OPS_MIN_DISK_FREE_PERCENT",
      { minimum: 1, maximum: 99 }
    ),
  };
}

export function parsePm2ProcessList(rawOutput, appName) {
  let processes;
  try {
    processes = JSON.parse(rawOutput);
  } catch {
    throw new Error("PM2 returned an unreadable process list.");
  }
  if (!Array.isArray(processes)) {
    throw new Error("PM2 returned an unreadable process list.");
  }

  const matches = processes.filter(process => process?.name === appName);
  if (matches.length === 0) {
    throw new Error("Configured PM2 application was not found.");
  }
  const statuses = matches.map(process => process?.pm2_env?.status);
  if (statuses.some(status => status !== "online")) {
    throw new Error("One or more PM2 application instances are not online.");
  }

  return { instances: matches.length, status: "online" };
}

export function checkPm2(appName, spawnImpl = spawnSync) {
  const result = spawnImpl("pm2", ["jlist"], {
    encoding: "utf8",
    maxBuffer: 1_048_576,
    timeout: 10_000,
  });
  if (
    result.error ||
    result.status !== 0 ||
    typeof result.stdout !== "string"
  ) {
    throw new Error("PM2 process inspection failed.");
  }
  return parsePm2ProcessList(result.stdout, appName);
}

function toBigInt(value, label) {
  try {
    return BigInt(value);
  } catch {
    throw new Error(`Disk statistics are invalid for ${label}.`);
  }
}

export function evaluateDiskSpace(
  statistics,
  minFreePercent,
  label = "target"
) {
  const blocks = toBigInt(statistics.blocks, label);
  const rawAvailable = toBigInt(statistics.bavail ?? statistics.bfree, label);
  if (blocks <= 0n) {
    throw new Error(`Disk statistics are invalid for ${label}.`);
  }

  const available = rawAvailable < 0n ? 0n : rawAvailable;
  const basisPoints = Number((available * 10_000n) / blocks);
  const freePercent = basisPoints / 100;
  if (freePercent < minFreePercent) {
    throw new Error(
      `${label} disk has ${freePercent.toFixed(2)}% free; minimum is ${minFreePercent}%.`
    );
  }
  return { freePercent };
}

export async function checkDiskSpace(
  targetPath,
  minFreePercent,
  label,
  fsApi = fs
) {
  try {
    const targetStat = await fsApi.stat(targetPath);
    if (!targetStat.isDirectory()) throw new Error("not-directory");
    const statistics = await fsApi.statfs(targetPath, { bigint: true });
    return evaluateDiskSpace(statistics, minFreePercent, label);
  } catch (error) {
    if (error?.message?.startsWith(`${label} disk has `)) throw error;
    throw new Error(`${label} directory or disk statistics are unavailable.`);
  }
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
      )
    ) {
      return null;
    }
    if (fileStats[2].size > MAX_MANIFEST_BYTES) return null;

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
      createdAt: new Date(createdAtMs).toISOString(),
      createdAtMs,
    };
  } catch {
    return null;
  }
}

export async function findLatestCompleteBackup(backupRoot, fsApi = fs) {
  let entries;
  try {
    const rootStat = await fsApi.stat(backupRoot);
    if (!rootStat.isDirectory()) throw new Error("not-directory");
    entries = await fsApi.readdir(backupRoot, { withFileTypes: true });
  } catch {
    throw new Error("Production backup directory is unavailable.");
  }

  const inspected = await Promise.all(
    entries.map(entry => readCompletedBackup(backupRoot, entry, fsApi))
  );
  const completed = inspected
    .filter(Boolean)
    .sort(
      (left, right) =>
        left.createdAtMs - right.createdAtMs ||
        left.name.localeCompare(right.name)
    );
  if (completed.length === 0) {
    throw new Error("No complete production backup was found.");
  }

  return {
    count: completed.length,
    latest: completed.at(-1),
  };
}

export function evaluateBackupFreshness(
  backupInventory,
  maxAgeHours,
  now = Date.now()
) {
  const ageMs = now - backupInventory.latest.createdAtMs;
  if (ageMs < -MAX_CLOCK_SKEW_MS) {
    throw new Error("Latest production backup timestamp is in the future.");
  }

  const ageHours = Math.max(0, ageMs) / 3_600_000;
  if (ageHours > maxAgeHours) {
    throw new Error(
      `Latest complete production backup is ${ageHours.toFixed(2)} hours old; maximum is ${maxAgeHours} hours.`
    );
  }
  return { ...backupInventory, ageHours };
}

async function main() {
  let config;
  try {
    config = readRemoteCheckConfig();
  } catch (error) {
    console.error(`[ops] configuration: FAIL ${error.message}`);
    process.exitCode = 1;
    return;
  }

  const checks = [
    {
      label: "pm2",
      run: async () => {
        const result = checkPm2(config.pm2App);
        return `app=${config.pm2App} instances=${result.instances} status=${result.status}`;
      },
    },
    {
      label: "application disk",
      run: async () => {
        const result = await checkDiskSpace(
          config.appDir,
          config.minDiskFreePercent,
          "application"
        );
        return `free=${result.freePercent.toFixed(2)}% minimum=${config.minDiskFreePercent}%`;
      },
    },
    {
      label: "backup disk",
      run: async () => {
        const result = await checkDiskSpace(
          config.backupDir,
          config.minDiskFreePercent,
          "backup"
        );
        return `free=${result.freePercent.toFixed(2)}% minimum=${config.minDiskFreePercent}%`;
      },
    },
    {
      label: "production backup",
      run: async () => {
        const inventory = await findLatestCompleteBackup(config.backupDir);
        const result = evaluateBackupFreshness(
          inventory,
          config.maxBackupAgeHours
        );
        return `completeCount=${result.count} latest=${result.latest.createdAt} ageHours=${result.ageHours.toFixed(2)} maximum=${config.maxBackupAgeHours}`;
      },
    },
  ];

  let failures = 0;
  for (const check of checks) {
    try {
      const detail = await check.run();
      console.log(`[ops] ${check.label}: OK ${detail}`);
    } catch (error) {
      failures += 1;
      console.error(`[ops] ${check.label}: FAIL ${error.message}`);
    }
  }

  if (failures > 0) {
    console.error(`[ops] remote checks: FAIL failures=${failures}`);
    process.exitCode = 1;
  } else {
    console.log("[ops] remote checks: OK");
  }
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (
  process.argv[1] === "-" ||
  (invokedPath && invokedPath === fileURLToPath(import.meta.url))
) {
  await main();
}
