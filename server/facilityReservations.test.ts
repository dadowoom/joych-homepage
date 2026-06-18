import { TRPCError } from "@trpc/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext, TrpcUser } from "./_core/context";

const dbMocks = vi.hoisted(() => ({
  getFacilityById: vi.fn(),
  getFacilityHours: vi.fn(),
  getBlockedDates: vi.fn(),
  getReservationsByDate: vi.fn(),
  createReservationIfAvailable: vi.fn(),
  getMemberById: vi.fn(),
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
    getFacilityById: dbMocks.getFacilityById,
    getFacilityHours: dbMocks.getFacilityHours,
    getBlockedDates: dbMocks.getBlockedDates,
    getReservationsByDate: dbMocks.getReservationsByDate,
    createReservationIfAvailable: dbMocks.createReservationIfAvailable,
  };
});

import { appRouter } from "./routers";

const approvedMember = {
  id: 1,
  name: "Reservation Member",
  email: "member@example.com",
  phone: "01012345678",
  status: "approved",
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
    dbMocks.getFacilityHours.mockResolvedValue([]);
    dbMocks.getBlockedDates.mockResolvedValue([]);
    dbMocks.getReservationsByDate.mockResolvedValue([]);
    dbMocks.createReservationIfAvailable.mockResolvedValue(100);
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
