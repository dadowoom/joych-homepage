import { describe, expect, it, beforeEach, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const dbMocks = vi.hoisted(() => ({
  getVisibleCourseById: vi.fn(),
  createOrReopenCourseApplication: vi.fn(),
  getMemberById: vi.fn(),
}));

const pushMocks = vi.hoisted(() => ({
  notifyCourseApplicationToDistrictManager: vi.fn(),
}));

vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    getVisibleCourseById: dbMocks.getVisibleCourseById,
    createOrReopenCourseApplication: dbMocks.createOrReopenCourseApplication,
    getMemberById: dbMocks.getMemberById,
  };
});

vi.mock("./_core/pushNotifications", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./_core/pushNotifications")>();
  return {
    ...actual,
    notifyCourseApplicationToDistrictManager: pushMocks.notifyCourseApplicationToDistrictManager,
  };
});

import { appRouter } from "./routers";

function createContext(memberId: number | null = null): TrpcContext {
  return {
    user: null,
    memberId,
    memberName: null,
    req: { cookies: {}, headers: {}, protocol: "https" } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

const publicCourse = {
  id: 7,
  title: "Public Course",
  audience: "all",
  status: "open",
  applyStartDate: null,
  applyEndDate: null,
  applicationFields: null,
};

describe("course applications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMocks.getVisibleCourseById.mockResolvedValue(publicCourse);
    dbMocks.createOrReopenCourseApplication.mockResolvedValue(31);
  });

  it("allows guests to apply to public courses with contact consent", async () => {
    const caller = appRouter.createCaller(createContext());

    await expect(caller.home.applyCourse({
      courseId: 7,
      applicantName: "Guest Applicant",
      applicantPhone: "010-1234-5678",
      applicantEmail: "guest@example.com",
      privacyAgreed: true,
    })).resolves.toMatchObject({ id: 31, status: "pending", guest: true });

    expect(dbMocks.createOrReopenCourseApplication).toHaveBeenCalledWith(expect.objectContaining({
      courseId: 7,
      memberId: null,
      applicantName: "Guest Applicant",
      applicantPhone: "01012345678",
    }));
  });

  it("keeps member-only courses protected from guest applications", async () => {
    dbMocks.getVisibleCourseById.mockResolvedValue({ ...publicCourse, audience: "member" });
    const caller = appRouter.createCaller(createContext());

    await expect(caller.home.applyCourse({
      courseId: 7,
      applicantName: "Guest Applicant",
      applicantPhone: "01012345678",
      privacyAgreed: true,
    })).rejects.toMatchObject({ code: "UNAUTHORIZED" });

    expect(dbMocks.createOrReopenCourseApplication).not.toHaveBeenCalled();
  });

  it("requires contact information and privacy consent for guest applications", async () => {
    const caller = appRouter.createCaller(createContext());

    await expect(caller.home.applyCourse({
      courseId: 7,
      applicantName: "Guest Applicant",
      privacyAgreed: true,
    })).rejects.toMatchObject({ code: "BAD_REQUEST" });

    await expect(caller.home.applyCourse({
      courseId: 7,
      applicantName: "Guest Applicant",
      applicantPhone: "01012345678",
    })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
