import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";
import { addDaysToDateKey } from "../shared/facilityReservationPolicy";

const dbMocks = vi.hoisted(() => ({
  createCourse: vi.fn(),
  getFacilityById: vi.fn(),
  hasCourseRoomManagementAccess: vi.fn(),
}));

vi.mock("./db", async importOriginal => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    createCourse: dbMocks.createCourse,
    getFacilityById: dbMocks.getFacilityById,
    hasCourseRoomManagementAccess: dbMocks.hasCourseRoomManagementAccess,
  };
});

import { appRouter } from "./routers";
import { ReservationOverlapError } from "./db";

function createContext(): TrpcContext {
  return {
    user: null,
    memberId: 41,
    memberName: "강좌 담당자",
    req: { cookies: {}, headers: {}, protocol: "https" } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

function getKstDateKey(date = new Date()) {
  return new Date(date.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function makeCourseInput() {
  const startDate = addDaysToDateKey(getKstDateKey(), 2)!;
  return {
    pageHref: "/education/flute",
    course: {
      title: "플루트 강좌",
      facilityId: 7,
      startDate,
      startTime: "00:00",
      endTime: "23:59",
    },
  };
}

function makeCustomCourseInput() {
  const startDate = addDaysToDateKey(getKstDateKey(), 2)!;
  const secondDate = addDaysToDateKey(getKstDateKey(), 4)!;
  return {
    pageHref: "/education/flute",
    course: {
      title: "불규칙 플루트 강좌",
      facilityId: 7,
      facilityRepeatMode: "custom" as const,
      facilityCustomDates: [startDate, secondDate],
      startDate,
      endDate: secondDate,
      startTime: "09:00",
      endTime: "11:00",
    },
  };
}

describe("course manager linked facility reservation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMocks.hasCourseRoomManagementAccess.mockResolvedValue(true);
    dbMocks.getFacilityById.mockResolvedValue({ id: 7, isVisible: true, isReservable: true });
    dbMocks.createCourse.mockResolvedValue(91);
  });

  it("passes the selected facility into course creation instead of dropping it", async () => {
    const caller = appRouter.createCaller(createContext());

    await expect(caller.courseManagement.create(makeCourseInput())).resolves.toBe(91);
    expect(dbMocks.createCourse).toHaveBeenCalledWith(expect.objectContaining({
      facilityId: 7,
      facilityReservationId: null,
      pageHref: "/education/flute",
    }));
  });

  it("returns a clear conflict when another reservation overlaps", async () => {
    dbMocks.createCourse.mockRejectedValue(new ReservationOverlapError("10:00", "12:00"));
    const caller = appRouter.createCaller(createContext());

    await expect(caller.courseManagement.create(makeCourseInput())).rejects.toMatchObject({
      code: "CONFLICT",
    });
  });

  it("rejects hidden or disabled facilities even when called directly", async () => {
    dbMocks.getFacilityById.mockResolvedValue({ id: 7, isVisible: false, isReservable: true });
    const caller = appRouter.createCaller(createContext());

    await expect(caller.courseManagement.create(makeCourseInput())).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(dbMocks.createCourse).not.toHaveBeenCalled();
  });

  it("allows arbitrary dates for the assigned course room manager", async () => {
    const caller = appRouter.createCaller(createContext());
    const input = makeCustomCourseInput();

    await expect(caller.courseManagement.create(input)).resolves.toBe(91);
    expect(dbMocks.createCourse).toHaveBeenCalledWith(expect.objectContaining({
      facilityRepeatMode: "custom",
      facilityCustomDates: JSON.stringify(input.course.facilityCustomDates),
    }));
  });

  it("hides access and blocks arbitrary dates immediately after permission removal", async () => {
    dbMocks.hasCourseRoomManagementAccess.mockResolvedValue(false);
    const caller = appRouter.createCaller(createContext());

    await expect(caller.courseManagement.access({ pageHref: "/education/flute" })).resolves.toEqual({
      canManage: false,
      canUseCustomDates: false,
      scope: null,
    });
    await expect(caller.courseManagement.create(makeCustomCourseInput())).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(dbMocks.createCourse).not.toHaveBeenCalled();
  });
});
