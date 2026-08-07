import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  findLatestCompleteBackup,
  orchestrateProductionBackup,
  verifyBackupArchives,
} from "./ops-run-production-backup.mjs";

function backup(createdAt) {
  return {
    name: "joych-test",
    createdAt,
    createdAtMs: Date.parse(createdAt),
  };
}

function config(overrides = {}) {
  return {
    appDir: path.resolve("app"),
    backupDir: path.resolve("backups"),
    force: false,
    skipFreshHours: 12,
    lockWaitMinutes: 90,
    pollSeconds: 30,
    commandTimeoutMinutes: 105,
    ...overrides,
  };
}

async function createCompleteBackup(
  root,
  name,
  createdAt,
  status = "complete"
) {
  const directory = path.join(root, name);
  await fs.mkdir(directory, { recursive: true });
  await Promise.all([
    fs.writeFile(path.join(directory, "database.sql.gz"), "database"),
    fs.writeFile(path.join(directory, "uploads.tar.gz"), "uploads"),
    fs.writeFile(
      path.join(directory, "manifest.json"),
      JSON.stringify({
        status,
        createdAt,
        database: { archive: "database.sql.gz" },
        uploads: { archive: "uploads.tar.gz" },
        archiveSizes: { databaseBytes: 8, uploadsBytes: 7 },
      })
    ),
  ]);
}

test("recognizes only the newest structurally complete backup", async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "joych-ops-runner-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await createCompleteBackup(
    root,
    "joych-20260806T192700Z",
    "2026-08-06T19:27:00.000Z"
  );
  await createCompleteBackup(
    root,
    "joych-20260807T192700Z",
    "2026-08-07T19:27:00.000Z",
    "partial"
  );
  await createCompleteBackup(
    root,
    "joych-20260808T192700Z",
    "2026-08-08T19:27:00.000Z"
  );
  await fs.appendFile(
    path.join(root, "joych-20260808T192700Z", "database.sql.gz"),
    "changed-after-manifest"
  );

  const latest = await findLatestCompleteBackup(root);
  assert.equal(latest.name, "joych-20260806T192700Z");
});

test("checks gzip CRCs and tar structure without exposing command output", () => {
  const calls = [];
  const result = verifyBackupArchives(
    { directoryPath: path.resolve("backup") },
    (command, args, options) => {
      calls.push({ command, args, options });
      return { status: 0 };
    }
  );

  assert.deepEqual(result, { checkedArchives: 2 });
  assert.deepEqual(
    calls.map(call => call.command),
    ["gzip", "gzip", "tar"]
  );
  assert.ok(calls.every(call => call.options.stdio[1] === "ignore"));

  assert.throws(
    () =>
      verifyBackupArchives({ directoryPath: path.resolve("backup") }, () => ({
        status: 1,
        stderr: "DATABASE_URL=secret",
      })),
    error => {
      assert.equal(
        error.message,
        "Completed backup archive integrity check failed."
      );
      assert.equal(error.message.includes("secret"), false);
      return true;
    }
  );
});

test("skips a recent backup unless a manual run is forced", async () => {
  const nowMs = Date.parse("2026-08-07T20:00:00.000Z");
  let commandCalls = 0;
  const recent = backup("2026-08-07T19:27:00.000Z");
  const result = await orchestrateProductionBackup({
    config: config(),
    now: () => nowMs,
    findLatest: async () => recent,
    runBackup: async () => {
      commandCalls += 1;
      return { code: 0, locked: false, timedOut: false };
    },
  });

  assert.equal(result.status, "skipped-fresh");
  assert.equal(commandCalls, 0);
});

test("requires a new complete backup after a successful command", async () => {
  const nowMs = Date.parse("2026-08-07T19:27:00.000Z");
  const old = backup("2026-08-06T19:27:00.000Z");
  const fresh = backup("2026-08-07T19:28:00.000Z");
  let inventoryCalls = 0;
  const result = await orchestrateProductionBackup({
    config: config({ force: true }),
    now: () => nowMs + inventoryCalls * 60_000,
    findLatest: async () => {
      inventoryCalls += 1;
      return inventoryCalls === 1 ? old : fresh;
    },
    runBackup: async () => ({ code: 0, locked: false, timedOut: false }),
    log: { log() {} },
  });

  assert.equal(result.status, "completed");
  assert.equal(result.backup, fresh);
});

test("does not mistake the recent pre-run backup for a new completion", async () => {
  const nowMs = Date.parse("2026-08-07T19:27:00.000Z");
  const recentBeforeRun = backup("2026-08-07T19:24:00.000Z");
  let inventoryCalls = 0;

  await assert.rejects(
    orchestrateProductionBackup({
      config: config({ force: true }),
      now: () => nowMs,
      findLatest: async () => {
        inventoryCalls += 1;
        return recentBeforeRun;
      },
      runBackup: async () => ({ code: 0, locked: false, timedOut: false }),
      log: { log() {} },
    }),
    /without a newly completed backup/
  );
  assert.equal(inventoryCalls, 2);
});

test("a lock collision waits for the concurrent backup to complete", async () => {
  let nowMs = Date.parse("2026-08-07T19:27:00.000Z");
  const old = backup("2026-08-06T19:27:00.000Z");
  const fresh = backup("2026-08-07T19:28:00.000Z");
  let inventoryCalls = 0;
  const result = await orchestrateProductionBackup({
    config: config({ force: true, pollSeconds: 30 }),
    now: () => nowMs,
    findLatest: async () => {
      inventoryCalls += 1;
      return inventoryCalls < 3 ? old : fresh;
    },
    runBackup: async () => ({ code: 1, locked: true, timedOut: false }),
    sleep: async milliseconds => {
      nowMs += milliseconds;
    },
    log: { log() {} },
  });

  assert.equal(result.status, "completed-by-concurrent-run");
  assert.equal(result.backup, fresh);
});

test("a lock collision cannot satisfy verification with its pre-run backup", async () => {
  let nowMs = Date.parse("2026-08-07T19:27:00.000Z");
  const recentBeforeRun = backup("2026-08-07T19:24:00.000Z");

  await assert.rejects(
    orchestrateProductionBackup({
      config: config({
        force: true,
        lockWaitMinutes: 1,
        pollSeconds: 30,
      }),
      now: () => nowMs,
      findLatest: async () => recentBeforeRun,
      runBackup: async () => ({ code: 1, locked: true, timedOut: false }),
      sleep: async milliseconds => {
        nowMs += milliseconds;
      },
      log: { log() {} },
    }),
    /did not produce a completed backup/
  );
});

test("a command failure is generic and never includes captured output", async () => {
  await assert.rejects(
    orchestrateProductionBackup({
      config: config({ force: true }),
      now: () => Date.parse("2026-08-07T19:27:00.000Z"),
      findLatest: async () => null,
      runBackup: async () => ({
        code: 2,
        locked: false,
        timedOut: false,
        output: "DATABASE_URL=secret",
      }),
      log: { log() {} },
    }),
    error => {
      assert.equal(
        error.message,
        "Production backup command failed with exit code 2."
      );
      assert.equal(error.message.includes("secret"), false);
      return true;
    }
  );
});
