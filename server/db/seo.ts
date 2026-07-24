import { and, desc, eq } from "drizzle-orm";
import {
  bulletins,
  missionReports,
  pastorBooks,
  testimonyPosts,
} from "../../drizzle/schema";
import { getDb } from "./connection";

const DEFAULT_SITEMAP_LIMIT = 500;

async function requireDb() {
  const db = await getDb();
  if (!db) {
    throw new Error("검색 사이트맵을 위한 DB 연결이 설정되지 않았습니다.");
  }
  return db;
}

export async function listPublishedBulletinSeoRows(
  limit = DEFAULT_SITEMAP_LIMIT
) {
  const db = await requireDb();
  return db
    .select({
      id: bulletins.id,
      title: bulletins.title,
      bulletinDate: bulletins.bulletinDate,
      updatedAt: bulletins.updatedAt,
    })
    .from(bulletins)
    .where(eq(bulletins.status, "published"))
    .orderBy(desc(bulletins.bulletinDate), desc(bulletins.createdAt))
    .limit(limit);
}

export async function listPublishedMissionReportSeoRows(
  limit = DEFAULT_SITEMAP_LIMIT
) {
  const db = await requireDb();
  return db
    .select({
      id: missionReports.id,
      title: missionReports.title,
      updatedAt: missionReports.updatedAt,
    })
    .from(missionReports)
    .where(eq(missionReports.status, "published"))
    .orderBy(desc(missionReports.reportDate), desc(missionReports.id))
    .limit(limit);
}

export async function listPublishedTestimonySeoRows(
  limit = DEFAULT_SITEMAP_LIMIT
) {
  const db = await requireDb();
  return db
    .select({
      id: testimonyPosts.id,
      title: testimonyPosts.title,
      updatedAt: testimonyPosts.updatedAt,
    })
    .from(testimonyPosts)
    .where(
      and(
        eq(testimonyPosts.status, "published"),
        eq(testimonyPosts.isSecret, false)
      )
    )
    .orderBy(desc(testimonyPosts.createdAt), desc(testimonyPosts.id))
    .limit(limit);
}

export async function listVisiblePastorBookSeoRows(
  limit = DEFAULT_SITEMAP_LIMIT
) {
  const db = await requireDb();
  return db
    .select({
      id: pastorBooks.id,
      title: pastorBooks.title,
      updatedAt: pastorBooks.updatedAt,
    })
    .from(pastorBooks)
    .where(eq(pastorBooks.isVisible, true))
    .orderBy(
      desc(pastorBooks.sortOrder),
      desc(pastorBooks.publishedAt),
      desc(pastorBooks.id)
    )
    .limit(limit);
}
