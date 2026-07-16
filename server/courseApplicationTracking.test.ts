import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const dbMocks = vi.hoisted(() => ({
  getCourseApplicationById: vi.fn(),
  getCourseById: vi.fn(),
  hasCourseRoomManagementAccess: vi.fn(),
  replaceCourseApplicationChecklistItems: vi.fn(),
  updateCourseApplicationChecklist: vi.fn(),
}));

vi.mock("./db", async importOriginal => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    getCourseApplicationById: dbMocks.getCourseApplicationById,
    getCourseById: dbMocks.getCourseById,
    hasCourseRoomManagementAccess: dbMocks.hasCourseRoomManagementAccess,
    replaceCourseApplicationChecklistItems: dbMocks.replaceCourseApplicationChecklistItems,
    updateCourseApplicationChecklist: dbMocks.updateCourseApplicationChecklist,
  };
});

import { appRouter } from "./routers";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createContext(
  role: "admin" | "user" | null,
  memberId: number | null = null
): TrpcContext {
  const user: AuthenticatedUser | null = role
    ? {
        id: 1,
        openId: "course-check-user",
        email: "course-check@example.com",
        name: "Course Check User",
        loginMethod: "manus",
        role,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      }
    : null;

  return {
    user,
    memberId,
    memberName: memberId ? "강좌 담당자" : null,
    req: { cookies: {}, headers: {}, protocol: "https" } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("course application payment and document checks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMocks.replaceCourseApplicationChecklistItems.mockResolvedValue(true);
    dbMocks.updateCourseApplicationChecklist.mockResolvedValue(true);
    dbMocks.getCourseApplicationById.mockResolvedValue({ id: 21, courseId: 5 });
    dbMocks.getCourseById.mockResolvedValue({
      id: 5,
      pageHref: "/education/flute",
    });
    dbMocks.hasCourseRoomManagementAccess.mockResolvedValue(true);
  });

  it.each([
    ["feePaid", true],
    ["feePaid", false],
    ["documentsSubmitted", true],
    ["documentsSubmitted", false],
  ] as const)(
    "lets a course administrator set %s to %s",
    async (field, checked) => {
      const caller = appRouter.createCaller(createContext("admin"));

      await expect(
        caller.cms.courses.updateApplicationChecklist({
          id: 21,
          field,
          checked,
        })
      ).resolves.toEqual({ success: true });
      expect(dbMocks.updateCourseApplicationChecklist).toHaveBeenCalledWith(
        21,
        field,
        checked
      );
    }
  );

  it("rejects a user without the course management permission", async () => {
    const caller = appRouter.createCaller(createContext("user"));

    await expect(
      caller.cms.courses.updateApplicationChecklist({
        id: 21,
        field: "feePaid",
        checked: true,
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(dbMocks.updateCourseApplicationChecklist).not.toHaveBeenCalled();
  });

  it("lets a room manager update an application in the assigned course room", async () => {
    const caller = appRouter.createCaller(createContext(null, 41));

    await expect(
      caller.courseManagement.updateApplicationChecklist({
        id: 21,
        field: "documentsSubmitted",
        checked: true,
      })
    ).resolves.toEqual({ success: true });
    expect(dbMocks.hasCourseRoomManagementAccess).toHaveBeenCalledWith(
      41,
      "/education/flute"
    );
    expect(dbMocks.updateCourseApplicationChecklist).toHaveBeenCalledWith(
      21,
      "documentsSubmitted",
      true
    );
  });

  it("blocks a room manager from updating another course room", async () => {
    dbMocks.hasCourseRoomManagementAccess.mockResolvedValue(false);
    const caller = appRouter.createCaller(createContext(null, 41));

    await expect(
      caller.courseManagement.updateApplicationChecklist({
        id: 21,
        field: "feePaid",
        checked: true,
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(dbMocks.updateCourseApplicationChecklist).not.toHaveBeenCalled();
  });

  it("returns not found when an application no longer exists", async () => {
    dbMocks.updateCourseApplicationChecklist.mockResolvedValue(false);
    const caller = appRouter.createCaller(createContext("admin"));

    await expect(
      caller.cms.courses.updateApplicationChecklist({
        id: 999,
        field: "feePaid",
        checked: true,
      })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("lets an administrator toggle a configured custom checklist item", async () => {
    const caller = appRouter.createCaller(createContext("admin"));

    await expect(caller.cms.courses.updateApplicationChecklist({
      id: 21,
      field: "check_orientationComplete",
      checked: true,
    })).resolves.toEqual({ success: true });
    expect(dbMocks.updateCourseApplicationChecklist).toHaveBeenCalledWith(
      21,
      "check_orientationComplete",
      true,
    );
  });

  it.each(["constructor", "__proto__", "otherKey", "check_"])(
    "rejects an unsafe checklist key: %s",
    async (field) => {
      const caller = appRouter.createCaller(createContext("admin"));

      await expect(caller.cms.courses.updateApplicationChecklist({
        id: 21,
        field,
        checked: true,
      })).rejects.toMatchObject({ code: "BAD_REQUEST" });
      expect(dbMocks.updateCourseApplicationChecklist).not.toHaveBeenCalled();
    },
  );

  it("lets an administrator replace the checklist definition", async () => {
    const caller = appRouter.createCaller(createContext("admin"));
    const items = [
      { id: "feePaid", label: "회비 납부" },
      { id: "check_orientationComplete", label: "오리엔테이션 참석" },
    ];

    await expect(caller.cms.courses.updateApplicationChecklistItems({
      courseId: 5,
      items,
    })).resolves.toEqual({ success: true });
    expect(dbMocks.replaceCourseApplicationChecklistItems).toHaveBeenCalledWith(5, items);
  });

  it("does not let a delegated room manager edit checklist definitions", async () => {
    const caller = appRouter.createCaller(createContext(null, 41));

    await expect(caller.cms.courses.updateApplicationChecklistItems({
      courseId: 5,
      items: [{ id: "feePaid", label: "회비 납부" }],
    })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(dbMocks.replaceCourseApplicationChecklistItems).not.toHaveBeenCalled();
  });

  it("rejects duplicate checklist labels before writing", async () => {
    const caller = appRouter.createCaller(createContext("admin"));

    await expect(caller.cms.courses.updateApplicationChecklistItems({
      courseId: 5,
      items: [
        { id: "feePaid", label: "회비 납부" },
        { id: "check_feeCopy", label: "회비 납부" },
      ],
    })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(dbMocks.replaceCourseApplicationChecklistItems).not.toHaveBeenCalled();
  });
});
