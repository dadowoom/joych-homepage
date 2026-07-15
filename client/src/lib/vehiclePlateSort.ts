type VehiclePlateSortable = {
  id?: number | null;
  vehicleId?: number | null;
  plateNumber?: string | null;
  name?: string | null;
  vehicleName?: string | null;
  startTime?: string | null;
};

const vehiclePlateCollator = new Intl.Collator("ko-KR", {
  numeric: true,
  sensitivity: "base",
});

function normalizePlateNumber(plateNumber?: string | null) {
  return (plateNumber ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/^(\d+[가-힣])\s*(\d+)$/, "$1 $2");
}

/** 차량번호가 있는 차량을 우선하고 전체 차량번호를 자연수 오름차순으로 비교합니다. */
export function compareVehiclePlateRows(left: VehiclePlateSortable, right: VehiclePlateSortable) {
  const leftPlate = normalizePlateNumber(left.plateNumber);
  const rightPlate = normalizePlateNumber(right.plateNumber);

  if (leftPlate && rightPlate) {
    const plateCompare = vehiclePlateCollator.compare(leftPlate, rightPlate);
    if (plateCompare !== 0) return plateCompare;
  } else if (leftPlate || rightPlate) {
    return leftPlate ? -1 : 1;
  }

  const timeCompare = (left.startTime ?? "").localeCompare(right.startTime ?? "");
  if (timeCompare !== 0) return timeCompare;

  const nameCompare = vehiclePlateCollator.compare(
    left.vehicleName ?? left.name ?? "",
    right.vehicleName ?? right.name ?? "",
  );
  if (nameCompare !== 0) return nameCompare;

  return (left.vehicleId ?? left.id ?? 0) - (right.vehicleId ?? right.id ?? 0);
}

export function sortVehiclePlateRows<T extends VehiclePlateSortable>(rows: readonly T[]) {
  return [...rows].sort(compareVehiclePlateRows);
}
