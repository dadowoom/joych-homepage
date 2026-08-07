import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  evaluateBackupFreshness,
  evaluateDiskSpace,
  findLatestCompleteBackup,
  parsePm2ProcessList,
  readRemoteCheckConfig,
} from "./ops-check-remote.mjs";

async function createCompleteBackup(root, name, createdAt, options = {}) {
  const directory = path.join(root, name);
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(path.join(directory, "database.sql.gz"), "database");
  if (!options.missingUploads) {
    await fs.writeFile(path.join(directory, "uploads.tar.gz"), "uploads");
  }
  await fs.writeFile(
    path.join(directory, "manifest.json"),
    JSON.stringify({
      status: options.status || "complete",
      createdAt,
      database: { archive: "database.sql.gz" },
      uploads: { archive: "uploads.tar.gz" },
      archiveSizes: options.archiveSizes || {
        databaseBytes: 8,
        uploadsBytes: 7,
      },
    })
  );
  return directory;
}

test("accepts only online instances of the configured PM2 app", () => {
  const processes = JSON.stringify([
    { name: "other", pm2_env: { status: "stopped" } },
    { name: "joych-homepage", pm2_env: { status: "online" } },
    { name: "joych-homepage", pm2_env: { status: "online" } },
  ]);
  assert.deepEqual(parsePm2ProcessList(processes, "joych-homepage"), {
    instances: 2,
    status: "online",
  });

  assert.throws(
    () =>
      parsePm2ProcessList(
        JSON.stringify([
          { name: "joych-homepage", pm2_env: { status: "errored" } },
        ]),
        "joych-homepage"
      ),
    /not online/
  );
  assert.throws(
    () => parsePm2ProcessList("not-json", "joych-homepage"),
    /unreadable/
  );
});

test("calculates available disk percentage with integer-safe statistics", () => {
  assert.deepEqual(
    evaluateDiskSpace({ blocks: 1_000n, bavail: 253n }, 20, "backup"),
    { freePercent: 25.3 }
  );
  assert.throws(
    () => evaluateDiskSpace({ blocks: 1_000n, bavail: 99n }, 10, "backup"),
    /9.90% free/
  );
});

test("finds the newest structurally complete production backup", async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "joych-ops-backup-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));

  await createCompleteBackup(
    root,
    "joych-20260805T192700Z",
    "2026-08-05T19:27:00.000Z"
  );
  await createCompleteBackup(
    root,
    "joych-20260806T192700Z",
    "2026-08-06T19:27:00.000Z"
  );
  await createCompleteBackup(
    root,
    "joych-20260807T192700Z",
    "2026-08-07T19:27:00.000Z",
    { missingUploads: true }
  );
  await createCompleteBackup(
    root,
    "joych-20260808T192700Z",
    "2026-08-08T19:27:00.000Z",
    { status: "partial" }
  );
  await createCompleteBackup(
    root,
    "joych-20260809T192700Z",
    "2026-08-09T19:27:00.000Z",
    { archiveSizes: { databaseBytes: 1, uploadsBytes: 1 } }
  );

  const inventory = await findLatestCompleteBackup(root);
  assert.equal(inventory.count, 2);
  assert.equal(inventory.latest.name, "joych-20260806T192700Z");
  assert.equal(inventory.latest.createdAt, "2026-08-06T19:27:00.000Z");
});

test("fails stale or implausibly future backup timestamps", () => {
  const inventory = {
    count: 1,
    latest: {
      name: "joych-test",
      createdAt: "2026-08-06T00:00:00.000Z",
      createdAtMs: Date.parse("2026-08-06T00:00:00.000Z"),
    },
  };

  assert.throws(
    () =>
      evaluateBackupFreshness(
        inventory,
        24,
        Date.parse("2026-08-07T00:00:01.000Z")
      ),
    /24.00 hours old/
  );
  assert.throws(
    () =>
      evaluateBackupFreshness(
        inventory,
        24,
        Date.parse("2026-08-05T23:54:59.000Z")
      ),
    /timestamp is in the future/
  );
});

test("rejects unsafe remote configuration before running checks", () => {
  assert.throws(
    () =>
      readRemoteCheckConfig({
        JOYCH_APP_DIR: "relative/app",
        JOYCH_BACKUP_DIR: "/var/backups/joych-homepage",
      }),
    /must be an absolute path/
  );
  assert.throws(
    () =>
      readRemoteCheckConfig({
        JOYCH_APP_DIR: path.resolve("app"),
        JOYCH_BACKUP_DIR: path.resolve("backups"),
        JOYCH_PM2_APP: "joych; echo unsafe",
      }),
    /unsupported characters/
  );
});
