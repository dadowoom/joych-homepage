import { eq, asc, desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser, users,
  notices, affiliates, siteSettings,
  heroSlides, galleryItems, quickMenus,
  menus, menuItems, menuSubItems, sections,
  InsertNotice, InsertAffiliate, InsertSiteSetting,
  InsertGalleryItem,
  facilities, facilityImages, facilityHours, facilityBlockedDates, reservations,
  InsertFacility, InsertFacilityImage, InsertFacilityHour, InsertFacilityBlockedDate, InsertReservation,
  pageBlocks, PageBlock,
  youtubePlaylists, youtubeVideos,
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function setUserRole(openId: string, role: "admin" | "user"): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ role }).where(eq(users.openId, openId));
}

// ─────────────────────────────────────────────
// CMS: 공개 데이터 조회 (홈페이지에서 사용)
// ─────────────────────────────────────────────

/** 교회 소식 목록 (최신순, 최대 5개) */
export async function getPublishedNotices(limit = 5) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(notices)
    .where(eq(notices.isPublished, true))
    .orderBy(desc(notices.createdAt))
    .limit(limit);
}

/** 관련 기관 목록 (정렬순) */
export async function getVisibleAffiliates() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(affiliates)
    .where(eq(affiliates.isVisible, true))
    .orderBy(asc(affiliates.sortOrder));
}

/** 히어로 슬라이드 목록 (정렬순) */
export async function getVisibleHeroSlides() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(heroSlides)
    .where(eq(heroSlides.isVisible, true))
    .orderBy(asc(heroSlides.sortOrder));
}

/** 갤러리 사진 목록 (정렬순) */
export async function getVisibleGalleryItems() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(galleryItems)
    .where(eq(galleryItems.isVisible, true))
    .orderBy(asc(galleryItems.sortOrder));
}

/** 퀵 메뉴 목록 (정렬순) */
export async function getVisibleQuickMenus() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(quickMenus)
    .where(eq(quickMenus.isVisible, true))
    .orderBy(asc(quickMenus.sortOrder));
}

/** 사이트 설정 전체 (key-value 맵으로 반환) */
export async function getSiteSettings() {
  const db = await getDb();
  if (!db) return {} as Record<string, string>;
  const rows = await db.select().from(siteSettings);
  return Object.fromEntries(rows.map(r => [r.settingKey, r.settingValue ?? ""]));
}

/** 특정 사이트 설정 값 조회 */
export async function getSiteSetting(key: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(siteSettings).where(eq(siteSettings.settingKey, key)).limit(1);
  return result.length > 0 ? result[0].settingValue : null;
}

// ─────────────────────────────────────────────
// CMS: 관리자 전용 CRUD
// ─────────────────────────────────────────────

/** 교회 소식 전체 목록 (관리자용) */
export async function getAllNotices() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(notices).orderBy(desc(notices.createdAt));
}

/** 교회 소식 생성 */
export async function createNotice(data: InsertNotice) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(notices).values(data);
}

/** 교회 소식 수정 */
export async function updateNotice(id: number, data: Partial<InsertNotice>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(notices).set(data).where(eq(notices.id, id));
}

/** 교회 소식 삭제 */
export async function deleteNotice(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(notices).where(eq(notices.id, id));
}

/** 히어로 슬라이드 전체 목록 (관리자용) */
export async function getAllHeroSlides() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(heroSlides).orderBy(asc(heroSlides.sortOrder));
}

/** 히어로 슬라이드 수정 */
export async function updateHeroSlide(id: number, data: Partial<typeof heroSlides.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(heroSlides).set(data).where(eq(heroSlides.id, id));
}

/** 관련 기관 전체 목록 (관리자용) */
export async function getAllAffiliates() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(affiliates).orderBy(asc(affiliates.sortOrder));
}

/** 관련 기관 수정 */
export async function updateAffiliate(id: number, data: Partial<InsertAffiliate>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(affiliates).set(data).where(eq(affiliates.id, id));
}

