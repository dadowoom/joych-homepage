/**
 * 섬기는 분 / 교역자 DB 함수
 * ─────────────────────────────────────────────────────────────────────────────
 * 관리자에서 등록한 목회자·교역자 정보를 홈페이지에 노출합니다.
 */

import { and, asc, eq, sql } from "drizzle-orm";
import { churchStaff, type InsertChurchStaff } from "../../drizzle/schema";
import { getDb } from "./connection";

export type StaffCategory = "senior" | "associate" | "education" | "office" | "elder" | "other";

export async function getVisibleStaffMembers(category?: StaffCategory) {
  const db = await getDb();
  if (!db) return [];

  const visibleOnly = sql`${churchStaff.isVisible} = 1`;
  const where = category
    ? and(visibleOnly, eq(churchStaff.category, category))
    : visibleOnly;

  try {
    return await db.select().from(churchStaff)
      .where(where)
      .orderBy(asc(churchStaff.category), asc(churchStaff.sortOrder), asc(churchStaff.id));
  } catch (error) {
    const cause = error instanceof Error && "cause" in error ? error.cause : undefined;
    console.error("[Staff] Failed to fetch visible staff members", {
      message: error instanceof Error ? error.message : String(error),
      cause: cause instanceof Error ? cause.message : cause,
    });
    throw error;
  }
}

export async function getAllStaffMembers() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(churchStaff)
    .orderBy(asc(churchStaff.category), asc(churchStaff.sortOrder), asc(churchStaff.id));
}

export async function createStaffMember(data: InsertChurchStaff) {
  const db = await getDb();
  if (!db) return;
  await db.insert(churchStaff).values(data);
}

export async function updateStaffMember(id: number, data: Partial<InsertChurchStaff>) {
  const db = await getDb();
  if (!db) return;
  await db.update(churchStaff).set(data).where(eq(churchStaff.id, id));
}

export async function deleteStaffMember(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(churchStaff).where(eq(churchStaff.id, id));
}
