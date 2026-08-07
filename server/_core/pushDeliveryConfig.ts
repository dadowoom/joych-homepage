const DEFAULT_CONCURRENCY = 100;
const DEFAULT_TIMEOUT_MS = 5_000;

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
 * Bound each endpoint and process enough deliveries in parallel for the current
 * audience without abandoning subscriptions at an arbitrary request deadline.
 */
export function getPushDeliveryConfig(env: Record<string, string | undefined> = process.env) {
  return {
    concurrency: boundedInteger(
      env.PUSH_DELIVERY_CONCURRENCY,
      DEFAULT_CONCURRENCY,
      "PUSH_DELIVERY_CONCURRENCY",
      1,
      100,
    ),
    timeoutMs: boundedInteger(
      env.PUSH_DELIVERY_TIMEOUT_MS,
      DEFAULT_TIMEOUT_MS,
      "PUSH_DELIVERY_TIMEOUT_MS",
      1_000,
      30_000,
    ),
  } as const;
}
