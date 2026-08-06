import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const dbMocks = vi.hoisted(() => ({
  createCourseRoomManager: vi.fn(),
  deleteCourseRoomManager: vi.fn(),
  getAllMenus: vi.fn(),
  getMemberById: vi.fn(),
  updateCourseRoomManager: vi.fn(),
}));

vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    createCourseRoomManager: dbMocks.createCourseRoomManager,
    deleteCourseRoomManager: dbMocks.deleteCourseRoomManager,
    getAllMenus: dbMocks.getAllMenus,
    getMemberById: dbMocks.getMemberById,
    updateCourseRoomManager: dbMocks.updateCourseRoomManager,
  };
});

import { appRouter } from "./routers";

function createContext(role: "admin" | "user", contentPermissions: string[] = []): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "course-permission-admin",
      email: "admin@example.com",
      name: "강좌 관리자",
      loginMethod: "manual",
      role,
      contentPermissions,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    memberId: null,
    memberName: null,
    req: { cookies: {}, headers: {}, protocol: "https" } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("course room manager permission removal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMocks.deleteCourseRoomManager.mockResolvedValue(undefined);
    dbMocks.createCourseRoomManager.mockResolvedValue(73);
    dbMocks.getAllMenus.mockResolvedValue([
      {
        id: 60,
        label: "교육·신청",
        items: [
          { id: 1, label: "조이아카데미", href: "/education/courses", isVisible: true, subItems: [] },
          { id: 2, label: "제자반", href: "/page/강좌-제자반", isVisible: true, subItems: [] },
          { id: 3, label: "리더십반", href: "/page/강좌-리더십반", isVisible: true, subItems: [] },
          { id: 4, label: "생선컨퍼런스", href: "/page/강좌-생선컨퍼런스", isVisible: true, subItems: [] },
        ],
      },
    ]);
    dbMocks.getMemberById.mockResolvedValue({ id: 24, status: "approved" });
    dbMocks.updateCourseRoomManager.mockResolvedValue(undefined);
  });

  it("deletes the permission record when an administrator revokes access", async () => {
    const caller = appRouter.createCaller(createContext("admin"));

    await expect(caller.cms.courses.updateRoomManager({
      id: 41,
      canManage: false,
    })).resolves.toBeUndefined();

    expect(dbMocks.deleteCourseRoomManager).toHaveBeenCalledWith(41);
    expect(dbMocks.updateCourseRoomManager).not.toHaveBeenCalled();
  });

  it("keeps the legacy enable request compatible without deleting the record", async () => {
    const caller = appRouter.createCaller(createContext("admin"));

    await caller.cms.courses.updateRoomManager({ id: 41, canManage: true });

    expect(dbMocks.updateCourseRoomManager).toHaveBeenCalledWith(41, { canManage: true });
    expect(dbMocks.deleteCourseRoomManager).not.toHaveBeenCalled();
  });

  it("blocks users without course management permission", async () => {
    const caller = appRouter.createCaller(createContext("user"));

    await expect(caller.cms.courses.updateRoomManager({
      id: 41,
      canManage: false,
    })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(dbMocks.deleteCourseRoomManager).not.toHaveBeenCalled();
  });

  it("lets a delegated course administrator load every course room", async () => {
    const caller = appRouter.createCaller(createContext("user", ["content:courses"]));

    await expect(caller.cms.courses.roomOptions()).resolves.toEqual([
      { label: "조이아카데미", href: "/page/교육-신청-조이아카데미" },
      { label: "제자반", href: "/page/교육신청-제자반" },
      { label: "리더십반", href: "/page/교육신청-리더십반" },
      { label: "생선컨퍼런스", href: "/page/교육신청-생선컨퍼런스" },
    ]);
  });

  it("stores a delegated manager grant under the current Korean room address", async () => {
    const caller = appRouter.createCaller(createContext("user", ["content:courses"]));

    await expect(caller.cms.courses.createRoomManager({
      memberId: 24,
      pageHref: "/page/강좌-제자반",
    })).resolves.toBe(73);

    expect(dbMocks.createCourseRoomManager).toHaveBeenCalledWith({
      memberId: 24,
      pageHref: "/page/교육신청-제자반",
      canManage: true,
      createdBy: 1,
    });
  });

  it("rejects a manager grant when the selected church member is not approved", async () => {
    dbMocks.getMemberById.mockResolvedValue({ id: 24, status: "pending" });
    const caller = appRouter.createCaller(createContext("user", ["content:courses"]));

    await expect(caller.cms.courses.createRoomManager({
      memberId: 24,
      pageHref: "/page/교육신청-제자반",
    })).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "승인된 성도만 강좌방 담당자로 지정할 수 있습니다.",
    });
    expect(dbMocks.createCourseRoomManager).not.toHaveBeenCalled();
  });

  it("falls back to the four standard course rooms when menu data is unavailable", async () => {
    dbMocks.getAllMenus.mockResolvedValue([]);
    const caller = appRouter.createCaller(createContext("user", ["content:courses"]));

    await expect(caller.cms.courses.roomOptions()).resolves.toEqual([
      { label: "조이아카데미", href: "/page/교육-신청-조이아카데미" },
      { label: "제자반", href: "/page/교육신청-제자반" },
      { label: "리더십반", href: "/page/교육신청-리더십반" },
      { label: "생선컨퍼런스", href: "/page/교육신청-생선컨퍼런스" },
    ]);
  });

  it("blocks manager creation and room discovery without course permission", async () => {
    const caller = appRouter.createCaller(createContext("user"));

    await expect(caller.cms.courses.roomOptions()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.cms.courses.createRoomManager({
      memberId: 24,
      pageHref: "/page/교육신청-제자반",
    })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(dbMocks.getMemberById).not.toHaveBeenCalled();
    expect(dbMocks.createCourseRoomManager).not.toHaveBeenCalled();
  });
});
