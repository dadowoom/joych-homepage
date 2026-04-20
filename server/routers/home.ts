/**
 * 홈페이지 공개 데이터 라우터 (home)
 * ─────────────────────────────────────────────────────────────────────────────
 * 담당 기능:
 *   - 히어로 슬라이드, 퀵메뉴, 공지사항, 관련기관, 갤러리, 사이트 설정
 *   - 상단 네비게이션 메뉴 (서브메뉴 포함)
 *   - 시설 조회 및 예약 신청 (성도 로그인 필요)
 *   - 블록 에디터 페이지 블록 조회
 *
 * 접근 권한:
 *   - publicProcedure: 로그인 없이 누구나 접근 가능
 *   - memberProtectedProcedure: 성도(교인) 로그인 필요
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { publicProcedure, memberProtectedProcedure, router } from "../_core/trpc";
import {
  getVisibleHeroSlides,
  getVisibleQuickMenus,
  getPublishedNotices,
  getVisibleAffiliates,
  getVisibleGalleryItems,
  getSiteSettings,
  getVisibleMenus,
  getMenuItemById,
  getMenuSubItemById,
  getMenuItemByHref,
  getMenuSubItemByHref,
  getFacilities,
  getFacilityById,
  getFacilityImages,
  getFacilityHours,
  getBlockedDates,
  getReservationsByDate,
  createReservation,
  getMyReservations,
  getReservationById,
  updateReservationStatus,
  getPageBlocks,
} from "../db";

export const homeRouter = router({
  // ─── 홈페이지 콘텐츠 ────────────────────────────────────────────────────────

  /** 히어로 슬라이드 목록 (공개된 것만) */
  heroSlides: publicProcedure.query(() => getVisibleHeroSlides()),

  /** 퀵메뉴 목록 (공개된 것만) */
  quickMenus: publicProcedure.query(() => getVisibleQuickMenus()),

  /** 교회 소식 최신 5개 (공개된 것만) */
  notices: publicProcedure.query(() => getPublishedNotices(5)),

  /** 관련기관 목록 (공개된 것만) */
  affiliates: publicProcedure.query(() => getVisibleAffiliates()),

  /** 갤러리 사진 목록 (공개된 것만) */
  gallery: publicProcedure.query(() => getVisibleGalleryItems()),

  /** 사이트 설정 (교회명, 주소, 연락처 등) */
  settings: publicProcedure.query(() => getSiteSettings()),

  // ─── 네비게이션 메뉴 ────────────────────────────────────────────────────────

  /** 상단 GNB 메뉴 전체 목록 (서브메뉴 포함, 공개된 것만) */
  menus: publicProcedure.query(() => getVisibleMenus()),

  /** 2단 메뉴 단건 조회 (동적 페이지 렌더링용) */
  menuItem: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(({ input }) => getMenuItemById(input.id)),

  /** 3단 메뉴 단건 조회 (동적 페이지 렌더링용) */
  menuSubItem: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(({ input }) => getMenuSubItemById(input.id)),

  /** href(경로)로 2단 메뉴 조회 — 예배영상 페이지의 playlistId 연결에 사용 */
  menuItemByHref: publicProcedure
    .input(z.object({ href: z.string() }))
    .query(({ input }) => getMenuItemByHref(input.href)),

  /** href(경로)로 3단 메뉴 조회 — 예배영상 페이지의 playlistId 연결에 사용 */
  menuSubItemByHref: publicProcedure
    .input(z.object({ href: z.string() }))
    .query(({ input }) => getMenuSubItemByHref(input.href)),

  // ─── 시설 조회 (성도용) ─────────────────────────────────────────────────────

  /** 시설 목록 (공개된 시설만) */
  facilities: publicProcedure.query(() => getFacilities(true)),

  /** 시설 단건 조회 */
  facility: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(({ input }) => getFacilityById(input.id)),

  /** 시설 사진 목록 */
  facilityImages: publicProcedure
    .input(z.object({ facilityId: z.number() }))
    .query(({ input }) => getFacilityImages(input.facilityId)),

  /** 시설 운영 시간 */
  facilityHours: publicProcedure
    .input(z.object({ facilityId: z.number() }))
    .query(({ input }) => getFacilityHours(input.facilityId)),

  /** 시설 차단 날짜 목록 (예약 불가 날짜) */
  facilityBlockedDates: publicProcedure
    .input(z.object({ facilityId: z.number() }))
    .query(({ input }) => getBlockedDates(input.facilityId)),

  /** 특정 날짜의 예약 목록 (시간 선택 시 중복 방지용) */
  facilityReservationsByDate: publicProcedure
    .input(z.object({ facilityId: z.number(), date: z.string() }))
    .query(({ input }) => getReservationsByDate(input.facilityId, input.date)),

  // ─── 예약 신청 (성도 로그인 필요) ───────────────────────────────────────────

  /**
   * 시설 예약 신청
   * - 시설의 승인 방식에 따라 자동 승인(auto) 또는 관리자 승인 대기(pending) 처리
   */
  createReservation: memberProtectedProcedure
    .input(z.object({
      facilityId: z.number(),
      reserverName: z.string(),
      reserverPhone: z.string().optional(),
      reservationDate: z.string(),
      startTime: z.string(),
      endTime: z.string(),
      purpose: z.string(),
      department: z.string().optional(),
      attendees: z.number().default(1),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const facility = await getFacilityById(input.facilityId);
      if (!facility) {
        throw new TRPCError({ code: "NOT_FOUND", message: "시설을 찾을 수 없습니다." });
      }
      if (!facility.isReservable) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "현재 예약이 불가능한 시설입니다." });
      }

      // 자동 승인 시설은 바로 approved, 그 외는 pending(관리자 검토 필요)
      const status = facility.approvalType === "auto" ? "approved" : "pending";

      // ctx.memberId = church_members 테이블의 id (성도 로그인 기반)
      const id = await createReservation({ ...input, userId: ctx.memberId, status });
      return { id, status };
    }),

  /** 내 예약 목록 조회 (성도 본인 것만) */
  myReservations: memberProtectedProcedure
    .query(({ ctx }) => getMyReservations(ctx.memberId)),

  /**
   * 예약 취소 (성도 본인만 가능)
   * - 이미 승인된 예약은 취소 불가 (관리자에게 문의 필요)
   */
  cancelReservation: memberProtectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const reservation = await getReservationById(input.id);
      if (!reservation) {
        throw new TRPCError({ code: "NOT_FOUND", message: "예약을 찾을 수 없습니다." });
      }
      if (reservation.userId !== ctx.memberId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "본인의 예약만 취소할 수 있습니다." });
      }
      if (reservation.status === "approved") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "이미 승인된 예약은 취소할 수 없습니다. 관리자에게 문의하세요.",
        });
      }
      await updateReservationStatus(input.id, "cancelled");
      return { success: true };
    }),

  // ─── 블록 에디터 ────────────────────────────────────────────────────────────

  /**
   * 페이지 블록 목록 조회 (공개용)
   * - isVisible=true인 블록만 반환
   * - menuItemId 또는 menuSubItemId로 해당 페이지의 블록을 조회
   */
  pageBlocks: publicProcedure
    .input(z.object({
      menuItemId: z.number().optional(),
      menuSubItemId: z.number().optional(),
    }))
    .query(({ input }) => getPageBlocks(input)),
});
