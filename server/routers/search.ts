import { z } from "zod";
import { and, desc, eq, like, or } from "drizzle-orm";
import { publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db/connection";
import {
  galleryItems,
  menuItems,
  menuSubItems,
  notices,
  pastorBooks,
  testimonyPosts,
  youtubePlaylists,
  youtubeVideos,
} from "../../drizzle/schema";
import { ADMIN_RESOURCE_CATEGORY } from "../../shared/noticeCategories";

const searchInput = z.object({
  q: z.string().trim().min(1).max(80),
});

const GALLERY_PAGE_HREF =
  "/page/%EC%BB%A4%EB%AE%A4%EB%8B%88%ED%8B%B0-%EC%B5%9C%EA%B7%BC-%ED%96%89%EC%82%AC-%EC%82%AC%EC%A7%84";
const NOTICE_PAGE_HREF =
  "/page/%ED%96%89%EC%A0%95%EC%A7%80%EC%9B%90-%EA%B3%B5%EC%A7%80%EC%82%AC%ED%95%AD";
const RESOURCE_PAGE_HREF =
  "/page/%ED%96%89%EC%A0%95%EC%A7%80%EC%9B%90-%EC%9E%90%EB%A3%8C%EC%8B%A4";

function contains(keyword: string) {
  return `%${keyword.replace(/[\\%_]/g, "\\$&")}%`;
}

function excerpt(value: string | null | undefined, max = 110) {
  const clean = value?.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() ?? "";
  if (!clean) return null;
  return clean.length > max ? `${clean.slice(0, max)}...` : clean;
}

function formatDate(value: string | Date | null | undefined) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return value;
}

function videoHref(playlistTitle: string | null) {
  const title = playlistTitle ?? "";
  if (title.includes("주일")) return "/worship/tv/sunday";
  if (title.includes("헤브론") || title.includes("수요")) return "/worship/tv/hebron";
  if (title.includes("금요") || title.includes("쉐키나")) return "/worship/tv/shekhinah";
  if (title.includes("새벽") || title.includes("글로리아")) return "/worship/tv/gloria";
  if (title.includes("박진석") || title.includes("시리즈")) return "/worship/tv/pastor-series";
  if (title.includes("하영인")) return "/worship/tv/hayoungin";
  if (title.includes("특별")) return "/worship/tv/special";
  if (title.includes("특집")) return "/worship/tv/feature";
  if (title.includes("간증")) return "/worship/tv/testimony";
  if (title.includes("찬양")) return "/worship/tv/praise";
  return "/worship/tv";
}

