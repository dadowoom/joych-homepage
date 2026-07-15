export const LEGACY_VEHICLE_RESERVATION_WINDOW = {
  // Repeating vehicle reservations first became available with this release.
  startEpochSeconds: Math.floor(Date.parse("2026-07-13T23:39:00Z") / 1000),
  // Explicit recurrence group IDs became available after this deploy.
  endEpochSeconds: Math.floor(Date.parse("2026-07-15T07:52:27Z") / 1000),
} as const;

export type LegacyVehicleReservationRow = {
  id: number;
  vehicleId: number;
  userId: number | null;
  reserverName: string;
  reserverPhone: string | null;
  reservationDate: string;
  startTime: string;
  endTime: string;
  purpose: string;
  department: string | null;
  passengers: number;
  notes: string | null;
  createdAtEpoch: number;
  recurrenceGroupId?: string | null;
};

export type LegacyVehicleReservationCandidate = {
  groupId: string;
  label: string;
  mode: "daily" | "weekly" | "monthly";
  rows: Array<LegacyVehicleReservationRow & { sequence: number }>;
};

const DATE_KEY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MAX_LEGACY_BATCH_ROW_GAP_SECONDS = 5;

function parseDateKey(value: string) {
  const match = DATE_KEY_RE.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) return null;
  return date;
}

function formatDateKey(date: Date) {
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

function buildFixedIntervalDates(start: Date, end: Date, intervalDays: number) {
  const dates: string[] = [];
  const cursor = new Date(start);
  while (cursor <= end && dates.length <= 100) {
    dates.push(formatDateKey(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + intervalDays);
  }
  return dates;
}

function buildMonthlyDates(start: Date, end: Date) {
  const dates: string[] = [];
  const targetDay = start.getUTCDate();
  let year = start.getUTCFullYear();
  let month = start.getUTCMonth();
  const endMonthIndex = end.getUTCFullYear() * 12 + end.getUTCMonth();

  while (year * 12 + month <= endMonthIndex && dates.length <= 100) {
    const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    if (targetDay <= lastDay) {
      const candidate = new Date(Date.UTC(year, month, targetDay));
      if (candidate >= start && candidate <= end) dates.push(formatDateKey(candidate));
    }
    month += 1;
    if (month === 12) {
      month = 0;
      year += 1;
    }
  }
  return dates;
}

function sameDates(actual: readonly string[], expected: readonly string[]) {
  return actual.length === expected.length && actual.every((date, index) => date === expected[index]);
}

export function inferLegacyVehicleRepeatMode(dates: readonly string[]) {
  if (dates.length < 2 || dates.length > 100 || new Set(dates).size !== dates.length) return null;
  const parsed = dates.map(parseDateKey);
  if (parsed.some((date) => date === null)) return null;
  const start = parsed[0]!;
  const end = parsed[parsed.length - 1]!;

  if (sameDates(dates, buildFixedIntervalDates(start, end, 1))) return "daily" as const;
  if (sameDates(dates, buildFixedIntervalDates(start, end, 7))) return "weekly" as const;
  if (sameDates(dates, buildMonthlyDates(start, end))) return "monthly" as const;
  return null;
}

function getBatchFingerprint(row: LegacyVehicleReservationRow) {
  return JSON.stringify([
    row.vehicleId,
    row.userId,
    row.reserverName,
    row.reserverPhone ?? null,
    row.startTime,
    row.endTime,
    row.purpose,
    row.department ?? null,
    row.passengers,
    row.notes ?? null,
  ]);
}

function splitIntoLegacyBatchRuns(rows: readonly LegacyVehicleReservationRow[]) {
  const runs: LegacyVehicleReservationRow[][] = [];
  let currentRun: LegacyVehicleReservationRow[] = [];

  for (const row of [...rows].sort((a, b) => a.createdAtEpoch - b.createdAtEpoch || a.id - b.id)) {
    const previous = currentRun[currentRun.length - 1];
    const first = currentRun[0];
    const continuesBatch = previous
      && first
      && row.createdAtEpoch >= previous.createdAtEpoch
      && row.createdAtEpoch - first.createdAtEpoch <= MAX_LEGACY_BATCH_ROW_GAP_SECONDS;
    if (!continuesBatch && currentRun.length > 0) {
      runs.push(currentRun);
      currentRun = [];
    }
    currentRun.push(row);
  }
  if (currentRun.length > 0) runs.push(currentRun);
  return runs;
}

type RepeatMode = LegacyVehicleReservationCandidate["mode"];

function getNextRepeatDate(dateKey: string, mode: RepeatMode) {
  const date = parseDateKey(dateKey);
  if (!date) return null;

  if (mode === "daily" || mode === "weekly") {
    date.setUTCDate(date.getUTCDate() + (mode === "daily" ? 1 : 7));
    return formatDateKey(date);
  }

  const targetDay = date.getUTCDate();
  let year = date.getUTCFullYear();
  let month = date.getUTCMonth() + 1;
  while (true) {
    if (month === 12) {
      month = 0;
      year += 1;
    }
    const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    if (targetDay <= lastDay) return formatDateKey(new Date(Date.UTC(year, month, targetDay)));
    month += 1;
  }
}

type RepeatChain = {
  mode: RepeatMode;
  rows: LegacyVehicleReservationRow[];
};

/**
 * Splits one short creation burst into plausible recurrence chains for a
 * read-only production review.
 *
 * A row may only have one immediate predecessor and successor for a mode. If
 * duplicate dates create a branch, or the same row fits chains for two modes,
 * every chain touching that ambiguity is discarded instead of guessing. The
 * result is still only a candidate: legacy rows have no request/transaction ID,
 * so production updates must use a separately reviewed explicit allowlist.
 */
function findUnambiguousRepeatChains(rows: readonly LegacyVehicleReservationRow[]) {
  const validChains: RepeatChain[] = [];
  const ambiguousRowIds = new Set<number>();
  const modes: RepeatMode[] = ["daily", "weekly", "monthly"];

  for (const mode of modes) {
    const outgoing = new Map<number, number[]>();
    const incoming = new Map<number, number[]>();
    const rowById = new Map(rows.map((row) => [row.id, row]));

    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index]!;
      const nextDate = getNextRepeatDate(row.reservationDate, mode);
      if (!nextDate) continue;
      for (let nextIndex = index + 1; nextIndex < rows.length; nextIndex += 1) {
        const nextRow = rows[nextIndex]!;
        if (nextRow.reservationDate !== nextDate) continue;
        const nextIds = outgoing.get(row.id) ?? [];
        nextIds.push(nextRow.id);
        outgoing.set(row.id, nextIds);
        const previousIds = incoming.get(nextRow.id) ?? [];
        previousIds.push(row.id);
        incoming.set(nextRow.id, previousIds);
      }
    }

    const connectedIds = Array.from(new Set([
      ...Array.from(outgoing.keys()),
      ...Array.from(incoming.keys()),
    ]));
    const visited = new Set<number>();
    for (const firstId of connectedIds) {
      if (visited.has(firstId)) continue;
      const componentIds: number[] = [];
      const stack = [firstId];
      while (stack.length > 0) {
        const id = stack.pop()!;
        if (visited.has(id)) continue;
        visited.add(id);
        componentIds.push(id);
        for (const linkedId of [...(outgoing.get(id) ?? []), ...(incoming.get(id) ?? [])]) {
          if (!visited.has(linkedId)) stack.push(linkedId);
        }
      }

      const isBranched = componentIds.some((id) =>
        (outgoing.get(id)?.length ?? 0) > 1 || (incoming.get(id)?.length ?? 0) > 1
      );
      const startIds = componentIds.filter((id) => (incoming.get(id)?.length ?? 0) === 0);
      if (isBranched || startIds.length !== 1) {
        componentIds.forEach((id) => ambiguousRowIds.add(id));
        continue;
      }

      const chainRows: LegacyVehicleReservationRow[] = [];
      let currentId: number | undefined = startIds[0];
      while (currentId !== undefined) {
        const row = rowById.get(currentId);
        if (!row) break;
        chainRows.push(row);
        currentId = outgoing.get(currentId)?.[0];
      }
      if (chainRows.length !== componentIds.length || chainRows.length < 2) {
        componentIds.forEach((id) => ambiguousRowIds.add(id));
        continue;
      }
      validChains.push({ mode, rows: chainRows });
    }
  }

  const maximalChains = validChains.filter((chain, chainIndex) => {
    return !validChains.some((other, otherIndex) => {
      if (otherIndex === chainIndex || other.rows.length <= chain.rows.length) return false;
      const otherRowIds = new Set(other.rows.map((row) => row.id));
      return chain.rows.every((row) => otherRowIds.has(row.id));
    });
  });

  const membershipCount = new Map<number, number>();
  for (const chain of maximalChains) {
    for (const row of chain.rows) {
      membershipCount.set(row.id, (membershipCount.get(row.id) ?? 0) + 1);
    }
  }

  return maximalChains.filter((chain) => chain.rows.every((row) =>
    !ambiguousRowIds.has(row.id) && membershipCount.get(row.id) === 1
  ));
}

