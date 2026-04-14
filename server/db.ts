import { eq, asc, desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser, users,
  notices, affiliates, siteSettings,
  heroSlides, galleryItems, quickMenus,
  menus, menuItems, sections,
  InsertNotice, InsertAffiliate, InsertSiteSetting,
  InsertGalleryItem,
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

/** 사이트 설정 저장 (upsert) */
export async function upsertSiteSetting(key: string, value: string) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(siteSettings)
    .values({ settingKey: key, settingValue: value })
    .onDuplicateKeyUpdate({ set: { settingValue: value } });
}
