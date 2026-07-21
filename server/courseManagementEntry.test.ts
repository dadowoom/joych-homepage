import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const dbMocks = vi.hoisted(() => ({
  getCourseRoomManagementPagesForMember: vi.fn(),
}));

vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    getCourseRoomManagementPagesForMember:
      dbMocks.getCourseRoomManagementPagesForMember,
  };
});

import { appRouter } from "./routers";

function createContext(memberId: number | null): TrpcContext {
  return {
    user: null,
    memberId,
    memberName: memberId ? "강좌 담당자" : null,
    req: { cookies: {}, headers: {}, protocol: "https" } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("course management entry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMocks.getCourseRoomManagementPagesForMember.mockResolvedValue([
      "/education/academy",
    ]);
  });

  it("returns the pages assigned to the signed-in member", async () => {
    const caller = appRouter.createCaller(createContext(27));

    await expect(caller.courseManagement.myManagementPages())
      .resolves.toEqual(["/education/academy"]);
    expect(dbMocks.getCourseRoomManagementPagesForMember).toHaveBeenCalledWith(27);
  });

  it("returns no management pages for a signed-out visitor", async () => {
    const caller = appRouter.createCaller(createContext(null));

    await expect(caller.courseManagement.myManagementPages()).resolves.toEqual([]);
    expect(dbMocks.getCourseRoomManagementPagesForMember).not.toHaveBeenCalled();
  });
});
