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
import { adminPermissionProcedure, publicProcedure, memberProtectedProcedure, router } from "../_core/trpc";
import { notifyCourseApplicationToDistrictManager, notifyFacilityReservation, notifyVehicleReservation } from "../_core/pushNotifications";
import {
  canMemberRequestFacilityReservation,
} from "@shared/facilityReservationEligibility";
import {
  getEffectiveExternalReservationWindow,
  getExternalReservationWindowMessage,
  getFacilityReservationMaxMonths,
  getReservationMaxDateKey,
  isReservationDateAfterMax,
} from "@shared/facilityReservationPolicy";
import {
  getVisibleHeroSlides,
  getVisibleQuickMenus,
  getNoticeById,
  getPublishedNotices,
  getPublishedNoticesByCategory,
  incrementNoticeViewCount,
  getDynamicBoardPostById,
  getPublishedDynamicBoardPosts,
  incrementDynamicBoardPostViewCount,
  getActiveNoticePopups,
  getVisibleAffiliates,
  getVisibleGalleryItems,
  getVisibleHomeGalleryItems,
  getSiteSettings,
  getSiteSetting,
  upsertSiteSetting,
  getVisibleMenus,
  getNavigationMenus,
  getVisibleMenuItemById,
  getVisibleMenuSubItemById,
  getVisibleMenuItemByHref,
  getVisibleMenuSubItemByHref,
  getMenuAccessByHref,
  getMenuAccessById,
  getFacilities,
  getFacilityById,
  getExternalReservableFacilities,
  getExternalReservableFacilityById,
  getFacilityImages,
  getFacilityHours,
  getExternalFacilityHours,
  getBlockedDates,
  getReservationsByDate,
  getAdminReservationDetailsByDate,
  createReservationIfAvailable,
  deleteReservationsByIds,
  getMyReservations,
  getReservationById,
  getReservationsByGroupId,
  updateReservationStatus,
  updateReservationGroupStatus,
  canMemberUseVehicleReservation,
  createVehicleReservationIfAvailable,
  createVehicleReservationsIfAvailable,
  getAvailableVehiclesForSchedule,
  getVehicleAvailabilityTimeline,
  getAdminVehicleReservationDetailsByDate,
  getMyVehicleReservations,
  getVehicleById,
  getVehicleImages,
  getVehicleReservationById,
  getVehicles,
  updateVehicleReservationStatus,
  VehicleReservationLockError,
  VehicleReservationOverlapError,
  getPageBlocks,
  getStaticPageContentByHref,
  getStoredTranslation,
  getVisibleStaffCategories,
  getVisibleStaffMembers,
  getAllStaffTitleOptions,
  listPublishedBulletins,
  incrementBulletinViewCount,
  getPublicHistory,
  getVisibleCourses,
  getVisibleCourseById,
  getVisiblePastorBooks,
  getPastorBookById,
  createOrReopenCourseApplication,
  getMyCourseApplications,
  cancelMyCourseApplication,
  getMemberById,
  hasAdminContentPermission,
  CourseApplicationCapacityError,
  CourseApplicationConflictError,
  CourseApplicationLockError,
  ReservationLockError,
  ReservationOverlapError,
} from "../db";
import { SECRET_POST_MASK_TITLE } from "../db/secretPosts";
import { getStaticPageSeed } from "@shared/staticPageContent";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^(([01]\d|2[0-3]):[0-5]\d|24:00)$/;
const idSchema = z.number().int().positive();
const vehicleRepeatSchema = z.enum(["none", "daily", "weekly", "monthly"]);
const hrefLookupSchema = z.string().trim().min(1).max(256);
const menuBoardCategorySchema = z.string().trim().regex(/^menu-board:[a-z0-9]{1,16}$/);
const dynamicBoardSourceSchema = z.object({
  menuItemId: idSchema.optional(),
  menuSubItemId: idSchema.optional(),
}).refine(
  value => Boolean(value.menuItemId) !== Boolean(value.menuSubItemId),
  "2단 메뉴 또는 3단 메뉴 중 하나만 선택해주세요.",
);

function formatVehicleDateKey(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function isValidVehicleDateKey(dateKey: string) {
  if (!DATE_RE.test(dateKey)) return false;
  const [year, month, day] = dateKey.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

function getVehicleReservationDates(
  startDate: string,
  repeatMode: z.infer<typeof vehicleRepeatSchema>,
  repeatEndDate?: string | null,
) {
  if (!isValidVehicleDateKey(startDate)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "예약 날짜가 올바르지 않습니다." });
  }
  if (repeatMode === "none") return [startDate];
  if (!repeatEndDate) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "반복 예약의 종료일을 선택해주세요." });
  }
  if (!isValidVehicleDateKey(repeatEndDate)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "반복 종료일이 올바르지 않습니다." });
  }
  if (repeatEndDate < startDate) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "반복 종료일은 시작일 이후여야 합니다." });
  }

  const [startYear, startMonth, startDay] = startDate.split("-").map(Number);
  const [endYear, endMonth, endDay] = repeatEndDate.split("-").map(Number);
  const dates: string[] = [];
  const pushDate = (year: number, month: number, day: number) => {
    const key = formatVehicleDateKey(year, month, day);
    if (key > repeatEndDate) return;
    if (dates.length >= 100) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "반복 예약은 한 번에 최대 100회까지 신청할 수 있습니다." });
    }
    dates.push(key);
  };

  if (repeatMode === "monthly") {
    let year = startYear;
    let month = startMonth;
    while (formatVehicleDateKey(year, month, 1) <= formatVehicleDateKey(endYear, endMonth, 1)) {
      const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
      if (startDay <= lastDay) pushDate(year, month, startDay);
      month += 1;
      if (month === 13) {
        month = 1;
        year += 1;
      }
    }
  } else {
    const cursor = new Date(Date.UTC(startYear, startMonth - 1, startDay));
    const end = new Date(Date.UTC(endYear, endMonth - 1, endDay));
    const stepDays = repeatMode === "weekly" ? 7 : 1;
    while (cursor <= end) {
      pushDate(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, cursor.getUTCDate());
      cursor.setUTCDate(cursor.getUTCDate() + stepDays);
    }
  }

  return dates;
}

function getMenuReadAccess(ctx: { user?: unknown; memberId?: number | null }) {
  return ctx.user || ctx.memberId ? "member" : "guest";
}

function normalizeMenuLabel(label: string | null | undefined) {
  return (label ?? "").replace(/\s+/g, "");
}

function canReadBulletinFromVisibleMenus(menus: Awaited<ReturnType<typeof getVisibleMenus>>) {
  for (const menu of menus) {
    for (const item of menu.items ?? []) {
      if (item.href === "/worship/bulletin" || normalizeMenuLabel(item.label) === "주보보기") {
        return true;
      }

      for (const subItem of item.subItems ?? []) {
        if (subItem.href === "/worship/bulletin" || normalizeMenuLabel(subItem.label) === "주보보기") {
          return true;
        }
      }
    }
  }

  return false;
}