/** 갤러리 사진 수정 */
export async function updateGalleryItem(id: number, data: Partial<InsertGalleryItem>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(galleryItems).set(data).where(eq(galleryItems.id, id));
}

/** 메뉴 전체 목록 (서브메뉴 + 3단 포함, 공개용) */
export async function getVisibleMenus() {
  const db = await getDb();
  if (!db) return [];
  const menuList = await db.select().from(menus)
    .where(eq(menus.isVisible, true))
    .orderBy(asc(menus.sortOrder));
  const itemList = await db.select().from(menuItems)
    .where(eq(menuItems.isVisible, true))
    .orderBy(asc(menuItems.sortOrder));
  const subItemList = await db.select().from(menuSubItems)
    .where(eq(menuSubItems.isVisible, true))
    .orderBy(asc(menuSubItems.sortOrder));
  return menuList.map(m => ({
    ...m,
    items: itemList.filter(item => item.menuId === m.id).map(item => ({
      ...item,
      subItems: subItemList.filter(sub => sub.menuItemId === item.id),
    })),
  }));
}

/** 메뉴 전체 목록 (관리자용, 숨김 포함, 3단 포함) */
export async function getAllMenus() {
  const db = await getDb();
  if (!db) return [];
  const menuList = await db.select().from(menus).orderBy(asc(menus.sortOrder));
  const itemList = await db.select().from(menuItems).orderBy(asc(menuItems.sortOrder));
  const subItemList = await db.select().from(menuSubItems).orderBy(asc(menuSubItems.sortOrder));
  return menuList.map(m => ({
    ...m,
    items: itemList.filter(item => item.menuId === m.id).map(item => ({
      ...item,
      subItems: subItemList.filter(sub => sub.menuItemId === item.id),
    })),
  }));
}

/** 메뉴 수정 */
export async function updateMenu(id: number, data: Partial<typeof menus.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error('DB not available');
  await db.update(menus).set(data).where(eq(menus.id, id));
}

/** 2단 메뉴 항목 단건 조회 */
export async function getMenuItemById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(menuItems).where(eq(menuItems.id, id)).limit(1);
  return rows[0] ?? null;
}

/** 3단 메뉴 항목 단건 조회 */
export async function getMenuSubItemById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(menuSubItems).where(eq(menuSubItems.id, id)).limit(1);
  return rows[0] ?? null;
}

/** 서브메뉴 항목 추가 */
export async function createMenuItem(data: typeof menuItems.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error('DB not available');
  const [result] = await db.insert(menuItems).values(data);
  return result as { insertId: number };
}

/** 서브메뉴 항목 수정 */
export async function updateMenuItem(id: number, data: Partial<typeof menuItems.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error('DB not available');
  await db.update(menuItems).set(data).where(eq(menuItems.id, id));
}

/** 서브메뉴 항목 삭제 */
export async function deleteMenuItem(id: number) {
  const db = await getDb();
  if (!db) throw new Error('DB not available');
  await db.delete(menuItems).where(eq(menuItems.id, id));
}

/** 사이트 설정 저장 (upsert) */
export async function upsertSiteSetting(key: string, value: string) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(siteSettings)
    .values({ settingKey: key, settingValue: value })
    .onDuplicateKeyUpdate({ set: { settingValue: value } });
}

/** 상위 메뉴 생성 */
export async function createMenu(data: { label: string; href?: string | null; sortOrder?: number }) {
  const db = await getDb();
  if (!db) throw new Error('DB not available');
  const [result] = await db.insert(menus).values({
    label: data.label,
    href: data.href ?? null,
    sortOrder: data.sortOrder ?? 0,
    isVisible: true,
  });
  return result;
}

/** 상위 메뉴 삭제 */
export async function deleteMenu(id: number) {
  const db = await getDb();
  if (!db) throw new Error('DB not available');
  // 2단 서브메뉴 ID 목록 조회
  const items = await db.select({ id: menuItems.id }).from(menuItems).where(eq(menuItems.menuId, id));
  // 3단 서브메뉴도 함께 삭제
  for (const item of items) {
    await db.delete(menuSubItems).where(eq(menuSubItems.menuItemId, item.id));
  }
  await db.delete(menuItems).where(eq(menuItems.menuId, id));
  await db.delete(menus).where(eq(menus.id, id));
}

