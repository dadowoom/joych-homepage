import { afterEach, describe, expect, it, vi } from "vitest";
import { courseBaseSchema } from "./routers/cms/courses";
import { courseCreateSchema } from "./routers/courseManagement";
import { buildCourseReservationData } from "./db/course";
import {
  getCourseFacilityReservationRestriction,
  getCourseManagerFacilityReservationMaxDateKey,
} from "../shared/courseFacilityReservationPolicy";

const pastCourse = {
  title: "Past course",
  startDate: "2000-01-01",
  endDate: "2000-01-01",
  applyStartDate: "2000-01-01",
  applyEndDate: "2000-01-01",
};

describe("course creation date guard", () => {
  afterEach(() => vi.useRealTimers());

  it("rejects past dates in the main administrator course API", () => {
    expect(courseBaseSchema.safeParse(pastCourse).success).toBe(false);
  });

  it("rejects past dates in the course room manager API", () => {
    expect(courseCreateSchema.safeParse(pastCourse).success).toBe(false);
  });

  it("allows a course manager facility reservation through the full 365-day window and 24-hour clock", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-21T03:00:00.000Z")); // KST 12:00

    const maxDate = getCourseManagerFacilityReservationMaxDateKey("2026-07-21");
    expect(maxDate).toBe("2027-07-21");
    expect(courseCreateSchema.safeParse({
      title: "시설 연결 강좌",
      facilityId: 7,
      startDate: maxDate,
      startTime: "00:00",
      endTime: "23:59",
    }).success).toBe(true);
  });

  it("rejects course manager facility reservations after 365 days or in an already-past time", () => {
    const now = new Date("2026-07-21T03:00:00.000Z"); // KST 12:00

    expect(getCourseFacilityReservationRestriction({
      facilityId: 7,
      startDate: "2027-07-22",
      startTime: "00:00",
      endTime: "01:00",
    }, now)).toContain("365일");
    expect(getCourseFacilityReservationRestriction({
      facilityId: 7,
      startDate: "2026-07-21",
      startTime: "11:59",
      endTime: "13:00",
    }, now)).toContain("지난 시간");
  });

  it("creates linked course facility reservations as approved reservations", () => {
    const reservation = buildCourseReservationData({
      id: 1,
      title: "새 강좌",
      capacity: 20,
      facilityId: 7,
      startDate: "2026-08-01",
      endDate: "2026-08-29",
      startTime: "09:00",
      endTime: "11:00",
    });

    expect(reservation).toMatchObject({
      facilityId: 7,
      reservationType: "course",
      reservationDate: "2026-08-01",
      startTime: "09:00",
      endTime: "11:00",
      status: "approved",
    });
  });
});
