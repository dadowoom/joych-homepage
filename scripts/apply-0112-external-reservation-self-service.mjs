import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";

import {
  assertOfficialMysql8Version,
  splitMigrationStatements,
} from "./apply-0110-db-growth-indexes.mjs";

export const MIGRATION_ID = "0112_external_reservation_self_service";
export const MIGRATION_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "drizzle",
  `${MIGRATION_ID}.sql`,
);

export const EXPECTED_COLUMNS = [
  {
    table: "reservations",
    name: "managePasswordHash",
    dataType: "varchar",
    columnType: "varchar(256)",
    maxLength: 256,
    nullable: true,
    defaultValue: null,
  },
  {
    table: "reservations",
    name: "manageLookupKeyHash",
    dataType: "varchar",
    columnType: "varchar(64)",
    maxLength: 64,
    nullable: true,
    defaultValue: null,
  },
];

export const EXPECTED_INDEX = {
  table: "reservations",
  name: "reservations_external_manage_lookup_uq",
  columns: ["manageLookupKeyHash"],
  unique: true,
};

function normalized(value) {
  return String(value ?? "").toLowerCase();
}

export function validateExternalReservationColumns(rows, { allowMissing = false } = {}) {
  if (!Array.isArray(rows)) {
    throw new TypeError("column metadata rows must be an array");
  }
  const missing = [];
  for (const expected of EXPECTED_COLUMNS) {
    const matches = rows.filter(
      row =>
        normalized(row.tableName) === normalized(expected.table) &&
        normalized(row.columnName) === normalized(expected.name),
    );
    if (matches.length === 0) {
      missing.push(expected.name);
      continue;
    }
    if (matches.length !== 1) {
      throw new Error(`${expected.table}.${expected.name} has duplicate metadata rows`);
    }

    const row = matches[0];
    const invalid =
      normalized(row.dataType) !== expected.dataType ||
      normalized(row.columnType) !== expected.columnType ||
      Number(row.characterMaximumLength) !== expected.maxLength ||
      normalized(row.isNullable) !== (expected.nullable ? "yes" : "no") ||
      row.columnDefault !== expected.defaultValue ||
      String(row.extra ?? "") !== "" ||
      String(row.generationExpression ?? "") !== "";
    if (invalid) {
      throw new Error(
        `${expected.table}.${expected.name} has unexpected definition: ` +
          `${row.columnType ?? row.dataType ?? "<unknown>"} nullable=${row.isNullable ?? "<unknown>"}; ` +
          `expected ${expected.columnType} nullable=YES default=NULL`,
      );
    }
  }
  if (missing.length > 0 && !allowMissing) {
    throw new Error(
      `${MIGRATION_ID} is missing column(s): ${missing.map(name => `reservations.${name}`).join(", ")}`,
    );
  }
  return missing;
}

export function validateExternalReservationIndex(rows, { allowMissing = false } = {}) {
  if (!Array.isArray(rows)) {
    throw new TypeError("index metadata rows must be an array");
  }
  const matches = rows
    .filter(
      row =>
        normalized(row.tableName) === normalized(EXPECTED_INDEX.table) &&
        normalized(row.indexName) === normalized(EXPECTED_INDEX.name),
    )
    .slice()
    .sort((left, right) => Number(left.seqInIndex) - Number(right.seqInIndex));
  if (matches.length === 0) {
    if (allowMissing) return true;
    throw new Error(
      `${MIGRATION_ID} is missing index: ${EXPECTED_INDEX.table}.${EXPECTED_INDEX.name}`,
    );
  }

  const actualColumns = matches.map(row => String(row.columnName));
  const expectedNonUnique = EXPECTED_INDEX.unique ? 0 : 1;
  const invalid =
    matches.length !== EXPECTED_INDEX.columns.length ||
    actualColumns.some((column, index) => column !== EXPECTED_INDEX.columns[index]) ||
    matches.some(
      row =>
        Number(row.nonUnique) !== expectedNonUnique ||
        row.subPart !== null ||
        normalized(row.indexType) !== "btree" ||
        (row.collation !== null && row.collation !== "A") ||
        (row.isVisible !== undefined && normalized(row.isVisible) !== "yes"),
    );
  if (invalid) {
    throw new Error(
      `${EXPECTED_INDEX.table}.${EXPECTED_INDEX.name} has unexpected definition: ` +
        `${actualColumns.join(",") || "<none>"}; expected ${EXPECTED_INDEX.columns.join(",")}`,
    );
  }
  return false;
}