/** 3단 메뉴 항목 추가 */
export async function createMenuSubItem(data: typeof menuSubItems.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error('DB not available');
  const [result] = await db.insert(menuSubItems).values(data);
  return result as { insertId: number };
}

/** 3단 메뉴 항목 수정 */
export async function updateMenuSubItem(id: number, data: Partial<typeof menuSubItems.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error('DB not available');
  await db.update(menuSubItems).set(data).where(eq(menuSubItems.id, id));
}

/** 3단 메뉴 항목 삭제 */
export async function deleteMenuSubItem(id: number) {
  const db = await getDb();
  if (!db) throw new Error('DB not available');
  await db.delete(menuSubItems).where(eq(menuSubItems.id, id));
}

/** 2단 메뉴 항목 삭제 (3단도 함께 삭제) */
export async function deleteMenuItemWithSubs(id: number) {
  const db = await getDb();
  if (!db) throw new Error('DB not available');
  await db.delete(menuSubItems).where(eq(menuSubItems.menuItemId, id));
  await db.delete(menuItems).where(eq(menuItems.id, id));
}

/** 메뉴 순서 일괄 변경 */
export async function reorderMenus(items: { id: number; sortOrder: number }[]) {
  const db = await getDb();
  if (!db) throw new Error('DB not available');
  await Promise.all(
    items.map(item =>
      db.update(menus).set({ sortOrder: item.sortOrder }).where(eq(menus.id, item.id))
    )
  );
}

/** 2단 메뉴 순서 일괄 변경 */
export async function reorderMenuItems(items: { id: number; sortOrder: number }[]) {
  const db = await getDb();
  if (!db) throw new Error('DB not available');
  await Promise.all(
    items.map(item =>
      db.update(menuItems).set({ sortOrder: item.sortOrder }).where(eq(menuItems.id, item.id))
    )
  );
}

/** 3단 메뉴 순서 일괄 변경 */
export async function reorderMenuSubItems(items: { id: number; sortOrder: number }[]) {
  const db = await getDb();
  if (!db) throw new Error('DB not available');
  await Promise.all(
    items.map(item =>
      db.update(menuSubItems).set({ sortOrder: item.sortOrder }).where(eq(menuSubItems.id, item.id))
    )
  );
}

/** 퀵 메뉴 전체 목록 (관리자용, 숨김 포함) */
export async function getAllQuickMenus() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(quickMenus).orderBy(asc(quickMenus.sortOrder));
}

/** 퀵 메뉴 수정 */
export async function updateQuickMenu(id: number, data: Partial<typeof quickMenus.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error('DB not available');
  await db.update(quickMenus).set(data).where(eq(quickMenus.id, id));
}

/** 퀵 메뉴 순서 일괄 변경 */
export async function reorderQuickMenus(items: { id: number; sortOrder: number }[]) {
  const db = await getDb();
  if (!db) throw new Error('DB not available');
  await Promise.all(
    items.map(item =>
      db.update(quickMenus).set({ sortOrder: item.sortOrder }).where(eq(quickMenus.id, item.id))
    )
  );
}

