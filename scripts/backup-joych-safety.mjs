import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pipeline } from "node:stream/promises";

import mysql from "mysql2/promise";

const LOCK_FILE = ".joych-backup.lock";
const LOCK_RECOVERY_FILE = ".joych-backup.lock.recovery";
const PARTIAL_MARKER = ".partial-";
const REQUIRED_FILES = ["database.sql.gz", "uploads.tar.gz", "manifest.json"];
const heldLocks = new Set();
const activeDatabaseRecoveryLeases = new WeakSet();

export function timestamp(date = new Date()) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\..+$/, "Z");
}

export function resolveUploadsDir(configuredUploadDir, appDir) {
  const configured = configuredUploadDir?.trim() || "uploads";
  return path.resolve(
    path.isAbsolute(configured) ? configured : path.join(appDir, configured)
  );
}

export function parseIntegerSetting(value, fallback, name, minimum = 0) {
  const parsed = Number.parseInt(value ?? String(fallback), 10);
  if (!Number.isSafeInteger(parsed) || parsed < minimum) {
    throw new Error(
      `${name} must be an integer greater than or equal to ${minimum}.`
    );
  }
  return parsed;
}

export async function captureChildStdout(child, outputStream, command) {
  let childError = null;
  const childClosed = new Promise(resolve => {
    child.once("error", error => {
      childError = error;
    });
    child.once("close", code => resolve(code));
  });

  const outputFinished = pipeline(child.stdout, outputStream).catch(error => {
    child.kill?.();
    throw error;
  });
  const [childResult, outputResult] = await Promise.allSettled([
    childClosed,
    outputFinished,
  ]);

  if (outputResult.status === "rejected") throw outputResult.reason;
  if (childResult.status === "rejected") throw childResult.reason;
  if (childError) throw childError;
  if (childResult.value !== 0) {
    throw new Error(`${command} exited with code ${childResult.value}`);
  }
}

function isPathInside(parentPath, candidatePath) {
  const relative = path.relative(parentPath, candidatePath);
  return (
    relative !== "" &&
    relative !== ".." &&
    !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative)
  );
}

export function assertSafeBackupLayout(backupRoot, uploadsDir) {
  const root = path.resolve(backupRoot);
  const uploads = path.resolve(uploadsDir);
  if (uploads === path.parse(uploads).root) {
    throw new Error("UPLOAD_DIR cannot be a filesystem root.");
  }
  if (
    root === uploads ||
    isPathInside(root, uploads) ||
    isPathInside(uploads, root)
  ) {
    throw new Error(
      "JOYCH_BACKUP_DIR and UPLOAD_DIR cannot contain one another."
    );
  }
}

function processIsRunning(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code !== "ESRCH";
  }
}

async function readLockOwner(lockPath, fsApi) {
  try {
    return JSON.parse(await fsApi.readFile(lockPath, "utf8"));
  } catch {
    return null;
  }
}

function sameFile(left, right) {
  return left.dev === right.dev && left.ino === right.ino;
}

