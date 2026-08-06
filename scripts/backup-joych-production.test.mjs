import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { PassThrough, Writable } from "node:stream";
import test from "node:test";

import {
  acquireBackupLock,
  acquireDatabaseBackupLock,
  assertSafeBackupLayout,
  buildBackupManifest,
  calculateRequiredBytes,
  captureChildStdout,
  cleanupPartialBackups,
  cleanupStagingDirectory,
  createBackupPaths,
  ensureBackupSpace,
  finalizeStagingDirectory,
  installAbortExitWatchdog,
  listCompletedBackups,
  pruneExpiredBackups,
  resolveUploadsDir,
  timestamp,
} from "./backup-joych-safety.mjs";

const quietLog = { log() {}, warn() {} };

function createDatabaseLockHarness() {
  let locked = false;
  const connections = [];
  const createConnection = async () => {
    const connection = Object.assign(new EventEmitter(), {
      ended: false,
      destroyed: false,
      ownsLock: false,
      async execute(sql) {
        if (sql.includes("GET_LOCK")) {
          if (locked) return [[{ locked: 0 }]];
          locked = true;
          connection.ownsLock = true;
          return [[{ locked: 1 }]];
        }
        if (sql.includes("RELEASE_LOCK")) {
          if (!locked || !connection.ownsLock) return [[{ released: 0 }]];
          locked = false;
          connection.ownsLock = false;
          return [[{ released: 1 }]];
        }
        throw new Error(`Unexpected SQL: ${sql}`);
      },
      async end() {
        connection.ended = true;
      },
      destroy() {
        connection.destroyed = true;
        if (connection.ownsLock) {
          locked = false;
          connection.ownsLock = false;
        }
      },
    });
    connections.push(connection);
    return connection;
  };
  return { createConnection, connections, isLocked: () => locked };
}

async function withDatabaseRecoveryLease(callback) {
  const harness = createDatabaseLockHarness();
  const databaseLock = await acquireDatabaseBackupLock("mysql://test/joych", {
    createConnection: harness.createConnection,
  });
  try {
    return await callback(databaseLock.recoveryLease);
  } finally {
    await databaseLock.release();
  }
}

async function withTempDirectory(callback) {
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), "joych-backup-test-")
  );
  try {
    return await callback(directory);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
}

async function createCompletedBackup(root, name, modifiedAt) {
  const directory = path.join(root, name);
  await fs.mkdir(directory);
  await Promise.all([
    fs.writeFile(path.join(directory, "database.sql.gz"), "database"),
    fs.writeFile(path.join(directory, "uploads.tar.gz"), "uploads"),
    fs.writeFile(path.join(directory, "manifest.json"), "{}"),
  ]);
  await fs.utimes(directory, modifiedAt, modifiedAt);
  return directory;
}

test("preserves the legacy timestamp and manifest contract", () => {
  assert.equal(
    timestamp(new Date("2026-08-05T01:02:03.456Z")),
    "20260805T010203Z"
  );

  const manifest = buildBackupManifest({
    createdAt: "2026-08-05T01:02:04.000Z",
    host: "joych-host",
    appDir: "/var/www/joych-homepage",
    parsedDatabaseUrl: new URL("mysql://user:secret@db.internal:3307/joych"),
    databaseName: "joych",
    databaseArchive: "database.sql.gz",
    uploadsArchive: "uploads.tar.gz",
    uploadsDir: "/srv/joych-uploads",
    keepDays: 30,
    minSafeBackups: 1,
    prunedBackups: ["joych-old"],
    preflight: {
      uploadsBytes: 10,
      databaseBytes: 20,
      minFreeBytes: 30,
      requiredBytes: 63,
      availableBytes: 100,
    },
    databaseArchiveBytes: 5,
    uploadsArchiveBytes: 6,
  });

  assert.deepEqual(
    {
      createdAt: manifest.createdAt,
      host: manifest.host,
      appDir: manifest.appDir,
      database: manifest.database,
      uploadsArchive: manifest.uploadsArchive,
      keepDays: manifest.keepDays,
      prunedBackups: manifest.prunedBackups,
    },
    {
      createdAt: "2026-08-05T01:02:04.000Z",
      host: "joych-host",
      appDir: "/var/www/joych-homepage",
      database: {
        host: "db.internal",
        port: "3307",
        name: "joych",
        archive: "database.sql.gz",
      },
      uploadsArchive: "uploads.tar.gz",
      keepDays: 30,
      prunedBackups: ["joych-old"],
    }
  );
  assert.equal(JSON.stringify(manifest).includes("secret"), false);
});