/** 히어로 슬라이드 추가 */
export async function createHeroSlide(data: {
  videoUrl?: string;
  posterUrl?: string;
  yearLabel?: string;
  mainTitle?: string;
  subTitle?: string;
  bibleRef?: string;
  btn1Text?: string;
  btn1Href?: string;
  btn2Text?: string;
  btn2Href?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error('DB not available');
  // 현재 가장 큰 sortOrder + 1
  const existing = await db.select({ sortOrder: heroSlides.sortOrder })
    .from(heroSlides)
    .orderBy(desc(heroSlides.sortOrder))
    .limit(1);
  const nextOrder = existing.length > 0 ? (existing[0].sortOrder ?? 0) + 1 : 1;
  await db.insert(heroSlides).values({
    ...data,
    sortOrder: nextOrder,
    isVisible: true,
  });
}

/** 히어로 슬라이드 삭제 */
export async function deleteHeroSlide(id: number) {
  const db = await getDb();
  if (!db) throw new Error('DB not available');
  await db.delete(heroSlides).where(eq(heroSlides.id, id));
}

// ─────────────────────────────────────────────
// 시설 예약 시스템 DB 헬퍼 함수
// ─────────────────────────────────────────────

/** 전체 시설 목록 조회 (isVisible=true만, 정렬 순서대로) */
export async function getFacilities(onlyVisible = true) {
  const db = await getDb();
  if (!db) return [];
  const query = db.select().from(facilities).orderBy(asc(facilities.sortOrder));
  if (onlyVisible) {
    return await db.select().from(facilities).where(eq(facilities.isVisible, true)).orderBy(asc(facilities.sortOrder));
  }
  return await query;
}

/** 시설 단건 조회 */
export async function getFacilityById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(facilities).where(eq(facilities.id, id)).limit(1);
  return rows[0] ?? null;
}

/** 시설 생성 */
export async function createFacility(data: Omit<InsertFacility, 'id' | 'createdAt' | 'updatedAt'>) {
  const db = await getDb();
  if (!db) throw new Error('DB not available');
  const result = await db.insert(facilities).values(data);
  const id = result[0].insertId as number;
  return { id };
}

/** 시설 수정 */
export async function updateFacility(id: number, data: Partial<InsertFacility>) {
  const db = await getDb();
  if (!db) throw new Error('DB not available');
  await db.update(facilities).set(data).where(eq(facilities.id, id));
}

/** 시설 삭제 */
export async function deleteFacility(id: number) {
  const db = await getDb();
  if (!db) throw new Error('DB not available');
  await db.delete(facilities).where(eq(facilities.id, id));
}

/** 시설 사진 목록 조회 */
export async function getFacilityImages(facilityId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(facilityImages)
    .where(eq(facilityImages.facilityId, facilityId))
    .orderBy(asc(facilityImages.sortOrder));
}

/** 시설 사진 추가 */
export async function addFacilityImage(data: Omit<InsertFacilityImage, 'id' | 'createdAt'>) {
  const db = await getDb();
  if (!db) throw new Error('DB not available');
  const result = await db.insert(facilityImages).values(data);
  return result[0].insertId as number;
}

/** 시설 사진 삭제 */
export async function deleteFacilityImage(id: number) {
  const db = await getDb();
  if (!db) throw new Error('DB not available');
  await db.delete(facilityImages).where(eq(facilityImages.id, id));
}

/** 시설 운영 시간 조회 (7개 요일) */
export async function getFacilityHours(facilityId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(facilityHours)
    .where(eq(facilityHours.facilityId, facilityId))
    .orderBy(asc(facilityHours.dayOfWeek));
}

/** 시설 운영 시간 upsert (요일별) */
export async function upsertFacilityHour(data: Omit<InsertFacilityHour, 'id' | 'createdAt' | 'updatedAt'>) {
  const db = await getDb();
  if (!db) throw new Error('DB not available');
  // 기존 레코드 확인
  const existing = await db.select().from(facilityHours)
    .where(eq(facilityHours.facilityId, data.facilityId))
    .limit(100);
  const found = existing.find(h => h.dayOfWeek === data.dayOfWeek);
  if (found) {
    await db.update(facilityHours).set(data).where(eq(facilityHours.id, found.id));
  } else {
    await db.insert(facilityHours).values(data);
  }
}

/** 특정 날짜 차단 목록 조회 */
export async function getBlockedDates(facilityId?: number) {
  const db = await getDb();
  if (!db) return [];
  if (facilityId !== undefined) {
    return await db.select().from(facilityBlockedDates)
      .where(eq(facilityBlockedDates.facilityId, facilityId));
  }
  return await db.select().from(facilityBlockedDates);
}

