import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext, TrpcUser } from "./_core/context";

const dbMocks = vi.hoisted(() => ({
  approveMemberPasswordResetRequest: vi.fn(),
  completeMemberPasswordReset: vi.fn(),
  createMemberPasswordResetRequest: vi.fn(),
  getMembersByNameAndPhone: vi.fn(),
  getMemberSocialProviders: vi.fn(),
  getPendingMemberPasswordResetRequests: vi.fn(),
}));

const pushMocks = vi.hoisted(() => ({
  notifyMemberPasswordResetApproved: vi.fn(),
  notifyMemberPasswordResetRequest: vi.fn(),
}));

vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    approveMemberPasswordResetRequest: dbMocks.approveMemberPasswordResetRequest,
    completeMemberPasswordReset: dbMocks.completeMemberPasswordReset,
    createMemberPasswordResetRequest: dbMocks.createMemberPasswordResetRequest,
    getMembersByNameAndPhone: dbMocks.getMembersByNameAndPhone,
    getMemberSocialProviders: dbMocks.getMemberSocialProviders,
    getPendingMemberPasswordResetRequests: dbMocks.getPendingMemberPasswordResetRequests,
  };
});

vi.mock("./_core/pushNotifications", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./_core/pushNotifications")>();
  return {
    ...actual,
    notifyMemberPasswordResetApproved: pushMocks.notifyMemberPasswordResetApproved,
    notifyMemberPasswordResetRequest: pushMocks.notifyMemberPasswordResetRequest,
  };
});

import { appRouter } from "./routers";
import { maskMemberLoginEmail } from "./routers/members";

