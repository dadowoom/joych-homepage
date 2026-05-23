/**
 * 팝업/공지 배너 DB 함수 (server/db/popup.ts)
 * ─────────────────────────────────────────────────────────────────────────────
 * 담당 기능:
 *   - getActiveNoticePopups: 공개 화면에 노출할 활성 팝업 조회
 *   - getAllNoticePopups: 관리자용 전체 팝업 조회
 *   - create/update/delete: 관리자 팝업 CRUD
 */

import { and, desc, eq, gte, isNull, lte, or } from "drizzle-orm";
import { InsertNoticePopup, noticePopups } from "../../drizzle/schema";
import { getDb } from "./connection";

/**
 * 현재 시각 기준 노출 가능한 팝업 목록 조회
 * - isActive=true
 * - audience=all (성도/방문자 개별 노출은 프론트 연결 시 별도 절차에서 확장)
 * - startAt이 없거나 현재보다 과거
 * - endAt이 없거나 현재보다 미래
 * - priority 높은 순, 최신순
 */
export async function getActiveNoticePopups(limit = 3, now = new Date()) {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(noticePopups)
    .where(
      and(
        eq(noticePopups.isActive, true),
        eq(noticePopups.audience, "all"),
        or(isNull(noticePopups.startAt), lte(noticePopups.startAt, now)),
        or(isNull(noticePopups.endAt), gte(noticePopups.endAt, now))
      )
    )
    .orderBy(desc(noticePopups.priority), desc(noticePopups.createdAt))
    .limit(limit);
}

/**
 * 전체 팝업 목록 조회 (관리자용)
 */
export async function getAllNoticePopups() {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(noticePopups)
    .orderBy(desc(noticePopups.priority), desc(noticePopups.createdAt));
}

/**
 * 팝업 생성
 */
export async function createNoticePopup(data: InsertNoticePopup) {
  const db = await getDb();
  if (!db) return;
  await db.insert(noticePopups).values(data);
}

/**
 * 팝업 수정
 */
export async function updateNoticePopup(id: number, data: Partial<InsertNoticePopup>) {
  const db = await getDb();
  if (!db) return;
  await db.update(noticePopups).set(data).where(eq(noticePopups.id, id));
}

/**
 * 팝업 삭제
 */
export async function deleteNoticePopup(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(noticePopups).where(eq(noticePopups.id, id));
}
