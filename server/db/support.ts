/**
 * 공개 접수 DB 함수 (기도 요청 / 새가족 등록 문의)
 */

import { desc, eq, ne } from "drizzle-orm";
import {
  InsertNewMemberRequest,
  InsertPrayerRequest,
  InsertSubtitleRequest,
  InsertVisitRequest,
  newMemberRequests,
  prayerRequests,
  subtitleRequests,
  visitRequests,
} from "../../drizzle/schema";
import { getDb } from "./connection";

type PrayerRequestStatus = "new" | "reviewed" | "archived";
type NewMemberRequestStatus = "new" | "contacted" | "archived";
type VisitRequestStatus = "new" | "contacted" | "scheduled" | "completed" | "archived";
type SubtitleRequestStatus = "new" | "reviewed" | "completed" | "archived";

async function requireDb() {
  const db = await getDb();
  if (!db) {
    throw new Error("접수 저장을 위한 DB 연결이 설정되지 않았습니다.");
  }
  return db;
}

export async function createPrayerRequest(data: InsertPrayerRequest) {
  const db = await requireDb();
  await db.insert(prayerRequests).values(data);
}

export async function listPrayerRequests(limit = 100) {
  const db = await requireDb();
  return db
    .select()
    .from(prayerRequests)
    .orderBy(desc(prayerRequests.createdAt))
    .limit(limit);
}

export async function updatePrayerRequestStatus(
  id: number,
  data: { status: PrayerRequestStatus; adminMemo?: string | null }
) {
  const db = await requireDb();
  await db
    .update(prayerRequests)
    .set({ status: data.status, adminMemo: data.adminMemo ?? null })
    .where(eq(prayerRequests.id, id));
}

export async function createNewMemberRequest(data: InsertNewMemberRequest) {
  const db = await requireDb();
  await db.insert(newMemberRequests).values(data);
}

export async function listNewMemberRequests(limit = 100) {
  const db = await requireDb();
  return db
    .select()
    .from(newMemberRequests)
    .orderBy(desc(newMemberRequests.createdAt))
    .limit(limit);
}

export async function updateNewMemberRequestStatus(
  id: number,
  data: { status: NewMemberRequestStatus; adminMemo?: string | null }
) {
  const db = await requireDb();
  await db
    .update(newMemberRequests)
    .set({ status: data.status, adminMemo: data.adminMemo ?? null })
    .where(eq(newMemberRequests.id, id));
}

export async function createVisitRequest(data: InsertVisitRequest) {
  const db = await requireDb();
  await db.insert(visitRequests).values(data);
}

export async function listVisitRequests(limit = 100) {
  const db = await requireDb();
  return db
    .select()
    .from(visitRequests)
    .orderBy(desc(visitRequests.createdAt))
    .limit(limit);
}

export async function updateVisitRequestStatus(
  id: number,
  data: { status: VisitRequestStatus; adminMemo?: string | null }
) {
  const db = await requireDb();
  await db
    .update(visitRequests)
    .set({ status: data.status, adminMemo: data.adminMemo ?? null })
    .where(eq(visitRequests.id, id));
}

export async function createSubtitleRequest(data: InsertSubtitleRequest) {
  const db = await requireDb();
  await db.insert(subtitleRequests).values(data);
}

export async function listPublicSubtitleRequests(limit = 100) {
  const db = await requireDb();
  return db
    .select({
      id: subtitleRequests.id,
      title: subtitleRequests.title,
      authorName: subtitleRequests.authorName,
      requestedDate: subtitleRequests.requestedDate,
      content: subtitleRequests.content,
      attachmentName: subtitleRequests.attachmentName,
      status: subtitleRequests.status,
      createdAt: subtitleRequests.createdAt,
    })
    .from(subtitleRequests)
    .where(ne(subtitleRequests.status, "archived"))
    .orderBy(desc(subtitleRequests.createdAt))
    .limit(limit);
}

export async function listSubtitleRequests(limit = 100) {
  const db = await requireDb();
  return db
    .select()
    .from(subtitleRequests)
    .orderBy(desc(subtitleRequests.createdAt))
    .limit(limit);
}

export async function updateSubtitleRequestStatus(
  id: number,
  data: { status: SubtitleRequestStatus; adminMemo?: string | null }
) {
  const db = await requireDb();
  await db
    .update(subtitleRequests)
    .set({ status: data.status, adminMemo: data.adminMemo ?? null })
    .where(eq(subtitleRequests.id, id));
}
