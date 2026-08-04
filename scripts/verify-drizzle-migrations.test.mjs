import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { normalizeMigrationSource } from "./normalize-drizzle-breakpoints.mjs";
import { verifyMigrationLedger } from "./verify-drizzle-migrations.mjs";

const temporaryFolders = [];

function makeMigrationFolder(entries, files) {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), "joych-drizzle-ledger-"));
  temporaryFolders.push(folder);
  fs.mkdirSync(path.join(folder, "meta"));
  fs.writeFileSync(
    path.join(folder, "meta", "_journal.json"),
    JSON.stringify({ version: "7", dialect: "mysql", entries }),
  );
  if (entries.length > 0) {
    const latestIndex = entries.at(-1).idx;
    fs.writeFileSync(
      path.join(folder, "meta", `${String(latestIndex).padStart(4, "0")}_snapshot.json`),
      JSON.stringify({
        version: "5",
        dialect: "mysql",
        id: `snapshot-${latestIndex}`,
        prevId: "",
        tables: {},
        enums: {},
        _meta: { schemas: {}, tables: {}, columns: {} },
      }),
    );
  }
  Object.entries(files).forEach(([name, source]) => {
    fs.writeFileSync(path.join(folder, name), source);
  });
  return folder;
}

function entry(idx, tag, when = 1000 + idx) {
  return { idx, version: "5", when, tag, breakpoints: true };
}

afterEach(() => {
  while (temporaryFolders.length > 0) {
    fs.rmSync(temporaryFolders.pop(), { recursive: true, force: true });
  }
});

describe("verifyMigrationLedger", () => {
  it("accepts a complete ledger with MySQL-safe Drizzle breakpoints", () => {
    const folder = makeMigrationFolder([entry(0, "0000_example")], {
      "0000_example.sql":
        "CREATE TABLE `example` (`id` int);\n" +
        "-- --> statement-breakpoint\n" +
        "CREATE INDEX `example_id_idx` ON `example` (`id`);\n",
    });

    assert.deepEqual(verifyMigrationLedger(folder), {
      migrationCount: 1,
      statementCount: 2,
      firstTag: "0000_example",
      lastTag: "0000_example",
    });
  });

  it("rejects a journal tag whose SQL file is missing", () => {
    const folder = makeMigrationFolder([entry(0, "0000_missing")], {});

    assert.throws(() => verifyMigrationLedger(folder), /has no SQL file/);
  });

  it("rejects SQL files that are not tracked by the journal", () => {
    const folder = makeMigrationFolder([entry(0, "0000_example")], {
      "0000_example.sql": "SELECT 1;\n",
      "0001_untracked.sql": "SELECT 2;\n",
    });

    assert.throws(
      () => verifyMigrationLedger(folder),
      /missing from journal: 0001_untracked/,
    );
  });

  it("rejects multiple statements without a Drizzle breakpoint", () => {
    const folder = makeMigrationFolder([entry(0, "0000_example")], {
      "0000_example.sql": "CREATE TABLE `a` (`id` int);\nCREATE TABLE `b` (`id` int);\n",
    });

    assert.throws(() => verifyMigrationLedger(folder), /without Drizzle breakpoints/);
  });

  it("rejects breakpoints that raw MySQL would not parse as comments", () => {
    const folder = makeMigrationFolder([entry(0, "0000_example")], {
      "0000_example.sql": "SELECT 1;\n--> statement-breakpoint\nSELECT 2;\n",
    });

    assert.throws(() => verifyMigrationLedger(folder), /not a MySQL-safe/);
  });

  it("rejects out-of-order timestamps", () => {
    const folder = makeMigrationFolder(
      [entry(0, "0000_example", 2000), entry(1, "0001_example", 1000)],
      {
        "0000_example.sql": "SELECT 1;\n",
        "0001_example.sql": "SELECT 2;\n",
      },
    );

    assert.throws(() => verifyMigrationLedger(folder), /non-increasing timestamp/);
  });

  it("rejects a migration that uses a table before an earlier statement creates it", () => {
    const folder = makeMigrationFolder([entry(0, "0000_example")], {
      "0000_example.sql": "ALTER TABLE `missing_table` ADD `value` int;\n",
    });

    assert.throws(() => verifyMigrationLedger(folder), /before the ledger creates it/);
  });

  it("rejects a ledger whose latest schema baseline snapshot is missing", () => {
    const folder = makeMigrationFolder([entry(0, "0000_example")], {
      "0000_example.sql": "SELECT 1;\n",
    });
    fs.rmSync(path.join(folder, "meta", "0000_snapshot.json"));

    assert.throws(() => verifyMigrationLedger(folder), /requires baseline snapshot/);
  });
});

describe("normalizeMigrationSource", () => {
  it("inserts safe breakpoints without splitting semicolons inside strings", () => {
    const source =
      "INSERT INTO `example` (`value`) VALUES ('first;second');\n" +
      "UPDATE `example` SET `value` = 'done';\n";

    const normalized = normalizeMigrationSource(source);

    assert.equal(
      normalized,
      "INSERT INTO `example` (`value`) VALUES ('first;second');\n" +
        "-- --> statement-breakpoint\n" +
        "UPDATE `example` SET `value` = 'done';\n",
    );
    assert.equal(normalizeMigrationSource(normalized), normalized);
  });

  it("normalizes the generated Drizzle marker into a raw-MySQL-safe comment", () => {
    const source =
      "SELECT 1;--> statement-breakpoint\n" +
      "SELECT 2;\n";

    const normalized = normalizeMigrationSource(source);

    assert.match(normalized, /SELECT 1;\n-- --> statement-breakpoint\n/);
    assert.doesNotMatch(normalized, /\n--> statement-breakpoint/);
  });

  it("is idempotent when statements were separated by blank lines", () => {
    const source = "SELECT 1;\n\nSELECT 2;\n";
    const normalized = normalizeMigrationSource(source);

    assert.equal(normalizeMigrationSource(normalized), normalized);
    assert.equal(
      normalized,
      "SELECT 1;\n-- --> statement-breakpoint\nSELECT 2;\n",
    );
  });
});