test("resolves UPLOAD_DIR from the supplied runtime directory", () => {
  const runtimeDir = path.resolve("runtime-root");
  assert.equal(
    resolveUploadsDir(undefined, runtimeDir),
    path.join(runtimeDir, "uploads")
  );
  assert.equal(
    resolveUploadsDir("member-files", runtimeDir),
    path.join(runtimeDir, "member-files")
  );

  const absoluteUploads = path.resolve("absolute-uploads");
  assert.equal(resolveUploadsDir(absoluteUploads, runtimeDir), absoluteUploads);
});

test("rejects recursive backup and upload layouts", () => {
  const root = path.resolve("backup-root");
  const uploads = path.resolve("upload-root");
  assert.doesNotThrow(() => assertSafeBackupLayout(root, uploads));
  assert.throws(() => assertSafeBackupLayout(root, path.join(root, "uploads")));
  assert.throws(() =>
    assertSafeBackupLayout(path.join(uploads, "backups"), uploads)
  );
});

test("calculates a conservative source-size preflight", () => {
  assert.equal(
    calculateRequiredBytes({
      uploadsBytes: 100,
      databaseBytes: 200,
      minFreeBytes: 50,
    }),
    600
  );
});

test("abort watchdog exits a backup process whose cleanup does not finish", async () => {
  const controller = new AbortController();
  let resolveExit;
  const exited = new Promise(resolve => {
    resolveExit = resolve;
  });
  const stopWatchdog = installAbortExitWatchdog(controller.signal, {
    timeoutMs: 5,
    exitProcess: resolveExit,
    log: quietLog,
  });

  controller.abort();
  assert.equal(await exited, 1);
  stopWatchdog();
});

test("abort watchdog is cancelled after backup lock cleanup", async () => {
  const controller = new AbortController();
  let exitCount = 0;
  const stopWatchdog = installAbortExitWatchdog(controller.signal, {
    timeoutMs: 5,
    exitProcess: () => {
      exitCount += 1;
    },
    log: quietLog,
  });

  controller.abort();
  stopWatchdog();
  await new Promise(resolve => setTimeout(resolve, 15));
  assert.equal(exitCount, 0);
});

test("database dump waits for both child close and output finish", async () => {
  const child = new EventEmitter();
  child.stdout = new PassThrough();
  let finishOutput;
  let markFinalStarted;
  const finalStarted = new Promise(resolve => {
    markFinalStarted = resolve;
  });
  const chunks = [];
  const output = new Writable({
    write(chunk, _encoding, callback) {
      chunks.push(Buffer.from(chunk));
      callback();
    },
    final(callback) {
      finishOutput = callback;
      markFinalStarted();
    },
  });

  let settled = false;
  const capture = captureChildStdout(child, output, "mysqldump").then(() => {
    settled = true;
  });
  child.stdout.end("complete sql dump");
  await finalStarted;
  child.emit("close", 0);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(settled, false);

  finishOutput();
  await capture;
  assert.equal(settled, true);
  assert.equal(Buffer.concat(chunks).toString("utf8"), "complete sql dump");
});

test("lock excludes overlap and can be reacquired after release", async () => {
  await withTempDirectory(async root => {
    const release = await acquireBackupLock(root);
    await assert.rejects(
      acquireBackupLock(root),
      error => error.code === "BACKUP_LOCKED"
    );
    await release();
    await assert.rejects(fs.access(path.join(root, ".joych-backup.lock")), {
      code: "ENOENT",
    });

    const releaseAgain = await acquireBackupLock(root);
    await releaseAgain();
  });
});

test("database lock serializes backup processes and releases on completion", async () => {
  const harness = createDatabaseLockHarness();
  const first = await acquireDatabaseBackupLock("mysql://test/joych", {
    createConnection: harness.createConnection,
  });
  await assert.rejects(
    acquireDatabaseBackupLock("mysql://test/joych", {
      createConnection: harness.createConnection,
    }),
    error => error.code === "BACKUP_LOCKED"
  );
  assert.equal(harness.isLocked(), true);

  await first.release();
  assert.equal(harness.isLocked(), false);

  const next = await acquireDatabaseBackupLock("mysql://test/joych", {
    createConnection: harness.createConnection,
  });
  await next.release();
});

