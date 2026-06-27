export const FACILITY_RESERVATION_MAX_MONTHS_SETTING_KEY = "facility_reservation_max_months";
export const DEFAULT_FACILITY_RESERVATION_MAX_MONTHS = 3;
export const MIN_FACILITY_RESERVATION_MAX_MONTHS = 1;
export const MAX_FACILITY_RESERVATION_MAX_MONTHS = 12;

export function normalizeFacilityReservationMaxMonths(value: unknown) {
  const numericValue = typeof value === "number" ? value : Number(String(value ?? "").trim());
  if (!Number.isFinite(numericValue)) return DEFAULT_FACILITY_RESERVATION_MAX_MONTHS;
  const integerValue = Math.trunc(numericValue);
  return Math.min(
    MAX_FACILITY_RESERVATION_MAX_MONTHS,
    Math.max(MIN_FACILITY_RESERVATION_MAX_MONTHS, integerValue),
  );
}

export function getFacilityReservationMaxMonths(
  settings: Record<string, string | null | undefined> | null | undefined,
) {
  return normalizeFacilityReservationMaxMonths(settings?.[FACILITY_RESERVATION_MAX_MONTHS_SETTING_KEY]);
}

function parseDateKey(dateKey: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
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

export function addMonthsClampedToDateKey(dateKey: string, months: number) {
  const date = parseDateKey(dateKey);
  if (!date) return null;

  const targetYear = date.getUTCFullYear();
  const targetMonth = date.getUTCMonth() + months;
  const lastDayOfTargetMonth = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  const targetDay = Math.min(date.getUTCDate(), lastDayOfTargetMonth);
  return formatDateKey(new Date(Date.UTC(targetYear, targetMonth, targetDay)));
}

export function getReservationMaxDateKey(todayDateKey: string, maxMonths: number) {
  return addMonthsClampedToDateKey(
    todayDateKey,
    normalizeFacilityReservationMaxMonths(maxMonths),
  ) ?? todayDateKey;
}

export function isReservationDateAfterMax(dateKey: string, maxDateKey: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(dateKey) && dateKey > maxDateKey;
}