function getRepeatLabel(mode: LegacyVehicleReservationCandidate["mode"], endDate: string, count: number) {
  const modeLabel = mode === "daily" ? "매일" : mode === "weekly" ? "매주" : "매월";
  return `기존 ${modeLabel} 반복 · 마지막 일정 ${endDate} · 총 ${count}회`;
}

/**
 * Finds plausible batches produced by the legacy repeating-reservation
 * transaction. Every invariant from the old request is compared, rows must be
 * created in one short burst, and dates must exactly match a supported repeat
 * generator. Callers must not update production from these candidates alone;
 * candidate IDs and dates require an explicit read-only review first.
 */
export function findLegacyVehicleReservationCandidates(
  rows: readonly LegacyVehicleReservationRow[],
  window = LEGACY_VEHICLE_RESERVATION_WINDOW,
) {
  const batches = new Map<string, LegacyVehicleReservationRow[]>();

  for (const row of rows) {
    if (row.recurrenceGroupId) continue;
    if (
      row.createdAtEpoch < window.startEpochSeconds
      || row.createdAtEpoch > window.endEpochSeconds
    ) continue;
    const fingerprint = getBatchFingerprint(row);
    const batch = batches.get(fingerprint);
    if (batch) batch.push(row);
    else batches.set(fingerprint, [row]);
  }

  const candidates: LegacyVehicleReservationCandidate[] = [];
  for (const matchingRows of Array.from(batches.values())) {
    for (const creationBurst of splitIntoLegacyBatchRuns(matchingRows)) {
      for (const { mode, rows: ordered } of findUnambiguousRepeatChains(creationBurst)) {
        const dates = ordered.map((row) => row.reservationDate);
        if (inferLegacyVehicleRepeatMode(dates) !== mode) continue;

        candidates.push({
          groupId: `vehicle_legacy_${ordered[0]!.id}`,
          label: getRepeatLabel(mode, dates[dates.length - 1]!, ordered.length),
          mode,
          rows: ordered.map((row, index) => ({ ...row, sequence: index + 1 })),
        });
      }
    }
  }

  return candidates.sort((a, b) => a.rows[0]!.id - b.rows[0]!.id);
}