test("database lock heartbeat times out and invalidates the recovery lease", async () => {
  const connection = new EventEmitter();
  connection.destroyed = false;
  let markHeartbeatAttempted;
  let heartbeatStartTimeout;
  const heartbeatAttempted = new Promise((resolve, reject) => {
    heartbeatStartTimeout = setTimeout(
      () => reject(new Error("Database lock heartbeat did not start.")),
      1_000
    );
    markHeartbeatAttempted = () => {
      clearTimeout(heartbeatStartTimeout);
      resolve();
    };
  });
  connection.execute = async sql => {
    if (sql.includes("GET_LOCK")) return [[{ locked: 1 }]];
    if (sql.includes("SELECT 1")) {
      markHeartbeatAttempted();
      return new Promise(() => {});
    }
    throw new Error(`Unexpected SQL: ${sql}`);
  };
  connection.end = async () => {};
  connection.destroy = () => {
    connection.destroyed = true;
  };

  try {
    const databaseLock = await acquireDatabaseBackupLock("mysql://test/joych", {
      createConnection: async () => connection,
      heartbeatIntervalMs: 1,
      heartbeatTimeoutMs: 5,
    });
    await heartbeatAttempted;
    if (!databaseLock.signal.aborted) {
      await new Promise((resolve, reject) => {
        const timeoutId = setTimeout(
          () => reject(new Error("Heartbeat timeout did not abort the lock.")),
          250
        );
        databaseLock.signal.addEventListener(
          "abort",
          () => {
            clearTimeout(timeoutId);
            resolve();
          },
          { once: true }
        );
      });
    }

    assert.equal(databaseLock.signal.aborted, true);
    assert.throws(
      () => databaseLock.assertHealthy(),
      /Database backup lock connection was lost/
    );
    await assert.rejects(
      databaseLock.release(),
      /Database backup lock connection was lost/
    );
    assert.equal(connection.destroyed, true);
  } finally {
    clearTimeout(heartbeatStartTimeout);
  }
});

test("database lock acquisition timeout destroys a half-open connection", async () => {
  const keepEventLoopAlive = setTimeout(() => {}, 1_000);
  const connection = {
    destroyed: false,
    execute: async () => new Promise(() => {}),
    destroy() {
      connection.destroyed = true;
    },
  };

  try {
    await assert.rejects(
      acquireDatabaseBackupLock("mysql://test/joych", {
        createConnection: async () => connection,
        lockQueryTimeoutMs: 5,
      }),
      /Timed out while acquiring the database backup lock/
    );
    assert.equal(connection.destroyed, true);
  } finally {
    clearTimeout(keepEventLoopAlive);
  }
});

test("database lock release timeout destroys a half-open connection", async () => {
  const keepEventLoopAlive = setTimeout(() => {}, 1_000);
  const connection = {
    ended: false,
    destroyed: false,
    async execute(sql) {
      if (sql.includes("GET_LOCK")) return [[{ locked: 1 }]];
      if (sql.includes("RELEASE_LOCK")) return new Promise(() => {});
      throw new Error(`Unexpected SQL: ${sql}`);
    },
    async end() {
      connection.ended = true;
    },
    destroy() {
      connection.destroyed = true;
    },
  };
  try {
    const databaseLock = await acquireDatabaseBackupLock("mysql://test/joych", {
      createConnection: async () => connection,
      lockQueryTimeoutMs: 5,
    });

    await assert.rejects(
      databaseLock.release(),
      /Timed out while releasing the database backup lock/
    );
    assert.equal(connection.destroyed, true);
    assert.equal(connection.ended, false);
  } finally {
    clearTimeout(keepEventLoopAlive);
  }
});

test("an unconfirmed database lock release destroys the connection", async () => {
  const connection = {
    ended: false,
    destroyed: false,
    async execute(sql) {
      if (sql.includes("GET_LOCK")) return [[{ locked: 1 }]];
      if (sql.includes("RELEASE_LOCK")) return [[{ released: 0 }]];
      throw new Error(`Unexpected SQL: ${sql}`);
    },
    async end() {
      connection.ended = true;
    },
    destroy() {
      connection.destroyed = true;
    },
  };
  const databaseLock = await acquireDatabaseBackupLock("mysql://test/joych", {
    createConnection: async () => connection,
  });

  await assert.rejects(
    databaseLock.release(),
    /Database backup lock release could not be confirmed/
  );
  assert.equal(connection.destroyed, true);
  assert.equal(connection.ended, false);
});

