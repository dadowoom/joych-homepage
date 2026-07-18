import { beforeEach, describe, expect, it, vi } from "vitest";

const memberDbMocks = vi.hoisted(() => ({
  createMemberWithSocialAccount: vi.fn(),
  getMemberByEmail: vi.fn(),
  getMemberById: vi.fn(),
  getMemberFieldOptions: vi.fn(),
  getMemberSocialAccount: vi.fn(),
}));

const pushMocks = vi.hoisted(() => ({
  notifyMemberRegistration: vi.fn(),
}));

vi.mock("./db/member", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db/member")>();
  return {
    ...actual,
    createMemberWithSocialAccount: memberDbMocks.createMemberWithSocialAccount,
    getMemberByEmail: memberDbMocks.getMemberByEmail,
    getMemberById: memberDbMocks.getMemberById,
    getMemberFieldOptions: memberDbMocks.getMemberFieldOptions,
    getMemberSocialAccount: memberDbMocks.getMemberSocialAccount,
  };
});

vi.mock("./_core/pushNotifications", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./_core/pushNotifications")>();
  return {
    ...actual,
    notifyMemberRegistration: pushMocks.notifyMemberRegistration,
  };
});

import { createMemberFromSocialSignup } from "./_core/memberOAuth";

const profile = {
  type: "member_social_signup" as const,
  provider: "google" as const,
  providerUserId: "google-new-member",
  email: "social@example.com",
  emailVerified: true,
  displayName: "소셜성도",
  profileImageUrl: null,
};

const input = {
  name: "소셜성도",
  phone: "01012345678",
  birthDate: "1990-01-02",
  gender: "남" as const,
  position: "권사",
  email: null,
};

describe("social member registration notification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    memberDbMocks.getMemberByEmail.mockResolvedValue(null);
    memberDbMocks.getMemberFieldOptions.mockResolvedValue([
      { id: 1, fieldType: "position", label: "권사", sortOrder: 0, isActive: true },
    ]);
    memberDbMocks.getMemberSocialAccount.mockResolvedValue(null);
    memberDbMocks.createMemberWithSocialAccount.mockResolvedValue(41);
    memberDbMocks.getMemberById.mockResolvedValue({
      id: 41,
      name: "소셜성도",
      email: "social@example.com",
      status: "pending",
    });
  });

  it("간편가입 신규 생성 시 직분을 저장하고 알림을 정확히 한 번 보낸다", async () => {
    await expect(createMemberFromSocialSignup(profile, input)).resolves.toMatchObject({
      status: "ok",
      member: { id: 41, status: "pending" },
    });

    expect(memberDbMocks.createMemberWithSocialAccount).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "소셜성도",
        phone: "010-1234-5678",
        birthDate: "1990-01-02",
        gender: "남",
        position: "권사",
      }),
      expect.objectContaining({
        provider: "google",
        providerUserId: "google-new-member",
      }),
    );
    expect(pushMocks.notifyMemberRegistration).toHaveBeenCalledTimes(1);
    expect(pushMocks.notifyMemberRegistration).toHaveBeenCalledWith({
      memberId: 41,
      name: "소셜성도",
      position: "권사",
    });
  });

  it("010이 아닌 연락처는 생성과 알림 전에 차단한다", async () => {
    await expect(createMemberFromSocialSignup(profile, {
      ...input,
      phone: "+82 10-1234-5678",
    })).resolves.toEqual({
      member: null,
      status: "invalid_phone",
    });

    expect(memberDbMocks.createMemberWithSocialAccount).not.toHaveBeenCalled();
    expect(pushMocks.notifyMemberRegistration).not.toHaveBeenCalled();
  });

  it("생년월일 또는 성별이 없으면 생성과 알림 전에 차단한다", async () => {
    await expect(createMemberFromSocialSignup(profile, {
      ...input,
      birthDate: "",
    })).resolves.toEqual({
      member: null,
      status: "invalid_birth_date",
    });

    await expect(createMemberFromSocialSignup(profile, {
      ...input,
      gender: "" as "남",
    })).resolves.toEqual({
      member: null,
      status: "invalid_gender",
    });

    expect(memberDbMocks.createMemberWithSocialAccount).not.toHaveBeenCalled();
    expect(pushMocks.notifyMemberRegistration).not.toHaveBeenCalled();
  });

  it("직분이 비어 있으면 생성과 알림 전에 차단한다", async () => {
    await expect(createMemberFromSocialSignup(profile, {
      ...input,
      position: "   ",
    })).resolves.toEqual({
      member: null,
      status: "invalid_position",
    });

    expect(memberDbMocks.createMemberWithSocialAccount).not.toHaveBeenCalled();
    expect(pushMocks.notifyMemberRegistration).not.toHaveBeenCalled();
  });

  it("이미 연결된 간편가입 계정에는 중복 알림을 보내지 않는다", async () => {
    memberDbMocks.getMemberSocialAccount.mockResolvedValueOnce({ memberId: 41 });

    await expect(createMemberFromSocialSignup(profile, input)).resolves.toMatchObject({
      status: "ok",
      member: { id: 41 },
    });

    expect(memberDbMocks.createMemberWithSocialAccount).not.toHaveBeenCalled();
    expect(pushMocks.notifyMemberRegistration).not.toHaveBeenCalled();
  });

  it("기존 이메일과 충돌하면 생성과 알림을 모두 중단한다", async () => {
    memberDbMocks.getMemberByEmail.mockResolvedValueOnce({ id: 9 });

    await expect(createMemberFromSocialSignup(profile, input)).resolves.toEqual({
      member: null,
      status: "email_conflict",
    });

    expect(memberDbMocks.createMemberWithSocialAccount).not.toHaveBeenCalled();
    expect(pushMocks.notifyMemberRegistration).not.toHaveBeenCalled();
  });
});
