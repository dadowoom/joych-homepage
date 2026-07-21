import { describe, expect, it } from "vitest";
import { buildCourseFacilityScheduleDates } from "./courseFacilitySchedule";

describe("buildCourseFacilityScheduleDates", () => {
  it("builds a weekly multi-weekday schedule", () => {
    expect(buildCourseFacilityScheduleDates({
      startDate: "2026-08-03",
      endDate: "2026-08-14",
      repeatMode: "weekly",
      repeatDays: [1, 3, 5],
    })).toEqual({
      dates: ["2026-08-03", "2026-08-05", "2026-08-07", "2026-08-10", "2026-08-12", "2026-08-14"],
      error: null,
    });
  });

  it("builds the same ordinal weekdays every month", () => {
    expect(buildCourseFacilityScheduleDates({
      startDate: "2026-08-10",
      endDate: "2026-10-31",
      repeatMode: "monthly-weekday",
      repeatDays: [1, 3, 5],
    }).dates).toEqual([
      "2026-08-10", "2026-08-12", "2026-08-14",
      "2026-09-09", "2026-09-11", "2026-09-14",
      "2026-10-09", "2026-10-12", "2026-10-14",
    ]);
  });

  it("keeps only valid custom dates inside the course period", () => {
    expect(buildCourseFacilityScheduleDates({
      startDate: "2026-08-01",
      endDate: "2026-08-31",
      repeatMode: "custom",
      customDates: ["2026-08-21", "2026-07-31", "2026-08-07", "2026-08-07"],
    })).toEqual({ dates: ["2026-08-07", "2026-08-21"], error: null });
  });
});
