import { TRPCError } from "@trpc/server";
import { describe, expect, it } from "vitest";
import type { TrpcContext } from "./_core/context";
import { appRouter } from "./routers";

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

describe("팝업/공지 배너 라우터", () => {
  it("공개 home.popups는 DB가 없는 로컬 테스트 환경에서도 빈 배열을 반환한다", async () => {
    const caller = appRouter.createCaller(createContext(null));
    await expect(caller.home.popups()).resolves.toEqual([]);
  });

  it("비로그인 사용자는 cms.popups.list에 접근할 수 없다", async () => {
    const caller = appRouter.createCaller(createContext(null));
    await expect(caller.cms.popups.list()).rejects.toThrow(TRPCError);
  });

  it("일반 사용자는 cms.popups.list에 접근할 수 없다", async () => {
    const caller = appRouter.createCaller(createContext("user"));
    try {
      await caller.cms.popups.list();
      expect.fail("에러가 발생해야 합니다");
    } catch (e) {
      expect(e).toBeInstanceOf(TRPCError);
      expect((e as TRPCError).code).toBe("FORBIDDEN");
    }
  });

  it("관리자는 유효한 팝업을 생성할 수 있다", async () => {
    const caller = appRouter.createCaller(createContext("admin"));

    await expect(
      caller.cms.popups.create({
        title: "이번 주 특별 예배 안내",
        content: "주일 예배 시간을 확인해 주세요.",
        linkLabel: "예배시간 보기",
        linkHref: "/worship/schedule",
        placement: "modal",
        audience: "all",
        priority: 10,
      })
    ).resolves.toBeUndefined();
  });

  it("프로토콜을 생략한 유튜브 팝업 링크도 저장할 수 있다", async () => {
    const caller = appRouter.createCaller(createContext("admin"));

    await expect(
      caller.cms.popups.create({
        title: "외부 영상 안내",
        linkHref: "youtube.com/watch?v=dQw4w9WgXcQ",
      })
    ).resolves.toBeUndefined();
  });

  it("버튼 문구가 있으면 링크도 필요하다", async () => {
    const caller = appRouter.createCaller(createContext("admin"));

    await expect(
      caller.cms.popups.create({
        title: "링크 누락 테스트",
        linkLabel: "자세히 보기",
      })
    ).rejects.toThrow();
  });

  it("안전하지 않은 링크는 거절한다", async () => {
    const caller = appRouter.createCaller(createContext("admin"));

    await expect(
      caller.cms.popups.create({
        title: "위험 링크 테스트",
        linkLabel: "열기",
        linkHref: "javascript:alert(1)",
      })
    ).rejects.toThrow();
  });

  it("종료 시각은 시작 시각보다 늦어야 한다", async () => {
    const caller = appRouter.createCaller(createContext("admin"));

    await expect(
      caller.cms.popups.create({
        title: "기간 오류 테스트",
        startAt: new Date("2026-05-24T10:00:00+09:00"),
        endAt: new Date("2026-05-23T10:00:00+09:00"),
      })
    ).rejects.toThrow();
  });
});
