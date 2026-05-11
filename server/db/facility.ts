/**
 * 시설 예약 DB 함수 (server/db/facility.ts)
 * ─────────────────────────────────────────────────────────────────────────────
 * 담당 기능:
 *   - 시설 CRUD: getFacilities, getFacilityById, createFacility, updateFacility, deleteFacility
 *   - 시설 사진: getFacilityImages, addFacilityImage, deleteFacilityImage
 *   - 운영 시간: getFacilityHours, upsertFacilityHour
 *   - 차단 날짜: getBlockedDates, addBlockedDate, deleteBlockedDate
 *   - 예약 관리: getAllReservations, getMyReservations, getReservationsByDate,
 *               createReservation, updateReservationStatus, getReservationById
 */

import { eq, asc, desc, and, or, isNull } from "drizzle-orm";
import {
  facilities, facilityImages, facilityHours, facilityBlockedDates, reservations, churchMembers,
  InsertFacility, InsertFacilityImage, InsertFacilityHour, InsertFacilityBlockedDate, InsertReservation,
} from "../../drizzle/schema";
import { getDb } from "./connection";

// ─── 시설 CRUD ────────────────────────────────────────────────────────────────

/** 시설 목록 조회 */
export async function getFacilities(onlyVisible = true) {
  const db = await getDb();
  if (!db) return [];
  const query = db.select().from(facilities).orderBy(asc(facilities.sortOrder));
  if (onlyVisible) {
    return query.where(eq(facilities.isVisible, true));
  }
  return query;
}

/** 시설 단건 조회 */
export async function getFacilityById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(facilities).where(eq(facilities.id, id)).limit(1);
  return rows[0] ?? null;
}

/** 시설 생성 */
export async function createFacility(data: Omit<InsertFacility, 'id' | 'createdAt' | 'updatedAt'>) {
  const db = await getDb();
  if (!db) return null;
  const [result] = await db.insert(facilities).values(data).$returningId();
  return result?.id ?? null;
}

/** 시설 정보 수정 */
export async function updateFacility(id: number, data: Partial<InsertFacility>) {
  const db = await getDb();
  if (!db) return;
  await db.update(facilities).set(data).where(eq(facilities.id, id));
}

/** 시설 삭제 */
export async function deleteFacility(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(facilities).where(eq(facilities.id, id));
}

// ─── 시설 사진 ────────────────────────────────────────────────────────────────

/** 시설 사진 목록 조회 */
export async function getFacilityImages(facilityId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(facilityImages)
    .where(eq(facilityImages.facilityId, facilityId))
    .orderBy(asc(facilityImages.sortOrder));
}

/** 시설 사진 추가 */
export async function addFacilityImage(data: Omit<InsertFacilityImage, 'id' | 'createdAt'>) {
  const db = await getDb();
  if (!db) return null;
  const [result] = await db.insert(facilityImages).values(data).$returningId();
  return result?.id ?? null;
}

/** 시설 사진 삭제 */
export async function deleteFacilityImage(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(facilityImages).where(eq(facilityImages.id, id));
}

// ─── 운영 시간 ────────────────────────────────────────────────────────────────

/** 시설 운영 시간 조회 (요일별) */
export async function getFacilityHours(facilityId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(facilityHours)
    .where(eq(facilityHours.facilityId, facilityId))
    .orderBy(asc(facilityHours.dayOfWeek));
}

/** 시설 운영 시간 저장 (없으면 생성, 있으면 수정) */
export async function upsertFacilityHour(data: Omit<InsertFacilityHour, 'id' | 'createdAt' | 'updatedAt'>) {
  const db = await getDb();
  if (!db) return;
  await db.insert(facilityHours).values(data).onDuplicateKeyUpdate({
    set: {
      isOpen: data.isOpen,
      openTime: data.openTime,
      closeTime: data.closeTime,
      breakStart: data.breakStart ?? null,
      breakEnd: data.breakEnd ?? null,
    },
  });
}

// ─── 차단 날짜 ────────────────────────────────────────────────────────────────

/** 예약 차단 날짜 목록 조회 */
export async function getBlockedDates(facilityId?: number) {
  const db = await getDb();
  if (!db) return [];
  if (facilityId !== undefined) {
    return db.select().from(facilityBlockedDates)
      .where(or(
        eq(facilityBlockedDates.facilityId, facilityId),
        isNull(facilityBlockedDates.facilityId),
      ));
  }
  return db.select().from(facilityBlockedDates);
}

/** 예약 차단 날짜 추가 */
export async function addBlockedDate(data: Omit<InsertFacilityBlockedDate, 'id' | 'createdAt'>) {
  const db = await getDb();
  if (!db) return;
  await db.insert(facilityBlockedDates).values(data);
}

/** 예약 차단 날짜 삭제 */
export async function deleteBlockedDate(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(facilityBlockedDates).where(eq(facilityBlockedDates.id, id));
}

// ─── 예약 관리 ────────────────────────────────────────────────────────────────

