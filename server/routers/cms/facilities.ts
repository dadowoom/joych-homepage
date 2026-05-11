/**
 * 시설 관리 라우터 (cms.facilities)
 * ─────────────────────────────────────────────────────────────────────────────
 * 담당 기능:
 *   - list: 시설 목록 조회 (공개)
 *   - get: 시설 단건 조회 (공개)
 *   - create / update / delete: 시설 CRUD (관리자)
 *   - images: 시설 사진 관리 (업로드/삭제/대표사진 설정)
 *   - hours: 시설 운영 시간 관리
 *   - blockedDates: 예약 차단 날짜 관리
 *
 * 접근 권한:
 *   - list, get, images.list, hours.list, blockedDates.list: publicProcedure
 *   - 나머지: adminProcedure
 */

import { z } from "zod";
import { adminProcedure, publicProcedure, router } from "../../_core/trpc";
import {
  optionalTextSchema,
  requiredTextSchema,
} from "../../_core/contentValidation";
import { storagePut } from "../../storage";
import { validateImage } from "./upload";
import {
  getFacilities,
  getFacilityById,
  createFacility,
  updateFacility,
  deleteFacility,
  getFacilityImages,
  addFacilityImage,
  deleteFacilityImage,
  getFacilityHours,
  upsertFacilityHour,
  getBlockedDates,
  addBlockedDate,
  deleteBlockedDate,
} from "../../db";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const idSchema = z.number().int().positive();
const timeSchema = z.string().regex(TIME_RE, "시간은 HH:MM 형식으로 입력해주세요.");
const nullableTimeSchema = timeSchema.nullable().optional();
const sortOrderSchema = z.number().int().min(0).max(10000).optional();

function toMinutes(time: string) {
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + minute;
}

function addTimeOrderIssue(
  ctx: z.RefinementCtx,
  start: string | null | undefined,
  end: string | null | undefined,
  message: string,
) {
  if (start && end && TIME_RE.test(start) && TIME_RE.test(end) && toMinutes(start) >= toMinutes(end)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message });
  }
}

const facilityCreateSchema = z.object({
  name: requiredTextSchema(128, "시설 이름을 입력해주세요."),
  description: optionalTextSchema(5000),
  location: optionalTextSchema(128),
  capacity: z.number().int().min(1).max(100000).optional(),
  pricePerHour: z.number().int().min(0).max(100000000).optional(),
  slotMinutes: z.number().int().min(5).max(1440).default(60),
  minSlots: z.number().int().min(1).max(96).default(1),
  maxSlots: z.number().int().min(1).max(96).default(4),
  approvalType: z.enum(["auto", "manual"]).default("manual"),
  isReservable: z.boolean().default(true),
  isVisible: z.boolean().default(true),
  notice: optionalTextSchema(10000),
  caution: optionalTextSchema(10000),
  openTime: timeSchema.default("09:00"),
  closeTime: timeSchema.default("22:00"),
  sortOrder: sortOrderSchema,
}).superRefine((value, ctx) => {
  if (value.maxSlots < value.minSlots) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["maxSlots"], message: "최대 예약 슬롯은 최소 예약 슬롯보다 크거나 같아야 합니다." });
  }
  addTimeOrderIssue(ctx, value.openTime, value.closeTime, "운영 시작 시간은 종료 시간보다 빨라야 합니다.");
});

const facilityUpdateSchema = z.object({
  id: idSchema,
  name: requiredTextSchema(128, "시설 이름을 입력해주세요.").optional(),
  description: optionalTextSchema(5000),
  location: optionalTextSchema(128),
  capacity: z.number().int().min(1).max(100000).optional(),
  pricePerHour: z.number().int().min(0).max(100000000).optional(),
  slotMinutes: z.number().int().min(5).max(1440).optional(),
  minSlots: z.number().int().min(1).max(96).optional(),
  maxSlots: z.number().int().min(1).max(96).optional(),
  approvalType: z.enum(["auto", "manual"]).optional(),
  isReservable: z.boolean().optional(),
  isVisible: z.boolean().optional(),
  notice: optionalTextSchema(10000),
  caution: optionalTextSchema(10000),
  sortOrder: sortOrderSchema,
  openTime: timeSchema.optional(),
  closeTime: timeSchema.optional(),
}).superRefine((value, ctx) => {
  if (value.minSlots !== undefined && value.maxSlots !== undefined && value.maxSlots < value.minSlots) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["maxSlots"], message: "최대 예약 슬롯은 최소 예약 슬롯보다 크거나 같아야 합니다." });
  }
  addTimeOrderIssue(ctx, value.openTime, value.closeTime, "운영 시작 시간은 종료 시간보다 빨라야 합니다.");
});

const facilityHourSchema = z.object({
  facilityId: idSchema,
  dayOfWeek: z.number().int().min(0).max(6),
  isOpen: z.boolean(),
  openTime: timeSchema,
  closeTime: timeSchema,
  breakStart: nullableTimeSchema,
  breakEnd: nullableTimeSchema,
}).superRefine((value, ctx) => {
  addTimeOrderIssue(ctx, value.openTime, value.closeTime, "운영 시작 시간은 종료 시간보다 빨라야 합니다.");
  if ((value.breakStart && !value.breakEnd) || (!value.breakStart && value.breakEnd)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "휴식 시작/종료 시간을 모두 입력해주세요." });
  }
  addTimeOrderIssue(ctx, value.breakStart, value.breakEnd, "휴식 시작 시간은 종료 시간보다 빨라야 합니다.");
  if (value.breakStart && value.breakEnd && TIME_RE.test(value.breakStart) && TIME_RE.test(value.breakEnd)) {
    if (toMinutes(value.breakStart) < toMinutes(value.openTime) || toMinutes(value.breakEnd) > toMinutes(value.closeTime)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "휴식 시간은 운영 시간 안에 있어야 합니다." });
    }
  }
});

