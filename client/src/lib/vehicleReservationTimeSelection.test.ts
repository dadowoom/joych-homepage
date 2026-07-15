import { describe, expect, it } from "vitest";
import { shouldResetVehicleReservationTime } from "./vehicleReservationTimeSelection";

const validTimeline = {
  selectedStartTime: "10:00",
  endOptions: [
    { endTime: "11:00" },
    { endTime: "12:00" },
  ],
};

describe("vehicle reservation repeat time validation", () => {
  it("keeps the selected time when it remains available on the changed repeat schedule", () => {
    expect(shouldResetVehicleReservationTime({
      startTime: "10:00",
      endTime: "12:00",
      timeline: validTimeline,
      repeatScheduleReady: true,
      isFetching: false,
      hasError: false,
    })).toBe(false);
  });

  it("resets only after the current repeat schedule confirms the selected end time is unavailable", () => {
    expect(shouldResetVehicleReservationTime({
      startTime: "10:00",
      endTime: "12:00",
      timeline: {
        selectedStartTime: "10:00",
        endOptions: [{ endTime: "11:00" }],
      },
      repeatScheduleReady: true,
      isFetching: false,
      hasError: false,
    })).toBe(true);
  });

  it("does not clear while the repeat end date is incomplete or the new result is pending", () => {
    expect(shouldResetVehicleReservationTime({
      startTime: "10:00",
      endTime: "12:00",
      timeline: validTimeline,
      repeatScheduleReady: false,
      isFetching: false,
      hasError: false,
    })).toBe(false);

    expect(shouldResetVehicleReservationTime({
      startTime: "10:00",
      endTime: "12:00",
      timeline: validTimeline,
      repeatScheduleReady: true,
      isFetching: true,
      hasError: false,
    })).toBe(false);
  });

  it("does not clear from stale cached data or a failed validation request", () => {
    expect(shouldResetVehicleReservationTime({
      startTime: "10:00",
      endTime: "12:00",
      timeline: { ...validTimeline, selectedStartTime: "09:00" },
      repeatScheduleReady: true,
      isFetching: false,
      hasError: false,
    })).toBe(false);

    expect(shouldResetVehicleReservationTime({
      startTime: "10:00",
      endTime: "12:00",
      timeline: validTimeline,
      repeatScheduleReady: true,
      isFetching: false,
      hasError: true,
    })).toBe(false);
  });
});
