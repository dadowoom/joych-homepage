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
  courseApplications,
  courses,
  InsertCourse,
  InsertCourseApplication,
} from "../../drizzle/schema";
import { getDb } from "./connection";

export type CourseStatus = "draft" | "open" | "closed" | "archived";
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
  return result?.id ?? null;
}

export async function updateCourse(id: number, data: Partial<InsertCourse>) {
  const db = await getDb();
  if (!db) return;
  await db.update(courses).set(data).where(eq(courses.id, id));
}

export async function deleteCourse(id: number) {
  const db = await getDb();
  if (!db) return;
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
