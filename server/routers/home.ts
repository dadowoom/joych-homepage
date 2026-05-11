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

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

function toMinutes(time: string): number | null {
  if (!TIME_RE.test(time)) return null;
  const [hour, minute] = time.split(":").map(Number);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return hour * 60 + minute;
}

function todayKstDateKey() {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

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

  /**
   * 특정 날짜의 예약 목록 (시간 선택 시 중복 방지용)
   * ⚠️ 공개 API — 개인정보 최소 노출 원칙 적용
   * 반환: startTime, endTime, status 만 반환 (예약자 이름/전화번호/메모 등 제외)
   */
  facilityReservationsByDate: publicProcedure
    .input(z.object({ facilityId: z.number(), date: z.string() }))
    .query(async ({ input }) => {
      const rows = await getReservationsByDate(input.facilityId, input.date);
      // 공개 화면에는 시간대와 상태만 반환 — 개인정보 필드 제거
      return rows.map(({ startTime, endTime, status }) => ({ startTime, endTime, status }));
    }),

  // ─── 예약 신청 (성도 로그인 필요) ───────────────────────────────────────────

  /**
   * 시설 예약 신청
   * - 시설의 승인 방식에 따라 자동 승인(auto) 또는 관리자 승인 대기(pending) 처리
   * - 서버 측 검증: 시설 존재, 예약 가능 여부, 운영시간, 휴게시간, 예약 단위,
   *   최소/최대 예약 시간, 차단일, 시간 순서, 중복 예약
   */
  createReservation: memberProtectedProcedure
    .input(z.object({
      facilityId: z.number(),
      reserverName: z.string().min(1, "예약자 이름을 입력해주세요."),
      reserverPhone: z.string().optional(),
      reservationDate: z.string().regex(DATE_RE, "예약 날짜 형식이 올바르지 않습니다."),
      startTime: z.string().regex(TIME_RE, "시작 시간 형식이 올바르지 않습니다."),
      endTime: z.string().regex(TIME_RE, "종료 시간 형식이 올바르지 않습니다."),
      purpose: z.string().min(1, "사용 목적을 입력해주세요."),
      department: z.string().optional(),
      attendees: z.number().int().min(1, "사용 인원은 1명 이상이어야 합니다.").default(1),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const startMinutes = toMinutes(input.startTime);
      const endMinutes = toMinutes(input.endTime);
      if (startMinutes === null || endMinutes === null) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "예약 시간 형식이 올바르지 않습니다." });
      }
      if (input.reservationDate < todayKstDateKey()) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "지난 날짜는 예약할 수 없습니다." });
      }
      // ① 시설 존재 여부 확인
      const facility = await getFacilityById(input.facilityId);
      if (!facility) {
        throw new TRPCError({ code: "NOT_FOUND", message: "시설을 찾을 수 없습니다." });
      }
      // ② 예약 가능 여부 확인
      if (!facility.isReservable) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "현재 예약이 불가능한 시설입니다." });
      }
      if (input.attendees > facility.capacity) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `최대 수용 인원(${facility.capacity}명)을 초과할 수 없습니다.` });
      }
      // ③ 시작시간 < 종료시간 확인
      if (startMinutes >= endMinutes) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "시작 시간은 종료 시간보다 빨라야 합니다." });
      }
      // ④ 운영시간 확인 (해당 요일의 운영시간 조회)
      const reservationDayOfWeek = new Date(input.reservationDate).getDay(); // 0=일, 1=월 ...
      const hours = await getFacilityHours(input.facilityId);
      const dayHour = hours.find(h => h.dayOfWeek === reservationDayOfWeek);
      if (dayHour) {
        if (!dayHour.isOpen) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "해당 요일은 시설 운영일이 아닙니다." });
        }
      }

      const openTime = dayHour?.openTime ?? facility.openTime;
      const closeTime = dayHour?.closeTime ?? facility.closeTime;
      const openMinutes = toMinutes(openTime);
      const closeMinutes = toMinutes(closeTime);
      if (openMinutes === null || closeMinutes === null) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "시설 운영 시간이 올바르지 않습니다. 관리자에게 문의해주세요." });
      }
      if (startMinutes < openMinutes || endMinutes > closeMinutes) {
          throw new TRPCError({
            code: "BAD_REQUEST",
          message: `운영 시간(${openTime}~${closeTime}) 내에서만 예약 가능합니다.`,
          });
      }

      const slotMinutes = facility.slotMinutes > 0 ? facility.slotMinutes : 60;
      const durationMinutes = endMinutes - startMinutes;
      if ((startMinutes - openMinutes) % slotMinutes !== 0 || (endMinutes - openMinutes) % slotMinutes !== 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `${slotMinutes}분 단위로만 예약할 수 있습니다.` });
      }
      const selectedSlots = durationMinutes / slotMinutes;
      if (selectedSlots < facility.minSlots) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `최소 ${facility.minSlots}개 시간 단위 이상 예약해야 합니다.` });
      }
      if (selectedSlots > facility.maxSlots) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `최대 ${facility.maxSlots}개 시간 단위까지만 예약할 수 있습니다.` });
      }

      if (dayHour?.breakStart && dayHour.breakEnd) {
        const breakStart = toMinutes(dayHour.breakStart);
        const breakEnd = toMinutes(dayHour.breakEnd);
        if (breakStart !== null && breakEnd !== null && startMinutes < breakEnd && endMinutes > breakStart) {
          throw new TRPCError({ code: "BAD_REQUEST", message: `휴게 시간(${dayHour.breakStart}~${dayHour.breakEnd})에는 예약할 수 없습니다.` });
        }
      }
      // ⑤ 차단일 확인 (전체 차단 또는 해당 시설 차단)
      const blocked = await getBlockedDates(input.facilityId);
      for (const b of blocked) {
        if (b.blockedDate !== input.reservationDate) continue;
        if (!b.isPartialBlock) {
          // 하루 전체 차단
          throw new TRPCError({ code: "BAD_REQUEST", message: `${input.reservationDate}은 예약이 차단된 날입니다.${b.reason ? ` (${b.reason})` : ""}` });
        }
        // 부분 차단: 요청 시간대가 차단 시간대와 겹치는지 확인
        if (b.blockStart && b.blockEnd) {
          const overlapPartial = input.startTime < b.blockEnd && input.endTime > b.blockStart;
          if (overlapPartial) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `해당 시간대(${b.blockStart}~${b.blockEnd})는 예약이 차단되어 있습니다.${b.reason ? ` (${b.reason})` : ""}`,
            });
          }
        }
      }
      // ⑥ 같은 시설/날짜의 시간대 겹침 확인 (중복 예약 방지)
      const existing = await getReservationsByDate(input.facilityId, input.reservationDate);
      const activeReservations = existing.filter(r => r.status !== "cancelled" && r.status !== "rejected");
      for (const r of activeReservations) {
        const overlap = input.startTime < r.endTime && input.endTime > r.startTime;
        if (overlap) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `해당 시간대(${r.startTime}~${r.endTime})에 이미 예약이 있습니다. 다른 시간을 선택해 주세요.`,
          });
        }
      }

      // 자동 승인 시설은 바로 approved, 그 외는 pending(관리자 검토 필요)
      const status = facility.approvalType === "auto" ? "approved" : "pending";

      // ctx.memberId = church_members 테이블의 id (성도 로그인 기반)
      const id = await createReservation({ ...input, userId: ctx.memberId, status });
      if (!id) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "예약 신청 저장에 실패했습니다." });
      }
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
