import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { verifyMigrationLedger } from "./verify-drizzle-migrations.mjs";

export const RECONCILED_BASELINE_TAG = "0109_backfill_sunday_sermon_20251026_metadata";

const DRIZZLE_MIGRATIONS_TABLE = "__drizzle_migrations";
const LEGACY_MIGRATIONS_TABLE = "app_migrations";

function normalizeTableNames(tableNames) {
  if (!Array.isArray(tableNames)) {
    throw new TypeError("tableNames must be an array");
  }
  return new Set(tableNames.map((name) => String(name).toLowerCase()));
}

function normalizeTimestamp(value) {
  const timestamp = typeof value === "number" ? value : Number(value);
  return Number.isSafeInteger(timestamp) ? timestamp : null;
}

function denied(code, message) {
  return { allowed: false, mode: "blocked", code, message };
}

export function assessDrizzleMigrationSafety({
  tableNames,
  drizzleMigrationRows = [],
  ledgerEntries,
  baselineTag = RECONCILED_BASELINE_TAG,
}) {
  if (!Array.isArray(drizzleMigrationRows)) {
    throw new TypeError("drizzleMigrationRows must be an array");
  }
  if (!Array.isArray(ledgerEntries) || ledgerEntries.length === 0) {
    throw new TypeError("ledgerEntries must be a non-empty array");
  }

  const tables = normalizeTableNames(tableNames);
  const hasDrizzleLedger = tables.has(DRIZZLE_MIGRATIONS_TABLE);
  const hasLegacyLedger = tables.has(LEGACY_MIGRATIONS_TABLE);
  const applicationTables = [...tables].filter(
    (name) => name !== DRIZZLE_MIGRATIONS_TABLE && name !== LEGACY_MIGRATIONS_TABLE,
  );
  const hasApplicationState = applicationTables.length > 0 || hasLegacyLedger;

  const baseline = ledgerEntries.find((entry) => entry.tag === baselineTag);
  if (!baseline) {
    throw new Error(`reconciled baseline tag is missing from the journal: ${baselineTag}`);
  }
  const baselineTimestamp = normalizeTimestamp(baseline.when);
  if (baselineTimestamp === null || typeof baseline.hash !== "string" || !baseline.hash) {
    throw new Error(`reconciled baseline entry is invalid: ${baselineTag}`);
  }

  if (!hasApplicationState && (!hasDrizzleLedger || drizzleMigrationRows.length === 0)) {
    return {
      allowed: true,
      mode: "fresh",
      code: "fresh-database",
      message: "database has no application state",
    };
  }

  if (!hasApplicationState) {
    return denied(
      "orphaned-drizzle-ledger",
      "Drizzle migration records exist without application tables",
    );
  }

  if (applicationTables.length === 0) {
    return denied(
      "incomplete-application-state",
      "migration bookkeeping exists without application tables",
    );
  }

  if (!hasDrizzleLedger || drizzleMigrationRows.length === 0) {
    return denied(
      "missing-reconciled-baseline",
      "existing application data has no verified Drizzle baseline",
    );
  }

  const normalizedRows = drizzleMigrationRows.map((row) => ({
    hash: typeof row.hash === "string" ? row.hash : "",
    when: normalizeTimestamp(row.createdAt ?? row.created_at),
  }));
  if (normalizedRows.some((row) => row.when === null)) {
    return denied("invalid-drizzle-ledger", "Drizzle migration timestamps are invalid");
  }

  const latestTimestamp = Math.max(...normalizedRows.map((row) => row.when));
  const latestRows = normalizedRows.filter((row) => row.when === latestTimestamp);
  if (latestRows.length !== 1) {
    return denied(
      "ambiguous-drizzle-ledger",
      "multiple Drizzle migration records share the latest timestamp",
    );
  }

  const latestLedgerEntry = ledgerEntries.find(
    (entry) => normalizeTimestamp(entry.when) === latestTimestamp,
  );
  if (!latestLedgerEntry) {
    return denied(
      "unknown-drizzle-migration",
      "the latest database migration is not present in the current journal",
    );
  }
  if (latestTimestamp < baselineTimestamp) {
    return denied(
      "below-reconciled-baseline",
      `the latest database migration predates the required ${baselineTag} baseline`,
    );
  }
  if (
    typeof latestLedgerEntry.hash !== "string" ||
    latestRows[0].hash !== latestLedgerEntry.hash
  ) {
    return denied(
      "drizzle-hash-mismatch",
      "the latest database migration hash does not match the current journal",
    );
  }

  return {
    allowed: true,
    mode: "reconciled",
    code: "verified-reconciled-baseline",
    message: `existing database is reconciled through ${latestLedgerEntry.tag}`,
  };
}

