/**
 * 강좌방 담당자 전용 관리 라우터.
 * 전체 강좌 관리 권한자는 모든 강좌방을, 지정 담당자는 부여된 강좌방만 관리합니다.
 */
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { hasAdminContentPermission } from "../db/adminPermissions";
import {
  assertCourseCustomScheduleAccess,
  canUseCourseCustomSchedule,
} from "../courseCustomScheduleAccess";
import { getCourseFacilityReservationRestriction } from "../../shared/courseFacilityReservationPolicy";
import {
  COURSE_FACILITY_REPEAT_MODES,
  buildCourseFacilityScheduleDates,
  parseCourseFacilityCustomDates,
  parseCourseFacilityRepeatDays,
  serializeCourseFacilityCustomDates,
  serializeCourseFacilityRepeatDays,
} from "../../shared/courseFacilitySchedule";
import {
  createCourse,
  deleteCourse,
  getCourseApplicationById,
  getCourseApplications,
  getCourseById,
  getCourseFacilityScheduleConflicts,
  getCoursesForAdmin,
  getFacilityById,
  getCourseRoomManagementPagesForMember,
  hasCourseRoomManagementAccess,
  ReservationLockError,
  ReservationOverlapError,
  CourseFacilityScheduleError,
  updateCourse,
  updateCourseApplicationChecklist,
  updateCourseApplicationDetails,
  updateCourseApplicationStatus,
} from "../db";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const idSchema = z.number().int().positive();
const applicationChecklistFieldSchema = z.string().trim().regex(
  /^(?:feePaid|documentsSubmitted|check_[A-Za-z0-9][A-Za-z0-9_-]{0,57})$/,
  "확인 항목 식별자가 올바르지 않습니다.",
);
const nullableDate = z.string().regex(DATE_RE, "날짜 형식이 올바르지 않습니다.").nullable().optional();
const nullableTime = z.string().regex(TIME_RE, "시간 형식이 올바르지 않습니다.").nullable().optional();
const pageHrefSchema = z.string().trim().min(1).max(255).refine(
  value => value.startsWith("/") && !value.startsWith("//") && !value.includes("://"),
  "강좌방 주소가 올바르지 않습니다.",
);
const optionalText = (max: number) => z.string().trim().max(max).nullable().optional();
function getKstTodayDateKey() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function validateNewCourseDates(
  value: {
    startDate?: string | null;
    endDate?: string | null;
    applyStartDate?: string | null;
    applyEndDate?: string | null;
  },
  ctx: z.RefinementCtx,
) {
  const today = getKstTodayDateKey();
  const dateFields = [
    ["startDate", value.startDate, "강좌 시작일"],
    ["endDate", value.endDate, "강좌 종료일"],
    ["applyStartDate", value.applyStartDate, "신청 시작일"],
    ["applyEndDate", value.applyEndDate, "신청 마감일"],
  ] as const;

  for (const [path, date, label] of dateFields) {
    if (date && date < today) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [path],
        message: `${label}은 오늘 또는 이후 날짜로 선택해주세요.`,
      });
    }
  }
}

const applicationDetailsSchema = z.object({
  applicantName: z.string().trim().min(1, "신청자 이름을 입력해주세요.").max(64),
  applicantPhone: optionalText(32),
  applicantEmail: optionalText(320).refine(
    value => !value || z.string().email().safeParse(value).success,
    "이메일 형식이 올바르지 않습니다.",
  ),
  memo: optionalText(2_000),
});
const courseInputShape = {
  title: z.string().trim().min(1, "강좌명을 입력해주세요.").max(128),
  summary: optionalText(500),
  description: optionalText(10_000),
  instructor: optionalText(64),
  location: optionalText(128),
  target: optionalText(128),
  fee: optionalText(128),
  capacity: z.number().int().min(0).max(100_000).default(0),
  facilityId: z.number().int().positive().nullable().optional(),
  facilityRepeatMode: z.enum(COURSE_FACILITY_REPEAT_MODES).default("none"),
  facilityRepeatDays: z.array(z.number().int().min(0).max(6)).max(7).default([]),
  facilityCustomDates: z.array(z.string().regex(DATE_RE)).max(366).default([]),
  startDate: nullableDate,
  endDate: nullableDate,
  startTime: nullableTime,
  endTime: nullableTime,
  applyStartDate: nullableDate,
  applyEndDate: nullableDate,
  status: z.enum(["draft", "open", "closed", "cancelled", "archived"]).default("draft"),
  isVisible: z.boolean().default(true),
  audience: z.enum(["all", "member"]).default("member"),
  applicationNotice: optionalText(10_000),
  sortOrder: z.number().int().min(0).max(10_000).default(0),
};
export const courseCreateSchema = z.object(courseInputShape).superRefine((value, ctx) => {
  if (value.startDate && value.endDate && value.startDate > value.endDate) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["endDate"], message: "종료일은 시작일 이후여야 합니다." });
  }
  if (value.applyStartDate && value.applyEndDate && value.applyStartDate > value.applyEndDate) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["applyEndDate"], message: "신청 마감일은 신청 시작일 이후여야 합니다." });
  }
  validateNewCourseDates(value, ctx);
  if (value.facilityId) {
    const schedule = buildCourseFacilityScheduleDates({
      startDate: value.startDate,
      endDate: value.endDate,
      repeatMode: value.facilityRepeatMode,
      repeatDays: value.facilityRepeatDays,
      customDates: value.facilityCustomDates,
    });
    if (schedule.error) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["facilityRepeatMode"], message: schedule.error });
    }
  }
  const facilityRestriction = getCourseFacilityReservationRestriction(value);
  if (facilityRestriction) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["facilityId"], message: facilityRestriction });
  }
});
const courseUpdateSchema = z.object(courseInputShape).partial();

