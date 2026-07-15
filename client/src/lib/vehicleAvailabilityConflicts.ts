export type VehicleAvailabilityConflict = {
  reservationDate: string;
  startTime: string;
  endTime: string;
  vehicleId: number;
  vehicleName: string;
  reserverName: string;
  memberPosition: string | null;
  purpose: string;
  status: "pending" | "approved";
};

type VehicleMinimumUseRule = {
  id: number;
  slotMinutes: number;
  minSlots: number;
};

function parseTimeMinutes(time: string) {
  if (time === "24:00") return 24 * 60;
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

function rangesOverlap(start: number, end: number, otherStart: number, otherEnd: number) {
  return start < otherEnd && end > otherStart;
}

function sortConflicts(conflicts: VehicleAvailabilityConflict[]) {
  return [...conflicts].sort((left, right) =>
    left.reservationDate.localeCompare(right.reservationDate) ||
    left.startTime.localeCompare(right.startTime) ||
    left.vehicleName.localeCompare(right.vehicleName, "ko-KR")
  );
}

/**
 * 불가 막대에 실제로 영향을 준 예약만 찾습니다.
 * 시작 막대는 차량별 최소 사용시간, 종료 막대는 선택 시작부터 종료까지를 기준으로 봅니다.
 */
export function getBlockingVehicleConflicts({
  conflicts,
  vehicles,
  segmentStart,
  segmentEnd,
  selectedStartTime,
}: {
  conflicts: VehicleAvailabilityConflict[];
  vehicles: VehicleMinimumUseRule[];
  segmentStart: string;
  segmentEnd: string;
  selectedStartTime: string;
}) {
  const segmentStartMinutes = parseTimeMinutes(segmentStart);
  const segmentEndMinutes = parseTimeMinutes(segmentEnd);
  const selectedStartMinutes = selectedStartTime ? parseTimeMinutes(selectedStartTime) : null;
  if (segmentStartMinutes === null || segmentEndMinutes === null) return [];

  const overlapsConflict = (rangeStart: number, rangeEnd: number, conflict: VehicleAvailabilityConflict) => {
    const conflictStart = parseTimeMinutes(conflict.startTime);
    const conflictEnd = parseTimeMinutes(conflict.endTime);
    return conflictStart !== null && conflictEnd !== null &&
      rangesOverlap(rangeStart, rangeEnd, conflictStart, conflictEnd);
  };

  // 시작 시간을 고른 뒤 종료 구간이 막혔다면 선택하려던 전체 범위의 충돌을 확인합니다.
  if (
    selectedStartMinutes !== null &&
    selectedStartMinutes < segmentEndMinutes &&
    segmentStartMinutes >= selectedStartMinutes
  ) {
    return sortConflicts(conflicts.filter((conflict) =>
      overlapsConflict(selectedStartMinutes, segmentEndMinutes, conflict)
    ));
  }

  // 시작 막대는 차량마다 다른 최소 사용시간까지 봐야 바로 다음 칸의 예약도 놓치지 않습니다.
  const vehicleById = new Map(vehicles.map((vehicle) => [vehicle.id, vehicle]));
  return sortConflicts(conflicts.filter((conflict) => {
    const vehicle = vehicleById.get(conflict.vehicleId);
    if (!vehicle) return false;
    const minimumMinutes = Math.max(1, vehicle.slotMinutes) * Math.max(1, vehicle.minSlots);
    return overlapsConflict(segmentStartMinutes, segmentStartMinutes + minimumMinutes, conflict);
  }));
}