export function loadDrizzleLedger(migrationsFolder) {
  verifyMigrationLedger(migrationsFolder);

  const journal = JSON.parse(
    fs.readFileSync(path.join(migrationsFolder, "meta", "_journal.json"), "utf8"),
  );
  const migrations = readMigrationFiles({ migrationsFolder });
  if (journal.entries.length !== migrations.length) {
    throw new Error("journal and Drizzle migration counts do not match");
  }

  return journal.entries.map((entry, index) => ({
    tag: entry.tag,
    when: entry.when,
    hash: migrations[index].hash,
  }));
}

async function inspectDatabase(databaseUrl) {
  const connection = await mysql.createConnection(databaseUrl);
  try {
    const [databaseRows] = await connection.query("SELECT DATABASE() AS databaseName");
    if (!Array.isArray(databaseRows) || !databaseRows[0]?.databaseName) {
      throw new Error("DATABASE_URL must select a database");
    }

    const [tableRows] = await connection.query(`
      SELECT TABLE_NAME AS tableName
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_TYPE = 'BASE TABLE'
    `);
    const tableNames = Array.isArray(tableRows)
      ? tableRows.map((row) => row.tableName)
      : [];
    const hasDrizzleLedger = tableNames.some(
      (name) => String(name).toLowerCase() === DRIZZLE_MIGRATIONS_TABLE,
    );

    let drizzleMigrationRows = [];
    if (hasDrizzleLedger) {
      const [rows] = await connection.query(`
        SELECT hash, created_at AS createdAt
        FROM \`__drizzle_migrations\`
        ORDER BY created_at DESC, id DESC
      `);
      drizzleMigrationRows = Array.isArray(rows) ? rows : [];
    }

    return { tableNames, drizzleMigrationRows };
  } finally {
    await connection.end();
  }
}

function runDrizzleMigrate(repositoryRoot) {
  const drizzleKitCli = path.join(repositoryRoot, "node_modules", "drizzle-kit", "bin.cjs");
  if (!fs.existsSync(drizzleKitCli)) {
    throw new Error("drizzle-kit is not installed; run the migration from a development checkout");
  }

  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [drizzleKitCli, "migrate"], {
      cwd: repositoryRoot,
      env: process.env,
      stdio: "inherit",
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (signal) {
        reject(new Error(`drizzle-kit migrate was terminated by ${signal}`));
      } else if (code !== 0) {
        reject(new Error(`drizzle-kit migrate exited with code ${code}`));
      } else {
        resolve();
      }
    });
  });
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required for a safe Drizzle migration");

  const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const migrationsFolder = path.join(repositoryRoot, "drizzle");
  const ledgerEntries = loadDrizzleLedger(migrationsFolder);
  const databaseState = await inspectDatabase(databaseUrl);
  const assessment = assessDrizzleMigrationSafety({
    ...databaseState,
    ledgerEntries,
  });

  if (!assessment.allowed) {
    throw new Error(
      `${assessment.message}. Automatic baseline creation is disabled; ` +
        "verify the existing schema and record an approved baseline before retrying.",
    );
  }

  console.log(`[drizzle-safe] ${assessment.message}; migration allowed`);
  await runDrizzleMigrate(repositoryRoot);
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  try {
    await main();
  } catch (error) {
    console.error(`[drizzle-safe] migration refused: ${error instanceof Error ? error.message : error}`);
    process.exitCode = 1;
  }
}
