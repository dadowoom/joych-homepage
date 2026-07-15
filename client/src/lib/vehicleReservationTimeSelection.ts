export type VehicleAvailabilityTimelineSelection = {
  selectedStartTime: string | null;
  endOptions: ReadonlyArray<{ endTime: string }>;
};

export function shouldResetVehicleReservationTime({
  startTime,
  endTime,
  timeline,
  repeatScheduleReady,
  isFetching,
  hasError,
}: {
  startTime: string;
  endTime: string;
  timeline: VehicleAvailabilityTimelineSelection | null | undefined;
  repeatScheduleReady: boolean;
  isFetching: boolean;
  hasError: boolean;
}) {
  if (
    !startTime ||
    !endTime ||
    !timeline ||
    !repeatScheduleReady ||
    isFetching ||
    hasError
  ) {
    return false;
  }

  // A different selectedStartTime means this is cached data for an older query.
  // Only the authoritative response for the current start time may clear it.
  if (timeline.selectedStartTime !== startTime) return false;

  return !timeline.endOptions.some((option) => option.endTime === endTime);
}
