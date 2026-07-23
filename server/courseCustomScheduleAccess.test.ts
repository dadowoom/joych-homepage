import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const dbMocks = vi.hoisted(() => ({
  hasCourseRoomManagementAccess: vi.fn(),
}));

vi.mock("./db", async importOriginal => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    hasCourseRoomManagementAccess: dbMocks.hasCourseRoomManagementAccess,
  };
});

import {
  assertCourseCustomScheduleAccess,
  canUseCourseCustomSchedule,
} from "./courseCustomScheduleAccess";

function context(role: "admin" | "user" | null, memberId: number | null) {
  return {
    user: role ? { role } as NonNullable<TrpcContext["user"]> : null,
    memberId,
  };
}

const customCourse = {
  pageHref: "/education/flute",
  facilityId: 7,
  facilityRepeatMode: "custom",
  facilityCustomDates: ["2026-08-03", "2026-08-05"],
  startDate: "2026-08-03",
  endDate: "2026-08-05",
  startTime: "09:00",
  endTime: "11:00",
};

describe("course custom schedule access", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMocks.hasCourseRoomManagementAccess.mockResolvedValue(false);
  });

  it("allows the administrator account", async () => {
    await expect(canUseCourseCustomSchedule(context("admin", null), customCourse.pageHref))
      .resolves.toBe(true);
  });

  it("allows a member assigned to the course room", async () => {
    dbMocks.hasCourseRoomManagementAccess.mockResolvedValue(true);

    await expect(canUseCourseCustomSchedule(context(null, 41), customCourse.pageHref))
      .resolves.toBe(true);
    expect(dbMocks.hasCourseRoomManagementAccess).toHaveBeenCalledWith(41, customCourse.pageHref);
  });

  it("blocks a delegated course administrator without the room assignment", async () => {
    await expect(assertCourseCustomScheduleAccess(context("user", null), customCourse))
      .rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("preserves an unchanged existing custom schedule during an unrelated edit", async () => {
    await expect(assertCourseCustomScheduleAccess(
      context("user", null),
      { ...customCourse },
      { ...customCourse },
    )).resolves.toBeUndefined();
  });

  it("blocks changing an existing custom schedule after permission removal", async () => {
    await expect(assertCourseCustomScheduleAccess(
      context("user", 41),
      { ...customCourse, facilityCustomDates: ["2026-08-04"] },
      customCourse,
    )).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
