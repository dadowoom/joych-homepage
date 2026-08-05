import { drizzle } from "drizzle-orm/mysql2";
import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";

type DrizzleDatabase = ReturnType<typeof drizzle>;
type DrizzleTransaction = Parameters<
  Parameters<DrizzleDatabase["transaction"]>[0]
>[0];

type LockResultRow = RowDataPacket & {
  locked: number | string | null;
};

type ReleaseLockResultRow = RowDataPacket & {
  released: number | string | null;
};

async function releaseNamedLocks(
  connection: PoolConnection,
  acquiredLocks: string[]
) {
  for (const lockKey of acquiredLocks.reverse()) {
    const [rows] = await connection.execute<ReleaseLockResultRow[]>(
      "SELECT RELEASE_LOCK(?) AS released",
      [lockKey]
    );
    if (Number(rows[0]?.released ?? 0) !== 1) {
      throw new Error(`Named lock release could not be confirmed: ${lockKey}`);
    }
  }
}

/**
 * Runs a transaction while holding MySQL named locks on one pool connection.
 *
 * Drizzle commits only after its transaction callback returns. Releasing a
 * named lock inside that callback therefore opens a small race before COMMIT.
 * This helper owns the physical connection and releases locks only after
 * Drizzle has completed COMMIT or ROLLBACK.
 */
export async function withNamedLocksTransaction<T>(
  pool: Pool,
  lockKeys: string[],
  createLockError: () => Error,
  operation: (tx: DrizzleTransaction) => Promise<T>
): Promise<T> {
  const connection = await pool.getConnection();
  const transactionDb = drizzle(connection);
  const normalizedLockKeys = Array.from(new Set(lockKeys)).sort();
  const acquiredLocks: string[] = [];
  let connectionMustBeDestroyed = false;

  try {
    for (const lockKey of normalizedLockKeys) {
      const [rows] = await connection.execute<LockResultRow[]>(
        "SELECT GET_LOCK(?, 5) AS locked",
        [lockKey]
      );
      if (Number(rows[0]?.locked ?? 0) !== 1) {
        throw createLockError();
      }
      acquiredLocks.push(lockKey);
    }

    // This promise resolves only after COMMIT, and rejects only after ROLLBACK.
    return await transactionDb.transaction(operation);
  } finally {
    try {
      await releaseNamedLocks(connection, acquiredLocks);
    } catch {
      // A connection with an uncertain named-lock state must never return to
      // the pool. Destroying it makes MySQL release all connection-owned locks.
      connectionMustBeDestroyed = true;
    }

    if (connectionMustBeDestroyed) {
      connection.destroy();
    } else {
      connection.release();
    }
  }
}
