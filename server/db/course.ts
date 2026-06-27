/**
 * 교육/강좌 신청 DB 함수 (server/db/course.ts)
 * ─────────────────────────────────────────────────────────────────────────────
 * 담당 기능:
 *   - 강좌 CRUD
 *   - 강좌 신청/취소/승인/거절
 *   - 관리자 신청자 명단 및 성도 본인 신청 내역 조회
 */

import { and, asc, desc, eq, or, sql } from "drizzle-orm";
import type { ResultSetHeader } from "mysql2";
import {
  churchMembers,
  Course,
  courseApplications,
  courses,
  InsertCourse,
  InsertCourseApplication,
  InsertReservation,
} from "../../drizzle/schema";
import { getDb } from "./connection";
import {
  createReservationIfAvailable,
  getReservationById,
  updateReservationDetails,
  updateReservationStatus,
} from "./facility";

export type CourseStatus = "draft" | "open" | "closed" | "cancelled" | "archived";
export type CourseApplicationStatus = "pending" | "approved" | "rejected" | "cancelled";

export class CourseApplicationConflictError extends Error {
  constructor(message = "이미 신청한 강좌입니다.") {
    super(message);
  }
}

export class CourseApplicationCapacityError extends Error {
  constructor() {
    super("정원이 마감되었습니다.");
  }
}

export class CourseApplicationLockError extends Error {
  constructor() {
    super("신청 처리 중입니다. 잠시 후 다시 시도해주세요.");
  }
}

function extractMysqlScalar(result: unknown) {
  const rows = Array.isArray(result) ? result[0] : result;
  const firstRow = Array.isArray(rows) ? rows[0] : rows;
  if (!firstRow || typeof firstRow !== "object") return null;
  return Object.values(firstRow as Record<string, unknown>)[0] ?? null;
}

function summarizeApplications(rows: { courseId: number; status: CourseApplicationStatus }[]) {
  const counts = new Map<number, {
    pendingCount: number;
    approvedCount: number;
    rejectedCount: number;
    cancelledCount: number;
    activeCount: number;
  }>();

  for (const row of rows) {
    const current = counts.get(row.courseId) ?? {
      pendingCount: 0,
      approvedCount: 0,
      rejectedCount: 0,
      cancelledCount: 0,
      activeCount: 0,
    };
    if (row.status === "pending") current.pendingCount += 1;
    if (row.status === "approved") current.approvedCount += 1;
    if (row.status === "rejected") current.rejectedCount += 1;
    if (row.status === "cancelled") current.cancelledCount += 1;
    if (row.status === "pending" || row.status === "approved") current.activeCount += 1;
    counts.set(row.courseId, current);
  }

  return counts;
}

function truncateText(value: string, maxLength: number) {
  return value.length > maxLength ? value.slice(0, maxLength) : value;
}

function hasCourseReservationSchedule(course: Pick<Course, "facilityId" | "startDate" | "startTime" | "endTime" | "status">) {
  return course.status !== "cancelled"
    && Boolean(course.facilityId && course.startDate && course.startTime && course.endTime);
}

function buildCourseReservationData(course: Pick<Course, "id" | "title" | "capacity" | "facilityId" | "startDate" | "endDate" | "startTime" | "endTime">): Omit<InsertReservation, "id" | "createdAt" | "updatedAt"> {
  if (!course.facilityId || !course.startDate || !course.startTime || !course.endTime) {
    throw new Error("강좌 시설예약을 만들려면 시설, 시작일, 시작 시간, 종료 시간이 필요합니다.");
  }

  const title = course.title || "강좌";
  const dateRange = course.endDate && course.endDate !== course.startDate
    ? ` 강좌 기간: ${course.startDate}~${course.endDate}`
    : "";

  return {
    facilityId: course.facilityId,
    userId: null,
    reservationType: "course",
    reserverName: truncateText(`[강좌] ${title}`, 64),
    reserverPhone: null,
    reservationDate: course.startDate,
    startTime: course.startTime,
    endTime: course.endTime,
    purpose: truncateText(`강좌 운영: ${title}`, 256),
    department: "강좌",
    attendees: Math.max(1, Number(course.capacity) || 1),
    notes: truncateText(`강좌관리에서 자동 생성된 시설예약입니다.${dateRange}`, 1000),
    status: "approved",
    recurrenceGroupId: null,
    recurrenceLabel: null,
    recurrenceSequence: 0,
    adminComment: null,
    processedBy: null,
    processedAt: null,
  };
}

