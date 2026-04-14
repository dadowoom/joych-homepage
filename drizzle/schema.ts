import {
  boolean,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
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
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type MenuItem = typeof menuItems.$inferSelect;
export type InsertMenuItem = typeof menuItems.$inferInsert;

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
  /** 게시 여부 */
  isPublished: boolean("isPublished").notNull().default(true),
  /** 상단 고정 여부 */
  isPinned: boolean("isPinned").notNull().default(false),
  /** 작성자 (users.id 참조) */
  authorId: int("authorId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Notice = typeof notices.$inferSelect;
export type InsertNotice = typeof notices.$inferInsert;

// ─────────────────────────────────────────────
// CMS: 갤러리 사진
// ─────────────────────────────────────────────
export const galleryItems = mysqlTable("gallery_items", {
  id: int("id").autoincrement().primaryKey(),
  /** S3 CDN 이미지 URL */
  imageUrl: text("imageUrl").notNull(),
  /** 사진 설명 (alt 텍스트) */
  caption: varchar("caption", { length: 128 }),
  /** 그리드 크기 (예: col-span-2 row-span-2) */
  gridSpan: varchar("gridSpan", { length: 64 }).default("col-span-1 row-span-1"),
  sortOrder: int("sortOrder").notNull().default(0),
  isVisible: boolean("isVisible").notNull().default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

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
