import { TRPCError } from "@trpc/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext, TrpcUser } from "./_core/context";

const dbMocks = vi.hoisted(() => ({
  getFacilityById: vi.fn(),
  getExternalReservableFacilityById: vi.fn(),
  getExternalReservableFacilities: vi.fn(),
  getFacilityHours: vi.fn(),
  getExternalFacilityHours: vi.fn(),
  getBlockedDates: vi.fn(),
  getReservationsByDate: vi.fn(),
  getAdminReservationDetailsByDate: vi.fn(),
  createReservation: vi.fn(),
  createReservationIfAvailable: vi.fn(),
  createReservationsIfAvailable: vi.fn(),
  getExternalReservationSelfServiceRowsByIdentity: vi.fn(),
  getExternalReservationSelfServiceRowByIdentityAndId: vi.fn(),
  updateOwnedExternalReservationIfAvailable: vi.fn(),
  cancelOwnedExternalReservation: vi.fn(),
  deleteReservationById: vi.fn(),
  getMemberById: vi.fn(),
  getSiteSettings: vi.fn(),
  updateReservationDetails: vi.fn(),
  updateReservationGroupDetails: vi.fn(),
}));

const joseMocks = vi.hoisted(() => ({
  jwtVerify: vi.fn(),
}));

const pushMocks = vi.hoisted(() => ({
  notifyFacilityReservation: vi.fn(),
  notifyVehicleReservation: vi.fn(),
  notifyCourseApplicationToDistrictManager: vi.fn(),
}));

vi.mock("jose", () => ({
  jwtVerify: joseMocks.jwtVerify,
}));

vi.mock("./_core/pushNotifications", () => ({
  notifyFacilityReservation: pushMocks.notifyFacilityReservation,
  notifyVehicleReservation: pushMocks.notifyVehicleReservation,
  notifyCourseApplicationToDistrictManager: pushMocks.notifyCourseApplicationToDistrictManager,
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
    getFacilityById: dbMocks.getFacilityById,
    getExternalReservableFacilityById: dbMocks.getExternalReservableFacilityById,
    getExternalReservableFacilities: dbMocks.getExternalReservableFacilities,
    getFacilityHours: dbMocks.getFacilityHours,
    getExternalFacilityHours: dbMocks.getExternalFacilityHours,
    getBlockedDates: dbMocks.getBlockedDates,
    getReservationsByDate: dbMocks.getReservationsByDate,
    getAdminReservationDetailsByDate: dbMocks.getAdminReservationDetailsByDate,
    createReservation: dbMocks.createReservation,
    createReservationIfAvailable: dbMocks.createReservationIfAvailable,
    createReservationsIfAvailable: dbMocks.createReservationsIfAvailable,
    getExternalReservationSelfServiceRowsByIdentity: dbMocks.getExternalReservationSelfServiceRowsByIdentity,
    getExternalReservationSelfServiceRowByIdentityAndId: dbMocks.getExternalReservationSelfServiceRowByIdentityAndId,
    updateOwnedExternalReservationIfAvailable: dbMocks.updateOwnedExternalReservationIfAvailable,
    cancelOwnedExternalReservation: dbMocks.cancelOwnedExternalReservation,
    deleteReservationById: dbMocks.deleteReservationById,
    getSiteSettings: dbMocks.getSiteSettings,
    updateReservationDetails: dbMocks.updateReservationDetails,
    updateReservationGroupDetails: dbMocks.updateReservationGroupDetails,
  };
});

import { ReservationLockError } from "./db";
import { appRouter } from "./routers";

const approvedMember = {
  id: 1,
  name: "Reservation Member",
  email: "member@example.com",
  phone: "01012345678",
  status: "approved",
  canReserveFacility: false,
};

const reservableFacility = {
  id: 1,
  name: "Meeting Room",
  description: null,
  capacity: 30,
  location: null,
  imageUrl: null,
  isVisible: true,
  isReservable: true,
  isExternalReservable: true,
  externalAdvanceDaysOverride: null,
  approvalType: "manual",
  openTime: "09:00",
  closeTime: "21:00",
  slotMinutes: 60,
  minSlots: 1,
  maxSlots: 4,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
};

function createUserWithReservationPermission(): TrpcUser {
  return {
    id: 10,
    openId: "member:1",
    name: "Reservation Manager",
    email: "manager@example.com",
    loginMethod: "member",
    role: "user",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    lastSignedIn: new Date("2026-01-01T00:00:00.000Z"),
    memberId: 1,
    contentPermissions: ["content:reservations"],
  };
}

function createUserWithFacilityPermission(): TrpcUser {
  return {
    ...createUserWithReservationPermission(),
    name: "Facility Manager",
    email: "facility@example.com",
    contentPermissions: ["content:facilities"],
  };
}