/** 전체 예약 목록 조회 (관리자용) */
export async function getAllReservations(facilityId?: number) {
  const db = await getDb();
  if (!db) return [];

  // 예약 정보 + 시설 이름 + 성도 예약자 정보를 조인해서 가져옵니다.
  const rows = await db
    .select({
      id: reservations.id,
      facilityId: reservations.facilityId,
      userId: reservations.userId,
      reserverName: reservations.reserverName,
      reserverPhone: reservations.reserverPhone,
      reservationDate: reservations.reservationDate,
      startTime: reservations.startTime,
      endTime: reservations.endTime,
      status: reservations.status,
      purpose: reservations.purpose,
      department: reservations.department,
      attendees: reservations.attendees,        // ⚠️ attendeeCount가 아닌 attendees
      notes: reservations.notes,
      adminComment: reservations.adminComment,  // ⚠️ adminNotes가 아닌 adminComment
      processedBy: reservations.processedBy,
      processedAt: reservations.processedAt,
      createdAt: reservations.createdAt,
      facilityName: facilities.name,
      userName: churchMembers.name,
      userEmail: churchMembers.email,
    })
    .from(reservations)
    .leftJoin(facilities, eq(reservations.facilityId, facilities.id))
    .leftJoin(churchMembers, eq(reservations.userId, churchMembers.id))
    .orderBy(desc(reservations.createdAt));

  if (facilityId !== undefined) {
    return rows.filter(r => r.facilityId === facilityId);
  }
  return rows;
}

/** 내 예약 목록 조회 (로그인 사용자용) */
export async function getMyReservations(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      id: reservations.id,
      facilityId: reservations.facilityId,
      userId: reservations.userId,
      reserverName: reservations.reserverName,
      reserverPhone: reservations.reserverPhone,
      reservationDate: reservations.reservationDate,
      startTime: reservations.startTime,
      endTime: reservations.endTime,
      status: reservations.status,
      purpose: reservations.purpose,
      department: reservations.department,
      attendees: reservations.attendees,
      notes: reservations.notes,
      adminComment: reservations.adminComment,
      processedBy: reservations.processedBy,
      processedAt: reservations.processedAt,
      createdAt: reservations.createdAt,
      updatedAt: reservations.updatedAt,
      facilityName: facilities.name,
    })
    .from(reservations)
    .leftJoin(facilities, eq(reservations.facilityId, facilities.id))
    .where(eq(reservations.userId, userId))
    .orderBy(desc(reservations.createdAt));
}

/** 특정 날짜의 시설 예약 목록 조회 (예약 가능 시간 확인용) */
export async function getReservationsByDate(facilityId: number, date: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(reservations)
    .where(and(
      eq(reservations.facilityId, facilityId),
      eq(reservations.reservationDate, date),
    ));
}

/** 예약 생성 */
export async function createReservation(data: Omit<InsertReservation, 'id' | 'createdAt' | 'updatedAt'>) {
  const db = await getDb();
  if (!db) return null;
  const [result] = await db.insert(reservations).values(data).$returningId();
  return result?.id ?? null;
}

/**
 * 예약 상태 변경 (승인/거절/취소)
 * @param adminComment - 관리자 코멘트 (adminNotes가 아닌 adminComment 컬럼 사용)
 */
export async function updateReservationStatus(
  id: number,
  status: "pending" | "approved" | "rejected" | "cancelled",
  adminComment?: string,
  adminUserId?: number
) {
  const db = await getDb();
  if (!db) return;
  const values: Partial<InsertReservation> = {
    status,
    adminComment: adminComment ?? null,
  };
  if (adminUserId !== undefined) {
    values.processedBy = adminUserId;
    values.processedAt = new Date();
  }
  await db.update(reservations)
    .set(values)
    .where(eq(reservations.id, id));
}

/** 예약 단건 조회 */
export async function getReservationById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select({
      id: reservations.id,
      facilityId: reservations.facilityId,
      userId: reservations.userId,
      reserverName: reservations.reserverName,
      reserverPhone: reservations.reserverPhone,
      reservationDate: reservations.reservationDate,
      startTime: reservations.startTime,
      endTime: reservations.endTime,
      status: reservations.status,
      purpose: reservations.purpose,
      department: reservations.department,
      attendees: reservations.attendees,        // ⚠️ attendeeCount가 아닌 attendees
      notes: reservations.notes,
      adminComment: reservations.adminComment,  // ⚠️ adminNotes가 아닌 adminComment
      processedBy: reservations.processedBy,
      processedAt: reservations.processedAt,
      createdAt: reservations.createdAt,
      facilityName: facilities.name,
      userName: churchMembers.name,
      userEmail: churchMembers.email,
    })
    .from(reservations)
    .leftJoin(facilities, eq(reservations.facilityId, facilities.id))
    .leftJoin(churchMembers, eq(reservations.userId, churchMembers.id))
    .where(eq(reservations.id, id))
    .limit(1);
  return rows[0] ?? null;
}
