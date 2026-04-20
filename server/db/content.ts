/**
 * 콘텐츠 DB 함수 (server/db/content.ts)
 * ─────────────────────────────────────────────────────────────────────────────
 * 담당 기능:
 *   - 히어로 슬라이드: getVisibleHeroSlides, getAllHeroSlides, createHeroSlide, updateHeroSlide, deleteHeroSlide
 *   - 갤러리: getVisibleGalleryItems, updateGalleryItem
 *   - 관련기관(Affiliates): getVisibleAffiliates, getAllAffiliates, updateAffiliate
 *   - 퀵메뉴: getVisibleQuickMenus, getAllQuickMenus, updateQuickMenu, reorderQuickMenus
 *   - 사이트 설정: getSiteSettings, getSiteSetting, upsertSiteSetting
 */

import { eq, asc } from "drizzle-orm";
import {
  heroSlides, galleryItems, affiliates, quickMenus, siteSettings,
  InsertAffiliate, InsertGalleryItem,
} from "../../drizzle/schema";
import { getDb } from "./connection";

// ─── 히어로 슬라이드 ─────────────────────────────────────────────────────────

/** 홈 화면에 표시할 슬라이드 목록 (isVisible=true, 정렬순) */
export async function getVisibleHeroSlides() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(heroSlides)
    .where(eq(heroSlides.isVisible, true))
    .orderBy(asc(heroSlides.sortOrder));
}

/** 관리자용 전체 슬라이드 목록 */
export async function getAllHeroSlides() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(heroSlides).orderBy(asc(heroSlides.sortOrder));
}

/** 슬라이드 생성 */
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
  sortOrder?: number;
  isVisible?: boolean;
}) {
  const db = await getDb();
  if (!db) return;
  await db.insert(heroSlides).values({
    ...data,
    sortOrder: data.sortOrder ?? 0,
    isVisible: data.isVisible ?? true,
  });
}

/** 슬라이드 수정 */
export async function updateHeroSlide(id: number, data: Partial<typeof heroSlides.$inferInsert>) {
  const db = await getDb();
  if (!db) return;
  await db.update(heroSlides).set(data).where(eq(heroSlides.id, id));
}

/** 슬라이드 삭제 */
export async function deleteHeroSlide(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(heroSlides).where(eq(heroSlides.id, id));
}

// ─── 갤러리 ──────────────────────────────────────────────────────────────────

/** 홈 화면에 표시할 갤러리 이미지 목록 (isVisible=true) */
export async function getVisibleGalleryItems() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(galleryItems)
    .where(eq(galleryItems.isVisible, true))
    .orderBy(asc(galleryItems.sortOrder));
}

/** 갤러리 이미지 수정 */
export async function updateGalleryItem(id: number, data: Partial<InsertGalleryItem>) {
  const db = await getDb();
  if (!db) return;
  await db.update(galleryItems).set(data).where(eq(galleryItems.id, id));
}

// ─── 관련기관 (Affiliates) ────────────────────────────────────────────────────

/** 홈 화면에 표시할 관련기관 목록 (isVisible=true) */
export async function getVisibleAffiliates() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(affiliates)
    .where(eq(affiliates.isVisible, true))
    .orderBy(asc(affiliates.sortOrder));
}

/** 관리자용 전체 관련기관 목록 */
export async function getAllAffiliates() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(affiliates).orderBy(asc(affiliates.sortOrder));
}

/** 관련기관 수정 */
export async function updateAffiliate(id: number, data: Partial<InsertAffiliate>) {
  const db = await getDb();
  if (!db) return;
  await db.update(affiliates).set(data).where(eq(affiliates.id, id));
}

// ─── 퀵메뉴 ──────────────────────────────────────────────────────────────────

/** 홈 화면에 표시할 퀵메뉴 목록 (isVisible=true) */
export async function getVisibleQuickMenus() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(quickMenus)
    .where(eq(quickMenus.isVisible, true))
    .orderBy(asc(quickMenus.sortOrder));
}

/** 관리자용 전체 퀵메뉴 목록 */
export async function getAllQuickMenus() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(quickMenus).orderBy(asc(quickMenus.sortOrder));
}

/** 퀵메뉴 수정 */
export async function updateQuickMenu(id: number, data: Partial<typeof quickMenus.$inferInsert>) {
  const db = await getDb();
  if (!db) return;
  await db.update(quickMenus).set(data).where(eq(quickMenus.id, id));
}

/** 퀵메뉴 순서 일괄 변경 */
export async function reorderQuickMenus(items: { id: number; sortOrder: number }[]) {
  const db = await getDb();
  if (!db) return;
  await Promise.all(
    items.map(item =>
      db.update(quickMenus).set({ sortOrder: item.sortOrder }).where(eq(quickMenus.id, item.id))
    )
  );
}

// ─── 사이트 설정 ──────────────────────────────────────────────────────────────

/**
 * 전체 사이트 설정 조회
 * - key-value 객체 형태로 반환합니다.
 * - 예: { address: '경북 포항시...', tel: '054-270-1000', ... }
 */
export async function getSiteSettings(): Promise<Record<string, string>> {
  const db = await getDb();
  if (!db) return {} as Record<string, string>;
  const rows = await db.select().from(siteSettings);
  return Object.fromEntries(rows.map(r => [r.settingKey, r.settingValue ?? ""]));
}

/** 특정 키의 사이트 설정 조회 */
export async function getSiteSetting(key: string) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(siteSettings).where(eq(siteSettings.settingKey, key)).limit(1);
  return rows[0] ?? null;
}

/** 사이트 설정 저장 (없으면 생성, 있으면 수정) */
export async function upsertSiteSetting(key: string, value: string) {
  const db = await getDb();
  if (!db) return;
  await db.insert(siteSettings)
    .values({ settingKey: key, settingValue: value })
    .onDuplicateKeyUpdate({ set: { settingValue: value } });
}