test("an expired lock is recovered even after hostname or PID reuse", async () => {
  await withTempDirectory(async root => {
    const lockPath = path.join(root, ".joych-backup.lock");
    await fs.writeFile(
      lockPath,
      `${JSON.stringify({
        hostname: "previous-hostname",
        pid: process.pid,
        token: "expired-lock-token",
        startedAt: "2026-08-01T00:00:00.000Z",
      })}\n`
    );
    const expiredAt = new Date("2026-08-01T00:00:00.000Z");
    await fs.utimes(lockPath, expiredAt, expiredAt);

    await withDatabaseRecoveryLease(async recoveryLease => {
      const release = await acquireBackupLock(root, {
        hostname: "current-hostname",
        isProcessRunning: () => true,
        now: () => new Date("2026-08-05T00:00:00.000Z").getTime(),
        staleAfterMs: 36 * 60 * 60 * 1000,
        recoveryLease,
      });
      await release();
    });
    await assert.rejects(fs.access(lockPath), { code: "ENOENT" });
  });
});

test("an expired empty lock left by a power loss is recovered", async () => {
  await withTempDirectory(async root => {
    const lockPath = path.join(root, ".joych-backup.lock");
    await fs.writeFile(lockPath, "");
    const expiredAt = new Date("2026-08-01T00:00:00.000Z");
    await fs.utimes(lockPath, expiredAt, expiredAt);

    await withDatabaseRecoveryLease(async recoveryLease => {
      const release = await acquireBackupLock(root, {
        now: () => new Date("2026-08-05T00:00:00.000Z").getTime(),
        staleAfterMs: 36 * 60 * 60 * 1000,
        recoveryLease,
      });
      await release();
    });
    await assert.rejects(fs.access(lockPath), { code: "ENOENT" });
    await assert.rejects(
      fs.access(path.join(root, ".joych-backup.lock.recovery")),
      { code: "ENOENT" }
    );
  });
});

test("stale-lock recovery is refused without the database recovery lease", async () => {
  await withTempDirectory(async root => {
    const lockPath = path.join(root, ".joych-backup.lock");
    await fs.writeFile(lockPath, "{truncated");
    const expiredAt = new Date("2026-08-01T00:00:00.000Z");
    await fs.utimes(lockPath, expiredAt, expiredAt);
    await assert.rejects(
      acquireBackupLock(root, {
        now: () => new Date("2026-08-05T00:00:00.000Z").getTime(),
        staleAfterMs: 36 * 60 * 60 * 1000,
      }),
      error => error.code === "BACKUP_LOCKED"
    );
    await fs.access(lockPath);
  });
});

test("a recovery guard blocks the next database owner if the first lease is lost mid-recovery", async () => {
  await withTempDirectory(async root => {
    const lockPath = path.join(root, ".joych-backup.lock");
    const recoveryPath = path.join(root, ".joych-backup.lock.recovery");
    await fs.writeFile(lockPath, "{truncated");
    const expiredAt = new Date("2026-08-01T00:00:00.000Z");
    await fs.utimes(lockPath, expiredAt, expiredAt);

    const harness = createDatabaseLockHarness();
    const firstDatabaseLock = await acquireDatabaseBackupLock(
      "mysql://test/joych",
      { createConnection: harness.createConnection }
    );

    let markMainUnlinkStarted;
    const mainUnlinkStarted = new Promise(resolve => {
      markMainUnlinkStarted = resolve;
    });
    let allowMainUnlink;
    const mainUnlinkAllowed = new Promise(resolve => {
      allowMainUnlink = resolve;
    });
    const interruptedFs = Object.create(fs);
    interruptedFs.unlink = async target => {
      if (target === lockPath) {
        markMainUnlinkStarted();
        await mainUnlinkAllowed;
      }
      return fs.unlink(target);
    };

    const firstFilesystemLock = acquireBackupLock(root, {
      fsApi: interruptedFs,
      now: () => new Date("2026-08-05T00:00:00.000Z").getTime(),
      staleAfterMs: 36 * 60 * 60 * 1000,
      recoveryLease: firstDatabaseLock.recoveryLease,
    });
    await mainUnlinkStarted;
    assert.equal((await fs.stat(recoveryPath)).isDirectory(), true);
    assert.equal((await fs.readdir(recoveryPath)).length, 1);

    harness.connections[0].emit("error", new Error("database link lost"));
    assert.equal(firstDatabaseLock.signal.aborted, true);
    const secondDatabaseLock = await acquireDatabaseBackupLock(
      "mysql://test/joych",
      { createConnection: harness.createConnection }
    );
    await assert.rejects(
      acquireBackupLock(root, {
        recoveryLease: secondDatabaseLock.recoveryLease,
      }),
      error => error.code === "BACKUP_LOCKED"
    );

    await fs.access(recoveryPath);
    allowMainUnlink();
    await assert.rejects(
      firstFilesystemLock,
      error => error.code === "BACKUP_LOCKED"
    );
    await assert.rejects(fs.access(lockPath), { code: "ENOENT" });
    await fs.access(recoveryPath);
    await assert.rejects(
      firstDatabaseLock.release(),
      /Database backup lock connection was lost/
    );
    await secondDatabaseLock.release();

    const thirdDatabaseLock = await acquireDatabaseBackupLock(
      "mysql://test/joych",
      { createConnection: harness.createConnection }
    );
    const releaseRecoveredLock = await acquireBackupLock(root, {
      isProcessRunning: () => false,
      recoveryLease: thirdDatabaseLock.recoveryLease,
    });
    await releaseRecoveredLock();
    await thirdDatabaseLock.release();
    await assert.rejects(fs.access(recoveryPath), { code: "ENOENT" });
  });
});

