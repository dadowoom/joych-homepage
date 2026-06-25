import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const dbMocks = vi.hoisted(() => ({
  canMemberUseVehicleReservation: vi.fn(),
  createVehicleReservationIfAvailable: vi.fn(),
  getAdminVehicleReservationDetailsByDate: vi.fn(),
  getMemberById: vi.fn(),
  getVehicleById: vi.fn(),
  getVehicles: vi.fn(),
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
    canMemberUseVehicleReservation: dbMocks.canMemberUseVehicleReservation,
    createVehicleReservationIfAvailable: dbMocks.createVehicleReservationIfAvailable,
    getAdminVehicleReservationDetailsByDate: dbMocks.getAdminVehicleReservationDetailsByDate,
    getMemberById: dbMocks.getMemberById,
    getVehicleById: dbMocks.getVehicleById,
    getVehicles: dbMocks.getVehicles,
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

function createContext(): TrpcContext {
  return {
    user: null,
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
    dbMocks.getVehicles.mockResolvedValue([reservableVehicle]);
    dbMocks.getAdminVehicleReservationDetailsByDate.mockResolvedValue([]);
    dbMocks.createVehicleReservationIfAvailable.mockResolvedValue(200);
  });

  it("blocks vehicle reservation pages for members outside the selected position group", async () => {
    dbMocks.canMemberUseVehicleReservation.mockResolvedValue(false);
    const caller = appRouter.createCaller(createContext());

    await expect(caller.home.vehicles()).rejects.toMatchObject({ code: "FORBIDDEN" });
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
