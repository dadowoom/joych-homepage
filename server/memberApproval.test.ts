import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext, TrpcUser } from "./_core/context";
import { MEMBER_APPROVAL_PERMISSION_KEY } from "@shared/adminPermissions";

const dbMocks = vi.hoisted(() => ({
  createMember: vi.fn(),
  decidePendingMemberRegistration: vi.fn(),
  getMemberByEmail: vi.fn(),
  getMemberFieldOptions: vi.fn(),
  getPendingMembers: vi.fn(),
  getSiteSetting: vi.fn(),
}));

const pushMocks = vi.hoisted(() => ({
  notifyMemberRegistration: vi.fn(),
}));

vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    createMember: dbMocks.createMember,
    decidePendingMemberRegistration: dbMocks.decidePendingMemberRegistration,
    getMemberByEmail: dbMocks.getMemberByEmail,
    getMemberFieldOptions: dbMocks.getMemberFieldOptions,
    getPendingMembers: dbMocks.getPendingMembers,
    getSiteSetting: dbMocks.getSiteSetting,
  };
});

vi.mock("./_core/pushNotifications", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./_core/pushNotifications")>();
  return {
    ...actual,
    notifyMemberRegistration: pushMocks.notifyMemberRegistration,
  };
});

import { appRouter } from "./routers";

function createUser(contentPermissions: string[] = []): TrpcUser {
  return {
    id: 17,
    openId: "member:17",
    name: "승인 담당자",
    email: "approver@example.com",
    loginMethod: "member",
    role: "user",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    lastSignedIn: new Date("2026-01-01T00:00:00.000Z"),
    memberId: 17,
    contentPermissions,
  };
}

function createContext(user: TrpcUser | null = null, ip = "203.0.113.17"): TrpcContext {
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

const pendingMember = {
  id: 31,
  email: "new-member@example.com",
  passwordHash: "must-not-leak",
  name: "새성도",
  phone: "01012345678",
  birthDate: "1990-01-02",
  gender: "여",
  address: "비공개 주소",
  emergencyPhone: "01099998888",
  position: "집사",
  department: "찬양대",
  district: "1구역",
  faithPlusUserId: null,
  joinPath: "지인 소개",
  baptismType: null,
  baptismDate: null,
  registeredAt: null,
  pastor: null,
  adminMemo: "내부 메모",
  canReserveVehicle: false,
  canReserveFacility: false,
  status: "pending",
  createdAt: new Date("2026-07-15T01:00:00.000Z"),
  updatedAt: new Date("2026-07-15T01:00:00.000Z"),
};

describe("member registration approval delegation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMocks.getPendingMembers.mockResolvedValue([pendingMember]);
    dbMocks.decidePendingMemberRegistration.mockResolvedValue(true);
    dbMocks.getMemberByEmail.mockResolvedValue(null);
    dbMocks.getMemberFieldOptions.mockResolvedValue([
      { id: 1, fieldType: "position", label: "집사", sortOrder: 0, isActive: true },
    ]);
    dbMocks.getSiteSetting.mockResolvedValue(null);
    dbMocks.createMember.mockResolvedValue(31);
  });

  it("회원가입 승인 권한자는 대기 신청의 필요한 정보만 조회한다", async () => {
    const caller = appRouter.createCaller(createContext(createUser([MEMBER_APPROVAL_PERMISSION_KEY])));

    const result = await caller.members.approvalList();

    expect(result).toEqual([expect.objectContaining({
      id: 31,
      name: "새성도",
      email: "new-member@example.com",
      position: "집사",
      status: "pending",
    })]);
    expect(result[0]).not.toHaveProperty("passwordHash");
    expect(result[0]).not.toHaveProperty("adminMemo");
    expect(result[0]).not.toHaveProperty("address");
  });

  it("회원가입 승인 권한자는 대기 신청만 승인 또는 거절할 수 있다", async () => {
    const caller = appRouter.createCaller(createContext(createUser([MEMBER_APPROVAL_PERMISSION_KEY])));

    await expect(caller.members.updateApprovalStatus({ id: 31, status: "approved" }))
      .resolves.toEqual({ success: true });
    expect(dbMocks.decidePendingMemberRegistration).toHaveBeenCalledWith(31, "approved");

    dbMocks.decidePendingMemberRegistration.mockResolvedValueOnce(false);
    await expect(caller.members.updateApprovalStatus({ id: 31, status: "rejected" }))
      .rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("권한 없는 계정은 대기 목록과 승인 처리에 접근할 수 없다", async () => {
    const caller = appRouter.createCaller(createContext(createUser()));

    await expect(caller.members.approvalList()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.members.updateApprovalStatus({ id: 31, status: "approved" }))
      .rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(dbMocks.decidePendingMemberRegistration).not.toHaveBeenCalled();
  });

  it("일반 회원가입은 직분을 저장하고 신규 신청 알림을 한 번만 보낸다", async () => {
    const caller = appRouter.createCaller(createContext(null, "203.0.113.31"));

    await expect(caller.members.register({
      email: "new-member@example.com",
      password: "joyful2026",
      name: "새성도",
      phone: "010-1234-5678",
      position: "집사",
    })).resolves.toEqual({ success: true, id: 31, autoLoggedIn: false });

    expect(dbMocks.createMember).toHaveBeenCalledWith(expect.objectContaining({
      email: "new-member@example.com",
      name: "새성도",
      position: "집사",
    }));
    expect(pushMocks.notifyMemberRegistration).toHaveBeenCalledTimes(1);
    expect(pushMocks.notifyMemberRegistration).toHaveBeenCalledWith({
      memberId: 31,
      name: "새성도",
      position: "집사",
    });
  });

  it("중복 이메일 회원가입은 저장도 알림도 하지 않는다", async () => {
    dbMocks.getMemberByEmail.mockResolvedValueOnce(pendingMember);
    const caller = appRouter.createCaller(createContext(null, "203.0.113.32"));

    await expect(caller.members.register({
      email: "new-member@example.com",
      password: "joyful2026",
      name: "새성도",
      phone: "010-1234-5678",
      position: "집사",
    })).rejects.toMatchObject({ code: "CONFLICT" });

    expect(dbMocks.createMember).not.toHaveBeenCalled();
    expect(pushMocks.notifyMemberRegistration).not.toHaveBeenCalled();
  });

  it("관리자가 등록하지 않은 직분은 직접 요청해도 저장하지 않는다", async () => {
    const caller = appRouter.createCaller(createContext(null, "203.0.113.33"));

    await expect(caller.members.register({
      email: "invalid-position@example.com",
      password: "joyful2026",
      name: "임의직분",
      phone: "010-1234-5678",
      position: "임의 관리자",
    })).rejects.toMatchObject({ code: "BAD_REQUEST" });

    expect(dbMocks.createMember).not.toHaveBeenCalled();
    expect(pushMocks.notifyMemberRegistration).not.toHaveBeenCalled();
  });

  it("관리자가 직분을 필수로 설정하면 직분 없는 가입을 차단한다", async () => {
    dbMocks.getSiteSetting.mockResolvedValueOnce({
      settingValue: JSON.stringify({
        position: { visible: true, required: true },
      }),
    });
    const caller = appRouter.createCaller(createContext(null, "203.0.113.34"));

    await expect(caller.members.register({
      email: "missing-position@example.com",
      password: "joyful2026",
      name: "직분없음",
      phone: "010-1234-5678",
    })).rejects.toMatchObject({ code: "BAD_REQUEST" });

    expect(dbMocks.createMember).not.toHaveBeenCalled();
    expect(pushMocks.notifyMemberRegistration).not.toHaveBeenCalled();
  });
});
