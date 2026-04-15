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
  /** 페이지 표시 타입: image(이미지 전체화면) / gallery(갤러리) / board(게시판) / youtube(유튜브 목록) / editor(텍스트+이미지) */
  pageType: mysqlEnum("pageType", ["image", "gallery", "board", "youtube", "editor"]).default("image").notNull(),
  /** 이미지 타입일 때 표시할 이미지 URL */
  pageImageUrl: text("pageImageUrl"),
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
  /** 페이지 표시 타입 */
  pageType: mysqlEnum("pageType", ["image", "gallery", "board", "youtube", "editor"]).default("image").notNull(),
  /** 이미지 타입일 때 표시할 이미지 URL */
  pageImageUrl: text("pageImageUrl"),
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

// ─────────────────────────────────────────────
// 교적부: 교회 성도 정보
// 관리자가 등록하며, 믿음PLUS 유저ID 연동 가능
// ─────────────────────────────────────────────
export const churchMembers = mysqlTable("church_members", {
  id: int("id").autoincrement().primaryKey(),
  /** 성도 이름 */
  name: varchar("name", { length: 64 }).notNull(),
  /** 나이 */
  age: int("age"),
  /** 성별 (남/여) */
  gender: varchar("gender", { length: 8 }),
  /** 교구 (예: 영덕교구) */
  district: varchar("district", { length: 64 }),
  /** 직분 (예: 집사, 권사, 장로) */
  position: varchar("position", { length: 32 }),
  /** 봉사 부서/역할 (예: 아동부 교사) */
  ministry: varchar("ministry", { length: 128 }),
  /** 연락처 */
  phone: varchar("phone", { length: 32 }),
  /** 주소 */
  address: varchar("address", { length: 256 }),
  /** 교회 등록일 */
  registeredAt: varchar("registeredAt", { length: 16 }),
  /** 믿음PLUS 앱 유저 ID (연동용) */
  faithPlusUserId: int("faithPlusUserId"),
  /** 활성 여부 */
  isActive: boolean("isActive").notNull().default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ChurchMember = typeof churchMembers.$inferSelect;
export type InsertChurchMember = typeof churchMembers.$inferInsert;

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
  /** 노출 여부 */
  isVisible: boolean("isVisible").notNull().default(true),
  /** 이용 안내 (마크다운 지원) */
  notice: text("notice"),
  /** 예약 시 주의사항 */
  caution: text("caution"),
  /** 정렬 순서 */
  sortOrder: int("sortOrder").notNull().default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Facility = typeof facilities.$inferSelect;
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
});

export type FacilityHour = typeof facilityHours.$inferSelect;
export type InsertFacilityHour = typeof facilityHours.$inferInsert;

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
  /** 예약자 ID (users.id 참조) */
  userId: int("userId").notNull(),
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
  /** 예약 상태: pending(대기) / approved(승인) / rejected(거절) / cancelled(취소) */
  status: mysqlEnum("status", ["pending", "approved", "rejected", "cancelled"]).notNull().default("pending"),
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
