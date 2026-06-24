/**
 * 공지사항 DB 함수 (server/db/notice.ts)
 * ─────────────────────────────────────────────────────────────────────────────
 * 담당 기능:
 *   - getPublishedNotices: 홈페이지에 표시할 공개 공지사항 조회
 *   - getAllNotices: 관리자용 전체 공지사항 조회
 *   - createNotice / updateNotice / deleteNotice: 공지사항 CRUD
 */

import { and, desc, eq, ne, sql } from "drizzle-orm";
import { InsertNotice, notices } from "../../drizzle/schema";
import { getDb } from "./connection";

/**
 * 공개된 공지사항 목록 조회 (홈페이지용)
 * - isPublished=true인 항목만 최신순으로 반환합니다.
 */
export async function getPublishedNotices(limit = 5) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(notices)
    .where(and(eq(notices.isPublished, true), ne(notices.category, "행정자료")))
    .orderBy(desc(notices.createdAt))
    .limit(limit);
}

/**
 * 특정 분류의 공개 게시글 목록 조회
 */
export async function getPublishedNoticesByCategory(category: string, limit = 100) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(notices)
    .where(and(eq(notices.isPublished, true), eq(notices.category, category)))
    .orderBy(desc(notices.createdAt))
    .limit(limit);
}

/**
 * 전체 공지사항 목록 조회 (관리자용)
 * - 비공개 항목 포함, 최신순 정렬
 */
export async function getAllNotices() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(notices).orderBy(desc(notices.createdAt));
}

export async function incrementNoticeViewCount(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(notices)
    .set({ viewCount: sql`${notices.viewCount} + 1` })
    .where(and(eq(notices.id, id), eq(notices.isPublished, true)));
}

/**
 * 공지사항 생성
 */
export async function createNotice(data: InsertNotice) {
  const db = await getDb();
  if (!db) return;
  await db.insert(notices).values(data);
}

/**
 * 공지사항 수정
 */
export async function updateNotice(id: number, data: Partial<InsertNotice>) {
  const db = await getDb();
  if (!db) return;
  await db.update(notices).set(data).where(eq(notices.id, id));
}

/**
 * 공지사항 삭제
 */
export async function deleteNotice(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(notices).where(eq(notices.id, id));
}
