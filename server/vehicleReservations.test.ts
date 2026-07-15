import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext, TrpcUser } from "./_core/context";

const dbMocks = vi.hoisted(() => ({
  canMemberUseVehicleReservation: vi.fn(),
  createVehicleReservationIfAvailable: vi.fn(),
  getAvailableVehiclesForSchedule: vi.fn(),
  getAdminVehicleReservationDetailsByDate: vi.fn(),
  getMemberById: vi.fn(),
  getVehicleById: vi.fn(),
  getVehicleReservationById: vi.fn(),
  getVehicles: vi.fn(),
  updateVehicleReservationDetails: vi.fn(),
}));

const joseMocks = vi.hoisted(() => ({
  jwtVerify: vi.fn(),
}));

const pushMocks = vi.hoisted(() => ({
  notifyCourseApplicationToDistrictManager: vi.fn(),
  notifyFacilityReservation: vi.fn(),
  notifyVehicleReservation: vi.fn(),
}));

vi.mock("jose", () => ({
  jwtVerify: joseMocks.jwtVerify,
}));

vi.mock("./_core/pushNotifications", () => ({
  notifyCourseApplicationToDistrictManager: pushMocks.notifyCourseApplicationToDistrictManager,
  notifyFacilityReservation: pushMocks.notifyFacilityReservation,
  notifyVehicleReservation: pushMocks.notifyVehicleReservation,
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
    canMemberUseVehicleReservation: dbMocks.canMemberUseVehicleReservation,
    createVehicleReservationIfAvailable: dbMocks.createVehicleReservationIfAvailable,
    getAvailableVehiclesForSchedule: dbMocks.getAvailableVehiclesForSchedule,
    getAdminVehicleReservationDetailsByDate: dbMocks.getAdminVehicleReservationDetailsByDate,
    getMemberById: dbMocks.getMemberById,
    getVehicleById: dbMocks.getVehicleById,
    getVehicleReservationById: dbMocks.getVehicleReservationById,
    getVehicles: dbMocks.getVehicles,
    updateVehicleReservationDetails: dbMocks.updateVehicleReservationDetails,
  };
});

import { VehicleReservationOverlapError } from "./db";
import { appRouter } from "./routers";

const approvedVehicleMember = {
  id: 1,
  name: "Vehicle Member",
  email: "vehicle@example.com",
  phone: "01012345678",
  status: "approved",
  position: "장로",
};

const reservableVehicle = {
  id: 1,
  name: "스타리아",
  description: null,
  plateNumber: "00가0000",
  location: "본관",
  driverInfo: null,
  capacity: 11,
  slotMinutes: 60,
  minSlots: 1,
  maxSlots: 4,
  approvalType: "manual",
  isReservable: true,
  isVisible: true,
  notice: null,
  caution: null,
  openTime: "09:00",
  closeTime: "22:00",
  thumbnailUrl: null,
  sortOrder: 0,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
};

function createAdminUser(): TrpcUser {
  return {
    id: 10,
    openId: "admin-user",
    name: "Vehicle Admin",
    email: "admin@example.com",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    lastSignedIn: new Date("2026-01-01T00:00:00.000Z"),
    contentPermissions: ["content:vehicles"],
  };
}

