import {
  boolean,
  index,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const adminContentPermissions = mysqlTable("admin_content_permissions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id"),
  permissionKey: varchar("permission_key", { length: 128 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  uniqueIndex("admin_content_permissions_user_key_unique").on(table.userId, table.permissionKey),
  index("admin_content_permissions_user_id_idx").on(table.userId),
  index("admin_content_permissions_permission_key_idx").on(table.permissionKey),
]);

export type AdminContentPermission = typeof adminContentPermissions.$inferSelect;
export type InsertAdminContentPermission = typeof adminContentPermissions.$inferInsert;

export const adminNotificationReadStates = mysqlTable("admin_notification_read_states", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  groupKey: varchar("group_key", { length: 128 }).notNull(),
  lastSeenAt: timestamp("last_seen_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  uniqueIndex("admin_notification_read_states_user_group_unique").on(table.userId, table.groupKey),
  index("admin_notification_read_states_user_id_idx").on(table.userId),
]);

export type AdminNotificationReadState = typeof adminNotificationReadStates.$inferSelect;
export type InsertAdminNotificationReadState = typeof adminNotificationReadStates.$inferInsert;

// ─────────────────────────────────────────────
// CMS: 섹션 마스터 테이블
// 메인 페이지의 모든 섹션을 관리합니다.
// 섹션 추가/삭제/순서변경/숨김 모두 이 테이블에서 처리됩니다.
// ─────────────────────────────────────────────
export const sections = mysqlTable("sections", {
  id: int("id").autoincrement().primaryKey(),
  /** 섹션 타입: 어떤 종류의 섹션인지 구분 */
  type: varchar("type", { length: 64 }).notNull(),
  /** 화면에 표시되는 순서 (숫자가 작을수록 위에 표시) */
  sortOrder: int("sortOrder").notNull().default(0),
  /** 화면에 표시 여부 (false = 숨김) */
  isVisible: boolean("isVisible").notNull().default(true),
  /** 섹션 제목 (관리자 화면에서 구분용) */
  title: varchar("title", { length: 128 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Section = typeof sections.$inferSelect;
export type InsertSection = typeof sections.$inferInsert;

// ─────────────────────────────────────────────
// CMS: 상단 네비게이션 메뉴
// ─────────────────────────────────────────────
export const menus = mysqlTable("menus", {
  id: int("id").autoincrement().primaryKey(),
  /** 메뉴 이름 (예: 교회소개) */
  label: varchar("label", { length: 64 }).notNull(),
  /** 링크 URL (없으면 null) */
  href: varchar("href", { length: 256 }),
  /** 정렬 순서 */
  sortOrder: int("sortOrder").notNull().default(0),
  /** 표시 여부 */
  isVisible: boolean("isVisible").notNull().default(true),
  allowGuest: boolean("allowGuest").notNull().default(true),
  allowMember: boolean("allowMember").notNull().default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Menu = typeof menus.$inferSelect;
export type InsertMenu = typeof menus.$inferInsert;

// ─────────────────────────────────────────────
// CMS: 메뉴 하위 항목 (드롭다운)
// ─────────────────────────────────────────────
export const menuItems = mysqlTable("menu_items", {
  id: int("id").autoincrement().primaryKey(),
  /** 상위 메뉴 ID (menus.id 참조) */
  menuId: int("menuId").notNull(),
  label: varchar("label", { length: 64 }).notNull(),
  href: varchar("href", { length: 256 }),
  sortOrder: int("sortOrder").notNull().default(0),
  isVisible: boolean("isVisible").notNull().default(true),
  allowGuest: boolean("allowGuest").notNull().default(true),
  allowMember: boolean("allowMember").notNull().default(true),
  /** 페이지 표시 타입: image(이미지 전체화면) / gallery(갤러리) / board(게시판) / youtube(유튜브 목록) / editor(텍스트+이미지) / course(강좌 목록) */
  pageType: mysqlEnum("pageType", ["image", "gallery", "board", "youtube", "editor", "course"]).default("image").notNull(),
  /** 이미지 타입일 때 표시할 이미지 URL */
  galleryScopeKey: varchar("galleryScopeKey", { length: 96 }),
  pageImageUrl: text("pageImageUrl"),
  /** youtube 타입일 때 연결된 플레이리스트 ID */
  playlistId: int("playlistId"),
  defaultViewMode: varchar("defaultViewMode", { length: 10 }).default("list"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type MenuItem = typeof menuItems.$inferSelect;
export type InsertMenuItem = typeof menuItems.$inferInsert;

// ─────────────────────────────────────────────
// CMS: 메뉴 3단 항목 (2단 하위의 세부 항목)
// ─────────────────────────────────────────────
export const menuSubItems = mysqlTable("menu_sub_items", {
  id: int("id").autoincrement().primaryKey(),
  /** 상위 2단 메뉴 ID (menu_items.id 참조) */
  menuItemId: int("menuItemId").notNull(),
  label: varchar("label", { length: 64 }).notNull(),
  href: varchar("href", { length: 256 }),
  sortOrder: int("sortOrder").notNull().default(0),
  isVisible: boolean("isVisible").notNull().default(true),
  allowGuest: boolean("allowGuest").notNull().default(true),
  allowMember: boolean("allowMember").notNull().default(true),
  /** 페이지 표시 타입 */
  pageType: mysqlEnum("pageType", ["image", "gallery", "board", "youtube", "editor", "course"]).default("image").notNull(),
  /** 이미지 타입일 때 표시할 이미지 URL */
  galleryScopeKey: varchar("galleryScopeKey", { length: 96 }),
  pageImageUrl: text("pageImageUrl"),
  /** youtube 타입일 때 연결된 플레이리스트 ID */
  playlistId: int("playlistId"),
  defaultViewMode: varchar("defaultViewMode", { length: 10 }).default("list"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type MenuSubItem = typeof menuSubItems.$inferSelect;
export type InsertMenuSubItem = typeof menuSubItems.$inferInsert;

// ─────────────────────────────────────────────
// CMS: 퀵 메뉴 (히어로 아래 아이콘 버튼들)
// ─────────────────────────────────────────────
export const quickMenus = mysqlTable("quick_menus", {
  id: int("id").autoincrement().primaryKey(),
  /** Font Awesome 아이콘 클래스 (예: fa-user-tie) */
  icon: varchar("icon", { length: 64 }).notNull(),
  label: varchar("label", { length: 64 }).notNull(),
  href: varchar("href", { length: 256 }),
  sortOrder: int("sortOrder").notNull().default(0),
  isVisible: boolean("isVisible").notNull().default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type QuickMenu = typeof quickMenus.$inferSelect;
export type InsertQuickMenu = typeof quickMenus.$inferInsert;

// ─────────────────────────────────────────────
// CMS: 히어로 섹션 콘텐츠
// 슬라이드 영상/이미지, 제목, 성경구절 등
// ─────────────────────────────────────────────
export const heroSlides = mysqlTable("hero_slides", {
  id: int("id").autoincrement().primaryKey(),
  /** 영상 URL (CDN) */
  videoUrl: text("videoUrl"),
  /** 포스터 이미지 URL (영상 로딩 전 표시) */
  posterUrl: text("posterUrl"),
  /** 연도 표어 레이블 (예: 2026 JOYFUL) */
  yearLabel: varchar("yearLabel", { length: 64 }),
  /** 메인 제목 */
  mainTitle: text("mainTitle"),
  /** 부제목 / 성경 구절 */
  subTitle: text("subTitle"),
  /** 성경 구절 출처 (예: 잠언 3장 9절) */
  bibleRef: varchar("bibleRef", { length: 128 }),
  /** 버튼1 텍스트 */
  btn1Text: varchar("btn1Text", { length: 64 }),
  /** 버튼1 링크 */
  btn1Href: varchar("btn1Href", { length: 256 }),
  /** 버튼2 텍스트 */
  btn2Text: varchar("btn2Text", { length: 64 }),
  /** 버튼2 링크 */
  btn2Href: varchar("btn2Href", { length: 256 }),
  /** 새 히어로 버튼 목록(JSON). null이면 공통 버튼 설정을 사용한다. */
  buttonsJson: text("buttonsJson"),
  sortOrder: int("sortOrder").notNull().default(0),
  isVisible: boolean("isVisible").notNull().default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type HeroSlide = typeof heroSlides.$inferSelect;
export type InsertHeroSlide = typeof heroSlides.$inferInsert;

// ─────────────────────────────────────────────
// CMS: 교회 소식 / 공지사항
// 수천 건 게시물에도 안정적으로 처리되도록
// createdAt 인덱스 기반 페이지네이션 사용
// ─────────────────────────────────────────────
export const notices = mysqlTable("notices", {
  id: int("id").autoincrement().primaryKey(),
  /** 카테고리 (공지 / 행사 / 찬양 등) */
  category: varchar("category", { length: 32 }).notNull().default("공지"),
  title: varchar("title", { length: 256 }).notNull(),
  /** 본문 내용 (긴 글 지원) */
  content: text("content"),
  /** 썸네일 이미지 URL */
  thumbnailUrl: text("thumbnailUrl"),
  attachmentName: text("attachmentName"),
  attachmentUrl: text("attachmentUrl"),
  /** 게시 여부 */
  isPublished: boolean("isPublished").notNull().default(true),
  /** 상단 고정 여부 */
  isPinned: boolean("isPinned").notNull().default(false),
  isSecret: boolean("isSecret").notNull().default(false),
  /** 작성자 (users.id 참조) */
  authorId: int("authorId"),
  /** 게시글 조회수 */
  viewCount: int("viewCount").notNull().default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Notice = typeof notices.$inferSelect;
export type InsertNotice = typeof notices.$inferInsert;

// ─────────────────────────────────────────────
// CMS: 동적 메뉴 전용 게시판
// ─────────────────────────────────────────────
export const dynamicBoards = mysqlTable("dynamic_boards", {
  id: int("id").autoincrement().primaryKey(),
  /** 2단 메뉴(menu_items.id)와 연결된 게시판. 2단/3단 중 하나만 사용합니다. */
  menuItemId: int("menu_item_id"),
  /** 3단 메뉴(menu_sub_items.id)와 연결된 게시판. 2단/3단 중 하나만 사용합니다. */
  menuSubItemId: int("menu_sub_item_id"),
  title: varchar("title", { length: 128 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  uniqueIndex("dynamic_boards_menu_item_idx").on(table.menuItemId),
  uniqueIndex("dynamic_boards_menu_sub_item_idx").on(table.menuSubItemId),
]);

export type DynamicBoard = typeof dynamicBoards.$inferSelect;
export type InsertDynamicBoard = typeof dynamicBoards.$inferInsert;

export const dynamicBoardPosts = mysqlTable("dynamic_board_posts", {
  id: int("id").autoincrement().primaryKey(),
  boardId: int("board_id").notNull(),
  title: varchar("title", { length: 256 }).notNull(),
  content: text("content"),
  thumbnailUrl: text("thumbnail_url"),
  attachmentName: text("attachment_name"),
  attachmentUrl: text("attachment_url"),
  isPublished: boolean("is_published").notNull().default(true),
  isPinned: boolean("is_pinned").notNull().default(false),
  isSecret: boolean("is_secret").notNull().default(false),
  authorId: int("author_id"),
  viewCount: int("view_count").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  index("dynamic_board_posts_board_visible_idx").on(table.boardId, table.isPublished, table.createdAt),
]);

export type DynamicBoardPost = typeof dynamicBoardPosts.$inferSelect;
export type InsertDynamicBoardPost = typeof dynamicBoardPosts.$inferInsert;

// Free board: member-authored community posts
export const freeBoardPosts = mysqlTable("free_board_posts", {
  id: int("id").autoincrement().primaryKey(),
  authorMemberId: int("author_member_id").notNull(),
  title: varchar("title", { length: 256 }).notNull(),
  content: text("content").notNull(),
  status: mysqlEnum("status", ["published", "hidden", "deleted"]).notNull().default("published"),
  isSecret: boolean("is_secret").notNull().default(false),
  /** 게시글 조회수 */
  viewCount: int("view_count").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  index("free_board_posts_status_created_idx").on(table.status, table.createdAt),
  index("free_board_posts_author_idx").on(table.authorMemberId),
]);

export type FreeBoardPost = typeof freeBoardPosts.$inferSelect;
export type InsertFreeBoardPost = typeof freeBoardPosts.$inferInsert;

// ─────────────────────────────────────────────
// CMS: 홈페이지 팝업 / 공지 배너
// 납품 전 긴급공지, 행사 안내, 신청 유도 등을 운영하기 위한 테이블
// ─────────────────────────────────────────────
export const noticePopups = mysqlTable("notice_popups", {
  id: int("id").autoincrement().primaryKey(),
  /** 팝업 제목 */
  title: varchar("title", { length: 160 }).notNull(),
  /** 본문 안내 문구 */
  content: text("content"),
  /** 대표 이미지 URL */
  imageUrl: text("image_url"),
  /** 버튼 문구 */
  linkLabel: varchar("link_label", { length: 64 }),
  /** 버튼 이동 링크 */
  linkHref: varchar("link_href", { length: 512 }),
  /** 노출 방식: PC 모달 / 상단 배너 / 모바일 하단 시트 */
  placement: mysqlEnum("placement", ["modal", "top_banner", "bottom_sheet"]).notNull().default("modal"),
  /** 대상: 전체 / 비로그인 방문자 / 로그인 성도 */
  audience: mysqlEnum("audience", ["all", "guest", "member"]).notNull().default("all"),
  /** 노출 여부 */
  isActive: boolean("is_active").notNull().default(true),
  /** 오늘 하루 보지 않기 사용 여부 */
  isDismissible: boolean("is_dismissible").notNull().default(true),
  /** 다시 보지 않기 유지 시간 */
  dismissPeriodHours: int("dismiss_period_hours").notNull().default(24),
  /** 우선순위: 숫자가 클수록 먼저 노출 */
  priority: int("priority").notNull().default(0),
  /** Popup display size. 100 keeps the previous default size. */
  sizePercent: int("size_percent").notNull().default(100),
  /** 노출 시작 시각 */
  startAt: timestamp("start_at"),
  /** 노출 종료 시각 */
  endAt: timestamp("end_at"),
  /** 작성자 (users.id 참조) */
  authorId: int("author_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  index("notice_popups_active_schedule_idx").on(table.isActive, table.startAt, table.endAt),
  index("notice_popups_priority_idx").on(table.priority, table.createdAt),
]);

export type NoticePopup = typeof noticePopups.$inferSelect;
export type InsertNoticePopup = typeof noticePopups.$inferInsert;

// ─────────────────────────────────────────────
// CMS: 갤러리 사진
// ─────────────────────────────────────────────
export const historyDecades = mysqlTable("history_decades", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 64 }).notNull(),
  startYear: int("start_year").notNull(),
  endYear: int("end_year").notNull(),
  sortOrder: int("sort_order").notNull().default(0),
  isVisible: boolean("is_visible").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  index("history_decades_visible_sort_idx").on(table.isVisible, table.sortOrder, table.startYear),
]);
export type HistoryDecade = typeof historyDecades.$inferSelect;
export type InsertHistoryDecade = typeof historyDecades.$inferInsert;

export const historyItems = mysqlTable("history_items", {
  id: int("id").autoincrement().primaryKey(),
  decadeId: int("decade_id").notNull(),
  year: int("year").notNull(),
  month: int("month").notNull(),
  content: text("content").notNull(),
  sortOrder: int("sort_order").notNull().default(0),
  isVisible: boolean("is_visible").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  index("history_items_decade_visible_sort_idx").on(table.decadeId, table.isVisible, table.sortOrder, table.year, table.month),
]);
export type HistoryItem = typeof historyItems.$inferSelect;
export type InsertHistoryItem = typeof historyItems.$inferInsert;

export const galleryItems = mysqlTable("gallery_items", {
  id: int("id").autoincrement().primaryKey(),
  /** S3 CDN 이미지 URL */
  imageUrl: text("imageUrl").notNull(),
  galleryScopeKey: varchar("galleryScopeKey", { length: 96 }),
  albumKey: varchar("albumKey", { length: 96 }),
  albumTitle: varchar("albumTitle", { length: 160 }),
  albumDescription: text("albumDescription"),
  albumSortOrder: int("albumSortOrder").notNull().default(0),
  /** 사진 설명 (alt 텍스트) */
  caption: text("caption"),
  /** 그리드 크기 (예: col-span-2 row-span-2) */
  gridSpan: varchar("gridSpan", { length: 64 }).default("col-span-1 row-span-1"),
  sortOrder: int("sortOrder").notNull().default(0),
  isVisible: boolean("isVisible").notNull().default(true),
  isHomeGallery: boolean("isHomeGallery").notNull().default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  index("gallery_items_album_key_idx").on(table.albumKey),
  index("gallery_items_album_sort_order_idx").on(table.albumSortOrder),
  index("gallery_items_home_gallery_idx").on(table.isHomeGallery, table.isVisible),
  index("gallery_items_scope_visible_idx").on(table.galleryScopeKey, table.isVisible, table.albumSortOrder),
]);

export type GalleryItem = typeof galleryItems.$inferSelect;
export type InsertGalleryItem = typeof galleryItems.$inferInsert;

// ─────────────────────────────────────────────
// CMS: 관련 기관
// ─────────────────────────────────────────────
export const affiliates = mysqlTable("affiliates", {
  id: int("id").autoincrement().primaryKey(),
  /** Font Awesome 아이콘 클래스 */
  icon: varchar("icon", { length: 64 }).notNull(),
  label: varchar("label", { length: 64 }).notNull(),
  href: varchar("href", { length: 256 }),
  sortOrder: int("sortOrder").notNull().default(0),
  isVisible: boolean("isVisible").notNull().default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Affiliate = typeof affiliates.$inferSelect;
export type InsertAffiliate = typeof affiliates.$inferInsert;

// ─────────────────────────────────────────────
// CMS: 설교 목록 (조이풀TV)
// ─────────────────────────────────────────────
export const sermons = mysqlTable("sermons", {
  id: int("id").autoincrement().primaryKey(),
  /** 예배 종류 (주일예배 / 수요예배 / 새벽기도 등) */
  category: varchar("category", { length: 32 }).notNull(),
  title: varchar("title", { length: 256 }).notNull(),
  /** 유튜브 영상 ID 또는 URL */
  youtubeId: varchar("youtubeId", { length: 64 }),
  isPublished: boolean("isPublished").notNull().default(true),
  /** 설교 날짜 */
  preachedAt: timestamp("preachedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Sermon = typeof sermons.$inferSelect;
export type InsertSermon = typeof sermons.$inferInsert;

// ─────────────────────────────────────────────
// CMS: 교회 기본 정보 (단일 행 설정 테이블)
// key-value 구조로 어떤 정보든 저장 가능
// ─────────────────────────────────────────────
export const siteSettings = mysqlTable("site_settings", {
  id: int("id").autoincrement().primaryKey(),
  /** 설정 키 (예: church_name, pastor_name, address) */
  settingKey: varchar("settingKey", { length: 128 }).notNull().unique(),
  /** 설정 값 */
  settingValue: text("settingValue"),
  /** 설명 (관리자 화면 표시용) */
  description: varchar("description", { length: 256 }),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SiteSetting = typeof siteSettings.$inferSelect;
export type InsertSiteSetting = typeof siteSettings.$inferInsert;

// ─────────────────────────────────────────────
// CMS: 섬기는 분 / 교역자 소개
// 담임목사, 부교역자, 교회학교 교역자 등을 관리자에서 등록해 공개합니다.
// ─────────────────────────────────────────────
export const churchStaff = mysqlTable("church_staff", {
  id: int("id").autoincrement().primaryKey(),
  /** 분류: 담임목사 / 부교역자 / 교회학교 교역자 / 협력사역자 / 장로 / 교회직원 / 사회복지법인 기쁨의복지재단 */
  category: varchar("category", { length: 64 }).notNull().default("associate"),
  /** 이름 */
  name: varchar("name", { length: 64 }).notNull(),
  /** 직책/직분 (예: 부목사, 전도사) */
  title: varchar("title", { length: 64 }).notNull(),
  /** 담당 사역/부서 */
  department: varchar("department", { length: 128 }),
  /** 이메일 */
  email: varchar("email", { length: 128 }),
  /** 전화번호 */
  phone: varchar("phone", { length: 32 }),
  /** 짧은 소개 */
  description: text("description"),
  /** 약력/학력/담당 안내. 줄바꿈 텍스트로 저장 */
  profile: text("profile"),
  /** 프로필 사진 URL */
  imageUrl: text("image_url"),
  /** 정렬 순서 */
  sortOrder: int("sort_order").notNull().default(0),
  /** 홈페이지 노출 여부 */
  isVisible: boolean("is_visible").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  index("church_staff_category_visible_sort_idx").on(table.category, table.isVisible, table.sortOrder),
]);

export type ChurchStaff = typeof churchStaff.$inferSelect;
export type InsertChurchStaff = typeof churchStaff.$inferInsert;

export const churchStaffCategories = mysqlTable("church_staff_categories", {
  id: int("id").autoincrement().primaryKey(),
  categoryKey: varchar("category_key", { length: 64 }).notNull().unique(),
  label: varchar("label", { length: 64 }).notNull(),
  sortOrder: int("sort_order").notNull().default(0),
  isBuiltIn: boolean("is_builtin").notNull().default(false),
  isVisible: boolean("is_visible").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  index("church_staff_categories_visible_sort_idx").on(table.isVisible, table.sortOrder),
]);

export type ChurchStaffCategory = typeof churchStaffCategories.$inferSelect;
export type InsertChurchStaffCategory = typeof churchStaffCategories.$inferInsert;

export const churchStaffTitleOptions = mysqlTable("church_staff_title_options", {
  id: int("id").autoincrement().primaryKey(),
  categoryKey: varchar("category_key", { length: 64 }).notNull(),
  label: varchar("label", { length: 64 }).notNull(),
  sortOrder: int("sort_order").notNull().default(0),
  isBuiltIn: boolean("is_builtin").notNull().default(false),
  isVisible: boolean("is_visible").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  index("church_staff_title_options_category_sort_idx").on(table.categoryKey, table.isVisible, table.sortOrder),
  uniqueIndex("church_staff_title_options_category_label_unique").on(table.categoryKey, table.label),
]);

export type ChurchStaffTitleOption = typeof churchStaffTitleOptions.$inferSelect;
export type InsertChurchStaffTitleOption = typeof churchStaffTitleOptions.$inferInsert;

// ─────────────────────────────────────────────
// 교적부: 교회 성도 정보
// 관리자가 등록하며, 믿음PLUS 유저ID 연동 가능
// ─────────────────────────────────────────────
/**
 * member_field_options: 관리자가 직접 만드는 선택지 목록
 * 직분/부서/구역/세례구분 등 교회마다 다른 항목을 자유롭게 관리
 */
export const memberFieldOptions = mysqlTable("member_field_options", {
  id: int("id").autoincrement().primaryKey(),
  /** 항목 유형: position(직분), department(부서), district(구역/순), baptism(세례구분) */
  fieldType: varchar("field_type", { length: 32 }).notNull(),
  /** 선택지 이름 (예: 집사, 아동부1, 1구역) */
  label: varchar("label", { length: 64 }).notNull(),
  /** 정렬 순서 */
  sortOrder: int("sort_order").notNull().default(0),
  /** 표시 여부 */
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type MemberFieldOption = typeof memberFieldOptions.$inferSelect;
export type InsertMemberFieldOption = typeof memberFieldOptions.$inferInsert;

export const churchMembers = mysqlTable("church_members", {
  id: int("id").autoincrement().primaryKey(),

  // ── 로그인 정보 (성도 직접 입력) ──────────────────────────
  /** 로그인 이메일 */
  email: varchar("email", { length: 128 }).unique(),
  /** 비밀번호 해시 */
  passwordHash: varchar("password_hash", { length: 256 }),
  /** 비밀번호 변경 때 증가 — 토큰의 버전과 다르면 기존 성도 세션을 무효화 */
  sessionVersion: int("session_version").notNull().default(0),

  // ── 기본 정보 (성도 직접 입력) ────────────────────────────
  /** 성도 이름 */
  name: varchar("name", { length: 64 }).notNull(),
  /** 연락처 */
  phone: varchar("phone", { length: 32 }),
  /** 생년월일 (YYYY-MM-DD) */
  birthDate: varchar("birth_date", { length: 16 }),
  /** 성별 (남/여) */
  gender: varchar("gender", { length: 8 }),
  /** 주소 */
  address: varchar("address", { length: 256 }),
  /** 비상연락처 */
  emergencyPhone: varchar("emergency_phone", { length: 32 }),
  /** 가입 경로 */
  joinPath: varchar("join_path", { length: 64 }),

  // ── 교회 정보 (관리자 입력) ───────────────────────────────
  /** 직분 (member_field_options.label 참조) */
  position: varchar("position", { length: 64 }),
  /** 소속 부서 (member_field_options.label 참조) */
  department: varchar("department", { length: 64 }),
  /** 구역/순 (member_field_options.label 참조) */
  district: varchar("district", { length: 64 }),
  /** 세례 구분 (member_field_options.label 참조) */
  baptismType: varchar("baptism_type", { length: 32 }),
  /** 세례일 (YYYY-MM-DD) */
  baptismDate: varchar("baptism_date", { length: 16 }),
  /** 교회 등록일 (YYYY-MM-DD) */
  registeredAt: varchar("registered_at", { length: 16 }),
  /** 담당 교역자 */
  pastor: varchar("pastor", { length: 64 }),
  /** 관리자 메모 */
  adminMemo: text("admin_memo"),
  /** Facility reservation eligibility, managed separately from login approval. */
  canReserveFacility: boolean("can_reserve_facility").notNull().default(false),

  // ── 상태 관리 ─────────────────────────────────────────────
  /** 가입 승인 상태: pending(대기) / approved(승인) / rejected(거절) / withdrawn(탈퇴) */
  status: mysqlEnum("status", ["pending", "approved", "rejected", "withdrawn"]).notNull().default("pending"),

  // ── 연동 ──────────────────────────────────────────────────
  /** 믿음PLUS 앱 유저 ID (연동용) - 문자열로 저장 (숫자/영문 혼합 가능) */
  faithPlusUserId: varchar("faith_plus_user_id", { length: 64 }),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type ChurchMember = typeof churchMembers.$inferSelect;
export type InsertChurchMember = typeof churchMembers.$inferInsert;

export const memberDistricts = mysqlTable("member_districts", {
  id: int("id").autoincrement().primaryKey(),
  /** 담당자 church_members.id */
  memberId: int("member_id").notNull(),
  /** 담당 구역/순 label */
  district: varchar("district", { length: 64 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("member_districts_member_district_unique").on(table.memberId, table.district),
  index("member_districts_member_id_idx").on(table.memberId),
  index("member_districts_district_idx").on(table.district),
]);

export type MemberDistrict = typeof memberDistricts.$inferSelect;
export type InsertMemberDistrict = typeof memberDistricts.$inferInsert;

// ─────────────────────────────────────────────
// 교적부: 구글/카카오 간편가입 계정 연결
// ─────────────────────────────────────────────
export const memberSocialAccounts = mysqlTable("member_social_accounts", {
  id: int("id").autoincrement().primaryKey(),
  /** church_members.id */
  memberId: int("member_id").notNull(),
  provider: mysqlEnum("provider", ["google", "kakao"]).notNull(),
  /** Google sub / Kakao id */
  providerUserId: varchar("provider_user_id", { length: 191 }).notNull(),
  email: varchar("email", { length: 254 }),
  displayName: varchar("display_name", { length: 128 }),
  profileImageUrl: text("profile_image_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  uniqueIndex("member_social_provider_user_unique").on(table.provider, table.providerUserId),
  uniqueIndex("member_social_member_provider_unique").on(table.memberId, table.provider),
  index("member_social_member_id_idx").on(table.memberId),
]);

export type MemberSocialAccount = typeof memberSocialAccounts.$inferSelect;
export type InsertMemberSocialAccount = typeof memberSocialAccounts.$inferInsert;

// ─────────────────────────────────────────────
// 공개 접수: 기도 요청 / 새가족 등록 문의
// ─────────────────────────────────────────────
export const prayerRequests = mysqlTable("prayer_requests", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 64 }).notNull(),
  category: varchar("category", { length: 32 }).notNull(),
  content: text("content").notNull(),
  status: mysqlEnum("status", ["new", "reviewed", "archived"]).notNull().default("new"),
  adminMemo: text("admin_memo"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  index("prayer_requests_status_created_idx").on(table.status, table.createdAt),
]);

export type PrayerRequest = typeof prayerRequests.$inferSelect;
export type InsertPrayerRequest = typeof prayerRequests.$inferInsert;

export const newMemberRequests = mysqlTable("new_member_requests", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 64 }).notNull(),
  phone: varchar("phone", { length: 32 }).notNull(),
  age: int("age"),
  address: varchar("address", { length: 256 }),
  how: varchar("how", { length: 64 }),
  status: mysqlEnum("status", ["new", "contacted", "archived"]).notNull().default("new"),
  adminMemo: text("admin_memo"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  index("new_member_requests_status_created_idx").on(table.status, table.createdAt),
]);

export type NewMemberRequest = typeof newMemberRequests.$inferSelect;
export type InsertNewMemberRequest = typeof newMemberRequests.$inferInsert;

// Public support intake: external church/institution visit requests
export const visitRequests = mysqlTable("visit_requests", {
  id: int("id").autoincrement().primaryKey(),
  organizationName: varchar("organization_name", { length: 128 }).notNull(),
  applicantName: varchar("applicant_name", { length: 64 }).notNull(),
  phone: varchar("phone", { length: 32 }).notNull(),
  region: varchar("region", { length: 128 }),
  denomination: varchar("denomination", { length: 128 }),
  email: varchar("email", { length: 320 }),
  visitDate: varchar("visit_date", { length: 10 }).notNull(),
  visitTime: varchar("visit_time", { length: 5 }),
  headcount: int("headcount").notNull().default(1),
  visitorType: mysqlEnum("visitor_type", ["church", "institution", "individual", "other"]).notNull().default("church"),
  purpose: varchar("purpose", { length: 128 }).notNull(),
  message: text("message"),
  status: mysqlEnum("status", ["new", "contacted", "scheduled", "completed", "archived"]).notNull().default("new"),
  adminMemo: text("admin_memo"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  index("visit_requests_status_created_idx").on(table.status, table.createdAt),
  index("visit_requests_date_idx").on(table.visitDate),
]);

export type VisitRequest = typeof visitRequests.$inferSelect;
export type InsertVisitRequest = typeof visitRequests.$inferInsert;

// Public support intake: subtitle/caption requests with optional attachment
export const subtitleRequests = mysqlTable("subtitle_requests", {
  id: int("id").autoincrement().primaryKey(),
  memberId: int("member_id"),
  title: varchar("title", { length: 160 }).notNull(),
  authorName: varchar("author_name", { length: 64 }).notNull(),
  phone: varchar("phone", { length: 32 }).notNull(),
  email: varchar("email", { length: 320 }),
  requestedDate: varchar("requested_date", { length: 10 }),
  content: text("content").notNull(),
  attachmentName: varchar("attachment_name", { length: 255 }),
  attachmentUrl: varchar("attachment_url", { length: 512 }),
  attachmentSize: int("attachment_size"),
  attachmentMime: varchar("attachment_mime", { length: 128 }),
  status: mysqlEnum("status", ["new", "reviewed", "completed", "archived"]).notNull().default("new"),
  adminMemo: text("admin_memo"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  index("subtitle_requests_status_created_idx").on(table.status, table.createdAt),
  index("subtitle_requests_date_idx").on(table.requestedDate),
  index("subtitle_requests_member_created_idx").on(table.memberId, table.createdAt),
]);

export type SubtitleRequest = typeof subtitleRequests.$inferSelect;
export type InsertSubtitleRequest = typeof subtitleRequests.$inferInsert;

// Worship bulletin files uploaded by admins and shown on /worship/bulletin
export const bulletins = mysqlTable("bulletins", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 160 }).notNull(),
  bulletinDate: varchar("bulletin_date", { length: 10 }).notNull(),
  fileName: varchar("file_name", { length: 255 }).notNull(),
  fileUrl: varchar("file_url", { length: 512 }).notNull(),
  fileSize: int("file_size"),
  fileMime: varchar("file_mime", { length: 128 }),
  status: mysqlEnum("status", ["published", "hidden", "archived"]).notNull().default("published"),
  authorId: int("author_id"),
  /** 주보 상세 조회수 */
  viewCount: int("view_count").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  index("bulletins_status_date_idx").on(table.status, table.bulletinDate),
  index("bulletins_created_idx").on(table.createdAt),
]);

export type Bulletin = typeof bulletins.$inferSelect;
export type InsertBulletin = typeof bulletins.$inferInsert;

// Multiple page images that belong to a single bulletin.
export const bulletinImages = mysqlTable("bulletin_images", {
  id: int("id").autoincrement().primaryKey(),
  bulletinId: int("bulletin_id").notNull(),
  fileName: varchar("file_name", { length: 255 }).notNull(),
  fileUrl: varchar("file_url", { length: 512 }).notNull(),
  fileSize: int("file_size"),
  fileMime: varchar("file_mime", { length: 128 }),
  sortOrder: int("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("bulletin_images_bulletin_order_idx").on(table.bulletinId, table.sortOrder),
  index("bulletin_images_created_idx").on(table.createdAt),
]);

export type BulletinImage = typeof bulletinImages.$inferSelect;
export type InsertBulletinImage = typeof bulletinImages.$inferInsert;

// Member-only bulletin advertisement requests
export const bulletinAdRequests = mysqlTable("bulletin_ad_requests", {
  id: int("id").autoincrement().primaryKey(),
  memberId: int("member_id").notNull(),
  title: varchar("title", { length: 160 }).notNull(),
  authorName: varchar("author_name", { length: 64 }).notNull(),
  phone: varchar("phone", { length: 32 }),
  email: varchar("email", { length: 320 }),
  requestedDate: varchar("requested_date", { length: 10 }),
  content: text("content").notNull(),
  attachmentName: varchar("attachment_name", { length: 255 }),
  attachmentUrl: varchar("attachment_url", { length: 512 }),
  attachmentSize: int("attachment_size"),
  attachmentMime: varchar("attachment_mime", { length: 128 }),
  status: mysqlEnum("status", ["new", "reviewed", "completed", "archived"]).notNull().default("new"),
  adminMemo: text("admin_memo"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  index("bulletin_ad_requests_status_created_idx").on(table.status, table.createdAt),
  index("bulletin_ad_requests_member_created_idx").on(table.memberId, table.createdAt),
  index("bulletin_ad_requests_date_idx").on(table.requestedDate),
]);

export type BulletinAdRequest = typeof bulletinAdRequests.$inferSelect;
export type InsertBulletinAdRequest = typeof bulletinAdRequests.$inferInsert;

// ─────────────────────────────────────────────
// 시설 예약 시스템
// ─────────────────────────────────────────────

/**
 * facilities: 시설 마스터 테이블
 * 교회 내 예약 가능한 시설 정보를 관리합니다.
 */
export const facilities = mysqlTable("facilities", {
  id: int("id").autoincrement().primaryKey(),
  /** 시설명 (예: 대예배실, 세미나실 A) */
  name: varchar("name", { length: 128 }).notNull(),
  /** 시설 설명 */
  description: text("description"),
  /** 위치 (예: 본관 3층) */
  location: varchar("location", { length: 128 }),
  /** 건물 분류: hayoungin(하영인관) / welfare(복지관) */
  building: varchar("building", { length: 32 }).notNull().default("welfare"),
  /** 최대 수용 인원 */
  capacity: int("capacity").notNull().default(10),
  /** 사용 요금 (0 = 무료) */
  pricePerHour: int("pricePerHour").notNull().default(0),
  /** 예약 단위 (분 단위, 기본 60 = 1시간) */
  slotMinutes: int("slotMinutes").notNull().default(60),
  /** 최소 예약 시간 (슬롯 수, 기본 1) */
  minSlots: int("minSlots").notNull().default(1),
  /** 최대 예약 시간 (슬롯 수, 기본 8 = 8시간) */
  maxSlots: int("maxSlots").notNull().default(8),
  /** 예약 승인 방식: auto(자동승인) / manual(관리자 승인) */
  approvalType: mysqlEnum("approvalType", ["auto", "manual"]).notNull().default("manual"),
  /** 예약 가능 여부 (false = 예약 중단) */
  isReservable: boolean("isReservable").notNull().default(true),
  /** 외부인 비회원 예약 공개 여부 */
  isExternalReservable: boolean("isExternalReservable").notNull().default(false),
  externalAdvanceDaysOverride: int("externalAdvanceDaysOverride"),
  contactText: text("contactText"),
  /** 노출 여부 */
  isVisible: boolean("isVisible").notNull().default(true),
  /** 이용 안내 (마크다운 지원) */
  notice: text("notice"),
  externalNotice: text("externalNotice"),
  /** 예약 시 주의사항 */
  caution: text("caution"),
  /** 정렬 순서 */
  sortOrder: int("sortOrder").notNull().default(0),
  /** 운영 시작 시간 (HH:MM 형식, 예: 09:00) */
  openTime: varchar("openTime", { length: 5 }).notNull().default("09:00"),
  /** 운영 종료 시간 (HH:MM 형식, 예: 22:00) */
  closeTime: varchar("closeTime", { length: 5 }).notNull().default("22:00"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type Facility = typeof facilities.$inferSelect;;
export type InsertFacility = typeof facilities.$inferInsert;

/**
 * facility_images: 시설 사진 테이블
 * 시설당 여러 장의 사진을 등록할 수 있습니다.
 */
export const facilityImages = mysqlTable("facility_images", {
  id: int("id").autoincrement().primaryKey(),
  /** 시설 ID (facilities.id 참조) */
  facilityId: int("facilityId").notNull(),
  /** S3 CDN 이미지 URL */
  imageUrl: text("imageUrl").notNull(),
  /** S3 파일 키 */
  fileKey: varchar("fileKey", { length: 512 }),
  /** 이미지 설명 (alt 텍스트) */
  caption: varchar("caption", { length: 128 }),
  /** 대표 사진 여부 (목록에서 썸네일로 사용) */
  isThumbnail: boolean("isThumbnail").notNull().default(false),
  /** 정렬 순서 */
  sortOrder: int("sortOrder").notNull().default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type FacilityImage = typeof facilityImages.$inferSelect;
export type InsertFacilityImage = typeof facilityImages.$inferInsert;

/**
 * facility_hours: 시설 운영 시간 테이블
 * 요일별 운영 시간을 설정합니다.
 * dayOfWeek: 0=일요일, 1=월요일, ..., 6=토요일
 */
export const facilityHours = mysqlTable("facility_hours", {
  id: int("id").autoincrement().primaryKey(),
  /** 시설 ID */
  facilityId: int("facilityId").notNull(),
  /** 요일 (0=일, 1=월, 2=화, 3=수, 4=목, 5=금, 6=토) */
  dayOfWeek: int("dayOfWeek").notNull(),
  /** 운영 여부 (false = 해당 요일 휴무) */
  isOpen: boolean("isOpen").notNull().default(true),
  /** 오픈 시간 (HH:MM 형식, 예: "09:00") */
  openTime: varchar("openTime", { length: 5 }).notNull().default("09:00"),
  /** 마감 시간 (HH:MM 형식, 예: "22:00") */
  closeTime: varchar("closeTime", { length: 5 }).notNull().default("22:00"),
  /** 점심 휴식 시작 시간 (null = 없음) */
  breakStart: varchar("breakStart", { length: 5 }),
  /** 점심 휴식 종료 시간 */
  breakEnd: varchar("breakEnd", { length: 5 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  uniqueIndex("facility_hours_facility_day_unique").on(table.facilityId, table.dayOfWeek),
]);

export type FacilityHour = typeof facilityHours.$inferSelect;
export type InsertFacilityHour = typeof facilityHours.$inferInsert;

export const externalFacilityHours = mysqlTable("external_facility_hours", {
  id: int("id").autoincrement().primaryKey(),
  facilityId: int("facilityId").notNull(),
  dayOfWeek: int("dayOfWeek").notNull(),
  isOpen: boolean("isOpen").notNull().default(true),
  openTime: varchar("openTime", { length: 5 }).notNull().default("09:00"),
  closeTime: varchar("closeTime", { length: 5 }).notNull().default("22:00"),
  breakStart: varchar("breakStart", { length: 5 }),
  breakEnd: varchar("breakEnd", { length: 5 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  uniqueIndex("external_facility_hours_facility_day_unique").on(table.facilityId, table.dayOfWeek),
]);

export type ExternalFacilityHour = typeof externalFacilityHours.$inferSelect;
export type InsertExternalFacilityHour = typeof externalFacilityHours.$inferInsert;

/**
 * facility_blocked_dates: 시설 특정 날짜 차단 테이블
 * 공휴일, 교회 행사 등 특정 날짜에 예약을 차단합니다.
 */
export const facilityBlockedDates = mysqlTable("facility_blocked_dates", {
  id: int("id").autoincrement().primaryKey(),
  /** 시설 ID (null = 전체 시설 차단) */
  facilityId: int("facilityId"),
  /** 차단 날짜 (YYYY-MM-DD 형식) */
  blockedDate: varchar("blockedDate", { length: 10 }).notNull(),
  /** 차단 사유 (예: 전교인 수련회) */
  reason: varchar("reason", { length: 128 }),
  /** 특정 시간대만 차단 여부 (false = 하루 전체 차단) */
  isPartialBlock: boolean("isPartialBlock").notNull().default(false),
  /** 부분 차단 시작 시간 */
  blockStart: varchar("blockStart", { length: 5 }),
  /** 부분 차단 종료 시간 */
  blockEnd: varchar("blockEnd", { length: 5 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type FacilityBlockedDate = typeof facilityBlockedDates.$inferSelect;
export type InsertFacilityBlockedDate = typeof facilityBlockedDates.$inferInsert;

/**
 * reservations: 예약 테이블
 * 성도의 시설 예약 신청 및 승인 상태를 관리합니다.
 */
export const reservations = mysqlTable("reservations", {
  id: int("id").autoincrement().primaryKey(),
  /** 시설 ID */
  facilityId: int("facilityId").notNull(),
  /** 예약자 성도 ID (외부인 예약은 null) */
  userId: int("userId"),
  /** 예약 구분: member(성도) / external(외부인) */
  reservationType: mysqlEnum("reservationType", ["member", "external", "course"]).notNull().default("member"),
  /** 예약자 이름 (비로그인 예약 또는 대리 예약 시) */
  reserverName: varchar("reserverName", { length: 64 }).notNull(),
  /** 예약자 연락처 */
  reserverPhone: varchar("reserverPhone", { length: 32 }),
  /** 예약 날짜 (YYYY-MM-DD) */
  reservationDate: varchar("reservationDate", { length: 10 }).notNull(),
  /** 시작 시간 (HH:MM) */
  startTime: varchar("startTime", { length: 5 }).notNull(),
  /** 종료 시간 (HH:MM) */
  endTime: varchar("endTime", { length: 5 }).notNull(),
  /** 사용 목적 */
  purpose: varchar("purpose", { length: 256 }).notNull(),
  /** 소속 부서/단체 (예: 청년부, 영아부 등) */
  department: varchar("department", { length: 128 }),
  /** 사용 인원 */
  attendees: int("attendees").notNull().default(1),
  /** 추가 요청사항 */
  notes: text("notes"),
  /** 예약 상태: pending(대기) / checking(확인중) / approved(승인) / rejected(거절) / cancelled(취소) */
  status: mysqlEnum("status", ["pending", "checking", "approved", "rejected", "cancelled"]).notNull().default("pending"),
  /** 반복 예약 묶음 ID */
  recurrenceGroupId: varchar("recurrenceGroupId", { length: 64 }),
  /** 반복 예약 설명 */
  recurrenceLabel: varchar("recurrenceLabel", { length: 160 }),
  /** 반복 예약 내 순서 */
  recurrenceSequence: int("recurrenceSequence").notNull().default(0),
  /** 승인/거절 사유 (관리자 입력) */
  adminComment: text("adminComment"),
  /** 승인/거절 처리한 관리자 ID */
  processedBy: int("processedBy"),
  /** 승인/거절 처리 시각 */
  processedAt: timestamp("processedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Reservation = typeof reservations.$inferSelect;
export type InsertReservation = typeof reservations.$inferInsert;

// ─────────────────────────────────────────────
// 차량 예약 시스템
// 시설예약과 분리해서 운영합니다. 차량은 차단일 없이 매일 같은 시간대 안에서
// 이미 예약된 시간만 막는 구조입니다.
// ─────────────────────────────────────────────

export const vehicles = mysqlTable("vehicles", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 128 }).notNull(),
  description: text("description"),
  plateNumber: varchar("plate_number", { length: 64 }),
  location: varchar("location", { length: 128 }),
  driverInfo: varchar("driver_info", { length: 128 }),
  capacity: int("capacity").notNull().default(5),
  slotMinutes: int("slot_minutes").notNull().default(60),
  minSlots: int("min_slots").notNull().default(1),
  maxSlots: int("max_slots").notNull().default(8),
  approvalType: mysqlEnum("approval_type", ["auto", "manual"]).notNull().default("manual"),
  isReservable: boolean("is_reservable").notNull().default(true),
  isVisible: boolean("is_visible").notNull().default(true),
  notice: text("notice"),
  caution: text("caution"),
  sortOrder: int("sort_order").notNull().default(0),
  openTime: varchar("open_time", { length: 5 }).notNull().default("00:00"),
  closeTime: varchar("close_time", { length: 5 }).notNull().default("24:00"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  index("vehicles_visible_sort_idx").on(table.isVisible, table.sortOrder),
]);

export type Vehicle = typeof vehicles.$inferSelect;
export type InsertVehicle = typeof vehicles.$inferInsert;

export const vehicleImages = mysqlTable("vehicle_images", {
  id: int("id").autoincrement().primaryKey(),
  vehicleId: int("vehicle_id").notNull(),
  imageUrl: text("image_url").notNull(),
  fileKey: varchar("file_key", { length: 512 }),
  caption: varchar("caption", { length: 128 }),
  isThumbnail: boolean("is_thumbnail").notNull().default(false),
  sortOrder: int("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("vehicle_images_vehicle_order_idx").on(table.vehicleId, table.isThumbnail, table.sortOrder),
]);

export type VehicleImage = typeof vehicleImages.$inferSelect;
export type InsertVehicleImage = typeof vehicleImages.$inferInsert;

export const vehicleReservations = mysqlTable("vehicle_reservations", {
  id: int("id").autoincrement().primaryKey(),
  vehicleId: int("vehicle_id").notNull(),
  userId: int("user_id").notNull(),
  reserverName: varchar("reserver_name", { length: 64 }).notNull(),
  reserverPhone: varchar("reserver_phone", { length: 32 }),
  reservationDate: varchar("reservation_date", { length: 10 }).notNull(),
  startTime: varchar("start_time", { length: 5 }).notNull(),
  endTime: varchar("end_time", { length: 5 }).notNull(),
  purpose: varchar("purpose", { length: 256 }).notNull(),
  department: varchar("department", { length: 128 }),
  passengers: int("passengers").notNull().default(1),
  notes: text("notes"),
  status: mysqlEnum("status", ["pending", "approved", "rejected", "cancelled"]).notNull().default("pending"),
  /** 반복 예약 묶음 ID */
  recurrenceGroupId: varchar("recurrence_group_id", { length: 64 }),
  /** 반복 예약 설명 */
  recurrenceLabel: varchar("recurrence_label", { length: 160 }),
  /** 반복 예약 내 순서 */
  recurrenceSequence: int("recurrence_sequence").notNull().default(0),
  adminComment: text("admin_comment"),
  processedBy: int("processed_by"),
  processedAt: timestamp("processed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  index("vehicle_reservations_vehicle_date_idx").on(table.vehicleId, table.reservationDate),
  index("vehicle_reservations_status_created_idx").on(table.status, table.createdAt),
  index("vehicle_reservations_user_created_idx").on(table.userId, table.createdAt),
  index("vehicle_reservations_recurrence_group_idx").on(table.recurrenceGroupId),
]);

export type VehicleReservation = typeof vehicleReservations.$inferSelect;
export type InsertVehicleReservation = typeof vehicleReservations.$inferInsert;

export const vehicleReservationAccessRules = mysqlTable("vehicle_reservation_access_rules", {
  id: int("id").autoincrement().primaryKey(),
  fieldType: varchar("field_type", { length: 32 }).notNull(),
  fieldValue: varchar("field_value", { length: 64 }).notNull(),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: int("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  uniqueIndex("vehicle_access_field_value_unique").on(table.fieldType, table.fieldValue),
  index("vehicle_access_active_idx").on(table.isActive, table.sortOrder),
]);

export type VehicleReservationAccessRule = typeof vehicleReservationAccessRules.$inferSelect;
export type InsertVehicleReservationAccessRule = typeof vehicleReservationAccessRules.$inferInsert;

export const pushSubscriptions = mysqlTable("push_subscriptions", {
  id: int("id").autoincrement().primaryKey(),
  memberId: int("member_id"),
  userId: int("user_id"),
  endpoint: varchar("endpoint", { length: 500 }).notNull(),
  p256dh: varchar("p256dh", { length: 255 }).notNull(),
  auth: varchar("auth", { length: 255 }).notNull(),
  userAgent: varchar("user_agent", { length: 500 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastUsedAt: timestamp("last_used_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("push_subscriptions_endpoint_unique").on(table.endpoint),
  index("push_subscriptions_member_id_idx").on(table.memberId),
  index("push_subscriptions_user_id_idx").on(table.userId),
]);

export type PushSubscription = typeof pushSubscriptions.$inferSelect;
export type InsertPushSubscription = typeof pushSubscriptions.$inferInsert;

// ─────────────────────────────────────────────
// 교육/강좌 신청 시스템
// ─────────────────────────────────────────────

/**
 * courses: 교육/강좌 마스터 테이블
 * 조이아카데미, 새가족 교육, 성경공부 등 신청 가능한 강좌를 관리합니다.
 */
export const courses = mysqlTable("courses", {
  id: int("id").autoincrement().primaryKey(),
  /** 강좌명 */
  title: varchar("title", { length: 128 }).notNull(),
  /** 목록용 한 줄 소개 */
  summary: varchar("summary", { length: 500 }),
  imageUrl: text("imageUrl"),
  /** 상세 안내 */
  description: text("description"),
  /** 강사/담당자 */
  instructor: varchar("instructor", { length: 64 }),
  /** 장소 */
  location: varchar("location", { length: 128 }),
  /** 대상 */
  target: varchar("target", { length: 128 }),
  /** 수강료/회비 안내 */
  fee: varchar("fee", { length: 128 }),
  /** 정원: 0이면 제한 없음 */
  capacity: int("capacity").notNull().default(0),
  facilityId: int("facilityId"),
  facilityReservationId: int("facilityReservationId"),
  /** 강좌 시작일 */
  startDate: varchar("startDate", { length: 10 }),
  /** 강좌 종료일 */
  endDate: varchar("endDate", { length: 10 }),
  /** 시작 시간 */
  startTime: varchar("startTime", { length: 5 }),
  /** 종료 시간 */
  endTime: varchar("endTime", { length: 5 }),
  /** 신청 시작일 */
  applyStartDate: varchar("applyStartDate", { length: 10 }),
  /** 신청 마감일 */
  applyEndDate: varchar("applyEndDate", { length: 10 }),
  /** 상태: draft(준비) / open(신청중) / closed(마감) / archived(보관) */
  status: mysqlEnum("status", ["draft", "open", "closed", "cancelled", "archived"]).notNull().default("draft"),
  /** 공개 노출 여부 */
  isVisible: boolean("isVisible").notNull().default(true),
  /** 노출 대상: all(전체) / member(성도) */
  audience: mysqlEnum("audience", ["all", "member"]).notNull().default("all"),
  /** 강좌가 표시될 메뉴 href */
  pageHref: varchar("pageHref", { length: 255 }),
  /** 강좌 신청 시 추가 입력 항목 JSON */
  applicationFields: text("applicationFields"),
  /** 신청 전 안내 문구 */
  applicationNotice: text("applicationNotice"),
  /** 정렬 순서 */
  sortOrder: int("sortOrder").notNull().default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  index("courses_status_visible_sort_idx").on(table.status, table.isVisible, table.sortOrder),
  index("courses_apply_window_idx").on(table.applyStartDate, table.applyEndDate),
  index("courses_facility_idx").on(table.facilityId),
  index("courses_facility_reservation_idx").on(table.facilityReservationId),
]);

export type Course = typeof courses.$inferSelect;
export type InsertCourse = typeof courses.$inferInsert;

/**
 * course_room_managers: 강좌방별 담당 성도 권한
 * 전체 강좌 관리 권한과 별도로, 지정된 강좌 메뉴 주소에서만 관리할 수 있습니다.
 */
export const courseRoomManagers = mysqlTable("course_room_managers", {
  id: int("id").autoincrement().primaryKey(),
  memberId: int("memberId").notNull(),
  pageHref: varchar("pageHref", { length: 255 }).notNull(),
  canManage: boolean("canManage").notNull().default(true),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  uniqueIndex("course_room_managers_member_page_unique").on(table.memberId, table.pageHref),
  index("course_room_managers_page_access_idx").on(table.pageHref, table.canManage),
]);

export type CourseRoomManager = typeof courseRoomManagers.$inferSelect;
export type InsertCourseRoomManager = typeof courseRoomManagers.$inferInsert;

/**
 * course_applications: 강좌 신청 내역
 * 승인 대기, 승인, 거절, 신청 취소 상태를 관리합니다.
 */
export const courseApplications = mysqlTable("course_applications", {
  id: int("id").autoincrement().primaryKey(),
  /** 강좌 ID */
  courseId: int("courseId").notNull(),
  /** 신청 성도 ID */
  memberId: int("memberId"),
  /** 신청자 이름 */
  applicantName: varchar("applicantName", { length: 64 }).notNull(),
  /** 신청자 연락처 */
  applicantPhone: varchar("applicantPhone", { length: 32 }),
  /** 신청자 이메일 */
  applicantEmail: varchar("applicantEmail", { length: 320 }),
  /** 신청 메모 */
  memo: text("memo"),
  /** 강좌별 추가 입력 답변 JSON */
  customAnswers: text("customAnswers"),
  /** 관리자 확인용 회비 납부 여부 */
  feePaid: boolean("feePaid").notNull().default(false),
  /** 관리자 확인용 서류 제출 여부 */
  documentsSubmitted: boolean("documentsSubmitted").notNull().default(false),
  /** 상태: pending(대기) / approved(승인) / rejected(거절) / cancelled(취소) */
  status: mysqlEnum("status", ["pending", "approved", "rejected", "cancelled"]).notNull().default("pending"),
  /** 관리자 메모 또는 거절 사유 */
  adminComment: text("adminComment"),
  /** 처리한 관리자 ID */
  processedBy: int("processedBy"),
  /** 처리 시각 */
  processedAt: timestamp("processedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  index("course_applications_course_status_idx").on(table.courseId, table.status, table.createdAt),
  index("course_applications_member_created_idx").on(table.memberId, table.createdAt),
  uniqueIndex("course_applications_course_member_unique").on(table.courseId, table.memberId),
]);

export type CourseApplication = typeof courseApplications.$inferSelect;
export type InsertCourseApplication = typeof courseApplications.$inferInsert;

// ─────────────────────────────────────────────
// 담임목사 저서
// ─────────────────────────────────────────────

export const pastorBooks = mysqlTable("pastor_books", {
  id: int("id").autoincrement().primaryKey(),
  legacyNum: varchar("legacy_num", { length: 32 }),
  title: varchar("title", { length: 255 }).notNull(),
  summary: text("summary"),
  contentHtml: text("content_html"),
  publishedAt: varchar("published_at", { length: 10 }),
  externalUrl: text("external_url"),
  isVisible: boolean("is_visible").notNull().default(true),
  sortOrder: int("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  uniqueIndex("pastor_books_legacy_num_unique").on(table.legacyNum),
  index("pastor_books_visible_sort_idx").on(table.isVisible, table.sortOrder),
  index("pastor_books_published_idx").on(table.publishedAt),
]);

export type PastorBook = typeof pastorBooks.$inferSelect;
export type InsertPastorBook = typeof pastorBooks.$inferInsert;

export const pastorBookImages = mysqlTable("pastor_book_images", {
  id: int("id").autoincrement().primaryKey(),
  bookId: int("book_id").notNull(),
  imageUrl: text("image_url").notNull(),
  fileKey: varchar("file_key", { length: 512 }),
  caption: varchar("caption", { length: 128 }),
  isThumbnail: boolean("is_thumbnail").notNull().default(false),
  sortOrder: int("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("pastor_book_images_book_order_idx").on(table.bookId, table.isThumbnail, table.sortOrder),
]);

export type PastorBookImage = typeof pastorBookImages.$inferSelect;
export type InsertPastorBookImage = typeof pastorBookImages.$inferInsert;

// ─────────────────────────────────────────────
// 선교보고 시스템
// ─────────────────────────────────────────────

export type MissionContinent = "asia" | "africa" | "americas" | "europe" | "oceania";

export const missionaries = mysqlTable("missionaries", {
  id: int("id").autoincrement().primaryKey(),
  /** 선교사/사역 이름 */
  name: varchar("name", { length: 128 }).notNull(),
  /** 사역 지역 */
  region: varchar("region", { length: 128 }).notNull(),
  /** 대륙 분류 */
  continent: mysqlEnum("continent", ["asia", "africa", "americas", "europe", "oceania"]).notNull().default("asia"),
  /** 파송/협력 시작 연도 */
  sentYear: int("sentYear").notNull().default(0),
  /** 프로필 이미지 URL */
  profileImage: text("profileImage"),
  /** 소속 선교단체/기관 */
  organization: varchar("organization", { length: 128 }),
  /** 소개 */
  description: text("description"),
  /** 노출 여부 */
  isActive: boolean("isActive").notNull().default(true),
  /** 표시 순서 */
  sortOrder: int("sortOrder").notNull().default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Missionary = typeof missionaries.$inferSelect;
export type InsertMissionary = typeof missionaries.$inferInsert;

export const missionReportAuthors = mysqlTable("mission_report_authors", {
  id: int("id").autoincrement().primaryKey(),
  /** 작성 권한을 가진 성도 ID */
  memberId: int("memberId").notNull(),
  /** 담당 선교사/사역 ID */
  missionaryId: int("missionaryId").notNull(),
  /** 작성 가능 여부 */
  canWrite: boolean("canWrite").notNull().default(true),
  /** 권한을 부여한 관리자 ID */
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type MissionReportAuthor = typeof missionReportAuthors.$inferSelect;
export type InsertMissionReportAuthor = typeof missionReportAuthors.$inferInsert;

export const missionReports = mysqlTable("mission_reports", {
  id: int("id").autoincrement().primaryKey(),
  /** 연결된 선교사/사역 ID */
  missionaryId: int("missionaryId").notNull(),
  /** 작성 성도 ID */
  authorMemberId: int("authorMemberId"),
  title: varchar("title", { length: 256 }).notNull(),
  /** 목록 카드 미리보기 */
  summary: text("summary"),
  /** 상세 본문 */
  content: text("content"),
  /** 대표 이미지 URL */
  thumbnailUrl: text("thumbnailUrl"),
  /** 보고 날짜 (YYYY-MM-DD) */
  reportDate: varchar("reportDate", { length: 10 }).notNull(),
  /** draft(임시) / pending(검토대기) / published(공개) / rejected(반려) */
  status: mysqlEnum("status", ["draft", "pending", "published", "rejected"]).notNull().default("pending"),
  /** 공개 시각 */
  publishedAt: timestamp("publishedAt"),
  /** 검토 관리자 ID */
  reviewedBy: int("reviewedBy"),
  /** 검토 시각 */
  reviewedAt: timestamp("reviewedAt"),
  /** 검토 의견 */
  reviewComment: text("reviewComment"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type MissionReport = typeof missionReports.$inferSelect;
export type InsertMissionReport = typeof missionReports.$inferInsert;

export const missionReportImages = mysqlTable("mission_report_images", {
  id: int("id").autoincrement().primaryKey(),
  reportId: int("reportId").notNull(),
  imageUrl: text("imageUrl").notNull(),
  caption: varchar("caption", { length: 128 }),
  sortOrder: int("sortOrder").notNull().default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type MissionReportImage = typeof missionReportImages.$inferSelect;
export type InsertMissionReportImage = typeof missionReportImages.$inferInsert;

export const missionReportFiles = mysqlTable("mission_report_files", {
  id: int("id").autoincrement().primaryKey(),
  reportId: int("reportId").notNull(),
  fileName: varchar("fileName", { length: 256 }).notNull(),
  fileUrl: varchar("fileUrl", { length: 512 }).notNull(),
  fileSize: int("fileSize"),
  mimeType: varchar("mimeType", { length: 128 }),
  sortOrder: int("sortOrder").notNull().default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type MissionReportFile = typeof missionReportFiles.$inferSelect;
export type InsertMissionReportFile = typeof missionReportFiles.$inferInsert;

export const missionReportPrayerTopics = mysqlTable("mission_report_prayer_topics", {
  id: int("id").autoincrement().primaryKey(),
  reportId: int("reportId").notNull(),
  content: varchar("content", { length: 512 }).notNull(),
  sortOrder: int("sortOrder").notNull().default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type MissionReportPrayerTopic = typeof missionReportPrayerTopics.$inferSelect;
export type InsertMissionReportPrayerTopic = typeof missionReportPrayerTopics.$inferInsert;

// ─────────────────────────────────────────────
// 생선 간증: 성도 간증/SNS형 댓글 시스템
// ─────────────────────────────────────────────

export const testimonyPosts = mysqlTable("testimony_posts", {
  id: int("id").autoincrement().primaryKey(),
  /** 작성 성도 ID */
  authorMemberId: int("author_member_id").notNull(),
  title: varchar("title", { length: 256 }).notNull(),
  content: text("content").notNull(),
  /** 대표 이미지 URL */
  thumbnailUrl: text("thumbnail_url"),
  /** published(공개) / hidden(숨김) / deleted(삭제 처리) */
  status: mysqlEnum("status", ["published", "hidden", "deleted"]).notNull().default("published"),
  viewCount: int("view_count").notNull().default(0),
  isPinned: boolean("is_pinned").notNull().default(false),
  isSecret: boolean("is_secret").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  index("testimony_posts_status_created_idx").on(table.status, table.createdAt),
  index("testimony_posts_author_idx").on(table.authorMemberId),
]);

export type TestimonyPost = typeof testimonyPosts.$inferSelect;
export type InsertTestimonyPost = typeof testimonyPosts.$inferInsert;

export const testimonyPostImages = mysqlTable("testimony_post_images", {
  id: int("id").autoincrement().primaryKey(),
  postId: int("post_id").notNull(),
  imageUrl: text("image_url").notNull(),
  caption: varchar("caption", { length: 128 }),
  sortOrder: int("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("testimony_post_images_post_idx").on(table.postId),
]);

export type TestimonyPostImage = typeof testimonyPostImages.$inferSelect;
export type InsertTestimonyPostImage = typeof testimonyPostImages.$inferInsert;

export const testimonyComments = mysqlTable("testimony_comments", {
  id: int("id").autoincrement().primaryKey(),
  postId: int("post_id").notNull(),
  authorMemberId: int("author_member_id").notNull(),
  content: text("content").notNull(),
  /** published(공개) / hidden(숨김) / deleted(삭제 처리) */
  status: mysqlEnum("status", ["published", "hidden", "deleted"]).notNull().default("published"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  index("testimony_comments_post_status_idx").on(table.postId, table.status),
  index("testimony_comments_author_idx").on(table.authorMemberId),
]);

export type TestimonyComment = typeof testimonyComments.$inferSelect;
export type InsertTestimonyComment = typeof testimonyComments.$inferInsert;

// ─────────────────────────────────────────────
// 교회학교: 부서 테이블
// ─────────────────────────────────────────────
export const schoolDepartments = mysqlTable("school_departments", {
  id: int("id").autoincrement().primaryKey(),
  /** 부서명 (예: 영아부, 유아부, 청년부 등) */
  name: varchar("name", { length: 64 }).notNull(),
  /** 분류: church_school(교회학교) / youth(청년부) */
  category: mysqlEnum("category", ["church_school", "youth"]).notNull().default("church_school"),
  /** 대상 연령/설명 (예: 13~30개월, 초등 1~2학년) */
  ageRange: varchar("ageRange", { length: 64 }),
  /** 예배 시간 (예: 주일 오전 11시) */
  worshipTime: varchar("worshipTime", { length: 128 }),
  /** 예배 장소 (예: 4층 영아부실) */
  worshipPlace: varchar("worshipPlace", { length: 128 }),
  /** 부서 소개 텍스트 */
  description: text("description"),
  /** 교육 목표 (줄바꿈 구분 텍스트) */
  educationGoals: text("educationGoals"),
  /** 기도제목 (줄바꿈 구분 텍스트) */
  prayerTopics: text("prayerTopics"),
  /** 섬기는 이들 (JSON 문자열: [{role, name}]) */
  staffInfo: text("staffInfo"),
  /** 대표 이미지 URL */
  imageUrl: varchar("imageUrl", { length: 512 }),
  /** 표시 순서 */
  sortOrder: int("sortOrder").notNull().default(0),
  /** 표시 여부 */
  isVisible: boolean("isVisible").notNull().default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type SchoolDepartment = typeof schoolDepartments.$inferSelect;
export type InsertSchoolDepartment = typeof schoolDepartments.$inferInsert;

// ─────────────────────────────────────────────
// 교회학교: 게시글 테이블
// ─────────────────────────────────────────────
export const schoolPosts = mysqlTable("school_posts", {
  id: int("id").autoincrement().primaryKey(),
  /** 소속 부서 ID */
  departmentId: int("departmentId").notNull(),
  /** 글 제목 */
  title: varchar("title", { length: 256 }).notNull(),
  /** 글 내용 */
  content: text("content"),
  /** 작성자 이름 */
  authorName: varchar("authorName", { length: 64 }).notNull(),
  /** 작성자 church_members ID (로그인 성도) */
  memberId: int("memberId"),
  /** 조회수 */
  viewCount: int("viewCount").notNull().default(0),
  /** 공지 여부 */
  isNotice: boolean("isNotice").notNull().default(false),
  /** 표시 여부 */
  isVisible: boolean("isVisible").notNull().default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type SchoolPost = typeof schoolPosts.$inferSelect;
export type InsertSchoolPost = typeof schoolPosts.$inferInsert;

// ─────────────────────────────────────────────
// 교회학교: 게시글 첨부파일 테이블
// ─────────────────────────────────────────────
export const schoolPostFiles = mysqlTable("school_post_files", {
  id: int("id").autoincrement().primaryKey(),
  /** 소속 게시글 ID */
  postId: int("postId").notNull(),
  /** 파일 원본 이름 */
  fileName: varchar("fileName", { length: 256 }).notNull(),
  /** S3 파일 URL */
  fileUrl: varchar("fileUrl", { length: 512 }).notNull(),
  /** 파일 크기 (bytes) */
  fileSize: int("fileSize"),
  /** MIME 타입 */
  mimeType: varchar("mimeType", { length: 128 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type SchoolPostFile = typeof schoolPostFiles.$inferSelect;
export type InsertSchoolPostFile = typeof schoolPostFiles.$inferInsert;

// ─────────────────────────────────────────────
// 블록 에디터: 동적 페이지 콘텐츠 블록
// pageType=editor 인 메뉴 항목의 내용을 블록 단위로 관리합니다.
// 하나의 페이지(menuItemId 또는 menuSubItemId)에 여러 블록이 순서대로 쌓입니다.
// ─────────────────────────────────────────────
export const pageBlocks = mysqlTable("page_blocks", {
  id: int("id").autoincrement().primaryKey(),
  /** 2단 메뉴 항목 ID (menu_items.id) — 2단 메뉴 페이지에 속하는 경우 */
  menuItemId: int("menuItemId"),
  /** 3단 메뉴 항목 ID (menu_sub_items.id) — 3단 메뉴 페이지에 속하는 경우 */
  menuSubItemId: int("menuSubItemId"),
  /**
   * 블록 종류:
   *   text-h1       → 큰 제목 (H1)
   *   text-h2       → 중간 제목 (H2)
   *   text-h3       → 작은 제목 (H3)
   *   text-body     → 본문 텍스트 (줄바꿈 지원)
   *   image-single  → 이미지 1장
   *   image-double  → 이미지 2장 나란히
   *   image-triple  → 이미지 3장 나란히
   *   youtube       → 유튜브 영상 임베드
   *   button        → 링크 버튼
   *   divider       → 구분선
   */
  blockType: varchar("blockType", { length: 32 }).notNull(),
  /**
   * 블록 내용 (JSON 문자열로 저장)
   * - text 계열:   { "text": "내용" }
   * - image 계열:  { "urls": ["url1", "url2"], "captions": ["캡션1", "캡션2"] }
   * - youtube:     { "videoId": "유튜브ID", "title": "영상 제목" }
   * - button:      { "label": "버튼 이름", "href": "링크 URL", "style": "primary|outline" }
   * - divider:     {} (내용 없음)
   */
  content: text("content").notNull(),
  /** 페이지 내 표시 순서 (숫자가 작을수록 위에 표시) */
  sortOrder: int("sortOrder").notNull().default(0),
  /** 표시 여부 (false = 숨김) */
  isVisible: boolean("isVisible").notNull().default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PageBlock = typeof pageBlocks.$inferSelect;
export type InsertPageBlock = typeof pageBlocks.$inferInsert;

// ─────────────────────────────────────────────
// 유튜브 플레이리스트 (영상 그룹)
// 메뉴 항목의 pageType=youtube 일 때 연결되는 영상 묶음입니다.
// ─────────────────────────────────────────────
export const youtubePlaylists = mysqlTable("youtube_playlists", {
  id: int("id").autoincrement().primaryKey(),
  /** 플레이리스트 이름 (관리자 구분용) */
  title: varchar("title", { length: 128 }).notNull(),
  /** 설명 */
  description: text("description"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type YoutubePlaylist = typeof youtubePlaylists.$inferSelect;
export type InsertYoutubePlaylist = typeof youtubePlaylists.$inferInsert;

// ─────────────────────────────────────────────
// 유튜브 영상 목록
// 각 플레이리스트에 속하는 영상 항목들입니다.
// ─────────────────────────────────────────────
export const youtubeVideos = mysqlTable("youtube_videos", {
  id: int("id").autoincrement().primaryKey(),
  /** 소속 플레이리스트 ID */
  playlistId: int("playlistId").notNull(),
  /** 유튜브 영상 ID (예: dQw4w9WgXcQ) — 유튜브 영상일 때만 사용, mp4 직접 URL이면 null */
  videoId: varchar("videoId", { length: 32 }),
  /** 직접 영상 파일 URL (예: http://sermon.joych.org/mp4/wed/260415_wed.mp4) — mp4 등 직접 URL일 때 사용 */
  videoUrl: text("videoUrl"),
  /** 영상 제목 */
  title: varchar("title", { length: 256 }).notNull(),
  /** 설교자 */
  preacher: varchar("preacher", { length: 128 }),
  /** 본문 */
  scripture: varchar("scripture", { length: 256 }),
  /** 설교 날짜 */
  sermonDate: varchar("sermonDate", { length: 32 }),
  /** 썸네일 URL */
  thumbnailUrl: text("thumbnailUrl"),
  /** 영상 설명 (선택) */
  description: text("description"),
  /** 표시 순서 (숫자가 작을수록 위/앞에 표시) */
  sortOrder: int("sortOrder").notNull().default(0),
  /** 표시 여부 */
  isVisible: boolean("isVisible").notNull().default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type YoutubeVideo = typeof youtubeVideos.$inferSelect;
export type InsertYoutubeVideo = typeof youtubeVideos.$inferInsert;