/** 특정 날짜 차단 추가 */
export async function addBlockedDate(data: Omit<InsertFacilityBlockedDate, 'id' | 'createdAt'>) {
  const db = await getDb();
  if (!db) throw new Error('DB not available');
  const result = await db.insert(facilityBlockedDates).values(data);
  return result[0].insertId as number;
}

/** 특정 날짜 차단 삭제 */
export async function deleteBlockedDate(id: number) {
  const db = await getDb();
  if (!db) throw new Error('DB not available');
  await db.delete(facilityBlockedDates).where(eq(facilityBlockedDates.id, id));
}

/** 예약 목록 조회 (관리자용 - 전체, 시설명 JOIN 포함) */
export async function getAllReservations(facilityId?: number) {
  const db = await getDb();
  if (!db) return [];
  const query = db
    .select({
      id: reservations.id,
      facilityId: reservations.facilityId,
      facilityName: facilities.name,
      userId: reservations.userId,
      reserverName: reservations.reserverName,
      reserverPhone: reservations.reserverPhone,
      reservationDate: reservations.reservationDate,
      startTime: reservations.startTime,
      endTime: reservations.endTime,
      purpose: reservations.purpose,
      department: reservations.department,
      attendees: reservations.attendees,
      notes: reservations.notes,
      status: reservations.status,
      adminComment: reservations.adminComment,
      processedBy: reservations.processedBy,
      processedAt: reservations.processedAt,
      createdAt: reservations.createdAt,
      updatedAt: reservations.updatedAt,
    })
    .from(reservations)
    .leftJoin(facilities, eq(reservations.facilityId, facilities.id))
    .orderBy(desc(reservations.createdAt));
  if (facilityId !== undefined) {
    return await query.where(eq(reservations.facilityId, facilityId));
  }
  return await query;
}

/** 내 예약 목록 조회 (성도용) */
export async function getMyReservations(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(reservations)
    .where(eq(reservations.userId, userId))
    .orderBy(desc(reservations.createdAt));
}

/** 특정 날짜의 시설 예약 목록 조회 (시간 충돌 확인용) */
export async function getReservationsByDate(facilityId: number, date: string) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(reservations)
    .where(eq(reservations.facilityId, facilityId))
    .orderBy(asc(reservations.startTime));
}

/** 예약 생성 */
export async function createReservation(data: Omit<InsertReservation, 'id' | 'createdAt' | 'updatedAt'>) {
  const db = await getDb();
  if (!db) throw new Error('DB not available');
  const result = await db.insert(reservations).values(data);
  return result[0].insertId as number;
}

/** 예약 상태 업데이트 (승인/거절/취소) */
export async function updateReservationStatus(
  id: number,
  status: 'approved' | 'rejected' | 'cancelled',
  adminComment?: string,
  processedBy?: number,
) {
  const db = await getDb();
  if (!db) throw new Error('DB not available');
  await db.update(reservations).set({
    status,
    adminComment: adminComment ?? null,
    processedBy: processedBy ?? null,
    processedAt: new Date(),
  }).where(eq(reservations.id, id));
}

/** 예약 단건 조회 */
export async function getReservationById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(reservations).where(eq(reservations.id, id)).limit(1);
  return rows[0] ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// 교회 회원 시스템
// ─────────────────────────────────────────────────────────────────────────────
import {
  churchMembers, memberFieldOptions,
} from "../drizzle/schema";

/** 선택지 목록 조회 (fieldType별, 활성만) */
export async function getMemberFieldOptions(fieldType?: string) {
  const db = await getDb();
  if (!db) return [];
  if (fieldType) {
    return db.select().from(memberFieldOptions)
      .where(eq(memberFieldOptions.fieldType, fieldType))
      .orderBy(asc(memberFieldOptions.sortOrder));
  }
  return db.select().from(memberFieldOptions)
    .orderBy(asc(memberFieldOptions.fieldType), asc(memberFieldOptions.sortOrder));
}

/** 선택지 전체 조회 (관리자용 - 비활성 포함) */
export async function getAllMemberFieldOptions() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(memberFieldOptions)
    .orderBy(asc(memberFieldOptions.fieldType), asc(memberFieldOptions.sortOrder));
}

