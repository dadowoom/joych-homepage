/**
 * 교육/강좌 신청 DB 함수 (server/db/course.ts)
 * ─────────────────────────────────────────────────────────────────────────────
 * 담당 기능:
 *   - 강좌 CRUD
 *   - 강좌 신청/취소/승인/거절
 *   - 관리자 신청자 명단 및 성도 본인 신청 내역 조회
 */

import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, inArray, or, sql } from "drizzle-orm";
import type { ResultSetHeader } from "mysql2";
import {
  COURSE_APPLICATION_CHECKLIST_DEFAULTS,
  DEFAULT_COURSE_APPLICATION_CHECKLIST_ITEMS,
  buildCourseApplicationChecklistValues,
  isLegacyCourseApplicationChecklistField,
  type CourseApplicationChecklistItem,
} from "@shared/courseApplicationChecklist";
import {
  buildCourseFacilityScheduleDates,
  describeCourseFacilitySchedule,
  parseCourseFacilityCustomDates,
  parseCourseFacilityRepeatDays,
} from "@shared/courseFacilitySchedule";
import {
  churchMembers,
  Course,
  courseApplicationChecklistItems,
  courseApplicationChecklistValues,
  courseApplications,
  courseRoomManagers,
  courses,
  InsertCourse,
  InsertCourseApplication,
  InsertCourseRoomManager,
  InsertReservation,
} from "../../drizzle/schema";
import { getDb } from "./connection";
import {
  getReservationConflictsForDates,
  getReservationById,
  getReservationsByGroupId,
  replaceReservationsIfAvailable,
} from "./facility";

export type CourseStatus = "draft" | "open" | "closed" | "cancelled" | "archived";
export type CourseApplicationStatus = "pending" | "approved" | "rejected" | "cancelled";
export type CourseAudience = "all" | "member";

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

export class CourseFacilityScheduleError extends Error {}

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

function defaultCourseApplicationChecklistItems() {
  return DEFAULT_COURSE_APPLICATION_CHECKLIST_ITEMS.map(item => ({ ...item }));
}

function groupCourseApplicationChecklistItems(
  rows: Array<{ courseId: number; itemKey: string; label: string; isActive: boolean }>,
) {
  const grouped = new Map<number, CourseApplicationChecklistItem[]>();
  rows.forEach((row) => {
    if (!row.isActive) return;
    const items = grouped.get(row.courseId) ?? [];
    items.push({ id: row.itemKey, label: row.label });
    grouped.set(row.courseId, items);
  });
  return grouped;
}

export async function getCourseApplicationChecklistItems(courseId: number) {
  const db = await getDb();
  if (!db) return defaultCourseApplicationChecklistItems();
  const rows = await db
    .select({
      courseId: courseApplicationChecklistItems.courseId,
      itemKey: courseApplicationChecklistItems.itemKey,
      label: courseApplicationChecklistItems.label,
      isActive: courseApplicationChecklistItems.isActive,
    })
    .from(courseApplicationChecklistItems)
    .where(eq(courseApplicationChecklistItems.courseId, courseId))
    .orderBy(asc(courseApplicationChecklistItems.sortOrder), asc(courseApplicationChecklistItems.id));
  return rows.length > 0
    ? rows.filter(row => row.isActive).map(row => ({ id: row.itemKey, label: row.label }))
    : defaultCourseApplicationChecklistItems();
}

export async function replaceCourseApplicationChecklistItems(
  courseId: number,
  items: CourseApplicationChecklistItem[],
) {
  const db = await getDb();
  if (!db) return false;
  return db.transaction(async (tx) => {
    // Serialise definition replacements for the same course. Without locking the
    // course row, concurrent saves can interleave soft deletes and upserts.
    const [course] = await tx
      .select({ id: courses.id })
      .from(courses)
      .where(eq(courses.id, courseId))
      .limit(1)
      .for("update");
    if (!course) return false;

    const existingRows = await tx
      .select({ id: courseApplicationChecklistItems.id, itemKey: courseApplicationChecklistItems.itemKey })
      .from(courseApplicationChecklistItems)
      .where(eq(courseApplicationChecklistItems.courseId, courseId));
    const existingByKey = new Map(existingRows.map(row => [row.itemKey, row]));
    const nextKeys = new Set(items.map(item => item.id));

    for (const row of existingRows) {
      if (!nextKeys.has(row.itemKey)) {
        await tx
          .update(courseApplicationChecklistItems)
          .set({ isActive: false })
          .where(eq(courseApplicationChecklistItems.id, row.id));
      }
    }
    for (let index = 0; index < items.length; index += 1) {
      const item = items[index];
      const existing = existingByKey.get(item.id);
      if (existing) {
        await tx
          .update(courseApplicationChecklistItems)
          .set({ label: item.label, sortOrder: index, isActive: true })
          .where(eq(courseApplicationChecklistItems.id, existing.id));
      } else {
        await tx.insert(courseApplicationChecklistItems).values({
          courseId,
          itemKey: item.id,
          label: item.label,
          sortOrder: index,
          isActive: true,
        });
      }
    }
    return true;
  });
}