test("a live recovery guard with a recent heartbeat is retained", async () => {
  await withTempDirectory(async root => {
    const recoveryPath = path.join(root, ".joych-backup.lock.recovery");
    const ownerPath = path.join(recoveryPath, "live-owner-token.json");
    await fs.mkdir(recoveryPath);
    await fs.writeFile(
      ownerPath,
      `${JSON.stringify({
        hostname: "current-hostname",
        pid: 4321,
        token: "live-owner-token",
        startedAt: "2026-08-05T00:00:00.000Z",
      })}\n`
    );
    const recentHeartbeat = new Date("2026-08-05T00:00:00.000Z");
    await fs.utimes(ownerPath, recentHeartbeat, recentHeartbeat);

    await withDatabaseRecoveryLease(async recoveryLease => {
      await assert.rejects(
        acquireBackupLock(root, {
          hostname: "current-hostname",
          isProcessRunning: pid => pid === 4321,
          now: () => new Date("2026-08-05T00:00:30.000Z").getTime(),
          staleAfterMs: 60 * 1000,
          recoveryLease,
        }),
        error => error.code === "BACKUP_LOCKED"
      );
    });

    await fs.access(ownerPath);
  });
});

test("an expired recovery guard is reclaimed after PID reuse", async () => {
  await withTempDirectory(async root => {
    const recoveryPath = path.join(root, ".joych-backup.lock.recovery");
    const ownerPath = path.join(recoveryPath, "reused-pid-token.json");
    await fs.mkdir(recoveryPath);
    await fs.writeFile(
      ownerPath,
      `${JSON.stringify({
        hostname: "current-hostname",
        pid: 4321,
        token: "reused-pid-token",
        startedAt: "2026-01-01T00:00:00.000Z",
      })}\n`
    );
    const oldHeartbeat = new Date("2026-01-01T00:00:00.000Z");
    await fs.utimes(ownerPath, oldHeartbeat, oldHeartbeat);

    await withDatabaseRecoveryLease(async recoveryLease => {
      const release = await acquireBackupLock(root, {
        hostname: "current-hostname",
        isProcessRunning: pid => pid === 4321,
        now: () => new Date("2026-08-05T00:00:00.000Z").getTime(),
        staleAfterMs: 60 * 1000,
        recoveryLease,
      });
      await release();
    });

    await assert.rejects(fs.access(recoveryPath), { code: "ENOENT" });
  });
});