const blockedDateSchema = z.object({
  facilityId: idSchema.nullable().optional(),
  blockedDate: z.string().regex(DATE_RE, "차단 날짜는 YYYY-MM-DD 형식으로 입력해주세요."),
  reason: optionalTextSchema(128),
  isPartialBlock: z.boolean().default(false),
  blockStart: nullableTimeSchema,
  blockEnd: nullableTimeSchema,
}).superRefine((value, ctx) => {
  if (value.isPartialBlock && (!value.blockStart || !value.blockEnd)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "부분 차단은 시작/종료 시간을 모두 입력해주세요." });
  }
  addTimeOrderIssue(ctx, value.blockStart, value.blockEnd, "차단 시작 시간은 종료 시간보다 빨라야 합니다.");
});

export const facilitiesRouter = router({
  /** 시설 전체 목록 (공개) */
  list: publicProcedure.query(() => getFacilities()),

  /** 시설 단건 조회 (공개) */
  get: publicProcedure
    .input(z.object({ id: idSchema }))
    .query(({ input }) => getFacilityById(input.id)),

  /** 시설 생성 (관리자) */
  create: adminProcedure
    .input(facilityCreateSchema)
    .mutation(({ input }) => createFacility(input)),

  /** 시설 정보 수정 (관리자) */
  update: adminProcedure
    .input(facilityUpdateSchema)
    .mutation(({ input }) => {
      const { id, ...data } = input;
      return updateFacility(id, data);
    }),

  /** 시설 삭제 (관리자) */
  delete: adminProcedure
    .input(z.object({ id: idSchema }))
    .mutation(({ input }) => deleteFacility(input.id)),

  // ─── 시설 사진 관리 ─────────────────────────────────────────────────────────
  images: router({
    /** 시설 사진 목록 조회 (공개) */
    list: publicProcedure
      .input(z.object({ facilityId: idSchema }))
      .query(({ input }) => getFacilityImages(input.facilityId)),

    /**
     * 시설 사진 업로드 (관리자)
     * - S3 경로: facility-images/{facilityId}/{timestamp}-{random}.{ext}
     */
    upload: adminProcedure
      .input(z.object({
        facilityId: idSchema,
        base64: z.string(),
        mimeType: z.string(),
        caption: optionalTextSchema(128),
        isThumbnail: z.boolean().default(false),
      }))
      .mutation(async ({ input }) => {
        const { buffer, ext } = validateImage(input.base64, input.mimeType);
        const mimeType = input.mimeType.toLowerCase().trim();
        const key = `facility-images/${input.facilityId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { url } = await storagePut(key, buffer, mimeType);
        const id = await addFacilityImage({
          facilityId: input.facilityId,
          imageUrl: url,
          fileKey: key,
          caption: input.caption,
          isThumbnail: input.isThumbnail,
          sortOrder: 0,
        });
        return { id, url };
      }),

    /** 시설 사진 삭제 (관리자) */
    delete: adminProcedure
      .input(z.object({ id: idSchema }))
      .mutation(({ input }) => deleteFacilityImage(input.id)),

    /**
     * 대표 사진 설정 (관리자)
     * - 해당 시설의 모든 사진을 isThumbnail=false로 초기화 후 선택 사진만 true
     */
    setThumbnail: adminProcedure
      .input(z.object({ facilityId: idSchema, imageId: idSchema }))
      .mutation(async ({ input }) => {
        const { getDb } = await import("../../db");
        const { facilityImages } = await import("../../../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        const db = await getDb();
        if (!db) throw new Error("DB not available");

        // 모든 사진 isThumbnail=false 초기화
        await db.update(facilityImages)
          .set({ isThumbnail: false })
          .where(eq(facilityImages.facilityId, input.facilityId));

        // 선택한 사진만 isThumbnail=true 설정
        await db.update(facilityImages)
          .set({ isThumbnail: true })
          .where(eq(facilityImages.id, input.imageId));

        return { success: true };
      }),
  }),

  // ─── 운영 시간 관리 ─────────────────────────────────────────────────────────
  hours: router({
    /** 시설 운영 시간 조회 (공개) */
    list: publicProcedure
      .input(z.object({ facilityId: idSchema }))
      .query(({ input }) => getFacilityHours(input.facilityId)),

    /**
     * 시설 운영 시간 저장 (관리자)
     * - 요일별 운영 시간, 휴식 시간 설정
     * - 이미 존재하면 수정, 없으면 생성 (upsert)
     */
    upsert: adminProcedure
      .input(facilityHourSchema)
      .mutation(({ input }) => upsertFacilityHour(input)),
  }),

  // ─── 예약 차단 날짜 관리 ────────────────────────────────────────────────────
  blockedDates: router({
    /** 차단 날짜 목록 조회 (공개) */
    list: publicProcedure
      .input(z.object({ facilityId: idSchema.optional() }))
      .query(({ input }) => getBlockedDates(input.facilityId)),

    /** 차단 날짜 추가 (관리자) */
    add: adminProcedure
      .input(blockedDateSchema)
      .mutation(({ input }) => addBlockedDate(input)),

    /** 차단 날짜 삭제 (관리자) */
    delete: adminProcedure
      .input(z.object({ id: idSchema }))
      .mutation(({ input }) => deleteBlockedDate(input.id)),
  }),
});
