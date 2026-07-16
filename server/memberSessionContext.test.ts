import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";

const dbMocks = vi.hoisted(() => ({
  getAdminPermissionKeysForUser: vi.fn(),
  getMemberById: vi.fn(),
  getUserByOpenId: vi.fn(),
}));

const joseMocks = vi.hoisted(() => ({
  jwtVerify: vi.fn(),
}));

const sdkMocks = vi.hoisted(() => ({
  authenticateRequest: vi.fn(),
  signSession: vi.fn(),
}));

vi.mock("jose", () => ({
  jwtVerify: joseMocks.jwtVerify,
}));

vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    getAdminPermissionKeysForUser: dbMocks.getAdminPermissionKeysForUser,
    getMemberById: dbMocks.getMemberById,
    getUserByOpenId: dbMocks.getUserByOpenId,
  };
});

vi.mock("./_core/sdk", () => ({
  sdk: {
    authenticateRequest: sdkMocks.authenticateRequest,
    signSession: sdkMocks.signSession,
  },
}));

import { createContext } from "./_core/context";

const MEMBER_ID = 81;

function createOptions(): CreateExpressContextOptions {
  return {
    req: {
      protocol: "https",
      headers: {},
      cookies: { church_member_session: "member-session-context-token" },
    } as CreateExpressContextOptions["req"],
    res: {
      cookie: vi.fn(),
    } as unknown as CreateExpressContextOptions["res"],
    info: {} as CreateExpressContextOptions["info"],
  };
}

describe("member session context invalidation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMocks.getAdminPermissionKeysForUser.mockResolvedValue([]);
    dbMocks.getUserByOpenId.mockResolvedValue(null);
    sdkMocks.authenticateRequest.mockResolvedValue(null);
    dbMocks.getMemberById.mockResolvedValue({
      id: MEMBER_ID,
      email: "member@example.com",
      name: "세션성도",
      status: "approved",
      sessionVersion: 0,
    });
  });

  it("버전이 0인 기존 회원은 claim 없는 레거시 토큰으로 인증된다", async () => {
    joseMocks.jwtVerify.mockResolvedValue({
      payload: { type: "church_member", memberId: MEMBER_ID, name: "세션성도" },
    });

    const context = await createContext(createOptions());

    expect(context.memberId).toBe(MEMBER_ID);
    expect(context.memberName).toBe("세션성도");
  });

  it("DB보다 낮은 버전의 기존 토큰은 컨텍스트 인증에서 제거된다", async () => {
    dbMocks.getMemberById.mockResolvedValue({
      id: MEMBER_ID,
      email: "member@example.com",
      name: "세션성도",
      status: "approved",
      sessionVersion: 1,
    });
    joseMocks.jwtVerify.mockResolvedValue({
      payload: {
        type: "church_member",
        memberId: MEMBER_ID,
        name: "세션성도",
        sessionVersion: 0,
      },
    });

    const context = await createContext(createOptions());

    expect(context.memberId).toBeNull();
    expect(context.memberName).toBeNull();
  });

  it("DB와 동일한 버전의 새 토큰은 컨텍스트 인증을 통과한다", async () => {
    dbMocks.getMemberById.mockResolvedValue({
      id: MEMBER_ID,
      email: "member@example.com",
      name: "세션성도",
      status: "approved",
      sessionVersion: 1,
    });
    joseMocks.jwtVerify.mockResolvedValue({
      payload: {
        type: "church_member",
        memberId: MEMBER_ID,
        name: "세션성도",
        sessionVersion: 1,
      },
    });

    const context = await createContext(createOptions());

    expect(context.memberId).toBe(MEMBER_ID);
    expect(context.memberName).toBe("세션성도");
  });
});