export const searchRouter = router({
  global: publicProcedure.input(searchInput).query(async ({ input }) => {
    const db = await getDb();
    if (!db) {
      return {
        keyword: input.q,
        videos: [],
        posts: [],
      };
    }

    const keyword = contains(input.q);

    const [videoRows, noticeRows, testimonyRows, pastorBookRows, galleryRows] = await Promise.all([
      db
        .select({
          id: youtubeVideos.id,
          title: youtubeVideos.title,
          preacher: youtubeVideos.preacher,
          scripture: youtubeVideos.scripture,
          sermonDate: youtubeVideos.sermonDate,
          description: youtubeVideos.description,
          playlistTitle: youtubePlaylists.title,
          menuItemHref: menuItems.href,
          menuSubItemHref: menuSubItems.href,
        })
        .from(youtubeVideos)
        .leftJoin(youtubePlaylists, eq(youtubeVideos.playlistId, youtubePlaylists.id))
        .leftJoin(menuItems, eq(youtubeVideos.playlistId, menuItems.playlistId))
        .leftJoin(menuSubItems, eq(youtubeVideos.playlistId, menuSubItems.playlistId))
        .where(
          and(
            eq(youtubeVideos.isVisible, true),
            or(
              like(youtubeVideos.title, keyword),
              like(youtubeVideos.preacher, keyword),
              like(youtubeVideos.scripture, keyword),
              like(youtubeVideos.description, keyword),
              like(youtubePlaylists.title, keyword),
            ),
          ),
        )
        .orderBy(desc(youtubeVideos.sermonDate), desc(youtubeVideos.createdAt))
        .limit(8),

      db
        .select({
          id: notices.id,
          title: notices.title,
          category: notices.category,
          content: notices.content,
          attachmentName: notices.attachmentName,
          createdAt: notices.createdAt,
        })
        .from(notices)
        .where(
          and(
            eq(notices.isPublished, true),
            eq(notices.isSecret, false),
            or(
              like(notices.title, keyword),
              like(notices.category, keyword),
              like(notices.content, keyword),
              like(notices.attachmentName, keyword),
            ),
          ),
        )
        .orderBy(desc(notices.createdAt))
        .limit(8),

      db
        .select({
          id: testimonyPosts.id,
          title: testimonyPosts.title,
          content: testimonyPosts.content,
          createdAt: testimonyPosts.createdAt,
        })
        .from(testimonyPosts)
        .where(
          and(
            eq(testimonyPosts.status, "published"),
            eq(testimonyPosts.isSecret, false),
            or(like(testimonyPosts.title, keyword), like(testimonyPosts.content, keyword)),
          ),
        )
        .orderBy(desc(testimonyPosts.createdAt), desc(testimonyPosts.id))
        .limit(8),

      db
        .select({
          id: pastorBooks.id,
          title: pastorBooks.title,
          summary: pastorBooks.summary,
          contentHtml: pastorBooks.contentHtml,
          publishedAt: pastorBooks.publishedAt,
        })
        .from(pastorBooks)
        .where(
          and(
            eq(pastorBooks.isVisible, true),
            or(
              like(pastorBooks.title, keyword),
              like(pastorBooks.summary, keyword),
              like(pastorBooks.contentHtml, keyword),
            ),
          ),
        )
        .orderBy(desc(pastorBooks.sortOrder), desc(pastorBooks.publishedAt), desc(pastorBooks.id))
        .limit(8),

      db
        .select({
          id: galleryItems.id,
          albumKey: galleryItems.albumKey,
          albumTitle: galleryItems.albumTitle,
          albumDescription: galleryItems.albumDescription,
          caption: galleryItems.caption,
          createdAt: galleryItems.createdAt,
        })
        .from(galleryItems)
        .where(
          and(
            eq(galleryItems.isVisible, true),
            or(
              like(galleryItems.albumTitle, keyword),
              like(galleryItems.albumDescription, keyword),
              like(galleryItems.caption, keyword),
            ),
          ),
        )
        .orderBy(desc(galleryItems.albumSortOrder), desc(galleryItems.createdAt), desc(galleryItems.id))
        .limit(8),
    ]);

    const posts = [
      ...pastorBookRows.map((item) => ({
        id: `pastor-book-${item.id}`,
        title: item.title,
        category: "담임목사님 저서",
        summary: excerpt(item.summary || item.contentHtml),
        date: item.publishedAt,
        href: `/about/pastor/books/${item.id}`,
      })),
      ...galleryRows.map((item) => ({
        id: `gallery-${item.albumKey || item.id}`,
        title: item.albumTitle || item.caption || "행사사진",
        category: "행사사진",
        summary: excerpt(item.albumDescription || item.caption),
        date: formatDate(item.createdAt),
        href: item.albumKey ? `${GALLERY_PAGE_HREF}?album=${encodeURIComponent(item.albumKey)}` : GALLERY_PAGE_HREF,
      })),
      ...testimonyRows.map((item) => ({
        id: `testimony-${item.id}`,
        title: item.title,
        category: "은혜의 간증",
        summary: excerpt(item.content),
        date: formatDate(item.createdAt),
        href: `/community/testimony/${item.id}`,
      })),
      ...noticeRows.map((item) => ({
        id: `notice-${item.id}`,
        title: item.title,
        category: item.category === ADMIN_RESOURCE_CATEGORY ? "자료실" : "공지사항",
        summary: excerpt(item.content) || item.attachmentName,
        date: formatDate(item.createdAt),
        href: item.category === ADMIN_RESOURCE_CATEGORY ? RESOURCE_PAGE_HREF : NOTICE_PAGE_HREF,
      })),
    ].sort((a, b) => String(b.date ?? "").localeCompare(String(a.date ?? "")));

    return {
      keyword: input.q,
      videos: videoRows.map((item) => ({
        id: item.id,
        title: item.title,
        category: item.playlistTitle || "설교/영상",
        summary: [item.preacher, item.scripture].filter(Boolean).join(" · ") || excerpt(item.description),
        date: item.sermonDate || null,
        href: item.menuSubItemHref || item.menuItemHref || videoHref(item.playlistTitle),
      })),
      posts,
    };
  }),
});