function assertCourseFacilityReservationPolicy(value: {
  facilityId?: number | null;
  startDate?: string | null;
  endDate?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  facilityRepeatMode?: "none" | "daily" | "weekly" | "monthly-weekday" | "custom" | null;
  facilityRepeatDays?: number[] | string | null;
  facilityCustomDates?: string[] | string | null;
}) {
  if (!value.facilityId) return;
  const schedule = buildCourseFacilityScheduleDates({
    startDate: value.startDate,
    endDate: value.endDate,
    repeatMode: value.facilityRepeatMode,
    repeatDays: parseCourseFacilityRepeatDays(value.facilityRepeatDays),
    customDates: parseCourseFacilityCustomDates(value.facilityCustomDates),
  });
  if (schedule.error) throw new TRPCError({ code: "BAD_REQUEST", message: schedule.error });
  for (const date of schedule.dates) {
    const restriction = getCourseFacilityReservationRestriction({ ...value, startDate: date });
    if (restriction) throw new TRPCError({ code: "BAD_REQUEST", message: `${date}: ${restriction}` });
  }
}

async function assertReservableCourseFacility(facilityId?: number | null) {
  if (!facilityId) return;
  const facility = await getFacilityById(facilityId);
  if (!facility || !facility.isVisible || !facility.isReservable) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "현재 강좌 시설예약에 사용할 수 없는 시설입니다." });
  }
}

function handleCourseReservationError(error: unknown): never {
  if (error instanceof ReservationOverlapError) {
    throw new TRPCError({ code: "CONFLICT", message: error.message });
  }
  if (error instanceof ReservationLockError) {
    throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: error.message });
  }
  if (error instanceof CourseFacilityScheduleError) {
    throw new TRPCError({ code: "BAD_REQUEST", message: error.message });
  }
  throw error;
}

function serializeCourseFacilityFields<T extends {
  facilityRepeatDays?: number[];
  facilityCustomDates?: string[];
}>(input: T) {
  const { facilityRepeatDays, facilityCustomDates, ...rest } = input;
  return {
    ...rest,
    ...(facilityRepeatDays !== undefined
      ? { facilityRepeatDays: serializeCourseFacilityRepeatDays(facilityRepeatDays) }
      : {}),
    ...(facilityCustomDates !== undefined
      ? { facilityCustomDates: serializeCourseFacilityCustomDates(facilityCustomDates) }
      : {}),
  };
}

async function assertCourseRoomAccess(
  ctx: { user: Parameters<typeof hasAdminContentPermission>[0]; memberId: number | null },
  pageHref: string,
) {
  if (hasAdminContentPermission(ctx.user, "content:courses")) {
    return { processedBy: ctx.user!.id };
  }
  if (ctx.memberId && await hasCourseRoomManagementAccess(ctx.memberId, pageHref)) {
    // 성도 계정에는 users.id가 없을 수 있으므로 처리자 표기는 비워 둡니다.
    return { processedBy: undefined };
  }
  throw new TRPCError({ code: "FORBIDDEN", message: "이 강좌방을 관리할 권한이 없습니다." });
}

async function getOwnedCourseOrThrow(
  ctx: { user: Parameters<typeof hasAdminContentPermission>[0]; memberId: number | null },
  courseId: number,
) {
  const course = await getCourseById(courseId);
  if (!course) throw new TRPCError({ code: "NOT_FOUND", message: "강좌를 찾을 수 없습니다." });
  const pageHref = course.pageHref || "/education/courses";
  const access = await assertCourseRoomAccess(ctx, pageHref);
  return { course, pageHref, access };
}

