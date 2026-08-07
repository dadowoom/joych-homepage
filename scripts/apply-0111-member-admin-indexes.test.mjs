import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { describe, it } from "node:test";

import {
  EXPECTED_INDEXES,
  MIGRATION_ID,
  MIGRATION_PATH,
  applyMemberAdminIndexes,
  validateMemberAdminIndexes,
} from "./apply-0111-member-admin-indexes.mjs";
import { splitMigrationStatements } from "./apply-0110-db-growth-indexes.mjs";

function metadataRows(indexes = EXPECTED_INDEXES) {
  return indexes.flatMap(index =>
    index.columns.map((columnName, columnIndex) => ({
      tableName: index.table,
      indexName: index.name,
      columnName,
      seqInIndex: columnIndex + 1,
      nonUnique: 1,
      subPart: null,
      collation: "A",
    })),
  );
}

function fakeConnection(before = []) {
  const metadataResults = [metadataRows(before), metadataRows()];
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
      if (/FROM information_schema\.STATISTICS/i.test(sql)) {
        return [metadataResults.shift(), []];
      }
      return [{ affectedRows: 1 }, []];
    },
  };
}

describe(MIGRATION_ID, () => {
  it("guards each online index statement and supports partial reruns", async () => {
    const source = await fs.readFile(MIGRATION_PATH, "utf8");
    const statements = splitMigrationStatements(source);
    assert.equal(statements.length, EXPECTED_INDEXES.length * 4 + 1);
    assert.match(statements[0], /SET SESSION lock_wait_timeout = 5/i);
    for (const expected of EXPECTED_INDEXES) {
      const guard = statements.find(statement => statement.includes(`ADD INDEX \`${expected.name}\``));
      assert.ok(guard);
      assert.match(guard, /information_schema\.STATISTICS/i);
      assert.match(guard, /ALGORITHM=INPLACE, LOCK=NONE/i);
    }
  });

  it("accepts exact definitions and rejects a same-name wrong index", () => {
    assert.deepEqual(validateMemberAdminIndexes(metadataRows()), []);
    const partial = EXPECTED_INDEXES.slice(0, 1);
    assert.deepEqual(
      validateMemberAdminIndexes(metadataRows(partial), { allowMissing: true }),
      EXPECTED_INDEXES.slice(1).map(index => index.name),
    );

    const wrong = metadataRows();
    wrong.find(row => row.indexName === "church_members_status_created_id_idx").columnName = "name";
    assert.throws(() => validateMemberAdminIndexes(wrong), /unexpected definition/);
  });

  it("verifies, records, and reports fresh and repeated application", async () => {
    const source = await fs.readFile(MIGRATION_PATH, "utf8");
    for (const scenario of [
      { before: [], createdCount: EXPECTED_INDEXES.length },
      { before: EXPECTED_INDEXES, createdCount: 0 },
    ]) {
      const connection = fakeConnection(scenario.before);
      const result = await applyMemberAdminIndexes(connection, source);
      assert.equal(result.serverVersion, "8.0.31");
      assert.equal(result.verifiedCount, EXPECTED_INDEXES.length);
      assert.equal(result.createdCount, scenario.createdCount);
      assert.deepEqual(connection.calls.at(-1), {
        method: "execute",
        sql: "INSERT IGNORE INTO app_migrations (id) VALUES (?)",
        params: [MIGRATION_ID],
      });
    }
  });
});
