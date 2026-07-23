export type VehicleReservationCalendarGroup = "clergy" | "administrator";

export type VehicleReservationCalendarGroupDisplay = Readonly<{
  key: VehicleReservationCalendarGroup;
  label: "교역자" | "관리자";
  badgeClassName: string;
  swatchClassName: string;
}>;

const CLERGY_POSITION_TOKENS = ["교역자", "목사", "전도사", "강도사"] as const;

export const VEHICLE_RESERVATION_CALENDAR_GROUPS: Readonly<
  Record<VehicleReservationCalendarGroup, VehicleReservationCalendarGroupDisplay>
> = {
  clergy: {
    key: "clergy",
    label: "교역자",
    badgeClassName: "bg-violet-50 text-violet-700 ring-1 ring-violet-200",
    swatchClassName: "bg-violet-50 ring-1 ring-violet-200",
  },
  administrator: {
    key: "administrator",
    label: "관리자",
    badgeClassName: "bg-green-50 text-green-700 ring-1 ring-green-200",
    swatchClassName: "bg-green-50 ring-1 ring-green-200",
  },
};

export function resolveVehicleReservationCalendarGroup(
  memberPosition?: string | null,
): VehicleReservationCalendarGroupDisplay {
  const normalizedPosition = (memberPosition ?? "").replace(/\s+/g, "");
  const isClergy = CLERGY_POSITION_TOKENS.some(token => normalizedPosition.includes(token));
  return VEHICLE_RESERVATION_CALENDAR_GROUPS[isClergy ? "clergy" : "administrator"];
}
