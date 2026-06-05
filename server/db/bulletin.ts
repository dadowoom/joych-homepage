/**
 * 주보 DB 함수 (server/db/bulletin.ts)
 * ─────────────────────────────────────────────────────────────────────────────
 * 담당 기능:
 *   - 관리자 주보 파일 등록/상태 관리
 *   - 공개 주보 목록 조회
 */

import { desc, eq, ne } from "drizzle-orm";
import {
  bulletins,
  InsertBulletin,
} from "../../drizzle/schema";
import { getDb } from "./connection";

export type BulletinStatus = "published" | "hidden" | "archived";

async function requireDb() {
  const db = await getDb();
  if (!db) {
    throw new Error("주보 관리를 위한 DB 연결이 설정되지 않았습니다.");
  }
  return db;
}

export async function listPublishedBulletins(limit = 100) {
  const db = await requireDb();
  return db
    .select()
    .from(bulletins)
    .where(eq(bulletins.status, "published"))
    .orderBy(desc(bulletins.bulletinDate), desc(bulletins.createdAt))
    .limit(limit);
}

export async function listAdminBulletins(limit = 200) {
  const db = await requireDb();
  return db
    .select()
    .from(bulletins)
    .where(ne(bulletins.status, "archived"))
    .orderBy(desc(bulletins.bulletinDate), desc(bulletins.createdAt))
    .limit(limit);
}

export async function createBulletin(data: InsertBulletin) {
  const db = await requireDb();
  const [result] = await db.insert(bulletins).values(data).$returningId();
  return result?.id ?? null;
}

export async function updateBulletin(
  id: number,
  data: Partial<Pick<InsertBulletin, "title" | "bulletinDate" | "status">>
) {
  const db = await requireDb();
  await db.update(bulletins).set(data).where(eq(bulletins.id, id));
}

export async function archiveBulletin(id: number) {
  const db = await requireDb();
  await db.update(bulletins).set({ status: "archived" }).where(eq(bulletins.id, id));
}
