import { TRPCError } from "@trpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const dbMocks = vi.hoisted(() => ({
  createPrayerRequest: vi.fn(),
  createNewMemberRequest: vi.fn(),
  createSubtitleRequest: vi.fn(),
  createBulletinAdRequest: vi.fn(),
}));

vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    createPrayerRequest: dbMocks.createPrayerRequest,
    createNewMemberRequest: dbMocks.createNewMemberRequest,
    createSubtitleRequest: dbMocks.createSubtitleRequest,
    createBulletinAdRequest: dbMocks.createBulletinAdRequest,
  };
});

import { appRouter } from "./routers";

function createContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("공개 접수 라우터", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("기도 요청은 서버 검증 후 DB 저장 함수를 호출한다", async () => {
    const caller = appRouter.createCaller(createContext());

    await expect(
      caller.support.submitPrayer({
        name: "홍길동",
        category: "개인기도",
        content: "함께 기도해주세요.",
      })
    ).resolves.toEqual({ ok: true });

    expect(dbMocks.createPrayerRequest).toHaveBeenCalledWith({
      name: "홍길동",
      category: "개인기도",
      content: "함께 기도해주세요.",
    });
  });

  it("빈 기도 내용은 DB 저장 전에 거절한다", async () => {
    const caller = appRouter.createCaller(createContext());

    await expect(
      caller.support.submitPrayer({
        name: "홍길동",
        category: "개인기도",
        content: " ",
      })
    ).rejects.toBeInstanceOf(TRPCError);

    expect(dbMocks.createPrayerRequest).not.toHaveBeenCalled();
  });

  it("새가족 등록 신청은 선택 입력을 정리해서 DB 저장 함수를 호출한다", async () => {
    const caller = appRouter.createCaller(createContext());

    await expect(
      caller.support.submitNewMember({
        name: "김새가족",
        phone: "010-1234-5678",
        age: 32,
        address: "",
        how: "",
      })
    ).resolves.toEqual({ ok: true });

    expect(dbMocks.createNewMemberRequest).toHaveBeenCalledWith({
      name: "김새가족",
      phone: "010-1234-5678",
      age: 32,
      address: null,
      how: null,
    });
  });

  it("잘못된 연락처 형식의 새가족 신청은 저장하지 않는다", async () => {
    const caller = appRouter.createCaller(createContext());

    await expect(
      caller.support.submitNewMember({
        name: "김새가족",
        phone: "전화번호 없음",
        age: null,
      })
    ).rejects.toBeInstanceOf(TRPCError);

    expect(dbMocks.createNewMemberRequest).not.toHaveBeenCalled();
  });

  it("비로그인 자막 신청은 DB 저장 전에 거절한다", async () => {
    const caller = appRouter.createCaller(createContext());

    await expect(
      caller.support.submitSubtitle({
        title: "6월 7일 찬양 자막",
        requestedDate: "2026-06-07",
        content: "찬양 가사를 자막으로 올려 주세요.",
      })
    ).rejects.toBeInstanceOf(TRPCError);

    expect(dbMocks.createSubtitleRequest).not.toHaveBeenCalled();
  });

  it("비로그인 주보 광고신청은 DB 저장 전에 거절한다", async () => {
    const caller = appRouter.createCaller(createContext());

    await expect(
      caller.support.submitBulletinAd({
        title: "6월 14일 주보 광고",
        requestedDate: "2026-06-14",
        content: "부서 광고를 주보에 실어 주세요.",
      })
    ).rejects.toBeInstanceOf(TRPCError);

    expect(dbMocks.createBulletinAdRequest).not.toHaveBeenCalled();
  });
});
