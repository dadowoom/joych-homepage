import { describe, expect, it } from "vitest";
import {
  findLegacyVehicleReservationCandidates,
  LEGACY_VEHICLE_RESERVATION_WINDOW,
  type LegacyVehicleReservationRow,
} from "./legacyVehicleReservationBackfill";

const createdAtEpoch = LEGACY_VEHICLE_RESERVATION_WINDOW.startEpochSeconds + 60;
const base: Omit<LegacyVehicleReservationRow, "id" | "reservationDate"> = {
  vehicleId: 1,
  userId: 7,
  reserverName: "신청자",
  reserverPhone: "010-0000-0000",
  startTime: "09:00",
  endTime: "11:00",
  purpose: "교회 행사",
  department: "행정부",
  passengers: 4,
  notes: "왕복",
  createdAtEpoch,
  recurrenceGroupId: null,
};

describe("legacy vehicle reservation recurrence backfill", () => {
  it("detects exact daily and weekly legacy batches", () => {
    const candidates = findLegacyVehicleReservationCandidates([
      { ...base, id: 10, reservationDate: "2026-07-20" },
      { ...base, id: 11, createdAtEpoch: createdAtEpoch + 1, reservationDate: "2026-07-21" },
      { ...base, id: 12, createdAtEpoch: createdAtEpoch + 2, reservationDate: "2026-07-22" },
      { ...base, id: 20, createdAtEpoch: createdAtEpoch + 1, reservationDate: "2026-07-25" },
      { ...base, id: 21, createdAtEpoch: createdAtEpoch + 1, reservationDate: "2026-08-01" },
    ]);

    expect(candidates).toHaveLength(2);
    expect(candidates[0]).toMatchObject({
      groupId: "vehicle_legacy_10",
      mode: "daily",
      label: "기존 매일 반복 · 마지막 일정 2026-07-22 · 총 3회",
    });
    expect(candidates[0]?.rows.map((row) => [row.id, row.sequence])).toEqual([[10, 1], [11, 2], [12, 3]]);
    expect(candidates[1]).toMatchObject({ groupId: "vehicle_legacy_20", mode: "weekly" });
  });

  it("detects the legacy monthly rule including months without the selected day", () => {
    const [candidate] = findLegacyVehicleReservationCandidates([
      { ...base, id: 30, reservationDate: "2026-01-31" },
      { ...base, id: 31, reservationDate: "2026-03-31" },
      { ...base, id: 32, reservationDate: "2026-05-31" },
    ]);

    expect(candidate).toMatchObject({
      groupId: "vehicle_legacy_30",
      mode: "monthly",
      label: "기존 매월 반복 · 마지막 일정 2026-05-31 · 총 3회",
    });
  });

  it("allows unrelated global IDs to be interleaved inside the original batch", () => {
    const [candidate] = findLegacyVehicleReservationCandidates([
      { ...base, id: 50, reservationDate: "2026-07-20" },
      { ...base, id: 52, createdAtEpoch: createdAtEpoch + 1, reservationDate: "2026-07-27" },
    ]);

    expect(candidate?.rows.map((row) => row.id)).toEqual([50, 52]);
    expect(candidate?.mode).toBe("weekly");
  });

  it("rejects overlapping recurrence interpretations instead of guessing", () => {
    const candidates = findLegacyVehicleReservationCandidates([
      { ...base, id: 130, reservationDate: "2026-07-20" },
      { ...base, id: 131, reservationDate: "2026-07-21" },
      { ...base, id: 132, reservationDate: "2026-07-27" },
      { ...base, id: 133, reservationDate: "2026-07-28" },
    ]);

    // These rows can be read as two daily pairs or two weekly pairs. Neither
    // interpretation is safe enough for an automatic production backfill.
    expect(candidates).toEqual([]);
  });

  it("rejects duplicate-date branches instead of assigning a row arbitrarily", () => {
    const candidates = findLegacyVehicleReservationCandidates([
      { ...base, id: 140, reservationDate: "2026-07-20" },
      { ...base, id: 141, reservationDate: "2026-07-27" },
      { ...base, id: 142, reservationDate: "2026-07-27" },
    ]);

    expect(candidates).toEqual([]);
  });

  it("does not bridge multiple adjacent five-second gaps into one burst", () => {
    const candidates = findLegacyVehicleReservationCandidates([
      { ...base, id: 150, createdAtEpoch, reservationDate: "2026-07-20" },
      { ...base, id: 151, createdAtEpoch: createdAtEpoch + 5, reservationDate: "2026-07-27" },
      { ...base, id: 152, createdAtEpoch: createdAtEpoch + 10, reservationDate: "2026-08-03" },
    ]);

    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.rows.map((row) => row.id)).toEqual([150, 151]);
  });

  it("does not merge irregular, changed, distant, out-of-window, or already grouped rows", () => {
    const rows: LegacyVehicleReservationRow[] = [
      { ...base, id: 40, reservationDate: "2026-07-20" },
      { ...base, id: 41, reservationDate: "2026-07-22" },
      { ...base, id: 60, createdAtEpoch: createdAtEpoch + 2, reservationDate: "2026-07-20" },
      { ...base, id: 61, createdAtEpoch: createdAtEpoch + 2, purpose: "다른 목적", reservationDate: "2026-07-27" },
      { ...base, id: 70, createdAtEpoch: LEGACY_VEHICLE_RESERVATION_WINDOW.startEpochSeconds - 1, reservationDate: "2026-07-20" },
      { ...base, id: 71, createdAtEpoch: LEGACY_VEHICLE_RESERVATION_WINDOW.startEpochSeconds - 1, reservationDate: "2026-07-27" },
      { ...base, id: 80, createdAtEpoch: createdAtEpoch + 3, recurrenceGroupId: "vehicle_existing", reservationDate: "2026-07-20" },
      { ...base, id: 81, createdAtEpoch: createdAtEpoch + 3, recurrenceGroupId: "vehicle_existing", reservationDate: "2026-07-27" },
      { ...base, id: 90, createdAtEpoch: createdAtEpoch + 10, reservationDate: "2026-07-20" },
      { ...base, id: 91, createdAtEpoch: createdAtEpoch + 20, reservationDate: "2026-07-27" },
    ];

    expect(findLegacyVehicleReservationCandidates(rows)).toEqual([]);
  });

  it("includes both migration window boundaries and excludes rows outside them", () => {
    const atStart = findLegacyVehicleReservationCandidates([
      { ...base, id: 100, createdAtEpoch: LEGACY_VEHICLE_RESERVATION_WINDOW.startEpochSeconds, reservationDate: "2026-07-20" },
      { ...base, id: 101, createdAtEpoch: LEGACY_VEHICLE_RESERVATION_WINDOW.startEpochSeconds, reservationDate: "2026-07-27" },
    ]);
    const atEnd = findLegacyVehicleReservationCandidates([
      { ...base, id: 110, createdAtEpoch: LEGACY_VEHICLE_RESERVATION_WINDOW.endEpochSeconds, reservationDate: "2026-07-20" },
      { ...base, id: 111, createdAtEpoch: LEGACY_VEHICLE_RESERVATION_WINDOW.endEpochSeconds, reservationDate: "2026-07-27" },
    ]);
    const outside = findLegacyVehicleReservationCandidates([
      { ...base, id: 120, createdAtEpoch: LEGACY_VEHICLE_RESERVATION_WINDOW.endEpochSeconds + 1, reservationDate: "2026-07-20" },
      { ...base, id: 121, createdAtEpoch: LEGACY_VEHICLE_RESERVATION_WINDOW.endEpochSeconds + 1, reservationDate: "2026-07-27" },
    ]);

    expect(atStart).toHaveLength(1);
    expect(atEnd).toHaveLength(1);
    expect(outside).toEqual([]);
  });

  it("accepts the legacy maximum of 100 occurrences and rejects 101", () => {
    const makeRows = (count: number) => Array.from({ length: count }, (_, index) => {
      const date = new Date(Date.UTC(2026, 0, 1 + index));
      const reservationDate = date.toISOString().slice(0, 10);
      return { ...base, id: 200 + index, reservationDate };
    });

    expect(findLegacyVehicleReservationCandidates(makeRows(100))).toHaveLength(1);
    expect(findLegacyVehicleReservationCandidates(makeRows(101))).toEqual([]);
  });
});
