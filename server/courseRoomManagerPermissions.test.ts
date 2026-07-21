import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const dbMocks = vi.hoisted(() => ({
  deleteCourseRoomManager: vi.fn(),
  updateCourseRoomManager: vi.fn(),
}));

vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    deleteCourseRoomManager: dbMocks.deleteCourseRoomManager,
    updateCourseRoomManager: dbMocks.updateCourseRoomManager,
  };
});

import { appRouter } from "./routers";

function createContext(role: "admin" | "user"): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "course-permission-admin",
      email: "admin@example.com",
      name: "강좌 관리자",
      loginMethod: "manual",
      role,
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
});
