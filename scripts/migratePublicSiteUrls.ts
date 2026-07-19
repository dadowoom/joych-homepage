import "dotenv/config";

import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import mysql, {
  type PoolConnection,
  type ResultSetHeader,
  type RowDataPacket,
} from "mysql2/promise";

import {
  INTENTIONALLY_EXCLUDED_PUBLIC_URL_FIELDS,
  LEGACY_PUBLIC_SITE_ORIGINS,
  PRIMARY_PUBLIC_SITE_ORIGIN,
  PUBLIC_SITE_URL_MIGRATION_TARGETS,
  replaceLegacyPublicSiteOrigins,
  type PublicSiteUrlMigrationTarget,
} from "./publicSiteUrlMigrationPlan";

type MigrationMode = "dry-run" | "apply";

interface ColumnMetadataRow extends RowDataPacket {
  TABLE_NAME: string;
  COLUMN_NAME: string;
}

interface TableMetadataRow extends RowDataPacket {
  TABLE_NAME: string;
  ENGINE: string | null;
}

interface CandidateRow extends RowDataPacket {
  id: number;
  [column: string]: unknown;
}

type ResolvedTarget = Readonly<{
  table: string;
  columns: readonly string[];
  engine: string | null;
}>;

type TableMigrationReport = Readonly<{
  table: string;
  candidateRows: number;
  changedRows: number;
  changedFields: number;
  replacements: number;
  updatedRows: number;
}>;

const IDENTIFIER_PATTERN = /^[A-Za-z0-9_]+$/;

function quoteIdentifier(identifier: string) {
  if (!IDENTIFIER_PATTERN.test(identifier)) {
    throw new Error(`Unsafe SQL identifier in migration plan: ${identifier}`);
  }
  return `\`${identifier}\``;
}

function parseMode(args: readonly string[]): MigrationMode | "help" {
  const allowed = new Set(["--apply", "--dry-run", "--help", "-h"]);
  const unknown = args.filter(argument => !allowed.has(argument));
  if (unknown.length > 0) {
    throw new Error(`Unknown option(s): ${unknown.join(", ")}`);
  }
  if (args.includes("--help") || args.includes("-h")) return "help";
  if (args.includes("--apply") && args.includes("--dry-run")) {
    throw new Error("Choose either --apply or --dry-run, not both.");
  }
  return args.includes("--apply") ? "apply" : "dry-run";
}

function printHelp() {
  console.log(`Usage: npm run migrate:public-site-urls -- [--dry-run | --apply]

Safely migrates exact public URL origins:
  https://newjoych.co.kr       -> ${PRIMARY_PUBLIC_SITE_ORIGIN}
  https://www.newjoych.co.kr   -> ${PRIMARY_PUBLIC_SITE_ORIGIN}
  http/protocol-relative forms -> ${PRIMARY_PUBLIC_SITE_ORIGIN}
  joych.org and m.joych.org    -> ${PRIMARY_PUBLIC_SITE_ORIGIN}

The default is --dry-run. Database writes happen only with --apply.`);
}

function candidateWhere(columns: readonly string[]) {
  const clauses: string[] = [];
  const values: string[] = [];

  for (const column of columns) {
    for (const origin of LEGACY_PUBLIC_SITE_ORIGINS) {
      clauses.push(`INSTR(LOWER(${quoteIdentifier(column)}), ?) > 0`);
      values.push(origin);
    }
  }

  return { sql: clauses.join(" OR "), values };
}

async function loadSchemaMetadata(connection: PoolConnection) {
  const [columnRows] = await connection.query<ColumnMetadataRow[]>(`
    SELECT TABLE_NAME, COLUMN_NAME
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
  `);
  const [tableRows] = await connection.query<TableMetadataRow[]>(`
    SELECT TABLE_NAME, ENGINE
    FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
  `);

  const columnsByTable = new Map<string, Set<string>>();
  for (const row of columnRows) {
    const columns = columnsByTable.get(row.TABLE_NAME) ?? new Set<string>();
    columns.add(row.COLUMN_NAME);
    columnsByTable.set(row.TABLE_NAME, columns);
  }
  const enginesByTable = new Map(tableRows.map(row => [row.TABLE_NAME, row.ENGINE]));

  return { columnsByTable, enginesByTable };
}