async function canContextReadBulletins(ctx: { user?: AdminPermissionUser; memberId?: number | null }) {
  if (hasAdminContentPermission(ctx.user, "content:bulletins")) return true;
  const access = getMenuReadAccess(ctx);
  const [visibleMenus, menuItem, menuSubItem] = await Promise.all([
    getVisibleMenus(access),
    getVisibleMenuItemByHref("/worship/bulletin", access),
    getVisibleMenuSubItemByHref("/worship/bulletin", access),
  ]);
  return Boolean(menuItem || menuSubItem || canReadBulletinFromVisibleMenus(visibleMenus));
}

type MenuTreeNode = {
  href?: string | null;
  items?: MenuTreeNode[];
  subItems?: MenuTreeNode[];
};

function isVehicleReservationHref(href: string | null | undefined) {
  return href === "/support/vehicle" ||
    href === "/admin/vehicle" ||
    Boolean(href?.startsWith("/support/vehicle/"));
}

function filterVehicleReservationMenu<T extends MenuTreeNode>(node: T, canUseVehicleReservation: boolean): T | null {
  if (canUseVehicleReservation) return node;
  if (isVehicleReservationHref(node.href)) return null;

  const nextNode: MenuTreeNode = { ...node };
  if (node.items) {
    nextNode.items = node.items
      .map(item => filterVehicleReservationMenu(item, canUseVehicleReservation))
      .filter((item): item is MenuTreeNode => Boolean(item));
  }
  if (node.subItems) {
    nextNode.subItems = node.subItems
      .map(item => filterVehicleReservationMenu(item, canUseVehicleReservation))
      .filter((item): item is MenuTreeNode => Boolean(item));
  }
  return nextNode as T;
}

type AdminPermissionUser = Parameters<typeof hasAdminContentPermission>[0];

function hasFacilityReservationManagerPermission(user: AdminPermissionUser) {
  return hasAdminContentPermission(user, "content:reservations") ||
    hasAdminContentPermission(user, "content:facilities");
}

function canContextViewNoticeSecret(ctx: { user?: AdminPermissionUser }) {
  return hasAdminContentPermission(ctx.user, "content:notices");
}

type SecretBoardPost = {
  isSecret: boolean;
  title: string;
  content: string | null;
  thumbnailUrl: string | null;
  attachmentName?: string | null;
  attachmentUrl?: string | null;
};

function applySecretBoardMask<T extends SecretBoardPost>(post: T, canViewSecret: boolean) {
  if (!post.isSecret || canViewSecret) {
    return {
      ...post,
      canViewSecret: true,
    };
  }

  return {
    ...post,
    title: SECRET_POST_MASK_TITLE,
    content: null,
    thumbnailUrl: null,
    attachmentName: null,
    attachmentUrl: null,
    canViewSecret: false,
  };
}

async function canContextUseVehicleReservation(ctx: { user?: AdminPermissionUser; memberId?: number | null }) {
  if (hasAdminContentPermission(ctx.user, "content:vehicles")) return true;
  if (!ctx.memberId) return false;
  const member = await getMemberById(ctx.memberId);
  return canMemberUseVehicleReservation(member);
}

const staticPageHrefSchema = z.string().trim().min(1).max(128).regex(/^\//);
const staffCategorySchema = z.string().trim().min(1).max(64).regex(/^[a-z0-9][a-z0-9_-]{0,63}$/);
const translationLocaleSchema = z.enum(["ja"]);
const courseMemoSchema = z.string().trim().max(2000, "신청 메모는 2000자 이하로 입력해주세요.").optional();
const courseCustomAnswersSchema = z.record(z.string().max(64), z.string().trim().max(1000)).default({});
const externalFacilityRulesSettingKey = "external_facility_rules";

function parseCourseApplicationFields(value: string | null | undefined) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((field) => ({
        id: typeof field?.id === "string" ? field.id.trim() : "",
        label: typeof field?.label === "string" ? field.label.trim() : "",
        required: Boolean(field?.required),
      }))
      .filter((field) => field.id && field.label);
  } catch {
    return [];
  }
}

function serializeCourseApplicationAnswers(
  answers: Record<string, string>,
  fields: ReturnType<typeof parseCourseApplicationFields>,
) {
  const labels = new Map(fields.map((field) => [field.id, field.label]));
  return Object.fromEntries(
    Object.entries(answers).map(([fieldId, answer]) => [
      fieldId,
      { label: labels.get(fieldId) || "추가 답변", value: answer },
    ]),
  );
}

const reservationRepeatSchema = z.object({
  type: z.enum(["none", "daily", "weekly", "monthly-weekday"]).default("none"),
  count: z.number().int().min(1).max(52).optional(),
  untilDate: z.string().regex(DATE_RE, "반복 종료일 형식이 올바르지 않습니다.").optional(),
}).optional();
const MAX_REPEAT_OCCURRENCES = 366;
const MAX_REPEAT_SEARCH_STEPS = 1200;
const MIN_RESERVATION_LEAD_TIME_MS = 24 * 60 * 60 * 1000;

async function getVisibleFacilityById(id: number) {
  const facility = await getFacilityById(id);
  return facility?.isVisible ? facility : null;
}

async function getVisibleVehicleById(id: number) {
  const vehicle = await getVehicleById(id);
  return vehicle?.isVisible ? vehicle : null;
}

function toMinutes(time: string): number | null {
  if (!TIME_RE.test(time)) return null;
  const [hour, minute] = time.split(":").map(Number);
  if (hour === 24 && minute === 0) return 24 * 60;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return hour * 60 + minute;
}

function todayKstDateKey() {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function getKstDateTime(dateKey: string, time: string) {
  if (!DATE_RE.test(dateKey) || !TIME_RE.test(time)) return null;
  const [year, month, day] = dateKey.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, hour - 9, minute));
  return Number.isNaN(date.getTime()) ? null : date;
}

function getReservationStartOrThrow(dateKey: string, startTime: string) {
  const startAt = getKstDateTime(dateKey, startTime);
  if (!startAt) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "예약 날짜와 시간이 올바르지 않습니다." });
  }
  return startAt;
}

function assertReservationStartsInFuture(dateKey: string, startTime: string) {
  const startAt = getReservationStartOrThrow(dateKey, startTime);
  if (startAt.getTime() <= Date.now()) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "이미 시작했거나 지난 시간은 예약할 수 없습니다.",
    });
  }
  return startAt;
}

