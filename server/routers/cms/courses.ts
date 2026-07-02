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
import { adminPermissionProcedure, router } from "../../_core/trpc";
import { optionalTextSchema, requiredTextSchema, safeAssetUrlSchema } from "../../_core/contentValidation";
import {
  createCourse,
  deleteCourse,
  getCourseApplications,
  getCoursesForAdmin,
  ReservationLockError,
  ReservationOverlapError,
  updateCourse,
  updateCourseApplicationStatus,
} from "../../db";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const idSchema = z.number().int().positive();
const nullableDateSchema = z.string().regex(DATE_RE, "날짜는 YYYY-MM-DD 형식으로 입력해주세요.").nullable().optional();
const nullableTimeSchema = z.string().regex(TIME_RE, "시간은 HH:MM 형식으로 입력해주세요.").nullable().optional();
const courseStatusSchema = z.enum(["draft", "open", "closed", "cancelled", "archived"]);
const courseAudienceSchema = z.enum(["all", "member"]);
const applicationStatusSchema = z.enum(["pending", "approved", "rejected", "cancelled"]);
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

const courseBaseSchema = z.object(courseShape).superRefine(validateCourseDatesAndTimes);

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
  throw error;
}

export const coursesRouter = router({
  list: courseProcedure.query(() => getCoursesForAdmin()),

  create: courseProcedure
    .input(courseBaseSchema)
    .mutation(async ({ input }) => {
      try {
        return await createCourse(input);
      } catch (error) {
        handleCourseReservationError(error);
      }
    }),

  update: courseProcedure
    .input(courseUpdateSchema)
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      try {
        return await updateCourse(id, data);
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
});
