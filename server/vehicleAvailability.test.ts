import { describe, expect, it } from "vitest";
import { isVehicleCompatibleWithSchedule } from "./db/vehicle";

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
