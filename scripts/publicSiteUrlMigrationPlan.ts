export const LEGACY_PUBLIC_SITE_ORIGINS = [
  "https://www.newjoych.co.kr",
  "https://newjoych.co.kr",
  "http://www.newjoych.co.kr",
  "http://newjoych.co.kr",
  "//www.newjoych.co.kr",
  "//newjoych.co.kr",
  "https://m.joych.org",
  "https://joych.org",
  "http://m.joych.org",
  "http://joych.org",
  "//m.joych.org",
  "//joych.org",
  "http://www.joych.org",
  "//www.joych.org",
] as const;

export const PRIMARY_PUBLIC_SITE_ORIGIN = "https://www.joych.org";

export type PublicSiteUrlMigrationTarget = Readonly<{
  table: string;
  columns: readonly string[];
}>;

/**
 * Only fields that can be rendered as a public link, asset, CMS body, or public
 * description are included. Identifiers are static (not user input) so the CLI
 * can quote them safely when it builds SQL statements.
 */
export const PUBLIC_SITE_URL_MIGRATION_TARGETS: readonly PublicSiteUrlMigrationTarget[] = [
  { table: "menus", columns: ["href"] },
  { table: "menu_items", columns: ["href", "pageImageUrl"] },
  { table: "menu_sub_items", columns: ["href", "pageImageUrl"] },
  { table: "quick_menus", columns: ["href"] },
  {
    table: "hero_slides",
    columns: ["videoUrl", "posterUrl", "btn1Href", "btn2Href", "buttonsJson"],
  },
  { table: "notices", columns: ["content", "thumbnailUrl", "attachmentUrl"] },
  {
    table: "dynamic_board_posts",
    columns: ["content", "thumbnail_url", "attachment_url"],
  },
  { table: "free_board_posts", columns: ["content"] },
  { table: "notice_popups", columns: ["content", "image_url", "link_href"] },
  { table: "history_items", columns: ["content"] },
  {
    table: "gallery_items",
    columns: ["imageUrl", "albumDescription", "caption"],
  },
  { table: "affiliates", columns: ["href"] },
  { table: "sermons", columns: ["youtubeId"] },
  { table: "site_settings", columns: ["settingValue"] },
  {
    table: "church_staff",
    columns: ["description", "profile", "image_url"],
  },
  { table: "subtitle_requests", columns: ["attachment_url"] },
  { table: "bulletins", columns: ["file_url"] },
  { table: "bulletin_images", columns: ["file_url"] },
  { table: "bulletin_ad_requests", columns: ["attachment_url"] },
  {
    table: "facilities",
    columns: ["description", "contactText", "notice", "externalNotice", "caution"],
  },
  { table: "facility_images", columns: ["imageUrl"] },
  { table: "vehicles", columns: ["description", "notice", "caution"] },
  { table: "vehicle_images", columns: ["image_url"] },
  {
    table: "courses",
    columns: [
      "summary",
      "imageUrl",
      "description",
      "pageHref",
      "applicationFields",
      "applicationNotice",
    ],
  },
  { table: "course_room_managers", columns: ["pageHref"] },
  {
    table: "pastor_books",
    columns: ["summary", "content_html", "external_url"],
  },
  { table: "pastor_book_images", columns: ["image_url"] },
  { table: "missionaries", columns: ["profileImage", "description"] },
  {
    table: "mission_reports",
    columns: ["summary", "content", "thumbnailUrl"],
  },
  { table: "mission_report_images", columns: ["imageUrl"] },
  { table: "mission_report_files", columns: ["fileUrl"] },
  { table: "mission_report_prayer_topics", columns: ["content"] },
  { table: "testimony_posts", columns: ["content", "thumbnail_url"] },
  { table: "testimony_post_images", columns: ["image_url"] },
  { table: "testimony_comments", columns: ["content"] },
  {
    table: "school_departments",
    columns: [
      "description",
      "educationGoals",
      "prayerTopics",
      "staffInfo",
      "imageUrl",
    ],
  },
  { table: "school_posts", columns: ["content"] },
  { table: "school_post_files", columns: ["fileUrl"] },
  { table: "page_blocks", columns: ["content"] },
  { table: "youtube_playlists", columns: ["description"] },
  {
    table: "youtube_videos",
    columns: ["videoUrl", "thumbnailUrl", "description"],
  },
] as const;

/**
 * Deliberately not migrated:
 * - push_subscriptions.endpoint: Web Push endpoints are origin/provider data.
 * - member_social_accounts.profile_image_url: third-party identity profile data.
 * - member/admin/session data and environment OAuth callback URLs.
 * - reservation/request bodies, admin memos, and other private free-form text.
 * - fileKey columns: storage object keys are not public URLs.
 *
 * sermon.joych.org and admin.joych.org are also unaffected because the matcher
 * below accepts only known public-site host aliases.
 */
export const INTENTIONALLY_EXCLUDED_PUBLIC_URL_FIELDS = [
  "push_subscriptions.endpoint",
  "member_social_accounts.profile_image_url",
  "facility_images.fileKey",
  "vehicle_images.file_key",
  "pastor_book_images.file_key",
] as const;

const LEGACY_ORIGIN_PATTERN =
  /(?:(?:https?:)?\/\/(?:www\.)?newjoych\.co\.kr|(?:https?:)?\/\/(?:m\.)?joych\.org|http:\/\/www\.joych\.org|(?<!:)\/\/www\.joych\.org)/gi;
const URL_BOUNDARY_PATTERN = /[/?#:\s"'`<>()\[\]{},;!&=]/;

function hasUrlBoundary(value: string, originEndIndex: number) {
  if (originEndIndex >= value.length) return true;

  const next = value[originEndIndex];
  if (URL_BOUNDARY_PATTERN.test(next)) return true;

  // A sentence-ending period is a boundary, while `.example.com` is not.
  if (next === ".") {
    const afterPeriod = value[originEndIndex + 1];
    return afterPeriod === undefined || URL_BOUNDARY_PATTERN.test(afterPeriod);
  }

  return false;
}

export type LegacyOriginReplacement = Readonly<{
  value: string;
  replacements: number;
}>;

/**
 * Replaces known legacy public origins (including HTTP, protocol-relative, and
 * case variants) at a valid URL boundary. Paths, queries, fragments, HTML, and
 * JSON formatting are preserved.
 */
export function replaceLegacyPublicSiteOrigins(value: string): LegacyOriginReplacement {
  let cursor = 0;
  let replacements = 0;
  let migrated = "";

  for (const match of value.matchAll(LEGACY_ORIGIN_PATTERN)) {
    const index = match.index;
    if (index === undefined) continue;

    const endIndex = index + match[0].length;
    if (!hasUrlBoundary(value, endIndex)) continue;

    migrated += value.slice(cursor, index);
    migrated += PRIMARY_PUBLIC_SITE_ORIGIN;
    cursor = endIndex;
    replacements += 1;
  }

  if (replacements === 0) {
    return { value, replacements: 0 };
  }

  migrated += value.slice(cursor);
  return { value: migrated, replacements };
}
