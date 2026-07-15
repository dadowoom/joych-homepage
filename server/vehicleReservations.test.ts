import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext, TrpcUser } from "./_core/context";

const dbMocks = vi.hoisted(() => ({
  cancelVehicleReservationGroup: vi.fn(),
  canMemberUseVehicleReservation: vi.fn(),
  createVehicleReservationIfAvailable: vi.fn(),
  createVehicleReservationsIfAvailable: vi.fn(),
  deleteVehicleReservationGroup: vi.fn(),
  getAvailableVehiclesForSchedule: vi.fn(),
  getVehicleAvailabilityTimeline: vi.fn(),
  getAdminVehicleReservationDetailsByDate: vi.fn(),
  getMemberById: vi.fn(),
  getVehicleById: vi.fn(),
  getVehicleReservationById: vi.fn(),
  getVehicles: vi.fn(),
  updateVehicleReservationDetails: vi.fn(),
  updateVehicleReservationGroupDetails: vi.fn(),
  updateVehicleReservationGroupStatus: vi.fn(),
}));

const joseMocks = vi.hoisted(() => ({
  jwtVerify: vi.fn(),
}));

const pushMocks = vi.hoisted(() => ({
  notifyCourseApplicationToDistrictManager: vi.fn(),
  notifyFacilityReservation: vi.fn(),
  notifyVehicleReservation: vi.fn(),
  notifyVehicleReservationResult: vi.fn(),
}));

vi.mock("jose", () => ({
  jwtVerify: joseMocks.jwtVerify,
}));