/** 선택지 추가 */
export async function createMemberFieldOption(data: { fieldType: string; label: string; sortOrder?: number }) {
  const db = await getDb();
  if (!db) throw new Error('DB not available');
  const [result] = await db.insert(memberFieldOptions).values({
    fieldType: data.fieldType,
    label: data.label,
    sortOrder: data.sortOrder ?? 0,
  });
  return (result as any).insertId as number;
}

/** 선택지 수정 */
export async function updateMemberFieldOption(id: number, data: Partial<{ label: string; sortOrder: number; isActive: boolean }>) {
  const db = await getDb();
  if (!db) throw new Error('DB not available');
  await db.update(memberFieldOptions).set(data).where(eq(memberFieldOptions.id, id));
}

/** 선택지 삭제 */
export async function deleteMemberFieldOption(id: number) {
  const db = await getDb();
  if (!db) throw new Error('DB not available');
  await db.delete(memberFieldOptions).where(eq(memberFieldOptions.id, id));
}

/** 이메일로 성도 조회 */
export async function getMemberByEmail(email: string) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(churchMembers).where(eq(churchMembers.email, email)).limit(1);
  return rows[0] ?? null;
}

/** ID로 성도 조회 */
export async function getMemberById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(churchMembers).where(eq(churchMembers.id, id)).limit(1);
  return rows[0] ?? null;
}

/** 성도 회원가입 */
export async function createMember(data: {
  email: string;
  passwordHash: string;
  name: string;
  phone?: string;
  birthDate?: string;
  gender?: string;
  address?: string;
  emergencyPhone?: string;
  joinPath?: string;
  faithPlusUserId?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error('DB not available');
  const [result] = await db.insert(churchMembers).values({
    ...data,
    status: 'pending',
  });
  return (result as any).insertId as number;
}

/** 성도 기본 정보 수정 (성도 본인) */
export async function updateMemberBasicInfo(id: number, data: Partial<{
  name: string;
  phone: string;
  birthDate: string;
  gender: string;
  address: string;
  emergencyPhone: string;
  faithPlusUserId: string;
}>) {
  const db = await getDb();
  if (!db) throw new Error('DB not available');
  await db.update(churchMembers).set({ ...data, updatedAt: new Date() }).where(eq(churchMembers.id, id));
}

/** 성도 교회 정보 수정 (관리자 전용) */
export async function updateMemberChurchInfo(id: number, data: Partial<{
  position: string;
  department: string;
  district: string;
  baptismType: string;
  baptismDate: string;
  registeredAt: string;
  pastor: string;
  adminMemo: string;
  status: 'pending' | 'approved' | 'rejected' | 'withdrawn';
  faithPlusUserId: string;
}>) {
  const db = await getDb();
  if (!db) throw new Error('DB not available');
  await db.update(churchMembers).set({ ...data, updatedAt: new Date() }).where(eq(churchMembers.id, id));
}

/** 전체 성도 목록 조회 (관리자용) */
export async function getAllMembers() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(churchMembers).orderBy(desc(churchMembers.createdAt));
}

/** 승인 대기 성도 목록 */
export async function getPendingMembers() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(churchMembers)
    .where(eq(churchMembers.status, 'pending'))
    .orderBy(desc(churchMembers.createdAt));
}

/** 관리자: 성도 전체 정보 수정 (기본정보 + 교회정보 통합) */
export async function adminUpdateMember(id: number, data: Partial<{
  name: string;
  phone: string;
  birthDate: string;
  gender: string;
  address: string;
  emergencyPhone: string;
  email: string;
  position: string;
  department: string;
  district: string;
  baptismType: string;
  baptismDate: string;
  registeredAt: string;
  pastor: string;
  adminMemo: string;
  status: 'pending' | 'approved' | 'rejected' | 'withdrawn';
  faithPlusUserId: string;
}>) {
  const db = await getDb();
  if (!db) throw new Error('DB not available');
  await db.update(churchMembers).set({ ...data, updatedAt: new Date() }).where(eq(churchMembers.id, id));
}