function createContext(user: TrpcUser | null = null): TrpcContext {
  return {
    user,
    memberId: null,
    memberName: null,
    req: {
      protocol: "https",
      headers: {},
      cookies: {
        church_member_session: "test-member-token",
      },
    } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

type ReservationInput = Parameters<ReturnType<typeof appRouter.createCaller>["home"]["createReservation"]>[0];
type ExternalReservationInput = Parameters<ReturnType<typeof appRouter.createCaller>["home"]["createExternalReservation"]>[0];

function reservationInput(overrides: Partial<ReservationInput> = {}): ReservationInput {
  return {
    facilityId: 1,
    reserverName: "Reservation Member",
    reserverPhone: "01012345678",
    reservationDate: "2026-06-17",
    startTime: "14:30",
    endTime: "15:30",
    purpose: "Team meeting",
    department: "Youth",
    attendees: 5,
    notes: "",
    ...overrides,
  };
}

function externalReservationInput(overrides: Partial<ExternalReservationInput> = {}): ExternalReservationInput {
  return {
    facilityId: 1,
    reserverName: "External Visitor",
    reserverPhone: "01099998888",
    reservationDate: "2026-06-17",
    startTime: "15:00",
    endTime: "16:00",
    purpose: "External meeting",
    department: "Guest Group",
    attendees: 5,
    notes: "",
    ...overrides,
  };
}

function externalReservationAuthRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 100,
    facilityId: 1,
    reservationType: "external" as const,
    reserverName: "External Visitor",
    reserverPhone: "01099998888",
    reservationDate: "2026-06-17",
    startTime: "15:00",
    endTime: "16:00",
    status: "pending" as const,
    purpose: "External meeting",
    department: "Guest Group",
    attendees: 5,
    adminComment: null,
    facilityName: "Meeting Room",
    ...overrides,
  };
}

