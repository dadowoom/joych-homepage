/**
 * 한 성도가 Newjoych와 Joych 양쪽 PWA를 사용하더라도 서로 다른 endpoint는
 * 모두 보존해야 합니다. endpoint 자체가 같은 중복 행만 제거합니다.
 */
export function selectUniquePushSubscriptions<T extends { endpoint: string }>(
  subscriptions: T[],
): T[] {
  const seen = new Set<string>();
  return subscriptions.filter((subscription) => {
    if (seen.has(subscription.endpoint)) return false;
    seen.add(subscription.endpoint);
    return true;
  });
}

export async function settleWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  task: (item: T, index: number) => Promise<R>
): Promise<PromiseSettledResult<R>[]> {
  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new RangeError("concurrency must be a positive integer");
  }

  const results = new Array<PromiseSettledResult<R>>(items.length);
  let nextIndex = 0;
  const worker = async () => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      try {
        results[index] = {
          status: "fulfilled",
          value: await task(items[index], index),
        };
      } catch (reason) {
        results[index] = { status: "rejected", reason };
      }
    }
  };

  await Promise.all(
    Array.from(
      { length: Math.min(concurrency, items.length) },
      () => worker()
    )
  );
  return results;
}
