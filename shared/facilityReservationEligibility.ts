export type FacilityReservationEligibilityMember = {
  canReserveFacility?: boolean | number | null;
  position?: string | null;
  department?: string | null;
  district?: string | null;
  baptismType?: string | null;
  adminMemo?: string | null;
  joinPath?: string | null;
};

export function hasFacilityReservationBlockedMemberMarker(
  member: FacilityReservationEligibilityMember,
) {
  const markerText = [
    member.position,
    member.department,
    member.district,
    member.baptismType,
    member.adminMemo,
    member.joinPath,
  ].filter(Boolean).join(" ");
  return markerText.includes("타교") || markerText.includes("외부");
}

export function canMemberRequestFacilityReservation(
  member: FacilityReservationEligibilityMember,
) {
  return !hasFacilityReservationBlockedMemberMarker(member);
}

export function hasFacilityReservationRuleOverride(
  member: FacilityReservationEligibilityMember,
) {
  return Boolean(member.canReserveFacility) && canMemberRequestFacilityReservation(member);
}
