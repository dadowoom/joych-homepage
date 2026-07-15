import mysql from "mysql2/promise";
import { createHash } from "node:crypto";
import {
  findLegacyVehicleReservationCandidates,
  LEGACY_VEHICLE_RESERVATION_WINDOW,
  type LegacyVehicleReservationRow,
} from "../server/legacyVehicleReservationBackfill";

const MIGRATION_ID = "0080_legacy_vehicle_reservation_recurrence";

type ReviewedLegacyVehicleReservationGroup = {
  ids: number[];
  dates: string[];
  mode: "daily" | "weekly" | "monthly";
};

function buildReviewedIdRange(firstId: number, count: number) {
  return Array.from({ length: count }, (_, index) => firstId + index);
}

function buildReviewedDateRange(startDate: string, count: number, intervalDays: number) {
  const [year, month, day] = startDate.split("-").map(Number);
  const start = new Date(Date.UTC(year!, month! - 1, day!));
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + index * intervalDays);
    return date.toISOString().slice(0, 10);
  });
}

/**
 * Confirmed from the read-only production run for commit dd34c0d. Each entry
 * matched one opaque fingerprint, one creation burst, and an exact legacy
 * repeat schedule. Rows outside these exact ID/date sets are never updated.
 */
const REVIEWED_GROUPS: ReviewedLegacyVehicleReservationGroup[] = [
  {
    ids: buildReviewedIdRange(20, 74),
    dates: buildReviewedDateRange("2026-08-02", 74, 7),
    mode: "weekly",
  },
  {
    ids: buildReviewedIdRange(96, 4),
    dates: buildReviewedDateRange("2026-07-20", 4, 1),
    mode: "daily",
  },
  {
    ids: buildReviewedIdRange(100, 2),
    dates: buildReviewedDateRange("2026-07-19", 2, 7),
    mode: "weekly",
  },
  {
    ids: buildReviewedIdRange(105, 4),
    dates: buildReviewedDateRange("2026-07-29", 4, 1),
    mode: "daily",
  },
  {
    ids: buildReviewedIdRange(109, 13),
    dates: buildReviewedDateRange("2026-09-03", 13, 7),
    mode: "weekly",
  },
  {
    ids: buildReviewedIdRange(123, 76),
    dates: buildReviewedDateRange("2026-07-19", 76, 7),
    mode: "weekly",
  },
  {
    ids: buildReviewedIdRange(200, 2),
    dates: buildReviewedDateRange("2026-07-30", 2, 1),
    mode: "daily",
  },
];

function getOpaqueFingerprint(row: LegacyVehicleReservationRow) {
  return createHash("sha256").update(JSON.stringify([
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
  ])).digest("hex").slice(0, 12);
}

async function loadLegacyRows(
  connection: mysql.Connection,
  lockForUpdate: boolean,
) {
  const [rawRows] = await connection.execute(
    `SELECT
      id,
      vehicle_id AS vehicleId,
      user_id AS userId,
      reserver_name AS reserverName,
      reserver_phone AS reserverPhone,
      reservation_date AS reservationDate,
      start_time AS startTime,
      end_time AS endTime,
      purpose,
      department,
      passengers,
      notes,
      UNIX_TIMESTAMP(created_at) AS createdAtEpoch,
      recurrence_group_id AS recurrenceGroupId
    FROM vehicle_reservations
    WHERE recurrence_group_id IS NULL
      AND UNIX_TIMESTAMP(created_at) >= ?
      AND UNIX_TIMESTAMP(created_at) <= ?
    ORDER BY created_at ASC, id ASC
    ${lockForUpdate ? "FOR UPDATE" : ""}`,
    [
      LEGACY_VEHICLE_RESERVATION_WINDOW.startEpochSeconds,
      LEGACY_VEHICLE_RESERVATION_WINDOW.endEpochSeconds,
    ],
  );
  return (rawRows as Array<Record<string, unknown>>).map((row) => ({
    ...row,
    id: Number(row.id),
    vehicleId: Number(row.vehicleId),
    userId: row.userId === null ? null : Number(row.userId),
    passengers: Number(row.passengers),
    createdAtEpoch: Number(row.createdAtEpoch),
  })) as LegacyVehicleReservationRow[];
}

