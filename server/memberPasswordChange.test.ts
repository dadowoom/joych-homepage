import { compare, hash } from "bcryptjs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const dbMocks = vi.hoisted(() => ({
  getMemberById: vi.fn(),
  updateMemberPasswordHash: vi.fn(),
}));

const joseMocks = vi.hoisted(() => ({
  jwtVerify: vi.fn(),
}));

const responseMocks = vi.hoisted(() => ({
  clearCookie: vi.fn(),
}));

vi.mock("jose", () => ({
  jwtVerify: joseMocks.jwtVerify,
}));

vi.mock("./db/member", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db/member")>();
  return {
    ...actual,
    getMemberById: dbMocks.getMemberById,
    updateMemberPasswordHash: dbMocks.updateMemberPasswordHash,
  };
});

vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    getMemberById: dbMocks.getMemberById,
    updateMemberPasswordHash: dbMocks.updateMemberPasswordHash,
  };
});

import { appRouter } from "./routers";

const MEMBER_ID = 71;
const CURRENT_PASSWORD = "Current2026";
const NEW_PASSWORD = "Changed2026";

function createContext(withCookie = true, ip = "203.0.113.71"): TrpcContext {
  return {
    user: null,
    memberId: null,
    memberName: null,
    req: {
      ip,
      protocol: "https",
      headers: {},
      cookies: withCookie ? { church_member_session: "member-password-test-token" } : {},
    } as TrpcContext["req"],
    res: {
      clearCookie: responseMocks.clearCookie,
    } as unknown as TrpcContext["res"],
  };
}

