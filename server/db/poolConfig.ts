const DEFAULT_CONNECTION_LIMIT = 10;
const DEFAULT_QUEUE_LIMIT = 500;
const DEFAULT_CONNECT_TIMEOUT_MS = 10_000;

function boundedInteger(
  value: string | undefined,
  fallback: number,
  name: string,
  minimum: number,
  maximum: number,
) {
  if (value === undefined || value.trim() === "") return fallback;

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`${name} must be an integer between ${minimum} and ${maximum}.`);
  }
  return parsed;
}

/**
 * Keep the MySQL pool bounded so a traffic spike cannot grow an unlimited
 * in-process wait queue. Defaults preserve mysql2's existing connection count
 * while adding a practical queue ceiling and an explicit connect timeout.
 */
export function getDatabasePoolConfig(
  env: Record<string, string | undefined> = process.env,
) {
  return {
    waitForConnections: true,
    connectionLimit: boundedInteger(
      env.DB_POOL_CONNECTION_LIMIT,
      DEFAULT_CONNECTION_LIMIT,
      "DB_POOL_CONNECTION_LIMIT",
      1,
      100,
    ),
    queueLimit: boundedInteger(
      env.DB_POOL_QUEUE_LIMIT,
      DEFAULT_QUEUE_LIMIT,
      "DB_POOL_QUEUE_LIMIT",
      1,
      10_000,
    ),
    connectTimeout: boundedInteger(
      env.DB_CONNECT_TIMEOUT_MS,
      DEFAULT_CONNECT_TIMEOUT_MS,
      "DB_CONNECT_TIMEOUT_MS",
      1_000,
      60_000,
    ),
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
  } as const;
}
