import { describe, expect, it } from "vitest";
import { buildCourseFacilityScheduleDates } from "./courseFacilitySchedule";

describe("buildCourseFacilityScheduleDates", () => {
  it("builds a daily schedule with the same behavior as facility reservations", () => {
    expect(buildCourseFacilityScheduleDates({
      startDate: "2026-08-03",
      endDate: "2026-08-06",
      repeatMode: "daily",
    })).toEqual({
      dates: ["2026-08-03", "2026-08-04", "2026-08-05", "2026-08-06"],
      error: null,
    });
  });

  it("builds a weekly schedule from the start date weekday", () => {
    expect(buildCourseFacilityScheduleDates({
      startDate: "2026-08-03",
      endDate: "2026-08-24",
      repeatMode: "weekly",
      // 과거 저장 데이터에 여러 요일이 남아 있어도 시설예약 표준처럼 시작 요일만 사용합니다.
      repeatDays: [1, 3, 5],
    })).toEqual({
      dates: ["2026-08-03", "2026-08-10", "2026-08-17", "2026-08-24"],
      error: null,
    });
  });

  it("builds the same ordinal weekday as the start date every month", () => {
    expect(buildCourseFacilityScheduleDates({
      startDate: "2026-08-10",
      endDate: "2026-10-31",
      repeatMode: "monthly-weekday",
      repeatDays: [1, 3, 5],
    }).dates).toEqual([
      "2026-08-10",
      "2026-09-14",
      "2026-10-12",
    ]);
  });

  it("keeps an irregular first-week and second-week custom schedule in date order", () => {
    expect(buildCourseFacilityScheduleDates({
      startDate: "2026-08-01",
      endDate: "2026-08-14",
      repeatMode: "custom",
      // 첫째 주 월·수·금, 둘째 주 화·목 + 중복/기간 밖 날짜
      customDates: [
        "2026-08-07",
        "2026-08-03",
        "2026-08-13",
        "2026-07-31",
        "2026-08-05",
        "2026-08-11",
        "2026-08-03",
      ],
    })).toEqual({
      dates: ["2026-08-03", "2026-08-05", "2026-08-07", "2026-08-11", "2026-08-13"],
      error: null,
    });
  });
});