function createContext(user: TrpcUser | null = null, withMemberCookie = true): TrpcContext {
  return {
    user,
    memberId: withMemberCookie ? 1 : null,
    memberName: withMemberCookie ? "Vehicle Member" : null,
    req: {
      protocol: "https",
      headers: {},
      cookies: withMemberCookie ? { church_member_session: "test-member-token" } : {},
    } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

type VehicleReservationInput = Parameters<
  ReturnType<typeof appRouter.createCaller>["home"]["createVehicleReservation"]
>[0];

function vehicleReservationInput(overrides: Partial<VehicleReservationInput> = {}): VehicleReservationInput {
  return {
    vehicleId: 1,
    reserverName: "Vehicle Member",
    reserverPhone: "01012345678",
    reservationDate: "2026-06-17",
    startTime: "10:00",
    endTime: "11:00",
    purpose: "교회 행사",
    department: "차량부",
    passengers: 4,
    notes: "",
    ...overrides,
  };
}

describe("vehicle reservations", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-16T06:00:00.000Z")); // KST 2026-06-16 15:00
    vi.clearAllMocks();
    joseMocks.jwtVerify.mockResolvedValue({
      payload: {
        type: "church_member",
        memberId: 1,
        name: "Vehicle Member",
      },
    });
    dbMocks.getMemberById.mockResolvedValue(approvedVehicleMember);
    dbMocks.canMemberUseVehicleReservation.mockResolvedValue(true);
    dbMocks.getVehicleById.mockResolvedValue(reservableVehicle);
    dbMocks.getVehicleReservationById.mockResolvedValue({
      id: 10,
      vehicleId: 1,
      reservationDate: "2026-06-17",
      startTime: "10:00",
      endTime: "11:00",
      status: "pending",
    });
    dbMocks.getVehicles.mockResolvedValue([reservableVehicle]);
    dbMocks.getAvailableVehiclesForSchedule.mockResolvedValue([reservableVehicle]);
    dbMocks.getAdminVehicleReservationDetailsByDate.mockResolvedValue([]);
    dbMocks.createVehicleReservationIfAvailable.mockResolvedValue(200);
    dbMocks.updateVehicleReservationDetails.mockResolvedValue(true);
    pushMocks.notifyVehicleReservation.mockReset();
  });

  it("blocks vehicle reservation pages for members outside the selected position group", async () => {
    dbMocks.canMemberUseVehicleReservation.mockResolvedValue(false);
    const caller = appRouter.createCaller(createContext());

    await expect(caller.home.vehicles()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.home.availableVehicles({
      reservationDate: "2026-06-17",
      startTime: "10:00",
      endTime: "11:00",
      passengers: 1,
      repeatMode: "none",
    })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.home.createVehicleReservation(vehicleReservationInput())).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(dbMocks.getVehicles).not.toHaveBeenCalled();
    expect(dbMocks.createVehicleReservationIfAvailable).not.toHaveBeenCalled();
  });

  it("returns reservation details to members who can use vehicle reservations", async () => {
    dbMocks.getAdminVehicleReservationDetailsByDate.mockResolvedValue([
      {
        id: 7,
        vehicleId: 1,
        startTime: "10:00",
        endTime: "12:00",
        status: "approved",
        reserverName: "Vehicle Member",
        reserverPhone: "01012345678",
        memberPosition: "장로",
        purpose: "교회 행사",
      },
    ]);
    const caller = appRouter.createCaller(createContext());

    await expect(
      caller.home.vehicleReservationsByDate({ vehicleId: 1, date: "2026-06-17" })
    ).resolves.toMatchObject([
      {
        id: 7,
        startTime: "10:00",
        endTime: "12:00",
        status: "approved",
        reserverName: "Vehicle Member",
        reserverPhone: "01012345678",
        memberPosition: "장로",
      },
    ]);
    expect(dbMocks.getAdminVehicleReservationDetailsByDate).toHaveBeenCalledWith(1, "2026-06-17");
  });

  it("lets vehicle admins read vehicle pages without a member reservation group", async () => {
    dbMocks.canMemberUseVehicleReservation.mockResolvedValue(false);
    dbMocks.getAdminVehicleReservationDetailsByDate.mockResolvedValue([
      {
        id: 8,
        vehicleId: 1,
        startTime: "13:00",
        endTime: "14:00",
        status: "pending",
        reserverName: "Admin Visible Member",
      },
    ]);
    const caller = appRouter.createCaller(createContext(createAdminUser(), false));

    await expect(caller.home.vehicleReservationAccess()).resolves.toEqual({ canUse: true });
    await expect(caller.home.vehicles()).resolves.toEqual([reservableVehicle]);
    await expect(
      caller.home.vehicleReservationsByDate({ vehicleId: 1, date: "2026-06-17" })
    ).resolves.toMatchObject([
      {
        id: 8,
        startTime: "13:00",
        endTime: "14:00",
        status: "pending",
        reserverName: "Admin Visible Member",
      },
    ]);
    expect(dbMocks.canMemberUseVehicleReservation).not.toHaveBeenCalled();
  });

  it("creates vehicle reservations through the overlap-safe insert path", async () => {
    const caller = appRouter.createCaller(createContext());

    await expect(caller.home.createVehicleReservation(vehicleReservationInput())).resolves.toMatchObject({
      id: 200,
      status: "pending",
    });
    expect(dbMocks.createVehicleReservationIfAvailable).toHaveBeenCalledWith(
      expect.objectContaining({
        vehicleId: 1,
        reservationDate: "2026-06-17",
        startTime: "10:00",
        endTime: "11:00",
        userId: 1,
        status: "pending",
      }),
    );
    expect(pushMocks.notifyVehicleReservation).toHaveBeenCalledWith(
      expect.objectContaining({
        reserverName: "Vehicle Member",
        vehicleName: reservableVehicle.name,
        date: "2026-06-17",
        startTime: "10:00",
        endTime: "11:00",
        reservationId: 200,
        status: "pending",
      }),
    );
  });

  it("returns only vehicles available for the selected schedule", async () => {
    const caller = appRouter.createCaller(createContext());

    await expect(caller.home.availableVehicles({
      reservationDate: "2026-06-17",
      startTime: "10:00",
      endTime: "11:00",
      passengers: 1,
      repeatMode: "none",
    })).resolves.toEqual({
      vehicles: [reservableVehicle],
      occurrenceCount: 1,
    });
    expect(dbMocks.getAvailableVehiclesForSchedule).toHaveBeenCalledWith(
      ["2026-06-17"],
      "10:00",
      "11:00",
      1,
    );
  });

  it("checks every occurrence before offering a vehicle for a repeating schedule", async () => {
    const caller = appRouter.createCaller(createContext());

    await expect(caller.home.availableVehicles({
      reservationDate: "2026-06-17",
      startTime: "10:00",
      endTime: "11:00",
      passengers: 1,
      repeatMode: "weekly",
      repeatEndDate: "2026-07-01",
    })).resolves.toMatchObject({ occurrenceCount: 3 });
    expect(dbMocks.getAvailableVehiclesForSchedule).toHaveBeenCalledWith(
      ["2026-06-17", "2026-06-24", "2026-07-01"],
      "10:00",
      "11:00",
      1,
    );
  });

  it("rejects nonexistent calendar dates before checking or saving availability", async () => {
    const caller = appRouter.createCaller(createContext());

    await expect(caller.home.availableVehicles({
      reservationDate: "2026-06-31",
      startTime: "10:00",
      endTime: "11:00",
      passengers: 1,
      repeatMode: "none",
    })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(caller.home.createVehicleReservation(vehicleReservationInput({
      reservationDate: "2026-06-31",
    }))).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(dbMocks.getAvailableVehiclesForSchedule).not.toHaveBeenCalled();
    expect(dbMocks.createVehicleReservationIfAvailable).not.toHaveBeenCalled();
  });

  it("rejects repeating schedules as soon as they exceed 100 occurrences", async () => {
    const caller = appRouter.createCaller(createContext());

    await expect(caller.home.availableVehicles({
      reservationDate: "2026-06-17",
      startTime: "10:00",
      endTime: "11:00",
      passengers: 1,
      repeatMode: "daily",
      repeatEndDate: "9999-12-31",
    })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(dbMocks.getAvailableVehiclesForSchedule).not.toHaveBeenCalled();
  });

  it("allows same-day future vehicle reservations without the facility 24-hour lead guard", async () => {
    const caller = appRouter.createCaller(createContext());

    await expect(
      caller.home.createVehicleReservation(vehicleReservationInput({
        reservationDate: "2026-06-16",
        startTime: "16:00",
        endTime: "17:00",
      })),
    ).resolves.toMatchObject({
      id: 200,
      status: "pending",
    });
    expect(dbMocks.createVehicleReservationIfAvailable).toHaveBeenCalledWith(
      expect.objectContaining({
        reservationDate: "2026-06-16",
        startTime: "16:00",
        endTime: "17:00",
      }),
    );
  });

  it("allows the final 23:00 to 24:00 slot for 24-hour vehicles", async () => {
    dbMocks.getVehicleById.mockResolvedValue({
      ...reservableVehicle,
      openTime: "00:00",
      closeTime: "24:00",
      maxSlots: 24,
    });
    const caller = appRouter.createCaller(createContext());

    await expect(
      caller.home.createVehicleReservation(vehicleReservationInput({
        startTime: "23:00",
        endTime: "24:00",
      })),
    ).resolves.toMatchObject({
      id: 200,
      status: "pending",
    });
    expect(dbMocks.createVehicleReservationIfAvailable).toHaveBeenCalledWith(
      expect.objectContaining({
        startTime: "23:00",
        endTime: "24:00",
      }),
    );
  });

  it("auto-approves individually permitted vehicle managers outside the group rule", async () => {
    dbMocks.canMemberUseVehicleReservation.mockResolvedValue(false);
    const caller = appRouter.createCaller(createContext(createAdminUser()));

    await expect(caller.home.createVehicleReservation(vehicleReservationInput())).resolves.toMatchObject({
      id: 200,
      status: "approved",
    });
    expect(dbMocks.canMemberUseVehicleReservation).not.toHaveBeenCalled();
    expect(dbMocks.createVehicleReservationIfAvailable).toHaveBeenCalledWith(
      expect.objectContaining({
        vehicleId: 1,
        userId: 1,
        status: "approved",
      }),
    );
    expect(pushMocks.notifyVehicleReservation).toHaveBeenCalledWith(
      expect.objectContaining({
        reservationId: 200,
        status: "approved",
      }),
    );
  });

  it("lets vehicle admins create reservations without a member login session", async () => {
    dbMocks.canMemberUseVehicleReservation.mockResolvedValue(false);
    const caller = appRouter.createCaller(createContext(createAdminUser(), false));

    await expect(caller.home.createVehicleReservation(vehicleReservationInput({
      reserverName: "Vehicle Admin",
      reserverPhone: "",
    }))).resolves.toMatchObject({
      id: 200,
      status: "approved",
    });
    expect(dbMocks.canMemberUseVehicleReservation).not.toHaveBeenCalled();
    expect(dbMocks.createVehicleReservationIfAvailable).toHaveBeenCalledWith(
      expect.objectContaining({
        vehicleId: 1,
        userId: null,
        status: "approved",
      }),
    );
  });

  it("lets vehicle managers update reservation time", async () => {
    const caller = appRouter.createCaller(createContext(createAdminUser(), false));

    await expect(caller.cms.vehicleReservations.updateTime({
      id: 10,
      reservationDate: "2026-06-17",
      startTime: "12:00",
      endTime: "13:00",
    })).resolves.toEqual({ success: true });
    expect(dbMocks.updateVehicleReservationDetails).toHaveBeenCalledWith(10, {
      reservationDate: "2026-06-17",
      startTime: "12:00",
      endTime: "13:00",
    });
  });

  it("rejects overlapping vehicle reservations with a conflict error", async () => {
    dbMocks.createVehicleReservationIfAvailable.mockRejectedValue(
      new VehicleReservationOverlapError("10:00", "12:00"),
    );
    const caller = appRouter.createCaller(createContext());

    await expect(
      caller.home.createVehicleReservation(vehicleReservationInput({ startTime: "11:00", endTime: "12:00" }))
    ).rejects.toMatchObject({
      code: "CONFLICT",
    });
  });

  it("blocks vehicle reservations outside the vehicle operating hours", async () => {
    const caller = appRouter.createCaller(createContext());

    await expect(
      caller.home.createVehicleReservation(vehicleReservationInput({ startTime: "08:00", endTime: "09:00" }))
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(dbMocks.createVehicleReservationIfAvailable).not.toHaveBeenCalled();
  });
});
