import { and, desc, eq, gt, ne, sql } from "drizzle-orm";
import { z } from "zod";
import {
  STATIC_ADMIN_PERMISSIONS,
  SUPPORT_REQUEST_PERMISSION_KEYS,
  SUPPORT_REQUEST_ROOT_PERMISSION_KEY,
} from "@shared/adminPermissions";
import { adminAnyPermissionProcedure, router } from "../../_core/trpc";
import { getDb } from "../../db";
import { hasAdminContentPermission } from "../../db/adminPermissions";
import {
  adminNotificationReadStates,
  bulletinAdRequests,
  bulletins,
  churchMembers,
  courseApplications,
  courses,
  facilities,
  freeBoardPosts,
  missionReports,
  newMemberRequests,
  noticePopups,
  notices,
  prayerRequests,
  reservations,
  siteSettings,
  subtitleRequests,
  testimonyComments,
  testimonyPosts,
  vehicleReservations,
  vehicles,
  visitRequests,
  youtubePlaylists,
  youtubeVideos,
} from "../../../drizzle/schema";

// 관리자 첫 화면 알림은 게시글/신청 데이터를 직접 모아 계산합니다.
// - 게시글/댓글: 최근 7일 등록분
// - 예약/접수/신청: 아직 처리하지 않은 pending/new 상태
// - 관리자가 확인 완료한 종류는 다음 새 항목이 올라올 때까지 숨깁니다.
const RECENT_DAYS = 7;
const MAX_RECENT_ITEMS = 50;
const MAX_GROUP_ITEMS = 8;
const ADMIN_NOTIFICATION_BASELINE_KEY = "admin_notification_baseline_at";

const ADMIN_NOTIFICATION_PERMISSION_KEYS = Array.from(
  new Set(STATIC_ADMIN_PERMISSIONS.map(permission => permission.key))
);

const NOTIFICATION_GROUP_KEYS = [
  "noticeRecent",
  "bulletinRecent",
  "youtubeVideoRecent",
  "popupRecent",
  "freeBoardRecent",
  "testimonyPostRecent",
  "testimonyCommentRecent",
  "reservationPending",
  "vehicleReservationPending",
  "courseRecent",
  "courseApplicationPending",
  "missionReportRecent",
  "missionReportPending",
  "memberPending",
  "prayerRequestNew",
  "newMemberRequestNew",
  "visitRequestNew",
  "subtitleRequestNew",
  "bulletinAdRequestNew",
] as const;

type NotificationTab =
  | "bulletins"
  | "freeBoard"
  | "youtube"
  | "popups"
  | "notices"
  | "testimonies"
  | "reservations"
  | "vehicles"
  | "supportRequests"
  | "courses"
  | "missionReports"
  | "members";

type NotificationTone = "recent" | "pending";
type NotificationGroupKey = (typeof NOTIFICATION_GROUP_KEYS)[number];

type NotificationGroup = {
  key: NotificationGroupKey;
  label: string;
  description: string;
  tab: NotificationTab;
  count: number;
  tone: NotificationTone;
};

type NotificationItem = {
  id: string;
  groupKey: NotificationGroupKey;
  label: string;
  title: string;
  meta: string;
  tab: NotificationTab;
  createdAt: Date;
  tone: NotificationTone;
};

function toCount(value: unknown) {
  return Number(value ?? 0);
}

