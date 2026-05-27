/**
 * 공개 접수 DB 함수 (기도 요청 / 새가족 등록 문의)
 */

import { desc, eq } from "drizzle-orm";
import {
  InsertNewMemberRequest,
  InsertPrayerRequest,
  newMemberRequests,
  prayerRequests,
} from "../../drizzle/schema";
import { getDb } from "./connection";

type PrayerRequestStatus = "new" | "reviewed" | "archived";
type NewMemberRequestStatus = "new" | "contacted" | "archived";

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
