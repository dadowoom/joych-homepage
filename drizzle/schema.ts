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
  /** youtube 타입일 때 연결된 플레이리스트 ID */
  playlistId: int("playlistId"),
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
  /** youtube 타입일 때 연결된 플레이리스트 ID */
  playlistId: int("playlistId"),
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
  /** 예약자 성도 ID (church_members.id 참조) */
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