function parseDateSetting(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function latestDate(...dates: Array<Date | null | undefined>) {
  return dates.reduce<Date>((latest, date) => {
    if (!date || Number.isNaN(date.getTime())) return latest;
    return date.getTime() > latest.getTime() ? date : latest;
  }, new Date(0));
}

function hasPermission(
  user: Parameters<typeof hasAdminContentPermission>[0],
  permissionKey: string
) {
  return hasAdminContentPermission(user, permissionKey);
}

function hasSupportPermission(
  user: Parameters<typeof hasAdminContentPermission>[0],
  permissionKey: string
) {
  return (
    hasPermission(user, SUPPORT_REQUEST_ROOT_PERMISSION_KEY) ||
    hasPermission(user, permissionKey)
  );
}

function addGroup(
  groups: NotificationGroup[],
  items: NotificationItem[],
  group: NotificationGroup,
  groupItems: NotificationItem[]
) {
  if (group.count <= 0) return;
  groups.push(group);
  items.push(...groupItems);
}

export const notificationsRouter = router({
  summary: adminAnyPermissionProcedure(
    ADMIN_NOTIFICATION_PERMISSION_KEYS
  ).query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) {
      return {
        recentDays: RECENT_DAYS,
        baselineAt: null,
        totalCount: 0,
        groups: [] as NotificationGroup[],
        items: [] as NotificationItem[],
      };
    }

    const groups: NotificationGroup[] = [];
    const items: NotificationItem[] = [];
    const recentCutoff = new Date(
      Date.now() - RECENT_DAYS * 24 * 60 * 60 * 1000
    );
    const [baselineRow] = await db
      .select({ settingValue: siteSettings.settingValue })
      .from(siteSettings)
      .where(eq(siteSettings.settingKey, ADMIN_NOTIFICATION_BASELINE_KEY))
      .limit(1);
    const baselineAt = parseDateSetting(baselineRow?.settingValue);
    const readRows = await db
      .select({
        groupKey: adminNotificationReadStates.groupKey,
        lastSeenAt: adminNotificationReadStates.lastSeenAt,
      })
      .from(adminNotificationReadStates)
      .where(eq(adminNotificationReadStates.userId, ctx.user.id));
    const lastSeenByGroup = new Map(
      readRows.map(row => [row.groupKey, row.lastSeenAt] as const)
    );
    const cutoffFor = (
      groupKey: NotificationGroupKey,
      mode: NotificationTone
    ) =>
      latestDate(
        baselineAt,
        lastSeenByGroup.get(groupKey),
        mode === "recent" ? recentCutoff : null
      );

    if (hasPermission(ctx.user, "content:notices")) {
      const groupKey = "noticeRecent";
      const where = and(
        eq(notices.isPublished, true),
        gt(notices.createdAt, cutoffFor(groupKey, "recent"))
      );
      const [countRow] = await db
        .select({ count: sql<number>`count(*)` })
        .from(notices)
        .where(where);
      const rows = await db
        .select({
          id: notices.id,
          category: notices.category,
          title: notices.title,
          createdAt: notices.createdAt,
        })
        .from(notices)
        .where(where)
        .orderBy(desc(notices.createdAt), desc(notices.id))
        .limit(MAX_GROUP_ITEMS);

      addGroup(
        groups,
        items,
        {
          key: groupKey,
          label: "새 공지사항",
          description: `최근 ${RECENT_DAYS}일 안에 등록된 공지/소식입니다.`,
          tab: "notices",
          count: toCount(countRow?.count),
          tone: "recent",
        },
        rows.map(row => ({
          id: `notice:${row.id}`,
          groupKey,
          label: row.category || "공지사항",
          title: row.title,
          meta: "최근 등록 공지",
          tab: "notices",
          createdAt: row.createdAt,
          tone: "recent",
        }))
      );
    }

    if (hasPermission(ctx.user, "content:bulletins")) {
      const groupKey = "bulletinRecent";
      const where = and(
        eq(bulletins.status, "published"),
        gt(bulletins.createdAt, cutoffFor(groupKey, "recent"))
      );
      const [countRow] = await db
        .select({ count: sql<number>`count(*)` })
        .from(bulletins)
        .where(where);
      const rows = await db
        .select({
          id: bulletins.id,
          title: bulletins.title,
          bulletinDate: bulletins.bulletinDate,
          createdAt: bulletins.createdAt,
        })
        .from(bulletins)
        .where(where)
        .orderBy(desc(bulletins.createdAt), desc(bulletins.id))
        .limit(MAX_GROUP_ITEMS);

      addGroup(
        groups,
        items,
        {
          key: groupKey,
          label: "새 주보",
          description: `최근 ${RECENT_DAYS}일 안에 등록된 주보입니다.`,
          tab: "bulletins",
          count: toCount(countRow?.count),
          tone: "recent",
        },
        rows.map(row => ({
          id: `bulletin:${row.id}`,
          groupKey,
          label: "주보",
          title: row.title,
          meta: row.bulletinDate,
          tab: "bulletins",
          createdAt: row.createdAt,
          tone: "recent",
        }))
      );
    }

    if (hasPermission(ctx.user, "content:youtube")) {
      const groupKey = "youtubeVideoRecent";
      const where = and(
        eq(youtubeVideos.isVisible, true),
        gt(youtubeVideos.createdAt, cutoffFor(groupKey, "recent"))
      );
      const [countRow] = await db
        .select({ count: sql<number>`count(*)` })
        .from(youtubeVideos)
        .where(where);
      const rows = await db
        .select({
          id: youtubeVideos.id,
          title: youtubeVideos.title,
          playlistTitle: youtubePlaylists.title,
          createdAt: youtubeVideos.createdAt,
        })
        .from(youtubeVideos)
        .leftJoin(
          youtubePlaylists,
          eq(youtubeVideos.playlistId, youtubePlaylists.id)
        )
        .where(where)
        .orderBy(desc(youtubeVideos.createdAt), desc(youtubeVideos.id))
        .limit(MAX_GROUP_ITEMS);

      addGroup(
        groups,
        items,
        {
          key: groupKey,
          label: "새 예배/영상",
          description: `최근 ${RECENT_DAYS}일 안에 등록된 조이풀TV 영상입니다.`,
          tab: "youtube",
          count: toCount(countRow?.count),
          tone: "recent",
        },
        rows.map(row => ({
          id: `youtubeVideo:${row.id}`,
          groupKey,
          label: "조이풀TV",
          title: row.title,
          meta: row.playlistTitle ?? "영상 목록",
          tab: "youtube",
          createdAt: row.createdAt,
          tone: "recent",
        }))
      );
    }

    if (hasPermission(ctx.user, "content:popups")) {
      const groupKey = "popupRecent";
      const where = and(
        eq(noticePopups.isActive, true),
        gt(noticePopups.createdAt, cutoffFor(groupKey, "recent"))
      );
      const [countRow] = await db
        .select({ count: sql<number>`count(*)` })
        .from(noticePopups)
        .where(where);
      const rows = await db
        .select({
          id: noticePopups.id,
          title: noticePopups.title,
          placement: noticePopups.placement,
          createdAt: noticePopups.createdAt,
        })
        .from(noticePopups)
        .where(where)
        .orderBy(desc(noticePopups.createdAt), desc(noticePopups.id))
        .limit(MAX_GROUP_ITEMS);

      addGroup(
        groups,
        items,
        {
          key: groupKey,
          label: "새 팝업",
          description: `최근 ${RECENT_DAYS}일 안에 등록된 팝업/배너입니다.`,
          tab: "popups",
          count: toCount(countRow?.count),
          tone: "recent",
        },
        rows.map(row => ({
          id: `popup:${row.id}`,
          groupKey,
          label: "팝업",
          title: row.title,
          meta: row.placement,
          tab: "popups",
          createdAt: row.createdAt,
          tone: "recent",
        }))
      );
    }

    if (hasPermission(ctx.user, "content:freeBoard")) {
      const groupKey = "freeBoardRecent";
      const where = and(
        ne(freeBoardPosts.status, "deleted"),
        gt(freeBoardPosts.createdAt, cutoffFor(groupKey, "recent"))
      );
      const [countRow] = await db
        .select({ count: sql<number>`count(*)` })
        .from(freeBoardPosts)
        .where(where);
      const rows = await db
        .select({
          id: freeBoardPosts.id,
          title: freeBoardPosts.title,
          createdAt: freeBoardPosts.createdAt,
        })
        .from(freeBoardPosts)
        .where(where)
        .orderBy(desc(freeBoardPosts.createdAt), desc(freeBoardPosts.id))
        .limit(MAX_GROUP_ITEMS);

      addGroup(
        groups,
        items,
        {
          key: groupKey,
          label: "자유게시판 새 글",
          description: `최근 ${RECENT_DAYS}일 안에 올라온 자유게시판 글입니다.`,
          tab: "freeBoard",
          count: toCount(countRow?.count),
          tone: "recent",
        },
        rows.map(row => ({
          id: `freeBoard:${row.id}`,
          groupKey,
          label: "자유게시판",
          title: row.title,
          meta: "최근 등록 글",
          tab: "freeBoard",
          createdAt: row.createdAt,
          tone: "recent",
        }))
      );
    }

    if (hasPermission(ctx.user, "content:testimonies")) {
      const postGroupKey = "testimonyPostRecent";
      const postWhere = and(
        ne(testimonyPosts.status, "deleted"),
        gt(testimonyPosts.createdAt, cutoffFor(postGroupKey, "recent"))
      );
      const [postCountRow] = await db
        .select({ count: sql<number>`count(*)` })
        .from(testimonyPosts)
        .where(postWhere);
      const postRows = await db
        .select({
          id: testimonyPosts.id,
          title: testimonyPosts.title,
          createdAt: testimonyPosts.createdAt,
        })
        .from(testimonyPosts)
        .where(postWhere)
        .orderBy(desc(testimonyPosts.createdAt), desc(testimonyPosts.id))
        .limit(MAX_GROUP_ITEMS);

      addGroup(
        groups,
        items,
        {
          key: postGroupKey,
          label: "간증 새 글",
          description: `최근 ${RECENT_DAYS}일 안에 올라온 간증 글입니다.`,
          tab: "testimonies",
          count: toCount(postCountRow?.count),
          tone: "recent",
        },
        postRows.map(row => ({
          id: `testimonyPost:${row.id}`,
          groupKey: postGroupKey,
          label: "간증 글",
          title: row.title,
          meta: "최근 등록 글",
          tab: "testimonies",
          createdAt: row.createdAt,
          tone: "recent",
        }))
      );

      const commentGroupKey = "testimonyCommentRecent";
      const commentWhere = and(
        ne(testimonyComments.status, "deleted"),
        gt(testimonyComments.createdAt, cutoffFor(commentGroupKey, "recent"))
      );
      const [commentCountRow] = await db
        .select({ count: sql<number>`count(*)` })
        .from(testimonyComments)
        .where(commentWhere);
      const commentRows = await db
        .select({
          id: testimonyComments.id,
          content: testimonyComments.content,
          createdAt: testimonyComments.createdAt,
        })
        .from(testimonyComments)
        .where(commentWhere)
        .orderBy(desc(testimonyComments.createdAt), desc(testimonyComments.id))
        .limit(MAX_GROUP_ITEMS);

      addGroup(
        groups,
        items,
        {
          key: commentGroupKey,
          label: "간증 새 댓글",
          description: `최근 ${RECENT_DAYS}일 안에 올라온 간증 댓글입니다.`,
          tab: "testimonies",
          count: toCount(commentCountRow?.count),
          tone: "recent",
        },
        commentRows.map(row => ({
          id: `testimonyComment:${row.id}`,
          groupKey: commentGroupKey,
          label: "간증 댓글",
          title: row.content.slice(0, 40) || "새 댓글",
          meta: "최근 등록 댓글",
          tab: "testimonies",
          createdAt: row.createdAt,
          tone: "recent",
        }))
      );
    }

    if (hasPermission(ctx.user, "content:reservations")) {
      const groupKey = "reservationPending";
      const where = and(
        eq(reservations.status, "pending"),
        gt(reservations.createdAt, cutoffFor(groupKey, "pending"))
      );
      const [countRow] = await db
        .select({ count: sql<number>`count(*)` })
        .from(reservations)
        .where(where);
      const rows = await db
        .select({
          id: reservations.id,
          reserverName: reservations.reserverName,
          reservationDate: reservations.reservationDate,
          startTime: reservations.startTime,
          facilityName: facilities.name,
          createdAt: reservations.createdAt,
        })
        .from(reservations)
        .leftJoin(facilities, eq(reservations.facilityId, facilities.id))
        .where(where)
        .orderBy(desc(reservations.createdAt), desc(reservations.id))
        .limit(MAX_GROUP_ITEMS);

      addGroup(
        groups,
        items,
        {
          key: groupKey,
          label: "승인 대기 예약",
          description: "아직 승인 또는 거절하지 않은 시설 예약입니다.",
          tab: "reservations",
          count: toCount(countRow?.count),
          tone: "pending",
        },
        rows.map(row => ({
          id: `reservation:${row.id}`,
          groupKey,
          label: "시설 예약",
          title: `${row.facilityName ?? "시설"} ${row.reservationDate} ${row.startTime}`,
          meta: row.reserverName,
          tab: "reservations",
          createdAt: row.createdAt,
          tone: "pending",
        }))
      );
    }

    if (hasPermission(ctx.user, "content:vehicles")) {
      const groupKey = "vehicleReservationPending";
      const where = and(
        eq(vehicleReservations.status, "pending"),
        gt(vehicleReservations.createdAt, cutoffFor(groupKey, "pending"))
      );
      const [countRow] = await db
        .select({ count: sql<number>`count(*)` })
        .from(vehicleReservations)
        .where(where);
      const rows = await db
        .select({
          id: vehicleReservations.id,
          reserverName: vehicleReservations.reserverName,
          reservationDate: vehicleReservations.reservationDate,
          startTime: vehicleReservations.startTime,
          vehicleName: vehicles.name,
          createdAt: vehicleReservations.createdAt,
        })
        .from(vehicleReservations)
        .leftJoin(vehicles, eq(vehicleReservations.vehicleId, vehicles.id))
        .where(where)
        .orderBy(
          desc(vehicleReservations.createdAt),
          desc(vehicleReservations.id)
        )
        .limit(MAX_GROUP_ITEMS);

      addGroup(
        groups,
        items,
        {
          key: groupKey,
          label: "승인 대기 차량예약",
          description: "아직 승인 또는 거절하지 않은 차량 예약입니다.",
          tab: "vehicles",
          count: toCount(countRow?.count),
          tone: "pending",
        },
        rows.map(row => ({
          id: `vehicleReservation:${row.id}`,
          groupKey,
          label: "차량예약",
          title: `${row.vehicleName ?? "차량"} ${row.reservationDate} ${row.startTime}`,
          meta: row.reserverName,
          tab: "vehicles",
          createdAt: row.createdAt,
          tone: "pending",
        }))
      );
    }

    if (hasPermission(ctx.user, "content:courses")) {
      const courseGroupKey = "courseRecent";
      const courseRecentWhere = and(
        ne(courses.status, "archived"),
        ne(courses.status, "cancelled"),
        gt(courses.createdAt, cutoffFor(courseGroupKey, "recent"))
      );
      const [courseRecentCountRow] = await db
        .select({ count: sql<number>`count(*)` })
        .from(courses)
        .where(courseRecentWhere);
      const courseRecentRows = await db
        .select({
          id: courses.id,
          title: courses.title,
          status: courses.status,
          createdAt: courses.createdAt,
        })
        .from(courses)
        .where(courseRecentWhere)
        .orderBy(desc(courses.createdAt), desc(courses.id))
        .limit(MAX_GROUP_ITEMS);

      addGroup(
        groups,
        items,
        {
          key: courseGroupKey,
          label: "새 강좌",
          description: `최근 ${RECENT_DAYS}일 안에 등록된 교육/강좌입니다.`,
          tab: "courses",
          count: toCount(courseRecentCountRow?.count),
          tone: "recent",
        },
        courseRecentRows.map(row => ({
          id: `course:${row.id}`,
          groupKey: courseGroupKey,
          label: "강좌",
          title: row.title,
          meta: row.status,
          tab: "courses",
          createdAt: row.createdAt,
          tone: "recent",
        }))
      );

      const applicationGroupKey = "courseApplicationPending";
      const where = and(
        eq(courseApplications.status, "pending"),
        gt(
          courseApplications.createdAt,
          cutoffFor(applicationGroupKey, "pending")
        )
      );
      const [countRow] = await db
        .select({ count: sql<number>`count(*)` })
        .from(courseApplications)
        .where(where);
      const rows = await db
        .select({
          id: courseApplications.id,
          applicantName: courseApplications.applicantName,
          courseTitle: courses.title,
          createdAt: courseApplications.createdAt,
        })
        .from(courseApplications)
        .leftJoin(courses, eq(courseApplications.courseId, courses.id))
        .where(where)
        .orderBy(
          desc(courseApplications.createdAt),
          desc(courseApplications.id)
        )
        .limit(MAX_GROUP_ITEMS);

      addGroup(
        groups,
        items,
        {
          key: applicationGroupKey,
          label: "승인 대기 강좌 신청",
          description: "아직 승인 또는 거절하지 않은 강좌 신청입니다.",
          tab: "courses",
          count: toCount(countRow?.count),
          tone: "pending",
        },
        rows.map(row => ({
          id: `courseApplication:${row.id}`,
          groupKey: applicationGroupKey,
          label: "강좌 신청",
          title: row.courseTitle ?? "강좌 신청",
          meta: row.applicantName,
          tab: "courses",
          createdAt: row.createdAt,
          tone: "pending",
        }))
      );
    }

    if (hasPermission(ctx.user, "content:missionReports")) {
      const recentGroupKey = "missionReportRecent";
      const recentWhere = and(
        eq(missionReports.status, "published"),
        gt(missionReports.createdAt, cutoffFor(recentGroupKey, "recent"))
      );
      const [recentCountRow] = await db
        .select({ count: sql<number>`count(*)` })
        .from(missionReports)
        .where(recentWhere);
      const recentRows = await db
        .select({
          id: missionReports.id,
          title: missionReports.title,
          reportDate: missionReports.reportDate,
          createdAt: missionReports.createdAt,
        })
        .from(missionReports)
        .where(recentWhere)
        .orderBy(desc(missionReports.createdAt), desc(missionReports.id))
        .limit(MAX_GROUP_ITEMS);

      addGroup(
        groups,
        items,
        {
          key: recentGroupKey,
          label: "새 선교보고",
          description: `최근 ${RECENT_DAYS}일 안에 게시된 선교보고입니다.`,
          tab: "missionReports",
          count: toCount(recentCountRow?.count),
          tone: "recent",
        },
        recentRows.map(row => ({
          id: `missionReportRecent:${row.id}`,
          groupKey: recentGroupKey,
          label: "선교보고",
          title: row.title,
          meta: row.reportDate,
          tab: "missionReports",
          createdAt: row.createdAt,
          tone: "recent",
        }))
      );

      const pendingGroupKey = "missionReportPending";
      const where = and(
        eq(missionReports.status, "pending"),
        gt(missionReports.createdAt, cutoffFor(pendingGroupKey, "pending"))
      );
      const [countRow] = await db
        .select({ count: sql<number>`count(*)` })
        .from(missionReports)
        .where(where);
      const rows = await db
        .select({
          id: missionReports.id,
          title: missionReports.title,
          reportDate: missionReports.reportDate,
          createdAt: missionReports.createdAt,
        })
        .from(missionReports)
        .where(where)
        .orderBy(desc(missionReports.createdAt), desc(missionReports.id))
        .limit(MAX_GROUP_ITEMS);

      addGroup(
        groups,
        items,
        {
          key: pendingGroupKey,
          label: "검토 대기 선교보고",
          description: "아직 게시 승인하지 않은 선교보고입니다.",
          tab: "missionReports",
          count: toCount(countRow?.count),
          tone: "pending",
        },
        rows.map(row => ({
          id: `missionReport:${row.id}`,
          groupKey: pendingGroupKey,
          label: "선교보고",
          title: row.title,
          meta: row.reportDate,
          tab: "missionReports",
          createdAt: row.createdAt,
          tone: "pending",
        }))
      );
    }

    if (ctx.user.role === "admin") {
      const groupKey = "memberPending";
      const where = and(
        eq(churchMembers.status, "pending"),
        gt(churchMembers.createdAt, cutoffFor(groupKey, "pending"))
      );
      const [countRow] = await db
        .select({ count: sql<number>`count(*)` })
        .from(churchMembers)
        .where(where);
      const rows = await db
        .select({
          id: churchMembers.id,
          name: churchMembers.name,
          phone: churchMembers.phone,
          createdAt: churchMembers.createdAt,
        })
        .from(churchMembers)
        .where(where)
        .orderBy(desc(churchMembers.createdAt), desc(churchMembers.id))
        .limit(MAX_GROUP_ITEMS);

      addGroup(
        groups,
        items,
        {
          key: groupKey,
          label: "승인 대기 성도",
          description: "가입 후 아직 승인하지 않은 성도 계정입니다.",
          tab: "members",
          count: toCount(countRow?.count),
          tone: "pending",
        },
        rows.map(row => ({
          id: `member:${row.id}`,
          groupKey,
          label: "성도 가입",
          title: row.name,
          meta: row.phone ?? "연락처 없음",
          tab: "members",
          createdAt: row.createdAt,
          tone: "pending",
        }))
      );
    }

    if (
      hasSupportPermission(ctx.user, SUPPORT_REQUEST_PERMISSION_KEYS.prayers)
    ) {
      const groupKey = "prayerRequestNew";
      const where = and(
        eq(prayerRequests.status, "new"),
        gt(prayerRequests.createdAt, cutoffFor(groupKey, "pending"))
      );
      const [countRow] = await db
        .select({ count: sql<number>`count(*)` })
        .from(prayerRequests)
        .where(where);
      const rows = await db
        .select({
          id: prayerRequests.id,
          name: prayerRequests.name,
          category: prayerRequests.category,
          createdAt: prayerRequests.createdAt,
        })
        .from(prayerRequests)
        .where(where)
        .orderBy(desc(prayerRequests.createdAt), desc(prayerRequests.id))
        .limit(MAX_GROUP_ITEMS);

      addGroup(
        groups,
        items,
        {
          key: groupKey,
          label: "새 기도 요청",
          description: "아직 확인 처리하지 않은 기도 요청입니다.",
          tab: "supportRequests",
          count: toCount(countRow?.count),
          tone: "pending",
        },
        rows.map(row => ({
          id: `prayerRequest:${row.id}`,
          groupKey,
          label: "기도 요청",
          title: row.category,
          meta: row.name,
          tab: "supportRequests",
          createdAt: row.createdAt,
          tone: "pending",
        }))
      );
    }

    if (
      hasSupportPermission(ctx.user, SUPPORT_REQUEST_PERMISSION_KEYS.newMembers)
    ) {
      const groupKey = "newMemberRequestNew";
      const where = and(
        eq(newMemberRequests.status, "new"),
        gt(newMemberRequests.createdAt, cutoffFor(groupKey, "pending"))
      );
      const [countRow] = await db
        .select({ count: sql<number>`count(*)` })
        .from(newMemberRequests)
        .where(where);
      const rows = await db
        .select({
          id: newMemberRequests.id,
          name: newMemberRequests.name,
          phone: newMemberRequests.phone,
          createdAt: newMemberRequests.createdAt,
        })
        .from(newMemberRequests)
        .where(where)
        .orderBy(desc(newMemberRequests.createdAt), desc(newMemberRequests.id))
        .limit(MAX_GROUP_ITEMS);

      addGroup(
        groups,
        items,
        {
          key: groupKey,
          label: "새가족 새 문의",
          description: "아직 연락 처리하지 않은 새가족 문의입니다.",
          tab: "supportRequests",
          count: toCount(countRow?.count),
          tone: "pending",
        },
        rows.map(row => ({
          id: `newMemberRequest:${row.id}`,
          groupKey,
          label: "새가족 문의",
          title: row.name,
          meta: row.phone,
          tab: "supportRequests",
          createdAt: row.createdAt,
          tone: "pending",
        }))
      );
    }

    if (
      hasSupportPermission(ctx.user, SUPPORT_REQUEST_PERMISSION_KEYS.visits)
    ) {
      const groupKey = "visitRequestNew";
      const where = and(
        eq(visitRequests.status, "new"),
        gt(visitRequests.createdAt, cutoffFor(groupKey, "pending"))
      );
      const [countRow] = await db
        .select({ count: sql<number>`count(*)` })
        .from(visitRequests)
        .where(where);
      const rows = await db
        .select({
          id: visitRequests.id,
          organizationName: visitRequests.organizationName,
          applicantName: visitRequests.applicantName,
          visitDate: visitRequests.visitDate,
          createdAt: visitRequests.createdAt,
        })
        .from(visitRequests)
        .where(where)
        .orderBy(desc(visitRequests.createdAt), desc(visitRequests.id))
        .limit(MAX_GROUP_ITEMS);

      addGroup(
        groups,
        items,
        {
          key: groupKey,
          label: "새 탐방 신청",
          description: "아직 연락 처리하지 않은 탐방 신청입니다.",
          tab: "supportRequests",
          count: toCount(countRow?.count),
          tone: "pending",
        },
        rows.map(row => ({
          id: `visitRequest:${row.id}`,
          groupKey,
          label: "탐방 신청",
          title: row.organizationName,
          meta: `${row.applicantName} · ${row.visitDate}`,
          tab: "supportRequests",
          createdAt: row.createdAt,
          tone: "pending",
        }))
      );
    }

    if (
      hasSupportPermission(ctx.user, SUPPORT_REQUEST_PERMISSION_KEYS.subtitles)
    ) {
      const groupKey = "subtitleRequestNew";
      const where = and(
        eq(subtitleRequests.status, "new"),
        gt(subtitleRequests.createdAt, cutoffFor(groupKey, "pending"))
      );
      const [countRow] = await db
        .select({ count: sql<number>`count(*)` })
        .from(subtitleRequests)
        .where(where);
      const rows = await db
        .select({
          id: subtitleRequests.id,
          title: subtitleRequests.title,
          authorName: subtitleRequests.authorName,
          createdAt: subtitleRequests.createdAt,
        })
        .from(subtitleRequests)
        .where(where)
        .orderBy(desc(subtitleRequests.createdAt), desc(subtitleRequests.id))
        .limit(MAX_GROUP_ITEMS);

      addGroup(
        groups,
        items,
        {
          key: groupKey,
          label: "새 자막 신청",
          description: "아직 검토 처리하지 않은 자막 신청입니다.",
          tab: "supportRequests",
          count: toCount(countRow?.count),
          tone: "pending",
        },
        rows.map(row => ({
          id: `subtitleRequest:${row.id}`,
          groupKey,
          label: "자막 신청",
          title: row.title,
          meta: row.authorName,
          tab: "supportRequests",
          createdAt: row.createdAt,
          tone: "pending",
        }))
      );
    }

    if (
      hasSupportPermission(
        ctx.user,
        SUPPORT_REQUEST_PERMISSION_KEYS.bulletinAds
      )
    ) {
      const groupKey = "bulletinAdRequestNew";
      const where = and(
        eq(bulletinAdRequests.status, "new"),
        gt(bulletinAdRequests.createdAt, cutoffFor(groupKey, "pending"))
      );
      const [countRow] = await db
        .select({ count: sql<number>`count(*)` })
        .from(bulletinAdRequests)
        .where(where);
      const rows = await db
        .select({
          id: bulletinAdRequests.id,
          title: bulletinAdRequests.title,
          authorName: bulletinAdRequests.authorName,
          createdAt: bulletinAdRequests.createdAt,
        })
        .from(bulletinAdRequests)
        .where(where)
        .orderBy(
          desc(bulletinAdRequests.createdAt),
          desc(bulletinAdRequests.id)
        )
        .limit(MAX_GROUP_ITEMS);

      addGroup(
        groups,
        items,
        {
          key: groupKey,
          label: "새 주보 광고신청",
          description: "아직 검토 처리하지 않은 주보 광고신청입니다.",
          tab: "supportRequests",
          count: toCount(countRow?.count),
          tone: "pending",
        },
        rows.map(row => ({
          id: `bulletinAdRequest:${row.id}`,
          groupKey,
          label: "주보 광고신청",
          title: row.title,
          meta: row.authorName,
          tab: "supportRequests",
          createdAt: row.createdAt,
          tone: "pending",
        }))
      );
    }

    const sortedItems = items
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, MAX_RECENT_ITEMS);

    return {
      recentDays: RECENT_DAYS,
      baselineAt,
      totalCount: groups.reduce((sum, group) => sum + group.count, 0),
      groups,
      items: sortedItems,
    };
  }),
  markGroupRead: adminAnyPermissionProcedure(ADMIN_NOTIFICATION_PERMISSION_KEYS)
    .input(z.object({ groupKey: z.enum(NOTIFICATION_GROUP_KEYS) }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return { ok: false };

      const now = new Date();
      await db
        .insert(adminNotificationReadStates)
        .values({
          userId: ctx.user.id,
          groupKey: input.groupKey,
          lastSeenAt: now,
        })
        .onDuplicateKeyUpdate({
          set: {
            lastSeenAt: now,
            updatedAt: now,
          },
        });

      return { ok: true };
    }),
  markAllRead: adminAnyPermissionProcedure(
    ADMIN_NOTIFICATION_PERMISSION_KEYS
  ).mutation(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return { ok: false };

    const now = new Date();
    for (const groupKey of NOTIFICATION_GROUP_KEYS) {
      await db
        .insert(adminNotificationReadStates)
        .values({
          userId: ctx.user.id,
          groupKey,
          lastSeenAt: now,
        })
        .onDuplicateKeyUpdate({
          set: {
            lastSeenAt: now,
            updatedAt: now,
          },
        });
    }

    return { ok: true };
  }),
});