describe("member password change", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const passwordHash = await hash(CURRENT_PASSWORD, 10);
    dbMocks.getMemberById.mockResolvedValue({
      id: MEMBER_ID,
      email: "member@example.com",
      passwordHash,
      sessionVersion: 0,
      adminMemo: "외부 노출 금지",
      name: "변경성도",
      status: "approved",
      createdAt: new Date("2026-07-16T00:00:00.000Z"),
      updatedAt: new Date("2026-07-16T00:00:00.000Z"),
    });
    dbMocks.updateMemberPasswordHash.mockResolvedValue(undefined);
    joseMocks.jwtVerify.mockResolvedValue({
      payload: { type: "church_member", memberId: MEMBER_ID, name: "변경성도" },
    });
  });

  it("변경 이력이 없는 기존 회원은 버전 claim 없는 토큰으로 내 정보를 조회하되 해시는 숨긴다", async () => {
    const caller = appRouter.createCaller(createContext());

    const result = await caller.members.me();

    expect(result).toEqual(expect.objectContaining({
      id: MEMBER_ID,
      hasPassword: true,
    }));
    expect(result).not.toHaveProperty("passwordHash");
    expect(result).not.toHaveProperty("sessionVersion");
    expect(result).not.toHaveProperty("adminMemo");
  });

  it("DB보다 낮은 세션 버전의 기존 토큰은 보호 API에서 거절한다", async () => {
    dbMocks.getMemberById.mockResolvedValue({
      id: MEMBER_ID,
      email: "member@example.com",
      passwordHash: await hash(CURRENT_PASSWORD, 10),
      sessionVersion: 1,
      name: "변경성도",
      status: "approved",
    });
    joseMocks.jwtVerify.mockResolvedValue({
      payload: {
        type: "church_member",
        memberId: MEMBER_ID,
        name: "변경성도",
        sessionVersion: 0,
      },
    });
    const caller = appRouter.createCaller(createContext(true, "203.0.113.77"));

    await expect(caller.members.changeMyPassword({
      currentPassword: CURRENT_PASSWORD,
      newPassword: NEW_PASSWORD,
    })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(dbMocks.updateMemberPasswordHash).not.toHaveBeenCalled();
  });

  it("로그인 쿠키가 없으면 비밀번호를 변경할 수 없다", async () => {
    const caller = appRouter.createCaller(createContext(false));

    await expect(caller.members.changeMyPassword({
      currentPassword: CURRENT_PASSWORD,
      newPassword: NEW_PASSWORD,
    })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(dbMocks.updateMemberPasswordHash).not.toHaveBeenCalled();
  });

  it("승인되지 않은 계정은 비밀번호를 변경할 수 없다", async () => {
    dbMocks.getMemberById.mockResolvedValueOnce({
      id: MEMBER_ID,
      name: "대기성도",
      status: "pending",
      passwordHash: await hash(CURRENT_PASSWORD, 10),
    });
    const caller = appRouter.createCaller(createContext());

    await expect(caller.members.changeMyPassword({
      currentPassword: CURRENT_PASSWORD,
      newPassword: NEW_PASSWORD,
    })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(dbMocks.updateMemberPasswordHash).not.toHaveBeenCalled();
  });

  it("현재 비밀번호가 틀리면 새 해시를 저장하지 않는다", async () => {
    const caller = appRouter.createCaller(createContext(true, "203.0.113.72"));

    await expect(caller.members.changeMyPassword({
      currentPassword: "WrongPassword2026",
      newPassword: NEW_PASSWORD,
    })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
      message: "현재 비밀번호가 올바르지 않습니다.",
    });
    expect(dbMocks.updateMemberPasswordHash).not.toHaveBeenCalled();
  });

  it("회원가입 비밀번호 정책에 맞지 않는 새 비밀번호를 차단한다", async () => {
    const caller = appRouter.createCaller(createContext(true, "203.0.113.73"));

    await expect(caller.members.changeMyPassword({
      currentPassword: CURRENT_PASSWORD,
      newPassword: "onlyletters",
    })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(dbMocks.updateMemberPasswordHash).not.toHaveBeenCalled();
  });

  it("현재 비밀번호와 같은 새 비밀번호를 차단한다", async () => {
    const caller = appRouter.createCaller(createContext(true, "203.0.113.74"));

    await expect(caller.members.changeMyPassword({
      currentPassword: CURRENT_PASSWORD,
      newPassword: CURRENT_PASSWORD,
    })).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "새 비밀번호는 현재 비밀번호와 다르게 입력해주세요.",
    });
    expect(dbMocks.updateMemberPasswordHash).not.toHaveBeenCalled();
  });

  it("비밀번호가 없는 간편가입 계정은 변경 대상이 아님을 안내한다", async () => {
    dbMocks.getMemberById.mockResolvedValue({
      id: MEMBER_ID,
      email: "social@example.com",
      passwordHash: null,
      name: "간편가입성도",
      status: "approved",
    });
    const caller = appRouter.createCaller(createContext(true, "203.0.113.75"));

    await expect(caller.members.changeMyPassword({
      currentPassword: CURRENT_PASSWORD,
      newPassword: NEW_PASSWORD,
    })).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "간편가입 계정은 연결된 계정으로 로그인하며 변경할 비밀번호가 없습니다.",
    });
    expect(dbMocks.updateMemberPasswordHash).not.toHaveBeenCalled();
  });

  it("DB와 동일한 세션 버전의 토큰이면 새 해시를 저장하고 현재 쿠키를 지운다", async () => {
    dbMocks.getMemberById.mockResolvedValue({
      id: MEMBER_ID,
      email: "member@example.com",
      passwordHash: await hash(CURRENT_PASSWORD, 10),
      sessionVersion: 1,
      name: "변경성도",
      status: "approved",
    });
    joseMocks.jwtVerify.mockResolvedValue({
      payload: {
        type: "church_member",
        memberId: MEMBER_ID,
        name: "변경성도",
        sessionVersion: 1,
      },
    });
    const caller = appRouter.createCaller(createContext(true, "203.0.113.76"));

    await expect(caller.members.changeMyPassword({
      currentPassword: CURRENT_PASSWORD,
      newPassword: NEW_PASSWORD,
    })).resolves.toEqual({ success: true, requiresLogin: true });

    expect(dbMocks.updateMemberPasswordHash).toHaveBeenCalledTimes(1);
    const [memberId, savedHash] = dbMocks.updateMemberPasswordHash.mock.calls[0] as [number, string];
    expect(memberId).toBe(MEMBER_ID);
    expect(savedHash).not.toBe(NEW_PASSWORD);
    await expect(compare(NEW_PASSWORD, savedHash)).resolves.toBe(true);
    expect(responseMocks.clearCookie).toHaveBeenCalledWith(
      "church_member_session",
      expect.objectContaining({ httpOnly: true, sameSite: "lax" }),
    );
  });
});