test("a delayed stale-guard cleanup cannot remove a newer non-empty guard directory", async () => {
  await withTempDirectory(async root => {
    const lockPath = path.join(root, ".joych-backup.lock");
    const recoveryPath = path.join(root, ".joych-backup.lock.recovery");
    const staleOwnerPath = path.join(recoveryPath, "stale-owner.json");
    await fs.writeFile(lockPath, "{truncated");
    await fs.mkdir(recoveryPath);
    await fs.writeFile(
      staleOwnerPath,
      `${JSON.stringify({
        hostname: "old-host",
        pid: 111,
        token: "stale-owner",
        startedAt: "2026-01-01T00:00:00.000Z",
      })}\n`
    );
    const oldHeartbeat = new Date("2026-01-01T00:00:00.000Z");
    await fs.utimes(lockPath, oldHeartbeat, oldHeartbeat);
    await fs.utimes(staleOwnerPath, oldHeartbeat, oldHeartbeat);

    const harness = createDatabaseLockHarness();
    const firstDatabaseLock = await acquireDatabaseBackupLock(
      "mysql://test/joych",
      { createConnection: harness.createConnection }
    );
    let markFirstRmdirStarted;
    const firstRmdirStarted = new Promise(resolve => {
      markFirstRmdirStarted = resolve;
    });
    let allowFirstRmdir;
    const firstRmdirAllowed = new Promise(resolve => {
      allowFirstRmdir = resolve;
    });
    const firstFs = Object.create(fs);
    let delayedFirstRmdir = false;
    firstFs.rmdir = async target => {
      if (target === recoveryPath && !delayedFirstRmdir) {
        delayedFirstRmdir = true;
        markFirstRmdirStarted();
        await firstRmdirAllowed;
      }
      return fs.rmdir(target);
    };

    const firstRecoveryAttempt = acquireBackupLock(root, {
      fsApi: firstFs,
      hostname: "worker-a",
      pid: 222,
      isProcessRunning: () => false,
      now: () => new Date("2026-08-05T00:00:00.000Z").getTime(),
      staleAfterMs: 60 * 60 * 1000,
      recoveryLease: firstDatabaseLock.recoveryLease,
    });
    await firstRmdirStarted;
    harness.connections[0].emit("error", new Error("database link lost"));

    const secondDatabaseLock = await acquireDatabaseBackupLock(
      "mysql://test/joych",
      { createConnection: harness.createConnection }
    );
    let markSecondMainUnlinkStarted;
    const secondMainUnlinkStarted = new Promise(resolve => {
      markSecondMainUnlinkStarted = resolve;
    });
    let allowSecondMainUnlink;
    const secondMainUnlinkAllowed = new Promise(resolve => {
      allowSecondMainUnlink = resolve;
    });
    const secondFs = Object.create(fs);
    secondFs.unlink = async target => {
      if (target === lockPath) {
        markSecondMainUnlinkStarted();
        await secondMainUnlinkAllowed;
      }
      return fs.unlink(target);
    };
    const secondRecoveryAttempt = acquireBackupLock(root, {
      fsApi: secondFs,
      hostname: "worker-b",
      pid: 333,
      isProcessRunning: candidatePid => candidatePid === 333,
      now: () => Date.now() + 10 * 60 * 1000,
      staleAfterMs: 60 * 60 * 1000,
      recoveryLease: secondDatabaseLock.recoveryLease,
    });
    await secondMainUnlinkStarted;
    assert.equal((await fs.readdir(recoveryPath)).length, 1);

    allowFirstRmdir();
    await assert.rejects(firstRecoveryAttempt);
    assert.equal((await fs.stat(recoveryPath)).isDirectory(), true);
    assert.equal((await fs.readdir(recoveryPath)).length, 1);

    allowSecondMainUnlink();
    const releaseSecondFilesystemLock = await secondRecoveryAttempt;
    await releaseSecondFilesystemLock();
    await assert.rejects(
      firstDatabaseLock.release(),
      /Database backup lock connection was lost/
    );
    await secondDatabaseLock.release();
    await assert.rejects(fs.access(recoveryPath), { code: "ENOENT" });
  });
});

test("recovery stops if a second owner token appears before main replacement", async () => {
  await withTempDirectory(async root => {
    const lockPath = path.join(root, ".joych-backup.lock");
    const recoveryPath = path.join(root, ".joych-backup.lock.recovery");
    await fs.writeFile(lockPath, "{truncated");
    const oldHeartbeat = new Date("2026-01-01T00:00:00.000Z");
    await fs.utimes(lockPath, oldHeartbeat, oldHeartbeat);

    const harness = createDatabaseLockHarness();
    const databaseLock = await acquireDatabaseBackupLock("mysql://test/joych", {
      createConnection: harness.createConnection,
    });
    let markMainUnlinkStarted;
    const mainUnlinkStarted = new Promise(resolve => {
      markMainUnlinkStarted = resolve;
    });
    let allowMainUnlink;
    const mainUnlinkAllowed = new Promise(resolve => {
      allowMainUnlink = resolve;
    });
    const interruptedFs = Object.create(fs);
    interruptedFs.unlink = async target => {
      if (target === lockPath) {
        markMainUnlinkStarted();
        await mainUnlinkAllowed;
      }
      return fs.unlink(target);
    };

    const recoveryAttempt = acquireBackupLock(root, {
      fsApi: interruptedFs,
      hostname: "current-hostname",
      pid: 5678,
      isProcessRunning: () => false,
      now: () => new Date("2026-08-05T00:00:00.000Z").getTime(),
      staleAfterMs: 60 * 1000,
      recoveryLease: databaseLock.recoveryLease,
    });
    await mainUnlinkStarted;
    await fs.writeFile(
      path.join(recoveryPath, "unexpected-owner.json"),
      `${JSON.stringify({
        hostname: "another-host",
        pid: 9999,
        token: "unexpected-owner",
        startedAt: "2026-08-05T00:00:00.000Z",
      })}\n`
    );
    allowMainUnlink();

    await assert.rejects(
      recoveryAttempt,
      error => error.code === "BACKUP_LOCKED"
    );
    await assert.rejects(fs.access(lockPath), { code: "ENOENT" });
    assert.equal((await fs.readdir(recoveryPath)).length, 2);
    await databaseLock.release();
  });
});

