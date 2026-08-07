import { describe, expect, it } from "vitest";
import {
  getBlockingVehicleConflicts,
  getOverlappingVehicleConflicts,
  groupVehicleAvailabilityConflicts,
  type VehicleAvailabilityConflict,
} from "./vehicleAvailabilityConflicts";

const conflicts: VehicleAvailabilityConflict[] = [
  {
    reservationDate: "2026-07-22",
    startTime: "10:00",
    endTime: "11:00",
    vehicleId: 1,
    vehicleName: "스타리아",
    reserverName: "김기쁨",
    memberPosition: "집사",
    purpose: "교회 행사",
    status: "approved",
  },
  {
    reservationDate: "2026-07-15",
    startTime: "12:00",
    endTime: "13:00",
    vehicleId: 1,
    vehicleName: "스타리아",
    reserverName: "이기쁨",
    memberPosition: null,
    purpose: "물품 운반",
    status: "pending",
  },
];

describe("getBlockingVehicleConflicts", () => {
  it("includes a later reservation that blocks the vehicle minimum-use range", () => {
    expect(getBlockingVehicleConflicts({
      conflicts,
      vehicles: [{ id: 1, slotMinutes: 60, minSlots: 2 }],
      segmentStart: "09:00",
      segmentEnd: "10:00",
      selectedStartTime: "",
    })).toEqual([conflicts[0]]);
  });

  it("uses the whole attempted range after a start time is selected", () => {
    expect(getBlockingVehicleConflicts({
      conflicts,
      vehicles: [{ id: 1, slotMinutes: 60, minSlots: 1 }],
      segmentStart: "11:00",
      segmentEnd: "13:00",
      selectedStartTime: "09:00",
    })).toEqual([conflicts[1], conflicts[0]]);
  });

  it("keeps the actual repeating reservation date and excludes unrelated conflicts", () => {
    const result = getBlockingVehicleConflicts({
      conflicts,
      vehicles: [{ id: 1, slotMinutes: 30, minSlots: 2 }],
      segmentStart: "10:00",
      segmentEnd: "10:30",
      selectedStartTime: "",
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ reservationDate: "2026-07-22", reserverName: "김기쁨" });
  });
});

describe("getOverlappingVehicleConflicts", () => {
  const partialBookingConflicts: VehicleAvailabilityConflict[] = [
    {
      reservationDate: "2026-07-19",
      startTime: "13:00",
      endTime: "18:00",
      vehicleId: 1,
      vehicleName: "은색 스타리아",
      reserverName: "이성원",
      memberPosition: "집사",
      purpose: "외부 집회",
      status: "approved",
    },
    {
      reservationDate: "2026-07-19",
      startTime: "11:00",
      endTime: "18:00",
      vehicleId: 3,
      vehicleName: "검정 스타리아",
      reserverName: "김기쁨",
      memberPosition: "집사",
      purpose: "청년부 예배",
      status: "approved",
    },
    {
      reservationDate: "2026-07-19",
      startTime: "18:00",
      endTime: "19:00",
      vehicleId: 2,
      vehicleName: "흰색 스타리아",
      reserverName: "박기쁨",
      memberPosition: null,
      purpose: "물품 운반",
      status: "pending",
    },
    {
      reservationDate: "2026-07-26",
      startTime: "13:00",
      endTime: "14:00",
      vehicleId: 2,
      vehicleName: "흰색 스타리아",
      reserverName: "최기쁨",
      memberPosition: null,
      purpose: "반복 일정",
      status: "pending",
    },
  ];

  it("returns one booked vehicle while two vehicles remain available", () => {
    const result = getOverlappingVehicleConflicts({
      conflicts: partialBookingConflicts,
      startTime: "11:00",
      endTime: "12:00",
    });

    expect(result.map((conflict) => conflict.vehicleId)).toEqual([3]);
  });

  it("returns every booked vehicle while one vehicle remains available", () => {
    const result = getOverlappingVehicleConflicts({
      conflicts: partialBookingConflicts.filter((conflict) => conflict.reservationDate === "2026-07-19"),
      startTime: "13:00",
      endTime: "14:00",
    });

    expect(result.map((conflict) => conflict.vehicleId)).toEqual([3, 1]);
  });

  it("excludes a reservation that only touches the selected range boundary", () => {
    const result = getOverlappingVehicleConflicts({
      conflicts: partialBookingConflicts,
      startTime: "17:00",
      endTime: "18:00",
    });

    expect(result).toHaveLength(2);
    expect(result.some((conflict) => conflict.startTime === "18:00")).toBe(false);
  });

  it("keeps overlapping reservations from every repeating occurrence in date order", () => {
    const result = getOverlappingVehicleConflicts({
      conflicts: partialBookingConflicts,
      startTime: "13:00",
      endTime: "14:00",
    });

    expect(result.map((conflict) => conflict.reservationDate)).toEqual([
      "2026-07-19",
      "2026-07-19",
      "2026-07-26",
    ]);
  });
});

describe("groupVehicleAvailabilityConflicts", () => {
  const baseConflict: VehicleAvailabilityConflict = {
    reservationDate: "2026-08-09",
    startTime: "11:00",
    endTime: "18:00",
    vehicleId: 1,
    vehicleName: "검정 스타리아",
    reserverName: "이성원",
    memberPosition: "집사",
    purpose: "청년부 예배 셔틀",
    status: "approved",
    recurrenceGroupId: "weekly-youth-shuttle",
    recurrenceLabel: "매주 반복 · 총 3회",
    recurrenceSequence: 1,
  };

  it("groups matching recurring Sundays and keeps their chronological order", () => {
    const groups = groupVehicleAvailabilityConflicts([
      { ...baseConflict, reservationDate: "2026-08-23", recurrenceSequence: 3 },
      { ...baseConflict, reservationDate: "2026-08-09", recurrenceSequence: 1 },
      { ...baseConflict, reservationDate: "2026-08-16", recurrenceSequence: 2 },
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({
      isRecurring: true,
      count: 3,
      startDate: "2026-08-09",
      endDate: "2026-08-23",
    });
    expect(groups[0]?.reservations.map(row => row.reservationDate)).toEqual([
      "2026-08-09",
      "2026-08-16",
      "2026-08-23",
    ]);
  });

  it("does not guess that identical legacy reservations without a group ID are recurring", () => {
    const groups = groupVehicleAvailabilityConflicts([
      { ...baseConflict, recurrenceGroupId: null, recurrenceLabel: null, recurrenceSequence: null },
      {
        ...baseConflict,
        reservationDate: "2026-08-16",
        recurrenceGroupId: null,
        recurrenceLabel: null,
        recurrenceSequence: null,
      },
    ]);

    expect(groups).toHaveLength(2);
    expect(groups.every(group => !group.isRecurring && group.count === 1)).toBe(true);
  });

  it("preserves mixed vehicle and approval details inside a recurring group", () => {
    const groups = groupVehicleAvailabilityConflicts([
      baseConflict,
      {
        ...baseConflict,
        reservationDate: "2026-08-16",
        vehicleId: 2,
        vehicleName: "흰색 스타리아",
        status: "pending",
        recurrenceSequence: 2,
      },
    ]);

    expect(groups[0]?.reservations.map(row => [row.vehicleName, row.status])).toEqual([
      ["검정 스타리아", "approved"],
      ["흰색 스타리아", "pending"],
    ]);
  });

  it("keeps a single visible occurrence marked as recurring without inventing more rows", () => {
    const groups = groupVehicleAvailabilityConflicts([baseConflict]);

    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ isRecurring: true, count: 1 });
  });
});
