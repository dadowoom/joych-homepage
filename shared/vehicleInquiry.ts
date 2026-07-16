export const VEHICLE_INQUIRY_SETTING_KEYS = {
  department: "vehicle_inquiry_department",
  phone: "vehicle_inquiry_phone",
  note: "vehicle_inquiry_note",
} as const;

export type VehicleInquirySettings = {
  department: string;
  phone: string;
  note: string;
};

export const DEFAULT_VEHICLE_INQUIRY_SETTINGS: VehicleInquirySettings = {
  department: "행정실",
  phone: "054-270-1000",
  note: "예약 신청 후 담당자 승인 상태를 확인해 주세요.",
};

export function resolveVehicleInquirySettings(
  settings: Record<string, string | null | undefined> | null | undefined,
): VehicleInquirySettings {
  const read = (key: keyof VehicleInquirySettings) => {
    const value = settings?.[VEHICLE_INQUIRY_SETTING_KEYS[key]];
    if (value === null || value === undefined) return DEFAULT_VEHICLE_INQUIRY_SETTINGS[key];
    const trimmed = value.trim();
    return key === "note" ? trimmed : trimmed || DEFAULT_VEHICLE_INQUIRY_SETTINGS[key];
  };
  return {
    department: read("department"),
    phone: read("phone"),
    note: read("note"),
  };
}