/** 관리자: 성도 비밀번호 초기화 (임시 비밀번호 설정) */
export async function adminResetMemberPassword(id: number, tempPassword: string) {
  const bcrypt = await import('bcryptjs');
  const hash = await bcrypt.hash(tempPassword, 10);
  const db = await getDb();
  if (!db) throw new Error('DB not available');
  await db.update(churchMembers).set({ passwordHash: hash, updatedAt: new Date() }).where(eq(churchMembers.id, id));
}

// ─────────────────────────────────────────────────────────────────────────────
// 블록 에디터: 동적 페이지 콘텐츠 블록 관리
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 특정 페이지의 블록 목록 조회 (공개용 — isVisible=true 만)
 * menuItemId 또는 menuSubItemId 중 하나를 전달합니다.
 */
export async function getPageBlocks(params: {
  menuItemId?: number;
  menuSubItemId?: number;
}): Promise<PageBlock[]> {
  const db = await getDb();
  if (!db) return [];
  if (params.menuItemId !== undefined) {
    return db.select().from(pageBlocks)
      .where(eq(pageBlocks.menuItemId, params.menuItemId))
      .orderBy(asc(pageBlocks.sortOrder));
  }
  if (params.menuSubItemId !== undefined) {
    return db.select().from(pageBlocks)
      .where(eq(pageBlocks.menuSubItemId, params.menuSubItemId))
      .orderBy(asc(pageBlocks.sortOrder));
  }
  return [];
}

/**
 * 특정 페이지의 블록 목록 조회 (관리자용 — 숨김 포함)
 */
export async function getAllPageBlocks(params: {
  menuItemId?: number;
  menuSubItemId?: number;
}): Promise<PageBlock[]> {
  const db = await getDb();
  if (!db) return [];
  if (params.menuItemId !== undefined) {
    return db.select().from(pageBlocks)
      .where(eq(pageBlocks.menuItemId, params.menuItemId))
      .orderBy(asc(pageBlocks.sortOrder));
  }
  if (params.menuSubItemId !== undefined) {
    return db.select().from(pageBlocks)
      .where(eq(pageBlocks.menuSubItemId, params.menuSubItemId))
      .orderBy(asc(pageBlocks.sortOrder));
  }
  return [];
}

/** 블록 단건 조회 */
export async function getPageBlockById(id: number): Promise<PageBlock | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(pageBlocks).where(eq(pageBlocks.id, id)).limit(1);
  return rows[0] ?? null;
}

/** 블록 생성 — 새 블록을 페이지 맨 끝에 추가 */
export async function createPageBlock(data: {
  menuItemId?: number;
  menuSubItemId?: number;
  blockType: string;
  content: string;
  sortOrder: number;
}): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error('DB not available');
  const [result] = await db.insert(pageBlocks).values({
    menuItemId: data.menuItemId ?? null,
    menuSubItemId: data.menuSubItemId ?? null,
    blockType: data.blockType,
    content: data.content,
    sortOrder: data.sortOrder,
    isVisible: true,
  });
  return (result as any).insertId as number;
}

/** 블록 내용 수정 */
export async function updatePageBlock(id: number, data: Partial<{
  blockType: string;
  content: string;
  sortOrder: number;
  isVisible: boolean;
}>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error('DB not available');
  await db.update(pageBlocks).set({ ...data, updatedAt: new Date() }).where(eq(pageBlocks.id, id));
}

/** 블록 삭제 */
export async function deletePageBlock(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error('DB not available');
  await db.delete(pageBlocks).where(eq(pageBlocks.id, id));
}

/**
 * 블록 순서 일괄 변경
 * orderedIds: 새 순서대로 정렬된 블록 ID 배열
 * 예: [3, 1, 2] → id=3이 sortOrder=0, id=1이 sortOrder=1, id=2가 sortOrder=2
 */
export async function reorderPageBlocks(orderedIds: number[]): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error('DB not available');
  // 각 블록의 sortOrder를 인덱스 값으로 업데이트
  await Promise.all(
    orderedIds.map((id, index) =>
      db.update(pageBlocks)
        .set({ sortOrder: index, updatedAt: new Date() })
        .where(eq(pageBlocks.id, id))
    )
  );
}

