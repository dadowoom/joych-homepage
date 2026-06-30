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
  getMemberById: vi.fn(),
  getSiteSettings: vi.fn(),
  updateReservationDetails: vi.fn(),
}));

const joseMocks = vi.hoisted(() => ({
  jwtVerify: vi.fn(),
}));

const pushMocks = vi.hoisted(() => ({
  notifyFacilityReservation: vi.fn(),
}));

vi.mock("jose", () => ({
  jwtVerify: joseMocks.jwtVerify,
}));

vi.mock("./_core/pushNotifications", () => ({
  notifyFacilityReservation: pushMocks.notifyFacilityReservation,
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
    getSiteSettings: dbMocks.getSiteSettings,
    updateReservationDetails: dbMocks.updateReservationDetails,
  };
});

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
    dbMocks.getSiteSettings.mockResolvedValue({});
    dbMocks.updateReservationDetails.mockResolvedValue(true);
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

    await expect(
      caller.home.createExternalReservation(externalReservationInput())
    ).resolves.toMatchObject({ id: 100, status: "pending", count: 1 });

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
    expect(pushMocks.notifyFacilityReservation).toHaveBeenCalledWith(
      expect.objectContaining({
        reserverName: "External Visitor",
        facilityName: "Meeting Room",
        date: "2026-06-17",
        startTime: "15:00",
        endTime: "16:00",
        reservationType: "external",
        reservationId: 100,
      }),
    );
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
      }),
    );
  });

  it("does not send push notifications for auto-approved facility reservations", async () => {
    dbMocks.getFacilityById.mockResolvedValue({
      ...reservableFacility,
      approvalType: "auto",
    });
    const caller = appRouter.createCaller(createContext());

    await expect(
      caller.home.createReservation(reservationInput({ startTime: "15:00", endTime: "16:00" }))
    ).resolves.toMatchObject({ id: 100, status: "approved", count: 1 });

    expect(pushMocks.notifyFacilityReservation).not.toHaveBeenCalled();
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

  it("lets reservation managers bypass the 24-hour guard after phone confirmation", async () => {
    const caller = appRouter.createCaller(createContext(createUserWithReservationPermission()));

    await expect(
      caller.home.createReservation(reservationInput({
        reservationDate: "2026-06-16",
        startTime: "16:00",
        endTime: "17:00",
      }))
    ).resolves.toMatchObject({ id: 100, status: "pending", count: 1 });

    expect(dbMocks.createReservationIfAvailable).toHaveBeenCalledWith(
      expect.objectContaining({
        reservationDate: "2026-06-16",
        startTime: "16:00",
        endTime: "17:00",
        userId: 1,
      }),
    );
    expect(dbMocks.createReservation).not.toHaveBeenCalled();
  });

  it("lets reservation managers update facility reservation time", async () => {
    const caller = appRouter.createCaller(createContext(createUserWithReservationPermission()));

    await expect(caller.cms.reservations.updateTime({
      id: 10,
      reservationDate: "2026-06-17",
      startTime: "16:00",
      endTime: "17:00",
    })).resolves.toEqual({ success: true });
    expect(dbMocks.updateReservationDetails).toHaveBeenCalledWith(10, {
      reservationDate: "2026-06-17",
      startTime: "16:00",
      endTime: "17:00",
    });
  });

  it("lets reservation exception members bypass closed days and blocked dates when the time is free", async () => {
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
    expect(dbMocks.createReservation).not.toHaveBeenCalled();
  });

  it("blocks reservation exception members when the selected time overlaps an existing reservation", async () => {
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

    const caller = appRouter.createCaller(createContext());

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
