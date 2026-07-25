const KOREA_OFFSET_MS = 9 * 60 * 60 * 1000;
const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_KEY_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export type ReservationScheduleOccurrence = {
  reservationDate: string;
  startTime: string;
};

export function getKstScheduleNow(now = new Date()) {
  const koreaTime = new Date(now.getTime() + KOREA_OFFSET_MS).toISOString();
  return {
    dateKey: koreaTime.slice(0, 10),
    timeKey: koreaTime.slice(11, 16),
  };
}

/** A schedule that has not started yet can still be changed as a future occurrence. */
export function isUpcomingReservationOccurrence(
  occurrence: ReservationScheduleOccurrence,
  now = new Date(),
) {
  if (
    !DATE_KEY_RE.test(occurrence.reservationDate) ||
    !TIME_KEY_RE.test(occurrence.startTime)
  ) {
    return false;
  }

  const { dateKey, timeKey } = getKstScheduleNow(now);
  return (
    occurrence.reservationDate > dateKey ||
    (occurrence.reservationDate === dateKey && occurrence.startTime > timeKey)
  );
}