function truncateText(value: string, maxLength: number) {
  return value.length > maxLength ? value.slice(0, maxLength) : value;
}

type CourseFacilityScheduleCourse = Pick<Course,
  "id" | "title" | "capacity" | "facilityId" | "startDate" | "endDate" | "startTime" | "endTime" |
  "status" | "facilityRepeatMode" | "facilityRepeatDays" | "facilityCustomDates"
>;
type CourseReservationDataInput = Pick<Course,
  "id" | "title" | "capacity" | "facilityId" | "startDate" | "endDate" | "startTime" | "endTime"
> & Partial<Pick<Course, "status" | "facilityRepeatMode" | "facilityRepeatDays" | "facilityCustomDates">>;

function hasCourseReservationSchedule(course: Pick<Course, "facilityId" | "startDate" | "startTime" | "endTime" | "status">) {
  return course.status !== "cancelled"
    && Boolean(course.facilityId && course.startDate && course.startTime && course.endTime);
}

function getCourseFacilitySchedule(course: CourseFacilityScheduleCourse) {
  return buildCourseFacilityScheduleDates({
    startDate: course.startDate,
    endDate: course.endDate,
    repeatMode: course.facilityRepeatMode,
    repeatDays: parseCourseFacilityRepeatDays(course.facilityRepeatDays),
    customDates: parseCourseFacilityCustomDates(course.facilityCustomDates),
  });
}

