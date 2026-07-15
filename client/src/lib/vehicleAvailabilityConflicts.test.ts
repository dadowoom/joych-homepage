import { describe, expect, it } from "vitest";
import {
  getBlockingVehicleConflicts,
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
