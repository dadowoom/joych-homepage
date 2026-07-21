/**
 * 공개 접수 DB 함수 (기도 요청 / 새가족 등록 문의)
 */

import { and, desc, eq, ne, or, type SQL } from "drizzle-orm";
import type { ResultSetHeader } from "mysql2";
import {
  bulletinAdRequests,
  InsertBulletinAdRequest,
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
type BulletinAdRequestStatus = "new" | "reviewed" | "completed" | "archived";

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
  const result = await db.insert(visitRequests).values(data);
  return (result as unknown as ResultSetHeader).insertId;
}

export async function listVisitRequests(limit = 100) {
  const db = await requireDb();
  return db
    .select()
    .from(visitRequests)
    .orderBy(desc(visitRequests.createdAt))
    .limit(limit);
}

export async function listPublicVisitRequests(limit = 100) {
  const db = await requireDb();
  return db
    .select({
      id: visitRequests.id,
      organizationName: visitRequests.organizationName,
      applicantName: visitRequests.applicantName,
      region: visitRequests.region,
      visitDate: visitRequests.visitDate,
      visitTime: visitRequests.visitTime,
      headcount: visitRequests.headcount,
      visitorType: visitRequests.visitorType,
      status: visitRequests.status,
      createdAt: visitRequests.createdAt,
    })
    .from(visitRequests)
    .where(ne(visitRequests.status, "archived"))
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

export async function updateVisitRequest(
  id: number,
  data: {
    organizationName: string;
    applicantName: string;
    phone: string;
    region?: string | null;
    denomination?: string | null;
    email?: string | null;
    visitDate: string;
    visitTime?: string | null;
    headcount: number;
    visitorType: "church" | "institution" | "individual" | "other";
    purpose: string;
    message?: string | null;
    status: VisitRequestStatus;
    adminMemo?: string | null;
  }
) {
  const db = await requireDb();
  await db
    .update(visitRequests)
    .set({
      organizationName: data.organizationName,
      applicantName: data.applicantName,
      phone: data.phone,
      region: data.region ?? null,
      denomination: data.denomination ?? null,
      email: data.email ?? null,
      visitDate: data.visitDate,
      visitTime: data.visitTime ?? null,
      headcount: data.headcount,
      visitorType: data.visitorType,
      purpose: data.purpose,
      message: data.message ?? null,
      status: data.status,
      adminMemo: data.adminMemo ?? null,
    })
    .where(eq(visitRequests.id, id));
}

export async function deleteVisitRequest(id: number) {
  const db = await requireDb();
  await db.delete(visitRequests).where(eq(visitRequests.id, id));
}

type VisitManageToken = { id: number; tokenHash: string };

function getVisitOwnershipCondition(
  memberId: number | null | undefined,
  manageTokenHash: string | null | undefined,
) {
  if (memberId && manageTokenHash) {
    return or(
      eq(visitRequests.memberId, memberId),
      eq(visitRequests.manageTokenHash, manageTokenHash),
    );
  }
  if (memberId) return eq(visitRequests.memberId, memberId);
  if (manageTokenHash) return eq(visitRequests.manageTokenHash, manageTokenHash);
  return null;
}

/** 로그인 계정 또는 비로그인 신청 관리키로 확인된 탐방신청만 반환합니다. */
export async function listOwnedVisitRequests(
  memberId: number | null | undefined,
  manageTokens: VisitManageToken[],
) {
  const db = await requireDb();
  const ownershipConditions: SQL[] = [];
  if (memberId) ownershipConditions.push(eq(visitRequests.memberId, memberId));
  for (const entry of manageTokens) {
    ownershipConditions.push(and(
      eq(visitRequests.id, entry.id),
      eq(visitRequests.manageTokenHash, entry.tokenHash),
    )!);
  }
  if (ownershipConditions.length === 0) return [];

  return db
    .select()
    .from(visitRequests)
    .where(and(
      ne(visitRequests.status, "archived"),
      or(...ownershipConditions),
    ))
    .orderBy(desc(visitRequests.createdAt));
}

export async function getOwnedVisitRequest(
  id: number,
  memberId: number | null | undefined,
  manageTokenHash: string | null | undefined,
) {
  const db = await requireDb();
  const ownership = getVisitOwnershipCondition(memberId, manageTokenHash);
  if (!ownership) return null;
  const rows = await db
    .select()
    .from(visitRequests)
    .where(and(
      eq(visitRequests.id, id),
      ne(visitRequests.status, "archived"),
      ownership,
    ))
    .limit(1);
  return rows[0] ?? null;
}

export async function updateOwnedVisitRequest(
  id: number,
  memberId: number | null | undefined,
  manageTokenHash: string | null | undefined,
  data: {
    organizationName: string;
    applicantName: string;
    phone: string;
    region: string;
    denomination?: string | null;
    email: string;
    visitDate: string;
    visitTime?: string | null;
    headcount: number;
    visitorType: "church" | "institution" | "individual" | "other";
    purpose: string;
    message?: string | null;
  },
) {
  const db = await requireDb();
  const ownership = getVisitOwnershipCondition(memberId, manageTokenHash);
  if (!ownership) return false;
  const result = await db
    .update(visitRequests)
    .set({
      organizationName: data.organizationName,
      applicantName: data.applicantName,
      phone: data.phone,
      region: data.region,
      denomination: data.denomination ?? null,
      email: data.email,
      visitDate: data.visitDate,
      visitTime: data.visitTime ?? null,
      headcount: data.headcount,
      visitorType: data.visitorType,
      purpose: data.purpose,
      message: data.message ?? null,
      status: "new",
      adminMemo: null,
    })
    .where(and(
      eq(visitRequests.id, id),
      ne(visitRequests.status, "archived"),
      ownership,
    ));
  return (result as unknown as ResultSetHeader).affectedRows > 0;
}

export async function archiveOwnedVisitRequest(
  id: number,
  memberId: number | null | undefined,
  manageTokenHash: string | null | undefined,
) {
  const db = await requireDb();
  const ownership = getVisitOwnershipCondition(memberId, manageTokenHash);
  if (!ownership) return false;
  const result = await db
    .update(visitRequests)
    .set({ status: "archived", adminMemo: null })
    .where(and(
      eq(visitRequests.id, id),
      ne(visitRequests.status, "archived"),
      ownership,
    ));
  return (result as unknown as ResultSetHeader).affectedRows > 0;
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
      adminMemo: subtitleRequests.adminMemo,
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

export async function updateSubtitleRequest(
  id: number,
  data: {
    title: string;
    requestedDate?: string | null;
    content: string;
    status: SubtitleRequestStatus;
    adminMemo?: string | null;
  }
) {
  const db = await requireDb();
  await db
    .update(subtitleRequests)
    .set({
      title: data.title,
      requestedDate: data.requestedDate ?? null,
      content: data.content,
      status: data.status,
      adminMemo: data.adminMemo ?? null,
    })
    .where(eq(subtitleRequests.id, id));
}

export async function deleteSubtitleRequest(id: number) {
  const db = await requireDb();
  await db.delete(subtitleRequests).where(eq(subtitleRequests.id, id));
}

export async function listMemberSubtitleRequests(memberId: number) {
  const db = await requireDb();
  return db
    .select()
    .from(subtitleRequests)
    .where(and(
      eq(subtitleRequests.memberId, memberId),
      ne(subtitleRequests.status, "archived"),
    ))
    .orderBy(desc(subtitleRequests.createdAt));
}

export async function getMemberSubtitleRequest(id: number, memberId: number) {
  const db = await requireDb();
  const rows = await db
    .select()
    .from(subtitleRequests)
    .where(and(
      eq(subtitleRequests.id, id),
      eq(subtitleRequests.memberId, memberId),
      ne(subtitleRequests.status, "archived"),
    ))
    .limit(1);
  return rows[0] ?? null;
}

type OwnedRequestAttachment = {
  attachmentName: string;
  attachmentUrl: string;
  attachmentSize: number;
  attachmentMime: string;
} | null;

export async function updateMemberSubtitleRequest(
  id: number,
  memberId: number,
  data: {
    title: string;
    requestedDate?: string | null;
    content: string;
    attachment?: OwnedRequestAttachment;
  },
) {
  const db = await requireDb();
  const result = await db
    .update(subtitleRequests)
    .set({
      title: data.title,
      requestedDate: data.requestedDate ?? null,
      content: data.content,
      status: "new",
      adminMemo: null,
      ...(data.attachment !== undefined ? {
        attachmentName: data.attachment?.attachmentName ?? null,
        attachmentUrl: data.attachment?.attachmentUrl ?? null,
        attachmentSize: data.attachment?.attachmentSize ?? null,
        attachmentMime: data.attachment?.attachmentMime ?? null,
      } : {}),
    })
    .where(and(
      eq(subtitleRequests.id, id),
      eq(subtitleRequests.memberId, memberId),
      ne(subtitleRequests.status, "archived"),
    ));
  return (result as unknown as ResultSetHeader).affectedRows > 0;
}

export async function archiveMemberSubtitleRequest(id: number, memberId: number) {
  const db = await requireDb();
  const result = await db
    .update(subtitleRequests)
    .set({ status: "archived", adminMemo: null })
    .where(and(
      eq(subtitleRequests.id, id),
      eq(subtitleRequests.memberId, memberId),
      ne(subtitleRequests.status, "archived"),
    ));
  return (result as unknown as ResultSetHeader).affectedRows > 0;
}

export async function createBulletinAdRequest(data: InsertBulletinAdRequest) {
  const db = await requireDb();
  await db.insert(bulletinAdRequests).values(data);
}

export async function listPublicBulletinAdRequests(limit = 100) {
  const db = await requireDb();
  return db
    .select({
      id: bulletinAdRequests.id,
      title: bulletinAdRequests.title,
      authorName: bulletinAdRequests.authorName,
      requestedDate: bulletinAdRequests.requestedDate,
      content: bulletinAdRequests.content,
      attachmentName: bulletinAdRequests.attachmentName,
      status: bulletinAdRequests.status,
      adminMemo: bulletinAdRequests.adminMemo,
      createdAt: bulletinAdRequests.createdAt,
    })
    .from(bulletinAdRequests)
    .where(ne(bulletinAdRequests.status, "archived"))
    .orderBy(desc(bulletinAdRequests.createdAt))
    .limit(limit);
}

export async function listBulletinAdRequests(limit = 100) {
  const db = await requireDb();
  return db
    .select()
    .from(bulletinAdRequests)
    .orderBy(desc(bulletinAdRequests.createdAt))
    .limit(limit);
}

export async function updateBulletinAdRequestStatus(
  id: number,
  data: { status: BulletinAdRequestStatus; adminMemo?: string | null }
) {
  const db = await requireDb();
  await db
    .update(bulletinAdRequests)
    .set({ status: data.status, adminMemo: data.adminMemo ?? null })
    .where(eq(bulletinAdRequests.id, id));
}

export async function updateBulletinAdRequest(
  id: number,
  data: {
    title: string;
    requestedDate?: string | null;
    content: string;
    status: BulletinAdRequestStatus;
    adminMemo?: string | null;
  }
) {
  const db = await requireDb();
  await db
    .update(bulletinAdRequests)
    .set({
      title: data.title,
      requestedDate: data.requestedDate ?? null,
      content: data.content,
      status: data.status,
      adminMemo: data.adminMemo ?? null,
    })
    .where(eq(bulletinAdRequests.id, id));
}

export async function deleteBulletinAdRequest(id: number) {
  const db = await requireDb();
  await db.delete(bulletinAdRequests).where(eq(bulletinAdRequests.id, id));
}

export async function listMemberBulletinAdRequests(memberId: number) {
  const db = await requireDb();
  return db
    .select()
    .from(bulletinAdRequests)
    .where(and(
      eq(bulletinAdRequests.memberId, memberId),
      ne(bulletinAdRequests.status, "archived"),
    ))
    .orderBy(desc(bulletinAdRequests.createdAt));
}

export async function getMemberBulletinAdRequest(id: number, memberId: number) {
  const db = await requireDb();
  const rows = await db
    .select()
    .from(bulletinAdRequests)
    .where(and(
      eq(bulletinAdRequests.id, id),
      eq(bulletinAdRequests.memberId, memberId),
      ne(bulletinAdRequests.status, "archived"),
    ))
    .limit(1);
  return rows[0] ?? null;
}

export async function updateMemberBulletinAdRequest(
  id: number,
  memberId: number,
  data: {
    title: string;
    requestedDate?: string | null;
    content: string;
    attachment?: OwnedRequestAttachment;
  },
) {
  const db = await requireDb();
  const result = await db
    .update(bulletinAdRequests)
    .set({
      title: data.title,
      requestedDate: data.requestedDate ?? null,
      content: data.content,
      status: "new",
      adminMemo: null,
      ...(data.attachment !== undefined ? {
        attachmentName: data.attachment?.attachmentName ?? null,
        attachmentUrl: data.attachment?.attachmentUrl ?? null,
        attachmentSize: data.attachment?.attachmentSize ?? null,
        attachmentMime: data.attachment?.attachmentMime ?? null,
      } : {}),
    })
    .where(and(
      eq(bulletinAdRequests.id, id),
      eq(bulletinAdRequests.memberId, memberId),
      ne(bulletinAdRequests.status, "archived"),
    ));
  return (result as unknown as ResultSetHeader).affectedRows > 0;
}

export async function archiveMemberBulletinAdRequest(id: number, memberId: number) {
  const db = await requireDb();
  const result = await db
    .update(bulletinAdRequests)
    .set({ status: "archived", adminMemo: null })
    .where(and(
      eq(bulletinAdRequests.id, id),
      eq(bulletinAdRequests.memberId, memberId),
      ne(bulletinAdRequests.status, "archived"),
    ));
  return (result as unknown as ResultSetHeader).affectedRows > 0;
}