export function buildCourseReservationData(
  course: CourseReservationDataInput,
  reservationDate = course.startDate ?? "",
  recurrence?: { groupId: string | null; label: string | null; sequence: number },
): Omit<InsertReservation, "id" | "createdAt" | "updatedAt"> {
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
    reservationDate,
    startTime: course.startTime,
    endTime: course.endTime,
    purpose: truncateText(`강좌 운영: ${title}`, 256),
    department: "강좌",
    attendees: Math.max(1, Number(course.capacity) || 1),
    notes: truncateText(`강좌관리에서 자동 생성된 시설예약입니다.${dateRange}`, 1000),
    status: "approved",
    recurrenceGroupId: recurrence?.groupId ?? null,
    recurrenceLabel: recurrence?.label ?? null,
    recurrenceSequence: recurrence?.sequence ?? 0,
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

async function getLinkedCourseReservations(reservationId: number | null | undefined) {
  if (!reservationId) return [];
  const reservation = await getReservationById(reservationId);
  if (!reservation) return [];
  if (reservation.recurrenceGroupId) return getReservationsByGroupId(reservation.recurrenceGroupId);
  return [reservation];
}

async function cancelLinkedCourseReservation(reservationId: number | null | undefined, reason: string) {
  const linked = await getLinkedCourseReservations(reservationId);
  if (linked.length === 0) return;
  await replaceReservationsIfAvailable([], linked.map(row => row.id), reason);
}

async function syncCourseFacilityReservation(current: Course | null, nextCourse: Course) {
  const currentReservationId = current?.facilityReservationId ?? null;
  const linked = await getLinkedCourseReservations(currentReservationId);
  const linkedIds = linked.map(row => row.id);

  if (!hasCourseReservationSchedule(nextCourse)) {
    await replaceReservationsIfAvailable(
      [],
      linkedIds,
      "강좌 취소 또는 시설예약 연결 해제로 자동 취소되었습니다.",
    );
    return null;
  }

  const schedule = getCourseFacilitySchedule(nextCourse);
  if (schedule.error) throw new CourseFacilityScheduleError(schedule.error);
  const repeatMode = nextCourse.facilityRepeatMode ?? "none";
  const repeatDays = parseCourseFacilityRepeatDays(nextCourse.facilityRepeatDays);
  const customDates = parseCourseFacilityCustomDates(nextCourse.facilityCustomDates);
  const groupId = schedule.dates.length > 1 ? `course_${nextCourse.id}_${randomUUID()}` : null;
  const label = schedule.dates.length > 1
    ? describeCourseFacilitySchedule({
      startDate: nextCourse.startDate,
      endDate: nextCourse.endDate,
      repeatMode,
      repeatDays,
      customDates,
    }, schedule.dates.length)
    : null;
  const reservationData = schedule.dates.map((reservationDate, index) =>
    buildCourseReservationData(nextCourse, reservationDate, {
      groupId,
      label,
      sequence: groupId ? index + 1 : 0,
    })
  );
  const createdIds = await replaceReservationsIfAvailable(
    reservationData,
    linkedIds,
    "강좌 시설예약 일정 변경으로 기존 예약이 자동 취소되었습니다.",
  );
  if (!createdIds[0]) {
    throw new CourseFacilityScheduleError("강좌 시설예약을 저장하지 못했습니다. 잠시 후 다시 시도해주세요.");
  }
  return createdIds[0];
}

export async function getCourseFacilityScheduleConflicts(input: {
  facilityId: number;
  dates: string[];
  startTime: string;
  endTime: string;
  courseId?: number;
}) {
  const course = input.courseId ? await getCourseById(input.courseId) : null;
  const linked = await getLinkedCourseReservations(course?.facilityReservationId);
  return getReservationConflictsForDates({
    facilityId: input.facilityId,
    dates: input.dates,
    startTime: input.startTime,
    endTime: input.endTime,
    ignoreReservationIds: linked.map(row => row.id),
  });
}

export async function getCoursesForAdmin(pageHref?: string) {
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
  const checklistRows = await db
    .select({
      courseId: courseApplicationChecklistItems.courseId,
      itemKey: courseApplicationChecklistItems.itemKey,
      label: courseApplicationChecklistItems.label,
      isActive: courseApplicationChecklistItems.isActive,
    })
    .from(courseApplicationChecklistItems)
    .orderBy(
      asc(courseApplicationChecklistItems.courseId),
      asc(courseApplicationChecklistItems.sortOrder),
      asc(courseApplicationChecklistItems.id),
    );
  const checklistItemsByCourse = groupCourseApplicationChecklistItems(checklistRows);
  const configuredChecklistCourseIds = new Set(checklistRows.map(row => row.courseId));

  const normalizedHref = pageHref?.trim() || null;
  return courseRows
    .filter((course) => !normalizedHref || (course.pageHref ?? "/education/courses") === normalizedHref)
    .map((course) => ({
      ...course,
      ...(counts.get(course.id) ?? {
        pendingCount: 0,
        approvedCount: 0,
        rejectedCount: 0,
        cancelledCount: 0,
        activeCount: 0,
      }),
      applicationChecklistItems: configuredChecklistCourseIds.has(course.id)
        ? checklistItemsByCourse.get(course.id) ?? []
        : defaultCourseApplicationChecklistItems(),
    }));
}

export async function getVisibleCourses(options: { pageHref?: string | null; audience?: "guest" | "member" } = {}) {
  const db = await getDb();
  if (!db) return [];

  const courseRows = await db
    .select()
    .from(courses)
    .where(eq(courses.isVisible, true))
    .orderBy(asc(courses.sortOrder), desc(courses.createdAt));
  const normalizedHref = options.pageHref?.trim() || null;
  const visibleRows = courseRows.filter(course => {
    if (course.status !== "open" && course.status !== "closed") return false;
    if (course.audience === "member" && options.audience !== "member") return false;
    if (!normalizedHref) return true;
    return (course.pageHref ?? "/education/courses") === normalizedHref;
  });
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
  await db.transaction(async (tx) => {
    const applicationRows = await tx
      .select({ id: courseApplications.id })
      .from(courseApplications)
      .where(eq(courseApplications.courseId, id));
    if (applicationRows.length > 0) {
      await tx
        .delete(courseApplicationChecklistValues)
        .where(inArray(courseApplicationChecklistValues.applicationId, applicationRows.map(row => row.id)));
    }
    await tx.delete(courseApplications).where(eq(courseApplications.courseId, id));
    await tx.delete(courseApplicationChecklistItems).where(eq(courseApplicationChecklistItems.courseId, id));
    await tx.delete(courses).where(eq(courses.id, id));
  });
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
      customAnswers: courseApplications.customAnswers,
      feePaid: courseApplications.feePaid,
      documentsSubmitted: courseApplications.documentsSubmitted,
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
      coursePageHref: courses.pageHref,
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

  const selectedRows = courseId !== undefined
    ? rows.filter(row => row.courseId === courseId)
    : rows;
  if (selectedRows.length === 0) return [];

  const valueRows = await db
    .select({
      applicationId: courseApplicationChecklistValues.applicationId,
      itemKey: courseApplicationChecklistValues.itemKey,
      checked: courseApplicationChecklistValues.checked,
    })
    .from(courseApplicationChecklistValues)
    .where(inArray(
      courseApplicationChecklistValues.applicationId,
      selectedRows.map(row => row.id),
    ));
  const valuesByApplication = new Map<number, Record<string, boolean>>();
  valueRows.forEach((row) => {
    const values = valuesByApplication.get(row.applicationId) ?? {};
    values[row.itemKey] = Boolean(row.checked);
    valuesByApplication.set(row.applicationId, values);
  });

  return selectedRows.map(row => ({
    ...row,
    checklistValues: buildCourseApplicationChecklistValues({
      feePaid: row.feePaid,
      documentsSubmitted: row.documentsSubmitted,
      storedValues: valuesByApplication.get(row.id),
    }),
  }));
}

export async function getCourseRoomManagers() {
  const db = await getDb();
  if (!db) return [];

  return db.select({
    id: courseRoomManagers.id,
    memberId: courseRoomManagers.memberId,
    pageHref: courseRoomManagers.pageHref,
    canManage: courseRoomManagers.canManage,
    createdBy: courseRoomManagers.createdBy,
    createdAt: courseRoomManagers.createdAt,
    updatedAt: courseRoomManagers.updatedAt,
    memberName: churchMembers.name,
    memberEmail: churchMembers.email,
    memberPhone: churchMembers.phone,
    memberPosition: churchMembers.position,
    memberDepartment: churchMembers.department,
    memberDistrict: churchMembers.district,
  })
    .from(courseRoomManagers)
    .leftJoin(churchMembers, eq(courseRoomManagers.memberId, churchMembers.id))
    .where(eq(courseRoomManagers.canManage, true))
    .orderBy(asc(courseRoomManagers.pageHref), desc(courseRoomManagers.createdAt));
}

export async function hasCourseRoomManagementAccess(memberId: number, pageHref: string) {
  const db = await getDb();
  if (!db) return false;
  const [row] = await db.select({ id: courseRoomManagers.id })
    .from(courseRoomManagers)
    .where(and(
      eq(courseRoomManagers.memberId, memberId),
      eq(courseRoomManagers.pageHref, pageHref),
      eq(courseRoomManagers.canManage, true),
    ))
    .limit(1);
  return Boolean(row);
}

export async function getCourseRoomManagementPagesForMember(memberId: number) {
  const db = await getDb();
  if (!db) return [];

  const rows = await db.select({ pageHref: courseRoomManagers.pageHref })
    .from(courseRoomManagers)
    .where(and(
      eq(courseRoomManagers.memberId, memberId),
      eq(courseRoomManagers.canManage, true),
    ))
    .orderBy(asc(courseRoomManagers.pageHref));

  return rows.map(row => row.pageHref);
}

export async function createCourseRoomManager(data: InsertCourseRoomManager) {
  const db = await getDb();
  if (!db) return null;

  const [existing] = await db.select().from(courseRoomManagers)
    .where(and(
      eq(courseRoomManagers.memberId, data.memberId),
      eq(courseRoomManagers.pageHref, data.pageHref),
    ))
    .limit(1);
  if (existing) {
    await db.update(courseRoomManagers)
      .set({ canManage: true, createdBy: data.createdBy ?? null })
      .where(eq(courseRoomManagers.id, existing.id));
    return existing.id;
  }

  const [result] = await db.insert(courseRoomManagers).values(data).$returningId();
  return result?.id ?? null;
}

export async function updateCourseRoomManager(id: number, data: Partial<InsertCourseRoomManager>) {
  const db = await getDb();
  if (!db) return;
  await db.update(courseRoomManagers).set(data).where(eq(courseRoomManagers.id, id));
}

export async function deleteCourseRoomManager(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(courseRoomManagers).where(eq(courseRoomManagers.id, id));
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
      customAnswers: courseApplications.customAnswers,
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

  const guestPhone = data.memberId == null ? data.applicantPhone?.trim() : null;
  if (data.memberId == null && !guestPhone) {
    throw new CourseApplicationConflictError("비회원 신청에는 연락처가 필요합니다.");
  }

  const lockKey = `course:${data.courseId}`;
  return db.transaction(async (tx) => {
    const lockResult = await tx.execute(sql`SELECT GET_LOCK(${lockKey}, 5) AS locked`);
    if (Number(extractMysqlScalar(lockResult)) !== 1) {
      throw new CourseApplicationLockError();
    }

    try {
      const [course] = await tx.select().from(courses).where(eq(courses.id, data.courseId)).limit(1);
      if (!course) return null;

      const applicantIdentity = data.memberId != null
        ? eq(courseApplications.memberId, data.memberId)
        : eq(courseApplications.applicantPhone, guestPhone!);
      const existingRows = await tx
        .select()
        .from(courseApplications)
        .where(and(
          eq(courseApplications.courseId, data.courseId),
          applicantIdentity,
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
            customAnswers: data.customAnswers ?? null,
            status: "pending",
            adminComment: null,
            processedBy: null,
            processedAt: null,
            ...COURSE_APPLICATION_CHECKLIST_DEFAULTS,
          })
          .where(eq(courseApplications.id, existing.id));
        await tx
          .delete(courseApplicationChecklistValues)
          .where(eq(courseApplicationChecklistValues.applicationId, existing.id));
        return existing.id;
      }

      const [result] = await tx.insert(courseApplications).values({
        ...data,
        applicantPhone: data.applicantPhone ?? null,
        applicantEmail: data.applicantEmail ?? null,
        memo: data.memo ?? null,
        customAnswers: data.customAnswers ?? null,
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

export async function updateCourseApplicationChecklist(
  id: number,
  field: string,
  checked: boolean,
) {
  const db = await getDb();
  if (!db) return false;
  return db.transaction(async (tx) => {
    const [application] = await tx
      .select({ id: courseApplications.id, courseId: courseApplications.courseId })
      .from(courseApplications)
      .where(eq(courseApplications.id, id))
      .limit(1);
    if (!application) return false;

    const configuredItems = await tx
      .select({
        itemKey: courseApplicationChecklistItems.itemKey,
        isActive: courseApplicationChecklistItems.isActive,
      })
      .from(courseApplicationChecklistItems)
      .where(eq(courseApplicationChecklistItems.courseId, application.courseId));
    const allowedKeys = new Set(
      configuredItems.length > 0
        ? configuredItems.filter(item => item.isActive).map(item => item.itemKey)
        : DEFAULT_COURSE_APPLICATION_CHECKLIST_ITEMS.map(item => item.id),
    );
    if (!allowedKeys.has(field)) return false;

    await tx
      .insert(courseApplicationChecklistValues)
      .values({ applicationId: id, itemKey: field, checked })
      .onDuplicateKeyUpdate({ set: { checked } });

    if (isLegacyCourseApplicationChecklistField(field)) {
      await tx
        .update(courseApplications)
        .set(field === "feePaid" ? { feePaid: checked } : { documentsSubmitted: checked })
        .where(eq(courseApplications.id, id));
    }
    return true;
  });
}

export async function updateCourseApplicationDetails(
  id: number,
  data: Pick<InsertCourseApplication, "applicantName" | "applicantPhone" | "applicantEmail" | "memo">,
) {
  const db = await getDb();
  if (!db) return;
  await db.update(courseApplications).set({
    applicantName: data.applicantName,
    applicantPhone: data.applicantPhone ?? null,
    applicantEmail: data.applicantEmail ?? null,
    memo: data.memo ?? null,
  }).where(eq(courseApplications.id, id));
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
