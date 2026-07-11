import { z } from "zod";
import { and, desc, eq, inArray, like, or } from "drizzle-orm";
import { publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db/connection";
import { getVisibleMenus } from "../db/menu";
import {
  affiliates,
  churchStaff,
  churchStaffCategories,
  courses,
  dynamicBoardPosts,
  dynamicBoards,
  facilities,
  freeBoardPosts,
  galleryItems,
  heroSlides,
  historyDecades,
  historyItems,
  menuItems,
  menuSubItems,
  missionaries,
  missionReports,
  notices,
  pageBlocks,
  pastorBooks,
  quickMenus,
  schoolDepartments,
  schoolPosts,
  testimonyPosts,
  youtubePlaylists,
  youtubeVideos,
} from "../../drizzle/schema";
import { ADMIN_RESOURCE_CATEGORY } from "../../shared/noticeCategories";

const searchInput = z.object({
  q: z.string().trim().min(1).max(80),
});

const GROUP_LIMIT = 30;
const MENU_BOARD_CATEGORY_PREFIX = "menu-board:";

export const GALLERY_PAGE_HREF =
  "/page/%EC%BB%A4%EB%AE%A4%EB%8B%88%ED%8B%B0-%EC%B5%9C%EA%B7%BC-%ED%96%89%EC%82%AC-%EC%82%AC%EC%A7%84";
export const NOTICE_PAGE_HREF =
  "/page/%ED%96%89%EC%A0%95%EC%A7%80%EC%9B%90-%EA%B3%B5%EC%A7%80%EC%82%AC%ED%95%AD";
export const RESOURCE_PAGE_HREF =
  "/page/%ED%96%89%EC%A0%95%EC%A7%80%EC%9B%90-%EC%9E%90%EB%A3%8C%EC%8B%A4";
const HISTORY_PAGE_HREF = "/about/history";
const STAFF_PAGE_HREF = "/about/staff";
const STAFF_ASSOCIATE_PAGE_HREF = "/about/staff/associate";
const FACILITY_PAGE_HREF = "/facility";
const COURSE_PAGE_HREF = "/education/courses";
const MISSION_PAGE_HREF = "/mission";
const SCHOOL_PAGE_HREF = "/school/infant";

type SearchLinkType = "internal" | "external" | "none";

export type GroupedSearchItem = {
  id: string;
  title: string;
  category: string;
  summary: string | null;
  date: string | null;
  href: string;
  linkType: SearchLinkType;
};

export type GroupedSearchGroup = {
  key: string;
  label: string;
  description: string;
  href: string;
  items: GroupedSearchItem[];
};

type LegacySearchItem = Omit<GroupedSearchItem, "linkType">;

export type GroupedSearchResult = {
  keyword: string;
  groups: GroupedSearchGroup[];
  videos: LegacySearchItem[];
  posts: LegacySearchItem[];
};

type GuestVisibleMenuNode = {
  id: number;
  label: string;
  href?: string | null;
  pageType?: string | null;
  allowGuest?: boolean;
  allowMember?: boolean;
  items?: GuestVisibleMenuNode[];
  subItems?: GuestVisibleMenuNode[];
};

type SearchDataset = {
  guestMenus: GuestVisibleMenuNode[];
  youtubeVideos: Array<{
    id: number;
    title: string;
    preacher: string | null;
    scripture: string | null;
    sermonDate: string | null;
    description: string | null;
    isVisible: boolean;
    playlistTitle: string | null;
    menuItemHref: string | null;
    menuSubItemHref: string | null;
  }>;
  notices: Array<{
    id: number;
    title: string;
    category: string;
    content: string | null;
    attachmentName: string | null;
    createdAt: Date | string | null;
    isPublished: boolean;
    isSecret: boolean;
  }>;
  testimonyPosts: Array<{
    id: number;
    title: string;
    content: string;
    createdAt: Date | string;
    status: string;
    isSecret: boolean;
  }>;
  pastorBooks: Array<{
    id: number;
    title: string;
    summary: string | null;
    contentHtml: string | null;
    publishedAt: string | null;
    externalUrl: string | null;
    isVisible: boolean;
    sortOrder: number;
  }>;
  galleryItems: Array<{
    id: number;
    albumKey: string | null;
    albumTitle: string | null;
    albumDescription: string | null;
    caption: string | null;
    createdAt: Date | string;
    isVisible: boolean;
    albumSortOrder: number;
  }>;
  pageBlocks: Array<{
    id: number;
    menuItemId: number | null;
    menuSubItemId: number | null;
    blockType: string;
    content: string;
    createdAt: Date | string;
    isVisible: boolean;
  }>;
  dynamicBoardPosts: Array<{
    id: number;
    boardId: number;
    boardTitle: string;
    menuItemId: number | null;
    menuSubItemId: number | null;
    title: string;
    content: string | null;
    createdAt: Date | string;
    isPublished: boolean;
    isSecret: boolean;
  }>;
  freeBoardPosts: Array<{
    id: number;
    title: string;
    content: string;
    createdAt: Date | string;
    status: string;
    isSecret: boolean;
  }>;
  historyItems: Array<{
    id: number;
    decadeTitle: string;
    year: number;
    month: number;
    content: string;
    isVisible: boolean;
    decadeIsVisible: boolean;
  }>;
  staffCategories: Array<{
    categoryKey: string;
    label: string;
    isVisible: boolean;
  }>;
  staffMembers: Array<{
    id: number;
    category: string;
    name: string;
    title: string | null;
    department: string | null;
    email: string | null;
    phone: string | null;
    description: string | null;
    profile: string | null;
    isVisible: boolean;
  }>;
  facilities: Array<{
    id: number;
    name: string;
    description: string | null;
    location: string | null;
    building: string;
    notice: string | null;
    caution: string | null;
    isVisible: boolean;
  }>;
  courses: Array<{
    id: number;
    title: string;
    summary: string | null;
    description: string | null;
    instructor: string | null;
    location: string | null;
    target: string | null;
    fee: string | null;
    startDate: string | null;
    applyEndDate: string | null;
    status: string;
    isVisible: boolean;
    audience: string;
    pageHref: string | null;
  }>;
  missionaries: Array<{
    id: number;
    name: string;
    region: string;
    organization: string | null;
    description: string | null;
    sentYear: number;
    isActive: boolean;
  }>;
  missionReports: Array<{
    id: number;
    missionaryId: number;
    missionaryName: string;
    missionaryRegion: string;
    title: string;
    summary: string | null;
    content: string | null;
    reportDate: string;
    status: string;
  }>;
  schoolDepartments: Array<{
    id: number;
    name: string;
    category: string;
    ageRange: string | null;
    worshipTime: string | null;
    worshipPlace: string | null;
    description: string | null;
    educationGoals: string | null;
    prayerTopics: string | null;
    staffInfo: string | null;
    isVisible: boolean;
  }>;
  schoolPosts: Array<{
    id: number;
    departmentId: number;
    departmentName: string;
    title: string;
    content: string | null;
    authorName: string;
    createdAt: Date | string;
    isVisible: boolean;
    departmentIsVisible: boolean;
  }>;
  heroSlides: Array<{
    id: number;
    yearLabel: string | null;
    mainTitle: string | null;
    subTitle: string | null;
    bibleRef: string | null;
    btn1Text: string | null;
    btn1Href: string | null;
    btn2Text: string | null;
    btn2Href: string | null;
    buttonsJson: string | null;
    isVisible: boolean;
  }>;
  quickMenus: Array<{
    id: number;
    label: string;
    href: string | null;
    isVisible: boolean;
  }>;
  affiliates: Array<{
    id: number;
    label: string;
    href: string | null;
    isVisible: boolean;
  }>;
};

function contains(keyword: string) {
  return `%${keyword.replace(/[\\%_]/g, "\\$&")}%`;
}

function stripHtml(value: string | null | undefined) {
  return value?.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() ?? "";
}

function normalizeText(value: string | null | undefined) {
  return stripHtml(value).toLowerCase();
}

function matchesKeyword(keyword: string, ...values: Array<string | null | undefined>) {
  const normalizedKeyword = normalizeText(keyword);
  if (!normalizedKeyword) return true;
  return values.some((value) => normalizeText(value).includes(normalizedKeyword));
}

function excerpt(value: string | null | undefined, max = 120) {
  const clean = stripHtml(value);
  if (!clean) return null;
  return clean.length > max ? `${clean.slice(0, max).trimEnd()}...` : clean;
}

function formatDate(value: string | Date | null | undefined) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return value;
}

