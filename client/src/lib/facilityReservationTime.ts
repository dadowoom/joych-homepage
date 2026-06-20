const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

export const RESERVATION_LEAD_TIME_MS = 24 * 60 * 60 * 1000;

export function getKstDateKey(date = new Date()) {
  return new Date(date.getTime() + KST_OFFSET_MS).toISOString().slice(0, 10);
}

export function getReservationLeadDateKey(date = new Date()) {
  return getKstDateKey(new Date(date.getTime() + RESERVATION_LEAD_TIME_MS));
}

export function getKstDateTime(dateKey: string, time: string) {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(time);
  if (!dateMatch || !timeMatch) return null;

  const [, yearText, monthText, dayText] = dateMatch;
  const [, hourText, minuteText] = timeMatch;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const date = new Date(Date.UTC(year, month - 1, day, hour - 9, minute));
  return Number.isNaN(date.getTime()) ? null : date;
}

export function getReservationTimeRestriction(
  dateKey: string,
  startTime: string,
  options: { enforceLeadTime?: boolean } = {},
) {
  const { enforceLeadTime = true } = options;
  const startAt = getKstDateTime(dateKey, startTime);
  if (!startAt) return "예약 날짜와 시간이 올바르지 않습니다.";

  const diff = startAt.getTime() - Date.now();
  if (diff <= 0) return "이미 지난 시간입니다.";
  if (enforceLeadTime && diff < RESERVATION_LEAD_TIME_MS) {
    return "시설 예약은 현재 시각 기준 최소 24시간 이후부터 신청할 수 있습니다.";
  }
  return null;
}

export function hasReservableStartTime(
  dateKey: string,
  startTimes: string[],
  options: { enforceLeadTime?: boolean } = {},
) {
  return startTimes.some((startTime) => !getReservationTimeRestriction(dateKey, startTime, options));
}
