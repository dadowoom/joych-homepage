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

import { eq, asc, desc, and, or, isNull, lt, gt, sql, inArray, ne, notInArray } from "drizzle-orm";
import {
  facilities, facilityImages, facilityHours, facilityBlockedDates, reservations, churchMembers,
  InsertFacility, InsertFacilityImage, InsertFacilityHour, InsertFacilityBlockedDate, InsertReservation,
} from "../../drizzle/schema";
import { getDb } from "./connection";

export class ReservationOverlapError extends Error {
  constructor(
    public readonly startTime: string,
    public readonly endTime: string,
    public readonly reservationDate?: string,
  ) {
    const datePrefix = reservationDate ? `${reservationDate} ` : "";
    super(`${datePrefix}해당 시간대(${startTime}~${endTime})에 이미 예약이 있습니다. 다른 시간을 선택해 주세요.`);
  }
}

export class ReservationLockError extends Error {
  constructor() {
    super("예약 처리 중입니다. 잠시 후 다시 시도해주세요.");
  }
}

function extractMysqlScalar(result: unknown) {
  const rows = Array.isArray(result) ? result[0] : result;
  const firstRow = Array.isArray(rows) ? rows[0] : rows;
  if (!firstRow || typeof firstRow !== "object") return null;
  return Object.values(firstRow as Record<string, unknown>)[0] ?? null;
}

// ─── 시설 CRUD ────────────────────────────────────────────────────────────────

