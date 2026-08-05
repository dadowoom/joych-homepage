import type { Pool, PoolConnection } from "mysql2/promise";
import { beforeEach, describe, expect, it, vi } from "vitest";

const drizzleMocks = vi.hoisted(() => ({
  transaction: vi.fn(),
}));

vi.mock("drizzle-orm/mysql2", () => ({
  drizzle: vi.fn(() => ({
    transaction: drizzleMocks.transaction,
  })),
}));

import { withNamedLocksTransaction } from "./namedLockTransaction";

function createFakePool(input?: {
  unavailableLock?: string;
  failRelease?: boolean;
  unconfirmedRelease?: boolean;
}) {
  const events: string[] = [];
  const release = vi.fn(() => events.push("connection:release"));
  const destroy = vi.fn(() => events.push("connection:destroy"));
  const execute = vi.fn(async (query: string, params: unknown[]) => {
    const lockKey = String(params[0]);
    if (query.includes("GET_LOCK")) {
      events.push(`lock:${lockKey}`);
      return [[{ locked: input?.unavailableLock === lockKey ? 0 : 1 }]];
    }
    events.push(`unlock:${lockKey}`);
    if (input?.failRelease) throw new Error("release failed");
    return [[{ released: input?.unconfirmedRelease ? 0 : 1 }]];
  });
  const connection = { execute, release, destroy } as unknown as PoolConnection;
  const pool = {
    getConnection: vi.fn(async () => connection),
  } as unknown as Pool;

  return { pool, events, release, destroy };
}

describe("withNamedLocksTransaction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps sorted unique locks until the transaction commit has completed", async () => {
    const { pool, events, release, destroy } = createFakePool();
    drizzleMocks.transaction.mockImplementation(async operation => {
      events.push("transaction:begin");
      const result = await operation({ kind: "transaction" });
      events.push("transaction:commit");
      return result;
    });

    await expect(
      withNamedLocksTransaction(
        pool,
        ["schedule:b", "schedule:a", "schedule:a"],
        () => new Error("busy"),
        async () => {
          events.push("operation");
          return 17;
        }
      )
    ).resolves.toBe(17);

    expect(events).toEqual([
      "lock:schedule:a",
      "lock:schedule:b",
      "transaction:begin",
      "operation",
      "transaction:commit",
      "unlock:schedule:b",
      "unlock:schedule:a",
      "connection:release",
    ]);
    expect(release).toHaveBeenCalledTimes(1);
    expect(destroy).not.toHaveBeenCalled();
  });

  it("rolls back before releasing locks when the operation fails", async () => {
    const { pool, events, release } = createFakePool();
    const failure = new Error("insert failed");
    drizzleMocks.transaction.mockImplementation(async operation => {
      events.push("transaction:begin");
      try {
        return await operation({ kind: "transaction" });
      } catch (error) {
        events.push("transaction:rollback");
        throw error;
      }
    });

    await expect(
      withNamedLocksTransaction(
        pool,
        ["schedule:a"],
        () => new Error("busy"),
        async () => {
          events.push("operation");
          throw failure;
        }
      )
    ).rejects.toBe(failure);

    expect(events).toEqual([
      "lock:schedule:a",
      "transaction:begin",
      "operation",
      "transaction:rollback",
      "unlock:schedule:a",
      "connection:release",
    ]);
    expect(release).toHaveBeenCalledTimes(1);
  });

  it("releases earlier locks when a later lock cannot be acquired", async () => {
    const { pool, events, release } = createFakePool({
      unavailableLock: "schedule:b",
    });
    const busyError = new Error("busy");

    await expect(
      withNamedLocksTransaction(
        pool,
        ["schedule:a", "schedule:b"],
        () => busyError,
        async () => 1
      )
    ).rejects.toBe(busyError);

    expect(events).toEqual([
      "lock:schedule:a",
      "lock:schedule:b",
      "unlock:schedule:a",
      "connection:release",
    ]);
    expect(drizzleMocks.transaction).not.toHaveBeenCalled();
    expect(release).toHaveBeenCalledTimes(1);
  });

  it("destroys a connection when lock release has an uncertain result", async () => {
    const { pool, release, destroy } = createFakePool({ failRelease: true });
    drizzleMocks.transaction.mockImplementation(async operation =>
      operation({ kind: "transaction" })
    );

    await expect(
      withNamedLocksTransaction(
        pool,
        ["schedule:a"],
        () => new Error("busy"),
        async () => "saved"
      )
    ).resolves.toBe("saved");

    expect(release).not.toHaveBeenCalled();
    expect(destroy).toHaveBeenCalledTimes(1);
  });

  it("destroys a connection when MySQL does not confirm the lock release", async () => {
    const { pool, release, destroy } = createFakePool({
      unconfirmedRelease: true,
    });
    drizzleMocks.transaction.mockImplementation(async operation =>
      operation({ kind: "transaction" })
    );

    await expect(
      withNamedLocksTransaction(
        pool,
        ["schedule:a"],
        () => new Error("busy"),
        async () => "saved"
      )
    ).resolves.toBe("saved");

    expect(release).not.toHaveBeenCalled();
    expect(destroy).toHaveBeenCalledTimes(1);
  });
});