async function removeCreatedLock(handle, lockPath, fsApi) {
  let ownedStat;
  try {
    ownedStat = await handle.stat();
  } finally {
    await handle.close().catch(() => {});
  }

  try {
    const currentStat = await fsApi.stat(lockPath);
    if (sameFile(ownedStat, currentStat)) await fsApi.unlink(lockPath);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

async function statOrNull(filePath, fsApi) {
  try {
    return await fsApi.stat(filePath);
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

async function unlinkIfExists(filePath, fsApi) {
  try {
    await fsApi.unlink(filePath);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

function withDeadline(promise, timeoutMs, message) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(Object.assign(new Error(message), { code: "BACKUP_DB_TIMEOUT" }));
    }, timeoutMs);
    timeoutId.unref?.();
  });
  return Promise.race([promise, timeout]).finally(() => {
    clearTimeout(timeoutId);
  });
}

export function installAbortExitWatchdog(
  signal,
  {
    timeoutMs = 30_000,
    exitProcess = code => process.exit(code),
    log = console,
  } = {}
) {
  const safeTimeoutMs =
    Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 30_000;
  let timer = null;
  let disposed = false;
  const handleAbort = () => {
    if (disposed || timer) return;
    log.error?.(
      `[joych-backup] database lock lost; forcing backup process exit in ${safeTimeoutMs}ms if cleanup does not finish`
    );
    timer = setTimeout(() => {
      timer = null;
      if (!disposed) exitProcess(1);
    }, safeTimeoutMs);
  };

  signal.addEventListener("abort", handleAbort, { once: true });
  if (signal.aborted) handleAbort();

  return () => {
    if (disposed) return;
    disposed = true;
    signal.removeEventListener("abort", handleAbort);
    if (timer) clearTimeout(timer);
    timer = null;
  };
}

export async function acquireDatabaseBackupLock(
  databaseUrl,
  {
    createConnection = mysql.createConnection,
    lockName = "joych-homepage:production-backup",
    heartbeatIntervalMs = 60_000,
    lockQueryTimeoutMs = 15_000,
    heartbeatTimeoutMs = 15_000,
  } = {}
) {
  const connection = await createConnection(databaseUrl);
  const recoveryLease = {};
  const safeLockQueryTimeout =
    Number.isFinite(lockQueryTimeoutMs) && lockQueryTimeoutMs > 0
      ? lockQueryTimeoutMs
      : 15_000;
  const safeHeartbeatTimeout =
    Number.isFinite(heartbeatTimeoutMs) && heartbeatTimeoutMs > 0
      ? heartbeatTimeoutMs
      : 15_000;
  try {
    const [rows] = await withDeadline(
      connection.execute("SELECT GET_LOCK(?, 0) AS locked", [lockName]),
      safeLockQueryTimeout,
      "Timed out while acquiring the database backup lock."
    );
    if (Number(rows?.[0]?.locked ?? 0) !== 1) {
      throw Object.assign(
        new Error("Another production backup is already running."),
        { code: "BACKUP_LOCKED" }
      );
    }
    activeDatabaseRecoveryLeases.add(recoveryLease);
  } catch (error) {
    try {
      connection.destroy();
    } catch {}
    throw error;
  }

  const abortController = new AbortController();
  let connectionFailure = null;
  let releasing = false;
  const markConnectionFailed = error => {
    if (releasing || connectionFailure) return;
    connectionFailure = Object.assign(
      new Error("Database backup lock connection was lost."),
      { cause: error }
    );
    activeDatabaseRecoveryLeases.delete(recoveryLease);
    abortController.abort(connectionFailure);
    try {
      connection.destroy();
    } catch {}
  };
  const handleConnectionError = error => markConnectionFailed(error);
  const handleConnectionEnd = () =>
    markConnectionFailed(new Error("Database connection ended unexpectedly."));
  connection.on?.("error", handleConnectionError);
  connection.on?.("end", handleConnectionEnd);

  const safeHeartbeatInterval =
    Number.isFinite(heartbeatIntervalMs) && heartbeatIntervalMs > 0
      ? heartbeatIntervalMs
      : 60_000;
  let heartbeatTask = null;
  const heartbeatTimer = setInterval(() => {
    if (heartbeatTask || releasing || connectionFailure) return;
    heartbeatTask = (async () => {
      try {
        await withDeadline(
          connection.execute("SELECT 1 AS alive"),
          safeHeartbeatTimeout,
          "Database backup lock heartbeat timed out."
        );
      } catch (error) {
        markConnectionFailed(error);
      } finally {
        heartbeatTask = null;
      }
    })();
  }, safeHeartbeatInterval);
  heartbeatTimer.unref?.();

  let released = false;
  return {
    recoveryLease,
    signal: abortController.signal,
    assertHealthy() {
      if (connectionFailure) throw connectionFailure;
    },
    async release() {
      if (released) return;
      released = true;
      clearInterval(heartbeatTimer);
      if (heartbeatTask) await heartbeatTask;
      releasing = true;
      connection.off?.("error", handleConnectionError);
      connection.off?.("end", handleConnectionEnd);
      connection.removeListener?.("error", handleConnectionError);
      connection.removeListener?.("end", handleConnectionEnd);
      activeDatabaseRecoveryLeases.delete(recoveryLease);

      if (connectionFailure) {
        try {
          connection.destroy();
        } catch {}
        throw connectionFailure;
      }

      let releaseConfirmed = false;
      try {
        const [rows] = await withDeadline(
          connection.execute("SELECT RELEASE_LOCK(?) AS released", [lockName]),
          safeLockQueryTimeout,
          "Timed out while releasing the database backup lock."
        );
        releaseConfirmed = Number(rows?.[0]?.released ?? 0) === 1;
        if (!releaseConfirmed) {
          throw new Error(
            "Database backup lock release could not be confirmed."
          );
        }
      } finally {
        if (releaseConfirmed) {
          try {
            await connection.end();
          } catch (error) {
            try {
              connection.destroy();
            } catch {}
            throw error;
          }
        } else {
          try {
            connection.destroy();
          } catch {}
        }
      }
    },
  };
}

export async function acquireBackupLock(
  backupRoot,
  {
    fsApi = fs,
    hostname = os.hostname(),
    pid = process.pid,
    isProcessRunning = processIsRunning,
    now = Date.now,
    staleAfterMs = 36 * 60 * 60 * 1000,
    recoveryLease,
  } = {}
) {
  const lockPath = path.join(path.resolve(backupRoot), LOCK_FILE);
  const recoveryPath = path.join(path.resolve(backupRoot), LOCK_RECOVERY_FILE);
  if (heldLocks.has(lockPath)) {
    throw Object.assign(
      new Error(`Backup is already running (lock=${lockPath}).`),
      {
        code: "BACKUP_LOCKED",
      }
    );
  }

  const currentTime = () => (typeof now === "function" ? now() : now);
  const canRecoverStaleLock = () =>
    activeDatabaseRecoveryLeases.has(recoveryLease);
  const usesDatabaseRecoveryLease = recoveryLease !== undefined;
  const shouldMaintainHeartbeat = () =>
    !usesDatabaseRecoveryLease || canRecoverStaleLock();
  const readLockState = async filePath => {
    const [owner, stat] = await Promise.all([
      readLockOwner(filePath, fsApi),
      statOrNull(filePath, fsApi),
    ]);
    return { owner, stat };
  };
  const isStaleLock = ({ owner, stat }) => {
    if (!stat) return false;
    const ownerPid = Number(owner?.pid);
    const staleSameHostLock =
      owner?.hostname === hostname &&
      Number.isInteger(ownerPid) &&
      ownerPid > 0 &&
      !isProcessRunning(ownerPid);
    const lastActivityMs = Number.isFinite(stat.mtimeMs)
      ? stat.mtimeMs
      : Date.parse(owner?.startedAt);
    const staleByAge =
      Number.isFinite(lastActivityMs) &&
      Number.isFinite(currentTime()) &&
      Number.isFinite(staleAfterMs) &&
      staleAfterMs > 0 &&
      currentTime() - lastActivityMs >= staleAfterMs;
    return staleSameHostLock || staleByAge;
  };
  const readRecoveryGuardState = async () => {
    const directoryStat = await statOrNull(recoveryPath, fsApi);
    if (!directoryStat) {
      return {
        owner: null,
        stat: null,
        ownerPath: null,
        directoryStat: null,
        isDirectory: false,
      };
    }

    if (!directoryStat.isDirectory()) {
      return {
        owner: await readLockOwner(recoveryPath, fsApi),
        stat: directoryStat,
        ownerPath: recoveryPath,
        directoryStat,
        isDirectory: false,
      };
    }

    const ownerNames = (await fsApi.readdir(recoveryPath))
      .filter(name => name.endsWith(".json"))
      .sort();
    for (const ownerName of ownerNames) {
      const ownerPath = path.join(recoveryPath, ownerName);
      const [owner, ownerStat] = await Promise.all([
        readLockOwner(ownerPath, fsApi),
        statOrNull(ownerPath, fsApi),
      ]);
      if (ownerStat) {
        return {
          owner,
          stat: ownerStat,
          ownerPath,
          directoryStat,
          isDirectory: true,
        };
      }
    }

    return {
      owner: null,
      stat: directoryStat,
      ownerPath: null,
      directoryStat,
      isDirectory: true,
    };
  };
  const isStaleRecoveryGuard = ({ owner, stat }) => {
    if (!stat) return false;
    const ownerPid = Number(owner?.pid);
    if (
      owner?.hostname === hostname &&
      Number.isInteger(ownerPid) &&
      ownerPid > 0
    ) {
      if (!isProcessRunning(ownerPid)) return true;
    }

    const lastActivityMs = Number.isFinite(stat.mtimeMs)
      ? stat.mtimeMs
      : Date.parse(owner?.startedAt);
    const initializationStaleAfterMs = Math.min(staleAfterMs, 5 * 60 * 1000);
    const effectiveStaleAfterMs = owner
      ? staleAfterMs
      : initializationStaleAfterMs;
    return (
      Number.isFinite(lastActivityMs) &&
      Number.isFinite(currentTime()) &&
      Number.isFinite(effectiveStaleAfterMs) &&
      effectiveStaleAfterMs > 0 &&
      currentTime() - lastActivityMs >= effectiveStaleAfterMs
    );
  };
  const lockError = owner => {
    const ownerLabel = owner
      ? `host=${owner.hostname || "unknown"} pid=${owner.pid || "unknown"} startedAt=${owner.startedAt || "unknown"}`
      : "owner=unknown";
    return Object.assign(
      new Error(`Backup is already running (${ownerLabel}, lock=${lockPath}).`),
      { code: "BACKUP_LOCKED" }
    );
  };
  const removeStaleRecoveryGuard = async recoveryState => {
    if (!canRecoverStaleLock()) return false;

    if (!recoveryState.isDirectory) {
      const latestState = await readLockState(recoveryPath);
      if (
        !latestState.stat ||
        !sameFile(recoveryState.stat, latestState.stat) ||
        recoveryState.stat.mtimeMs !== latestState.stat.mtimeMs ||
        recoveryState.owner?.token !== latestState.owner?.token
      ) {
        return false;
      }
      if (!canRecoverStaleLock()) return false;
      await unlinkIfExists(recoveryPath, fsApi);
      return true;
    }

    if (recoveryState.ownerPath) {
      const [latestOwner, latestOwnerStat] = await Promise.all([
        readLockOwner(recoveryState.ownerPath, fsApi),
        statOrNull(recoveryState.ownerPath, fsApi),
      ]);
      if (
        !latestOwnerStat ||
        !sameFile(recoveryState.stat, latestOwnerStat) ||
        recoveryState.stat.mtimeMs !== latestOwnerStat.mtimeMs ||
        recoveryState.owner?.token !== latestOwner?.token
      ) {
        return false;
      }
      if (!canRecoverStaleLock()) return false;
      await unlinkIfExists(recoveryState.ownerPath, fsApi);
    } else {
      const latestDirectoryStat = await statOrNull(recoveryPath, fsApi);
      if (
        !latestDirectoryStat ||
        !sameFile(recoveryState.directoryStat, latestDirectoryStat) ||
        recoveryState.directoryStat.mtimeMs !== latestDirectoryStat.mtimeMs
      ) {
        return false;
      }
    }

    if (!canRecoverStaleLock()) return false;
    try {
      await fsApi.rmdir(recoveryPath);
      return true;
    } catch (error) {
      if (error?.code === "ENOENT") return true;
      if (error?.code === "ENOTEMPTY" || error?.code === "EEXIST") {
        return false;
      }
      throw error;
    }
  };

  const createOwnedLock = async () => {
    const token = randomUUID();
    let handle;
    try {
      handle = await fsApi.open(lockPath, "wx", 0o600);
      await handle.writeFile(
        `${JSON.stringify({ hostname, pid, token, startedAt: new Date().toISOString() })}\n`
      );
      await handle.sync();
      const ownedStat = await handle.stat();
      heldLocks.add(lockPath);
      const heartbeatIntervalMs = Math.min(
        60_000,
        Math.max(1_000, Math.floor(staleAfterMs / 4))
      );
      const heartbeatTimer = setInterval(() => {
        if (!shouldMaintainHeartbeat()) {
          clearInterval(heartbeatTimer);
          return;
        }
        const heartbeatAt = new Date();
        void handle.utimes(heartbeatAt, heartbeatAt).catch(() => {});
      }, heartbeatIntervalMs);
      heartbeatTimer.unref?.();

      let released = false;
      return async () => {
        if (released) return;
        released = true;
        clearInterval(heartbeatTimer);
        heldLocks.delete(lockPath);
        await handle.close().catch(() => {});
        try {
          const [owner, currentStat] = await Promise.all([
            readLockOwner(lockPath, fsApi),
            fsApi.stat(lockPath),
          ]);
          if (owner?.token === token && sameFile(ownedStat, currentStat)) {
            await fsApi.unlink(lockPath);
          }
        } catch (error) {
          if (error?.code !== "ENOENT") throw error;
        }
      };
    } catch (error) {
      if (handle) {
        await removeCreatedLock(handle, lockPath, fsApi);
      }
      throw error;
    }
  };

  const createRecoveryGuard = async () => {
    const token = randomUUID();
    const ownerName = `${token}.json`;
    const ownerPath = path.join(recoveryPath, ownerName);
    let handle;
    let directoryCreated = false;
    try {
      await fsApi.mkdir(recoveryPath, { mode: 0o700 });
      directoryCreated = true;
      const ownedDirectoryStat = await fsApi.stat(recoveryPath);
      if (!ownedDirectoryStat.isDirectory()) throw lockError(null);
      handle = await fsApi.open(ownerPath, "wx", 0o600);
      await handle.writeFile(
        `${JSON.stringify({ hostname, pid, token, startedAt: new Date().toISOString() })}\n`
      );
      await handle.sync();
      const ownedStat = await handle.stat();
      const heartbeatIntervalMs = Math.min(
        60_000,
        Math.max(1_000, Math.floor(staleAfterMs / 4))
      );
      let guardFailure = null;
      const heartbeatTimer = setInterval(() => {
        if (!canRecoverStaleLock()) {
          clearInterval(heartbeatTimer);
          return;
        }
        const heartbeatAt = new Date();
        void handle.utimes(heartbeatAt, heartbeatAt).catch(error => {
          guardFailure = error;
          clearInterval(heartbeatTimer);
        });
      }, heartbeatIntervalMs);
      heartbeatTimer.unref?.();

      let closed = false;
      const assertGuardStructure = async () => {
        const [owner, currentStat, currentDirectoryStat, ownerNames] =
          await Promise.all([
            readLockOwner(ownerPath, fsApi),
            statOrNull(ownerPath, fsApi),
            statOrNull(recoveryPath, fsApi),
            fsApi.readdir(recoveryPath).catch(() => []),
          ]);
        if (
          !currentStat ||
          !currentDirectoryStat ||
          !currentDirectoryStat.isDirectory() ||
          owner?.token !== token ||
          !sameFile(ownedStat, currentStat) ||
          !sameFile(ownedDirectoryStat, currentDirectoryStat) ||
          ownerNames.length !== 1 ||
          ownerNames[0] !== ownerName
        ) {
          throw lockError(owner);
        }
      };
      const assertOwned = async () => {
        if (guardFailure || !canRecoverStaleLock()) {
          const error = lockError({ hostname, pid });
          if (guardFailure) error.cause = guardFailure;
          throw error;
        }
        await assertGuardStructure();
      };
      const release = async ({ remove = true } = {}) => {
        if (closed) return;
        let validationError = null;
        if (remove) {
          try {
            await assertGuardStructure();
          } catch (error) {
            validationError = error;
          }
        }
        closed = true;
        clearInterval(heartbeatTimer);
        await handle.close().catch(() => {});
        if (!remove) return;
        if (validationError) throw validationError;

        const [owner, currentStat] = await Promise.all([
          readLockOwner(ownerPath, fsApi),
          statOrNull(ownerPath, fsApi),
        ]);
        if (
          currentStat &&
          owner?.token === token &&
          sameFile(ownedStat, currentStat)
        ) {
          await fsApi.unlink(ownerPath);
        } else if (currentStat) {
          throw lockError(owner);
        }

        try {
          await fsApi.rmdir(recoveryPath);
        } catch (error) {
          if (error?.code !== "ENOENT") throw error;
        }
      };
      return { assertOwned, release };
    } catch (error) {
      if (handle) {
        await handle.close().catch(() => {});
      }
      await unlinkIfExists(ownerPath, fsApi).catch(() => {});
      if (directoryCreated) {
        try {
          await fsApi.rmdir(recoveryPath);
        } catch (cleanupError) {
          if (
            cleanupError?.code !== "ENOENT" &&
            cleanupError?.code !== "ENOTEMPTY" &&
            cleanupError?.code !== "EEXIST"
          ) {
            throw cleanupError;
          }
        }
      }
      throw error;
    }
  };

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const recoveryState = await readRecoveryGuardState();
    if (recoveryState.stat) {
      const mainState = await readLockState(lockPath);
      if (!canRecoverStaleLock()) throw lockError(mainState.owner);
      if (!isStaleRecoveryGuard(recoveryState)) {
        throw lockError(recoveryState.owner ?? mainState.owner);
      }
      await removeStaleRecoveryGuard(recoveryState);
      continue;
    }

    try {
      return await createOwnedLock();
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
    }

    const mainState = await readLockState(lockPath);
    if (!mainState.stat) continue;
    if (!isStaleLock(mainState)) throw lockError(mainState.owner);
    if (!canRecoverStaleLock()) throw lockError(mainState.owner);

    let recoveryGuard;
    let releaseOwnedLock;
    try {
      recoveryGuard = await createRecoveryGuard();
    } catch (error) {
      if (error?.code === "EEXIST") continue;
      throw error;
    }

    try {
      await recoveryGuard.assertOwned();
      const latestMainState = await readLockState(lockPath);
      if (
        !latestMainState.stat ||
        !sameFile(mainState.stat, latestMainState.stat) ||
        mainState.stat.mtimeMs !== latestMainState.stat.mtimeMs
      ) {
        await recoveryGuard.release({ remove: canRecoverStaleLock() });
        continue;
      }
      if (!isStaleLock(latestMainState)) {
        await recoveryGuard.release({ remove: canRecoverStaleLock() });
        throw lockError(latestMainState.owner);
      }

      await recoveryGuard.assertOwned();
      await unlinkIfExists(lockPath, fsApi);
      await recoveryGuard.assertOwned();
      releaseOwnedLock = await createOwnedLock();
      await recoveryGuard.assertOwned();

      await recoveryGuard.release();
      return releaseOwnedLock;
    } catch (error) {
      if (releaseOwnedLock) {
        await releaseOwnedLock().catch(() => {});
      }
      if (recoveryGuard) {
        await recoveryGuard
          .release({ remove: canRecoverStaleLock() })
          .catch(() => {});
      }
      if (error?.code === "EEXIST" && canRecoverStaleLock()) continue;
      throw error;
    }
  }

  const { owner } = await readLockState(lockPath);
  throw lockError(owner);
}