describe("facility reservation lead-time guard", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-16T06:00:00.000Z")); // KST 2026-06-16 15:00
    vi.clearAllMocks();
    joseMocks.jwtVerify.mockResolvedValue({
      payload: {
        type: "church_member",
        memberId: 1,
        name: "Reservation Member",
      },
    });
    dbMocks.getMemberById.mockResolvedValue(approvedMember);
    dbMocks.getFacilityById.mockResolvedValue(reservableFacility);
    dbMocks.getExternalReservableFacilityById.mockResolvedValue(reservableFacility);
    dbMocks.getExternalReservableFacilities.mockResolvedValue([reservableFacility]);
    dbMocks.getFacilityHours.mockResolvedValue([]);
    dbMocks.getExternalFacilityHours.mockResolvedValue([]);
    dbMocks.getBlockedDates.mockResolvedValue([]);
    dbMocks.getReservationsByDate.mockResolvedValue([]);
    dbMocks.getAdminReservationDetailsByDate.mockResolvedValue([]);
    dbMocks.createReservation.mockResolvedValue(100);
    dbMocks.createReservationIfAvailable.mockResolvedValue(100);
    dbMocks.createReservationsIfAvailable.mockImplementation(async (rows: unknown[]) =>
      rows.map((_, index) => 100 + index)
    );
    dbMocks.getExternalReservationSelfServiceRowsByIdentity.mockResolvedValue([]);
    dbMocks.getExternalReservationSelfServiceRowByIdentityAndId.mockResolvedValue(null);
    dbMocks.updateOwnedExternalReservationIfAvailable.mockResolvedValue("updated");
    dbMocks.cancelOwnedExternalReservation.mockResolvedValue("cancelled");
    dbMocks.deleteReservationById.mockResolvedValue(true);
    dbMocks.getSiteSettings.mockResolvedValue({});
    dbMocks.updateReservationDetails.mockResolvedValue(true);
    dbMocks.updateReservationGroupDetails.mockResolvedValue({
      totalCount: 4,
      updatedCount: 3,
      skippedPastCount: 1,
    });
  });

  it("keeps public facility reservation lookups free of private fields", async () => {
    dbMocks.getReservationsByDate.mockResolvedValue([
      {
        startTime: "15:00",
        endTime: "16:00",
        status: "approved",
        reserverName: "Private Name",
        reserverPhone: "01012345678",
      },
    ]);

    const caller = appRouter.createCaller(createContext());

    await expect(
      caller.home.facilityReservationsByDate({ facilityId: 1, date: "2026-06-17" })
    ).resolves.toEqual([
      {
        startTime: "15:00",
        endTime: "16:00",
        status: "approved",
      },
    ]);
    expect(dbMocks.getAdminReservationDetailsByDate).not.toHaveBeenCalled();
  });

  it("returns reservation detail fields to reservation managers", async () => {
    dbMocks.getAdminReservationDetailsByDate.mockResolvedValue([
      {
        id: 7,
        startTime: "15:00",
        endTime: "16:00",
        status: "approved",
        reserverName: "Reservation Member",
        reserverPhone: "01012345678",
        memberPosition: "집사",
        purpose: "Meeting",
      },
    ]);

    const caller = appRouter.createCaller(createContext(createUserWithReservationPermission()));

    await expect(
      caller.home.facilityReservationsByDate({ facilityId: 1, date: "2026-06-17" })
    ).resolves.toMatchObject([
      {
        id: 7,
        startTime: "15:00",
        endTime: "16:00",
        status: "approved",
        reserverName: "Reservation Member",
        reserverPhone: "01012345678",
        memberPosition: "집사",
      },
    ]);
    expect(dbMocks.getAdminReservationDetailsByDate).toHaveBeenCalledWith(1, "2026-06-17");
  });

  it("allows approved church members without facility reservation override when rules are satisfied", async () => {
    dbMocks.getMemberById.mockResolvedValue({
      ...approvedMember,
      canReserveFacility: false,
    });

    const caller = appRouter.createCaller(createContext());

    await expect(
      caller.home.createReservation(reservationInput({ startTime: "15:00", endTime: "16:00" }))
    ).resolves.toMatchObject({ id: 100, status: "pending", count: 1 });
    expect(dbMocks.createReservationIfAvailable).toHaveBeenCalled();
  });

  it("allows public external facility reservation requests without member login", async () => {
    const caller = appRouter.createCaller(createContext(null));

    const result = await caller.home.createExternalReservation(externalReservationInput());
    expect(result).toMatchObject({ id: 100, status: "pending", count: 1 });
    expect(result).not.toHaveProperty("manageCode");

    expect(dbMocks.getExternalReservableFacilityById).toHaveBeenCalledWith(1);
    expect(dbMocks.createReservationIfAvailable).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: null,
        reservationType: "external",
        status: "pending",
        reservationDate: "2026-06-17",
        startTime: "15:00",
        endTime: "16:00",
      }),
    );
    const savedReservation = dbMocks.createReservationIfAvailable.mock.calls[0]?.[0];
    expect(savedReservation).not.toHaveProperty("managePassword");
    expect(savedReservation).not.toHaveProperty("managePasswordHash");
    expect(savedReservation).not.toHaveProperty("manageLookupKeyHash");
    expect(pushMocks.notifyFacilityReservation).toHaveBeenCalledWith(
      expect.objectContaining({
        reserverName: "External Visitor",
        facilityName: "Meeting Room",
        date: "2026-06-17",
        startTime: "15:00",
        endTime: "16:00",
        reservationType: "external",
        reservationId: 100,
        status: "pending",
      }),
    );
  });

  it("normalizes the external reservation phone before saving", async () => {
    const caller = appRouter.createCaller(createContext(null));

    await expect(
      caller.home.createExternalReservation(
        externalReservationInput({ reserverPhone: "010-9999-8888" }),
      ),
    ).resolves.toMatchObject({ id: 100, status: "pending" });
    expect(dbMocks.createReservationIfAvailable).toHaveBeenCalledWith(
      expect.objectContaining({ reserverPhone: "01099998888" }),
    );
  });

  it("looks up matching external reservations by normalized name and phone without exposing private fields", async () => {
    dbMocks.getExternalReservationSelfServiceRowsByIdentity.mockResolvedValue([
      externalReservationAuthRecord({
        status: "rejected",
        adminComment: "일정 조정이 필요합니다.",
      }),
      externalReservationAuthRecord({ id: 101, reservationDate: "2026-06-18" }),
    ]);
    const caller = appRouter.createCaller(createContext(null));
    const auditSpy = vi.spyOn(console, "info").mockImplementation(() => undefined);

    try {
      const result = await caller.home.externalReservationsLookup({
        reserverName: " External Visitor ",
        reserverPhone: "010-9999-8888",
      });

      expect(dbMocks.getExternalReservationSelfServiceRowsByIdentity).toHaveBeenCalledWith(
        "External Visitor",
        "01099998888",
      );
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual(expect.objectContaining({
        id: 100,
        facilityName: "Meeting Room",
        adminResponse: "일정 조정이 필요합니다.",
      }));
      for (const row of result) {
        expect(row).not.toHaveProperty("managePasswordHash");
        expect(row).not.toHaveProperty("manageLookupKeyHash");
        expect(row).not.toHaveProperty("reserverName");
        expect(row).not.toHaveProperty("reserverPhone");
        expect(row).not.toHaveProperty("notes");
        expect(row).not.toHaveProperty("createdAt");
        expect(row).not.toHaveProperty("updatedAt");
      }
      expect(auditSpy).toHaveBeenCalledWith(
        "[AUDIT] external_reservation_self_service",
        expect.stringContaining('"resultCount":2'),
      );
      expect(auditSpy.mock.calls[0]?.[1]).not.toContain("External Visitor");
      expect(auditSpy.mock.calls[0]?.[1]).not.toContain("01099998888");
    } finally {
      auditSpy.mockRestore();
    }
  });

  it("returns only not-yet-started KST reservations while preserving rejected and cancelled statuses", async () => {
    dbMocks.getExternalReservationSelfServiceRowsByIdentity.mockResolvedValue([
      externalReservationAuthRecord({
        id: 98,
        reservationDate: "2026-06-16",
        startTime: "14:59",
        status: "approved",
      }),
      externalReservationAuthRecord({
        id: 99,
        reservationDate: "2026-06-16",
        startTime: "15:00",
        status: "pending",
      }),
      externalReservationAuthRecord({
        id: 100,
        reservationDate: "2026-06-16",
        startTime: "15:01",
        status: "cancelled",
      }),
      externalReservationAuthRecord({
        id: 101,
        reservationDate: "2026-06-17",
        startTime: "09:00",
        status: "rejected",
      }),
    ]);
    const caller = appRouter.createCaller(createContext(null));

    const result = await caller.home.externalReservationsLookup({
      reserverName: "External Visitor",
      reserverPhone: "01099998888",
    });

    expect(result.map(row => ({ id: row.id, status: row.status }))).toEqual([
      { id: 100, status: "cancelled" },
      { id: 101, status: "rejected" },
    ]);
  });

  it("does not expose a non-rejection admin comment in external lookup", async () => {
    dbMocks.getExternalReservationSelfServiceRowsByIdentity.mockResolvedValue([
      externalReservationAuthRecord({
        status: "pending",
        adminComment: "관리자만 보는 메모",
      }),
    ]);
    const caller = appRouter.createCaller(createContext(null));

    await expect(caller.home.externalReservationsLookup({
      reserverName: "External Visitor",
      reserverPhone: "01099998888",
    })).resolves.toEqual([
      expect.objectContaining({ adminResponse: null }),
    ]);
  });

  it("uses the same not-found response when either external identity field does not match", async () => {
    const caller = appRouter.createCaller(createContext(null));
    const wrongName = await caller.home.externalReservationsLookup({
      reserverName: "Unknown Visitor",
      reserverPhone: "01099998888",
    }).catch(error => error);
    const wrongPhone = await caller.home.externalReservationsLookup({
      reserverName: "External Visitor",
      reserverPhone: "01011112222",
    }).catch(error => error);

    expect(wrongName).toMatchObject({ code: "NOT_FOUND" });
    expect(wrongPhone).toMatchObject({
      code: "NOT_FOUND",
      message: wrongName.message,
    });
  });

  it("updates an identity-owned future external reservation and resets it to pending", async () => {
    dbMocks.getExternalReservationSelfServiceRowByIdentityAndId.mockResolvedValue(
      externalReservationAuthRecord({ status: "approved" }),
    );
    dbMocks.getReservationsByDate.mockResolvedValue([
      externalReservationAuthRecord(),
    ]);
    const caller = appRouter.createCaller(createContext(null));

    await expect(caller.home.updateExternalReservation({
      id: 100,
      reserverName: "External Visitor",
      reserverPhone: "010-9999-8888",
      reservationDate: "2026-06-17",
      startTime: "15:00",
      endTime: "16:00",
      purpose: "Updated meeting",
      department: "Updated Group",
      attendees: 6,
    })).resolves.toEqual({ success: true, status: "pending" });

    expect(dbMocks.updateOwnedExternalReservationIfAvailable).toHaveBeenCalledWith(
      100,
      "External Visitor",
      "01099998888",
      {
        reservationDate: "2026-06-17",
        startTime: "15:00",
        endTime: "16:00",
        purpose: "Updated meeting",
        department: "Updated Group",
        attendees: 6,
      },
    );
    expect(pushMocks.notifyFacilityReservation).toHaveBeenCalledWith(
      expect.objectContaining({
        reservationId: 100,
        status: "pending",
        event: "updated",
      }),
    );
  });

  it("revalidates external edits and blocks overlaps with another reservation", async () => {
    dbMocks.getExternalReservationSelfServiceRowByIdentityAndId.mockResolvedValue(
      externalReservationAuthRecord(),
    );
    dbMocks.getReservationsByDate.mockResolvedValue([
      {
        id: 999,
        reservationDate: "2026-06-17",
        startTime: "15:30",
        endTime: "16:30",
        status: "approved",
      },
    ]);
    const caller = appRouter.createCaller(createContext(null));

    await expect(caller.home.updateExternalReservation({
      id: 100,
      reserverName: "External Visitor",
      reserverPhone: "01099998888",
      reservationDate: "2026-06-17",
      startTime: "15:00",
      endTime: "16:00",
      purpose: "Updated meeting",
      attendees: 5,
    })).rejects.toMatchObject({ code: "CONFLICT" });
    expect(dbMocks.updateOwnedExternalReservationIfAvailable).not.toHaveBeenCalled();
  });

  it("soft-cancels only an identity-owned active future external reservation", async () => {
    dbMocks.getExternalReservationSelfServiceRowByIdentityAndId.mockResolvedValue(
      externalReservationAuthRecord({ status: "checking" }),
    );
    const caller = appRouter.createCaller(createContext(null));

    await expect(caller.home.cancelExternalReservation({
      id: 100,
      reserverName: "External Visitor",
      reserverPhone: "01099998888",
    })).resolves.toEqual({ success: true, status: "cancelled" });
    expect(dbMocks.cancelOwnedExternalReservation).toHaveBeenCalledWith(
      100,
      "External Visitor",
      "01099998888",
    );
    expect(dbMocks.deleteReservationById).not.toHaveBeenCalled();
  });

  it("does not let a matching name and phone authorize a different reservation id", async () => {
    const caller = appRouter.createCaller(createContext(null));

    await expect(caller.home.cancelExternalReservation({
      id: 101,
      reserverName: "External Visitor",
      reserverPhone: "01099998888",
    })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(dbMocks.getExternalReservationSelfServiceRowByIdentityAndId).toHaveBeenCalledWith(
      101,
      "External Visitor",
      "01099998888",
    );
    expect(dbMocks.cancelOwnedExternalReservation).not.toHaveBeenCalled();
  });

  it("blocks cancelled and past external reservations before self-service mutation", async () => {
    const caller = appRouter.createCaller(createContext(null));

    dbMocks.getExternalReservationSelfServiceRowByIdentityAndId.mockResolvedValueOnce(
      externalReservationAuthRecord({ status: "cancelled" }),
    );
    await expect(caller.home.cancelExternalReservation({
      id: 100,
      reserverName: "External Visitor",
      reserverPhone: "01099998888",
    })).rejects.toMatchObject({ code: "BAD_REQUEST" });

    dbMocks.getExternalReservationSelfServiceRowByIdentityAndId.mockResolvedValueOnce(
      externalReservationAuthRecord({
        reservationDate: "2026-06-16",
        startTime: "12:00",
      }),
    );
    await expect(caller.home.cancelExternalReservation({
      id: 100,
      reserverName: "External Visitor",
      reserverPhone: "01099998888",
    })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(dbMocks.cancelOwnedExternalReservation).not.toHaveBeenCalled();
  });

  it("blocks external facility reservation requests when the selected time overlaps an existing reservation", async () => {
    dbMocks.getReservationsByDate.mockResolvedValue([
      {
        startTime: "15:30",
        endTime: "16:30",
        status: "checking",
        purpose: "Existing reservation",
        reserverName: "Reservation Member",
      },
    ]);

    const caller = appRouter.createCaller(createContext(null));

    await expect(
      caller.home.createExternalReservation(externalReservationInput())
    ).rejects.toMatchObject({
      code: "CONFLICT",
    });

    expect(dbMocks.createReservationIfAvailable).not.toHaveBeenCalled();
  });

  it("blocks external facility reservations beyond the default advance-day window", async () => {
    dbMocks.getSiteSettings.mockResolvedValue({
      external_reservation_advance_days_default: "14",
    });

    const caller = appRouter.createCaller(createContext(null));

    await expect(
      caller.home.createExternalReservation(
        externalReservationInput({
          reservationDate: "2026-07-01",
        }),
      ),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });

    expect(dbMocks.createReservationIfAvailable).not.toHaveBeenCalled();
  });

  it("allows reservation managers to bypass external facility reservation rules", async () => {
    dbMocks.getSiteSettings.mockResolvedValue({
      external_reservation_advance_days_default: "14",
    });
    dbMocks.getExternalReservableFacilityById.mockResolvedValue({
      ...reservableFacility,
      capacity: 2,
    });
    dbMocks.getExternalFacilityHours.mockResolvedValue([
      {
        facilityId: 1,
        dayOfWeek: 3,
        isOpen: false,
        openTime: "09:00",
        closeTime: "21:00",
        breakStart: null,
        breakEnd: null,
      },
    ]);
    dbMocks.getBlockedDates.mockResolvedValue([
      {
        facilityId: 1,
        blockedDate: "2026-07-01",
        isPartialBlock: false,
        blockStart: null,
        blockEnd: null,
        reason: "maintenance",
      },
    ]);

    const caller = appRouter.createCaller(createContext(createUserWithReservationPermission()));

    await expect(
      caller.home.createExternalReservation(
        externalReservationInput({
          reservationDate: "2026-07-01",
          startTime: "08:00",
          endTime: "09:00",
          attendees: 10,
        }),
      ),
    ).resolves.toMatchObject({ id: 100, status: "approved", count: 1 });

    expect(dbMocks.createReservationIfAvailable).toHaveBeenCalledWith(
      expect.objectContaining({
        reservationDate: "2026-07-01",
        startTime: "08:00",
        endTime: "09:00",
        attendees: 10,
        reservationType: "external",
        status: "approved",
      }),
    );
    expect(dbMocks.createReservationIfAvailable.mock.calls[0]?.[0]).not.toHaveProperty(
      "manageCode",
    );
    const savedReservation = dbMocks.createReservationIfAvailable.mock.calls[0]?.[0];
    expect(savedReservation).not.toHaveProperty("managePassword");
    expect(savedReservation).not.toHaveProperty("managePasswordHash");
    expect(savedReservation).not.toHaveProperty("manageLookupKeyHash");
  });

  it("allows external facility reservations within the default advance-day window", async () => {
    dbMocks.getSiteSettings.mockResolvedValue({
      external_reservation_advance_days_default: "14",
    });

    const caller = appRouter.createCaller(createContext(null));

    await expect(
      caller.home.createExternalReservation(
        externalReservationInput({
          reservationDate: "2026-06-30",
        }),
      ),
    ).resolves.toMatchObject({ id: 100, status: "pending", count: 1 });
  });

  it("allows facility-specific external advance-day overrides", async () => {
    dbMocks.getSiteSettings.mockResolvedValue({
      external_reservation_advance_days_default: "14",
    });
    dbMocks.getExternalReservableFacilityById.mockResolvedValue({
      ...reservableFacility,
      externalAdvanceDaysOverride: 30,
    });

    const caller = appRouter.createCaller(createContext(null));

    await expect(
      caller.home.createExternalReservation(
        externalReservationInput({
          reservationDate: "2026-07-10",
        }),
      ),
    ).resolves.toMatchObject({ id: 100, status: "pending", count: 1 });
  });

  it("uses the stricter global max window when it is earlier than the facility override", async () => {
    dbMocks.getSiteSettings.mockResolvedValue({
      facility_reservation_max_months: "1",
      external_reservation_advance_days_default: "14",
    });
    dbMocks.getExternalReservableFacilityById.mockResolvedValue({
      ...reservableFacility,
      externalAdvanceDaysOverride: 60,
    });

    const caller = appRouter.createCaller(createContext(null));

    await expect(
      caller.home.createExternalReservation(
        externalReservationInput({
          reservationDate: "2026-07-17",
        }),
      ),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });

  it("blocks external-category members even if the reservation flag is enabled", async () => {
    dbMocks.getMemberById.mockResolvedValue({
      ...approvedMember,
      canReserveFacility: true,
      position: "타교인",
    });

    const caller = appRouter.createCaller(createContext());

    await expect(
      caller.home.createReservation(reservationInput())
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(dbMocks.createReservationIfAvailable).not.toHaveBeenCalled();
    expect(dbMocks.createReservation).not.toHaveBeenCalled();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("blocks normal members when the reservation starts in less than 24 hours", async () => {
    const caller = appRouter.createCaller(createContext());

    await expect(
      caller.home.createReservation(reservationInput())
    ).rejects.toBeInstanceOf(TRPCError);

    expect(dbMocks.createReservationIfAvailable).not.toHaveBeenCalled();
  });

  it("allows normal members when the reservation starts at least 24 hours later", async () => {
    const caller = appRouter.createCaller(createContext());

    await expect(
      caller.home.createReservation(reservationInput({ startTime: "15:00", endTime: "16:00" }))
    ).resolves.toMatchObject({ id: 100, status: "pending", count: 1 });

    expect(dbMocks.createReservationIfAvailable).toHaveBeenCalledWith(
      expect.objectContaining({
        reservationDate: "2026-06-17",
        startTime: "15:00",
        endTime: "16:00",
        userId: 1,
      }),
    );
    expect(pushMocks.notifyFacilityReservation).toHaveBeenCalledWith(
      expect.objectContaining({
        reserverName: "Reservation Member",
        facilityName: "Meeting Room",
        date: "2026-06-17",
        startTime: "15:00",
        endTime: "16:00",
        reservationType: "member",
        reservationId: 100,
        status: "pending",
      }),
    );
  });

  it("creates monthly facility reservations on the shared ordinal-weekday rule", async () => {
    dbMocks.getSiteSettings.mockResolvedValue({ facility_reservation_max_months: "4" });
    const caller = appRouter.createCaller(createContext());

    await expect(
      caller.home.createReservation(reservationInput({
        reservationDate: "2026-06-17",
        startTime: "15:00",
        endTime: "16:00",
        repeat: {
          type: "monthly-weekday",
          untilDate: "2026-09-30",
        },
      })),
    ).resolves.toMatchObject({
      count: 4,
      recurrenceLabel: "매월 같은 주 반복 · 2026-09-30까지 · 총 4회",
    });

    expect(dbMocks.createReservationIfAvailable).not.toHaveBeenCalled();
    expect(dbMocks.createReservationsIfAvailable).toHaveBeenCalledTimes(1);
    expect(dbMocks.createReservationsIfAvailable.mock.calls[0]?.[0].map(
      (input: { reservationDate: string }) => input.reservationDate
    )).toEqual([
      "2026-06-17",
      "2026-07-15",
      "2026-08-19",
      "2026-09-16",
    ]);
  });

  it("does not fall back to partial single inserts when a recurring reservation transaction fails", async () => {
    const transactionFailure = new Error("transaction rolled back");
    dbMocks.getSiteSettings.mockResolvedValue({ facility_reservation_max_months: "4" });
    dbMocks.createReservationsIfAvailable.mockRejectedValueOnce(transactionFailure);
    const caller = appRouter.createCaller(createContext());

    await expect(caller.home.createReservation(reservationInput({
      reservationDate: "2026-06-17",
      startTime: "15:00",
      endTime: "16:00",
      repeat: {
        type: "monthly-weekday",
        untilDate: "2026-09-30",
      },
    }))).rejects.toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
      message: transactionFailure.message,
    });

    expect(dbMocks.createReservationsIfAvailable).toHaveBeenCalledTimes(1);
    expect(dbMocks.createReservationIfAvailable).not.toHaveBeenCalled();
    expect(pushMocks.notifyFacilityReservation).not.toHaveBeenCalled();
  });

  it("sends push notifications for auto-approved facility reservations", async () => {
    dbMocks.getFacilityById.mockResolvedValue({
      ...reservableFacility,
      approvalType: "auto",
    });
    const caller = appRouter.createCaller(createContext());

    await expect(
      caller.home.createReservation(reservationInput({ startTime: "15:00", endTime: "16:00" }))
    ).resolves.toMatchObject({ id: 100, status: "approved", count: 1 });

    expect(pushMocks.notifyFacilityReservation).toHaveBeenCalledWith(
      expect.objectContaining({
        reservationId: 100,
        status: "approved",
      }),
    );
  });

  it("blocks normal members when the reservation date is after the configured future window", async () => {
    dbMocks.getSiteSettings.mockResolvedValue({ facility_reservation_max_months: "3" });
    const caller = appRouter.createCaller(createContext());

    await expect(
      caller.home.createReservation(reservationInput({
        reservationDate: "2026-09-17",
        startTime: "15:00",
        endTime: "16:00",
      }))
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });

    expect(dbMocks.createReservationIfAvailable).not.toHaveBeenCalled();
  });

  it("uses the admin-configured reservation future window", async () => {
    dbMocks.getSiteSettings.mockResolvedValue({ facility_reservation_max_months: "4" });
    const caller = appRouter.createCaller(createContext());

    await expect(
      caller.home.createReservation(reservationInput({
        reservationDate: "2026-10-16",
        startTime: "15:00",
        endTime: "16:00",
      }))
    ).resolves.toMatchObject({ id: 100, status: "pending", count: 1 });

    expect(dbMocks.createReservationIfAvailable).toHaveBeenCalledWith(
      expect.objectContaining({
        reservationDate: "2026-10-16",
        startTime: "15:00",
        endTime: "16:00",
      }),
    );
  });

  it("auto-approves reservation managers on manual-approval facilities", async () => {
    const caller = appRouter.createCaller(createContext(createUserWithReservationPermission()));

    await expect(
      caller.home.createReservation(reservationInput({
        reservationDate: "2026-06-16",
        startTime: "16:00",
        endTime: "17:00",
      }))
    ).resolves.toMatchObject({ id: 100, status: "approved", count: 1 });

    expect(dbMocks.createReservationIfAvailable).toHaveBeenCalledWith(
      expect.objectContaining({
        reservationDate: "2026-06-16",
        startTime: "16:00",
        endTime: "17:00",
        userId: 1,
        status: "approved",
      }),
    );
    expect(pushMocks.notifyFacilityReservation).toHaveBeenCalledWith(
      expect.objectContaining({
        reservationId: 100,
        status: "approved",
      }),
    );
    expect(dbMocks.createReservation).not.toHaveBeenCalled();
  });

  it("auto-approves facility managers on manual-approval facilities", async () => {
    const caller = appRouter.createCaller(createContext(createUserWithFacilityPermission()));

    await expect(
      caller.home.createReservation(reservationInput({
        startTime: "15:00",
        endTime: "16:00",
      }))
    ).resolves.toMatchObject({ id: 100, status: "approved", count: 1 });

    expect(dbMocks.createReservationIfAvailable).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "approved",
        userId: 1,
      }),
    );
    expect(pushMocks.notifyFacilityReservation).toHaveBeenCalledWith(
      expect.objectContaining({
        reserverName: "Reservation Member",
        facilityName: "Meeting Room",
        reservationType: "member",
        reservationId: 100,
        status: "approved",
      }),
    );
  });

  it("lets reservation managers update a past facility reservation", async () => {
    const caller = appRouter.createCaller(createContext(createUserWithReservationPermission()));

    await expect(caller.cms.reservations.updateTime({
      id: 10,
      reservationDate: "2026-06-15",
      startTime: "16:00",
      endTime: "17:00",
    })).resolves.toEqual({ success: true });
    expect(dbMocks.updateReservationDetails).toHaveBeenCalledWith(10, {
      reservationDate: "2026-06-15",
      startTime: "16:00",
      endTime: "17:00",
    });
  });

  it("updates only future occurrences when a reservation manager changes a recurring schedule time", async () => {
    const caller = appRouter.createCaller(createContext(createUserWithReservationPermission()));

    await expect(caller.cms.reservations.updateGroupTime({
      groupId: "facility-repeat-1",
      startTime: "16:00",
      endTime: "17:00",
    })).resolves.toEqual({
      success: true,
      count: 3,
      skippedPastCount: 1,
    });
    expect(dbMocks.updateReservationGroupDetails).toHaveBeenCalledWith(
      "facility-repeat-1",
      { startTime: "16:00", endTime: "17:00" },
    );
  });

  it("returns a retryable response when a recurring schedule is being changed concurrently", async () => {
    dbMocks.updateReservationGroupDetails.mockRejectedValueOnce(new ReservationLockError());
    const caller = appRouter.createCaller(createContext(createUserWithReservationPermission()));

    await expect(caller.cms.reservations.updateGroupTime({
      groupId: "facility-repeat-1",
      startTime: "16:00",
      endTime: "17:00",
    })).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
  });

  it("explains when a recurring schedule has no future occurrence left to change", async () => {
    dbMocks.updateReservationGroupDetails.mockResolvedValueOnce({
      totalCount: 3,
      updatedCount: 0,
      skippedPastCount: 3,
    });
    const caller = appRouter.createCaller(createContext(createUserWithReservationPermission()));

    await expect(caller.cms.reservations.updateGroupTime({
      groupId: "facility-repeat-complete",
      startTime: "16:00",
      endTime: "17:00",
    })).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "앞으로 남은 반복 예약이 없어 시간을 변경할 수 없습니다.",
    });
  });

  it("lets reservation managers delete a past facility reservation", async () => {
    const caller = appRouter.createCaller(createContext(createUserWithReservationPermission()));

    await expect(caller.cms.reservations.delete({ id: 10 })).resolves.toEqual({ success: true });
    expect(dbMocks.deleteReservationById).toHaveBeenCalledWith(10);
  });

  it("lets reservation managers bypass closed days and blocked dates when the time is free", async () => {
    dbMocks.getMemberById.mockResolvedValue({
      ...approvedMember,
      canReserveFacility: true,
    });
    dbMocks.getFacilityHours.mockResolvedValue([
      {
        facilityId: 1,
        dayOfWeek: 3,
        isOpen: false,
        openTime: "09:00",
        closeTime: "21:00",
        breakStart: null,
        breakEnd: null,
      },
    ]);
    dbMocks.getBlockedDates.mockResolvedValue([
      {
        facilityId: 1,
        blockedDate: "2026-06-17",
        isPartialBlock: false,
        blockStart: null,
        blockEnd: null,
        reason: "maintenance",
      },
    ]);
    dbMocks.getReservationsByDate.mockResolvedValue([]);

    const caller = appRouter.createCaller(createContext(createUserWithReservationPermission()));

    await expect(
      caller.home.createReservation(reservationInput({ startTime: "15:00", endTime: "16:00" }))
    ).resolves.toMatchObject({ id: 100, status: "approved", count: 1 });

    expect(dbMocks.createReservationIfAvailable).toHaveBeenCalledWith(
      expect.objectContaining({
        reservationDate: "2026-06-17",
        startTime: "15:00",
        endTime: "16:00",
        userId: 1,
      }),
    );
    expect(dbMocks.createReservation).not.toHaveBeenCalled();
  });

  it("blocks reservation managers when the selected time overlaps an existing reservation", async () => {
    dbMocks.getMemberById.mockResolvedValue({
      ...approvedMember,
      canReserveFacility: true,
    });
    dbMocks.getReservationsByDate.mockResolvedValue([
      {
        startTime: "15:00",
        endTime: "16:00",
        status: "approved",
        purpose: "Choir rehearsal",
        reserverName: "Reservation Member",
      },
    ]);

    const caller = appRouter.createCaller(createContext(createUserWithReservationPermission()));

    await expect(
      caller.home.createReservation(reservationInput({ startTime: "15:00", endTime: "16:00" }))
    ).rejects.toMatchObject({
      code: "CONFLICT",
      message: expect.stringContaining("Choir rehearsal"),
    });

    expect(dbMocks.createReservationIfAvailable).not.toHaveBeenCalled();
    expect(dbMocks.createReservation).not.toHaveBeenCalled();
  });

  it("blocks reservation managers when the selected time has already passed", async () => {
    const caller = appRouter.createCaller(createContext(createUserWithReservationPermission()));

    await expect(
      caller.home.createReservation(reservationInput({
        reservationDate: "2026-06-16",
        startTime: "12:00",
        endTime: "13:00",
      }))
    ).rejects.toBeInstanceOf(TRPCError);

    expect(dbMocks.createReservationIfAvailable).not.toHaveBeenCalled();
  });
});