function createContext(ip: string, user: TrpcUser | null = null): TrpcContext {
  return {
    user,
    memberId: null,
    memberName: null,
    req: {
      ip,
      protocol: "https",
      headers: {},
      cookies: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

function createAdminUser(): TrpcUser {
  return {
    id: 1,
    openId: "admin-recovery-test",
    name: "최고관리자",
    email: "admin@example.com",
    loginMethod: "password",
    role: "admin",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    lastSignedIn: new Date("2026-01-01T00:00:00.000Z"),
    contentPermissions: [],
  };
}

const passwordMember = {
  id: 81,
  name: "계정성도",
  phone: "010-1234-5678",
  birthDate: "1980-02-03",
  email: "joyful.member@example.com",
  passwordHash: "never-return-this-hash",
  position: "집사",
  status: "approved",
};

const socialMember = {
  ...passwordMember,
  id: 82,
  email: "social.member@example.com",
  passwordHash: null,
};

describe("member account recovery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMocks.getMembersByNameAndPhone.mockResolvedValue([]);
    dbMocks.getMemberSocialProviders.mockResolvedValue([]);
    dbMocks.createMemberPasswordResetRequest.mockResolvedValue({ id: 701, created: true });
    dbMocks.approveMemberPasswordResetRequest.mockResolvedValue({
      id: 701,
      memberId: 81,
      name: "계정성도",
      phone: "010-1234-5678",
      position: "집사",
    });
    dbMocks.completeMemberPasswordReset.mockResolvedValue({ status: "completed", memberId: 81 });
    dbMocks.getPendingMemberPasswordResetRequests.mockResolvedValue([]);
    pushMocks.notifyMemberPasswordResetApproved.mockResolvedValue({
      subscriptionCount: 1,
      sentCount: 1,
      expiredCount: 0,
      failedCount: 0,
    });
  });

  it("로그인 이메일은 앞부분을 가리고 전체 주소나 비밀번호 해시를 노출하지 않는다", async () => {
    dbMocks.getMembersByNameAndPhone.mockResolvedValue([passwordMember, socialMember]);
    dbMocks.getMemberSocialProviders.mockResolvedValue([{ memberId: 82, provider: "google" }]);
    const caller = appRouter.createCaller(createContext("203.0.113.81"));

    const result = await caller.members.findLoginId({
      name: "계정성도",
      phone: "01012345678",
      birthDate: "1980-02-03",
    });

    expect(result).toEqual({
      found: true,
      accounts: [
        { maskedEmail: "jo***********@example.com", hasPassword: true, socialProviders: [] },
        { maskedEmail: "so***********@example.com", hasPassword: false, socialProviders: ["Google"] },
      ],
    });
    expect(JSON.stringify(result)).not.toContain("never-return-this-hash");
    expect(JSON.stringify(result)).not.toContain("joyful.member@example.com");
  });

  it("생년월일이 다르면 계정이 없는 것으로 안내한다", async () => {
    dbMocks.getMembersByNameAndPhone.mockResolvedValue([passwordMember]);
    const caller = appRouter.createCaller(createContext("203.0.113.82"));

    await expect(caller.members.findLoginId({
      name: "계정성도",
      phone: "010-1234-5678",
      birthDate: "1980-02-04",
    })).resolves.toEqual({ found: false, accounts: [] });
  });

  it("일치하는 일반가입 계정만 재설정 요청을 만들고 최고관리자 푸시를 한 번 보낸다", async () => {
    dbMocks.getMembersByNameAndPhone.mockResolvedValue([passwordMember, socialMember]);
    const caller = appRouter.createCaller(createContext("203.0.113.83"));

    const result = await caller.members.requestPasswordReset({
      name: "계정성도",
      phone: "010-1234-5678",
      birthDate: "1980-02-03",
    });

    expect(result).toEqual(expect.objectContaining({ accepted: true }));
    expect(dbMocks.createMemberPasswordResetRequest).toHaveBeenCalledTimes(1);
    expect(dbMocks.createMemberPasswordResetRequest).toHaveBeenCalledWith(81);
    expect(pushMocks.notifyMemberPasswordResetRequest).toHaveBeenCalledWith({
      requestId: 701,
      name: "계정성도",
      position: "집사",
    });
  });

  it("이미 대기 중인 재설정 요청은 중복 푸시하지 않는다", async () => {
    dbMocks.getMembersByNameAndPhone.mockResolvedValue([passwordMember]);
    dbMocks.createMemberPasswordResetRequest.mockResolvedValue({ id: 701, created: false });
    const caller = appRouter.createCaller(createContext("203.0.113.84"));

    await caller.members.requestPasswordReset({
      name: "계정성도",
      phone: "010-1234-5678",
      birthDate: "1980-02-03",
    });

    expect(pushMocks.notifyMemberPasswordResetRequest).not.toHaveBeenCalled();
  });

  it("일치하는 계정이 없어도 동일한 접수 응답을 주고 요청을 만들지 않는다", async () => {
    const caller = appRouter.createCaller(createContext("203.0.113.85"));

    const result = await caller.members.requestPasswordReset({
      name: "없는성도",
      phone: "010-9999-8888",
      birthDate: "1970-01-01",
    });

    expect(result).toEqual(expect.objectContaining({ accepted: true }));
    expect(dbMocks.createMemberPasswordResetRequest).not.toHaveBeenCalled();
    expect(pushMocks.notifyMemberPasswordResetRequest).not.toHaveBeenCalled();
  });

  it("재설정 요청 목록은 최고관리자만 조회한다", async () => {
    dbMocks.getPendingMemberPasswordResetRequests.mockResolvedValue([{ id: 701, memberId: 81 }]);
    const adminCaller = appRouter.createCaller(createContext("203.0.113.86", createAdminUser()));
    const guestCaller = appRouter.createCaller(createContext("203.0.113.87"));

    await expect(adminCaller.members.passwordResetRequests()).resolves.toEqual([{ id: 701, memberId: 81 }]);
    await expect(guestCaller.members.passwordResetRequests()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("최고관리자가 본인 확인을 완료하면 24시간짜리 일회용 링크를 성도 푸시로 보낸다", async () => {
    const caller = appRouter.createCaller(createContext("203.0.113.89", createAdminUser()));

    const result = await caller.members.approvePasswordResetRequest({ requestId: 701 });

    expect(result.success).toBe(true);
    expect(result.pushSentCount).toBe(1);
    expect(result.resetPath).toMatch(/^\/member\/password-reset\?token=/);
    expect(dbMocks.approveMemberPasswordResetRequest).toHaveBeenCalledWith(
      701,
      1,
      expect.stringMatching(/^[a-f0-9]{64}$/),
      expect.any(Date),
    );
    expect(pushMocks.notifyMemberPasswordResetApproved).toHaveBeenCalledWith(expect.objectContaining({
      memberId: 81,
      resetPath: result.resetPath,
    }));
  });

  it("일회용 링크로 새 비밀번호를 저장하면 성공하고 기존 세션 폐기는 DB 처리에 맡긴다", async () => {
    const caller = appRouter.createCaller(createContext("203.0.113.90"));

    await expect(caller.members.completePasswordReset({
      token: "a".repeat(43),
      newPassword: "newpassword2026",
    })).resolves.toEqual({ success: true });

    expect(dbMocks.completeMemberPasswordReset).toHaveBeenCalledWith(
      expect.stringMatching(/^[a-f0-9]{64}$/),
      expect.any(String),
    );
  });

  it("이미 사용한 일회용 링크는 다시 사용할 수 없다", async () => {
    dbMocks.completeMemberPasswordReset.mockResolvedValue({ status: "invalid" });
    const caller = appRouter.createCaller(createContext("203.0.113.91"));

    await expect(caller.members.completePasswordReset({
      token: "b".repeat(43),
      newPassword: "newpassword2026",
    })).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: expect.stringContaining("이미 사용"),
    });
  });

  it("계정 찾기는 같은 IP에서 시간당 다섯 번을 넘기면 제한한다", async () => {
    const caller = appRouter.createCaller(createContext("203.0.113.88"));
    const input = {
      name: "계정성도",
      phone: "010-1234-5678",
      birthDate: "1980-02-03",
    };

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await expect(caller.members.findLoginId(input)).resolves.toEqual({ found: false, accounts: [] });
    }
    await expect(caller.members.findLoginId(input)).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
  });

  it("짧은 이메일도 최소 세 글자를 가린다", () => {
    expect(maskMemberLoginEmail("a@example.com")).toBe("a***@example.com");
    expect(maskMemberLoginEmail(null)).toBeNull();
  });
});