function resolveTargets(
  metadata: Awaited<ReturnType<typeof loadSchemaMetadata>>,
) {
  const targets: ResolvedTarget[] = [];
  const skipped: string[] = [];

  for (const target of PUBLIC_SITE_URL_MIGRATION_TARGETS) {
    const existingColumns = metadata.columnsByTable.get(target.table);
    if (!existingColumns) {
      skipped.push(`${target.table} (table not present)`);
      continue;
    }
    if (!existingColumns.has("id")) {
      skipped.push(`${target.table} (id column not present)`);
      continue;
    }

    const columns = target.columns.filter(column => existingColumns.has(column));
    const missingColumns = target.columns.filter(column => !existingColumns.has(column));
    if (missingColumns.length > 0) {
      skipped.push(`${target.table}.${missingColumns.join(", ")} (column not present)`);
    }
    if (columns.length === 0) continue;

    targets.push({
      table: target.table,
      columns,
      engine: metadata.enginesByTable.get(target.table) ?? null,
    });
  }

  return { targets, skipped };
}

function assertTransactionalTargets(targets: readonly ResolvedTarget[]) {
  const unsupported = targets.filter(target => target.engine?.toLowerCase() !== "innodb");
  if (unsupported.length > 0) {
    throw new Error(
      "--apply requires transactional InnoDB tables. Unsupported target(s): " +
      unsupported.map(target => `${target.table} (${target.engine ?? "unknown engine"})`).join(", "),
    );
  }
}

async function selectCandidates(
  connection: PoolConnection,
  target: Pick<PublicSiteUrlMigrationTarget, "table" | "columns">,
  lockRows: boolean,
) {
  const identifiers = ["id", ...target.columns].map(quoteIdentifier).join(", ");
  const where = candidateWhere(target.columns);
  const sql = `SELECT ${identifiers} FROM ${quoteIdentifier(target.table)} WHERE (${where.sql})${lockRows ? " FOR UPDATE" : ""}`;
  const [rows] = await connection.query<CandidateRow[]>(sql, where.values);
  return rows;
}

function analyzeCandidateRow(row: CandidateRow, columns: readonly string[]) {
  const updates: Record<string, string> = {};
  let replacements = 0;

  for (const column of columns) {
    const original = row[column];
    if (typeof original !== "string") continue;

    const migrated = replaceLegacyPublicSiteOrigins(original);
    if (migrated.replacements === 0) continue;

    updates[column] = migrated.value;
    replacements += migrated.replacements;
  }

  return { updates, replacements };
}

async function migrateTarget(
  connection: PoolConnection,
  target: ResolvedTarget,
  mode: MigrationMode,
): Promise<TableMigrationReport> {
  const rows = await selectCandidates(connection, target, mode === "apply");
  let changedRows = 0;
  let changedFields = 0;
  let replacements = 0;
  let updatedRows = 0;

  for (const row of rows) {
    const analyzed = analyzeCandidateRow(row, target.columns);
    const changedColumns = Object.keys(analyzed.updates);
    if (changedColumns.length === 0) continue;

    changedRows += 1;
    changedFields += changedColumns.length;
    replacements += analyzed.replacements;

    if (mode === "dry-run") continue;

    const setSql = changedColumns
      .map(column => `${quoteIdentifier(column)} = ?`)
      .join(", ");
    const values = changedColumns.map(column => analyzed.updates[column]);
    values.push(String(row.id));
    const [result] = await connection.execute<ResultSetHeader>(
      `UPDATE ${quoteIdentifier(target.table)} SET ${setSql} WHERE ${quoteIdentifier("id")} = ?`,
      values,
    );
    if (result.affectedRows !== 1) {
      throw new Error(
        `Expected to update one row in ${target.table} for id=${row.id}, updated ${result.affectedRows}`,
      );
    }
    updatedRows += result.affectedRows;
  }

  return {
    table: target.table,
    candidateRows: rows.length,
    changedRows,
    changedFields,
    replacements,
    updatedRows,
  };
}

