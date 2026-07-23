/**
 * 강좌 관리 라우터 (cms.courses)
 * ─────────────────────────────────────────────────────────────────────────────
 * 담당 기능:
 *   - 강좌 등록/수정/삭제
 *   - 강좌 신청자 명단 조회
 *   - 신청 승인/거절/취소 처리
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { MAX_COURSE_APPLICATION_CHECKLIST_ITEMS } from "@shared/courseApplicationChecklist";
import {
  COURSE_FACILITY_REPEAT_MODES,
  buildCourseFacilityScheduleDates,
  serializeCourseFacilityCustomDates,
  serializeCourseFacilityRepeatDays,
} from "@shared/courseFacilitySchedule";
import { adminPermissionProcedure, router } from "../../_core/trpc";
import { optionalTextSchema, requiredTextSchema, safeAssetUrlSchema } from "../../_core/contentValidation";
import { assertCourseCustomScheduleAccess } from "../../courseCustomScheduleAccess";
import {
  createCourse,
  createCourseRoomManager,
  deleteCourse,
  deleteCourseRoomManager,
  getAllMembers,
  getCourseApplications,
  getCourseById,
  getCourseFacilityScheduleConflicts,
  getCourseRoomManagers,
  getCoursesForAdmin,
  ReservationLockError,
  ReservationOverlapError,
  CourseFacilityScheduleError,
  replaceCourseApplicationChecklistItems,
  updateCourse,
  updateCourseApplicationChecklist,
  updateCourseApplicationDetails,
  updateCourseApplicationStatus,
  updateCourseRoomManager,
} from "../../db";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const idSchema = z.number().int().positive();
const nullableDateSchema = z.string().regex(DATE_RE, "날짜는 YYYY-MM-DD 형식으로 입력해주세요.").nullable().optional();
const nullableTimeSchema = z.string().regex(TIME_RE, "시간은 HH:MM 형식으로 입력해주세요.").nullable().optional();
const courseStatusSchema = z.enum(["draft", "open", "closed", "cancelled", "archived"]);
const courseAudienceSchema = z.enum(["all", "member"]);
const applicationStatusSchema = z.enum(["pending", "approved", "rejected", "cancelled"]);
const applicationChecklistFieldSchema = z.string().trim().regex(
  /^(?:feePaid|documentsSubmitted|check_[A-Za-z0-9][A-Za-z0-9_-]{0,57})$/,
  "확인 항목 식별자가 올바르지 않습니다.",
);
const applicationChecklistItemSchema = z.object({
  id: applicationChecklistFieldSchema,
  label: z.string().trim().min(1, "확인 항목 이름을 입력해주세요.").max(80),
});
const applicationChecklistItemsSchema = z.array(applicationChecklistItemSchema)
  .min(1, "확인 항목을 한 개 이상 등록해주세요.")
  .max(MAX_COURSE_APPLICATION_CHECKLIST_ITEMS)
  .superRefine((items, ctx) => {
    const ids = new Set<string>();
    const labels = new Set<string>();
    items.forEach((item, index) => {
      const normalizedLabel = item.label.toLocaleLowerCase("ko-KR");
      if (ids.has(item.id)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: [index, "id"], message: "중복된 확인 항목입니다." });
      }
      if (labels.has(normalizedLabel)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: [index, "label"], message: "같은 이름의 확인 항목이 있습니다." });
      }
      ids.add(item.id);
      labels.add(normalizedLabel);
    });
  });
const applicationDetailsSchema = z.object({
  applicantName: requiredTextSchema(64, "신청자 이름을 입력해주세요."),
  applicantPhone: optionalTextSchema(32),
  applicantEmail: optionalTextSchema(320).refine(
    value => !value || z.string().email().safeParse(value).success,
    "이메일 형식이 올바르지 않습니다.",
  ),
  memo: optionalTextSchema(2_000),
});
const courseProcedure = adminPermissionProcedure("content:courses");
const applicationFieldSchema = z.object({
  id: z.string().trim().min(1).max(64),
  label: z.string().trim().min(1).max(80),
  type: z.enum(["text", "phone", "email", "number", "select"]).default("text"),
  required: z.boolean().default(false),
  options: z.array(z.string().trim().max(80)).max(20).optional(),
});

function compareNullableDate(start?: string | null, end?: string | null) {
  return !start || !end || start <= end;
}

function compareNullableTime(start?: string | null, end?: string | null) {
  return !start || !end || start < end;
}

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

const courseShape = {
  title: requiredTextSchema(128, "강좌명을 입력해주세요."),
  summary: optionalTextSchema(500),
  imageUrl: safeAssetUrlSchema.nullable().optional(),
  description: optionalTextSchema(10000),
  instructor: optionalTextSchema(64),
  location: optionalTextSchema(128),
  target: optionalTextSchema(128),
  fee: optionalTextSchema(128),
  capacity: z.number().int().min(0).max(100000).default(0),
  facilityId: z.number().int().positive().nullable().optional(),
  facilityRepeatMode: z.enum(COURSE_FACILITY_REPEAT_MODES).default("none"),
  facilityRepeatDays: z.array(z.number().int().min(0).max(6)).max(7).default([]),
  facilityCustomDates: z.array(z.string().regex(DATE_RE)).max(366).default([]),
  startDate: nullableDateSchema,
  endDate: nullableDateSchema,
  startTime: nullableTimeSchema,
  endTime: nullableTimeSchema,
  applyStartDate: nullableDateSchema,
  applyEndDate: nullableDateSchema,
  status: courseStatusSchema.default("draft"),
  isVisible: z.boolean().default(true),
  audience: courseAudienceSchema.default("all"),
  pageHref: z.string().trim().min(1).max(255).nullable().optional(),
  applicationFields: z.array(applicationFieldSchema).max(20).default([]).transform(fields => JSON.stringify(fields)),
  applicationNotice: optionalTextSchema(10000),
  sortOrder: z.number().int().min(0).max(10000).default(0),
};

function validateCourseDatesAndTimes(
  value: {
    startDate?: string | null;
    endDate?: string | null;
    startTime?: string | null;
    endTime?: string | null;
    applyStartDate?: string | null;
    applyEndDate?: string | null;
  },
  ctx: z.RefinementCtx,
) {
  if (!compareNullableDate(value.startDate, value.endDate)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["endDate"], message: "종료일은 시작일 이후여야 합니다." });
  }
  if (!compareNullableDate(value.applyStartDate, value.applyEndDate)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["applyEndDate"], message: "신청 마감일은 신청 시작일 이후여야 합니다." });
  }
  if (!compareNullableTime(value.startTime, value.endTime)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["endTime"], message: "종료 시간은 시작 시간보다 늦어야 합니다." });
  }
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

export const courseBaseSchema = z.object(courseShape).superRefine((value, ctx) => {
  validateCourseDatesAndTimes(value, ctx);
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
});

const courseUpdateSchema = z.object(courseShape).partial().extend({
  id: idSchema,
}).superRefine(validateCourseDatesAndTimes);

function handleCourseReservationError(error: unknown) {
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

export const coursesRouter = router({
  list: courseProcedure.query(() => getCoursesForAdmin()),

  checkFacilitySchedule: courseProcedure
    .input(z.object({
      facilityId: idSchema,
      dates: z.array(z.string().regex(DATE_RE)).min(1).max(366),
      startTime: z.string().regex(TIME_RE),
      endTime: z.string().regex(TIME_RE),
      courseId: idSchema.optional(),
    }))
    .query(({ input }) => getCourseFacilityScheduleConflicts(input)),

  updateApplicationChecklistItems: courseProcedure
    .input(z.object({
      courseId: idSchema,
      items: applicationChecklistItemsSchema,
    }))
    .mutation(async ({ input }) => {
      const updated = await replaceCourseApplicationChecklistItems(input.courseId, input.items);
      if (!updated) {
        throw new TRPCError({ code: "NOT_FOUND", message: "강좌를 찾을 수 없습니다." });
      }
      return { success: true };
    }),

  create: courseProcedure
    .input(courseBaseSchema)
    .mutation(async ({ input, ctx }) => {
      await assertCourseCustomScheduleAccess(ctx, input);
      try {
        return await createCourse(serializeCourseFacilityFields(input));
      } catch (error) {
        handleCourseReservationError(error);
      }
    }),

  update: courseProcedure
    .input(courseUpdateSchema)
    .mutation(async ({ input, ctx }) => {
      const { id, ...data } = input;
      const currentCourse = await getCourseById(id);
      if (!currentCourse) {
        throw new TRPCError({ code: "NOT_FOUND", message: "강좌를 찾을 수 없습니다." });
      }
      await assertCourseCustomScheduleAccess(ctx, { ...currentCourse, ...data }, currentCourse);
      try {
        return await updateCourse(id, serializeCourseFacilityFields(data));
      } catch (error) {
        handleCourseReservationError(error);
      }
    }),

  delete: courseProcedure
    .input(z.object({ id: idSchema }))
    .mutation(async ({ input }) => {
      try {
        return await deleteCourse(input.id);
      } catch (error) {
        handleCourseReservationError(error);
      }
    }),

  applications: courseProcedure
    .input(z.object({ courseId: idSchema.optional() }))
    .query(({ input }) => getCourseApplications(input.courseId)),

  updateApplicationStatus: courseProcedure
    .input(z.object({
      id: idSchema,
      status: applicationStatusSchema,
      comment: optionalTextSchema(20000),
    }))
    .mutation(({ input, ctx }) =>
      updateCourseApplicationStatus(input.id, input.status, input.comment, ctx.user.id)
    ),

  updateApplicationChecklist: courseProcedure
    .input(z.object({
      id: idSchema,
      field: applicationChecklistFieldSchema,
      checked: z.boolean(),
    }))
    .mutation(async ({ input }) => {
      const updated = await updateCourseApplicationChecklist(input.id, input.field, input.checked);
      if (!updated) {
        throw new TRPCError({ code: "NOT_FOUND", message: "신청 내역을 찾을 수 없습니다." });
      }
      return { success: true };
    }),

  updateApplicationDetails: courseProcedure
    .input(z.object({ id: idSchema, application: applicationDetailsSchema }))
    .mutation(({ input }) => updateCourseApplicationDetails(input.id, input.application)),

  roomManagerMembers: courseProcedure.query(async () => {
    const members = await getAllMembers();
    return members.map((member) => ({
      id: member.id,
      name: member.name,
      email: member.email,
      phone: member.phone,
      status: member.status,
      position: member.position,
      department: member.department,
      district: member.district,
    }));
  }),

  roomManagers: courseProcedure.query(() => getCourseRoomManagers()),

  createRoomManager: courseProcedure
    .input(z.object({
      memberId: idSchema,
      pageHref: z.string().trim().min(1).max(255).startsWith("/"),
    }))
    .mutation(({ input, ctx }) =>
      createCourseRoomManager({ ...input, canManage: true, createdBy: ctx.user.id })
    ),

  updateRoomManager: courseProcedure
    .input(z.object({ id: idSchema, canManage: z.boolean() }))
    .mutation(({ input }) => input.canManage
      ? updateCourseRoomManager(input.id, { canManage: true })
      : deleteCourseRoomManager(input.id)),
});
