import { TRPCError } from "@trpc/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const dbMocks = vi.hoisted(() => ({
  createPrayerRequest: vi.fn(),
  createNewMemberRequest: vi.fn(),
  createSubtitleRequest: vi.fn(),
  createBulletinAdRequest: vi.fn(),
  createVisitRequest: vi.fn(),
  getMemberById: vi.fn(),
}));

const joseMocks = vi.hoisted(() => ({
  jwtVerify: vi.fn(),
}));

vi.mock("jose", () => ({
  jwtVerify: joseMocks.jwtVerify,
}));

vi.mock("./db/member", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db/member")>();
  return {
    ...actual,
    getMemberById: dbMocks.getMemberById,
  };
});

vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    createPrayerRequest: dbMocks.createPrayerRequest,
    createNewMemberRequest: dbMocks.createNewMemberRequest,
    createSubtitleRequest: dbMocks.createSubtitleRequest,
    createBulletinAdRequest: dbMocks.createBulletinAdRequest,
    createVisitRequest: dbMocks.createVisitRequest,
    getMemberById: dbMocks.getMemberById,
  };
});

import { appRouter } from "./routers";

function createContext(memberId: number | null = null): TrpcContext {
  return {
    user: null,
    memberId,
    memberName: memberId ? "홍길동" : null,
    req: {
      protocol: "https",
      headers: {},
      cookies: memberId ? { church_member_session: "test-member-token" } : {},
    } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("공개 접수 라우터", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-11T00:00:00.000Z"));
    dbMocks.getMemberById.mockResolvedValue({
      id: 1,
      name: "홍길동",
      phone: "01012345678",
      email: "member@example.com",
      status: "approved",
    });
    joseMocks.jwtVerify.mockResolvedValue({
      payload: { type: "church_member", memberId: 1, name: "홍길동" },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
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

  it("탐방 신청은 오늘 이전 방문 희망일을 거절한다", async () => {
    const caller = appRouter.createCaller(createContext());

    await expect(caller.support.submitVisit({
      organizationName: "기쁨기관",
      applicantName: "홍길동",
      phone: "010-1234-5678",
      visitDate: "2026-07-10",
      headcount: 3,
      visitorType: "institution",
      purpose: "교회 탐방",
    })).rejects.toBeInstanceOf(TRPCError);

    expect(dbMocks.createVisitRequest).not.toHaveBeenCalled();
  });

  it("자막 신청은 오늘 이전 필요일을 거절한다", async () => {
    const caller = appRouter.createCaller(createContext(1));

    await expect(caller.support.submitSubtitle({
      title: "지난 자막 신청",
      requestedDate: "2026-07-10",
      content: "지난 날짜 요청",
    })).rejects.toBeInstanceOf(TRPCError);

    expect(dbMocks.createSubtitleRequest).not.toHaveBeenCalled();
  });

  it("주보 광고신청은 오늘 이전 게재 희망일을 거절한다", async () => {
    const caller = appRouter.createCaller(createContext(1));

    await expect(caller.support.submitBulletinAd({
      title: "지난 광고 신청",
      requestedDate: "2026-07-10",
      content: "지난 날짜 요청",
    })).rejects.toBeInstanceOf(TRPCError);

    expect(dbMocks.createBulletinAdRequest).not.toHaveBeenCalled();
  });

  it("오늘 날짜는 탐방, 자막, 주보 광고 신청에 사용할 수 있다", async () => {
    const publicCaller = appRouter.createCaller(createContext());
    const memberCaller = appRouter.createCaller(createContext(1));

    await expect(publicCaller.support.submitVisit({
      organizationName: "기쁨기관",
      applicantName: "홍길동",
      phone: "010-1234-5678",
      visitDate: "2026-07-11",
      headcount: 3,
      visitorType: "institution",
      purpose: "교회 탐방",
    })).resolves.toEqual({ ok: true });

    await expect(memberCaller.support.submitSubtitle({
      title: "오늘 자막 신청",
      requestedDate: "2026-07-11",
      content: "오늘 날짜 요청",
    })).resolves.toEqual({ ok: true });

    await expect(memberCaller.support.submitBulletinAd({
      title: "오늘 광고 신청",
      requestedDate: "2026-07-11",
      content: "오늘 날짜 요청",
    })).resolves.toEqual({ ok: true });

    expect(dbMocks.createVisitRequest).toHaveBeenCalledOnce();
    expect(dbMocks.createSubtitleRequest).toHaveBeenCalledOnce();
    expect(dbMocks.createBulletinAdRequest).toHaveBeenCalledOnce();
  });
});