function isPartialName(name) {
  return name.startsWith("joych-") && name.includes(PARTIAL_MARKER);
}

export async function cleanupPartialBackups(backupRoot, fsApi = fs) {
  const entries = await fsApi
    .readdir(backupRoot, { withFileTypes: true })
    .catch(() => []);
  const removed = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || !isPartialName(entry.name)) continue;
    await fsApi.rm(path.join(backupRoot, entry.name), {
      recursive: true,
      force: true,
    });
    removed.push(entry.name);
  }
  return removed;
}

export async function getDirectorySize(directory, fsApi = fs) {
  let total = 0;
  const pending = [directory];
  while (pending.length > 0) {
    const current = pending.pop();
    const entries = await fsApi.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const entryPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        pending.push(entryPath);
      } else {
        try {
          total += (await fsApi.lstat(entryPath)).size;
        } catch (error) {
          if (error?.code !== "ENOENT") throw error;
        }
      }
    }
  }
  if (!Number.isSafeInteger(total))
    throw new Error("UPLOAD_DIR is too large to estimate safely.");
  return total;
}

export async function estimateDatabaseSize(
  databaseUrl,
  createConnection = mysql.createConnection
) {
  const parsed = new URL(databaseUrl);
  const databaseName = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
  if (!databaseName)
    throw new Error("DATABASE_URL must include a database name.");

  const connection = await createConnection(databaseUrl);
  try {
    const [rows] = await connection.execute(
      `SELECT COALESCE(SUM(DATA_LENGTH + INDEX_LENGTH), 0) AS estimatedBytes
       FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = ?`,
      [databaseName]
    );
    const bytes = Number(rows?.[0]?.estimatedBytes ?? 0);
    if (!Number.isSafeInteger(bytes) || bytes < 0) {
      throw new Error("Database size estimate is invalid.");
    }
    return bytes;
  } finally {
    await connection.end();
  }
}