/** 시설 목록 조회 */
export async function getFacilities(onlyVisible = true) {
  const db = await getDb();
  if (!db) return [];
  const query = db.select().from(facilities)
    .orderBy(asc(facilities.building), asc(facilities.sortOrder), asc(facilities.id));
  const rows = onlyVisible
    ? await query.where(eq(facilities.isVisible, true))
    : await query;

  const facilityIds = rows.map((facility) => facility.id);
  if (facilityIds.length === 0) {
    return rows.map((facility) => ({ ...facility, thumbnailUrl: null as string | null }));
  }

  const images = await db
    .select({
      id: facilityImages.id,
      facilityId: facilityImages.facilityId,
      imageUrl: facilityImages.imageUrl,
    })
    .from(facilityImages)
    .where(inArray(facilityImages.facilityId, facilityIds))
    .orderBy(desc(facilityImages.isThumbnail), asc(facilityImages.sortOrder), asc(facilityImages.id));
  const thumbnailByFacility = new Map<number, string>();
  for (const image of images) {
    if (!thumbnailByFacility.has(image.facilityId)) {
      thumbnailByFacility.set(image.facilityId, image.imageUrl);
    }
  }

  return rows.map((facility) => ({
    ...facility,
    thumbnailUrl: thumbnailByFacility.get(facility.id) ?? null,
  }));
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

/** 시설 순서 저장 */
export async function reorderFacilities(items: Array<{ id: number; sortOrder: number }>) {
  const db = await getDb();
  if (!db || items.length === 0) return;

  await db.transaction(async (tx) => {
    for (const item of items) {
      await tx.update(facilities)
        .set({ sortOrder: item.sortOrder })
        .where(eq(facilities.id, item.id));
    }
  });
}

/** 시설 삭제 */
export async function deleteFacility(id: number) {
  const db = await getDb();
  if (!db) return;
  const existingReservations = await db.select({ id: reservations.id }).from(reservations)
    .where(eq(reservations.facilityId, id))
    .limit(1);
  if (existingReservations.length > 0) {
    throw new Error("예약 내역이 있는 시설은 삭제할 수 없습니다. 숨김 처리로 운영 중단해 주세요.");
  }
  await db.delete(facilities).where(eq(facilities.id, id));
}

// ─── 시설 사진 ────────────────────────────────────────────────────────────────

/** 시설 사진 목록 조회 */
export async function getFacilityImages(facilityId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(facilityImages)
    .where(eq(facilityImages.facilityId, facilityId))
    .orderBy(desc(facilityImages.isThumbnail), asc(facilityImages.sortOrder), asc(facilityImages.id));
}

/** 시설 사진 추가 */
export async function addFacilityImage(data: Omit<InsertFacilityImage, 'id' | 'createdAt'>) {
  const db = await getDb();
  if (!db) return null;
  if (data.isThumbnail) {
    const result = await db.transaction(async (tx) => {
      await tx.update(facilityImages)
        .set({ isThumbnail: false })
        .where(eq(facilityImages.facilityId, data.facilityId));
      const [insertResult] = await tx.insert(facilityImages)
        .values({ ...data, isThumbnail: true })
        .$returningId();
      return insertResult;
    });
    return result?.id ?? null;
  }
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
  const rows = await db.select().from(facilityHours)
    .where(eq(facilityHours.facilityId, facilityId))
    .orderBy(asc(facilityHours.dayOfWeek), desc(facilityHours.id));
  const seen = new Set<number>();
  return rows.filter((row) => {
    if (seen.has(row.dayOfWeek)) return false;
    seen.add(row.dayOfWeek);
    return true;
  });
}

/** 시설 운영 시간 저장 (없으면 생성, 있으면 수정) */
export async function upsertFacilityHour(data: Omit<InsertFacilityHour, 'id' | 'createdAt' | 'updatedAt'>) {
  const db = await getDb();
  if (!db) return;
  await db.transaction(async (tx) => {
    await tx.delete(facilityHours).where(and(
      eq(facilityHours.facilityId, data.facilityId),
      eq(facilityHours.dayOfWeek, data.dayOfWeek),
    ));
    await tx.insert(facilityHours).values({
      ...data,
      breakStart: data.breakStart ?? null,
      breakEnd: data.breakEnd ?? null,
    });
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
      recurrenceGroupId: reservations.recurrenceGroupId,
      recurrenceLabel: reservations.recurrenceLabel,
      recurrenceSequence: reservations.recurrenceSequence,
      adminComment: reservations.adminComment,  // ⚠️ adminNotes가 아닌 adminComment
      processedBy: reservations.processedBy,
      processedAt: reservations.processedAt,
      createdAt: reservations.createdAt,
      facilityName: facilities.name,
      userName: churchMembers.name,
      userEmail: churchMembers.email,
      memberPosition: churchMembers.position,
      memberPhone: churchMembers.phone,
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
      recurrenceGroupId: reservations.recurrenceGroupId,
      recurrenceLabel: reservations.recurrenceLabel,
      recurrenceSequence: reservations.recurrenceSequence,
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

/** Admin detail rows for a facility/date, used only after a server-side permission check. */
export async function getAdminReservationDetailsByDate(facilityId: number, date: string) {
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
      facilityName: facilities.name,
      userName: churchMembers.name,
      memberPosition: churchMembers.position,
      memberPhone: churchMembers.phone,
    })
    .from(reservations)
    .leftJoin(facilities, eq(reservations.facilityId, facilities.id))
    .leftJoin(churchMembers, eq(reservations.userId, churchMembers.id))
    .where(and(
      eq(reservations.facilityId, facilityId),
      eq(reservations.reservationDate, date),
    ))
    .orderBy(asc(reservations.startTime), asc(reservations.id));
}

/** 예약 생성 */
export async function createReservation(data: Omit<InsertReservation, 'id' | 'createdAt' | 'updatedAt'>) {
  const db = await getDb();
  if (!db) return null;
  const [result] = await db.insert(reservations).values(data).$returningId();
  return result?.id ?? null;
}

/** 예약 생성: 같은 시설/날짜에 대한 동시 신청을 DB advisory lock으로 직렬화 */
export async function createReservationIfAvailable(data: Omit<InsertReservation, 'id' | 'createdAt' | 'updatedAt'>) {
  const db = await getDb();
  if (!db) return null;

  const lockKey = `reservation:${data.facilityId}:${data.reservationDate}`;

  return db.transaction(async (tx) => {
    const lockResult = await tx.execute(sql`SELECT GET_LOCK(${lockKey}, 5) AS locked`);
    if (Number(extractMysqlScalar(lockResult)) !== 1) {
      throw new ReservationLockError();
    }

    try {
      const overlapping = await tx
        .select({
          startTime: reservations.startTime,
          endTime: reservations.endTime,
        })
        .from(reservations)
        .where(and(
          eq(reservations.facilityId, data.facilityId),
          eq(reservations.reservationDate, data.reservationDate),
          or(
            eq(reservations.status, "pending"),
            eq(reservations.status, "approved"),
          ),
          lt(reservations.startTime, data.endTime),
          gt(reservations.endTime, data.startTime),
        ))
        .limit(1);

      if (overlapping[0]) {
        throw new ReservationOverlapError(overlapping[0].startTime, overlapping[0].endTime, data.reservationDate);
      }

      const [result] = await tx.insert(reservations).values(data).$returningId();
      return result?.id ?? null;
    } finally {
      await tx.execute(sql`SELECT RELEASE_LOCK(${lockKey})`);
    }
  });
}

/** 예약 생성 실패 시 같은 요청에서 생성된 예약들을 되돌립니다. */
export async function deleteReservationsByIds(ids: number[]) {
  const db = await getDb();
  if (!db || ids.length === 0) return;
  await db.delete(reservations).where(inArray(reservations.id, ids));
}

export async function deleteReservationById(id: number) {
  const db = await getDb();
  if (!db) return false;
  const existing = await db.select({ id: reservations.id }).from(reservations).where(eq(reservations.id, id)).limit(1);
  if (!existing[0]) return false;
  await db.delete(reservations).where(eq(reservations.id, id));
  return true;
}

export async function deleteReservationGroup(recurrenceGroupId: string) {
  const db = await getDb();
  if (!db) return false;
  const existing = await db
    .select({ id: reservations.id })
    .from(reservations)
    .where(eq(reservations.recurrenceGroupId, recurrenceGroupId))
    .limit(1);
  if (!existing[0]) return false;
  await db.delete(reservations).where(eq(reservations.recurrenceGroupId, recurrenceGroupId));
  return true;
}

export type ReservationDetailsUpdate = {
  reservationDate?: string;
  startTime?: string;
  endTime?: string;
  purpose?: string;
  department?: string | null;
  attendees?: number;
  notes?: string | null;
  adminComment?: string | null;
};

function nullableText(value: string | null | undefined) {
  if (value === undefined) return undefined;
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function toReservationUpdateValues(data: ReservationDetailsUpdate) {
  const values: Partial<InsertReservation> = {};
  if (data.reservationDate !== undefined) values.reservationDate = data.reservationDate;
  if (data.startTime !== undefined) values.startTime = data.startTime;
  if (data.endTime !== undefined) values.endTime = data.endTime;
  if (data.purpose !== undefined) values.purpose = data.purpose.trim();
  if (data.department !== undefined) values.department = nullableText(data.department);
  if (data.attendees !== undefined) values.attendees = data.attendees;
  if (data.notes !== undefined) values.notes = nullableText(data.notes);
  if (data.adminComment !== undefined) values.adminComment = nullableText(data.adminComment);
  return values;
}

export async function updateReservationDetails(id: number, data: ReservationDetailsUpdate) {
  const db = await getDb();
  if (!db) return false;
  const current = await db.select().from(reservations).where(eq(reservations.id, id)).limit(1);
  const reservation = current[0];
  if (!reservation) return false;

  const nextReservationDate = data.reservationDate ?? reservation.reservationDate;
  const nextStartTime = data.startTime ?? reservation.startTime;
  const nextEndTime = data.endTime ?? reservation.endTime;

  const overlapping = await db
    .select({ startTime: reservations.startTime, endTime: reservations.endTime })
    .from(reservations)
    .where(and(
      eq(reservations.facilityId, reservation.facilityId),
      eq(reservations.reservationDate, nextReservationDate),
      ne(reservations.id, id),
      or(
        eq(reservations.status, "pending"),
        eq(reservations.status, "approved"),
      ),
      lt(reservations.startTime, nextEndTime),
      gt(reservations.endTime, nextStartTime),
    ))
    .limit(1);

  if (overlapping[0]) {
    throw new ReservationOverlapError(overlapping[0].startTime, overlapping[0].endTime, nextReservationDate);
  }

  await db.update(reservations)
    .set(toReservationUpdateValues(data))
    .where(eq(reservations.id, id));
  return true;
}

export async function updateReservationGroupDetails(
  recurrenceGroupId: string,
  data: Omit<ReservationDetailsUpdate, "reservationDate">
) {
  const db = await getDb();
  if (!db) return false;
  const groupRows = await db
    .select()
    .from(reservations)
    .where(eq(reservations.recurrenceGroupId, recurrenceGroupId))
    .orderBy(asc(reservations.reservationDate), asc(reservations.startTime), asc(reservations.id));

  if (groupRows.length === 0) return false;

  const groupIds = groupRows.map(row => row.id);
  const nextStartTime = data.startTime ?? groupRows[0]!.startTime;
  const nextEndTime = data.endTime ?? groupRows[0]!.endTime;

  for (const row of groupRows) {
    const overlapping = await db
      .select({ startTime: reservations.startTime, endTime: reservations.endTime })
      .from(reservations)
      .where(and(
        eq(reservations.facilityId, row.facilityId),
        eq(reservations.reservationDate, row.reservationDate),
        notInArray(reservations.id, groupIds),
        or(
          eq(reservations.status, "pending"),
          eq(reservations.status, "approved"),
        ),
        lt(reservations.startTime, nextEndTime),
        gt(reservations.endTime, nextStartTime),
      ))
      .limit(1);

    if (overlapping[0]) {
      throw new ReservationOverlapError(overlapping[0].startTime, overlapping[0].endTime, row.reservationDate);
    }
  }

  await db.update(reservations)
    .set(toReservationUpdateValues(data))
    .where(eq(reservations.recurrenceGroupId, recurrenceGroupId));
  return true;
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

/** 반복 예약 묶음 상태 변경 (승인/거절/취소) */
export async function updateReservationGroupStatus(
  recurrenceGroupId: string,
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
    .where(eq(reservations.recurrenceGroupId, recurrenceGroupId));
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
      recurrenceGroupId: reservations.recurrenceGroupId,
      recurrenceLabel: reservations.recurrenceLabel,
      recurrenceSequence: reservations.recurrenceSequence,
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