// ─────────────────────────────────────────────
// 유튜브 플레이리스트 & 영상 관리
// ─────────────────────────────────────────────

/** 플레이리스트 전체 목록 */
export async function getAllYoutubePlaylists() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(youtubePlaylists).orderBy(asc(youtubePlaylists.id));
}

/** 플레이리스트 생성 */
export async function createYoutubePlaylist(data: { title: string; description?: string }) {
  const db = await getDb();
  if (!db) throw new Error('DB not available');
  const [result] = await db.insert(youtubePlaylists).values(data);
  return result as { insertId: number };
}

/** 플레이리스트 수정 */
export async function updateYoutubePlaylist(id: number, data: { title?: string; description?: string }) {
  const db = await getDb();
  if (!db) throw new Error('DB not available');
  await db.update(youtubePlaylists).set(data).where(eq(youtubePlaylists.id, id));
}

/** 플레이리스트 삭제 (소속 영상도 함께 삭제) */
export async function deleteYoutubePlaylist(id: number) {
  const db = await getDb();
  if (!db) throw new Error('DB not available');
  await db.delete(youtubeVideos).where(eq(youtubeVideos.playlistId, id));
  await db.delete(youtubePlaylists).where(eq(youtubePlaylists.id, id));
}

/** 특정 플레이리스트의 영상 목록 (정렬순) */
export async function getYoutubeVideosByPlaylist(playlistId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(youtubeVideos)
    .where(eq(youtubeVideos.playlistId, playlistId))
    .orderBy(asc(youtubeVideos.sortOrder));
}

/** 특정 플레이리스트의 공개 영상 목록 (정렬순) */
export async function getVisibleYoutubeVideos(playlistId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(youtubeVideos)
    .where(eq(youtubeVideos.playlistId, playlistId))
    .orderBy(asc(youtubeVideos.sortOrder));
}

/** 유튜브 영상 추가 */
export async function createYoutubeVideo(data: {
  playlistId: number;
  videoId?: string | null;
  videoUrl?: string | null;
  title: string;
  thumbnailUrl?: string;
  description?: string;
  sortOrder?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error('DB not available');
  const [result] = await db.insert(youtubeVideos).values(data);
  return result as { insertId: number };
}

/** 유튜브 영상 수정 */
export async function updateYoutubeVideo(id: number, data: {
  title?: string;
  thumbnailUrl?: string;
  description?: string;
  sortOrder?: number;
  isVisible?: boolean;
}) {
  const db = await getDb();
  if (!db) throw new Error('DB not available');
  await db.update(youtubeVideos).set(data).where(eq(youtubeVideos.id, id));
}

/** 유튜브 영상 삭제 */
export async function deleteYoutubeVideo(id: number) {
  const db = await getDb();
  if (!db) throw new Error('DB not available');
  await db.delete(youtubeVideos).where(eq(youtubeVideos.id, id));
}

/** 유튜브 영상 순서 일괄 업데이트 */
export async function reorderYoutubeVideos(orderedIds: number[]) {
  const db = await getDb();
  if (!db) throw new Error('DB not available');
  await Promise.all(
    orderedIds.map((id, index) =>
      db.update(youtubeVideos)
        .set({ sortOrder: index, updatedAt: new Date() })
        .where(eq(youtubeVideos.id, id))
    )
  );
}

/** href(경로)로 2단 메뉴 항목 조회 (youtube 타입 페이지의 playlistId 연결용) */
export async function getMenuItemByHref(href: string) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(menuItems).where(eq(menuItems.href, href)).limit(1);
  return rows[0] ?? null;
}
/** href(경로)로 3단 메뉴 항목 조회 (youtube 타입 페이지의 playlistId 연결용) */
export async function getMenuSubItemByHref(href: string) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(menuSubItems).where(eq(menuSubItems.href, href)).limit(1);
  return rows[0] ?? null;
}
