import { describe, expect, it } from "vitest";
import {
  buildVehicleAvailabilityConflictDetails,
  buildVehicleAvailabilityTimeline,
  isVehicleCompatibleWithSchedule,
} from "./db/vehicle";

const vehicle = {
  isVisible: true,
  isReservable: true,
  openTime: "09:00",
  closeTime: "24:00",
  slotMinutes: 60,
  minSlots: 1,
  maxSlots: 4,
  capacity: 11,
};

describe("vehicle schedule compatibility", () => {
  it("accepts a compatible time range including the final 24:00 boundary", () => {
    expect(isVehicleCompatibleWithSchedule(vehicle, "10:00", "12:00", 4)).toBe(true);
    expect(isVehicleCompatibleWithSchedule(vehicle, "23:00", "24:00", 1)).toBe(true);
  });

  it("applies each vehicle's operating hours and slot alignment", () => {
    expect(isVehicleCompatibleWithSchedule(vehicle, "08:00", "10:00", 1)).toBe(false);
    expect(isVehicleCompatibleWithSchedule(vehicle, "09:30", "10:30", 1)).toBe(false);
  });

  it("applies minimum, maximum, visibility, reservable, and capacity rules", () => {
    expect(isVehicleCompatibleWithSchedule(vehicle, "09:00", "14:00", 1)).toBe(false);
    expect(isVehicleCompatibleWithSchedule({ ...vehicle, minSlots: 2 }, "09:00", "10:00", 1)).toBe(false);
    expect(isVehicleCompatibleWithSchedule({ ...vehicle, isVisible: false }, "09:00", "10:00", 1)).toBe(false);
    expect(isVehicleCompatibleWithSchedule({ ...vehicle, isReservable: false }, "09:00", "10:00", 1)).toBe(false);
    expect(isVehicleCompatibleWithSchedule(vehicle, "09:00", "10:00", 12)).toBe(false);
  });
});