test("a live lock with a recent heartbeat is retained after a long run", async () => {
  await withTempDirectory(async root => {
    const lockPath = path.join(root, ".joych-backup.lock");
    await fs.writeFile(
      lockPath,
      `${JSON.stringify({
        hostname: "current-hostname",
        pid: process.pid,
        token: "long-running-lock-token",
        startedAt: "2026-08-01T00:00:00.000Z",
      })}\n`
    );
    const recentHeartbeat = new Date("2026-08-05T00:30:00.000Z");
    await fs.utimes(lockPath, recentHeartbeat, recentHeartbeat);

    await assert.rejects(
      acquireBackupLock(root, {
        hostname: "current-hostname",
        isProcessRunning: () => true,
        now: () => new Date("2026-08-05T01:00:00.000Z").getTime(),
        staleAfterMs: 36 * 60 * 60 * 1000,
      }),
      error => error.code === "BACKUP_LOCKED"
    );
    await fs.access(lockPath);
  });
});

test("a recent lock is retained even when it belongs to another host", async () => {
  await withTempDirectory(async root => {
    const lockPath = path.join(root, ".joych-backup.lock");
    await fs.writeFile(
      lockPath,
      `${JSON.stringify({
        hostname: "another-hostname",
        pid: 1234,
        token: "recent-lock-token",
        startedAt: "2026-08-05T00:00:00.000Z",
      })}\n`
    );

    await assert.rejects(
      acquireBackupLock(root, {
        hostname: "current-hostname",
        isProcessRunning: () => false,
        now: () => new Date("2026-08-05T01:00:00.000Z").getTime(),
        staleAfterMs: 36 * 60 * 60 * 1000,
      }),
      error => error.code === "BACKUP_LOCKED"
    );
    await fs.access(lockPath);
  });
});

test("lock write or sync failure removes only the lock created by that attempt", async () => {
  await withTempDirectory(async root => {
    const failingFs = Object.create(fs);
    failingFs.open = async (...args) => {
      const handle = await fs.open(...args);
      return {
        writeFile: (...writeArgs) => handle.writeFile(...writeArgs),
        sync: async () => {
          throw Object.assign(new Error("disk full"), { code: "ENOSPC" });
        },
        stat: () => handle.stat(),
        close: () => handle.close(),
      };
    };

    await assert.rejects(acquireBackupLock(root, { fsApi: failingFs }), {
      code: "ENOSPC",
    });
    await assert.rejects(fs.access(path.join(root, ".joych-backup.lock")), {
      code: "ENOENT",
    });
  });
});

test("staging is atomically finalized and partial directories are cleaned", async () => {
  await withTempDirectory(async root => {
    const paths = createBackupPaths(root, "20260805T010203Z", "test-token");
    assert.equal(
      path.basename(paths.stagingDir),
      "joych-20260805T010203Z.partial-test-token"
    );
    await fs.mkdir(paths.stagingDir);
    await fs.writeFile(path.join(paths.stagingDir, "marker"), "ok");
    await finalizeStagingDirectory(paths.stagingDir, paths.finalDir);
    assert.equal(
      await fs.readFile(path.join(paths.finalDir, "marker"), "utf8"),
      "ok"
    );
    await assert.rejects(fs.access(paths.stagingDir), { code: "ENOENT" });

    const failedPaths = createBackupPaths(
      root,
      "20260805T010204Z",
      "failed-token"
    );
    await fs.mkdir(failedPaths.stagingDir);
    await cleanupStagingDirectory(failedPaths.stagingDir);
    await assert.rejects(fs.access(failedPaths.stagingDir), { code: "ENOENT" });

    const stalePaths = createBackupPaths(
      root,
      "20260805T010205Z",
      "stale-token"
    );
    await fs.mkdir(stalePaths.stagingDir);
    assert.deepEqual(await cleanupPartialBackups(root), [
      path.basename(stalePaths.stagingDir),
    ]);
  });
});