function assertReservationLeadTime(dateKey: string, startTime: string) {
  const startAt = assertReservationStartsInFuture(dateKey, startTime);
  if (startAt.getTime() - Date.now() < MIN_RESERVATION_LEAD_TIME_MS) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "시설 예약은 최소 24시간 전까지만 신청할 수 있습니다. 당일 또는 24시간 이내 예약은 교회 사무국에 문의해주세요.",
    });
  }
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

  if (!repeat?.untilDate) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "반복 종료일을 선택해주세요." });
  }

  const untilDate = parseDateKey(repeat.untilDate);
  if (!untilDate) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "반복 종료일 형식이 올바르지 않습니다." });
  }
  if (untilDate < startDate) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "반복 종료일은 시작일 이후로 선택해주세요." });
  }

  const dates: string[] = [];
  const monthlyWeekday = getMonthlyWeekdayInfo(startDate);
  let stoppedByEndDate = false;

  for (let step = 0; step < MAX_REPEAT_SEARCH_STEPS; step++) {
    let candidate: Date | null = null;
    if (type === "daily") candidate = addUtcDays(startDate, step);
    if (type === "weekly") candidate = addUtcDays(startDate, step * 7);
    if (type === "monthly-weekday") {
      const monthStart = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth() + step, 1));
      if (monthStart > untilDate) {
        stoppedByEndDate = true;
        break;
      }
      candidate = nthWeekdayDate(
        monthStart.getUTCFullYear(),
        monthStart.getUTCMonth(),
        monthlyWeekday.nth,
        monthlyWeekday.weekday
      );
    }

    if (!candidate) continue;
    if (candidate > untilDate) {
      stoppedByEndDate = true;
      break;
    }
    if (dates.length >= MAX_REPEAT_OCCURRENCES) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `반복 예약은 한 번에 최대 ${MAX_REPEAT_OCCURRENCES}건까지 신청할 수 있습니다.`,
      });
    }
    dates.push(formatDateKey(candidate));
  }

  if (!stoppedByEndDate && dates.length >= MAX_REPEAT_OCCURRENCES) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `반복 예약은 한 번에 최대 ${MAX_REPEAT_OCCURRENCES}건까지 신청할 수 있습니다.`,
    });
  }
  if (!stoppedByEndDate && dates.length > 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "반복 기간이 너무 깁니다. 종료일을 앞당겨 주세요.",
    });
  }
  return dates;
}

function describeReservationRepeat(
  repeat: NonNullable<z.infer<typeof reservationRepeatSchema>>,
  count: number
) {
  const labelByType: Record<NonNullable<typeof repeat>["type"], string> = {
    none: "반복 없음",
    daily: "매일 반복",
    weekly: "매주 반복",
    "monthly-weekday": "매월 같은 주 반복",
  };
  const suffix = repeat.untilDate ? ` · ${repeat.untilDate}까지 · 총 ${count}회` : ` · 총 ${count}회`;
  return `${labelByType[repeat.type ?? "none"]}${suffix}`;
}

