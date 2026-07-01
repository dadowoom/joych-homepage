const DATE_KEY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"] as const;

export const KOREA_TIME_ZONE = "Asia/Seoul";

export function parseDateKey(dateKey: string) {
  const match = DATE_KEY_RE.exec(dateKey);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const utcDate = new Date(Date.UTC(year, month - 1, day));

  if (
    utcDate.getUTCFullYear() !== year ||
    utcDate.getUTCMonth() !== month - 1 ||
    utcDate.getUTCDate() !== day
  ) {
    return null;
  }

  return { year, month, day, dayOfWeek: utcDate.getUTCDay() };
}

export function getDateKeyDayOfWeek(dateKey: string) {
  return parseDateKey(dateKey)?.dayOfWeek ?? -1;
}

export function formatKoreanDateKey(dateKey: string) {
  const date = parseDateKey(dateKey);
  if (!date) return dateKey;
  return `${date.year}년 ${date.month}월 ${date.day}일 (${DAY_LABELS[date.dayOfWeek]})`;
}

export function formatKoreanNumericDateKey(dateKey: string) {
  const date = parseDateKey(dateKey);
  if (!date) return dateKey;
  return `${date.year}. ${String(date.month).padStart(2, "0")}. ${String(date.day).padStart(2, "0")}.`;
}

export function formatKoreanDateTime(value: Date | string | number | null | undefined) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: KOREA_TIME_ZONE,
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
