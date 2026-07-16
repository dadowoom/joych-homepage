export const RESERVATION_REPEAT_OPTIONS = [
  { value: "none", label: "반복 없음" },
  { value: "daily", label: "매일" },
  { value: "weekly", label: "매주" },
  { value: "monthly-weekday", label: "매월 같은 주" },
] as const;

export type ReservationRepeatType = typeof RESERVATION_REPEAT_OPTIONS[number]["value"];

/**
 * 차량예약에서 과거에 사용하던 `monthly` URL/API 값도 시설예약의
 * 표준 값인 `monthly-weekday`로 안전하게 이어받습니다.
 */
export function normalizeReservationRepeatType(
  value: string | null | undefined,
): ReservationRepeatType {
  if (value === "monthly") return "monthly-weekday";
  if (value === "daily" || value === "weekly" || value === "monthly-weekday") return value;
  return "none";
}