function mergeCourseData(current: Course, data: Partial<InsertCourse>): Course {
  return {
    ...current,
    ...data,
    updatedAt: current.updatedAt,
    createdAt: current.createdAt,
  } as Course;
}

async function cancelLinkedCourseReservation(reservationId: number | null | undefined, reason: string) {
  if (!reservationId) return;
  await updateReservationStatus(reservationId, "cancelled", reason);
}

async function syncCourseFacilityReservation(current: Course | null, nextCourse: Course) {
  const currentReservationId = current?.facilityReservationId ?? null;

  if (!hasCourseReservationSchedule(nextCourse)) {
    await cancelLinkedCourseReservation(currentReservationId, "강좌 취소 또는 시설예약 연결 해제로 자동 취소되었습니다.");
    return currentReservationId;
  }

  if (currentReservationId) {
    const currentReservation = await getReservationById(currentReservationId);
    const canReuseReservation = currentReservation
      && currentReservation.status !== "cancelled"
      && currentReservation.facilityId === nextCourse.facilityId;

    if (canReuseReservation) {
      await updateReservationDetails(currentReservationId, {
        reservationDate: nextCourse.startDate ?? undefined,
        startTime: nextCourse.startTime ?? undefined,
        endTime: nextCourse.endTime ?? undefined,
        purpose: truncateText(`강좌 운영: ${nextCourse.title}`, 256),
        department: "강좌",
        attendees: Math.max(1, Number(nextCourse.capacity) || 1),
        notes: `강좌관리에서 자동 수정된 시설예약입니다.${nextCourse.endDate && nextCourse.endDate !== nextCourse.startDate ? ` 강좌 기간: ${nextCourse.startDate}~${nextCourse.endDate}` : ""}`,
      });
      return currentReservationId;
    }
  }

  const nextReservationId = await createReservationIfAvailable(buildCourseReservationData(nextCourse));
  if (currentReservationId) {
    await cancelLinkedCourseReservation(currentReservationId, "강좌 시설 변경으로 기존 시설예약이 자동 취소되었습니다.");
  }
  return nextReservationId;
}

export async function getCoursesForAdmin() {
  const db = await getDb();
  if (!db) return [];

  const courseRows = await db.select().from(courses).orderBy(asc(courses.sortOrder), desc(courses.createdAt));
  const applicationRows = await db
    .select({
      courseId: courseApplications.courseId,
      status: courseApplications.status,
    })
    .from(courseApplications);
  const counts = summarizeApplications(applicationRows);

  return courseRows.map((course) => ({
    ...course,
    ...(counts.get(course.id) ?? {
      pendingCount: 0,
      approvedCount: 0,
      rejectedCount: 0,
      cancelledCount: 0,
      activeCount: 0,
    }),
  }));
}

export async function getVisibleCourses() {
  const db = await getDb();
  if (!db) return [];

  const courseRows = await db
    .select()
    .from(courses)
    .where(eq(courses.isVisible, true))
    .orderBy(asc(courses.sortOrder), desc(courses.createdAt));
  const visibleRows = courseRows.filter(course => course.status === "open" || course.status === "closed");
  if (visibleRows.length === 0) return [];

  const applicationRows = await db
    .select({
      courseId: courseApplications.courseId,
      status: courseApplications.status,
    })
    .from(courseApplications);
  const counts = summarizeApplications(applicationRows);

  return visibleRows.map((course) => ({
    ...course,
    ...(counts.get(course.id) ?? {
      pendingCount: 0,
      approvedCount: 0,
      rejectedCount: 0,
      cancelledCount: 0,
      activeCount: 0,
    }),
  }));
}