export function calculateRequiredBytes({
  uploadsBytes,
  databaseBytes,
  minFreeBytes,
}) {
  for (const [name, value] of Object.entries({
    uploadsBytes,
    databaseBytes,
    minFreeBytes,
  })) {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new Error(`${name} must be a non-negative safe integer.`);
    }
  }
  // The legacy flow briefly stores both database.sql and database.sql.gz.
  return Math.ceil((uploadsBytes + databaseBytes * 2) * 1.1) + minFreeBytes;
}

async function getAvailableBytes(targetPath, fsApi = fs) {
  const stat = await fsApi.statfs(targetPath);
  const available = Number(stat.bavail) * Number(stat.bsize);
  if (!Number.isSafeInteger(available) || available < 0) {
    throw new Error(
      "Available backup disk space could not be determined safely."
    );
  }
  return available;
}

async function isNonEmptyFile(filePath, fsApi) {
  try {
    const stat = await fsApi.stat(filePath);
    return stat.isFile() && stat.size > 0;
  } catch {
    return false;
  }
}

async function inspectCompletedBackup(backupRoot, entry, fsApi) {
  if (
    !entry.isDirectory() ||
    !entry.name.startsWith("joych-") ||
    isPartialName(entry.name)
  ) {
    return null;
  }
  const backupPath = path.join(backupRoot, entry.name);
  const directoryStat = await fsApi.lstat(backupPath);
  if (directoryStat.isSymbolicLink()) return null;
  for (const fileName of REQUIRED_FILES) {
    if (!(await isNonEmptyFile(path.join(backupPath, fileName), fsApi)))
      return null;
  }
  return { name: entry.name, path: backupPath, mtimeMs: directoryStat.mtimeMs };
}