export function getExternalReservationMigrationPlan(source) {
  const statements = splitMigrationStatements(source);
  const columnStatements = new Map();
  for (const expected of EXPECTED_COLUMNS) {
    const pattern = new RegExp(
      `\\bALTER\\s+TABLE\\s+\`?reservations\`?\\s+ADD\\s+(?:COLUMN\\s+)?\`?${expected.name}\`?\\b`,
      "i",
    );
    const matches = statements.filter(statement => pattern.test(statement));
    if (matches.length !== 1) {
      throw new Error(`${MIGRATION_ID} must contain exactly one ${expected.name} statement`);
    }
    const statement = matches[0];
    const escapedColumnType = expected.columnType
      .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      .replace(/\\\(/g, "\\s*\\(\\s*")
      .replace(/\\\)/g, "\\s*\\)");
    if (!new RegExp(`\\b${escapedColumnType}`, "i").test(statement)) {
      throw new Error(`${MIGRATION_ID} must create ${expected.name} as ${expected.columnType}`);
    }
    if (/\bNOT\s+NULL\b/i.test(statement)) {
      throw new Error(`${MIGRATION_ID} ${expected.name} must remain nullable`);
    }
    if (!/\bALGORITHM\s*=\s*INSTANT\b/i.test(statement)) {
      throw new Error(`${MIGRATION_ID} ${expected.name} addition must use ALGORITHM=INSTANT`);
    }
    columnStatements.set(expected.name, statement);
  }
  const indexPattern = new RegExp(
    "(?:\\bCREATE\\s+UNIQUE\\s+INDEX\\s+`?reservations_external_manage_lookup_uq`?\\s+ON\\s+`?reservations`?|" +
      "\\bALTER\\s+TABLE\\s+`?reservations`?\\s+ADD\\s+UNIQUE\\s+INDEX\\s+`?reservations_external_manage_lookup_uq`?)",
    "i",
  );
  const indexStatements = statements.filter(statement => indexPattern.test(statement));
  if (statements.length !== EXPECTED_COLUMNS.length + 1 || indexStatements.length !== 1) {
    throw new Error(
      `${MIGRATION_ID} must contain exactly ${EXPECTED_COLUMNS.length} column statements and one index statement`,
    );
  }
  if (
    !/\bALGORITHM\s*=\s*INPLACE\b/i.test(indexStatements[0]) ||
    !/\bLOCK\s*=\s*NONE\b/i.test(indexStatements[0])
  ) {
    throw new Error(
      `${MIGRATION_ID} lookup index must use ALGORITHM=INPLACE, LOCK=NONE`,
    );
  }
  return {
    statements,
    columnStatements,
    indexStatement: indexStatements[0],
  };
}

async function requireOfficialMysql8(connection) {
  const [rows] = await connection.execute(
    "SELECT VERSION() AS version, @@version_comment AS versionComment",
  );
  const version = Array.isArray(rows) ? rows[0]?.version : null;
  const versionComment = Array.isArray(rows) ? rows[0]?.versionComment : null;
  return assertOfficialMysql8Version(version, versionComment);
}

async function readExpectedColumnRows(connection) {
  const [rows] = await connection.execute(
    `SELECT TABLE_NAME AS tableName,
            COLUMN_NAME AS columnName,
            DATA_TYPE AS dataType,
            COLUMN_TYPE AS columnType,
            CHARACTER_MAXIMUM_LENGTH AS characterMaximumLength,
            IS_NULLABLE AS isNullable,
            COLUMN_DEFAULT AS columnDefault,
            EXTRA AS extra,
            GENERATION_EXPRESSION AS generationExpression
       FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND COLUMN_NAME IN (?, ?)`,
    [
      EXPECTED_COLUMNS[0].table,
      EXPECTED_COLUMNS[0].name,
      EXPECTED_COLUMNS[1].name,
    ],
  );
  return Array.isArray(rows) ? rows : [];
}

async function readExpectedIndexRows(connection) {
  const [rows] = await connection.execute(
    `SELECT TABLE_NAME AS tableName,
            INDEX_NAME AS indexName,
            COLUMN_NAME AS columnName,
            SEQ_IN_INDEX AS seqInIndex,
            NON_UNIQUE AS nonUnique,
            SUB_PART AS subPart,
            COLLATION AS collation,
            INDEX_TYPE AS indexType,
            IS_VISIBLE AS isVisible
       FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND INDEX_NAME = ?
      ORDER BY SEQ_IN_INDEX`,
    [EXPECTED_INDEX.table, EXPECTED_INDEX.name],
  );
  return Array.isArray(rows) ? rows : [];
}

async function assertMigrationRecorded(connection) {
  const [rows] = await connection.execute(
    "SELECT id FROM app_migrations WHERE id = ? LIMIT 1",
    [MIGRATION_ID],
  );
  if (!Array.isArray(rows) || rows[0]?.id !== MIGRATION_ID) {
    throw new Error(`${MIGRATION_ID} was not recorded in app_migrations`);
  }
}

export async function applyExternalReservationSelfService(connection, source) {
  const serverVersion = await requireOfficialMysql8(connection);
  const plan = getExternalReservationMigrationPlan(source);
  await connection.query(`
    CREATE TABLE IF NOT EXISTS app_migrations (
      id varchar(128) PRIMARY KEY,
      applied_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB
  `);
  await connection.query("SET SESSION lock_wait_timeout = 5");

  const missingColumns = validateExternalReservationColumns(
    await readExpectedColumnRows(connection),
    { allowMissing: true },
  );
  const indexMissing = validateExternalReservationIndex(
    await readExpectedIndexRows(connection),
    { allowMissing: true },
  );

  for (const columnName of missingColumns) {
    const statement = plan.columnStatements.get(columnName);
    if (!statement) {
      throw new Error(`${MIGRATION_ID} has no DDL statement for missing column ${columnName}`);
    }
    await connection.query(statement);
  }
  if (indexMissing) await connection.query(plan.indexStatement);

  validateExternalReservationColumns(await readExpectedColumnRows(connection));
  validateExternalReservationIndex(await readExpectedIndexRows(connection));
  await connection.execute("INSERT IGNORE INTO app_migrations (id) VALUES (?)", [MIGRATION_ID]);
  await assertMigrationRecorded(connection);

  return {
    serverVersion,
    statementCount: plan.statements.length,
    createdCount: missingColumns.length + Number(indexMissing),
    verifiedColumnCount: EXPECTED_COLUMNS.length,
    verifiedIndexCount: 1,
    ledgerVerified: true,
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
    const result = await applyExternalReservationSelfService(connection, source);
    console.log(
      `[deploy] migration ${MIGRATION_ID} mysql=${result.serverVersion} ` +
        `verifiedColumns=${result.verifiedColumnCount} ` +
        `verifiedIndexes=${result.verifiedIndexCount} created=${result.createdCount} ` +
        `ledger=${result.ledgerVerified ? "ok" : "failed"}`,
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
