import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { describe, it } from "node:test";

import {
  EXPECTED_COLUMNS,
  EXPECTED_INDEX,
  MIGRATION_ID,
  MIGRATION_PATH,
  applyExternalReservationSelfService,
  getExternalReservationMigrationPlan,
  validateExternalReservationColumns,
  validateExternalReservationIndex,
} from "./apply-0112-external-reservation-self-service.mjs";

function columnRows(names = EXPECTED_COLUMNS.map(column => column.name)) {
  return EXPECTED_COLUMNS
    .filter(column => names.includes(column.name))
    .map(column => ({
      tableName: column.table,
      columnName: column.name,
      dataType: column.dataType,
      columnType: column.columnType,
      characterMaximumLength: column.maxLength,
      isNullable: "YES",
      columnDefault: null,
      extra: "",
      generationExpression: "",
    }));
}

function indexRows() {
  return EXPECTED_INDEX.columns.map((columnName, columnIndex) => ({
    tableName: EXPECTED_INDEX.table,
    indexName: EXPECTED_INDEX.name,
    columnName,
    seqInIndex: columnIndex + 1,
    nonUnique: EXPECTED_INDEX.unique ? 0 : 1,
    subPart: null,
    collation: "A",
    indexType: "BTREE",
    isVisible: "YES",
  }));
}

function fakeConnection({ presentColumns = [], hasIndex = false, ledgerRecorded = true } = {}) {
  const columnResults = [columnRows(presentColumns), columnRows()];
  const indexResults = [hasIndex ? indexRows() : [], indexRows()];
  const calls = [];
  return {
    calls,
    async query(sql) {
      calls.push({ method: "query", sql });
      return [[], []];
    },
    async execute(sql, params) {
      calls.push({ method: "execute", sql, params });
      if (/^SELECT VERSION\(\)/i.test(sql)) {
        return [[{ version: "8.0.31", versionComment: "Source distribution" }], []];
      }
      if (/FROM information_schema\.COLUMNS/i.test(sql)) {
        return [columnResults.shift(), []];
      }
      if (/FROM information_schema\.STATISTICS/i.test(sql)) {
        return [indexResults.shift(), []];
      }
      if (/^SELECT id FROM app_migrations/i.test(sql)) {
        return [ledgerRecorded ? [{ id: MIGRATION_ID }] : [], []];
      }
      return [{ affectedRows: 1 }, []];
    },
  };
}

describe(MIGRATION_ID, () => {
  it("contains two nullable hash-column statements and one unique lookup-index statement", async () => {
    const source = await fs.readFile(MIGRATION_PATH, "utf8");
    const plan = getExternalReservationMigrationPlan(source);
    assert.equal(plan.statements.length, 3);
    assert.match(plan.columnStatements.get("managePasswordHash"), /varchar\s*\(\s*256\s*\)/i);
    assert.match(plan.columnStatements.get("manageLookupKeyHash"), /varchar\s*\(\s*64\s*\)/i);
    for (const statement of plan.columnStatements.values()) {
      assert.match(statement, /ALGORITHM\s*=\s*INSTANT/i);
    }
    assert.match(plan.indexStatement, /ADD\s+UNIQUE\s+INDEX/i);
    assert.match(plan.indexStatement, /reservations_external_manage_lookup_uq/i);
    assert.match(plan.indexStatement, /manageLookupKeyHash/i);
    assert.match(plan.indexStatement, /ALGORITHM\s*=\s*INPLACE/i);
    assert.match(plan.indexStatement, /LOCK\s*=\s*NONE/i);
  });

  it("accepts exact metadata and rejects same-name malformed definitions", () => {
    assert.deepEqual(validateExternalReservationColumns(columnRows()), []);
    assert.deepEqual(
      validateExternalReservationColumns([], { allowMissing: true }),
      ["managePasswordHash", "manageLookupKeyHash"],
    );
    const wrongColumn = columnRows();
    wrongColumn[1].columnType = "varchar(32)";
    wrongColumn[1].characterMaximumLength = 32;
    assert.throws(
      () => validateExternalReservationColumns(wrongColumn),
      /unexpected definition/,
    );

    assert.equal(validateExternalReservationIndex(indexRows()), false);
    assert.equal(
      validateExternalReservationIndex([], { allowMissing: true }),
      true,
    );
    const wrongIndex = indexRows();
    wrongIndex[0].columnName = "reserverName";
    assert.throws(
      () => validateExternalReservationIndex(wrongIndex),
      /unexpected definition/,
    );
  });

  it("applies only missing pieces, verifies invariants, and records the migration", async () => {
    const source = await fs.readFile(MIGRATION_PATH, "utf8");
    for (const scenario of [
      { presentColumns: [], hasIndex: false, createdCount: 3, ddlCount: 3 },
      { presentColumns: ["managePasswordHash"], hasIndex: false, createdCount: 2, ddlCount: 2 },
      { presentColumns: ["manageLookupKeyHash"], hasIndex: true, createdCount: 1, ddlCount: 1 },
      { presentColumns: ["managePasswordHash", "manageLookupKeyHash"], hasIndex: true, createdCount: 0, ddlCount: 0 },
    ]) {
      const connection = fakeConnection(scenario);
      const result = await applyExternalReservationSelfService(connection, source);
      assert.equal(result.serverVersion, "8.0.31");
      assert.equal(result.createdCount, scenario.createdCount);
      assert.equal(result.verifiedColumnCount, 2);
      assert.equal(result.verifiedIndexCount, 1);
      assert.equal(result.ledgerVerified, true);

      const ddlCalls = connection.calls.filter(
        call =>
          call.method === "query" &&
          !/CREATE TABLE IF NOT EXISTS app_migrations/i.test(call.sql) &&
          !/SET SESSION lock_wait_timeout/i.test(call.sql),
      );
      assert.equal(ddlCalls.length, scenario.ddlCount);
      assert.ok(connection.calls.some(call =>
        call.method === "query" && call.sql === "SET SESSION lock_wait_timeout = 5"
      ));
      assert.ok(connection.calls.some(call =>
        call.method === "execute" &&
        call.sql === "INSERT IGNORE INTO app_migrations (id) VALUES (?)" &&
        call.params?.[0] === MIGRATION_ID
      ));
      assert.match(connection.calls.at(-1).sql, /^SELECT id FROM app_migrations/i);
    }
  });

  it("fails the deployment if app_migrations does not confirm the record", async () => {
    const source = await fs.readFile(MIGRATION_PATH, "utf8");
    const connection = fakeConnection({
      presentColumns: ["managePasswordHash", "manageLookupKeyHash"],
      hasIndex: true,
      ledgerRecorded: false,
    });
    await assert.rejects(
      () => applyExternalReservationSelfService(connection, source),
      /was not recorded in app_migrations/,
    );
  });
});