export async function listCompletedBackups(backupRoot, fsApi = fs) {
  const entries = await fsApi
    .readdir(backupRoot, { withFileTypes: true })
    .catch(() => []);
  const backups = await Promise.all(
    entries.map(entry => inspectCompletedBackup(backupRoot, entry, fsApi))
  );
  return backups
    .filter(Boolean)
    .sort(
      (left, right) =>
        left.mtimeMs - right.mtimeMs || left.name.localeCompare(right.name)
    );
}

function selectSpaceCandidates(
  backups,
  { keepDays, minSafeBackups, now, allowSpacePrune }
) {
  const removable = backups.slice(
    0,
    Math.max(0, backups.length - minSafeBackups)
  );
  const cutoff =
    keepDays > 0 ? now - keepDays * 86_400_000 : Number.NEGATIVE_INFINITY;
  const expired =
    keepDays > 0 ? removable.filter(backup => backup.mtimeMs < cutoff) : [];
  const expiredPaths = new Set(expired.map(backup => backup.path));
  const candidates = expired.map(backup => ({ ...backup, reason: "expired" }));
  if (allowSpacePrune) {
    candidates.push(
      ...removable
        .filter(backup => !expiredPaths.has(backup.path))
        .map(backup => ({ ...backup, reason: "space-pressure" }))
    );
  }
  return candidates;
}