export const courseManagementRouter = router({
  myManagementPages: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.memberId) return [];
    return getCourseRoomManagementPagesForMember(ctx.memberId);
  }),

  access: publicProcedure
    .input(z.object({ pageHref: pageHrefSchema }))
    .query(async ({ input, ctx }) => {
      const canUseCustomDates = await canUseCourseCustomSchedule(ctx, input.pageHref);
      if (hasAdminContentPermission(ctx.user, "content:courses")) {
        return { canManage: true, canUseCustomDates, scope: "all" as const };
      }
      const canManage = canUseCustomDates;
      return { canManage, canUseCustomDates, scope: canManage ? "room" as const : null };
    }),

  courses: publicProcedure
    .input(z.object({ pageHref: pageHrefSchema }))
    .query(async ({ input, ctx }) => {
      await assertCourseRoomAccess(ctx, input.pageHref);
      return getCoursesForAdmin(input.pageHref);
    }),

  checkFacilitySchedule: publicProcedure
    .input(z.object({
      pageHref: pageHrefSchema,
      facilityId: idSchema,
      dates: z.array(z.string().regex(DATE_RE)).min(1).max(366),
      startTime: z.string().regex(TIME_RE),
      endTime: z.string().regex(TIME_RE),
      courseId: idSchema.optional(),
    }))
    .query(async ({ input, ctx }) => {
      await assertCourseRoomAccess(ctx, input.pageHref);
      if (input.courseId) await getOwnedCourseOrThrow(ctx, input.courseId);
      const { pageHref: _pageHref, ...conflictInput } = input;
      return getCourseFacilityScheduleConflicts(conflictInput);
    }),

  applications: publicProcedure
    .input(z.object({ pageHref: pageHrefSchema }))
    .query(async ({ input, ctx }) => {
      await assertCourseRoomAccess(ctx, input.pageHref);
      const applications = await getCourseApplications();
      return applications.filter(application => (application.coursePageHref || "/education/courses") === input.pageHref);
    }),

  create: publicProcedure
    .input(z.object({ pageHref: pageHrefSchema, course: courseCreateSchema }))
    .mutation(async ({ input, ctx }) => {
      await assertCourseRoomAccess(ctx, input.pageHref);
      await assertCourseCustomScheduleAccess(ctx, { ...input.course, pageHref: input.pageHref });
      await assertReservableCourseFacility(input.course.facilityId);
      assertCourseFacilityReservationPolicy(input.course);
      try {
        return await createCourse({
          ...serializeCourseFacilityFields(input.course),
          imageUrl: null,
          facilityReservationId: null,
          pageHref: input.pageHref,
          applicationFields: "[]",
        });
      } catch (error) {
        handleCourseReservationError(error);
      }
    }),

  update: publicProcedure
    .input(z.object({ id: idSchema, course: courseUpdateSchema }))
    .mutation(async ({ input, ctx }) => {
      const { course, access } = await getOwnedCourseOrThrow(ctx, input.id);
      const nextCourse = {
        ...course,
        facilityRepeatDays: parseCourseFacilityRepeatDays(course.facilityRepeatDays),
        facilityCustomDates: parseCourseFacilityCustomDates(course.facilityCustomDates),
        ...input.course,
      };
      await assertCourseCustomScheduleAccess(ctx, nextCourse, course);
      assertCourseFacilityReservationPolicy(nextCourse);
      await assertReservableCourseFacility(nextCourse.facilityId);
      try {
        await updateCourse(input.id, serializeCourseFacilityFields(input.course));
        return { success: true, processedBy: access.processedBy ?? null };
      } catch (error) {
        handleCourseReservationError(error);
      }
    }),

  delete: publicProcedure
    .input(z.object({ id: idSchema }))
    .mutation(async ({ input, ctx }) => {
      await getOwnedCourseOrThrow(ctx, input.id);
      await deleteCourse(input.id);
      return { success: true };
    }),

  updateApplicationStatus: publicProcedure
    .input(z.object({
      id: idSchema,
      status: z.enum(["approved", "rejected", "cancelled"]),
      comment: optionalText(20_000),
    }))
    .mutation(async ({ input, ctx }) => {
      const application = await getCourseApplicationById(input.id);
      if (!application) throw new TRPCError({ code: "NOT_FOUND", message: "신청 내역을 찾을 수 없습니다." });
      const { access } = await getOwnedCourseOrThrow(ctx, application.courseId);
      await updateCourseApplicationStatus(input.id, input.status, input.comment ?? undefined, access.processedBy);
      return { success: true };
    }),

  updateApplicationChecklist: publicProcedure
    .input(z.object({
      id: idSchema,
      field: applicationChecklistFieldSchema,
      checked: z.boolean(),
    }))
    .mutation(async ({ input, ctx }) => {
      const application = await getCourseApplicationById(input.id);
      if (!application) throw new TRPCError({ code: "NOT_FOUND", message: "신청 내역을 찾을 수 없습니다." });
      await getOwnedCourseOrThrow(ctx, application.courseId);
      const updated = await updateCourseApplicationChecklist(input.id, input.field, input.checked);
      if (!updated) throw new TRPCError({ code: "NOT_FOUND", message: "신청 내역을 찾을 수 없습니다." });
      return { success: true };
    }),

  updateApplicationDetails: publicProcedure
    .input(z.object({ id: idSchema, application: applicationDetailsSchema }))
    .mutation(async ({ input, ctx }) => {
      const application = await getCourseApplicationById(input.id);
      if (!application) throw new TRPCError({ code: "NOT_FOUND", message: "신청 내역을 찾을 수 없습니다." });
      await getOwnedCourseOrThrow(ctx, application.courseId);
      await updateCourseApplicationDetails(input.id, input.application);
      return { success: true };
    }),
});