vi.mock("./_core/pushNotifications", () => ({
  notifyCourseApplicationToDistrictManager: pushMocks.notifyCourseApplicationToDistrictManager,
  notifyFacilityReservation: pushMocks.notifyFacilityReservation,
  notifyVehicleReservation: pushMocks.notifyVehicleReservation,
  notifyVehicleReservationResult: pushMocks.notifyVehicleReservationResult,
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
    cancelVehicleReservationGroup: dbMocks.cancelVehicleReservationGroup,
    canMemberUseVehicleReservation: dbMocks.canMemberUseVehicleReservation,
    createVehicleReservationIfAvailable: dbMocks.createVehicleReservationIfAvailable,
    createVehicleReservationsIfAvailable: dbMocks.createVehicleReservationsIfAvailable,
    deleteVehicleReservationGroup: dbMocks.deleteVehicleReservationGroup,
    getAvailableVehiclesForSchedule: dbMocks.getAvailableVehiclesForSchedule,
    getVehicleAvailabilityTimeline: dbMocks.getVehicleAvailabilityTimeline,
    getAdminVehicleReservationDetailsByDate: dbMocks.getAdminVehicleReservationDetailsByDate,
    getMemberById: dbMocks.getMemberById,
    getVehicleById: dbMocks.getVehicleById,
    getVehicleReservationById: dbMocks.getVehicleReservationById,
    getVehicles: dbMocks.getVehicles,
    updateVehicleReservationDetails: dbMocks.updateVehicleReservationDetails,
    updateVehicleReservationGroupDetails: dbMocks.updateVehicleReservationGroupDetails,
    updateVehicleReservationGroupStatus: dbMocks.updateVehicleReservationGroupStatus,
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
    dbMocks.cancelVehicleReservationGroup.mockResolvedValue({
      status: "cancelled",
      count: 2,
      representative: {
        id: 10,
        userId: 1,
        reservationDate: "2026-07-30",
        startTime: "16:00",
        endTime: "21:00",
        vehicleName: "스타리아",
      },
    });
    dbMocks.deleteVehicleReservationGroup.mockResolvedValue(3);
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
    dbMocks.getVehicleAvailabilityTimeline.mockResolvedValue({
      selectedStartTime: null,
      timePoints: ["09:00", "10:00", "11:00"],
      selectAllOption: null,
      startOptions: [{ startTime: "09:00", defaultEndTime: "10:00", availableVehicleCount: 1 }],
      blockedStartTimes: ["10:00"],
      pastStartTimes: [],
      endOptions: [],
      blockedEndTimes: [],
      conflicts: [
        {
          reservationDate: "2026-06-17",
          startTime: "10:00",
          endTime: "11:00",
          vehicleId: 1,
          vehicleName: "스타리아",
          reserverName: "Vehicle Member",
          memberPosition: "장로",
          purpose: "교회 행사",
          status: "approved",
        },
      ],
    });
    dbMocks.getAdminVehicleReservationDetailsByDate.mockResolvedValue([]);
    dbMocks.createVehicleReservationIfAvailable.mockResolvedValue(200);
    dbMocks.createVehicleReservationsIfAvailable.mockResolvedValue([200, 201, 202]);
    dbMocks.updateVehicleReservationDetails.mockResolvedValue(true);
    dbMocks.updateVehicleReservationGroupDetails.mockResolvedValue(3);
    dbMocks.updateVehicleReservationGroupStatus.mockResolvedValue({
      status: "updated",
      count: 3,
      representative: {
        id: 10,
        userId: 1,
        reservationDate: "2026-07-30",
        startTime: "16:00",
        endTime: "21:00",
        vehicleName: "스타리아",
      },
    });
    pushMocks.notifyVehicleReservation.mockReset();
    pushMocks.notifyVehicleReservationResult.mockReset();
  });

  it("blocks vehicle reservation pages for members outside the selected position group", async () => {
    dbMocks.canMemberUseVehicleReservation.mockResolvedValue(false);
    const caller = appRouter.createCaller(createContext());

    await expect(caller.home.vehicles()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.home.vehicleAvailabilityTimeline({
      reservationDate: "2026-06-17",
      passengers: 1,
      repeatMode: "none",
    })).rejects.toMatchObject({ code: "FORBIDDEN" });
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
    expect(dbMocks.getVehicleAvailabilityTimeline).not.toHaveBeenCalled();
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
    await expect(caller.home.vehicleAvailabilityTimeline({
      reservationDate: "2026-06-17",
      passengers: 1,
      repeatMode: "none",
    })).resolves.toMatchObject({
      conflicts: [
        {
          vehicleId: 1,
          vehicleName: "스타리아",
          reserverName: "Vehicle Member",
          purpose: "교회 행사",
        },
      ],
    });
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
        recurrenceGroupId: null,
        recurrenceLabel: null,
        recurrenceSequence: 0,
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
        extraCount: 0,
      }),
    );
    expect(pushMocks.notifyVehicleReservation).toHaveBeenCalledTimes(1);
  });

  it("keeps recurrence metadata empty when a repeat range produces only one occurrence", async () => {
    const caller = appRouter.createCaller(createContext());

    await expect(caller.home.createVehicleReservation(vehicleReservationInput({
      repeatMode: "weekly",
      repeatEndDate: "2026-06-17",
    }))).resolves.toMatchObject({
      id: 200,
      ids: [200],
      count: 1,
      recurrenceLabel: null,
    });

    expect(dbMocks.createVehicleReservationsIfAvailable).not.toHaveBeenCalled();
    expect(dbMocks.createVehicleReservationIfAvailable).toHaveBeenCalledWith(
      expect.objectContaining({
        reservationDate: "2026-06-17",
        recurrenceGroupId: null,
        recurrenceLabel: null,
        recurrenceSequence: 0,
      }),
    );
  });

  it("sends one administrator push for an entire recurring vehicle reservation batch", async () => {
    const caller = appRouter.createCaller(createContext());

    await expect(caller.home.createVehicleReservation(vehicleReservationInput({
      repeatMode: "weekly",
      repeatEndDate: "2026-07-01",
    }))).resolves.toMatchObject({
      id: 200,
      ids: [200, 201, 202],
      count: 3,
      status: "pending",
      recurrenceLabel: "매주 반복 · 2026-07-01까지 · 총 3회",
    });

    expect(dbMocks.createVehicleReservationIfAvailable).not.toHaveBeenCalled();
    type CreatedVehicleReservation = {
      reservationDate: string;
      status: string;
      recurrenceGroupId: string | null;
      recurrenceLabel: string | null;
      recurrenceSequence: number;
    };
    const createdBatch = dbMocks.createVehicleReservationsIfAvailable.mock.calls[0]?.[0] as CreatedVehicleReservation[];
    expect(createdBatch).toHaveLength(3);
    expect(createdBatch.map(({ reservationDate, status, recurrenceSequence }) => ({
      reservationDate,
      status,
      recurrenceSequence,
    }))).toEqual([
      { reservationDate: "2026-06-17", status: "pending", recurrenceSequence: 1 },
      { reservationDate: "2026-06-24", status: "pending", recurrenceSequence: 2 },
      { reservationDate: "2026-07-01", status: "pending", recurrenceSequence: 3 },
    ]);
    const recurrenceGroupId = createdBatch[0]?.recurrenceGroupId;
    expect(recurrenceGroupId).toMatch(/^vehicle_[0-9a-f-]{36}$/);
    expect(createdBatch.every((row) => row.recurrenceGroupId === recurrenceGroupId)).toBe(true);
    expect(createdBatch.every((row) => row.recurrenceLabel === "매주 반복 · 2026-07-01까지 · 총 3회")).toBe(true);
    expect(pushMocks.notifyVehicleReservation).toHaveBeenCalledTimes(1);
    expect(pushMocks.notifyVehicleReservation).toHaveBeenCalledWith({
      reserverName: "Vehicle Member",
      vehicleName: reservableVehicle.name,
      date: "2026-06-17",
      startTime: "10:00",
      endTime: "11:00",
      reservationId: 200,
      status: "pending",
      extraCount: 2,
    });
  });

  it("sends one approved push for an auto-approved recurring vehicle reservation batch", async () => {
    dbMocks.getVehicleById.mockResolvedValue({
      ...reservableVehicle,
      approvalType: "auto",
    });
    const caller = appRouter.createCaller(createContext());

    await expect(caller.home.createVehicleReservation(vehicleReservationInput({
      repeatMode: "weekly",
      repeatEndDate: "2026-07-01",
    }))).resolves.toMatchObject({ count: 3, status: "approved" });

    expect(pushMocks.notifyVehicleReservation).toHaveBeenCalledTimes(1);
    expect(pushMocks.notifyVehicleReservation).toHaveBeenCalledWith(
      expect.objectContaining({
        reservationId: 200,
        status: "approved",
        extraCount: 2,
      }),
    );
  });

  it("does not send a push when a recurring vehicle reservation batch conflicts", async () => {
    dbMocks.createVehicleReservationsIfAvailable.mockRejectedValue(
      new VehicleReservationOverlapError("10:00", "11:00"),
    );
    const caller = appRouter.createCaller(createContext());

    await expect(caller.home.createVehicleReservation(vehicleReservationInput({
      repeatMode: "weekly",
      repeatEndDate: "2026-07-01",
    }))).rejects.toMatchObject({ code: "CONFLICT" });

    expect(pushMocks.notifyVehicleReservation).not.toHaveBeenCalled();
  });

  it("does not send a push when a recurring vehicle reservation batch is incomplete", async () => {
    dbMocks.createVehicleReservationsIfAvailable.mockResolvedValue([200, 201]);
    const caller = appRouter.createCaller(createContext());

    await expect(caller.home.createVehicleReservation(vehicleReservationInput({
      repeatMode: "weekly",
      repeatEndDate: "2026-07-01",
    }))).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });

    expect(pushMocks.notifyVehicleReservation).not.toHaveBeenCalled();
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

  it("returns privacy-minimized conflict details to an allowed vehicle reservation member", async () => {
    const caller = appRouter.createCaller(createContext());

    await expect(caller.home.vehicleAvailabilityTimeline({
      reservationDate: "2026-06-17",
      passengers: 1,
      repeatMode: "none",
      startTime: "09:00",
    })).resolves.toEqual({
      selectedStartTime: null,
      occurrenceCount: 1,
      timePoints: ["09:00", "10:00", "11:00"],
      selectAllOption: null,
      startOptions: [{ startTime: "09:00", defaultEndTime: "10:00", availableVehicleCount: 1 }],
      blockedStartTimes: ["10:00"],
      pastStartTimes: [],
      endOptions: [],
      blockedEndTimes: [],
      conflicts: [
        {
          reservationDate: "2026-06-17",
          startTime: "10:00",
          endTime: "11:00",
          vehicleId: 1,
          vehicleName: "스타리아",
          reserverName: "Vehicle Member",
          memberPosition: "장로",
          purpose: "교회 행사",
          status: "approved",
        },
      ],
    });
    expect(dbMocks.getVehicleAvailabilityTimeline).toHaveBeenCalledWith(
      ["2026-06-17"],
      1,
      "09:00",
      null,
    );
  });

  it("returns conflict details for every date in a repeating timeline", async () => {
    dbMocks.getVehicleAvailabilityTimeline.mockResolvedValueOnce({
      selectedStartTime: null,
      timePoints: ["09:00", "10:00", "11:00"],
      selectAllOption: null,
      startOptions: [],
      blockedStartTimes: ["10:00"],
      pastStartTimes: [],
      endOptions: [],
      blockedEndTimes: [],
      conflicts: [
        {
          reservationDate: "2026-06-24",
          startTime: "10:00",
          endTime: "11:00",
          vehicleId: 1,
          vehicleName: "스타리아",
          reserverName: "반복 예약자",
          memberPosition: "집사",
          purpose: "주간 행사",
          status: "pending",
        },
      ],
    });
    const caller = appRouter.createCaller(createContext());

    await expect(caller.home.vehicleAvailabilityTimeline({
      reservationDate: "2026-06-17",
      passengers: 1,
      repeatMode: "weekly",
      repeatEndDate: "2026-07-01",
    })).resolves.toMatchObject({
      occurrenceCount: 3,
      conflicts: [{ reservationDate: "2026-06-24", status: "pending" }],
    });
    expect(dbMocks.getVehicleAvailabilityTimeline).toHaveBeenCalledWith(
      ["2026-06-17", "2026-06-24", "2026-07-01"],
      1,
      undefined,
      null,
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

  it("allows a full-day vehicle reservation when the configured maximum covers every slot", async () => {
    dbMocks.getVehicleById.mockResolvedValue({
      ...reservableVehicle,
      openTime: "00:00",
      closeTime: "24:00",
      maxSlots: 24,
    });
    const caller = appRouter.createCaller(createContext());

    await expect(
      caller.home.createVehicleReservation(vehicleReservationInput({
        startTime: "00:00",
        endTime: "24:00",
      })),
    ).resolves.toMatchObject({ id: 200, status: "pending" });

    expect(dbMocks.createVehicleReservationIfAvailable).toHaveBeenCalledWith(
      expect.objectContaining({ startTime: "00:00", endTime: "24:00" }),
    );
  });

  it("rejects a full-day vehicle reservation when it exceeds the configured maximum", async () => {
    dbMocks.getVehicleById.mockResolvedValue({
      ...reservableVehicle,
      openTime: "00:00",
      closeTime: "24:00",
      maxSlots: 8,
    });
    const caller = appRouter.createCaller(createContext());

    await expect(
      caller.home.createVehicleReservation(vehicleReservationInput({
        startTime: "00:00",
        endTime: "24:00",
      })),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    expect(dbMocks.createVehicleReservationIfAvailable).not.toHaveBeenCalled();
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

  it("lets vehicle managers update every occurrence time in a recurring batch", async () => {
    const caller = appRouter.createCaller(createContext(createAdminUser(), false));

    await expect(caller.cms.vehicleReservations.updateGroupTime({
      groupId: "vehicle-repeat-1",
      startTime: "17:00",
      endTime: "20:00",
    })).resolves.toEqual({ success: true, count: 3 });

    expect(dbMocks.updateVehicleReservationGroupDetails).toHaveBeenCalledTimes(1);
    expect(dbMocks.updateVehicleReservationGroupDetails).toHaveBeenCalledWith(
      "vehicle-repeat-1",
      { startTime: "17:00", endTime: "20:00" },
    );
  });

  it("approves one recurring batch and sends one result push for the batch", async () => {
    const caller = appRouter.createCaller(createContext(createAdminUser(), false));

    await expect(caller.cms.vehicleReservations.approveGroup({
      groupId: "vehicle-repeat-1",
    })).resolves.toEqual({ success: true, count: 3 });

    expect(dbMocks.updateVehicleReservationGroupStatus).toHaveBeenCalledTimes(1);
    expect(dbMocks.updateVehicleReservationGroupStatus).toHaveBeenCalledWith(
      "vehicle-repeat-1",
      "approved",
      undefined,
      10,
    );
    expect(pushMocks.notifyVehicleReservationResult).toHaveBeenCalledTimes(1);
    expect(pushMocks.notifyVehicleReservationResult).toHaveBeenCalledWith({
      memberId: 1,
      status: "approved",
      vehicleName: "스타리아",
      date: "2026-07-30",
      startTime: "16:00",
      endTime: "21:00",
      reservationId: 10,
      extraCount: 2,
    });
  });

  it("rejects one recurring batch and sends one result push for the batch", async () => {
    const caller = appRouter.createCaller(createContext(createAdminUser(), false));

    await expect(caller.cms.vehicleReservations.rejectGroup({
      groupId: "vehicle-repeat-1",
      comment: "차량 점검 일정과 겹칩니다.",
    })).resolves.toEqual({ success: true, count: 3 });

    expect(dbMocks.updateVehicleReservationGroupStatus).toHaveBeenCalledTimes(1);
    expect(dbMocks.updateVehicleReservationGroupStatus).toHaveBeenCalledWith(
      "vehicle-repeat-1",
      "rejected",
      "차량 점검 일정과 겹칩니다.",
      10,
    );
    expect(pushMocks.notifyVehicleReservationResult).toHaveBeenCalledTimes(1);
    expect(pushMocks.notifyVehicleReservationResult).toHaveBeenCalledWith({
      memberId: 1,
      status: "rejected",
      vehicleName: "스타리아",
      date: "2026-07-30",
      startTime: "16:00",
      endTime: "21:00",
      reservationId: 10,
      extraCount: 2,
    });
  });

  it("lets vehicle managers delete one recurring batch", async () => {
    const caller = appRouter.createCaller(createContext(createAdminUser(), false));

    await expect(caller.cms.vehicleReservations.deleteGroup({
      groupId: "vehicle-repeat-1",
    })).resolves.toEqual({ success: true, count: 3 });

    expect(dbMocks.deleteVehicleReservationGroup).toHaveBeenCalledTimes(1);
    expect(dbMocks.deleteVehicleReservationGroup).toHaveBeenCalledWith("vehicle-repeat-1");
    expect(pushMocks.notifyVehicleReservationResult).not.toHaveBeenCalled();
  });

  it("lets vehicle managers cancel one recurring batch and sends one result push", async () => {
    const caller = appRouter.createCaller(createContext(createAdminUser(), false));

    await expect(caller.cms.vehicleReservations.cancelGroup({
      groupId: "vehicle-repeat-1",
    })).resolves.toEqual({ success: true, count: 2 });

    expect(dbMocks.cancelVehicleReservationGroup).toHaveBeenCalledWith(
      "vehicle-repeat-1",
      10,
      undefined,
    );
    expect(pushMocks.notifyVehicleReservationResult).toHaveBeenCalledTimes(1);
    expect(pushMocks.notifyVehicleReservationResult).toHaveBeenCalledWith({
      memberId: 1,
      status: "cancelled",
      vehicleName: "스타리아",
      date: "2026-07-30",
      startTime: "16:00",
      endTime: "21:00",
      reservationId: 10,
      extraCount: 1,
    });
  });

  it("does not send a push when a recurring batch has no cancellable occurrence", async () => {
    dbMocks.cancelVehicleReservationGroup.mockResolvedValueOnce({
      status: "not_cancellable",
      count: 0,
      representative: null,
    });
    const caller = appRouter.createCaller(createContext(createAdminUser(), false));

    await expect(caller.cms.vehicleReservations.cancelGroup({
      groupId: "vehicle-repeat-finished",
    })).rejects.toMatchObject({ code: "BAD_REQUEST" });

    expect(pushMocks.notifyVehicleReservationResult).not.toHaveBeenCalled();
  });

  it("does not send a push when a recurring batch does not exist", async () => {
    dbMocks.cancelVehicleReservationGroup.mockResolvedValueOnce({
      status: "not_found",
      count: 0,
      representative: null,
    });
    const caller = appRouter.createCaller(createContext(createAdminUser(), false));

    await expect(caller.cms.vehicleReservations.cancelGroup({
      groupId: "vehicle-repeat-missing",
    })).rejects.toMatchObject({ code: "NOT_FOUND" });

    expect(pushMocks.notifyVehicleReservationResult).not.toHaveBeenCalled();
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
