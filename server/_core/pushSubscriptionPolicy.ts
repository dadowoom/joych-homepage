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
