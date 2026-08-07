import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";

import {
  assertOfficialMysql8Version,
  splitMigrationStatements,
} from "./apply-0110-db-growth-indexes.mjs";

export const MIGRATION_ID = "0111_member_admin_list_indexes";
export const MIGRATION_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "drizzle",
  `${MIGRATION_ID}.sql`,
);

export const EXPECTED_INDEXES = [
  {
    table: "church_members",
    name: "church_members_created_id_idx",
    columns: ["created_at", "id"],
  },
  {
    table: "church_members",
    name: "church_members_status_created_id_idx",
    columns: ["status", "created_at", "id"],
  },
  {
    table: "church_members",
    name: "church_members_name_created_id_idx",
    columns: ["name", "created_at", "id"],
  },
];

function indexKey(table, name) {
  return `${String(table).toLowerCase()}\0${String(name).toLowerCase()}`;
}

export function validateMemberAdminIndexes(rows, { allowMissing = false } = {}) {
  if (!Array.isArray(rows)) {
    throw new TypeError("index metadata rows must be an array");
  }

  const grouped = new Map();
  for (const row of rows) {
    const key = indexKey(row.tableName, row.indexName);
    const group = grouped.get(key) ?? [];
    group.push(row);
    grouped.set(key, group);
  }

  const missing = [];
  for (const expected of EXPECTED_INDEXES) {
    const actualRows = (grouped.get(indexKey(expected.table, expected.name)) ?? [])
      .slice()
      .sort((left, right) => Number(left.seqInIndex) - Number(right.seqInIndex));
    if (actualRows.length === 0) {
      missing.push(expected.name);
      continue;
    }

    const actualColumns = actualRows.map(row => String(row.columnName));
    const invalid =
      actualRows.length !== expected.columns.length ||
      actualColumns.some((column, index) => column !== expected.columns[index]) ||
      actualRows.some(
        row =>
          Number(row.nonUnique) !== 1 ||
          row.subPart !== null ||
          (row.collation !== null && row.collation !== "A"),
      );
    if (invalid) {
      throw new Error(
        `${expected.table}.${expected.name} has unexpected definition: ` +
          `${actualColumns.join(",") || "<none>"}; expected ${expected.columns.join(",")}`,
      );
    }
  }

  if (!allowMissing && missing.length > 0) {
    throw new Error(`${MIGRATION_ID} is missing indexes: ${missing.join(", ")}`);
  }
  return missing;
}

async function requireOfficialMysql8(connection) {
  const [rows] = await connection.execute(
    "SELECT VERSION() AS version, @@version_comment AS versionComment",
  );
  const version = Array.isArray(rows) ? rows[0]?.version : null;
  const versionComment = Array.isArray(rows) ? rows[0]?.versionComment : null;
  return assertOfficialMysql8Version(version, versionComment);
}

async function readExpectedIndexRows(connection) {
  const names = EXPECTED_INDEXES.map(index => index.name);
  const placeholders = names.map(() => "?").join(", ");
  const [rows] = await connection.execute(
    `SELECT TABLE_NAME AS tableName,
            INDEX_NAME AS indexName,
            COLUMN_NAME AS columnName,
            SEQ_IN_INDEX AS seqInIndex,
            NON_UNIQUE AS nonUnique,
            SUB_PART AS subPart,
            COLLATION AS collation
       FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
        AND INDEX_NAME IN (${placeholders})
      ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX`,
    names,
  );
  return Array.isArray(rows) ? rows : [];
}

export async function applyMemberAdminIndexes(connection, source) {
  const serverVersion = await requireOfficialMysql8(connection);
  await connection.query(`
    CREATE TABLE IF NOT EXISTS app_migrations (
      id varchar(128) PRIMARY KEY,
      applied_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB
  `);

  const beforeRows = await readExpectedIndexRows(connection);
  const missingBefore = validateMemberAdminIndexes(beforeRows, { allowMissing: true });
  const statements = splitMigrationStatements(source);
  for (const statement of statements) {
    await connection.query(statement);
  }

  const afterRows = await readExpectedIndexRows(connection);
  validateMemberAdminIndexes(afterRows);
  await connection.execute("INSERT IGNORE INTO app_migrations (id) VALUES (?)", [MIGRATION_ID]);
  return {
    serverVersion,
    statementCount: statements.length,
    createdCount: missingBefore.length,
    verifiedCount: EXPECTED_INDEXES.length,
  };
}

function isExecutedDirectly() {
  const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
  return invokedPath === fileURLToPath(import.meta.url);
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error(`DATABASE_URL is required for migration ${MIGRATION_ID}`);

  const source = await fs.readFile(MIGRATION_PATH, "utf8");
  const connection = await mysql.createConnection(databaseUrl);
  try {
    const result = await applyMemberAdminIndexes(connection, source);
    console.log(
      `[deploy] migration ${MIGRATION_ID} mysql=${result.serverVersion} ` +
        `verified=${result.verifiedCount} created=${result.createdCount}`,
    );
  } finally {
    await connection.end();
  }
}

if (isExecutedDirectly()) {
  try {
    await main();
  } catch (error) {
    console.error(
      `[deploy] migration ${MIGRATION_ID} failed: ${error instanceof Error ? error.message : error}`,
    );
    process.exitCode = 1;
  }
}