function formatYearMonth(year: number, month: number) {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}`;
}

function compareDateDesc(left: string | null, right: string | null) {
  return String(right ?? "").localeCompare(String(left ?? ""));
}

function decodePath(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function normalizeSameOriginHref(href: string) {
  const trimmed = href.trim();
  if (!/^https?:\/\//i.test(trimmed)) return trimmed;
  try {
    const url = new URL(trimmed);
    if (url.hostname === "newjoych.co.kr" || url.hostname === "www.newjoych.co.kr") {
      return `${url.pathname}${url.search}${url.hash}`;
    }
  } catch {
    return trimmed;
  }
  return trimmed;
}

function normalizeMenuLabel(label: string | null | undefined) {
  return (label ?? "").replace(/\s+/g, "").toLowerCase();
}

function appendQueryParam(href: string, key: string, value: string | number) {
  const separator = href.includes("?") ? "&" : "?";
  return `${href}${separator}${key}=${encodeURIComponent(String(value))}`;
}

function isExternalHref(href: string) {
  return /^https?:\/\//i.test(href.trim());
}

const INTERNAL_HREF_ALIASES = new Map<string, string>([
  ["/page/교회소개-담임목사-저서", "/about/pastor/books"],
  ["/page/교회소개-담임목사-소개-담임목사저서", "/about/pastor/books"],
  ["/page/교회소개-담임목사-소개-담임목사-저서", "/about/pastor/books"],
  ["/page/교회소개-담임목사소개-담임목사저서", "/about/pastor/books"],
  ["/page/교회소개-담임목사소개-담임목사-저서", "/about/pastor/books"],
  ["/page/교회소개-교회역사", "/about/history"],
  ["/page/교회소개-교회-역사", "/about/history"],
  ["/page/교회소개-교회연혁", "/about/history"],
  ["/page/교회소개-교회-연혁", "/about/history"],
  ["/page/교회소개-교역자", "/about/staff"],
  ["/page/교회소개-부교역자", "/about/staff/associate"],
]);

function canonicalizeInternalHref(href: string | null | undefined) {
  const value = href?.trim();
  if (!value) return "";

  const normalizedHref = normalizeSameOriginHref(value);
  if (isExternalHref(normalizedHref)) return normalizedHref;

  const decodedHref = decodePath(normalizedHref);
  const alias = INTERNAL_HREF_ALIASES.get(decodedHref);
  if (alias) return alias;

  const normalizedLabel = normalizeMenuLabel(decodedHref);
  if (normalizedLabel.includes("/page/시설사용예약외부")) return "/facility/external";

  if (decodedHref.startsWith("/page/강좌-")) {
    const slug = decodedHref.slice("/page/강좌-".length).trim();
    return slug ? `${COURSE_PAGE_HREF}/${encodeURIComponent(slug)}` : COURSE_PAGE_HREF;
  }

  return decodedHref;
}

function resolveSearchHref(href: string | null | undefined): { href: string; linkType: SearchLinkType } {
  const value = href?.trim();
  if (!value) return { href: "", linkType: "none" };

  const normalizedHref = canonicalizeInternalHref(value);
  if (!normalizedHref) return { href: "", linkType: "none" };
  if (isExternalHref(normalizedHref)) return { href: normalizedHref, linkType: "external" };
  return { href: normalizedHref, linkType: "internal" };
}

function buildSearchItem(input: {
  id: string;
  title: string;
  category: string;
  summary?: string | null;
  date?: string | null;
  href?: string | null;
}) {
  const resolvedHref = resolveSearchHref(input.href);
  return {
    id: input.id,
    title: input.title,
    category: input.category,
    summary: input.summary ?? null,
    date: input.date ?? null,
    href: resolvedHref.href,
    linkType: resolvedHref.linkType,
  } satisfies GroupedSearchItem;
}

function toLegacyItem(item: GroupedSearchItem): LegacySearchItem {
  return {
    id: item.id,
    title: item.title,
    category: item.category,
    summary: item.summary,
    date: item.date,
    href: item.href,
  };
}

function takeGroupItems(items: GroupedSearchItem[]) {
  return items.slice(0, GROUP_LIMIT);
}

function createGroup(
  key: string,
  label: string,
  description: string,
  href: string,
  items: GroupedSearchItem[],
) {
  if (items.length === 0) return null;
  return {
    key,
    label,
    description,
    href,
    items: takeGroupItems(items),
  } satisfies GroupedSearchGroup;
}

function parseJsonObject(value: string | null | undefined) {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

export function extractPageBlockText(blockType: string, rawContent: string) {
  const parsed = parseJsonObject(rawContent);
  const values: string[] = [];

  if (!parsed) {
    const fallback = stripHtml(rawContent);
    return fallback ? [fallback] : [];
  }

  const content = parsed as Record<string, unknown>;

  if (typeof content.text === "string") values.push(content.text);
  if (typeof content.title === "string") values.push(content.title);
  if (typeof content.label === "string") values.push(content.label);
  if (typeof content.href === "string") values.push(content.href);
  if (typeof content.videoId === "string") values.push(content.videoId);
  if (Array.isArray(content.urls)) {
    for (const value of content.urls) {
      if (typeof value === "string") values.push(value);
    }
  }
  if (Array.isArray(content.captions)) {
    for (const value of content.captions) {
      if (typeof value === "string") values.push(value);
    }
  }

  if (blockType === "button" && typeof content.style === "string") values.push(content.style);

  return values.map((value) => stripHtml(value)).filter(Boolean);
}

function parseHeroButtons(rawButtons: string | null | undefined) {
  const parsed = parseJsonObject(rawButtons);
  if (!parsed || !Array.isArray(parsed)) return [] as Array<{ label: string; href: string | null }>;
  return parsed
    .map((button) => {
      if (!button || typeof button !== "object") return null;
      const record = button as Record<string, unknown>;
      const label = typeof record.label === "string"
        ? record.label
        : typeof record.text === "string"
          ? record.text
          : "";
      const href = typeof record.href === "string" ? record.href : null;
      return label ? { label, href } : null;
    })
    .filter((button): button is { label: string; href: string | null } => Boolean(button));
}

function isFreeBoardMenuTarget(label: string, href: string | null | undefined) {
  const normalized = normalizeMenuLabel(`${label} ${href ?? ""}`);
  return normalized.includes("자유게시판") || normalized.includes("joytalk");
}

function getSchoolDepartmentHref(name: string) {
  const normalized = normalizeMenuLabel(name);
  if (normalized.includes("영아") || normalized.includes("유아")) return "/school/infant";
  if (normalized.includes("유치")) return "/school/kinder";
  if (normalized.includes("초등") || normalized.includes("유년") || normalized.includes("소년")) return "/school/elementary";
  if (normalized.includes("중고") || normalized.includes("청소년")) return "/school/youth";
  if (normalized.includes("awana")) return "/school/awana";
  if (normalized.includes("청년")) return "/school/young-adult";
  return SCHOOL_PAGE_HREF;
}

function getCourseHref(pageHref: string | null | undefined) {
  const normalizedHref = canonicalizeInternalHref(pageHref ?? "");
  if (!normalizedHref) return COURSE_PAGE_HREF;
  if (normalizedHref.startsWith("/education/courses")) return normalizedHref;
  if (normalizedHref.startsWith("/page/강좌-")) {
    const slug = normalizedHref.slice("/page/강좌-".length).trim();
    return slug ? `${COURSE_PAGE_HREF}/${encodeURIComponent(slug)}` : COURSE_PAGE_HREF;
  }
  return normalizedHref;
}

function videoHref(playlistTitle: string | null, menuItemHref: string | null, menuSubItemHref: string | null) {
  if (menuSubItemHref || menuItemHref) {
    return canonicalizeInternalHref(menuSubItemHref || menuItemHref || "");
  }

  const normalized = normalizeMenuLabel(playlistTitle);
  if (normalized.includes("주일")) return "/worship/tv/sunday";
  if (normalized.includes("헤브론")) return "/worship/tv/hebron";
  if (normalized.includes("금요") || normalized.includes("쉐키나")) return "/worship/tv/shekhinah";
  if (normalized.includes("글로리")) return "/worship/tv/gloria";
  if (normalized.includes("목사시리즈") || normalized.includes("설교")) return "/worship/tv/pastor-series";
  if (normalized.includes("하영")) return "/worship/tv/hayoungin";
  if (normalized.includes("특별") || normalized.includes("특집")) return "/worship/tv/special";
  if (normalized.includes("간증")) return "/worship/tv/testimony";
  if (normalized.includes("찬양")) return "/worship/tv/praise";
  return "/worship/tv";
}

type GuestTargetMeta = {
  id: number;
  label: string;
  href: string;
  pageType: string;
};

function indexGuestMenus(guestMenus: GuestVisibleMenuNode[]) {
  const itemMap = new Map<number, GuestTargetMeta>();
  const subItemMap = new Map<number, GuestTargetMeta>();
  let freeBoardHref = "";

  for (const menu of guestMenus) {
    for (const item of menu.items ?? []) {
      const itemHref = canonicalizeInternalHref(item.href ?? "");
      itemMap.set(item.id, {
        id: item.id,
        label: item.label,
        href: itemHref,
        pageType: item.pageType ?? "image",
      });
      if (!freeBoardHref && isFreeBoardMenuTarget(item.label, itemHref)) {
        freeBoardHref = itemHref;
      }

      for (const subItem of item.subItems ?? []) {
        const subItemHref = canonicalizeInternalHref(subItem.href ?? "");
        subItemMap.set(subItem.id, {
          id: subItem.id,
          label: subItem.label,
          href: subItemHref,
          pageType: subItem.pageType ?? "image",
        });
        if (!freeBoardHref && isFreeBoardMenuTarget(subItem.label, subItemHref)) {
          freeBoardHref = subItemHref;
        }
      }
    }
  }

  return { itemMap, subItemMap, freeBoardHref };
}

function getDynamicTargetMeta(
  itemMap: Map<number, GuestTargetMeta>,
  subItemMap: Map<number, GuestTargetMeta>,
  menuItemId: number | null,
  menuSubItemId: number | null,
) {
  if (menuSubItemId) return subItemMap.get(menuSubItemId) ?? null;
  if (menuItemId) return itemMap.get(menuItemId) ?? null;
  return null;
}

export function buildGroupedSearchResult(dataset: SearchDataset, keyword: string): GroupedSearchResult {
  const guestIndex = indexGuestMenus(dataset.guestMenus);
  const visibleStaffCategories = new Map(
    dataset.staffCategories
      .filter((category) => category.isVisible)
      .map((category) => [category.categoryKey, category.label]),
  );
  const shouldFilterByStaffCategory = dataset.staffCategories.length > 0;

  const youtubeItems = dataset.youtubeVideos
    .filter((item) =>
      item.isVisible &&
      matchesKeyword(
        keyword,
        item.title,
        item.preacher,
        item.scripture,
        item.description,
        item.playlistTitle,
      ),
    )
    .sort((left, right) => compareDateDesc(left.sermonDate, right.sermonDate))
    .map((item) =>
      buildSearchItem({
        id: `youtube-${item.id}`,
        title: item.title,
        category: item.playlistTitle || "유튜브",
        summary:
          [item.preacher, item.scripture].filter(Boolean).join(" · ") ||
          excerpt(item.description),
        date: item.sermonDate,
        href: appendQueryParam(videoHref(item.playlistTitle, item.menuItemHref, item.menuSubItemHref), "video", item.id),
      }),
    );

  const noticeItems = dataset.notices
    .filter((item) =>
      item.isPublished &&
      !item.isSecret &&
      item.category !== ADMIN_RESOURCE_CATEGORY &&
      !item.category.startsWith(MENU_BOARD_CATEGORY_PREFIX) &&
      matchesKeyword(keyword, item.title, item.category, item.content, item.attachmentName),
    )
    .sort((left, right) => compareDateDesc(formatDate(left.createdAt), formatDate(right.createdAt)))
    .map((item) =>
      buildSearchItem({
        id: `notice-${item.id}`,
        title: item.title,
        category: "공지사항",
        summary: excerpt(item.content) || excerpt(item.attachmentName),
        date: formatDate(item.createdAt),
        href: appendQueryParam(NOTICE_PAGE_HREF, "post", item.id),
      }),
    );

  const resourceItems = dataset.notices
    .filter((item) =>
      item.isPublished &&
      !item.isSecret &&
      item.category === ADMIN_RESOURCE_CATEGORY &&
      matchesKeyword(keyword, item.title, item.category, item.content, item.attachmentName),
    )
    .sort((left, right) => compareDateDesc(formatDate(left.createdAt), formatDate(right.createdAt)))
    .map((item) =>
      buildSearchItem({
        id: `resource-${item.id}`,
        title: item.title,
        category: "자료실",
        summary: excerpt(item.content) || excerpt(item.attachmentName),
        date: formatDate(item.createdAt),
        href: appendQueryParam(RESOURCE_PAGE_HREF, "post", item.id),
      }),
    );

  const testimonyItems = dataset.testimonyPosts
    .filter((item) =>
      item.status === "published" &&
      !item.isSecret &&
      matchesKeyword(keyword, item.title, item.content),
    )
    .sort((left, right) => compareDateDesc(formatDate(left.createdAt), formatDate(right.createdAt)))
    .map((item) =>
      buildSearchItem({
        id: `testimony-${item.id}`,
        title: item.title,
        category: "간증",
        summary: excerpt(item.content),
        date: formatDate(item.createdAt),
        href: `/community/testimony/${item.id}`,
      }),
    );

  const pastorBookItems = dataset.pastorBooks
    .filter((item) =>
      item.isVisible &&
      matchesKeyword(keyword, item.title, item.summary, item.contentHtml),
    )
    .sort((left, right) => {
      const sortOrderDiff = Number(left.sortOrder ?? 0) - Number(right.sortOrder ?? 0);
      if (sortOrderDiff !== 0) return sortOrderDiff;
      return compareDateDesc(left.publishedAt, right.publishedAt);
    })
    .map((item) =>
      buildSearchItem({
        id: `pastor-book-${item.id}`,
        title: item.title,
        category: "담임목사 저서",
        summary: excerpt(item.summary || item.contentHtml),
        date: item.publishedAt,
        href: item.externalUrl || `/about/pastor/books/${item.id}`,
      }),
    );

  const galleryMatches = dataset.galleryItems
    .filter((item) =>
      item.isVisible &&
      matchesKeyword(keyword, item.albumTitle, item.albumDescription, item.caption),
    )
    .sort((left, right) => {
      const albumDiff = Number(right.albumSortOrder ?? 0) - Number(left.albumSortOrder ?? 0);
      if (albumDiff !== 0) return albumDiff;
      return compareDateDesc(formatDate(left.createdAt), formatDate(right.createdAt));
    });

  const seenGalleryKeys = new Set<string>();
  const galleryItemsByAlbum = galleryMatches
    .filter((item) => {
      const key = item.albumKey?.trim() || item.albumTitle?.trim() || `single:${item.id}`;
      if (seenGalleryKeys.has(key)) return false;
      seenGalleryKeys.add(key);
      return true;
    })
    .map((item) =>
      buildSearchItem({
        id: `gallery-${item.albumKey || item.id}`,
        title: item.albumTitle || item.caption || "갤러리",
        category: "갤러리",
        summary: excerpt(item.albumDescription || item.caption),
        date: formatDate(item.createdAt),
        href: item.albumKey
          ? appendQueryParam(GALLERY_PAGE_HREF, "gallery", item.albumKey)
          : GALLERY_PAGE_HREF,
      }),
    );

  const editorPageItems = dataset.pageBlocks
    .filter((block) => {
      if (!block.isVisible) return false;
      const target = getDynamicTargetMeta(
        guestIndex.itemMap,
        guestIndex.subItemMap,
        block.menuItemId,
        block.menuSubItemId,
      );
      if (!target || target.pageType !== "editor") return false;
      const text = extractPageBlockText(block.blockType, block.content).join(" ");
      return matchesKeyword(keyword, target.label, text);
    })
    .sort((left, right) => compareDateDesc(formatDate(left.createdAt), formatDate(right.createdAt)))
    .map((block) => {
      const target = getDynamicTargetMeta(
        guestIndex.itemMap,
        guestIndex.subItemMap,
        block.menuItemId,
        block.menuSubItemId,
      )!;
      const text = extractPageBlockText(block.blockType, block.content).join(" ");
      return buildSearchItem({
        id: `page-block-${block.id}`,
        title: excerpt(text, 64) || target.label,
        category: target.label,
        summary: excerpt(text),
        date: formatDate(block.createdAt),
        href: target.href,
      });
    });

  const dynamicBoardItems = dataset.dynamicBoardPosts
    .filter((item) => {
      if (!item.isPublished || item.isSecret) return false;
      const target = getDynamicTargetMeta(
        guestIndex.itemMap,
        guestIndex.subItemMap,
        item.menuItemId,
        item.menuSubItemId,
      );
      if (!target) return false;
      return matchesKeyword(keyword, item.boardTitle, target.label, item.title, item.content);
    })
    .sort((left, right) => compareDateDesc(formatDate(left.createdAt), formatDate(right.createdAt)))
    .map((item) => {
      const target = getDynamicTargetMeta(
        guestIndex.itemMap,
        guestIndex.subItemMap,
        item.menuItemId,
        item.menuSubItemId,
      )!;
      return buildSearchItem({
        id: `dynamic-board-${item.id}`,
        title: item.title,
        category: target.label,
        summary: excerpt(item.content),
        date: formatDate(item.createdAt),
        href: appendQueryParam(target.href, "post", item.id),
      });
    });

  const freeBoardItems = guestIndex.freeBoardHref
    ? dataset.freeBoardPosts
      .filter((item) =>
        item.status === "published" &&
        !item.isSecret &&
        matchesKeyword(keyword, item.title, item.content),
      )
      .sort((left, right) => compareDateDesc(formatDate(left.createdAt), formatDate(right.createdAt)))
      .map((item) =>
        buildSearchItem({
          id: `free-board-${item.id}`,
          title: item.title,
          category: "자유게시판",
          summary: excerpt(item.content),
          date: formatDate(item.createdAt),
          href: appendQueryParam(guestIndex.freeBoardHref, "post", item.id),
        }),
      )
    : [];

  const historySearchItems = dataset.historyItems
    .filter((item) =>
      item.isVisible &&
      item.decadeIsVisible &&
      matchesKeyword(keyword, item.decadeTitle, item.content),
    )
    .sort((left, right) => {
      const yearDiff = right.year - left.year;
      if (yearDiff !== 0) return yearDiff;
      return right.month - left.month;
    })
    .map((item) =>
      buildSearchItem({
        id: `history-${item.id}`,
        title: excerpt(item.content, 64) || `${item.year}.${String(item.month).padStart(2, "0")}`,
        category: `교회 역사 · ${item.year}.${String(item.month).padStart(2, "0")}`,
        summary: excerpt(item.decadeTitle),
        date: formatYearMonth(item.year, item.month),
        href: HISTORY_PAGE_HREF,
      }),
    );

  const staffItems = dataset.staffMembers
    .filter((item) => {
      if (!item.isVisible) return false;
      if (shouldFilterByStaffCategory && !visibleStaffCategories.has(item.category)) return false;
      return matchesKeyword(keyword, item.name, item.title, item.department, item.description, item.profile);
    })
    .map((item) => {
      const categoryLabel = visibleStaffCategories.get(item.category) ?? item.category;
      return buildSearchItem({
        id: `staff-${item.id}`,
        title: item.name,
        category: categoryLabel,
        summary: excerpt([item.title, item.department, item.description, item.profile].filter(Boolean).join(" · ")),
        date: null,
        href: item.category === "associate" ? STAFF_ASSOCIATE_PAGE_HREF : STAFF_PAGE_HREF,
      });
    });

  const facilityItems = dataset.facilities
    .filter((item) =>
      item.isVisible &&
      matchesKeyword(keyword, item.name, item.description, item.location, item.notice, item.caution),
    )
    .map((item) =>
      buildSearchItem({
        id: `facility-${item.id}`,
        title: item.name,
        category: item.location || "시설",
        summary: excerpt([item.description, item.notice, item.caution].filter(Boolean).join(" · ")),
        date: null,
        href: `${FACILITY_PAGE_HREF}/${item.id}`,
      }),
    );

  const courseItems = dataset.courses
    .filter((item) =>
      item.isVisible &&
      item.audience === "all" &&
      (item.status === "open" || item.status === "closed") &&
      matchesKeyword(
        keyword,
        item.title,
        item.summary,
        item.description,
        item.instructor,
        item.location,
        item.target,
        item.fee,
      ),
    )
    .sort((left, right) => compareDateDesc(left.startDate, right.startDate))
    .map((item) =>
      buildSearchItem({
        id: `course-${item.id}`,
        title: item.title,
        category: "공개 강좌",
        summary: excerpt(
          [item.summary, item.instructor, item.location, item.target]
            .filter(Boolean)
            .join(" · "),
        ),
        date: item.startDate || item.applyEndDate,
        href: getCourseHref(item.pageHref),
      }),
    );

  const missionItems = [
    ...dataset.missionaries
      .filter((item) =>
        item.isActive &&
        matchesKeyword(keyword, item.name, item.region, item.organization, item.description),
      )
      .map((item) =>
        buildSearchItem({
          id: `missionary-${item.id}`,
          title: item.name,
          category: "선교사",
          summary: excerpt([item.region, item.organization, item.description].filter(Boolean).join(" · ")),
          date: item.sentYear > 0 ? String(item.sentYear) : null,
          href: MISSION_PAGE_HREF,
        }),
      ),
    ...dataset.missionReports
      .filter((item) =>
        item.status === "published" &&
        matchesKeyword(keyword, item.missionaryName, item.missionaryRegion, item.title, item.summary, item.content),
      )
      .map((item) =>
        buildSearchItem({
          id: `mission-report-${item.id}`,
          title: item.title,
          category: item.missionaryName,
          summary: excerpt(item.summary || item.content),
          date: item.reportDate,
          href: `${MISSION_PAGE_HREF}/${item.id}`,
        }),
      ),
  ].sort((left, right) => compareDateDesc(left.date, right.date));

  const schoolItems = [
    ...dataset.schoolDepartments
      .filter((item) =>
        item.isVisible &&
        matchesKeyword(
          keyword,
          item.name,
          item.ageRange,
          item.worshipTime,
          item.worshipPlace,
          item.description,
          item.educationGoals,
          item.prayerTopics,
          item.staffInfo,
        ),
      )
      .map((item) =>
        buildSearchItem({
          id: `school-department-${item.id}`,
          title: item.name,
          category: "교회학교",
          summary: excerpt(
            [item.ageRange, item.worshipTime, item.worshipPlace, item.description]
              .filter(Boolean)
              .join(" · "),
          ),
          date: null,
          href: getSchoolDepartmentHref(item.name),
        }),
      ),
    ...dataset.schoolPosts
      .filter((item) =>
        item.isVisible &&
        item.departmentIsVisible &&
        matchesKeyword(keyword, item.departmentName, item.title, item.content, item.authorName),
      )
      .map((item) => {
        const baseHref = getSchoolDepartmentHref(item.departmentName);
        return buildSearchItem({
          id: `school-post-${item.id}`,
          title: item.title,
          category: item.departmentName,
          summary: excerpt(item.content),
          date: formatDate(item.createdAt),
          href: appendQueryParam(baseHref, "post", item.id),
        });
      }),
  ].sort((left, right) => compareDateDesc(left.date, right.date));

  const homepageItems = [
    ...dataset.heroSlides
      .filter((item) =>
        item.isVisible &&
        matchesKeyword(
          keyword,
          item.yearLabel,
          item.mainTitle,
          item.subTitle,
          item.bibleRef,
          item.btn1Text,
          item.btn2Text,
          item.buttonsJson,
        ),
      )
      .map((item) => {
        const parsedButtons = parseHeroButtons(item.buttonsJson);
        const primaryHref =
          item.btn1Href ||
          item.btn2Href ||
          parsedButtons.find((button) => Boolean(button.href))?.href ||
          "";
        const buttonLabels = parsedButtons.map((button) => button.label).join(" · ");
        return buildSearchItem({
          id: `hero-${item.id}`,
          title: item.mainTitle || item.yearLabel || "홈페이지 메인",
          category: "메인 비주얼",
          summary: excerpt(
            [item.subTitle, item.bibleRef, item.btn1Text, item.btn2Text, buttonLabels]
              .filter(Boolean)
              .join(" · "),
          ),
          date: null,
          href: primaryHref,
        });
      }),
    ...dataset.quickMenus
      .filter((item) => item.isVisible && matchesKeyword(keyword, item.label, item.href))
      .map((item) =>
        buildSearchItem({
          id: `quick-menu-${item.id}`,
          title: item.label,
          category: "빠른 메뉴",
          summary: excerpt(item.href),
          date: null,
          href: item.href,
        }),
      ),
    ...dataset.affiliates
      .filter((item) => item.isVisible && matchesKeyword(keyword, item.label, item.href))
      .map((item) =>
        buildSearchItem({
          id: `affiliate-${item.id}`,
          title: item.label,
          category: "관련 기관",
          summary: excerpt(item.href),
          date: null,
          href: item.href,
        }),
      ),
  ];

  const groups = [
    createGroup("youtube", "예배 영상", "유튜브 설교와 예배 영상 검색 결과입니다.", "/worship/tv", youtubeItems),
    createGroup("notices", "공지사항", "공개 공지사항 검색 결과입니다.", NOTICE_PAGE_HREF, noticeItems),
    createGroup("resources", "자료실", "공개 자료실 검색 결과입니다.", RESOURCE_PAGE_HREF, resourceItems),
    createGroup("testimonies", "간증", "공개 간증 게시물 검색 결과입니다.", "/community/testimony", testimonyItems),
    createGroup("pastor-books", "담임목사 저서", "공개 저서 검색 결과입니다.", "/about/pastor/books", pastorBookItems),
    createGroup("gallery", "갤러리", "공개 사진 앨범 검색 결과입니다.", GALLERY_PAGE_HREF, galleryItemsByAlbum),
    createGroup("pages", "페이지 콘텐츠", "게스트에게 공개된 에디터 페이지 검색 결과입니다.", editorPageItems[0]?.href || "/", editorPageItems),
    createGroup("board-posts", "게시판", "게스트에게 공개된 동적 게시판 검색 결과입니다.", dynamicBoardItems[0]?.href || "/", dynamicBoardItems),
    createGroup("free-board", "자유게시판", "게스트에게 공개된 자유게시판 검색 결과입니다.", guestIndex.freeBoardHref || "/", freeBoardItems),
    createGroup("history", "교회 역사", "공개 연혁 검색 결과입니다.", HISTORY_PAGE_HREF, historySearchItems),
    createGroup("staff", "교역자", "공개 교역자 소개 검색 결과입니다.", STAFF_PAGE_HREF, staffItems),
    createGroup("facilities", "시설", "공개 시설 안내 검색 결과입니다.", FACILITY_PAGE_HREF, facilityItems),
    createGroup("courses", "강좌", "공개 강좌 검색 결과입니다.", COURSE_PAGE_HREF, courseItems),
    createGroup("mission", "선교", "공개 선교사와 선교보고 검색 결과입니다.", MISSION_PAGE_HREF, missionItems),
    createGroup("school", "교회학교", "공개 교회학교 부서와 게시물 검색 결과입니다.", schoolItems[0]?.href || SCHOOL_PAGE_HREF, schoolItems),
    createGroup("homepage", "홈페이지", "홈 화면의 공개 문구와 바로가기 검색 결과입니다.", "/", homepageItems),
  ].filter((group): group is GroupedSearchGroup => Boolean(group));

  const legacyVideos = takeGroupItems(youtubeItems).map(toLegacyItem);
  const legacyPosts = [
    ...takeGroupItems(pastorBookItems),
    ...takeGroupItems(galleryItemsByAlbum),
    ...takeGroupItems(testimonyItems),
    ...takeGroupItems(noticeItems),
    ...takeGroupItems(resourceItems),
  ]
    .sort((left, right) => compareDateDesc(left.date, right.date))
    .map(toLegacyItem);

  return {
    keyword,
    groups,
    videos: legacyVideos,
    posts: legacyPosts,
  };
}

function emptyGroupedSearchResult(keyword: string): GroupedSearchResult {
  return {
    keyword,
    groups: [],
    videos: [],
    posts: [],
  };
}

async function loadSearchDataset(keyword: string): Promise<SearchDataset | null> {
  const db = await getDb();
  if (!db) return null;

  const guestMenus = await getVisibleMenus("guest");
  const menuIndex = indexGuestMenus(guestMenus as GuestVisibleMenuNode[]);
  const visibleEditorItemIds = Array.from(menuIndex.itemMap.values())
    .filter((item) => item.pageType === "editor")
    .map((item) => item.id);
  const visibleEditorSubItemIds = Array.from(menuIndex.subItemMap.values())
    .filter((item) => item.pageType === "editor")
    .map((item) => item.id);
  const visibleBoardItemIds = Array.from(menuIndex.itemMap.values())
    .filter((item) => item.pageType === "board")
    .map((item) => item.id);
  const visibleBoardSubItemIds = Array.from(menuIndex.subItemMap.values())
    .filter((item) => item.pageType === "board")
    .map((item) => item.id);
  const keywordLike = contains(keyword);

  const [
    youtubeRows,
    noticeRows,
    testimonyRows,
    pastorBookRows,
    galleryRows,
    pageBlockRows,
    dynamicBoardRows,
    freeBoardRows,
    historyRows,
    staffCategoryRows,
    staffRows,
    facilityRows,
    courseRows,
    missionaryRows,
    missionReportRows,
    schoolDepartmentRows,
    schoolPostRows,
    heroRows,
    quickMenuRows,
    affiliateRows,
  ] = await Promise.all([
    db
      .select({
        id: youtubeVideos.id,
        title: youtubeVideos.title,
        preacher: youtubeVideos.preacher,
        scripture: youtubeVideos.scripture,
        sermonDate: youtubeVideos.sermonDate,
        description: youtubeVideos.description,
        isVisible: youtubeVideos.isVisible,
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
            like(youtubeVideos.title, keywordLike),
            like(youtubeVideos.preacher, keywordLike),
            like(youtubeVideos.scripture, keywordLike),
            like(youtubeVideos.description, keywordLike),
            like(youtubePlaylists.title, keywordLike),
          ),
        ),
      )
      .orderBy(desc(youtubeVideos.sermonDate), desc(youtubeVideos.createdAt))
      .limit(24),

    db
      .select({
        id: notices.id,
        title: notices.title,
        category: notices.category,
        content: notices.content,
        attachmentName: notices.attachmentName,
        createdAt: notices.createdAt,
        isPublished: notices.isPublished,
        isSecret: notices.isSecret,
      })
      .from(notices)
      .where(
        and(
          eq(notices.isPublished, true),
          or(
            like(notices.title, keywordLike),
            like(notices.category, keywordLike),
            like(notices.content, keywordLike),
            like(notices.attachmentName, keywordLike),
          ),
        ),
      )
      .orderBy(desc(notices.createdAt))
      .limit(40),

    db
      .select({
        id: testimonyPosts.id,
        title: testimonyPosts.title,
        content: testimonyPosts.content,
        createdAt: testimonyPosts.createdAt,
        status: testimonyPosts.status,
        isSecret: testimonyPosts.isSecret,
      })
      .from(testimonyPosts)
      .where(
        and(
          eq(testimonyPosts.status, "published"),
          or(like(testimonyPosts.title, keywordLike), like(testimonyPosts.content, keywordLike)),
        ),
      )
      .orderBy(desc(testimonyPosts.createdAt), desc(testimonyPosts.id))
      .limit(24),

    db
      .select({
        id: pastorBooks.id,
        title: pastorBooks.title,
        summary: pastorBooks.summary,
        contentHtml: pastorBooks.contentHtml,
        publishedAt: pastorBooks.publishedAt,
        externalUrl: pastorBooks.externalUrl,
        isVisible: pastorBooks.isVisible,
        sortOrder: pastorBooks.sortOrder,
      })
      .from(pastorBooks)
      .where(
        and(
          eq(pastorBooks.isVisible, true),
          or(
            like(pastorBooks.title, keywordLike),
            like(pastorBooks.summary, keywordLike),
            like(pastorBooks.contentHtml, keywordLike),
          ),
        ),
      )
      .orderBy(desc(pastorBooks.publishedAt), desc(pastorBooks.id))
      .limit(24),

    db
      .select({
        id: galleryItems.id,
        albumKey: galleryItems.albumKey,
        albumTitle: galleryItems.albumTitle,
        albumDescription: galleryItems.albumDescription,
        caption: galleryItems.caption,
        createdAt: galleryItems.createdAt,
        isVisible: galleryItems.isVisible,
        albumSortOrder: galleryItems.albumSortOrder,
      })
      .from(galleryItems)
      .where(
        and(
          eq(galleryItems.isVisible, true),
          or(
            like(galleryItems.albumTitle, keywordLike),
            like(galleryItems.albumDescription, keywordLike),
            like(galleryItems.caption, keywordLike),
          ),
        ),
      )
      .orderBy(desc(galleryItems.albumSortOrder), desc(galleryItems.createdAt))
      .limit(40),

    visibleEditorItemIds.length === 0 && visibleEditorSubItemIds.length === 0
      ? Promise.resolve([])
      : db
        .select({
          id: pageBlocks.id,
          menuItemId: pageBlocks.menuItemId,
          menuSubItemId: pageBlocks.menuSubItemId,
          blockType: pageBlocks.blockType,
          content: pageBlocks.content,
          createdAt: pageBlocks.createdAt,
          isVisible: pageBlocks.isVisible,
        })
        .from(pageBlocks)
        .where(
          and(
            eq(pageBlocks.isVisible, true),
            like(pageBlocks.content, keywordLike),
            or(
              visibleEditorItemIds.length > 0 ? inArray(pageBlocks.menuItemId, visibleEditorItemIds) : undefined,
              visibleEditorSubItemIds.length > 0 ? inArray(pageBlocks.menuSubItemId, visibleEditorSubItemIds) : undefined,
            )!,
          ),
        )
        .orderBy(desc(pageBlocks.createdAt))
        .limit(40),

    visibleBoardItemIds.length === 0 && visibleBoardSubItemIds.length === 0
      ? Promise.resolve([])
      : db
        .select({
          id: dynamicBoardPosts.id,
          boardId: dynamicBoardPosts.boardId,
          boardTitle: dynamicBoards.title,
          menuItemId: dynamicBoards.menuItemId,
          menuSubItemId: dynamicBoards.menuSubItemId,
          title: dynamicBoardPosts.title,
          content: dynamicBoardPosts.content,
          createdAt: dynamicBoardPosts.createdAt,
          isPublished: dynamicBoardPosts.isPublished,
          isSecret: dynamicBoardPosts.isSecret,
        })
        .from(dynamicBoardPosts)
        .innerJoin(dynamicBoards, eq(dynamicBoardPosts.boardId, dynamicBoards.id))
        .where(
          and(
            eq(dynamicBoardPosts.isPublished, true),
            or(like(dynamicBoardPosts.title, keywordLike), like(dynamicBoardPosts.content, keywordLike)),
            or(
              visibleBoardItemIds.length > 0 ? inArray(dynamicBoards.menuItemId, visibleBoardItemIds) : undefined,
              visibleBoardSubItemIds.length > 0 ? inArray(dynamicBoards.menuSubItemId, visibleBoardSubItemIds) : undefined,
            )!,
          ),
        )
        .orderBy(desc(dynamicBoardPosts.createdAt), desc(dynamicBoardPosts.id))
        .limit(40),

    menuIndex.freeBoardHref
      ? db
        .select({
          id: freeBoardPosts.id,
          title: freeBoardPosts.title,
          content: freeBoardPosts.content,
          createdAt: freeBoardPosts.createdAt,
          status: freeBoardPosts.status,
          isSecret: freeBoardPosts.isSecret,
        })
        .from(freeBoardPosts)
        .where(
          and(
            eq(freeBoardPosts.status, "published"),
            or(like(freeBoardPosts.title, keywordLike), like(freeBoardPosts.content, keywordLike)),
          ),
        )
        .orderBy(desc(freeBoardPosts.createdAt), desc(freeBoardPosts.id))
        .limit(24)
      : Promise.resolve([]),

    db
      .select({
        id: historyItems.id,
        decadeTitle: historyDecades.title,
        year: historyItems.year,
        month: historyItems.month,
        content: historyItems.content,
        isVisible: historyItems.isVisible,
        decadeIsVisible: historyDecades.isVisible,
      })
      .from(historyItems)
      .innerJoin(historyDecades, eq(historyItems.decadeId, historyDecades.id))
      .where(
        and(
          eq(historyItems.isVisible, true),
          eq(historyDecades.isVisible, true),
          or(like(historyItems.content, keywordLike), like(historyDecades.title, keywordLike)),
        ),
      )
      .orderBy(desc(historyItems.year), desc(historyItems.month), desc(historyItems.id))
      .limit(24),

    db
      .select({
        categoryKey: churchStaffCategories.categoryKey,
        label: churchStaffCategories.label,
        isVisible: churchStaffCategories.isVisible,
      })
      .from(churchStaffCategories),

    db
      .select({
        id: churchStaff.id,
        category: churchStaff.category,
        name: churchStaff.name,
        title: churchStaff.title,
        department: churchStaff.department,
        email: churchStaff.email,
        phone: churchStaff.phone,
        description: churchStaff.description,
        profile: churchStaff.profile,
        isVisible: churchStaff.isVisible,
      })
      .from(churchStaff)
      .where(
        and(
          eq(churchStaff.isVisible, true),
          or(
            like(churchStaff.name, keywordLike),
            like(churchStaff.title, keywordLike),
            like(churchStaff.department, keywordLike),
            like(churchStaff.description, keywordLike),
            like(churchStaff.profile, keywordLike),
          ),
        ),
      )
      .orderBy(churchStaff.sortOrder, churchStaff.id)
      .limit(40),

    db
      .select({
        id: facilities.id,
        name: facilities.name,
        description: facilities.description,
        location: facilities.location,
        building: facilities.building,
        notice: facilities.notice,
        caution: facilities.caution,
        isVisible: facilities.isVisible,
      })
      .from(facilities)
      .where(
        and(
          eq(facilities.isVisible, true),
          or(
            like(facilities.name, keywordLike),
            like(facilities.description, keywordLike),
            like(facilities.location, keywordLike),
            like(facilities.notice, keywordLike),
            like(facilities.caution, keywordLike),
          ),
        ),
      )
      .orderBy(facilities.sortOrder, facilities.id)
      .limit(24),

    db
      .select({
        id: courses.id,
        title: courses.title,
        summary: courses.summary,
        description: courses.description,
        instructor: courses.instructor,
        location: courses.location,
        target: courses.target,
        fee: courses.fee,
        startDate: courses.startDate,
        applyEndDate: courses.applyEndDate,
        status: courses.status,
        isVisible: courses.isVisible,
        audience: courses.audience,
        pageHref: courses.pageHref,
      })
      .from(courses)
      .where(
        and(
          eq(courses.isVisible, true),
          eq(courses.audience, "all"),
          or(eq(courses.status, "open"), eq(courses.status, "closed")),
          or(
            like(courses.title, keywordLike),
            like(courses.summary, keywordLike),
            like(courses.description, keywordLike),
            like(courses.instructor, keywordLike),
            like(courses.location, keywordLike),
            like(courses.target, keywordLike),
            like(courses.fee, keywordLike),
          ),
        ),
      )
      .orderBy(desc(courses.startDate), desc(courses.createdAt))
      .limit(24),

    db
      .select({
        id: missionaries.id,
        name: missionaries.name,
        region: missionaries.region,
        organization: missionaries.organization,
        description: missionaries.description,
        sentYear: missionaries.sentYear,
        isActive: missionaries.isActive,
      })
      .from(missionaries)
      .where(
        and(
          eq(missionaries.isActive, true),
          or(
            like(missionaries.name, keywordLike),
            like(missionaries.region, keywordLike),
            like(missionaries.organization, keywordLike),
            like(missionaries.description, keywordLike),
          ),
        ),
      )
      .orderBy(missionaries.sortOrder, missionaries.id)
      .limit(24),

    db
      .select({
        id: missionReports.id,
        missionaryId: missionReports.missionaryId,
        missionaryName: missionaries.name,
        missionaryRegion: missionaries.region,
        title: missionReports.title,
        summary: missionReports.summary,
        content: missionReports.content,
        reportDate: missionReports.reportDate,
        status: missionReports.status,
      })
      .from(missionReports)
      .innerJoin(missionaries, eq(missionReports.missionaryId, missionaries.id))
      .where(
        and(
          eq(missionReports.status, "published"),
          eq(missionaries.isActive, true),
          or(
            like(missionReports.title, keywordLike),
            like(missionReports.summary, keywordLike),
            like(missionReports.content, keywordLike),
            like(missionaries.name, keywordLike),
            like(missionaries.region, keywordLike),
          ),
        ),
      )
      .orderBy(desc(missionReports.reportDate), desc(missionReports.id))
      .limit(24),

    db
      .select({
        id: schoolDepartments.id,
        name: schoolDepartments.name,
        category: schoolDepartments.category,
        ageRange: schoolDepartments.ageRange,
        worshipTime: schoolDepartments.worshipTime,
        worshipPlace: schoolDepartments.worshipPlace,
        description: schoolDepartments.description,
        educationGoals: schoolDepartments.educationGoals,
        prayerTopics: schoolDepartments.prayerTopics,
        staffInfo: schoolDepartments.staffInfo,
        isVisible: schoolDepartments.isVisible,
      })
      .from(schoolDepartments)
      .where(
        and(
          eq(schoolDepartments.isVisible, true),
          or(
            like(schoolDepartments.name, keywordLike),
            like(schoolDepartments.ageRange, keywordLike),
            like(schoolDepartments.worshipTime, keywordLike),
            like(schoolDepartments.worshipPlace, keywordLike),
            like(schoolDepartments.description, keywordLike),
            like(schoolDepartments.educationGoals, keywordLike),
            like(schoolDepartments.prayerTopics, keywordLike),
            like(schoolDepartments.staffInfo, keywordLike),
          ),
        ),
      )
      .orderBy(schoolDepartments.sortOrder, schoolDepartments.id)
      .limit(24),

    db
      .select({
        id: schoolPosts.id,
        departmentId: schoolPosts.departmentId,
        departmentName: schoolDepartments.name,
        title: schoolPosts.title,
        content: schoolPosts.content,
        authorName: schoolPosts.authorName,
        createdAt: schoolPosts.createdAt,
        isVisible: schoolPosts.isVisible,
        departmentIsVisible: schoolDepartments.isVisible,
      })
      .from(schoolPosts)
      .innerJoin(schoolDepartments, eq(schoolPosts.departmentId, schoolDepartments.id))
      .where(
        and(
          eq(schoolPosts.isVisible, true),
          eq(schoolDepartments.isVisible, true),
          or(
            like(schoolPosts.title, keywordLike),
            like(schoolPosts.content, keywordLike),
            like(schoolDepartments.name, keywordLike),
          ),
        ),
      )
      .orderBy(desc(schoolPosts.createdAt), desc(schoolPosts.id))
      .limit(24),

    db
      .select({
        id: heroSlides.id,
        yearLabel: heroSlides.yearLabel,
        mainTitle: heroSlides.mainTitle,
        subTitle: heroSlides.subTitle,
        bibleRef: heroSlides.bibleRef,
        btn1Text: heroSlides.btn1Text,
        btn1Href: heroSlides.btn1Href,
        btn2Text: heroSlides.btn2Text,
        btn2Href: heroSlides.btn2Href,
        buttonsJson: heroSlides.buttonsJson,
        isVisible: heroSlides.isVisible,
      })
      .from(heroSlides)
      .where(
        and(
          eq(heroSlides.isVisible, true),
          or(
            like(heroSlides.yearLabel, keywordLike),
            like(heroSlides.mainTitle, keywordLike),
            like(heroSlides.subTitle, keywordLike),
            like(heroSlides.bibleRef, keywordLike),
            like(heroSlides.btn1Text, keywordLike),
            like(heroSlides.btn2Text, keywordLike),
            like(heroSlides.buttonsJson, keywordLike),
          ),
        ),
      )
      .orderBy(heroSlides.sortOrder, heroSlides.id)
      .limit(24),

    db
      .select({
        id: quickMenus.id,
        label: quickMenus.label,
        href: quickMenus.href,
        isVisible: quickMenus.isVisible,
      })
      .from(quickMenus)
      .where(
        and(
          eq(quickMenus.isVisible, true),
          or(like(quickMenus.label, keywordLike), like(quickMenus.href, keywordLike)),
        ),
      )
      .orderBy(quickMenus.sortOrder, quickMenus.id)
      .limit(24),

    db
      .select({
        id: affiliates.id,
        label: affiliates.label,
        href: affiliates.href,
        isVisible: affiliates.isVisible,
      })
      .from(affiliates)
      .where(
        and(
          eq(affiliates.isVisible, true),
          or(like(affiliates.label, keywordLike), like(affiliates.href, keywordLike)),
        ),
      )
      .orderBy(affiliates.sortOrder, affiliates.id)
      .limit(24),
  ]);

  return {
    guestMenus: guestMenus as GuestVisibleMenuNode[],
    youtubeVideos: youtubeRows,
    notices: noticeRows,
    testimonyPosts: testimonyRows,
    pastorBooks: pastorBookRows,
    galleryItems: galleryRows,
    pageBlocks: pageBlockRows,
    dynamicBoardPosts: dynamicBoardRows,
    freeBoardPosts: freeBoardRows,
    historyItems: historyRows,
    staffCategories: staffCategoryRows,
    staffMembers: staffRows,
    facilities: facilityRows,
    courses: courseRows,
    missionaries: missionaryRows,
    missionReports: missionReportRows,
    schoolDepartments: schoolDepartmentRows,
    schoolPosts: schoolPostRows,
    heroSlides: heroRows,
    quickMenus: quickMenuRows,
    affiliates: affiliateRows,
  };
}

export const searchRouter = router({
  global: publicProcedure.input(searchInput).query(async ({ input }) => {
    const dataset = await loadSearchDataset(input.q);
    if (!dataset) return emptyGroupedSearchResult(input.q);
    return buildGroupedSearchResult(dataset, input.q);
  }),
});