export const homeRouter = router({
  // ─── 홈페이지 콘텐츠 ────────────────────────────────────────────────────────

  /** 히어로 슬라이드 목록 (공개된 것만) */
  heroSlides: publicProcedure.query(() => getVisibleHeroSlides()),

  /** 퀵메뉴 목록 (공개된 것만) */
  quickMenus: publicProcedure.query(() => getVisibleQuickMenus()),

  /** 교회 소식 최신 5개 (공개된 것만) */
  notices: publicProcedure.query(async ({ ctx }) => {
    const canViewSecret = canContextViewNoticeSecret(ctx);
    return (await getPublishedNotices(5)).map((post) => applySecretBoardMask(post, canViewSecret));
  }),

  /** 교회 소식 게시판 전체 목록 (공개된 것만) */
  noticeBoard: publicProcedure.query(async ({ ctx }) => {
    const canViewSecret = canContextViewNoticeSecret(ctx);
    return (await getPublishedNotices(100)).map((post) => applySecretBoardMask(post, canViewSecret));
  }),

  /** 메뉴별 독립 게시판 목록 */
  menuBoard: publicProcedure
    .input(z.object({ category: menuBoardCategorySchema }))
    .query(async ({ input, ctx }) => {
      const canViewSecret = canContextViewNoticeSecret(ctx);
      return (await getPublishedNoticesByCategory(input.category, 100))
        .map((post) => applySecretBoardMask(post, canViewSecret));
    }),

  /** 메뉴별 독립 게시판 목록 */
  dynamicBoardPosts: publicProcedure
    .input(dynamicBoardSourceSchema)
    .query(async ({ input, ctx }) => {
      const canViewSecret = canContextViewNoticeSecret(ctx);
      return (await getPublishedDynamicBoardPosts(input, 100))
        .map((post) => applySecretBoardMask(post, canViewSecret));
    }),

  trackDynamicBoardPostView: publicProcedure
    .input(z.object({ id: idSchema }))
    .mutation(async ({ input, ctx }) => {
      const post = await getDynamicBoardPostById(input.id);
      if (!post || !post.isPublished) return { success: true };
      if (post.isSecret && !canContextViewNoticeSecret(ctx)) return { success: true };
      await incrementDynamicBoardPostViewCount(input.id);
      return { success: true };
    }),

  trackNoticeView: publicProcedure
    .input(z.object({ id: idSchema }))
    .mutation(async ({ input, ctx }) => {
      const notice = await getNoticeById(input.id);
      if (!notice || !notice.isPublished) return { success: true };
      if (notice.isSecret && !canContextViewNoticeSecret(ctx)) return { success: true };
      await incrementNoticeViewCount(input.id);
      return { success: true };
    }),

  /** 행정자료 게시판 전체 목록 (공개된 것만) */
  adminResourceBoard: publicProcedure.query(() => getPublishedNoticesByCategory("행정자료", 100)),

  /** 홈페이지 팝업/공지 배너 (현재 노출 가능한 것만) */
  popups: publicProcedure.query(({ ctx }) =>
    getActiveNoticePopups(10, new Date(), ctx.user || ctx.memberId ? "member" : "guest")
  ),

  /** 관련기관 목록 (공개된 것만) */
  affiliates: publicProcedure.query(() => getVisibleAffiliates()),

  /** 갤러리 사진 목록 (공개된 것만) */
  gallery: publicProcedure
    .input(z.object({ galleryScopeKey: z.string().trim().min(1).max(96) }))
    .query(({ input }) => getVisibleGalleryItems(input.galleryScopeKey)),

  homeGallery: publicProcedure.query(() => getVisibleHomeGalleryItems()),

  /** 사이트 설정 (교회명, 주소, 연락처 등) */
  settings: publicProcedure.query(() => getSiteSettings()),

  getVapidPublicKey: publicProcedure.query(() => process.env.VAPID_PUBLIC_KEY ?? ""),

  getExternalFacilityRules: publicProcedure.query(async () => {
    const setting = await getSiteSetting(externalFacilityRulesSettingKey);
    return setting?.settingValue ?? "";
  }),

  setExternalFacilityRules: adminPermissionProcedure("content:facilities")
    .input(z.object({ rules: z.string().max(20000) }))
    .mutation(({ input }) => upsertSiteSetting(externalFacilityRulesSettingKey, input.rules)),

  /** 교회연혁 공개 데이터 */
  history: publicProcedure.query(() => getPublicHistory()),

  /** 섬기는 분 / 교역자 소개 목록 */
  staff: publicProcedure
    .input(z.object({ category: staffCategorySchema.optional() }).optional())
    .query(({ input }) => getVisibleStaffMembers(input?.category)),

  /** 섬기는 분 공개 분류 목록 */
  staffCategories: publicProcedure.query(() => getVisibleStaffCategories()),

  /** 섬기는 분 공개 사역 구분 목록 */
  staffTitleOptions: publicProcedure.query(() => getAllStaffTitleOptions()),

  /** 공개 강좌 목록 */
  courses: publicProcedure
    .input(z.object({ pageHref: hrefLookupSchema.nullable().optional() }).optional())
    .query(({ input, ctx }) => getVisibleCourses({
      pageHref: input?.pageHref ?? null,
      audience: getMenuReadAccess(ctx),
    })),

  /** 담임목사 저서 목록 */
  pastorBooks: publicProcedure.query(() => getVisiblePastorBooks()),

  /** 담임목사 저서 상세 */
  pastorBook: publicProcedure
    .input(z.object({ id: idSchema }))
    .query(({ input }) => getPastorBookById(input.id, false)),

  /** 성도 이상 주보 목록 */
  bulletins: publicProcedure.query(async ({ ctx }) => {
    if (!(await canContextReadBulletins(ctx))) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "주보 보기는 성도 로그인 후 이용할 수 있습니다.",
      });
    }
    return listPublishedBulletins();
  }),

  trackBulletinView: publicProcedure
    .input(z.object({ id: idSchema }))
    .mutation(async ({ input, ctx }) => {
      if (!(await canContextReadBulletins(ctx))) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "주보 보기는 성도 로그인 후 이용할 수 있습니다.",
        });
      }
      return incrementBulletinViewCount(input.id);
    }),

  /** 공개 강좌 단건 */
  course: publicProcedure
    .input(z.object({ id: idSchema }))
    .query(async ({ input, ctx }) => {
      const course = await getVisibleCourseById(input.id);
      if (!course) return null;
      if (course.audience === "member" && getMenuReadAccess(ctx) !== "member") return null;
      return course;
    }),

  /** 내 강좌 신청 내역 조회 (성도 본인 것만) */
  myCourseApplications: memberProtectedProcedure
    .query(({ ctx }) => getMyCourseApplications(ctx.memberId)),

  /** 강좌 신청 (전체 공개 강좌는 비회원 허용, 성도 공개 강좌는 로그인 필요) */
  applyCourse: publicProcedure
    .input(z.object({
      courseId: idSchema,
      applicantName: z.string().trim().min(1, "이름을 입력해주세요.").max(64, "이름은 64자 이하로 입력해주세요."),
      applicantPhone: z.string().trim().max(32, "연락처는 32자 이하로 입력해주세요.").optional(),
      applicantEmail: z.string().trim().email("올바른 이메일 형식을 입력해주세요.").max(320, "이메일은 320자 이하로 입력해주세요.").optional(),
      memo: courseMemoSchema,
      customAnswers: courseCustomAnswersSchema.optional(),
      privacyAgreed: z.boolean().optional(),
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
      const customAnswers = input.customAnswers ?? {};
      const applicationFields = parseCourseApplicationFields(course.applicationFields);
      const missingRequiredField = applicationFields.find((field) =>
        field.required && !String(customAnswers[field.id] ?? "").trim()
      );
      if (missingRequiredField) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `${missingRequiredField.label} 항목을 입력해주세요.` });
      }

      const member = ctx.memberId ? await getMemberById(ctx.memberId) : null;
      if (course.audience === "member" && !member) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "성도 공개 강좌는 로그인 후 신청할 수 있습니다." });
      }

      const applicantName = input.applicantName || member?.name || "";
      const applicantPhone = (input.applicantPhone || member?.phone || "").replace(/[^0-9+]/g, "");
      const applicantEmail = input.applicantEmail || member?.email || null;
      if (!applicantPhone) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "연락처를 입력해주세요." });
      }
      if (!applicantEmail) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "이메일을 입력해주세요." });
      }
      if (!member && input.privacyAgreed !== true) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "개인정보 수집 및 이용에 동의해주세요." });
      }

      try {
        const id = await createOrReopenCourseApplication({
          courseId: input.courseId,
          memberId: member?.id ?? null,
          applicantName,
          applicantPhone,
          applicantEmail,
          memo: input.memo || null,
          // Preserve the question shown at submission time so later field edits do not break past exports.
          customAnswers: JSON.stringify(serializeCourseApplicationAnswers(customAnswers, applicationFields)),
        });
        if (!id) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "강좌 신청 저장에 실패했습니다." });
        }
        if (member) {
          notifyCourseApplicationToDistrictManager({
            applicantName,
            applicantDistrict: member.district,
            courseTitle: course.title,
            applicationId: id,
          });
        }
        return { id, status: "pending" as const, guest: !member };
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
  menus: publicProcedure.query(async ({ ctx }) => {
    const menuList = await getNavigationMenus();
    const canUseVehicleReservation = await canContextUseVehicleReservation(ctx);
    return menuList
      .map(menu => filterVehicleReservationMenu(menu, canUseVehicleReservation))
      .filter((menu): menu is NonNullable<typeof menu> => Boolean(menu));
  }),

  /** 2단 메뉴 단건 조회 (동적 페이지 렌더링용) */
  menuItem: publicProcedure
    .input(z.object({ id: idSchema }))
    .query(({ input, ctx }) => getVisibleMenuItemById(input.id, getMenuReadAccess(ctx))),

  /** 3단 메뉴 단건 조회 (동적 페이지 렌더링용) */
  menuSubItem: publicProcedure
    .input(z.object({ id: idSchema }))
    .query(({ input, ctx }) => getVisibleMenuSubItemById(input.id, getMenuReadAccess(ctx))),

  /** href(경로)로 2단 메뉴 조회 — 예배영상 페이지의 playlistId 연결에 사용 */
  menuItemByHref: publicProcedure
    .input(z.object({ href: hrefLookupSchema }))
    .query(async ({ input, ctx }) => {
      if (isVehicleReservationHref(input.href) && !(await canContextUseVehicleReservation(ctx))) {
        return null;
      }
      return getVisibleMenuItemByHref(input.href, getMenuReadAccess(ctx));
    }),

  /** href(경로)로 3단 메뉴 조회 — 예배영상 페이지의 playlistId 연결에 사용 */
  menuSubItemByHref: publicProcedure
    .input(z.object({ href: hrefLookupSchema }))
    .query(async ({ input, ctx }) => {
      if (isVehicleReservationHref(input.href) && !(await canContextUseVehicleReservation(ctx))) {
        return null;
      }
      return getVisibleMenuSubItemByHref(input.href, getMenuReadAccess(ctx));
    }),

  menuAccessByHref: publicProcedure
    .input(z.object({ href: hrefLookupSchema }))
    .query(({ input, ctx }) => getMenuAccessByHref(input.href, getMenuReadAccess(ctx))),

  menuAccessById: publicProcedure
    .input(z.object({
      kind: z.enum(["menu", "item", "subItem"]),
      id: idSchema,
    }))
    .query(({ input, ctx }) => getMenuAccessById(input.kind, input.id, getMenuReadAccess(ctx))),

  // ─── 시설 조회 (성도용) ─────────────────────────────────────────────────────

  /** 시설 목록 (공개된 시설만) */
  facilities: publicProcedure.query(() => getFacilities(true)),

  /** 시설 단건 조회 */
  facility: publicProcedure
    .input(z.object({ id: idSchema }))
    .query(({ input }) => getVisibleFacilityById(input.id)),

  /** 외부인 예약에 공개된 시설 목록 */
  externalFacilities: publicProcedure.query(() => getExternalReservableFacilities()),

  /** 외부인 예약에 공개된 시설 단건 조회 */
  externalFacility: publicProcedure
    .input(z.object({ id: idSchema }))
    .query(({ input }) => getExternalReservableFacilityById(input.id)),

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

  /** 외부인 예약 화면 전용 시설 운영 시간 */
  externalFacilityHours: publicProcedure
    .input(z.object({ facilityId: idSchema }))
    .query(async ({ input }) => {
      const facility = await getExternalReservableFacilityById(input.facilityId);
      if (!facility) return [];
      return getExternalFacilityHours(input.facilityId);
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
    .query(async ({ input, ctx }) => {
      const facility = await getVisibleFacilityById(input.facilityId);
      if (!facility) return [];
      if (hasAdminContentPermission(ctx.user, "content:reservations")) {
        return getAdminReservationDetailsByDate(input.facilityId, input.date);
      }
      const rows = await getReservationsByDate(input.facilityId, input.date);
      // 공개 화면에는 시간대와 상태만 반환 — 개인정보 필드 제거
      return rows.map(({ startTime, endTime, status }) => ({ startTime, endTime, status }));
    }),

  /**
   * 외부인 시설 예약 신청
   * - 로그인 없이 신청할 수 있지만, 관리자가 외부인 공개로 체크한 시설만 허용합니다.
   * - 시간표와 중복 방지는 성도 예약과 같은 reservations 테이블/락을 공유합니다.
   */
  createExternalReservation: publicProcedure
    .input(z.object({
      facilityId: idSchema,
      reserverName: z.string().trim().min(1, "예약자 이름을 입력해주세요.").max(64, "예약자 이름은 64자 이하로 입력해주세요."),
      reserverPhone: z.string().trim().min(1, "연락처를 입력해주세요.").max(32, "연락처는 32자 이하로 입력해주세요."),
      reservationDate: z.string().regex(DATE_RE, "예약 날짜 형식이 올바르지 않습니다."),
      startTime: z.string().regex(TIME_RE, "시작 시간 형식이 올바르지 않습니다."),
      endTime: z.string().regex(TIME_RE, "종료 시간 형식이 올바르지 않습니다."),
      purpose: z.string().trim().min(1, "사용 목적을 입력해주세요.").max(256, "사용 목적은 256자 이하로 입력해주세요."),
      department: z.string().trim().max(128, "소속/단체는 128자 이하로 입력해주세요.").optional(),
      attendees: z.number().int().min(1, "사용 인원은 1명 이상이어야 합니다.").default(1),
      notes: z.string().trim().max(2000, "추가 요청사항은 2000자 이하로 입력해주세요.").optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const canBypassReservationRules = hasFacilityReservationManagerPermission(ctx.user);
      const startMinutes = toMinutes(input.startTime);
      const endMinutes = toMinutes(input.endTime);
      if (startMinutes === null || endMinutes === null) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "예약 시간 형식이 올바르지 않습니다." });
      }
      if (startMinutes >= endMinutes) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "시작 시간은 종료 시간보다 빨라야 합니다." });
      }

      const facility = await getExternalReservableFacilityById(input.facilityId);
      if (!facility) {
        throw new TRPCError({ code: "NOT_FOUND", message: "외부인 예약이 가능한 시설을 찾을 수 없습니다." });
      }
      if (input.attendees > facility.capacity && !canBypassReservationRules) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `최대 수용 인원(${facility.capacity}명)을 초과할 수 없습니다.` });
      }

      const todayDateKey = todayKstDateKey();
      if (input.reservationDate < todayDateKey) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "지난 날짜는 예약할 수 없습니다." });
      }

      const reservationSettings = await getSiteSettings();
      const externalReservationWindow = getEffectiveExternalReservationWindow(
        todayDateKey,
        reservationSettings,
        facility,
      );
      if (!canBypassReservationRules && isReservationDateAfterMax(input.reservationDate, externalReservationWindow.effectiveMaxDateKey)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: getExternalReservationWindowMessage(externalReservationWindow),
        });
      }

      if (!canBypassReservationRules) {
        assertReservationLeadTime(input.reservationDate, input.startTime);
      }

      const hours = await getExternalFacilityHours(input.facilityId);
      const reservationDateObject = parseDateKey(input.reservationDate);
      const reservationDayOfWeek = reservationDateObject?.getUTCDay() ?? 0;
      const dayHour = hours.find(h => h.dayOfWeek === reservationDayOfWeek);
      if (dayHour && !dayHour.isOpen && !canBypassReservationRules) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `${input.reservationDate}은 시설 운영일이 아닙니다.` });
      }

      const openTime = dayHour?.openTime ?? facility.openTime;
      const closeTime = dayHour?.closeTime ?? facility.closeTime;
      const openMinutes = toMinutes(openTime);
      const closeMinutes = toMinutes(closeTime);
      if (openMinutes === null || closeMinutes === null) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "시설 운영 시간이 올바르지 않습니다. 관리자에게 문의해주세요." });
      }
      if ((startMinutes < openMinutes || endMinutes > closeMinutes) && !canBypassReservationRules) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `${input.reservationDate}은 운영 시간(${openTime}~${closeTime}) 내에서만 예약 가능합니다.`,
        });
      }

      const slotMinutes = facility.slotMinutes > 0 ? facility.slotMinutes : 60;
      const durationMinutes = endMinutes - startMinutes;
      if (!canBypassReservationRules && ((startMinutes - openMinutes) % slotMinutes !== 0 || (endMinutes - openMinutes) % slotMinutes !== 0)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `${slotMinutes}분 단위로만 예약할 수 있습니다.` });
      }

      if (dayHour?.breakStart && dayHour.breakEnd && !canBypassReservationRules) {
        const breakStart = toMinutes(dayHour.breakStart);
        const breakEnd = toMinutes(dayHour.breakEnd);
        if (breakStart !== null && breakEnd !== null && startMinutes < breakEnd && endMinutes > breakStart) {
          throw new TRPCError({ code: "BAD_REQUEST", message: `${input.reservationDate} 휴게 시간(${dayHour.breakStart}~${dayHour.breakEnd})에는 예약할 수 없습니다.` });
        }
      }

      if (!canBypassReservationRules) {
        const blocked = await getBlockedDates(input.facilityId);
        for (const b of blocked) {
          if (b.blockedDate !== input.reservationDate) continue;
          if (!b.isPartialBlock) {
            throw new TRPCError({ code: "BAD_REQUEST", message: `${input.reservationDate}은 예약이 차단된 날입니다.${b.reason ? ` (${b.reason})` : ""}` });
          }
          if (b.blockStart && b.blockEnd && input.startTime < b.blockEnd && input.endTime > b.blockStart) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `${input.reservationDate} 해당 시간대(${b.blockStart}~${b.blockEnd})는 예약이 차단되어 있습니다.${b.reason ? ` (${b.reason})` : ""}`,
            });
          }
        }
      }

      const existing = await getReservationsByDate(input.facilityId, input.reservationDate);
      const activeReservations = existing.filter(r => r.status !== "cancelled" && r.status !== "rejected");
      for (const r of activeReservations) {
        const overlap = input.startTime < r.endTime && input.endTime > r.startTime;
        if (overlap) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `${input.reservationDate} ${r.startTime}~${r.endTime} 예약과 시간이 겹칩니다. 중복 예약은 저장되지 않았습니다. 다른 시간을 선택해 주세요.`,
          });
        }
      }

      const status: "approved" | "pending" = canBypassReservationRules ? "approved" : "pending";

      try {
        const id = await createReservationIfAvailable({
          ...input,
          userId: null,
          reservationType: "external",
          status,
          recurrenceGroupId: null,
          recurrenceLabel: null,
          recurrenceSequence: 0,
        });
        if (!id) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "예약 신청 저장에 실패했습니다." });
        }
        void notifyFacilityReservation({
          reserverName: input.reserverName,
          facilityName: facility.name,
          date: input.reservationDate,
          startTime: input.startTime,
          endTime: input.endTime,
          reservationType: "external",
          reservationId: id,
          status,
        });
        return { id, status, count: 1, recurrenceLabel: null };
      } catch (error) {
        if (error instanceof ReservationOverlapError) {
          throw new TRPCError({ code: "CONFLICT", message: error.message });
        }
        if (error instanceof ReservationLockError) {
          throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: error.message });
        }
        throw error;
      }
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
      const member = await getMemberById(ctx.memberId);
      const canManageFacilityReservations = hasFacilityReservationManagerPermission(ctx.user);
      if (!member || (!canMemberRequestFacilityReservation(member) && !canManageFacilityReservations)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "시설 사용 예약은 교회 등록 성도만 신청할 수 있습니다. 관리자에게 문의해 주세요.",
        });
      }
      const canBypassReservationRules = canManageFacilityReservations;

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
      if (!facility.isReservable && !canBypassReservationRules) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "현재 예약이 불가능한 시설입니다." });
      }
      if (input.attendees > facility.capacity && !canBypassReservationRules) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `최대 수용 인원(${facility.capacity}명)을 초과할 수 없습니다.` });
      }
      // ③ 시작시간 < 종료시간 확인
      if (startMinutes >= endMinutes) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "시작 시간은 종료 시간보다 빨라야 합니다." });
      }

      const reservationDates = buildReservationDates(input.reservationDate, input.repeat);
      const todayDateKey = todayKstDateKey();
      const reservationSettings = await getSiteSettings();
      const reservationMaxMonths = getFacilityReservationMaxMonths(reservationSettings);
      const reservationMaxDateKey = getReservationMaxDateKey(todayDateKey, reservationMaxMonths);
      const hours = await getFacilityHours(input.facilityId);
      const blocked = await getBlockedDates(input.facilityId);
      for (const reservationDate of reservationDates) {
        if (reservationDate < todayDateKey) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "지난 날짜는 예약할 수 없습니다.",
          });
        }
        if (!canBypassReservationRules && isReservationDateAfterMax(reservationDate, reservationMaxDateKey)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `시설 예약은 최대 ${reservationMaxMonths}개월 후(${reservationMaxDateKey})까지만 신청할 수 있습니다.`,
          });
        }
        assertReservationStartsInFuture(reservationDate, input.startTime);
        // ④ 운영시간 확인 (해당 요일의 운영시간 조회)
        if (!canBypassReservationRules) {
          assertReservationLeadTime(reservationDate, input.startTime);
        }
        const reservationDateObject = parseDateKey(reservationDate);
        const reservationDayOfWeek = reservationDateObject?.getUTCDay() ?? 0; // 0=일, 1=월 ...
        const dayHour = hours.find(h => h.dayOfWeek === reservationDayOfWeek);
        if (dayHour) {
          if (!dayHour.isOpen && !canBypassReservationRules) {
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
        if ((startMinutes < openMinutes || endMinutes > closeMinutes) && !canBypassReservationRules) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `${reservationDate}은 운영 시간(${openTime}~${closeTime}) 내에서만 예약 가능합니다.`,
          });
        }

        const slotMinutes = facility.slotMinutes > 0 ? facility.slotMinutes : 60;
        const durationMinutes = endMinutes - startMinutes;
        if (!canBypassReservationRules && ((startMinutes - openMinutes) % slotMinutes !== 0 || (endMinutes - openMinutes) % slotMinutes !== 0)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: `${slotMinutes}분 단위로만 예약할 수 있습니다.` });
        }

        if (dayHour?.breakStart && dayHour.breakEnd && !canBypassReservationRules) {
          const breakStart = toMinutes(dayHour.breakStart);
          const breakEnd = toMinutes(dayHour.breakEnd);
          if (breakStart !== null && breakEnd !== null && startMinutes < breakEnd && endMinutes > breakStart) {
            throw new TRPCError({ code: "BAD_REQUEST", message: `${reservationDate} 휴게 시간(${dayHour.breakStart}~${dayHour.breakEnd})에는 예약할 수 없습니다.` });
          }
        }

        // ⑤ 차단일 확인 (전체 차단 또는 해당 시설 차단)
        if (!canBypassReservationRules) {
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
        }

        // 예외 권한자는 날짜/운영 제한은 넘길 수 있지만,
        // 이미 잡힌 예약 시간과 겹치는 것은 누구에게도 허용하지 않는다.
        const existing = await getReservationsByDate(input.facilityId, reservationDate);
        const activeReservations = existing.filter(r => r.status !== "cancelled" && r.status !== "rejected");
        for (const r of activeReservations) {
          const overlap = input.startTime < r.endTime && input.endTime > r.startTime;
          if (overlap) {
            const reservationTitle = [r.purpose, r.reserverName].filter(Boolean).join(" / ");
            const reservationSuffix = reservationTitle ? ` (${reservationTitle})` : "";
            throw new TRPCError({
              code: "CONFLICT",
              message: `${reservationDate} ${r.startTime}~${r.endTime}${reservationSuffix} 예약과 시간이 겹칩니다. 중복 예약은 저장되지 않았습니다. 기존 예약을 확인한 뒤 다른 시간을 선택해 주세요.`,
            });
          }
        }
      }

      // 자동 승인 시설이거나 시설/예약 관리자 권한자는 바로 approved, 그 외는 pending(관리자 검토 필요)
      const status: "approved" | "pending" =
        facility.approvalType === "auto" || canManageFacilityReservations ? "approved" : "pending";
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
          const reservationData = {
            ...baseInput,
            reservationDate,
            userId: ctx.memberId,
            reservationType: "member" as const,
            status,
            recurrenceGroupId,
            recurrenceLabel,
            recurrenceSequence: recurrenceGroupId ? index + 1 : 0,
          };
          const id = await createReservationIfAvailable(reservationData);
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
      if (createdIds[0]) {
        void notifyFacilityReservation({
          reserverName: input.reserverName,
          facilityName: facility.name,
          date: input.reservationDate,
          startTime: input.startTime,
          endTime: input.endTime,
          reservationType: "member",
          reservationId: createdIds[0],
          status,
          extraCount: Math.max(0, createdIds.length - 1),
        });
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
      if (reservation.status !== "pending" && reservation.status !== "approved") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "취소할 수 없는 예약 상태입니다.",
        });
      }
      await updateReservationStatus(input.id, "cancelled");
      return { success: true };
    }),

  // ─── 차량 예약 (성도용, 지정 그룹만) ─────────────────────────────────────

  cancelReservationGroup: memberProtectedProcedure
    .input(z.object({ groupId: z.string().trim().min(1).max(128) }))
    .mutation(async ({ input, ctx }) => {
      const groupReservations = await getReservationsByGroupId(input.groupId);
      if (groupReservations.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "반복 예약 묶음을 찾을 수 없습니다." });
      }
      if (groupReservations.some((reservation) => reservation.userId !== ctx.memberId)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "본인의 반복 예약만 일괄 취소할 수 있습니다." });
      }

      const cancellableCount = groupReservations.filter(
        (reservation) => reservation.status === "pending" || reservation.status === "approved"
      ).length;
      if (cancellableCount === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "취소할 수 있는 예약이 없습니다.",
        });
      }

      await updateReservationGroupStatus(input.groupId, "cancelled");
      return { success: true, count: cancellableCount };
    }),

  vehicleReservationAccess: publicProcedure
    .query(async ({ ctx }) => {
      if (hasAdminContentPermission(ctx.user, "content:vehicles")) return { canUse: true };
      if (!ctx.memberId) return { canUse: false };
      const member = await getMemberById(ctx.memberId);
      return { canUse: await canMemberUseVehicleReservation(member) };
    }),

  vehicles: publicProcedure
    .query(async ({ ctx }) => {
      if (!(await canContextUseVehicleReservation(ctx))) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "차량예약은 지정된 성도 그룹만 이용할 수 있습니다. 관리자에게 문의해 주세요.",
        });
      }
      return getVehicles(true);
    }),

  vehicleAvailabilityTimeline: publicProcedure
    .input(z.object({
      reservationDate: z.string().regex(DATE_RE, "예약 날짜 형식이 올바르지 않습니다."),
      passengers: z.number().int().min(1).default(1),
      repeatMode: vehicleRepeatSchema.default("none"),
      repeatEndDate: z.string().regex(DATE_RE, "반복 종료일 형식이 올바르지 않습니다.").nullable().optional(),
      startTime: z.string().regex(TIME_RE, "시작 시간 형식이 올바르지 않습니다.").nullable().optional(),
    }))
    .query(async ({ input, ctx }) => {
      if (!(await canContextUseVehicleReservation(ctx))) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "차량예약은 지정된 성도 그룹만 이용할 수 있습니다. 관리자에게 문의해 주세요.",
        });
      }
      const reservationDates = getVehicleReservationDates(
        input.reservationDate,
        input.repeatMode,
        input.repeatEndDate,
      );
      const today = todayKstDateKey();
      if (input.reservationDate < today) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "지난 날짜는 예약할 수 없습니다." });
      }
      const nowKst = new Date(Date.now() + 9 * 60 * 60 * 1000);
      const minimumStartTime = input.reservationDate === today
        ? `${String(nowKst.getUTCHours()).padStart(2, "0")}:${String(nowKst.getUTCMinutes()).padStart(2, "0")}`
        : null;
      const timeline = await getVehicleAvailabilityTimeline(
        reservationDates,
        input.passengers,
        input.startTime,
        minimumStartTime,
      );
      return {
        ...timeline,
        occurrenceCount: reservationDates.length,
      };
    }),

  availableVehicles: publicProcedure
    .input(z.object({
      reservationDate: z.string().regex(DATE_RE, "예약 날짜 형식이 올바르지 않습니다."),
      startTime: z.string().regex(TIME_RE, "시작 시간 형식이 올바르지 않습니다."),
      endTime: z.string().regex(TIME_RE, "종료 시간 형식이 올바르지 않습니다."),
      passengers: z.number().int().min(1).default(1),
      repeatMode: vehicleRepeatSchema.default("none"),
      repeatEndDate: z.string().regex(DATE_RE, "반복 종료일 형식이 올바르지 않습니다.").nullable().optional(),
    }))
    .query(async ({ input, ctx }) => {
      if (!(await canContextUseVehicleReservation(ctx))) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "차량예약은 지정된 성도 그룹만 이용할 수 있습니다. 관리자에게 문의해 주세요.",
        });
      }
      const startMinutes = toMinutes(input.startTime);
      const endMinutes = toMinutes(input.endTime);
      if (startMinutes === null || endMinutes === null || startMinutes >= endMinutes) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "종료 시간은 시작 시간보다 늦어야 합니다." });
      }

      const reservationDates = getVehicleReservationDates(
        input.reservationDate,
        input.repeatMode,
        input.repeatEndDate,
      );
      reservationDates.forEach((date) => assertReservationStartsInFuture(date, input.startTime));
      const availableVehicles = await getAvailableVehiclesForSchedule(
        reservationDates,
        input.startTime,
        input.endTime,
        input.passengers,
      );
      return {
        vehicles: availableVehicles,
        occurrenceCount: reservationDates.length,
      };
    }),

  vehicle: publicProcedure
    .input(z.object({ id: idSchema }))
    .query(async ({ input, ctx }) => {
      if (!(await canContextUseVehicleReservation(ctx))) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "차량예약은 지정된 성도 그룹만 이용할 수 있습니다. 관리자에게 문의해 주세요.",
        });
      }
      return getVisibleVehicleById(input.id);
    }),

  vehicleImages: publicProcedure
    .input(z.object({ vehicleId: idSchema }))
    .query(async ({ input, ctx }) => {
      if (!(await canContextUseVehicleReservation(ctx))) return [];
      const vehicle = await getVisibleVehicleById(input.vehicleId);
      if (!vehicle) return [];
      return getVehicleImages(input.vehicleId);
    }),

  vehicleReservationsByDate: publicProcedure
    .input(z.object({
      vehicleId: idSchema,
      date: z.string().regex(DATE_RE, "날짜 형식이 올바르지 않습니다."),
    }))
    .query(async ({ input, ctx }) => {
      if (!(await canContextUseVehicleReservation(ctx))) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "차량예약은 지정된 성도 그룹만 이용할 수 있습니다.",
        });
      }
      const vehicle = await getVisibleVehicleById(input.vehicleId);
      if (!vehicle) return [];
      // 차량예약은 허용된 성도 그룹만 접근하므로, 시설예약처럼 예약자 정보를 함께 보여줍니다.
      return getAdminVehicleReservationDetailsByDate(input.vehicleId, input.date);
    }),

  createVehicleReservation: publicProcedure
    .input(z.object({
      vehicleId: idSchema,
      reserverName: z.string().min(1, "예약자 이름을 입력해주세요."),
      reserverPhone: z.string().optional(),
      reservationDate: z.string().regex(DATE_RE, "예약 날짜 형식이 올바르지 않습니다."),
      startTime: z.string().regex(TIME_RE, "시작 시간 형식이 올바르지 않습니다."),
      endTime: z.string().regex(TIME_RE, "종료 시간 형식이 올바르지 않습니다."),
      purpose: z.string().min(1, "사용 목적을 입력해주세요."),
      department: z.string().optional(),
      passengers: z.number().int().min(1, "탑승 인원은 1명 이상이어야 합니다.").default(1),
      notes: z.string().optional(),
      repeatMode: vehicleRepeatSchema.default("none"),
      repeatEndDate: z.string().regex(DATE_RE, "반복 종료일 형식이 올바르지 않습니다.").nullable().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const canManageVehicleReservations = hasAdminContentPermission(ctx.user, "content:vehicles");
      if (!ctx.memberId && !canManageVehicleReservations) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "로그인이 필요합니다." });
      }
      const member = ctx.memberId ? await getMemberById(ctx.memberId) : null;
      const canUseVehicleReservation =
        canManageVehicleReservations ||
        (member ? await canMemberUseVehicleReservation(member) : false);
      if (!canUseVehicleReservation) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "차량예약은 지정된 성도 그룹만 신청할 수 있습니다. 관리자에게 문의해 주세요.",
        });
      }

      const vehicle = await getVehicleById(input.vehicleId);
      if (!vehicle || !vehicle.isVisible) {
        throw new TRPCError({ code: "NOT_FOUND", message: "차량을 찾을 수 없습니다." });
      }
      if (!vehicle.isReservable) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "현재 예약이 불가능한 차량입니다." });
      }

      const startMinutes = toMinutes(input.startTime);
      const endMinutes = toMinutes(input.endTime);
      const openMinutes = toMinutes(vehicle.openTime);
      const closeMinutes = toMinutes(vehicle.closeTime);
      if (startMinutes === null || endMinutes === null || openMinutes === null || closeMinutes === null) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "예약 시간 형식이 올바르지 않습니다." });
      }
      if (input.reservationDate < todayKstDateKey()) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "지난 날짜는 예약할 수 없습니다." });
      }
      if (startMinutes >= endMinutes) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "시작 시간은 종료 시간보다 빨라야 합니다." });
      }
      if (startMinutes < openMinutes || endMinutes > closeMinutes) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `차량 예약은 운영 시간(${vehicle.openTime}~${vehicle.closeTime}) 내에서만 가능합니다.`,
        });
      }

      const slotMinutes = vehicle.slotMinutes > 0 ? vehicle.slotMinutes : 60;
      const durationMinutes = endMinutes - startMinutes;
      if ((startMinutes - openMinutes) % slotMinutes !== 0 || (endMinutes - openMinutes) % slotMinutes !== 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `${slotMinutes}분 단위로만 예약할 수 있습니다.` });
      }
      const selectedSlots = durationMinutes / slotMinutes;
      if (selectedSlots < vehicle.minSlots) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `최소 ${vehicle.minSlots}개 시간 단위 이상 예약해야 합니다.` });
      }
      if (selectedSlots > vehicle.maxSlots) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `최대 ${vehicle.maxSlots}개 시간 단위까지만 예약할 수 있습니다.` });
      }
      if (input.passengers > vehicle.capacity) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `최대 탑승 인원(${vehicle.capacity}명)을 초과할 수 없습니다.` });
      }

      const status: "approved" | "pending" =
        vehicle.approvalType === "auto" || canManageVehicleReservations ? "approved" : "pending";
      try {
        const { repeatMode, repeatEndDate, ...reservationInput } = input;
        const reservationDates = getVehicleReservationDates(input.reservationDate, repeatMode, repeatEndDate);
        reservationDates.forEach((date) => assertReservationStartsInFuture(date, input.startTime));
        const reservationData = reservationDates.map((reservationDate) => ({
          ...reservationInput,
          reservationDate,
          userId: ctx.memberId ?? null,
          status,
        }));
        // Keep the established single-reservation path for ordinary bookings.
        // Repeating bookings use the transactional bulk path so they succeed or fail together.
        const ids = reservationData.length === 1
          ? [await createVehicleReservationIfAvailable(reservationData[0])]
          : await createVehicleReservationsIfAvailable(reservationData);
        if (ids.length !== reservationDates.length || ids.some((id) => !id)) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "차량 예약 신청 저장에 실패했습니다." });
        }
        // 반복예약도 하나의 신청이므로 관리자 푸시는 묶음당 한 번만 보냅니다.
        // 첫 예약 ID를 대표값으로 사용하고 나머지 회차 수는 알림 본문에 표시합니다.
        void notifyVehicleReservation({
          reserverName: input.reserverName,
          vehicleName: vehicle.name,
          date: input.reservationDate,
          startTime: input.startTime,
          endTime: input.endTime,
          reservationId: ids[0],
          status,
          extraCount: Math.max(0, ids.length - 1),
        });
        return {
          id: ids[0],
          ids,
          count: ids.length,
          status,
        };
      } catch (error) {
        if (error instanceof VehicleReservationOverlapError) {
          throw new TRPCError({ code: "CONFLICT", message: error.message });
        }
        if (error instanceof VehicleReservationLockError) {
          throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: error.message });
        }
        throw error;
      }
    }),

  myVehicleReservations: memberProtectedProcedure
    .query(({ ctx }) => getMyVehicleReservations(ctx.memberId)),

  cancelVehicleReservation: memberProtectedProcedure
    .input(z.object({ id: idSchema }))
    .mutation(async ({ input, ctx }) => {
      const reservation = await getVehicleReservationById(input.id);
      if (!reservation) {
        throw new TRPCError({ code: "NOT_FOUND", message: "차량 예약을 찾을 수 없습니다." });
      }
      if (reservation.userId !== ctx.memberId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "본인의 차량 예약만 취소할 수 있습니다." });
      }
      if (reservation.status !== "pending" && reservation.status !== "approved") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "취소할 수 없는 예약 상태입니다." });
      }
      await updateVehicleReservationStatus(input.id, "cancelled");
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
