import { TRPCError } from "@trpc/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const dbMocks = vi.hoisted(() => ({
  archiveMemberBulletinAdRequest: vi.fn(),
  archiveMemberSubtitleRequest: vi.fn(),
  archiveOwnedVisitRequest: vi.fn(),
  createPrayerRequest: vi.fn(),
  createNewMemberRequest: vi.fn(),
  createSubtitleRequest: vi.fn(),
  createBulletinAdRequest: vi.fn(),
  createVisitRequest: vi.fn(),
  getMemberBulletinAdRequest: vi.fn(),
  getMemberById: vi.fn(),
  getMemberSubtitleRequest: vi.fn(),
  listMemberBulletinAdRequests: vi.fn(),
  listMemberSubtitleRequests: vi.fn(),
  listOwnedVisitRequests: vi.fn(),
  updateMemberBulletinAdRequest: vi.fn(),
  updateMemberSubtitleRequest: vi.fn(),
  updateOwnedVisitRequest: vi.fn(),
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
    archiveMemberBulletinAdRequest: dbMocks.archiveMemberBulletinAdRequest,
    archiveMemberSubtitleRequest: dbMocks.archiveMemberSubtitleRequest,
    archiveOwnedVisitRequest: dbMocks.archiveOwnedVisitRequest,
    createPrayerRequest: dbMocks.createPrayerRequest,
    createNewMemberRequest: dbMocks.createNewMemberRequest,
    createSubtitleRequest: dbMocks.createSubtitleRequest,
    createBulletinAdRequest: dbMocks.createBulletinAdRequest,
    createVisitRequest: dbMocks.createVisitRequest,
    getMemberBulletinAdRequest: dbMocks.getMemberBulletinAdRequest,
    getMemberById: dbMocks.getMemberById,
    getMemberSubtitleRequest: dbMocks.getMemberSubtitleRequest,
    listMemberBulletinAdRequests: dbMocks.listMemberBulletinAdRequests,
    listMemberSubtitleRequests: dbMocks.listMemberSubtitleRequests,
    listOwnedVisitRequests: dbMocks.listOwnedVisitRequests,
    updateMemberBulletinAdRequest: dbMocks.updateMemberBulletinAdRequest,
    updateMemberSubtitleRequest: dbMocks.updateMemberSubtitleRequest,
    updateOwnedVisitRequest: dbMocks.updateOwnedVisitRequest,
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
    dbMocks.createVisitRequest.mockResolvedValue(901);
    dbMocks.listMemberBulletinAdRequests.mockResolvedValue([]);
    dbMocks.listMemberSubtitleRequests.mockResolvedValue([]);
    dbMocks.listOwnedVisitRequests.mockResolvedValue([]);
    dbMocks.getMemberBulletinAdRequest.mockResolvedValue({ id: 301, memberId: 1 });
    dbMocks.getMemberSubtitleRequest.mockResolvedValue({ id: 201, memberId: 1 });
    dbMocks.updateMemberBulletinAdRequest.mockResolvedValue(true);
    dbMocks.updateMemberSubtitleRequest.mockResolvedValue(true);
    dbMocks.updateOwnedVisitRequest.mockResolvedValue(true);
    dbMocks.archiveMemberBulletinAdRequest.mockResolvedValue(true);
    dbMocks.archiveMemberSubtitleRequest.mockResolvedValue(true);
    dbMocks.archiveOwnedVisitRequest.mockResolvedValue(true);
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
      region: "포항시",
      email: "visitor@example.com",
      visitDate: "2026-07-10",
      headcount: 3,
      visitorType: "institution",
      purpose: "교회 탐방",
    })).rejects.toBeInstanceOf(TRPCError);

    expect(dbMocks.createVisitRequest).not.toHaveBeenCalled();
  });

  it("교회 탐방 신청은 소속 교단 없이는 저장하지 않는다", async () => {
    const caller = appRouter.createCaller(createContext());

    await expect(caller.support.submitVisit({
      organizationName: "기쁨교회",
      applicantName: "홍길동",
      phone: "010-1234-5678",
      region: "포항시",
      email: "visitor@example.com",
      visitDate: "2026-07-11",
      headcount: 3,
      visitorType: "church",
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
      region: "포항시",
      email: "visitor@example.com",
      visitDate: "2026-07-11",
      headcount: 3,
      visitorType: "institution",
      purpose: "교회 탐방",
    })).resolves.toEqual(expect.objectContaining({
      ok: true,
      requestId: 901,
      manageToken: expect.any(String),
    }));

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

  it("returns only the signed-in member's subtitle and bulletin requests", async () => {
    dbMocks.listMemberSubtitleRequests.mockResolvedValue([{ id: 201, memberId: 1, title: "자막 신청" }]);
    dbMocks.listMemberBulletinAdRequests.mockResolvedValue([{ id: 301, memberId: 1, title: "주보 광고" }]);
    const caller = appRouter.createCaller(createContext(1));

    await expect(caller.support.mySubtitles()).resolves.toEqual([{ id: 201, title: "자막 신청" }]);
    await expect(caller.support.myBulletinAds()).resolves.toEqual([{ id: 301, title: "주보 광고" }]);
    expect(dbMocks.listMemberSubtitleRequests).toHaveBeenCalledWith(1);
    expect(dbMocks.listMemberBulletinAdRequests).toHaveBeenCalledWith(1);
  });

  it("lets a member update and delete only their own subtitle request", async () => {
    const caller = appRouter.createCaller(createContext(1));

    await expect(caller.support.updateMySubtitle({
      id: 201,
      title: "수정한 자막 신청",
      requestedDate: "2026-07-12",
      content: "수정한 자막 내용",
      removeAttachment: true,
    })).resolves.toEqual({ ok: true });
    await expect(caller.support.deleteMySubtitle({ id: 201 })).resolves.toEqual({ ok: true });

    expect(dbMocks.getMemberSubtitleRequest).toHaveBeenCalledWith(201, 1);
    expect(dbMocks.updateMemberSubtitleRequest).toHaveBeenCalledWith(201, 1, expect.objectContaining({
      title: "수정한 자막 신청",
      attachment: null,
    }));
    expect(dbMocks.archiveMemberSubtitleRequest).toHaveBeenCalledWith(201, 1);
  });

  it("lets a member update and delete only their own bulletin ad request", async () => {
    const caller = appRouter.createCaller(createContext(1));

    await expect(caller.support.updateMyBulletinAd({
      id: 301,
      title: "수정한 주보 광고",
      requestedDate: "2026-07-12",
      content: "수정한 주보 광고 내용",
    })).resolves.toEqual({ ok: true });
    await expect(caller.support.deleteMyBulletinAd({ id: 301 })).resolves.toEqual({ ok: true });

    expect(dbMocks.getMemberBulletinAdRequest).toHaveBeenCalledWith(301, 1);
    expect(dbMocks.updateMemberBulletinAdRequest).toHaveBeenCalledWith(301, 1, expect.objectContaining({
      title: "수정한 주보 광고",
    }));
    expect(dbMocks.archiveMemberBulletinAdRequest).toHaveBeenCalledWith(301, 1);
  });

  it("rejects a member trying to update another member's request", async () => {
    dbMocks.getMemberSubtitleRequest.mockResolvedValue(null);
    const caller = appRouter.createCaller(createContext(1));

    await expect(caller.support.updateMySubtitle({
      id: 999,
      title: "다른 사람 신청",
      content: "수정하면 안 되는 내용",
    })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(dbMocks.updateMemberSubtitleRequest).not.toHaveBeenCalled();
  });

  it("hashes an anonymous visit management token and uses it for self-management", async () => {
    const caller = appRouter.createCaller(createContext());
    const submitted = await caller.support.submitVisit({
      organizationName: "방문 기관",
      applicantName: "신청인",
      phone: "010-1234-5678",
      region: "포항",
      email: "visitor@example.com",
      visitDate: "2026-07-12",
      headcount: 3,
      visitorType: "institution",
      purpose: "교회 탐방",
    });

    expect(submitted).toEqual(expect.objectContaining({
      ok: true,
      requestId: 901,
      manageToken: expect.any(String),
    }));
    expect(dbMocks.createVisitRequest).toHaveBeenCalledWith(expect.objectContaining({
      memberId: null,
      manageTokenHash: expect.stringMatching(/^[a-f0-9]{64}$/),
    }));
    expect(dbMocks.createVisitRequest.mock.calls[0][0].manageTokenHash).not.toBe(submitted.manageToken);

    await expect(caller.support.updateMyVisit({
      id: 901,
      manageToken: submitted.manageToken,
      organizationName: "수정 기관",
      applicantName: "신청인",
      phone: "010-1234-5678",
      region: "포항",
      email: "visitor@example.com",
      visitDate: "2026-07-13",
      headcount: 4,
      visitorType: "institution",
      purpose: "수정한 탐방",
    })).resolves.toEqual({ ok: true });

    const tokenHash = dbMocks.updateOwnedVisitRequest.mock.calls[0][2];
    expect(tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(tokenHash).toBe(dbMocks.createVisitRequest.mock.calls[0][0].manageTokenHash);
  });

  it("lists and deletes an anonymous visitor's request with the management token", async () => {
    dbMocks.listOwnedVisitRequests.mockResolvedValue([{
      id: 901,
      memberId: null,
      manageTokenHash: "a".repeat(64),
      organizationName: "방문 기관",
    }]);
    const caller = appRouter.createCaller(createContext());
    const manageToken = "visit-management-token-that-is-long-enough";

    await expect(caller.support.myVisits({
      manageTokens: [{ id: 901, token: manageToken }],
    })).resolves.toEqual([{ id: 901, organizationName: "방문 기관" }]);
    expect(dbMocks.listOwnedVisitRequests).toHaveBeenCalledWith(null, [{
      id: 901,
      tokenHash: expect.stringMatching(/^[a-f0-9]{64}$/),
    }]);

    await expect(caller.support.deleteMyVisit({
      id: 901,
      manageToken,
    })).resolves.toEqual({ ok: true });
    expect(dbMocks.archiveOwnedVisitRequest).toHaveBeenCalledWith(
      901,
      null,
      expect.stringMatching(/^[a-f0-9]{64}$/),
    );
  });

  it("rejects an anonymous visit update when the management token is invalid", async () => {
    dbMocks.updateOwnedVisitRequest.mockResolvedValue(false);
    const caller = appRouter.createCaller(createContext());

    await expect(caller.support.updateMyVisit({
      id: 901,
      manageToken: "x".repeat(32),
      organizationName: "방문 기관",
      applicantName: "신청인",
      phone: "010-1234-5678",
      region: "포항",
      email: "visitor@example.com",
      visitDate: "2026-07-12",
      headcount: 3,
      visitorType: "institution",
      purpose: "교회 탐방",
    })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
