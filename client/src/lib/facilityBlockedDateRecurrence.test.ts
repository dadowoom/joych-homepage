import { describe, expect, it } from "vitest";
import {
  buildFacilityBlockedDateKeys,
  getKoreaTodayDateKey,
} from "./facilityBlockedDateRecurrence";

describe("facility blocked-date recurrence", () => {
  it("creates one date for a one-day block", () => {
    expect(buildFacilityBlockedDateKeys({
      startDate: "2026-07-15",
      endDate: "2026-08-15",
      repeatMode: "once",
    })).toEqual(["2026-07-15"]);
  });

  it("includes both ends of a daily block", () => {
    expect(buildFacilityBlockedDateKeys({
      startDate: "2026-07-30",
      endDate: "2026-08-02",
      repeatMode: "daily",
    })).toEqual(["2026-07-30", "2026-07-31", "2026-08-01", "2026-08-02"]);
  });

  it("creates the same weekday through the weekly end date", () => {
    expect(buildFacilityBlockedDateKeys({
      startDate: "2026-07-15",
      endDate: "2026-08-12",
      repeatMode: "weekly",
    })).toEqual(["2026-07-15", "2026-07-22", "2026-07-29", "2026-08-05", "2026-08-12"]);
    expect(buildFacilityBlockedDateKeys({
      startDate: "2026-12-30",
      endDate: "2027-01-13",
      repeatMode: "weekly",
    })).toEqual(["2026-12-30", "2027-01-06", "2027-01-13"]);
  });

  it("creates the same ordinal weekday each month", () => {
    expect(buildFacilityBlockedDateKeys({
      startDate: "2026-07-15",
      endDate: "2026-10-31",
      repeatMode: "monthly-weekday",
    })).toEqual(["2026-07-15", "2026-08-19", "2026-09-16", "2026-10-21"]);
  });

  it("skips months that do not have the same fifth weekday", () => {
    expect(buildFacilityBlockedDateKeys({
      startDate: "2026-01-29",
      endDate: "2026-04-30",
      repeatMode: "monthly-weekday",
    })).toEqual(["2026-01-29", "2026-04-30"]);
  });

  it("rejects a missing or earlier end date and respects the occurrence cap", () => {
    expect(buildFacilityBlockedDateKeys({
      startDate: "2026-07-15",
      repeatMode: "weekly",
    })).toEqual([]);
    expect(buildFacilityBlockedDateKeys({
      startDate: "2026-07-15",
      endDate: "2026-07-14",
      repeatMode: "daily",
    })).toEqual([]);
    expect(buildFacilityBlockedDateKeys({
      startDate: "2026-07-15",
      endDate: "2026-12-31",
      repeatMode: "daily",
      maxOccurrences: 3,
    })).toHaveLength(3);
    expect(buildFacilityBlockedDateKeys({
      startDate: "2026-02-30",
      repeatMode: "once",
    })).toEqual([]);
  });

  it("calculates today using Korea Standard Time", () => {
    expect(getKoreaTodayDateKey(new Date("2026-07-14T16:00:00.000Z"))).toBe("2026-07-15");
  });
});