describe("vehicle availability timeline", () => {
  const timelineVehicle = {
    ...vehicle,
    id: 1,
    openTime: "10:00",
    closeTime: "12:00",
    maxSlots: 2,
  };
  const reservationDate = "2026-07-16";

  it("does not combine adjacent time ranges from different vehicles", () => {
    const result = buildVehicleAvailabilityTimeline(
      [timelineVehicle, { ...timelineVehicle, id: 2 }],
      [
        { vehicleId: 1, reservationDate, startTime: "11:00", endTime: "12:00" },
        { vehicleId: 2, reservationDate, startTime: "10:00", endTime: "11:00" },
      ],
      [reservationDate],
      1,
      "10:00",
    );

    expect(result.startOptions).toEqual([
      { startTime: "10:00", defaultEndTime: "11:00", availableVehicleCount: 1 },
      { startTime: "11:00", defaultEndTime: "12:00", availableVehicleCount: 1 },
    ]);
    expect(result.endOptions).toEqual([
      { endTime: "11:00", availableVehicleCount: 1 },
    ]);
    expect(result.blockedEndTimes).toContain("12:00");
    expect(result.selectAllOption).toBeNull();
  });

  it("keeps a longer range when the same vehicle is free throughout", () => {
    const result = buildVehicleAvailabilityTimeline(
      [timelineVehicle, { ...timelineVehicle, id: 2 }],
      [{ vehicleId: 1, reservationDate, startTime: "11:00", endTime: "12:00" }],
      [reservationDate],
      1,
      "10:00",
    );

    expect(result.endOptions).toEqual([
      { endTime: "11:00", availableVehicleCount: 2 },
      { endTime: "12:00", availableVehicleCount: 1 },
    ]);
    expect(result.selectAllOption).toEqual({
      startTime: "10:00",
      endTime: "12:00",
      availableVehicleCount: 1,
    });
  });

  it("keeps select all disabled when the whole range exceeds the vehicle maximum duration", () => {
    const result = buildVehicleAvailabilityTimeline(
      [{ ...timelineVehicle, maxSlots: 1 }],
      [],
      [reservationDate],
      1,
    );

    expect(result.startOptions).toHaveLength(2);
    expect(result.selectAllOption).toBeNull();
  });

  it("uses the vehicle minimum duration for the first bar selection", () => {
    const result = buildVehicleAvailabilityTimeline(
      [{ ...timelineVehicle, minSlots: 2, maxSlots: 2 }],
      [],
      [reservationDate],
      1,
      "10:00",
    );

    expect(result.startOptions[0]).toEqual({
      startTime: "10:00",
      defaultEndTime: "12:00",
      availableVehicleCount: 1,
    });
    expect(result.endOptions).toEqual([
      { endTime: "12:00", availableVehicleCount: 1 },
    ]);
  });

  it("counts only vehicles that support the displayed default range", () => {
    const result = buildVehicleAvailabilityTimeline(
      [
        { ...timelineVehicle, id: 1, minSlots: 1, maxSlots: 2 },
        { ...timelineVehicle, id: 2, minSlots: 2, maxSlots: 2 },
      ],
      [],
      [reservationDate],
      1,
      "10:00",
    );

    expect(result.startOptions[0]).toEqual({
      startTime: "10:00",
      defaultEndTime: "11:00",
      availableVehicleCount: 1,
    });
    expect(result.endOptions).toEqual([
      { endTime: "11:00", availableVehicleCount: 1 },
      { endTime: "12:00", availableVehicleCount: 2 },
    ]);
  });

  it("requires one vehicle to be free on every repeated date", () => {
    const secondDate = "2026-07-23";
    const result = buildVehicleAvailabilityTimeline(
      [{ ...timelineVehicle, minSlots: 2, maxSlots: 2 }],
      [{ vehicleId: 1, reservationDate: secondDate, startTime: "11:00", endTime: "12:00" }],
      [reservationDate, secondDate],
      1,
      "10:00",
    );

    expect(result.startOptions).toEqual([]);
    expect(result.blockedStartTimes).toContain("10:00");
    expect(result.blockedEndTimes).toContain("12:00");
    expect(result.selectAllOption).toBeNull();
  });

  it("marks same-day past starts while keeping future starts available", () => {
    const result = buildVehicleAvailabilityTimeline(
      [timelineVehicle],
      [],
      [reservationDate],
      1,
      null,
      "10:30",
    );

    expect(result.pastStartTimes).toContain("10:00");
    expect(result.startOptions).toContainEqual({
      startTime: "11:00",
      defaultEndTime: "12:00",
      availableVehicleCount: 1,
    });
  });
});

describe("vehicle availability conflict details", () => {
  it("returns only pending or approved conflicts with the privacy-minimized fields", () => {
    const busyRanges = [
      {
        vehicleId: 1,
        reservationDate: "2026-07-16",
        startTime: "10:00",
        endTime: "12:00",
        status: "pending",
        reserverName: "홍길동",
        memberPosition: "집사",
        purpose: "교회 행사",
        reserverPhone: "010-1234-5678",
        notes: "응답에 포함되면 안 되는 메모",
      },
      {
        vehicleId: 1,
        reservationDate: "2026-07-23",
        startTime: "10:00",
        endTime: "12:00",
        status: "approved",
        reserverName: "김기쁨",
        memberPosition: null,
        purpose: "부서 이동",
      },
      {
        vehicleId: 1,
        reservationDate: "2026-07-30",
        startTime: "10:00",
        endTime: "12:00",
        status: "cancelled",
        reserverName: "취소 예약자",
        memberPosition: "권사",
        purpose: "취소된 일정",
      },
    ] as const;

    expect(buildVehicleAvailabilityConflictDetails(
      [{ id: 1, name: "스타리아" }],
      [...busyRanges],
    )).toEqual([
      {
        reservationDate: "2026-07-16",
        startTime: "10:00",
        endTime: "12:00",
        vehicleId: 1,
        vehicleName: "스타리아",
        reserverName: "홍길동",
        memberPosition: "집사",
        purpose: "교회 행사",
        status: "pending",
      },
      {
        reservationDate: "2026-07-23",
        startTime: "10:00",
        endTime: "12:00",
        vehicleId: 1,
        vehicleName: "스타리아",
        reserverName: "김기쁨",
        memberPosition: null,
        purpose: "부서 이동",
        status: "approved",
      },
    ]);
  });
});