async function removeCompletedBackup(backupRoot, backup, fsApi) {
  if (
    path.dirname(backup.path) !== backupRoot ||
    path.basename(backup.path) !== backup.name
  ) {
    throw new Error(
      `Refusing to remove backup outside the managed root: ${backup.path}`
    );
  }
  const entry = (await fsApi.readdir(backupRoot, { withFileTypes: true })).find(
    candidate => candidate.name === backup.name
  );
  if (!entry || !(await inspectCompletedBackup(backupRoot, entry, fsApi))) {
    throw new Error(`Refusing to remove an incomplete backup: ${backup.path}`);
  }
  await fsApi.rm(backup.path, { recursive: true, force: true });
}

export async function ensureBackupSpace({
  backupRoot,
  uploadsDir,
  databaseUrl,
  keepDays,
  minSafeBackups,
  minFreeBytes,
  allowSpacePrune = process.env.JOYCH_BACKUP_ALLOW_SPACE_PRUNE === "1",
  fsApi = fs,
  directorySize = directory => getDirectorySize(directory, fsApi),
  databaseSize = estimateDatabaseSize,
  availableBytes = target => getAvailableBytes(target, fsApi),
  now = Date.now(),
  log = console,
}) {
  const [uploadsBytes, databaseBytes] = await Promise.all([
    directorySize(uploadsDir),
    databaseSize(databaseUrl),
  ]);
  const requiredBytes = calculateRequiredBytes({
    uploadsBytes,
    databaseBytes,
    minFreeBytes,
  });
  let available = await availableBytes(backupRoot);
  const prunedBackups = [];

  if (available < requiredBytes) {
    const backups = await listCompletedBackups(backupRoot, fsApi);
    const candidates = selectSpaceCandidates(backups, {
      keepDays,
      minSafeBackups,
      now,
      allowSpacePrune,
    });
    for (const candidate of candidates) {
      if (available >= requiredBytes) break;
      log.warn(
        `[joych-backup] low disk space: pruning ${candidate.name} reason=${candidate.reason}`
      );
      await removeCompletedBackup(backupRoot, candidate, fsApi);
      prunedBackups.push(candidate.name);
      available = await availableBytes(backupRoot);
    }
  }

  if (available < requiredBytes) {
    throw Object.assign(
      new Error(
        `Insufficient backup disk space: available=${available} required=${requiredBytes}. ` +
          `At least ${minSafeBackups} completed backup(s) were preserved.`
      ),
      { code: "BACKUP_DISK_SPACE" }
    );
  }

  return {
    uploadsBytes,
    databaseBytes,
    minFreeBytes,
    requiredBytes,
    availableBytes: available,
    prunedBackups,
  };
}

