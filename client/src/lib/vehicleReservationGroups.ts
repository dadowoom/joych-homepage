export type VehicleReservationGroupable = {
  id: number;
  reservationDate: string;
  startTime: string;
  endTime: string;
  recurrenceGroupId?: string | null;
  recurrenceLabel?: string | null;
  recurrenceSequence?: number | null;
  createdAt?: Date | string | null;
};

export type VehicleReservationGroup<T extends VehicleReservationGroupable> = {
  key: string;
  groupId: string | null;
  recurrenceLabel: string | null;
  isRecurring: boolean;
  count: number;
  first: T;
  reservations: T[];
  startDate: string;
  endDate: string;
};

function getCreatedAtTimestamp(value: Date | string | null | undefined) {
  if (!value) return 0;
  const date = value instanceof Date ? value : new Date(value);
  const timestamp = date.getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function compareOccurrences<T extends VehicleReservationGroupable>(a: T, b: T) {
  const dateCompare = a.reservationDate.localeCompare(b.reservationDate);
  if (dateCompare !== 0) return dateCompare;

  const sequenceCompare = (a.recurrenceSequence ?? 0) - (b.recurrenceSequence ?? 0);
  if (sequenceCompare !== 0) return sequenceCompare;

  const startCompare = a.startTime.localeCompare(b.startTime);
  if (startCompare !== 0) return startCompare;

  return a.id - b.id;
}

/**
 * 반복 차량예약은 신청 당시 생성된 recurrenceGroupId로만 묶습니다.
 * 비슷한 날짜나 신청자 정보를 추측해서 단건 예약을 합치지 않습니다.
 */
export function groupVehicleReservations<T extends VehicleReservationGroupable>(
  rows: readonly T[],
): VehicleReservationGroup<T>[] {
  const groupedRows = new Map<string, T[]>();

  for (const row of rows) {
    const key = row.recurrenceGroupId ? `group:${row.recurrenceGroupId}` : `single:${row.id}`;
    const group = groupedRows.get(key);
    if (group) group.push(row);
    else groupedRows.set(key, [row]);
  }

  return Array.from(groupedRows.entries())
    .map(([key, groupRows]) => {
      const reservations = [...groupRows].sort(compareOccurrences);
      const first = reservations[0]!;
      const last = reservations[reservations.length - 1]!;
      const groupId = first.recurrenceGroupId ?? null;

      return {
        key,
        groupId,
        recurrenceLabel:
          reservations.find((reservation) => reservation.recurrenceLabel)?.recurrenceLabel ?? null,
        isRecurring: Boolean(groupId),
        count: reservations.length,
        first,
        reservations,
        startDate: first.reservationDate,
        endDate: last.reservationDate,
      };
    })
    .sort((a, b) => {
      const createdAtCompare =
        Math.max(...b.reservations.map((row) => getCreatedAtTimestamp(row.createdAt)))
        - Math.max(...a.reservations.map((row) => getCreatedAtTimestamp(row.createdAt)));
      if (createdAtCompare !== 0) return createdAtCompare;
      return b.startDate.localeCompare(a.startDate);
    });
}
