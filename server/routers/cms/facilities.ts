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

export const facilitiesRouter = router({
  /** 시설 전체 목록 (공개) */
  list: publicProcedure.query(() => getFacilities()),

  /** 시설 단건 조회 (공개) */
  get: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(({ input }) => getFacilityById(input.id)),

  /** 시설 생성 (관리자) */
  create: adminProcedure
    .input(z.object({
      name: z.string().min(1, "시설 이름을 입력해주세요."),
      description: z.string().optional(),
      location: z.string().optional(),
      capacity: z.number().optional(),
      pricePerHour: z.number().optional(),
      slotMinutes: z.number().default(60),
      minSlots: z.number().default(1),
      maxSlots: z.number().default(4),
      approvalType: z.enum(["auto", "manual"]).default("manual"),
      isReservable: z.boolean().default(true),
      isVisible: z.boolean().default(true),
      notice: z.string().optional(),
      caution: z.string().optional(),
      openTime: z.string().default("09:00"),
      closeTime: z.string().default("22:00"),
      sortOrder: z.number().optional(),
    }))
    .mutation(({ input }) => createFacility(input)),

  /** 시설 정보 수정 (관리자) */
  update: adminProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().optional(),
      description: z.string().optional(),
      location: z.string().optional(),
      capacity: z.number().optional(),
      pricePerHour: z.number().optional(),
      slotMinutes: z.number().optional(),
      minSlots: z.number().optional(),
      maxSlots: z.number().optional(),
      approvalType: z.enum(["auto", "manual"]).optional(),
      isReservable: z.boolean().optional(),
      isVisible: z.boolean().optional(),
      notice: z.string().optional(),
      caution: z.string().optional(),
      sortOrder: z.number().optional(),
      openTime: z.string().optional(),
      closeTime: z.string().optional(),
    }))
    .mutation(({ input }) => {
      const { id, ...data } = input;
      return updateFacility(id, data);
    }),

  /** 시설 삭제 (관리자) */
  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ input }) => deleteFacility(input.id)),

  // ─── 시설 사진 관리 ─────────────────────────────────────────────────────────
  images: router({
    /** 시설 사진 목록 조회 (공개) */
    list: publicProcedure
      .input(z.object({ facilityId: z.number() }))
      .query(({ input }) => getFacilityImages(input.facilityId)),

    /**
     * 시설 사진 업로드 (관리자)
     * - S3 경로: facility-images/{facilityId}/{timestamp}-{random}.{ext}
     */
    upload: adminProcedure
      .input(z.object({
        facilityId: z.number(),
        base64: z.string(),
        mimeType: z.string(),
        caption: z.string().optional(),
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
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => deleteFacilityImage(input.id)),

    /**
     * 대표 사진 설정 (관리자)
     * - 해당 시설의 모든 사진을 isThumbnail=false로 초기화 후 선택 사진만 true
     */
    setThumbnail: adminProcedure
      .input(z.object({ facilityId: z.number(), imageId: z.number() }))
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
      .input(z.object({ facilityId: z.number() }))
      .query(({ input }) => getFacilityHours(input.facilityId)),

    /**
     * 시설 운영 시간 저장 (관리자)
     * - 요일별 운영 시간, 휴식 시간 설정
     * - 이미 존재하면 수정, 없으면 생성 (upsert)
     */
    upsert: adminProcedure
      .input(z.object({
        facilityId: z.number(),
        dayOfWeek: z.number().min(0).max(6), // 0=일요일, 6=토요일
        isOpen: z.boolean(),
        openTime: z.string(),
        closeTime: z.string(),
        breakStart: z.string().nullable().optional(),
        breakEnd: z.string().nullable().optional(),
      }))
      .mutation(({ input }) => upsertFacilityHour(input)),
  }),

  // ─── 예약 차단 날짜 관리 ────────────────────────────────────────────────────
  blockedDates: router({
    /** 차단 날짜 목록 조회 (공개) */
    list: publicProcedure
      .input(z.object({ facilityId: z.number().optional() }))
      .query(({ input }) => getBlockedDates(input.facilityId)),

    /** 차단 날짜 추가 (관리자) */
    add: adminProcedure
      .input(z.object({
        facilityId: z.number().nullable().optional(),
        blockedDate: z.string(),                          // YYYY-MM-DD 형식
        reason: z.string().optional(),
        isPartialBlock: z.boolean().default(false),       // 부분 차단 여부
        blockStart: z.string().nullable().optional(),     // 부분 차단 시작 시간
        blockEnd: z.string().nullable().optional(),       // 부분 차단 종료 시간
      }))
      .mutation(({ input }) => addBlockedDate(input)),

    /** 차단 날짜 삭제 (관리자) */
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => deleteBlockedDate(input.id)),
  }),
});