function printReports(mode: MigrationMode, reports: readonly TableMigrationReport[]) {
  console.log("\nPer-table result");
  console.log("table | candidate rows | changed rows | changed fields | URL replacements | written rows");
  for (const report of reports) {
    console.log(
      `${report.table} | ${report.candidateRows} | ${report.changedRows} | ${report.changedFields} | ${report.replacements} | ${report.updatedRows}`,
    );
  }

  const totals = reports.reduce(
    (sum, report) => ({
      changedRows: sum.changedRows + report.changedRows,
      changedFields: sum.changedFields + report.changedFields,
      replacements: sum.replacements + report.replacements,
      updatedRows: sum.updatedRows + report.updatedRows,
    }),
    { changedRows: 0, changedFields: 0, replacements: 0, updatedRows: 0 },
  );
  console.log(
    `\nTOTAL (${mode}): ${totals.changedRows} row(s), ${totals.changedFields} field(s), ` +
    `${totals.replacements} URL occurrence(s), ${totals.updatedRows} written row(s).`,
  );
}

async function runMigration(mode: MigrationMode) {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required. No database connection was attempted.");
  }

  console.log(`Mode: ${mode === "apply" ? "APPLY (transactional write)" : "DRY RUN (read-only)"}`);
  console.log(`Target origin: ${PRIMARY_PUBLIC_SITE_ORIGIN}`);
  console.log("Values are never printed; only aggregate counts are reported.");

  const pool = mysql.createPool({ uri: databaseUrl, timezone: "+09:00", connectionLimit: 1 });
  const connection = await pool.getConnection();
  let transactionStarted = false;

  try {
    const metadata = await loadSchemaMetadata(connection);
    const resolved = resolveTargets(metadata);
    if (resolved.skipped.length > 0) {
      console.log("\nSchema targets skipped:");
      for (const item of resolved.skipped) console.log(`- ${item}`);
    }

    if (mode === "apply") {
      assertTransactionalTargets(resolved.targets);
      await connection.beginTransaction();
      transactionStarted = true;
    }

    const reports: TableMigrationReport[] = [];
    for (const target of resolved.targets) {
      reports.push(await migrateTarget(connection, target, mode));
    }

    if (mode === "apply") {
      // A second pure scan inside the transaction catches incomplete replacement
      // logic before anything is committed. Lookalike hosts remain candidates but
      // produce zero exact replacements and therefore do not fail verification.
      for (const target of resolved.targets) {
        const verification = await migrateTarget(connection, target, "dry-run");
        if (verification.changedRows > 0) {
          throw new Error(
            `Verification found ${verification.changedRows} remaining row(s) in ${target.table}`,
          );
        }
      }
      await connection.commit();
      transactionStarted = false;
    }

    printReports(mode, reports);
    console.log("\nIntentionally excluded fields:");
    for (const field of INTENTIONALLY_EXCLUDED_PUBLIC_URL_FIELDS) console.log(`- ${field}`);
    console.log("- OAuth callback/session/admin/member/private reservation fields");
    console.log("- sermon.joych.org and admin.joych.org (not matched by the exact-origin rule)");
    if (mode === "dry-run") {
      console.log("\nNo rows were changed. Re-run with --apply only after reviewing these counts and a DB backup.");
    } else {
      console.log("\nMigration committed successfully. It is safe to rerun; migrated rows will report zero changes.");
    }
  } catch (error) {
    if (transactionStarted) {
      await connection.rollback();
      console.error("Migration failed; the transaction was rolled back.");
    }
    throw error;
  } finally {
    connection.release();
    await pool.end();
  }
}

async function main() {
  const mode = parseMode(process.argv.slice(2));
  if (mode === "help") {
    printHelp();
    return;
  }
  await runMigration(mode);
}

const entryPath = process.argv[1] ? resolve(process.argv[1]) : null;
if (entryPath && fileURLToPath(import.meta.url) === entryPath) {
  main().catch(error => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
