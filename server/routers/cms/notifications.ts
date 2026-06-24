import { and, desc, eq, gte, ne, sql } from "drizzle-orm";
import {
  STATIC_ADMIN_PERMISSIONS,
  SUPPORT_REQUEST_PERMISSION_KEYS,
  SUPPORT_REQUEST_ROOT_PERMISSION_KEY,
} from "@shared/adminPermissions";
import { adminAnyPermissionProcedure, router } from "../../_core/trpc";
import { getDb } from "../../db";
import { hasAdminContentPermission } from "../../db/adminPermissions";
import {
  bulletinAdRequests,
  churchMembers,
  courseApplications,
  courses,
  facilities,
  freeBoardPosts,
  missionReports,
  newMemberRequests,
  prayerRequests,
  reservations,
  subtitleRequests,
  testimonyComments,
  testimonyPosts,
  visitRequests,
} from "../../../drizzle/schema";

// 관리자 첫 화면 알림은 별도 읽음 테이블 없이 계산합니다.
// - 게시글/댓글: 최근 7일 등록분
// - 예약/접수/신청: 아직 처리하지 않은 pending/new 상태
const RECENT_DAYS = 7;
const MAX_RECENT_ITEMS = 8;
const MAX_GROUP_ITEMS = 3;

const ADMIN_NOTIFICATION_PERMISSION_KEYS = Array.from(
  new Set(STATIC_ADMIN_PERMISSIONS.map((permission) => permission.key)),
);

type NotificationTab =
  | "freeBoard"
  | "testimonies"
  | "reservations"
  | "supportRequests"
  | "courses"
  | "missionReports"
  | "members";

type NotificationTone = "recent" | "pending";

type NotificationGroup = {
  key: string;
  label: string;
  description: string;
  tab: NotificationTab;
  count: number;
  tone: NotificationTone;
};