test("preflight prunes only as much as needed and keeps the newest safe backup", async () => {
  await withTempDirectory(async root => {
    const oldest = await createCompletedBackup(
      root,
      "joych-20260801T000000Z",
      new Date("2026-08-01T00:00:00Z")
    );
    const middle = await createCompletedBackup(
      root,
      "joych-20260802T000000Z",
      new Date("2026-08-02T00:00:00Z")
    );
    const newest = await createCompletedBackup(
      root,
      "joych-20260803T000000Z",
      new Date("2026-08-03T00:00:00Z")
    );

    const result = await ensureBackupSpace({
      backupRoot: root,
      uploadsDir: path.join(root, "not-read-by-stub"),
      databaseUrl: "mysql://unused/unused",
      keepDays: 30,
      minSafeBackups: 1,
      minFreeBytes: 0,
      allowSpacePrune: true,
      directorySize: async () => 100,
      databaseSize: async () => 100,
      availableBytes: async () => {
        try {
          await fs.access(oldest);
          return 0;
        } catch {
          return 1_000;
        }
      },
      now: new Date("2026-08-05T00:00:00Z").getTime(),
      log: quietLog,
    });

    assert.deepEqual(result.prunedBackups, [path.basename(oldest)]);
    await assert.rejects(fs.access(oldest), { code: "ENOENT" });
    await fs.access(middle);
    await fs.access(newest);
  });
});

test("preflight does not prune unexpired backups unless explicitly enabled", async () => {
  await withTempDirectory(async root => {
    const existing = await createCompletedBackup(
      root,
      "joych-20260804T000000Z",
      new Date("2026-08-04T00:00:00Z")
    );

    await assert.rejects(
      ensureBackupSpace({
        backupRoot: root,
        uploadsDir: path.join(root, "not-read-by-stub"),
        databaseUrl: "mysql://unused/unused",
        keepDays: 30,
        minSafeBackups: 1,
        minFreeBytes: 0,
        directorySize: async () => 100,
        databaseSize: async () => 100,
        availableBytes: async () => 0,
        now: new Date("2026-08-05T00:00:00Z").getTime(),
        log: quietLog,
      }),
      error => error.code === "BACKUP_DISK_SPACE"
    );

    await fs.access(existing);
  });
});

test("disk failure never prunes below the configured safe count", async () => {
  await withTempDirectory(async root => {
    await createCompletedBackup(
      root,
      "joych-20260801T000000Z",
      new Date("2026-08-01T00:00:00Z")
    );
    await createCompletedBackup(
      root,
      "joych-20260802T000000Z",
      new Date("2026-08-02T00:00:00Z")
    );
    const newest = await createCompletedBackup(
      root,
      "joych-20260803T000000Z",
      new Date("2026-08-03T00:00:00Z")
    );

    await assert.rejects(
      ensureBackupSpace({
        backupRoot: root,
        uploadsDir: path.join(root, "not-read-by-stub"),
        databaseUrl: "mysql://unused/unused",
        keepDays: 30,
        minSafeBackups: 1,
        minFreeBytes: 0,
        allowSpacePrune: true,
        directorySize: async () => 100,
        databaseSize: async () => 100,
        availableBytes: async () => 0,
        now: new Date("2026-08-05T00:00:00Z").getTime(),
        log: quietLog,
      }),
      error => error.code === "BACKUP_DISK_SPACE"
    );

    const remaining = await listCompletedBackups(root);
    assert.deepEqual(
      remaining.map(backup => backup.path),
      [newest]
    );
  });
});

test("retention runs after success and still preserves a safe backup", async () => {
  await withTempDirectory(async root => {
    const oldBackup = await createCompletedBackup(
      root,
      "joych-20260101T000000Z",
      new Date("2026-01-01T00:00:00Z")
    );
    const currentBackup = await createCompletedBackup(
      root,
      "joych-20260805T000000Z",
      new Date("2026-08-05T00:00:00Z")
    );
    const removed = await pruneExpiredBackups({
      backupRoot: root,
      keepDays: 30,
      minSafeBackups: 1,
      now: new Date("2026-08-05T01:00:00Z").getTime(),
      log: quietLog,
    });

    assert.deepEqual(removed, [path.basename(oldBackup)]);
    await assert.rejects(fs.access(oldBackup), { code: "ENOENT" });
    await fs.access(currentBackup);
  });
});