export async function getCourseById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(courses).where(eq(courses.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function getVisibleCourseById(id: number) {
  const course = await getCourseById(id);
  if (!course || !course.isVisible || (course.status !== "open" && course.status !== "closed")) return null;
  return course;
}

export async function createCourse(data: Omit<InsertCourse, "id" | "createdAt" | "updatedAt">) {
  const db = await getDb();
  if (!db) return null;
  const [result] = await db.insert(courses).values(data).$returningId();
  const courseId = result?.id ?? null;
  if (!courseId) return null;

  const createdCourse = await getCourseById(courseId);
  if (!createdCourse) return courseId;

  let linkedReservationId: number | null | undefined = null;
  try {
    linkedReservationId = await syncCourseFacilityReservation(null, createdCourse);
    if (linkedReservationId && linkedReservationId !== createdCourse.facilityReservationId) {
      await db.update(courses).set({ facilityReservationId: linkedReservationId }).where(eq(courses.id, courseId));
    }
    return courseId;
  } catch (error) {
    await cancelLinkedCourseReservation(linkedReservationId, "강좌 등록 실패로 시설예약이 자동 취소되었습니다.");
    await db.delete(courses).where(eq(courses.id, courseId));
    throw error;
  }
}

export async function updateCourse(id: number, data: Partial<InsertCourse>) {
  const db = await getDb();
  if (!db) return;
  const current = await getCourseById(id);
  if (!current) return;

  const nextCourse = mergeCourseData(current, data);
  const reservationId = await syncCourseFacilityReservation(current, nextCourse);
  await db.update(courses)
    .set({ ...data, facilityReservationId: reservationId ?? null })
    .where(eq(courses.id, id));
}

export async function deleteCourse(id: number) {
  const db = await getDb();
  if (!db) return;
  const current = await getCourseById(id);
  await cancelLinkedCourseReservation(current?.facilityReservationId, "강좌 삭제로 시설예약이 자동 취소되었습니다.");
  await db.delete(courseApplications).where(eq(courseApplications.courseId, id));
  await db.delete(courses).where(eq(courses.id, id));
}

export async function getCourseApplications(courseId?: number) {
  const db = await getDb();
  if (!db) return [];

  const rows = await db
    .select({
      id: courseApplications.id,
      courseId: courseApplications.courseId,
      memberId: courseApplications.memberId,
      applicantName: courseApplications.applicantName,
      applicantPhone: courseApplications.applicantPhone,
      applicantEmail: courseApplications.applicantEmail,
      memo: courseApplications.memo,
      status: courseApplications.status,
      adminComment: courseApplications.adminComment,
      processedBy: courseApplications.processedBy,
      processedAt: courseApplications.processedAt,
      createdAt: courseApplications.createdAt,
      updatedAt: courseApplications.updatedAt,
      courseTitle: courses.title,
      courseStartDate: courses.startDate,
      courseEndDate: courses.endDate,
      courseStartTime: courses.startTime,
      courseEndTime: courses.endTime,
      memberName: churchMembers.name,
      memberPhone: churchMembers.phone,
      memberEmail: churchMembers.email,
      memberDepartment: churchMembers.department,
      memberPosition: churchMembers.position,
    })
    .from(courseApplications)
    .leftJoin(courses, eq(courseApplications.courseId, courses.id))
    .leftJoin(churchMembers, eq(courseApplications.memberId, churchMembers.id))
    .orderBy(desc(courseApplications.createdAt));

  if (courseId !== undefined) {
    return rows.filter(row => row.courseId === courseId);
  }
  return rows;
}

export async function getMyCourseApplications(memberId: number) {
  const db = await getDb();
  if (!db) return [];

  return db
    .select({
      id: courseApplications.id,
      courseId: courseApplications.courseId,
      memberId: courseApplications.memberId,
      applicantName: courseApplications.applicantName,
      applicantPhone: courseApplications.applicantPhone,
      applicantEmail: courseApplications.applicantEmail,
      memo: courseApplications.memo,
      status: courseApplications.status,
      adminComment: courseApplications.adminComment,
      processedBy: courseApplications.processedBy,
      processedAt: courseApplications.processedAt,
      createdAt: courseApplications.createdAt,
      updatedAt: courseApplications.updatedAt,
      courseTitle: courses.title,
      courseStartDate: courses.startDate,
      courseEndDate: courses.endDate,
      courseStartTime: courses.startTime,
      courseEndTime: courses.endTime,
      courseLocation: courses.location,
      courseInstructor: courses.instructor,
    })
    .from(courseApplications)
    .leftJoin(courses, eq(courseApplications.courseId, courses.id))
    .where(eq(courseApplications.memberId, memberId))
    .orderBy(desc(courseApplications.createdAt));
}

export async function getCourseApplicationById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(courseApplications).where(eq(courseApplications.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function createOrReopenCourseApplication(
  data: Omit<InsertCourseApplication, "id" | "status" | "adminComment" | "processedBy" | "processedAt" | "createdAt" | "updatedAt">,
) {
  const db = await getDb();
  if (!db) return null;

  const lockKey = `course:${data.courseId}`;
  return db.transaction(async (tx) => {
    const lockResult = await tx.execute(sql`SELECT GET_LOCK(${lockKey}, 5) AS locked`);
    if (Number(extractMysqlScalar(lockResult)) !== 1) {
      throw new CourseApplicationLockError();
    }

    try {
      const [course] = await tx.select().from(courses).where(eq(courses.id, data.courseId)).limit(1);
      if (!course) return null;

      const existingRows = await tx
        .select()
        .from(courseApplications)
        .where(and(
          eq(courseApplications.courseId, data.courseId),
          eq(courseApplications.memberId, data.memberId),
        ))
        .limit(1);
      const existing = existingRows[0];
      if (existing?.status === "pending") {
        throw new CourseApplicationConflictError("이미 신청 접수된 강좌입니다.");
      }
      if (existing?.status === "approved") {
        throw new CourseApplicationConflictError("이미 승인된 강좌입니다.");
      }

      const activeRows = await tx
        .select({ id: courseApplications.id })
        .from(courseApplications)
        .where(and(
          eq(courseApplications.courseId, data.courseId),
          or(
            eq(courseApplications.status, "pending"),
            eq(courseApplications.status, "approved"),
          ),
        ));
      if (course.capacity > 0 && activeRows.length >= course.capacity) {
        throw new CourseApplicationCapacityError();
      }

      if (existing) {
        await tx
          .update(courseApplications)
          .set({
            applicantName: data.applicantName,
            applicantPhone: data.applicantPhone ?? null,
            applicantEmail: data.applicantEmail ?? null,
            memo: data.memo ?? null,
            status: "pending",
            adminComment: null,
            processedBy: null,
            processedAt: null,
          })
          .where(eq(courseApplications.id, existing.id));
        return existing.id;
      }

      const [result] = await tx.insert(courseApplications).values({
        ...data,
        applicantPhone: data.applicantPhone ?? null,
        applicantEmail: data.applicantEmail ?? null,
        memo: data.memo ?? null,
        status: "pending",
      });
      return (result as ResultSetHeader).insertId;
    } finally {
      await tx.execute(sql`SELECT RELEASE_LOCK(${lockKey})`);
    }
  });
}

export async function updateCourseApplicationStatus(
  id: number,
  status: CourseApplicationStatus,
  adminComment?: string,
  adminUserId?: number,
) {
  const db = await getDb();
  if (!db) return;
  const values: Partial<InsertCourseApplication> = {
    status,
    adminComment: adminComment ?? null,
  };
  if (adminUserId !== undefined) {
    values.processedBy = adminUserId;
    values.processedAt = new Date();
  }
  await db.update(courseApplications).set(values).where(eq(courseApplications.id, id));
}

export async function cancelMyCourseApplication(id: number, memberId: number) {
  const db = await getDb();
  if (!db) return false;
  const [result] = await db
    .update(courseApplications)
    .set({ status: "cancelled", adminComment: null })
    .where(and(
      eq(courseApplications.id, id),
      eq(courseApplications.memberId, memberId),
      eq(courseApplications.status, "pending"),
    ));
  return ((result as ResultSetHeader | undefined)?.affectedRows ?? 0) > 0;
}