type NotificationItem = {
  id: string;
  groupKey: string;
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

function hasPermission(user: Parameters<typeof hasAdminContentPermission>[0], permissionKey: string) {
  return hasAdminContentPermission(user, permissionKey);
}

function hasSupportPermission(
  user: Parameters<typeof hasAdminContentPermission>[0],
  permissionKey: string,
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
  groupItems: NotificationItem[],
) {
  if (group.count <= 0) return;
  groups.push(group);
  items.push(...groupItems);
}

export const notificationsRouter = router({
  summary: adminAnyPermissionProcedure(ADMIN_NOTIFICATION_PERMISSION_KEYS).query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) {
      return {
        recentDays: RECENT_DAYS,
        totalCount: 0,
        groups: [] as NotificationGroup[],
        items: [] as NotificationItem[],
      };
    }

    const groups: NotificationGroup[] = [];
    const items: NotificationItem[] = [];
    const recentCutoff = new Date(Date.now() - RECENT_DAYS * 24 * 60 * 60 * 1000);

    if (hasPermission(ctx.user, "content:freeBoard")) {
      const where = and(ne(freeBoardPosts.status, "deleted"), gte(freeBoardPosts.createdAt, recentCutoff));
      const [countRow] = await db.select({ count: sql<number>`count(*)` }).from(freeBoardPosts).where(where);
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

      addGroup(groups, items, {
        key: "freeBoardRecent",
        label: "자유게시판 새 글",
        description: `최근 ${RECENT_DAYS}일 안에 올라온 자유게시판 글입니다.`,
        tab: "freeBoard",
        count: toCount(countRow?.count),
        tone: "recent",
      }, rows.map((row) => ({
        id: `freeBoard:${row.id}`,
        groupKey: "freeBoardRecent",
        label: "자유게시판",
        title: row.title,
        meta: "최근 등록 글",
        tab: "freeBoard",
        createdAt: row.createdAt,
        tone: "recent",
      })));
    }

    if (hasPermission(ctx.user, "content:testimonies")) {
      const postWhere = and(ne(testimonyPosts.status, "deleted"), gte(testimonyPosts.createdAt, recentCutoff));
      const [postCountRow] = await db.select({ count: sql<number>`count(*)` }).from(testimonyPosts).where(postWhere);
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

      addGroup(groups, items, {
        key: "testimonyPostRecent",
        label: "간증 새 글",
        description: `최근 ${RECENT_DAYS}일 안에 올라온 간증 글입니다.`,
        tab: "testimonies",
        count: toCount(postCountRow?.count),
        tone: "recent",
      }, postRows.map((row) => ({
        id: `testimonyPost:${row.id}`,
        groupKey: "testimonyPostRecent",
        label: "간증 글",
        title: row.title,
        meta: "최근 등록 글",
        tab: "testimonies",
        createdAt: row.createdAt,
        tone: "recent",
      })));

      const commentWhere = and(ne(testimonyComments.status, "deleted"), gte(testimonyComments.createdAt, recentCutoff));
      const [commentCountRow] = await db.select({ count: sql<number>`count(*)` }).from(testimonyComments).where(commentWhere);
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

      addGroup(groups, items, {
        key: "testimonyCommentRecent",
        label: "간증 새 댓글",
        description: `최근 ${RECENT_DAYS}일 안에 올라온 간증 댓글입니다.`,
        tab: "testimonies",
        count: toCount(commentCountRow?.count),
        tone: "recent",
      }, commentRows.map((row) => ({
        id: `testimonyComment:${row.id}`,
        groupKey: "testimonyCommentRecent",
        label: "간증 댓글",
        title: row.content.slice(0, 40) || "새 댓글",
        meta: "최근 등록 댓글",
        tab: "testimonies",
        createdAt: row.createdAt,
        tone: "recent",
      })));
    }

    if (hasPermission(ctx.user, "content:reservations")) {
      const where = eq(reservations.status, "pending");
      const [countRow] = await db.select({ count: sql<number>`count(*)` }).from(reservations).where(where);
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

      addGroup(groups, items, {
        key: "reservationPending",
        label: "승인 대기 예약",
        description: "아직 승인 또는 거절하지 않은 시설 예약입니다.",
        tab: "reservations",
        count: toCount(countRow?.count),
        tone: "pending",
      }, rows.map((row) => ({
        id: `reservation:${row.id}`,
        groupKey: "reservationPending",
        label: "시설 예약",
        title: `${row.facilityName ?? "시설"} ${row.reservationDate} ${row.startTime}`,
        meta: row.reserverName,
        tab: "reservations",
        createdAt: row.createdAt,
        tone: "pending",
      })));
    }

    if (hasPermission(ctx.user, "content:courses")) {
      const where = eq(courseApplications.status, "pending");
      const [countRow] = await db.select({ count: sql<number>`count(*)` }).from(courseApplications).where(where);
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
        .orderBy(desc(courseApplications.createdAt), desc(courseApplications.id))
        .limit(MAX_GROUP_ITEMS);

      addGroup(groups, items, {
        key: "courseApplicationPending",
        label: "승인 대기 강좌 신청",
        description: "아직 승인 또는 거절하지 않은 강좌 신청입니다.",
        tab: "courses",
        count: toCount(countRow?.count),
        tone: "pending",
      }, rows.map((row) => ({
        id: `courseApplication:${row.id}`,
        groupKey: "courseApplicationPending",
        label: "강좌 신청",
        title: row.courseTitle ?? "강좌 신청",
        meta: row.applicantName,
        tab: "courses",
        createdAt: row.createdAt,
        tone: "pending",
      })));
    }

    if (hasPermission(ctx.user, "content:missionReports")) {
      const where = eq(missionReports.status, "pending");
      const [countRow] = await db.select({ count: sql<number>`count(*)` }).from(missionReports).where(where);
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

      addGroup(groups, items, {
        key: "missionReportPending",
        label: "검토 대기 선교보고",
        description: "아직 게시 승인하지 않은 선교보고입니다.",
        tab: "missionReports",
        count: toCount(countRow?.count),
        tone: "pending",
      }, rows.map((row) => ({
        id: `missionReport:${row.id}`,
        groupKey: "missionReportPending",
        label: "선교보고",
        title: row.title,
        meta: row.reportDate,
        tab: "missionReports",
        createdAt: row.createdAt,
        tone: "pending",
      })));
    }

    if (ctx.user.role === "admin") {
      const where = eq(churchMembers.status, "pending");
      const [countRow] = await db.select({ count: sql<number>`count(*)` }).from(churchMembers).where(where);
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

      addGroup(groups, items, {
        key: "memberPending",
        label: "승인 대기 성도",
        description: "가입 후 아직 승인하지 않은 성도 계정입니다.",
        tab: "members",
        count: toCount(countRow?.count),
        tone: "pending",
      }, rows.map((row) => ({
        id: `member:${row.id}`,
        groupKey: "memberPending",
        label: "성도 가입",
        title: row.name,
        meta: row.phone ?? "연락처 없음",
        tab: "members",
        createdAt: row.createdAt,
        tone: "pending",
      })));
    }

    if (hasSupportPermission(ctx.user, SUPPORT_REQUEST_PERMISSION_KEYS.prayers)) {
      const where = eq(prayerRequests.status, "new");
      const [countRow] = await db.select({ count: sql<number>`count(*)` }).from(prayerRequests).where(where);
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

      addGroup(groups, items, {
        key: "prayerRequestNew",
        label: "새 기도 요청",
        description: "아직 확인 처리하지 않은 기도 요청입니다.",
        tab: "supportRequests",
        count: toCount(countRow?.count),
        tone: "pending",
      }, rows.map((row) => ({
        id: `prayerRequest:${row.id}`,
        groupKey: "prayerRequestNew",
        label: "기도 요청",
        title: row.category,
        meta: row.name,
        tab: "supportRequests",
        createdAt: row.createdAt,
        tone: "pending",
      })));
    }

    if (hasSupportPermission(ctx.user, SUPPORT_REQUEST_PERMISSION_KEYS.newMembers)) {
      const where = eq(newMemberRequests.status, "new");
      const [countRow] = await db.select({ count: sql<number>`count(*)` }).from(newMemberRequests).where(where);
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

      addGroup(groups, items, {
        key: "newMemberRequestNew",
        label: "새가족 새 문의",
        description: "아직 연락 처리하지 않은 새가족 문의입니다.",
        tab: "supportRequests",
        count: toCount(countRow?.count),
        tone: "pending",
      }, rows.map((row) => ({
        id: `newMemberRequest:${row.id}`,
        groupKey: "newMemberRequestNew",
        label: "새가족 문의",
        title: row.name,
        meta: row.phone,
        tab: "supportRequests",
        createdAt: row.createdAt,
        tone: "pending",
      })));
    }

    if (hasSupportPermission(ctx.user, SUPPORT_REQUEST_PERMISSION_KEYS.visits)) {
      const where = eq(visitRequests.status, "new");
      const [countRow] = await db.select({ count: sql<number>`count(*)` }).from(visitRequests).where(where);
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

      addGroup(groups, items, {
        key: "visitRequestNew",
        label: "새 탐방 신청",
        description: "아직 연락 처리하지 않은 탐방 신청입니다.",
        tab: "supportRequests",
        count: toCount(countRow?.count),
        tone: "pending",
      }, rows.map((row) => ({
        id: `visitRequest:${row.id}`,
        groupKey: "visitRequestNew",
        label: "탐방 신청",
        title: row.organizationName,
        meta: `${row.applicantName} · ${row.visitDate}`,
        tab: "supportRequests",
        createdAt: row.createdAt,
        tone: "pending",
      })));
    }

    if (hasSupportPermission(ctx.user, SUPPORT_REQUEST_PERMISSION_KEYS.subtitles)) {
      const where = eq(subtitleRequests.status, "new");
      const [countRow] = await db.select({ count: sql<number>`count(*)` }).from(subtitleRequests).where(where);
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

      addGroup(groups, items, {
        key: "subtitleRequestNew",
        label: "새 자막 신청",
        description: "아직 검토 처리하지 않은 자막 신청입니다.",
        tab: "supportRequests",
        count: toCount(countRow?.count),
        tone: "pending",
      }, rows.map((row) => ({
        id: `subtitleRequest:${row.id}`,
        groupKey: "subtitleRequestNew",
        label: "자막 신청",
        title: row.title,
        meta: row.authorName,
        tab: "supportRequests",
        createdAt: row.createdAt,
        tone: "pending",
      })));
    }

    if (hasSupportPermission(ctx.user, SUPPORT_REQUEST_PERMISSION_KEYS.bulletinAds)) {
      const where = eq(bulletinAdRequests.status, "new");
      const [countRow] = await db.select({ count: sql<number>`count(*)` }).from(bulletinAdRequests).where(where);
      const rows = await db
        .select({
          id: bulletinAdRequests.id,
          title: bulletinAdRequests.title,
          authorName: bulletinAdRequests.authorName,
          createdAt: bulletinAdRequests.createdAt,
        })
        .from(bulletinAdRequests)
        .where(where)
        .orderBy(desc(bulletinAdRequests.createdAt), desc(bulletinAdRequests.id))
        .limit(MAX_GROUP_ITEMS);

      addGroup(groups, items, {
        key: "bulletinAdRequestNew",
        label: "새 주보 광고신청",
        description: "아직 검토 처리하지 않은 주보 광고신청입니다.",
        tab: "supportRequests",
        count: toCount(countRow?.count),
        tone: "pending",
      }, rows.map((row) => ({
        id: `bulletinAdRequest:${row.id}`,
        groupKey: "bulletinAdRequestNew",
        label: "주보 광고신청",
        title: row.title,
        meta: row.authorName,
        tab: "supportRequests",
        createdAt: row.createdAt,
        tone: "pending",
      })));
    }

    const sortedItems = items
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, MAX_RECENT_ITEMS);

    return {
      recentDays: RECENT_DAYS,
      totalCount: groups.reduce((sum, group) => sum + group.count, 0),
      groups,
      items: sortedItems,
    };
  }),
});
