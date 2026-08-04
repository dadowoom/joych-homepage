import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  RECONCILED_BASELINE_TAG,
  assessDrizzleMigrationSafety,
} from "./migrate-drizzle-safely.mjs";

const ledgerEntries = [
  { tag: "0020_course_enrollment", when: 2000, hash: "hash-0020" },
  { tag: RECONCILED_BASELINE_TAG, when: 10900, hash: "hash-0109" },
  { tag: "0110_future_change", when: 11000, hash: "hash-0110" },
];

function assess(overrides = {}) {
  return assessDrizzleMigrationSafety({
    tableNames: [],
    drizzleMigrationRows: [],
    ledgerEntries,
    ...overrides,
  });
}

describe("assessDrizzleMigrationSafety", () => {
  it("allows a completely fresh database", () => {
    assert.deepEqual(assess(), {
      allowed: true,
      mode: "fresh",
      code: "fresh-database",
      message: "database has no application state",
    });
  });

  it("allows an empty Drizzle ledger before a fresh migration", () => {
    assert.equal(
      assess({ tableNames: ["__drizzle_migrations"] }).code,
      "fresh-database",
    );
  });

  it("blocks an existing application database without a Drizzle ledger", () => {
    const result = assess({ tableNames: ["users", "app_migrations"] });
    assert.equal(result.allowed, false);
    assert.equal(result.code, "missing-reconciled-baseline");
  });

  it("treats app_migrations by itself as existing application state", () => {
    const result = assess({ tableNames: ["app_migrations"] });
    assert.equal(result.allowed, false);
    assert.equal(result.code, "incomplete-application-state");
  });

  it("does not trust a baseline when all application tables are missing", () => {
    const result = assess({
      tableNames: ["app_migrations", "__drizzle_migrations"],
      drizzleMigrationRows: [{ createdAt: 10900, hash: "hash-0109" }],
    });
    assert.equal(result.allowed, false);
    assert.equal(result.code, "incomplete-application-state");
  });

  it("blocks an orphaned non-empty Drizzle ledger", () => {
    const result = assess({
      tableNames: ["__drizzle_migrations"],
      drizzleMigrationRows: [{ createdAt: 10900, hash: "hash-0109" }],
    });
    assert.equal(result.allowed, false);
    assert.equal(result.code, "orphaned-drizzle-ledger");
  });

  it("blocks a matching migration that predates the reconciled baseline", () => {
    const result = assess({
      tableNames: ["users", "__drizzle_migrations"],
      drizzleMigrationRows: [{ createdAt: 2000, hash: "hash-0020" }],
    });
    assert.equal(result.allowed, false);
    assert.equal(result.code, "below-reconciled-baseline");
  });

  it("blocks an unknown migration timestamp", () => {
    const result = assess({
      tableNames: ["users", "__drizzle_migrations"],
      drizzleMigrationRows: [{ createdAt: 12000, hash: "unknown" }],
    });
    assert.equal(result.allowed, false);
    assert.equal(result.code, "unknown-drizzle-migration");
  });

  it("blocks a hash mismatch at the reconciled baseline", () => {
    const result = assess({
      tableNames: ["users", "__drizzle_migrations"],
      drizzleMigrationRows: [{ createdAt: 10900, hash: "wrong-hash" }],
    });
    assert.equal(result.allowed, false);
    assert.equal(result.code, "drizzle-hash-mismatch");
  });

  it("blocks duplicate records at the latest timestamp", () => {
    const result = assess({
      tableNames: ["users", "__drizzle_migrations"],
      drizzleMigrationRows: [
        { createdAt: 10900, hash: "hash-0109" },
        { createdAt: "10900", hash: "hash-0109" },
      ],
    });
    assert.equal(result.allowed, false);
    assert.equal(result.code, "ambiguous-drizzle-ledger");
  });

  it("allows an existing database at the reconciled baseline", () => {
    const result = assess({
      tableNames: ["USERS", "app_migrations", "__drizzle_migrations"],
      drizzleMigrationRows: [
        { createdAt: 10900, hash: "hash-0109" },
        { createdAt: 2000, hash: "legacy-hash-can-differ" },
      ],
    });
    assert.equal(result.allowed, true);
    assert.equal(result.mode, "reconciled");
    assert.equal(result.code, "verified-reconciled-baseline");
  });

  it("allows a later journal migration with a matching timestamp and hash", () => {
    const result = assess({
      tableNames: ["users", "__drizzle_migrations"],
      drizzleMigrationRows: [
        { createdAt: 11000, hash: "hash-0110" },
        { createdAt: 10900, hash: "hash-0109" },
      ],
    });
    assert.equal(result.allowed, true);
    assert.match(result.message, /0110_future_change/);
  });
});
