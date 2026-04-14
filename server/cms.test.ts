/**
 * CMS 라우터 테스트
 * - 관리자 권한 없이 CMS API 접근 시 FORBIDDEN 에러 발생 여부 확인
 * - 관리자 권한으로 접근 시 정상 동작 확인 (DB 없이 로직만 테스트)
 */

import { describe, expect, it } from "vitest";
import { TRPCError } from "@trpc/server";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createContext(role: "admin" | "user" | null): TrpcContext {
  const user: AuthenticatedUser | null = role
    ? {
        id: 1,
        openId: "test-user",
        email: "test@example.com",
        name: "Test User",
        loginMethod: "manus",
        role,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      }
    : null;

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

describe("CMS 라우터 권한 테스트", () => {
  it("비로그인 사용자가 cms.notices.list에 접근하면 UNAUTHORIZED 에러 발생", async () => {
    const caller = appRouter.createCaller(createContext(null));
    await expect(caller.cms.notices.list()).rejects.toThrow(TRPCError);
  });

  it("일반 사용자(user)가 cms.notices.list에 접근하면 FORBIDDEN 에러 발생", async () => {
    const caller = appRouter.createCaller(createContext("user"));
    try {
      await caller.cms.notices.list();
      expect.fail("에러가 발생해야 합니다");
    } catch (e) {
      expect(e).toBeInstanceOf(TRPCError);
      const err = e as TRPCError;
      expect(err.code).toBe("FORBIDDEN");
    }
  });

  it("auth.me는 비로그인 사용자에게도 null 반환 (publicProcedure)", async () => {
    const caller = appRouter.createCaller(createContext(null));
    const result = await caller.auth.me();
    expect(result).toBeNull();
  });

  it("auth.me는 로그인 사용자에게 user 정보 반환", async () => {
    const caller = appRouter.createCaller(createContext("user"));
    const result = await caller.auth.me();
    expect(result).not.toBeNull();
    expect(result?.role).toBe("user");
  });

  it("auth.me는 관리자에게 admin role 반환", async () => {
    const caller = appRouter.createCaller(createContext("admin"));
    const result = await caller.auth.me();
    expect(result).not.toBeNull();
    expect(result?.role).toBe("admin");
  });
});
