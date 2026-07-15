import mysql from "mysql2/promise";
import { normalizeLegacyMemberPhone } from "../shared/memberPhone";

const MIGRATION_ID = "0081_member_phone_normalization";

type MemberPhoneRow = {
  id: number;
  phone: string;
};

async function loadMemberPhones(connection: mysql.Connection, lockForUpdate: boolean) {
  const [rawRows] = await connection.execute(
    `SELECT id, phone
     FROM church_members
     WHERE phone IS NOT NULL AND TRIM(phone) <> ''
     ORDER BY id ASC
     ${lockForUpdate ? "FOR UPDATE" : ""}`,
  );

  return (rawRows as Array<Record<string, unknown>>).map((row) => ({
    id: Number(row.id),
    phone: String(row.phone),
  })) as MemberPhoneRow[];
}

function getNormalizationSummary(rows: MemberPhoneRow[]) {
  const normalized = rows.flatMap((row) => {
    const phone = normalizeLegacyMemberPhone(row.phone);
    return phone ? [{ ...row, normalizedPhone: phone }] : [];
  });
  const changes = normalized.filter((row) => row.phone !== row.normalizedPhone);
  const counts = new Map<string, number>();
  for (const row of normalized) {
    counts.set(row.normalizedPhone, (counts.get(row.normalizedPhone) ?? 0) + 1);
  }

  return {
    changes,
    manualReviewCount: rows.length - normalized.length,
    duplicateGroupCount: Array.from(counts.values()).filter((count) => count > 1).length,
  };
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required for migration 0081.");

  const connection = await mysql.createConnection(databaseUrl);
  try {
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
    const alreadyRecorded = Array.isArray(migrationRows) && migrationRows.length > 0;

    await connection.beginTransaction();
    try {
      const rows = await loadMemberPhones(connection, true);
      const summary = getNormalizationSummary(rows);
      console.log(
        `[deploy] migration 0081 scanned=${rows.length} normalize=${summary.changes.length} manualReview=${summary.manualReviewCount} duplicateGroups=${summary.duplicateGroupCount}`,
      );

      for (const row of summary.changes) {
        const [result] = await connection.execute(
          "UPDATE church_members SET phone = ? WHERE id = ? AND phone = ?",
          [row.normalizedPhone, row.id, row.phone],
        );
        if (Number((result as { affectedRows?: number }).affectedRows ?? 0) !== 1) {
          throw new Error(`Member phone ${row.id} changed during migration 0081.`);
        }
      }

      const postRows = await loadMemberPhones(connection, false);
      const remaining = getNormalizationSummary(postRows).changes;
      if (remaining.length > 0) {
        throw new Error(`Migration 0081 left ${remaining.length} convertible member phone rows unnormalized.`);
      }

      if (!alreadyRecorded) {
        await connection.execute("INSERT INTO app_migrations (id) VALUES (?)", [MIGRATION_ID]);
      }
      await connection.commit();
      console.log(
        alreadyRecorded
          ? "[deploy] migration 0081 already recorded; normalization invariant verified"
          : "[deploy] migration 0081 applied",
      );
    } catch (error) {
      await connection.rollback();
      throw error;
    }
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error("[deploy] migration 0081 failed", error);
  process.exitCode = 1;
});