export async function pruneExpiredBackups({
  backupRoot,
  keepDays,
  minSafeBackups,
  fsApi = fs,
  now = Date.now(),
  log = console,
}) {
  if (!Number.isFinite(keepDays) || keepDays <= 0) return [];
  const backups = await listCompletedBackups(backupRoot, fsApi);
  const removable = backups.slice(
    0,
    Math.max(0, backups.length - minSafeBackups)
  );
  const cutoff = now - keepDays * 86_400_000;
  const removed = [];
  for (const backup of removable) {
    if (backup.mtimeMs >= cutoff) continue;
    log.log(`[joych-backup] retention: pruning ${backup.name}`);
    await removeCompletedBackup(backupRoot, backup, fsApi);
    removed.push(backup.name);
  }
  return removed;
}

export function createBackupPaths(backupRoot, stamp, token = randomUUID()) {
  const finalName = `joych-${stamp}`;
  return {
    finalDir: path.join(backupRoot, finalName),
    stagingDir: path.join(backupRoot, `${finalName}${PARTIAL_MARKER}${token}`),
  };
}

export async function finalizeStagingDirectory(
  stagingDir,
  finalDir,
  fsApi = fs
) {
  try {
    await fsApi.lstat(finalDir);
    throw new Error(`Backup destination already exists: ${finalDir}`);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  await fsApi.rename(stagingDir, finalDir);
}

export async function cleanupStagingDirectory(stagingDir, fsApi = fs) {
  if (stagingDir) await fsApi.rm(stagingDir, { recursive: true, force: true });
}

export function buildBackupManifest({
  createdAt,
  host,
  appDir,
  parsedDatabaseUrl,
  databaseName,
  databaseArchive,
  uploadsArchive,
  uploadsDir,
  keepDays,
  minSafeBackups,
  prunedBackups,
  preflight,
  databaseArchiveBytes,
  uploadsArchiveBytes,
}) {
  return {
    createdAt,
    host,
    appDir,
    database: {
      host: parsedDatabaseUrl.hostname,
      port: parsedDatabaseUrl.port || "3306",
      name: databaseName,
      archive: databaseArchive,
    },
    uploadsArchive,
    keepDays,
    prunedBackups: [...prunedBackups],
    status: "complete",
    uploads: {
      sourceDir: uploadsDir,
      archive: uploadsArchive,
      archiveRoot: path.basename(uploadsDir),
      sourceBytes: preflight.uploadsBytes,
      archiveBytes: uploadsArchiveBytes,
    },
    retention: {
      minSafeBackups,
      prunedBeforeBackup: [...prunedBackups],
      prunedAfterBackup: [],
    },
    diskPreflight: {
      databaseBytes: preflight.databaseBytes,
      minFreeBytes: preflight.minFreeBytes,
      requiredBytes: preflight.requiredBytes,
      availableBytes: preflight.availableBytes,
    },
    archiveSizes: {
      databaseBytes: databaseArchiveBytes,
      uploadsBytes: uploadsArchiveBytes,
    },
  };
}

export async function rewriteManifestAtomically(
  backupDir,
  manifest,
  fsApi = fs
) {
  const manifestPath = path.join(backupDir, "manifest.json");
  const temporaryPath = path.join(
    backupDir,
    `.manifest${PARTIAL_MARKER}${randomUUID()}`
  );
  try {
    await fsApi.writeFile(
      temporaryPath,
      `${JSON.stringify(manifest, null, 2)}\n`,
      {
        mode: 0o600,
        flag: "wx",
      }
    );
    await fsApi.rename(temporaryPath, manifestPath);
  } catch (error) {
    await fsApi.rm(temporaryPath, { force: true }).catch(() => {});
    throw error;
  }
}
