/**
 * 홈페이지 공개 데이터 라우터 (home)
 * ─────────────────────────────────────────────────────────────────────────────
 * 담당 기능:
 *   - 히어로 슬라이드, 퀵메뉴, 공지사항, 관련기관, 갤러리, 사이트 설정
 *   - 홈페이지 팝업/공지 배너
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
  getActiveNoticePopups,
  getVisibleAffiliates,
  getVisibleGalleryItems,
  getVisibleHomeGalleryItems,
  getSiteSettings,
  getVisibleMenus,
  getVisibleMenuItemById,
  getVisibleMenuSubItemById,
  getVisibleMenuItemByHref,
  getVisibleMenuSubItemByHref,
  getFacilities,
  getFacilityById,
  getFacilityImages,
  getFacilityHours,
  getBlockedDates,
  getReservationsByDate,
  createReservationIfAvailable,
  deleteReservationsByIds,
  getMyReservations,
  getReservationById,
  updateReservationStatus,
  getPageBlocks,
  getStaticPageContentByHref,
  getStoredTranslation,
  getVisibleStaffCategories,
  getVisibleStaffMembers,
  getAllStaffTitleOptions,
  listPublishedBulletins,
  getVisibleCourses,
  getVisibleCourseById,
  createOrReopenCourseApplication,
  getMyCourseApplications,
  cancelMyCourseApplication,
  getMemberById,
  CourseApplicationCapacityError,
  CourseApplicationConflictError,
  CourseApplicationLockError,
  ReservationLockError,
  ReservationOverlapError,
} from "../db";
import { getStaticPageSeed } from "@shared/staticPageContent";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;
const idSchema = z.number().int().positive();
const hrefLookupSchema = z.string().trim().min(1).max(256);
const staticPageHrefSchema = z.string().trim().min(1).max(128).regex(/^\//);
const staffCategorySchema = z.string().trim().min(1).max(64).regex(/^[a-z0-9][a-z0-9_-]{0,63}$/);
const translationLocaleSchema = z.enum(["ja"]);
const courseMemoSchema = z.string().trim().max(2000, "신청 메모는 2000자 이하로 입력해주세요.").optional();
const reservationRepeatSchema = z.object({
  type: z.enum(["none", "weekly", "biweekly", "monthly-date", "monthly-weekday"]).default("none"),
  count: z.number().int().min(1).max(52).optional(),
  untilDate: z.string().regex(DATE_RE, "반복 종료일 형식이 올바르지 않습니다.").optional(),
}).optional();

async function getVisibleFacilityById(id: number) {
  const facility = await getFacilityById(id);
  return facility?.isVisible ? facility : null;
}

function toMinutes(time: string): number | null {
  if (!TIME_RE.test(time)) return null;
  const [hour, minute] = time.split(":").map(Number);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return hour * 60 + minute;
}

function todayKstDateKey() {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function parseDateKey(dateKey: string) {
  if (!DATE_RE.test(dateKey)) return null;
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date;
}

function addUtcDays(date: Date, days: number) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + days));
}

function addUtcMonthsPreserveDay(date: Date, months: number) {
  const targetMonth = date.getUTCMonth() + months;
  const next = new Date(Date.UTC(date.getUTCFullYear(), targetMonth, date.getUTCDate()));
  const expectedMonth = ((targetMonth % 12) + 12) % 12;
  return next.getUTCMonth() === expectedMonth ? next : null;
}

function formatDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function nthWeekdayDate(year: number, monthIndex: number, nth: number, weekday: number) {
  const first = new Date(Date.UTC(year, monthIndex, 1));
  const firstWeekday = first.getUTCDay();
  const offset = (weekday - firstWeekday + 7) % 7;
  const day = 1 + offset + (nth - 1) * 7;
  const date = new Date(Date.UTC(year, monthIndex, day));
  return date.getUTCMonth() === monthIndex ? date : null;
}

function getMonthlyWeekdayInfo(date: Date) {
  return {
    nth: Math.floor((date.getUTCDate() - 1) / 7) + 1,
    weekday: date.getUTCDay(),
  };
}

function buildReservationDates(
  startDateKey: string,
  repeat?: z.infer<typeof reservationRepeatSchema>
) {
  const startDate = parseDateKey(startDateKey);
  if (!startDate) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "예약 날짜 형식이 올바르지 않습니다." });
  }

  const type = repeat?.type ?? "none";
  if (type === "none") return [startDateKey];

  const untilDate = repeat?.untilDate ? parseDateKey(repeat.untilDate) : null;
  if (repeat?.untilDate && !untilDate) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "반복 종료일 형식이 올바르지 않습니다." });
  }
  if (untilDate && untilDate < startDate) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "반복 종료일은 시작일 이후로 선택해주세요." });
  }

  const limit = Math.min(repeat?.count ?? (untilDate ? 52 : 4), 52);
  const dates: string[] = [];
  const monthlyWeekday = getMonthlyWeekdayInfo(startDate);

  for (let step = 0; dates.length < limit && step < 120; step++) {
    let candidate: Date | null = null;
    if (type === "weekly") candidate = addUtcDays(startDate, step * 7);
    if (type === "biweekly") candidate = addUtcDays(startDate, step * 14);
    if (type === "monthly-date") candidate = addUtcMonthsPreserveDay(startDate, step);
    if (type === "monthly-weekday") {
      const monthStart = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth() + step, 1));
      candidate = nthWeekdayDate(
        monthStart.getUTCFullYear(),
        monthStart.getUTCMonth(),
        monthlyWeekday.nth,
        monthlyWeekday.weekday
      );
    }

    if (!candidate) continue;
    if (untilDate && candidate > untilDate) break;
    dates.push(formatDateKey(candidate));
  }

  if (dates.length < 2) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "반복 예약은 최소 2회 이상 생성되어야 합니다." });
  }
  return dates;
}

function describeReservationRepeat(
  repeat: NonNullable<z.infer<typeof reservationRepeatSchema>>,
  count: number
) {
  const labelByType: Record<NonNullable<typeof repeat>["type"], string> = {
    none: "반복 없음",
    weekly: "매주 반복",
    biweekly: "2주마다 반복",
    "monthly-date": "매월 같은 날짜 반복",
    "monthly-weekday": "매월 같은 주/요일 반복",
  };
  const suffix = repeat.untilDate ? ` · ${repeat.untilDate}까지` : ` · 총 ${count}회`;
  return `${labelByType[repeat.type ?? "none"]}${suffix}`;
}

export const homeRouter = router({
  // ─── 홈페이지 콘텐츠 ────────────────────────────────────────────────────────

  /** 히어로 슬라이드 목록 (공개된 것만) */
  heroSlides: publicProcedure.query(() => getVisibleHeroSlides()),

  /** 퀵메뉴 목록 (공개된 것만) */
  quickMenus: publicProcedure.query(() => getVisibleQuickMenus()),

  /** 교회 소식 최신 5개 (공개된 것만) */
  notices: publicProcedure.query(() => getPublishedNotices(5)),

  /** 교회 소식 게시판 전체 목록 (공개된 것만) */
  noticeBoard: publicProcedure.query(() => getPublishedNotices(100)),

  /** 홈페이지 팝업/공지 배너 (현재 노출 가능한 것만) */
  popups: publicProcedure.query(() => getActiveNoticePopups(3)),

  /** 관련기관 목록 (공개된 것만) */
  affiliates: publicProcedure.query(() => getVisibleAffiliates()),

  /** 갤러리 사진 목록 (공개된 것만) */
  gallery: publicProcedure.query(() => getVisibleGalleryItems()),

  homeGallery: publicProcedure.query(() => getVisibleHomeGalleryItems()),

  /** 사이트 설정 (교회명, 주소, 연락처 등) */
  settings: publicProcedure.query(() => getSiteSettings()),

  /** 섬기는 분 / 교역자 소개 목록 */
  staff: publicProcedure
    .input(z.object({ category: staffCategorySchema.optional() }).optional())
    .query(({ input }) => getVisibleStaffMembers(input?.category)),

  /** 섬기는 분 공개 분류 목록 */
  staffCategories: publicProcedure.query(() => getVisibleStaffCategories()),

  /** 섬기는 분 공개 사역 구분 목록 */
  staffTitleOptions: publicProcedure.query(() => getAllStaffTitleOptions()),

  /** 공개 강좌 목록 */
  courses: publicProcedure.query(() => getVisibleCourses()),

  /** 공개 주보 목록 */
  bulletins: publicProcedure.query(() => listPublishedBulletins()),

  /** 공개 강좌 단건 */
  course: publicProcedure
    .input(z.object({ id: idSchema }))
    .query(({ input }) => getVisibleCourseById(input.id)),

  /** 내 강좌 신청 내역 조회 (성도 본인 것만) */
  myCourseApplications: memberProtectedProcedure
    .query(({ ctx }) => getMyCourseApplications(ctx.memberId)),

  /** 강좌 신청 (성도 로그인 필요) */
  applyCourse: memberProtectedProcedure
    .input(z.object({
      courseId: idSchema,
      applicantName: z.string().trim().min(1, "이름을 입력해주세요.").max(64, "이름은 64자 이하로 입력해주세요."),
      applicantPhone: z.string().trim().max(32, "연락처는 32자 이하로 입력해주세요.").optional(),
      applicantEmail: z.string().trim().max(320, "이메일은 320자 이하로 입력해주세요.").optional(),
      memo: courseMemoSchema,
    }))
    .mutation(async ({ input, ctx }) => {
      const course = await getVisibleCourseById(input.courseId);
      if (!course) {
        throw new TRPCError({ code: "NOT_FOUND", message: "강좌를 찾을 수 없습니다." });
      }
      if (course.status !== "open") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "현재 신청 가능한 강좌가 아닙니다." });
      }
      const today = todayKstDateKey();
      if (course.applyStartDate && today < course.applyStartDate) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "아직 신청 기간이 시작되지 않았습니다." });
      }
      if (course.applyEndDate && today > course.applyEndDate) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "신청 기간이 마감되었습니다." });
      }

      const member = await getMemberById(ctx.memberId);
      if (!member) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "성도 정보를 찾을 수 없습니다." });
      }

      try {
        const id = await createOrReopenCourseApplication({
          courseId: input.courseId,
          memberId: ctx.memberId,
          applicantName: input.applicantName || member.name,
          applicantPhone: input.applicantPhone || member.phone || null,
          applicantEmail: input.applicantEmail || member.email || null,
          memo: input.memo || null,
        });
        if (!id) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "강좌 신청 저장에 실패했습니다." });
        }
        return { id, status: "pending" as const };
      } catch (error) {
        if (error instanceof CourseApplicationConflictError) {
          throw new TRPCError({ code: "CONFLICT", message: error.message });
        }
        if (error instanceof CourseApplicationCapacityError) {
          throw new TRPCError({ code: "BAD_REQUEST", message: error.message });
        }
        if (error instanceof CourseApplicationLockError) {
          throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: error.message });
        }
        throw error;
      }
    }),

  /** 강좌 신청 취소 (성도 본인, 승인 대기 상태만 가능) */
  cancelCourseApplication: memberProtectedProcedure
    .input(z.object({ id: idSchema }))
    .mutation(async ({ input, ctx }) => {
      const cancelled = await cancelMyCourseApplication(input.id, ctx.memberId);
      if (!cancelled) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "취소할 수 없는 신청입니다." });
      }
      return { success: true };
    }),

  /**
   * 코드 기반 페이지의 CMS 콘텐츠 조회
   * - 허용된 정적 페이지 href만 조회하여 site_settings의 다른 값 노출을 막습니다.
   * - DB 값이 없거나 JSON이 깨진 경우 null을 반환하고, 프론트는 코드 기본값을 사용합니다.
   */
  staticPageContent: publicProcedure
    .input(z.object({ href: staticPageHrefSchema }))
    .query(({ input }) => {
      if (!getStaticPageSeed(input.href)) return null;
      return getStaticPageContentByHref(input.href);
    }),

  /**
   * 코드 기반 페이지의 공개 번역 콘텐츠 조회
   * - 현재 1차 지원 언어는 일본어(ja)입니다.
   * - 저장된 번역이 없으면 null을 반환하고, 프론트는 한국어 원문을 사용합니다.
   */
  staticPageTranslation: publicProcedure
    .input(z.object({ href: staticPageHrefSchema, locale: translationLocaleSchema }))
    .query(async ({ input }) => {
      if (!getStaticPageSeed(input.href)) return null;
      const stored = await getStoredTranslation(input.locale, "static_page", input.href);
      return stored?.content ?? null;
    }),

  // ─── 네비게이션 메뉴 ────────────────────────────────────────────────────────

  /** 상단 GNB 메뉴 전체 목록 (서브메뉴 포함, 공개된 것만) */
  menus: publicProcedure.query(() => getVisibleMenus()),

  /** 2단 메뉴 단건 조회 (동적 페이지 렌더링용) */
  menuItem: publicProcedure
    .input(z.object({ id: idSchema }))
    .query(({ input }) => getVisibleMenuItemById(input.id)),

  /** 3단 메뉴 단건 조회 (동적 페이지 렌더링용) */
  menuSubItem: publicProcedure
    .input(z.object({ id: idSchema }))
    .query(({ input }) => getVisibleMenuSubItemById(input.id)),

  /** href(경로)로 2단 메뉴 조회 — 예배영상 페이지의 playlistId 연결에 사용 */
  menuItemByHref: publicProcedure
    .input(z.object({ href: hrefLookupSchema }))
    .query(({ input }) => getVisibleMenuItemByHref(input.href)),

  /** href(경로)로 3단 메뉴 조회 — 예배영상 페이지의 playlistId 연결에 사용 */
  menuSubItemByHref: publicProcedure
    .input(z.object({ href: hrefLookupSchema }))
    .query(({ input }) => getVisibleMenuSubItemByHref(input.href)),

  // ─── 시설 조회 (성도용) ─────────────────────────────────────────────────────

  /** 시설 목록 (공개된 시설만) */
  facilities: publicProcedure.query(() => getFacilities(true)),

  /** 시설 단건 조회 */
  facility: publicProcedure
    .input(z.object({ id: idSchema }))
    .query(({ input }) => getVisibleFacilityById(input.id)),

  /** 시설 사진 목록 */
  facilityImages: publicProcedure
    .input(z.object({ facilityId: idSchema }))
    .query(async ({ input }) => {
      const facility = await getVisibleFacilityById(input.facilityId);
      if (!facility) return [];
      return getFacilityImages(input.facilityId);
    }),

  /** 시설 운영 시간 */
  facilityHours: publicProcedure
    .input(z.object({ facilityId: idSchema }))
    .query(async ({ input }) => {
      const facility = await getVisibleFacilityById(input.facilityId);
      if (!facility) return [];
      return getFacilityHours(input.facilityId);
    }),

  /** 시설 차단 날짜 목록 (예약 불가 날짜) */
  facilityBlockedDates: publicProcedure
    .input(z.object({ facilityId: idSchema }))
    .query(async ({ input }) => {
      const facility = await getVisibleFacilityById(input.facilityId);
      if (!facility) return [];
      return getBlockedDates(input.facilityId);
    }),

  /**
   * 특정 날짜의 예약 목록 (시간 선택 시 중복 방지용)
   * ⚠️ 공개 API — 개인정보 최소 노출 원칙 적용
   * 반환: startTime, endTime, status 만 반환 (예약자 이름/전화번호/메모 등 제외)
   */
  facilityReservationsByDate: publicProcedure
    .input(z.object({
      facilityId: idSchema,
      date: z.string().regex(DATE_RE, "날짜 형식이 올바르지 않습니다."),
    }))
    .query(async ({ input }) => {
      const facility = await getVisibleFacilityById(input.facilityId);
      if (!facility) return [];
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
      facilityId: idSchema,
      reserverName: z.string().min(1, "예약자 이름을 입력해주세요."),
      reserverPhone: z.string().optional(),
      reservationDate: z.string().regex(DATE_RE, "예약 날짜 형식이 올바르지 않습니다."),
      startTime: z.string().regex(TIME_RE, "시작 시간 형식이 올바르지 않습니다."),
      endTime: z.string().regex(TIME_RE, "종료 시간 형식이 올바르지 않습니다."),
      purpose: z.string().min(1, "사용 목적을 입력해주세요."),
      department: z.string().optional(),
      attendees: z.number().int().min(1, "사용 인원은 1명 이상이어야 합니다.").default(1),
      notes: z.string().optional(),
      repeat: reservationRepeatSchema,
    }))
    .mutation(async ({ input, ctx }) => {
      const startMinutes = toMinutes(input.startTime);
      const endMinutes = toMinutes(input.endTime);
      if (startMinutes === null || endMinutes === null) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "예약 시간 형식이 올바르지 않습니다." });
      }
      // ① 시설 존재 여부 확인
      const facility = await getFacilityById(input.facilityId);
      if (!facility || !facility.isVisible) {
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

      const reservationDates = buildReservationDates(input.reservationDate, input.repeat);
      const hours = await getFacilityHours(input.facilityId);
      const blocked = await getBlockedDates(input.facilityId);

      for (const reservationDate of reservationDates) {
        if (reservationDate < todayKstDateKey()) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "지난 날짜는 예약할 수 없습니다.",
          });
        }
        // ④ 운영시간 확인 (해당 요일의 운영시간 조회)
        const reservationDateObject = parseDateKey(reservationDate);
        const reservationDayOfWeek = reservationDateObject?.getUTCDay() ?? 0; // 0=일, 1=월 ...
        const dayHour = hours.find(h => h.dayOfWeek === reservationDayOfWeek);
        if (dayHour) {
          if (!dayHour.isOpen) {
            throw new TRPCError({ code: "BAD_REQUEST", message: `${reservationDate}은 시설 운영일이 아닙니다.` });
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
            message: `${reservationDate}은 운영 시간(${openTime}~${closeTime}) 내에서만 예약 가능합니다.`,
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
            throw new TRPCError({ code: "BAD_REQUEST", message: `${reservationDate} 휴게 시간(${dayHour.breakStart}~${dayHour.breakEnd})에는 예약할 수 없습니다.` });
          }
        }

        // ⑤ 차단일 확인 (전체 차단 또는 해당 시설 차단)
        for (const b of blocked) {
          if (b.blockedDate !== reservationDate) continue;
          if (!b.isPartialBlock) {
            // 하루 전체 차단
            throw new TRPCError({ code: "BAD_REQUEST", message: `${reservationDate}은 예약이 차단된 날입니다.${b.reason ? ` (${b.reason})` : ""}` });
          }
          // 부분 차단: 요청 시간대가 차단 시간대와 겹치는지 확인
          if (b.blockStart && b.blockEnd) {
            const overlapPartial = input.startTime < b.blockEnd && input.endTime > b.blockStart;
            if (overlapPartial) {
              throw new TRPCError({
                code: "BAD_REQUEST",
                message: `${reservationDate} 해당 시간대(${b.blockStart}~${b.blockEnd})는 예약이 차단되어 있습니다.${b.reason ? ` (${b.reason})` : ""}`,
              });
            }
          }
        }

        // ⑥ 같은 시설/날짜의 시간대 겹침 확인 (중복 예약 방지)
        const existing = await getReservationsByDate(input.facilityId, reservationDate);
        const activeReservations = existing.filter(r => r.status !== "cancelled" && r.status !== "rejected");
        for (const r of activeReservations) {
          const overlap = input.startTime < r.endTime && input.endTime > r.startTime;
          if (overlap) {
            throw new TRPCError({
              code: "CONFLICT",
              message: `${reservationDate} 해당 시간대(${r.startTime}~${r.endTime})에 이미 예약이 있습니다. 다른 시간을 선택해 주세요.`,
            });
          }
        }
      }

      // 자동 승인 시설은 바로 approved, 그 외는 pending(관리자 검토 필요)
      const status = facility.approvalType === "auto" ? "approved" : "pending";
      const { repeat, ...baseInput } = input;
      const recurrenceGroupId = reservationDates.length > 1 ? `res_${crypto.randomUUID()}` : null;
      const recurrenceLabel = reservationDates.length > 1 && repeat
        ? describeReservationRepeat(repeat, reservationDates.length)
        : null;
      const createdIds: number[] = [];

      // ctx.memberId = church_members 테이블의 id (성도 로그인 기반)
      try {
        for (let index = 0; index < reservationDates.length; index++) {
          const reservationDate = reservationDates[index];
          const id = await createReservationIfAvailable({
            ...baseInput,
            reservationDate,
            userId: ctx.memberId,
            status,
            recurrenceGroupId,
            recurrenceLabel,
            recurrenceSequence: recurrenceGroupId ? index + 1 : 0,
          });
          if (!id) {
            throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "예약 신청 저장에 실패했습니다." });
          }
          createdIds.push(id);
        }
      } catch (error) {
        if (createdIds.length > 0) {
          await deleteReservationsByIds(createdIds);
        }
        if (error instanceof ReservationOverlapError) {
          throw new TRPCError({ code: "CONFLICT", message: error.message });
        }
        if (error instanceof ReservationLockError) {
          throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: error.message });
        }
        throw error;
      }
      return {
        id: createdIds[0],
        ids: createdIds,
        status,
        count: createdIds.length,
        recurrenceLabel,
      };
    }),

  /** 내 예약 목록 조회 (성도 본인 것만) */
  myReservations: memberProtectedProcedure
    .query(({ ctx }) => getMyReservations(ctx.memberId)),

  /**
   * 예약 취소 (성도 본인만 가능)
   * - 이미 승인된 예약은 취소 불가 (관리자에게 문의 필요)
   */
  cancelReservation: memberProtectedProcedure
    .input(z.object({ id: idSchema }))
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
      menuItemId: idSchema.optional(),
      menuSubItemId: idSchema.optional(),
    }).refine(
      value => (value.menuItemId !== undefined) !== (value.menuSubItemId !== undefined),
      "menuItemId 또는 menuSubItemId 중 하나만 입력해주세요.",
    ))
    .query(({ input }) => getPageBlocks(input)),
});
