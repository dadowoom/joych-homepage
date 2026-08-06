import fs from "node:fs/promises";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  EXPECTED_INDEXES,
  MIGRATION_ID,
  MIGRATION_PATH,
  applyDbGrowthIndexes,
  assertOfficialMysql8Version,
  splitMigrationStatements,
  validateExpectedIndexes,
} from "./apply-0110-db-growth-indexes.mjs";

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
    }))
  );
}

describe(MIGRATION_ID, () => {
  it("guards every index DDL so a partially committed migration can resume", async () => {
    const source = await fs.readFile(MIGRATION_PATH, "utf8");
    const statements = splitMigrationStatements(source);

    assert.equal(statements.length, EXPECTED_INDEXES.length * 4 + 1);
    assert.match(statements[0], /SET SESSION lock_wait_timeout = 5;\s*$/i);
    for (let index = 0; index < EXPECTED_INDEXES.length; index += 1) {
      const expected = EXPECTED_INDEXES[index];
      const offset = index * 4 + 1;
      assert.match(statements[offset], /information_schema\.STATISTICS/i);
      assert.match(
        statements[offset],
        new RegExp(`INDEX_NAME = '${expected.name}'`)
      );
      assert.ok(statements[offset].includes(`ADD INDEX \`${expected.name}\``));
      assert.match(statements[offset], /ALGORITHM=INPLACE, LOCK=NONE/);
      assert.match(statements[offset + 1], /^PREPARE joych_index_statement/i);
      assert.match(statements[offset + 2], /^EXECUTE joych_index_statement/i);
      assert.match(
        statements[offset + 3],
        /^DEALLOCATE PREPARE joych_index_statement/i
      );
    }
  });

  it("accepts only recognized official MySQL 8.x version strings", () => {
    const community = "MySQL Community Server - GPL";
    assert.equal(assertOfficialMysql8Version("8.4.10", community), "8.4.10");
    assert.equal(
      assertOfficialMysql8Version(" 8.0.43-log ", community),
      "8.0.43-log"
    );
    assert.equal(
      assertOfficialMysql8Version("8.0.43-0ubuntu0.24.04.1", community),
      "8.0.43-0ubuntu0.24.04.1"
    );
    assert.equal(
      assertOfficialMysql8Version("8.0.43-0ubuntu0.24.04.1", "(Ubuntu)"),
      "8.0.43-0ubuntu0.24.04.1"
    );
    assert.equal(
      assertOfficialMysql8Version(
        "8.0.43-commercial",
        "MySQL Enterprise Server"
      ),
      "8.0.43-commercial"
    );
    assert.equal(
      assertOfficialMysql8Version("8.0.31", "Source distribution"),
      "8.0.31"
    );

    for (const [version, comment] of [
      ["10.11.8-MariaDB", "MariaDB Server"],
      ["5.7.25-TiDB-v8.5.0", "TiDB Server"],
      ["8.0.36-28", "Percona Server (GPL)"],
      ["8.0.mysql_aurora.3.08.0", "Source distribution"],
      ["9.0.1", community],
      ["8.0.43", "(Ubuntu)"],
      ["", community],
      [null, community],
    ]) {
      assert.throws(
        () => assertOfficialMysql8Version(version, comment),
        /requires official MySQL 8\.x/
      );
    }
  });

  it("rejects an unsupported engine before issuing any DDL", async () => {
    const calls = [];
    const connection = {
      async execute(sql) {
        calls.push({ method: "execute", sql });
        return [
          [{ version: "10.11.8-MariaDB", versionComment: "MariaDB Server" }],
          [],
        ];
      },
      async query(sql) {
        calls.push({ method: "query", sql });
        throw new Error("DDL must not run");
      },
    };

    await assert.rejects(
      () => applyDbGrowthIndexes(connection, "SELECT 1;"),
      /requires official MySQL 8\.x/
    );
    assert.deepEqual(calls, [
      {
        method: "execute",
        sql: "SELECT VERSION() AS version, @@version_comment AS versionComment",
      },
    ]);
  });

  it("accepts the exact index definitions and reports partial state", () => {
    assert.deepEqual(validateExpectedIndexes(metadataRows()), []);

    const existing = EXPECTED_INDEXES.slice(0, 2);
    assert.deepEqual(
      validateExpectedIndexes(metadataRows(existing), { allowMissing: true }),
      EXPECTED_INDEXES.slice(2).map(index => index.name)
    );
  });

  it("rejects an existing index with the expected name but wrong columns", () => {
    const rows = metadataRows();
    rows.find(
      row => row.indexName === "reservations_status_created_idx"
    ).columnName = "createdAt";

    assert.throws(() => validateExpectedIndexes(rows), /unexpected definition/);
  });

  it("verifies and records the migration after repairing a partial index set", async () => {
    const source = await fs.readFile(MIGRATION_PATH, "utf8");
    const metadataResults = [
      metadataRows(EXPECTED_INDEXES.slice(0, 3)),
      metadataRows(),
    ];
    const calls = [];
    const connection = {
      async query(sql) {
        calls.push({ method: "query", sql });
        return [[], []];
      },
      async execute(sql, params) {
        calls.push({ method: "execute", sql, params });
        if (/^SELECT VERSION\(\)/i.test(sql)) {
          return [
            [
              {
                version: "8.4.10",
                versionComment: "MySQL Community Server - GPL",
              },
            ],
            [],
          ];
        }
        if (/FROM information_schema\.STATISTICS/i.test(sql)) {
          return [metadataResults.shift(), []];
        }
        return [{ affectedRows: 1 }, []];
      },
    };

    const result = await applyDbGrowthIndexes(connection, source);

    assert.deepEqual(result, {
      serverVersion: "8.4.10",
      statementCount: EXPECTED_INDEXES.length * 4 + 1,
      createdCount: EXPECTED_INDEXES.length - 3,
      verifiedCount: EXPECTED_INDEXES.length,
    });
    assert.deepEqual(calls[0], {
      method: "execute",
      sql: "SELECT VERSION() AS version, @@version_comment AS versionComment",
      params: undefined,
    });
    assert.deepEqual(calls.at(-1), {
      method: "execute",
      sql: "INSERT IGNORE INTO app_migrations (id) VALUES (?)",
      params: [MIGRATION_ID],
    });
  });

  it("preserves fresh and repeat execution behavior", async () => {
    const source = await fs.readFile(MIGRATION_PATH, "utf8");

    for (const scenario of [
      { name: "fresh", before: [], createdCount: EXPECTED_INDEXES.length },
      { name: "repeat", before: EXPECTED_INDEXES, createdCount: 0 },
    ]) {
      const metadataResults = [metadataRows(scenario.before), metadataRows()];
      const connection = {
        async query() {
          return [[], []];
        },
        async execute(sql) {
          if (/^SELECT VERSION\(\)/i.test(sql)) {
            return [
              [
                {
                  version: "8.4.10",
                  versionComment: "MySQL Community Server - GPL",
                },
              ],
              [],
            ];
          }
          if (/FROM information_schema\.STATISTICS/i.test(sql)) {
            return [metadataResults.shift(), []];
          }
          return [{ affectedRows: 1 }, []];
        },
      };

      const result = await applyDbGrowthIndexes(connection, source);
      assert.equal(result.createdCount, scenario.createdCount, scenario.name);
      assert.equal(
        result.verifiedCount,
        EXPECTED_INDEXES.length,
        scenario.name
      );
    }
  });
});
