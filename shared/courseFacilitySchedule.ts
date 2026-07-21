export const COURSE_FACILITY_REPEAT_MODES = [
  "none",
  "weekly",
  "monthly-weekday",
  "custom",
] as const;

export type CourseFacilityRepeatMode = typeof COURSE_FACILITY_REPEAT_MODES[number];

export type CourseFacilityScheduleInput = {
  startDate?: string | null;
  endDate?: string | null;
  repeatMode?: CourseFacilityRepeatMode | null;
  repeatDays?: number[] | null;
  customDates?: string[] | null;
};

export type CourseFacilityScheduleResult = {
  dates: string[];
  error: string | null;
};

export const COURSE_FACILITY_SCHEDULE_MAX_DAYS = 366;
export const COURSE_FACILITY_SCHEDULE_MAX_OCCURRENCES = 366;
export const COURSE_WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"] as const;

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseDateKey(value: string | null | undefined) {
  if (!value || !DATE_KEY_RE.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) return null;
  return date;
}

function formatDateKey(date: Date) {
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

function addUtcDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function getDaySpan(start: Date, end: Date) {
  return Math.floor((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
}

function nthWeekdayDate(year: number, monthIndex: number, nth: number, weekday: number) {
  const first = new Date(Date.UTC(year, monthIndex, 1));
  const offset = (weekday - first.getUTCDay() + 7) % 7;
  const date = new Date(Date.UTC(year, monthIndex, 1 + offset + (nth - 1) * 7));
  return date.getUTCMonth() === monthIndex ? date : null;
}

export function normalizeCourseFacilityRepeatDays(days: number[] | null | undefined) {
  return Array.from(new Set((days ?? []).filter(day => Number.isInteger(day) && day >= 0 && day <= 6)))
    .sort((a, b) => a - b);
}

export function normalizeCourseFacilityCustomDates(dates: string[] | null | undefined) {
  return Array.from(new Set((dates ?? []).filter(date => Boolean(parseDateKey(date))))).sort();
}

export function parseCourseFacilityRepeatDays(value: unknown) {
  if (Array.isArray(value)) return normalizeCourseFacilityRepeatDays(value.map(Number));
  if (typeof value !== "string" || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? normalizeCourseFacilityRepeatDays(parsed.map(Number)) : [];
  } catch {
    return [];
  }
}

export function parseCourseFacilityCustomDates(value: unknown) {
  if (Array.isArray(value)) return normalizeCourseFacilityCustomDates(value.map(String));
  if (typeof value !== "string" || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? normalizeCourseFacilityCustomDates(parsed.map(String)) : [];
  } catch {
    return [];
  }
}

export function serializeCourseFacilityRepeatDays(days: number[] | null | undefined) {
  return JSON.stringify(normalizeCourseFacilityRepeatDays(days));
}

export function serializeCourseFacilityCustomDates(dates: string[] | null | undefined) {
  return JSON.stringify(normalizeCourseFacilityCustomDates(dates));
}

export function buildCourseFacilityScheduleDates(
  input: CourseFacilityScheduleInput,
): CourseFacilityScheduleResult {
  const mode = input.repeatMode ?? "none";
  const start = parseDateKey(input.startDate);
  if (!start) return { dates: [], error: "강좌 시작일을 선택해 주세요." };

  if (mode === "none") {
    return { dates: [formatDateKey(start)], error: null };
  }

  const end = parseDateKey(input.endDate);
  if (!end) return { dates: [], error: "반복 일정의 종료일을 선택해 주세요." };
  if (end < start) return { dates: [], error: "강좌 종료일은 시작일 이후여야 합니다." };
  if (getDaySpan(start, end) >= COURSE_FACILITY_SCHEDULE_MAX_DAYS) {
    return { dates: [], error: "강좌 시설예약 반복 기간은 최대 365일까지 설정할 수 있습니다." };
  }

  if (mode === "custom") {
    const dates = normalizeCourseFacilityCustomDates(input.customDates)
      .filter(date => date >= formatDateKey(start) && date <= formatDateKey(end));
    if (dates.length === 0) {
      return { dates: [], error: "직접 예약할 날짜를 한 개 이상 추가해 주세요." };
    }
    return { dates, error: null };
  }

  const days = normalizeCourseFacilityRepeatDays(input.repeatDays);
  if (days.length === 0) return { dates: [], error: "반복할 요일을 한 개 이상 선택해 주세요." };

  const dates: string[] = [];
  if (mode === "weekly") {
    for (let cursor = start; cursor <= end; cursor = addUtcDays(cursor, 1)) {
      if (days.includes(cursor.getUTCDay())) dates.push(formatDateKey(cursor));
    }
  } else {
    const nth = Math.floor((start.getUTCDate() - 1) / 7) + 1;
    for (
      let monthOffset = 0;
      monthOffset <= 12 && dates.length < COURSE_FACILITY_SCHEDULE_MAX_OCCURRENCES;
      monthOffset += 1
    ) {
      const month = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + monthOffset, 1));
      if (month > end) break;
      days.forEach(day => {
        const candidate = nthWeekdayDate(month.getUTCFullYear(), month.getUTCMonth(), nth, day);
        if (candidate && candidate >= start && candidate <= end) dates.push(formatDateKey(candidate));
      });
    }
  }

  const uniqueDates = Array.from(new Set(dates)).sort();
  if (uniqueDates.length === 0) {
    return { dates: [], error: "선택한 기간에 해당하는 반복 일정이 없습니다." };
  }
  if (uniqueDates.length > COURSE_FACILITY_SCHEDULE_MAX_OCCURRENCES) {
    return { dates: [], error: `시설예약은 한 번에 최대 ${COURSE_FACILITY_SCHEDULE_MAX_OCCURRENCES}회까지 만들 수 있습니다.` };
  }
  return { dates: uniqueDates, error: null };
}

export function describeCourseFacilitySchedule(input: CourseFacilityScheduleInput, count: number) {
  const mode = input.repeatMode ?? "none";
  if (mode === "none") return "반복 없음";
  if (mode === "custom") return `날짜 직접 선택 · 총 ${count}회`;
  const weekdays = normalizeCourseFacilityRepeatDays(input.repeatDays)
    .map(day => COURSE_WEEKDAY_LABELS[day])
    .join("·");
  return `${mode === "weekly" ? "매주" : "매월 같은 주"} ${weekdays} · 총 ${count}회`;
}
