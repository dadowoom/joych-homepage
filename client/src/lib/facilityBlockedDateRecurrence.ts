export type FacilityBlockedDateRepeatMode = "once" | "daily" | "weekly" | "monthly-weekday";

type BuildFacilityBlockedDateKeysOptions = {
  startDate: string;
  endDate?: string;
  repeatMode: FacilityBlockedDateRepeatMode;
  maxOccurrences?: number;
};

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseDateKey(dateKey: string) {
  if (!DATE_KEY_RE.test(dateKey)) return null;
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date;
}

function formatDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addUtcDays(date: Date, days: number) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + days));
}

function nthWeekdayDate(year: number, monthIndex: number, nth: number, weekday: number) {
  const firstDay = new Date(Date.UTC(year, monthIndex, 1));
  const offset = (weekday - firstDay.getUTCDay() + 7) % 7;
  const candidate = new Date(Date.UTC(year, monthIndex, 1 + offset + (nth - 1) * 7));
  return candidate.getUTCMonth() === monthIndex ? candidate : null;
}

/**
 * 시설 예약불가 반복 설정을 실제 차단 날짜 목록으로 펼칩니다.
 * 매달 같은 주는 시작일의 n번째 요일을 유지하며, 해당 n번째 요일이 없는 달은 건너뜁니다.
 */
export function buildFacilityBlockedDateKeys({
  startDate,
  endDate,
  repeatMode,
  maxOccurrences = Number.POSITIVE_INFINITY,
}: BuildFacilityBlockedDateKeysOptions) {
  const start = parseDateKey(startDate);
  if (!start || maxOccurrences < 1) return [];
  if (repeatMode === "once") return [startDate];

  const end = endDate ? parseDateKey(endDate) : null;
  if (!end || end < start) return [];

  const dates: string[] = [];
  const pushCandidate = (candidate: Date | null) => {
    if (!candidate || candidate > end || dates.length >= maxOccurrences) return false;
    dates.push(formatDateKey(candidate));
    return true;
  };

  if (repeatMode === "daily" || repeatMode === "weekly") {
    const intervalDays = repeatMode === "daily" ? 1 : 7;
    for (let step = 0; ; step += 1) {
      const candidate = addUtcDays(start, step * intervalDays);
      if (candidate > end || dates.length >= maxOccurrences) break;
      pushCandidate(candidate);
    }
    return dates;
  }

  const nth = Math.floor((start.getUTCDate() - 1) / 7) + 1;
  const weekday = start.getUTCDay();
  for (let monthOffset = 0; dates.length < maxOccurrences; monthOffset += 1) {
    const monthStart = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + monthOffset, 1));
    if (monthStart > end) break;
    pushCandidate(nthWeekdayDate(monthStart.getUTCFullYear(), monthStart.getUTCMonth(), nth, weekday));
  }
  return dates;
}

/** 한국 표준시 기준 오늘 날짜를 YYYY-MM-DD로 반환합니다. */
export function getKoreaTodayDateKey(now = new Date()) {
  return new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
