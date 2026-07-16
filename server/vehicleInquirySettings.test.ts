import { describe, expect, it } from "vitest";
import {
  DEFAULT_VEHICLE_INQUIRY_SETTINGS,
  VEHICLE_INQUIRY_SETTING_KEYS,
  resolveVehicleInquirySettings,
} from "@shared/vehicleInquiry";

describe("vehicle inquiry settings", () => {
  it("uses the existing public contact as the default", () => {
    expect(resolveVehicleInquirySettings(undefined)).toEqual(
      DEFAULT_VEHICLE_INQUIRY_SETTINGS,
    );
  });

  it("reads all three editable site settings", () => {
    expect(
      resolveVehicleInquirySettings({
        [VEHICLE_INQUIRY_SETTING_KEYS.department]: "Transport Office",
        [VEHICLE_INQUIRY_SETTING_KEYS.phone]: "010-1234-5678",
        [VEHICLE_INQUIRY_SETTING_KEYS.note]: "Contact us before applying.",
      }),
    ).toEqual({
      department: "Transport Office",
      phone: "010-1234-5678",
      note: "Contact us before applying.",
    });
  });

  it("falls back for blank required values but permits an intentionally blank note", () => {
    const resolved = resolveVehicleInquirySettings({
      [VEHICLE_INQUIRY_SETTING_KEYS.department]: "   ",
      [VEHICLE_INQUIRY_SETTING_KEYS.phone]: " ",
      [VEHICLE_INQUIRY_SETTING_KEYS.note]: "   ",
    });

    expect(resolved.department).toBe(DEFAULT_VEHICLE_INQUIRY_SETTINGS.department);
    expect(resolved.phone).toBe(DEFAULT_VEHICLE_INQUIRY_SETTINGS.phone);
    expect(resolved.note).toBe("");
  });
});