function logReadOnlyReview(rows: LegacyVehicleReservationRow[]) {
  const candidates = findLegacyVehicleReservationCandidates(rows);
  console.log(`[deploy] migration 0080 eligible=${JSON.stringify(rows.map((row) => ({
    id: row.id,
    date: row.reservationDate,
    createdAtEpoch: row.createdAtEpoch,
    fingerprint: getOpaqueFingerprint(row),
  })))}`);
  console.log(`[deploy] migration 0080 candidates=${candidates.length} rows=${candidates.reduce((sum, group) => sum + group.rows.length, 0)}`);
  for (const candidate of candidates) {
    console.log(`[deploy] migration 0080 candidate=${JSON.stringify({
      groupId: candidate.groupId,
      mode: candidate.mode,
      ids: candidate.rows.map((row) => row.id),
      dates: candidate.rows.map((row) => row.reservationDate),
    })}`);
  }
  return candidates;
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required for migration 0080.");

  const connection = await mysql.createConnection(databaseUrl);
  try {
    if (REVIEWED_GROUPS.length === 0) {
      const rows = await loadLegacyRows(connection, false);
      logReadOnlyReview(rows);
      console.log("[deploy] migration 0080 read-only review; no rows changed and no completion marker written");
      return;
    }

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS app_migrations (
        id varchar(100) PRIMARY KEY,
        applied_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    const [migrationRows] = await connection.execute(
      "SELECT id FROM app_migrations WHERE id = ? LIMIT 1",
      [MIGRATION_ID],
    );
    if (Array.isArray(migrationRows) && migrationRows.length > 0) {
      console.log("[deploy] migration 0080 already applied");
      return;
    }

    await connection.beginTransaction();
    try {
      const rows = await loadLegacyRows(connection, true);
      const candidates = logReadOnlyReview(rows);

      const reviewedCandidates = REVIEWED_GROUPS.map((reviewed) => {
        if (
          reviewed.ids.length < 2
          || reviewed.ids.length > 100
          || reviewed.ids.length !== reviewed.dates.length
          || new Set(reviewed.ids).size !== reviewed.ids.length
        ) {
          throw new Error("Migration 0080 contains an invalid reviewed group.");
        }
        const candidate = candidates.find((item) =>
          item.mode === reviewed.mode
          && item.rows.length === reviewed.ids.length
          && item.rows.every((row, index) =>
            row.id === reviewed.ids[index]
            && row.reservationDate === reviewed.dates[index]
          )
        );
        if (!candidate) {
          throw new Error(`Migration 0080 reviewed group no longer matches production rows: ${reviewed.ids.join(",")}`);
        }
        return candidate;
      });
      const reviewedIds = reviewedCandidates.flatMap((candidate) => candidate.rows.map((row) => row.id));
      if (new Set(reviewedIds).size !== reviewedIds.length) {
        throw new Error("Migration 0080 reviewed groups contain duplicate reservation IDs.");
      }

      for (const candidate of reviewedCandidates) {
        for (const row of candidate.rows) {
          const [result] = await connection.execute(
            `UPDATE vehicle_reservations
             SET recurrence_group_id = ?, recurrence_label = ?, recurrence_sequence = ?
             WHERE id = ? AND recurrence_group_id IS NULL`,
            [candidate.groupId, candidate.label, row.sequence, row.id],
          );
          if (Number((result as { affectedRows?: number }).affectedRows ?? 0) !== 1) {
            throw new Error(`Legacy vehicle reservation ${row.id} changed during migration.`);
          }
        }
      }
      await connection.execute("INSERT INTO app_migrations (id) VALUES (?)", [MIGRATION_ID]);
      await connection.commit();
      console.log("[deploy] migration 0080 applied");
    } catch (error) {
      await connection.rollback();
      throw error;
    }
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error("[deploy] migration 0080 failed", error);
  process.exitCode = 1;
});
