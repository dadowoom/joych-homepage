export const FACILITY_RESERVATION_MAX_MONTHS_SETTING_KEY = "facility_reservation_max_months";
export const DEFAULT_FACILITY_RESERVATION_MAX_MONTHS = 3;
export const MIN_FACILITY_RESERVATION_MAX_MONTHS = 1;
export const MAX_FACILITY_RESERVATION_MAX_MONTHS = 12;
export const EXTERNAL_RESERVATION_ADVANCE_DAYS_DEFAULT_SETTING_KEY =
  "external_reservation_advance_days_default";
export const DEFAULT_EXTERNAL_RESERVATION_ADVANCE_DAYS = 14;
export const MIN_EXTERNAL_RESERVATION_ADVANCE_DAYS = 1;
export const MAX_EXTERNAL_RESERVATION_ADVANCE_DAYS = 365;

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

export function normalizeExternalReservationAdvanceDays(value: unknown) {
  const numericValue = typeof value === "number" ? value : Number(String(value ?? "").trim());
  if (!Number.isFinite(numericValue)) return DEFAULT_EXTERNAL_RESERVATION_ADVANCE_DAYS;
  const integerValue = Math.trunc(numericValue);
  return Math.min(
    MAX_EXTERNAL_RESERVATION_ADVANCE_DAYS,
    Math.max(MIN_EXTERNAL_RESERVATION_ADVANCE_DAYS, integerValue),
  );
}

export function getExternalReservationAdvanceDaysDefault(
  settings: Record<string, string | null | undefined> | null | undefined,
) {
  return normalizeExternalReservationAdvanceDays(
    settings?.[EXTERNAL_RESERVATION_ADVANCE_DAYS_DEFAULT_SETTING_KEY],
  );
}

export function hasExternalReservationAdvanceDaysOverride(value: unknown) {
  return value !== null && value !== undefined && String(value).trim() !== "";
}

export function getExternalReservationAdvanceDays(
  settings: Record<string, string | null | undefined> | null | undefined,
  facility: { externalAdvanceDaysOverride?: unknown } | null | undefined,
) {
  return hasExternalReservationAdvanceDaysOverride(facility?.externalAdvanceDaysOverride)
    ? normalizeExternalReservationAdvanceDays(facility?.externalAdvanceDaysOverride)
    : getExternalReservationAdvanceDaysDefault(settings);
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

export function addDaysToDateKey(dateKey: string, days: number) {
  const date = parseDateKey(dateKey);
  if (!date) return null;

  const nextDate = new Date(date);
  nextDate.setUTCDate(nextDate.getUTCDate() + Math.max(0, Math.trunc(days)));
  return formatDateKey(nextDate);
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

export function getStricterReservationMaxDateKey(primaryMaxDateKey: string, secondaryMaxDateKey: string) {
  return primaryMaxDateKey <= secondaryMaxDateKey ? primaryMaxDateKey : secondaryMaxDateKey;
}

export function getEffectiveExternalReservationWindow(
  todayDateKey: string,
  settings: Record<string, string | null | undefined> | null | undefined,
  facility: { externalAdvanceDaysOverride?: unknown } | null | undefined,
) {
  const globalMaxMonths = getFacilityReservationMaxMonths(settings);
  const globalMaxDateKey = getReservationMaxDateKey(todayDateKey, globalMaxMonths);
  const advanceDays = getExternalReservationAdvanceDays(settings, facility);
  const externalMaxDateKey =
    addDaysToDateKey(todayDateKey, advanceDays) ?? todayDateKey;
  const usesFacilityOverride = hasExternalReservationAdvanceDaysOverride(
    facility?.externalAdvanceDaysOverride,
  );
  const effectiveSource: "external" | "global" =
    externalMaxDateKey < globalMaxDateKey ? "external" : "global";

  return {
    advanceDays,
    externalMaxDateKey,
    globalMaxMonths,
    globalMaxDateKey,
    usesFacilityOverride,
    effectiveSource,
    effectiveMaxDateKey:
      effectiveSource === "external"
        ? externalMaxDateKey
        : getStricterReservationMaxDateKey(globalMaxDateKey, externalMaxDateKey),
  };
}

export function getExternalReservationWindowMessage(window: {
  advanceDays: number;
  globalMaxMonths: number;
  globalMaxDateKey: string;
  effectiveMaxDateKey: string;
  usesFacilityOverride: boolean;
  effectiveSource: "external" | "global";
}) {
  if (window.effectiveSource === "global") {
    return `시설 예약은 최대 ${window.globalMaxMonths}개월 후(${window.globalMaxDateKey})까지만 가능합니다.`;
  }

  return window.usesFacilityOverride
    ? `이 시설은 외부인 예약을 오늘부터 ${window.advanceDays}일 이내(${window.effectiveMaxDateKey})까지만 가능합니다.`
    : `외부인 예약은 오늘부터 ${window.advanceDays}일 이내(${window.effectiveMaxDateKey})까지만 가능합니다.`;
}

export function isReservationDateAfterMax(dateKey: string, maxDateKey: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(dateKey) && dateKey > maxDateKey;
}
