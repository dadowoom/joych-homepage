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

import { createHash } from "node:crypto";
import { and, eq, asc, desc, inArray, isNull, like, not } from "drizzle-orm";
import {
  heroSlides, galleryAlbums, galleryItems, menuItems, menuSubItems, affiliates, quickMenus, siteSettings,
  InsertAffiliate, InsertGalleryAlbum, InsertGalleryItem,
} from "../../drizzle/schema";
import { getDb } from "./connection";

const STATIC_PAGE_SETTING_PREFIX = "static_page:";
const TRANSLATION_SETTING_PREFIX = "translation:";

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
  buttonsJson?: string | null;
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

/** 모든 히어로 슬라이드를 공통 버튼 설정을 따르도록 전환 */
export async function clearAllHeroSlideCustomButtons() {
  const db = await getDb();
  if (!db) return;
  await db.update(heroSlides).set({ buttonsJson: null });
}

/** 슬라이드 삭제 */
export async function deleteHeroSlide(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(heroSlides).where(eq(heroSlides.id, id));
}

// ─── 갤러리 ──────────────────────────────────────────────────────────────────

/** 홈 화면에 표시할 갤러리 이미지 목록 (isVisible=true) */
const EVENT_GALLERY_HREF = "/page/%EC%BB%A4%EB%AE%A4%EB%8B%88%ED%8B%B0-%EC%B5%9C%EA%B7%BC-%ED%96%89%EC%82%AC-%EC%82%AC%EC%A7%84";

function galleryScopeCondition(galleryScopeKey?: string | null) {
  const normalized = galleryScopeKey?.trim();
  return normalized ? eq(galleryItems.galleryScopeKey, normalized) : undefined;
}

function galleryAlbumCondition(galleryScopeKey: string, albumKey: string) {
  return and(
    eq(galleryAlbums.galleryScopeKey, galleryScopeKey.trim()),
    eq(galleryAlbums.albumKey, albumKey.trim()),
  );
}

function galleryAlbumPhotoCondition(galleryScopeKey: string, albumKey: string) {
  return and(
    eq(galleryItems.galleryScopeKey, galleryScopeKey.trim()),
    eq(galleryItems.albumKey, albumKey.trim()),
    eq(galleryItems.isHomeGallery, false),
  );
}

type GalleryCoverCandidate = {
  id: number;
  isVisible?: boolean | null;
  sortOrder?: number | null;
  createdAt?: Date | string | null;
};

export function chooseGalleryCoverId(
  items: GalleryCoverCandidate[],
  preferredId?: number | null,
) {
  const visibleItems = items
    .filter(item => item.isVisible !== false)
    .sort((left, right) => {
      const sortDiff = Number(left.sortOrder ?? 999) - Number(right.sortOrder ?? 999);
      if (sortDiff !== 0) return sortDiff;
      const leftTime = left.createdAt ? new Date(left.createdAt).getTime() : 0;
      const rightTime = right.createdAt ? new Date(right.createdAt).getTime() : 0;
      if (leftTime !== rightTime) return rightTime - leftTime;
      return left.id - right.id;
    });

  if (preferredId && visibleItems.some(item => item.id === preferredId)) {
    return preferredId;
  }
  return visibleItems[0]?.id ?? null;
}

async function getEventGalleryScopeKey() {
  const db = await getDb();
  if (!db) return null;
  const [items, subItems] = await Promise.all([
    db
      .select({ href: menuItems.href, galleryScopeKey: menuItems.galleryScopeKey })
      .from(menuItems)
      .where(eq(menuItems.pageType, "gallery"))
      .orderBy(asc(menuItems.id)),
    db
      .select({ href: menuSubItems.href, galleryScopeKey: menuSubItems.galleryScopeKey })
      .from(menuSubItems)
      .where(eq(menuSubItems.pageType, "gallery"))
      .orderBy(asc(menuSubItems.id)),
  ]);
  const candidates = [...items, ...subItems];
  return candidates.find(row => row.href === EVENT_GALLERY_HREF)?.galleryScopeKey
    ?? candidates[0]?.galleryScopeKey
    ?? null;
}

export async function getVisibleGalleryItems(galleryScopeKey: string) {
  const db = await getDb();
  const scope = galleryScopeKey.trim();
  if (!db || !scope) return [];
  return db.select().from(galleryItems)
    .where(and(
      eq(galleryItems.isVisible, true),
      eq(galleryItems.isHomeGallery, false),
      eq(galleryItems.galleryScopeKey, scope),
    ))
    .orderBy(desc(galleryItems.albumSortOrder), asc(galleryItems.sortOrder), desc(galleryItems.createdAt));
}

export async function getAllGalleryAlbums(galleryScopeKey: string) {
  const db = await getDb();
  const scope = galleryScopeKey.trim();
  if (!db || !scope) return [];
  return db.select().from(galleryAlbums)
    .where(eq(galleryAlbums.galleryScopeKey, scope))
    .orderBy(desc(galleryAlbums.albumSortOrder), desc(galleryAlbums.createdAt), desc(galleryAlbums.id));
}

export async function getVisibleGalleryAlbums(galleryScopeKey: string) {
  const db = await getDb();
  const scope = galleryScopeKey.trim();
  if (!db || !scope) return [];

  const [albums, photos] = await Promise.all([
    db.select().from(galleryAlbums)
      .where(and(
        eq(galleryAlbums.galleryScopeKey, scope),
        eq(galleryAlbums.isVisible, true),
      ))
      .orderBy(desc(galleryAlbums.albumSortOrder), desc(galleryAlbums.createdAt), desc(galleryAlbums.id)),
    db.select({ albumKey: galleryItems.albumKey }).from(galleryItems)
      .where(and(
        eq(galleryItems.galleryScopeKey, scope),
        eq(galleryItems.isHomeGallery, false),
        eq(galleryItems.isVisible, true),
      )),
  ]);

  const albumKeysWithVisiblePhotos = new Set(
    photos.map(photo => photo.albumKey?.trim()).filter((key): key is string => Boolean(key)),
  );
  return albums.filter(album => albumKeysWithVisiblePhotos.has(album.albumKey));
}

export async function getVisibleHomeGalleryItems() {
  const db = await getDb();
  const eventGalleryScopeKey = await getEventGalleryScopeKey();
  if (!db || !eventGalleryScopeKey) return [];
  const [albums, items] = await Promise.all([
    getVisibleGalleryAlbums(eventGalleryScopeKey),
    db.select().from(galleryItems)
      .where(and(
        eq(galleryItems.isVisible, true),
        eq(galleryItems.isHomeGallery, false),
        eq(galleryItems.galleryScopeKey, eventGalleryScopeKey),
      ))
      .orderBy(desc(galleryItems.albumSortOrder), asc(galleryItems.sortOrder), desc(galleryItems.createdAt)),
  ]);

  const itemsByAlbum = new Map<string, typeof items>();
  for (const item of items) {
    const albumKey = item.albumKey?.trim() || item.albumTitle?.trim() || `single:${item.id}`;
    const albumItems = itemsByAlbum.get(albumKey) ?? [];
    albumItems.push(item);
    itemsByAlbum.set(albumKey, albumItems);
  }

  const homeGalleryItems = albums.flatMap(album => {
    const albumItems = itemsByAlbum.get(album.albumKey) ?? [];
    const coverId = chooseGalleryCoverId(albumItems, album.coverImageId);
    const cover = albumItems.find(item => item.id === coverId);
    return cover ? [cover] : [];
  });

  const knownAlbumKeys = new Set(albums.map(album => album.albumKey));
  for (const [albumKey, albumItems] of Array.from(itemsByAlbum.entries())) {
    if (knownAlbumKeys.has(albumKey)) continue;
    const coverId = chooseGalleryCoverId(albumItems);
    const cover = albumItems.find(item => item.id === coverId);
    if (cover) homeGalleryItems.push(cover);
  }

  return homeGalleryItems.slice(0, 8);
}

/** 갤러리 이미지 수정 */
export async function updateGalleryItem(id: number, data: Partial<InsertGalleryItem>, galleryScopeKey?: string | null) {
  const db = await getDb();
  if (!db) return;
  await db.transaction(async tx => {
    const [current] = await tx.select().from(galleryItems)
      .where(and(eq(galleryItems.id, id), galleryScopeCondition(galleryScopeKey)))
      .limit(1);
    if (!current) return;

    await tx.update(galleryItems).set(data)
      .where(and(eq(galleryItems.id, id), galleryScopeCondition(galleryScopeKey)));

    const scope = current.galleryScopeKey?.trim();
    const albumKey = current.albumKey?.trim();
    if (!scope || !albumKey || current.isHomeGallery) return;

    const [album] = await tx.select().from(galleryAlbums)
      .where(galleryAlbumCondition(scope, albumKey))
      .limit(1);
    if (!album) return;

    const updatedIsVisible = data.isVisible ?? current.isVisible;
    if (album.coverImageId !== id || updatedIsVisible !== false) return;

    const candidates = await tx.select({
      id: galleryItems.id,
      isVisible: galleryItems.isVisible,
      sortOrder: galleryItems.sortOrder,
      createdAt: galleryItems.createdAt,
    }).from(galleryItems)
      .where(galleryAlbumPhotoCondition(scope, albumKey));
    await tx.update(galleryAlbums)
      .set({ coverImageId: chooseGalleryCoverId(candidates) })
      .where(galleryAlbumCondition(scope, albumKey));
  });
}

/** 갤러리 앨범 공통 정보 수정 */
export async function updateGalleryAlbumItems(ids: number[], data: Partial<InsertGalleryItem>, galleryScopeKey?: string | null) {
  const db = await getDb();
  if (!db || ids.length === 0) return;
  await db.transaction(async tx => {
    const affectedItems = await tx.select().from(galleryItems)
      .where(and(inArray(galleryItems.id, ids), galleryScopeCondition(galleryScopeKey)));
    await tx.update(galleryItems).set(data)
      .where(and(inArray(galleryItems.id, ids), galleryScopeCondition(galleryScopeKey)));

    const albumPairs = new Map<string, { scope: string; albumKey: string }>();
    for (const item of affectedItems) {
      const scope = item.galleryScopeKey?.trim();
      const albumKey = item.albumKey?.trim();
      if (scope && albumKey && !item.isHomeGallery) {
        albumPairs.set(`${scope}\u0000${albumKey}`, { scope, albumKey });
      }
    }

    for (const { scope, albumKey } of Array.from(albumPairs.values())) {
      const albumData: Partial<InsertGalleryAlbum> = {};
      if (data.albumTitle !== undefined) albumData.title = data.albumTitle || "최근 행사 사진";
      if (data.albumDescription !== undefined) albumData.description = data.albumDescription;
      if (data.albumSortOrder !== undefined) albumData.albumSortOrder = data.albumSortOrder;
      if (data.isVisible !== undefined) albumData.isVisible = data.isVisible;
      if (data.createdAt !== undefined) albumData.createdAt = data.createdAt;
      if (Object.keys(albumData).length > 0) {
        await tx.update(galleryAlbums).set(albumData)
          .where(galleryAlbumCondition(scope, albumKey));
      }
    }
  });
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

export async function reorderGalleryItems(items: { id: number; sortOrder: number }[], galleryScopeKey?: string | null) {
  const db = await getDb();
  if (!db) return;
  await Promise.all(
    items.map(item =>
      db.update(galleryItems).set({ sortOrder: item.sortOrder }).where(and(eq(galleryItems.id, item.id), galleryScopeCondition(galleryScopeKey)))
    )
  );
}

export async function reorderGalleryAlbums(items: { albumKey?: string | null; albumTitle?: string | null; albumSortOrder: number }[], galleryScopeKey?: string | null) {
  const db = await getDb();
  if (!db) return;
  await db.transaction(async tx => {
    await Promise.all(items.map(async item => {
      if (item.albumKey) {
        await tx.update(galleryItems)
          .set({ albumSortOrder: item.albumSortOrder })
          .where(and(eq(galleryItems.albumKey, item.albumKey), galleryScopeCondition(galleryScopeKey)));
        if (galleryScopeKey?.trim()) {
          await tx.update(galleryAlbums)
            .set({ albumSortOrder: item.albumSortOrder })
            .where(galleryAlbumCondition(galleryScopeKey, item.albumKey));
        }
        return;
      }

      if (item.albumTitle) {
        await tx.update(galleryItems)
          .set({ albumSortOrder: item.albumSortOrder })
          .where(and(isNull(galleryItems.albumKey), eq(galleryItems.albumTitle, item.albumTitle), galleryScopeCondition(galleryScopeKey)));
        return;
      }
    }));
  });
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
  const rows = await db.select().from(siteSettings)
    .where(and(
      not(like(siteSettings.settingKey, `${STATIC_PAGE_SETTING_PREFIX}%`)),
      not(like(siteSettings.settingKey, `${TRANSLATION_SETTING_PREFIX}%`)),
    ));
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

/** 여러 사이트 설정을 하나의 트랜잭션으로 저장 */
export async function upsertSiteSettings(
  entries: ReadonlyArray<{ key: string; value: string }>,
) {
  const db = await getDb();
  if (!db) return;
  await db.transaction(async (tx) => {
    for (const entry of entries) {
      await tx.insert(siteSettings)
        .values({ settingKey: entry.key, settingValue: entry.value })
        .onDuplicateKeyUpdate({ set: { settingValue: entry.value } });
    }
  });
}

export function getStaticPageSettingKey(href: string) {
  return `${STATIC_PAGE_SETTING_PREFIX}${href}`;
}

export async function getStaticPageContentByHref(href: string): Promise<unknown | null> {
  const row = await getSiteSetting(getStaticPageSettingKey(href));
  if (!row?.settingValue) return null;
  try {
    return JSON.parse(row.settingValue);
  } catch {
    return null;
  }
}

export async function getAllStaticPageContents() {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select().from(siteSettings)
    .where(like(siteSettings.settingKey, `${STATIC_PAGE_SETTING_PREFIX}%`))
    .orderBy(asc(siteSettings.settingKey));

  return rows.map((row) => ({
    href: row.settingKey.slice(STATIC_PAGE_SETTING_PREFIX.length),
    content: row.settingValue ?? "",
    updatedAt: row.updatedAt,
  }));
}

export async function upsertStaticPageContent(href: string, content: unknown) {
  const db = await getDb();
  if (!db) return;
  const serialized = JSON.stringify(content);
  await db.insert(siteSettings)
    .values({
      settingKey: getStaticPageSettingKey(href),
      settingValue: serialized,
      description: `정적 페이지 CMS 콘텐츠: ${href}`,
    })
    .onDuplicateKeyUpdate({
      set: {
        settingValue: serialized,
        description: `정적 페이지 CMS 콘텐츠: ${href}`,
      },
    });
}

export function getTranslationSettingKey(locale: string, scope: string, resourceId: string) {
  const digest = createHash("sha256").update(resourceId).digest("hex").slice(0, 20);
  return `${TRANSLATION_SETTING_PREFIX}${locale}:${scope}:${digest}`;
}

export async function getStoredTranslation(locale: string, scope: string, resourceId: string) {
  const row = await getSiteSetting(getTranslationSettingKey(locale, scope, resourceId));
  if (!row?.settingValue) return null;
  try {
    return {
      locale,
      scope,
      resourceId,
      content: JSON.parse(row.settingValue) as unknown,
      updatedAt: row.updatedAt,
    };
  } catch {
    return null;
  }
}

export async function upsertStoredTranslation(locale: string, scope: string, resourceId: string, content: unknown) {
  const db = await getDb();
  if (!db) return;
  const key = getTranslationSettingKey(locale, scope, resourceId);
  const serialized = JSON.stringify(content);
  await db.insert(siteSettings)
    .values({
      settingKey: key,
      settingValue: serialized,
      description: `번역 콘텐츠: ${locale}/${scope}/${resourceId}`,
    })
    .onDuplicateKeyUpdate({
      set: {
        settingValue: serialized,
        description: `번역 콘텐츠: ${locale}/${scope}/${resourceId}`,
      },
    });
}

// ─── 퀵메뉴 추가/삭제 ────────────────────────────────────────────────────────
/** 퀵메뉴 새 항목 추가 */
export async function createQuickMenu(data: { icon: string; label: string; href?: string; sortOrder?: number }) {
  const db = await getDb();
  if (!db) return;
  await db.insert(quickMenus).values({
    icon: data.icon,
    label: data.label,
    href: data.href ?? null,
    sortOrder: data.sortOrder ?? 999,
    isVisible: true,
  });
}
/** 퀵메뉴 삭제 */
export async function deleteQuickMenu(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(quickMenus).where(eq(quickMenus.id, id));
}

// ─── 관련기관 추가/삭제 ───────────────────────────────────────────────────────
/** 관련기관 새 항목 추가 */
export async function createAffiliate(data: { icon: string; label: string; href?: string; sortOrder?: number }) {
  const db = await getDb();
  if (!db) return;
  await db.insert(affiliates).values({
    icon: data.icon,
    label: data.label,
    href: data.href ?? null,
    sortOrder: data.sortOrder ?? 999,
    isVisible: true,
  });
}
/** 관련기관 삭제 */
export async function deleteAffiliate(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(affiliates).where(eq(affiliates.id, id));
}

// ─── 갤러리 추가/삭제 ────────────────────────────────────────────────────────
/** 갤러리 전체 목록 (관리자용, 숨김 포함) */
export async function getAllGalleryItems(galleryScopeKey?: string | null) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(galleryItems)
    .where(and(eq(galleryItems.isHomeGallery, false), galleryScopeCondition(galleryScopeKey)))
    .orderBy(desc(galleryItems.albumSortOrder), asc(galleryItems.sortOrder), desc(galleryItems.createdAt));
}
/** 갤러리 새 항목 추가 */
export async function getAllHomeGalleryItems() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(galleryItems)
    .where(eq(galleryItems.isHomeGallery, true))
    .orderBy(asc(galleryItems.sortOrder), desc(galleryItems.createdAt));
}

export async function createGalleryAlbumRecord(data: {
  galleryScopeKey: string;
  albumKey: string;
  title: string;
  description?: string;
  albumSortOrder?: number;
  isVisible?: boolean;
  createdAt?: Date;
}) {
  const db = await getDb();
  if (!db) return null;
  const scope = data.galleryScopeKey.trim();
  const albumKey = data.albumKey.trim();
  const [result] = await db.insert(galleryAlbums).values({
    galleryScopeKey: scope,
    albumKey,
    title: data.title.trim(),
    description: data.description?.trim() || null,
    albumSortOrder: data.albumSortOrder ?? Math.floor(Date.now() / 1000),
    isVisible: data.isVisible ?? true,
    ...(data.createdAt ? { createdAt: data.createdAt } : {}),
  }).$returningId();
  return result?.id ?? null;
}

export async function updateGalleryAlbumRecord(data: {
  galleryScopeKey: string;
  albumKey: string;
  title?: string;
  description?: string;
  isVisible?: boolean;
  createdAt?: Date;
}) {
  const db = await getDb();
  if (!db) return false;
  const scope = data.galleryScopeKey.trim();
  const albumKey = data.albumKey.trim();

  return db.transaction(async tx => {
    const [album] = await tx.select().from(galleryAlbums)
      .where(galleryAlbumCondition(scope, albumKey))
      .limit(1);
    if (!album) return false;

    const albumData: Partial<InsertGalleryAlbum> = {};
    const legacyData: Partial<InsertGalleryItem> = {};
    if (data.title !== undefined) {
      albumData.title = data.title.trim();
      legacyData.albumTitle = data.title.trim();
    }
    if (data.description !== undefined) {
      albumData.description = data.description.trim() || null;
      legacyData.albumDescription = data.description.trim() || null;
    }
    if (data.isVisible !== undefined) {
      albumData.isVisible = data.isVisible;
      legacyData.isVisible = data.isVisible;
    }
    if (data.createdAt !== undefined) {
      albumData.createdAt = data.createdAt;
      legacyData.createdAt = data.createdAt;
    }

    if (Object.keys(albumData).length > 0) {
      await tx.update(galleryAlbums).set(albumData)
        .where(galleryAlbumCondition(scope, albumKey));
    }
    if (Object.keys(legacyData).length > 0) {
      await tx.update(galleryItems).set(legacyData)
        .where(galleryAlbumPhotoCondition(scope, albumKey));
    }
    return true;
  });
}

export async function deleteGalleryAlbumRecord(galleryScopeKey: string, albumKey: string) {
  const db = await getDb();
  if (!db) return false;
  const scope = galleryScopeKey.trim();
  const key = albumKey.trim();

  return db.transaction(async tx => {
    const [album] = await tx.select({ id: galleryAlbums.id }).from(galleryAlbums)
      .where(galleryAlbumCondition(scope, key))
      .limit(1);
    if (!album) return false;
    await tx.delete(galleryItems).where(galleryAlbumPhotoCondition(scope, key));
    await tx.delete(galleryAlbums).where(galleryAlbumCondition(scope, key));
    return true;
  });
}

export async function setGalleryAlbumCover(
  galleryScopeKey: string,
  albumKey: string,
  photoId: number,
) {
  const db = await getDb();
  if (!db) return false;
  const scope = galleryScopeKey.trim();
  const key = albumKey.trim();

  return db.transaction(async tx => {
    const [album] = await tx.select({ id: galleryAlbums.id }).from(galleryAlbums)
      .where(galleryAlbumCondition(scope, key))
      .limit(1);
    if (!album) return false;

    const [photo] = await tx.select({
      id: galleryItems.id,
      isVisible: galleryItems.isVisible,
    }).from(galleryItems)
      .where(and(
        galleryAlbumPhotoCondition(scope, key),
        eq(galleryItems.id, photoId),
      ))
      .limit(1);
    if (!photo || photo.isVisible === false) return false;

    await tx.update(galleryAlbums).set({ coverImageId: photo.id })
      .where(galleryAlbumCondition(scope, key));
    return true;
  });
}

export type CreateGalleryAlbumPhotoInput = {
  imageUrl: string;
  caption?: string;
  gridSpan?: string;
  sortOrder?: number;
};

export async function createGalleryItemsForAlbum(
  galleryScopeKey: string,
  albumKey: string,
  items: CreateGalleryAlbumPhotoInput[],
) {
  const db = await getDb();
  if (!db || items.length === 0) return [];
  const scope = galleryScopeKey.trim();
  const key = albumKey.trim();

  return db.transaction(async tx => {
    const [album] = await tx.select().from(galleryAlbums)
      .where(galleryAlbumCondition(scope, key))
      .limit(1);
    if (!album) return [];

    const existingSortOrders = await tx.select({ sortOrder: galleryItems.sortOrder })
      .from(galleryItems)
      .where(galleryAlbumPhotoCondition(scope, key));
    const nextDefaultSortOrder = existingSortOrders.reduce(
      (highest, item) => Math.max(highest, item.sortOrder ?? 0),
      0,
    );

    const insertedIds: number[] = [];
    for (let index = 0; index < items.length; index += 1) {
      const item = items[index];
      const [result] = await tx.insert(galleryItems).values({
        imageUrl: item.imageUrl,
        galleryScopeKey: scope,
        albumKey: key,
        albumTitle: album.title,
        albumDescription: album.description,
        albumSortOrder: album.albumSortOrder,
        caption: item.caption?.trim() || null,
        gridSpan: item.gridSpan ?? "col-span-1 row-span-1",
        sortOrder: item.sortOrder ?? nextDefaultSortOrder + index + 1,
        isVisible: album.isVisible,
        isHomeGallery: false,
        createdAt: album.createdAt,
      }).$returningId();
      if (result?.id) insertedIds.push(result.id);
    }

    if (!album.coverImageId && insertedIds.length > 0) {
      const candidates = await tx.select({
        id: galleryItems.id,
        isVisible: galleryItems.isVisible,
        sortOrder: galleryItems.sortOrder,
        createdAt: galleryItems.createdAt,
      }).from(galleryItems)
        .where(galleryAlbumPhotoCondition(scope, key));
      await tx.update(galleryAlbums)
        .set({ coverImageId: chooseGalleryCoverId(candidates) })
        .where(galleryAlbumCondition(scope, key));
    }
    return insertedIds;
  });
}

export async function reorderGalleryAlbumRecords(
  galleryScopeKey: string,
  items: { albumKey: string; albumSortOrder: number }[],
) {
  const db = await getDb();
  if (!db) return;
  const scope = galleryScopeKey.trim();
  await db.transaction(async tx => {
    for (const item of items) {
      const albumKey = item.albumKey.trim();
      await tx.update(galleryAlbums)
        .set({ albumSortOrder: item.albumSortOrder })
        .where(galleryAlbumCondition(scope, albumKey));
      await tx.update(galleryItems)
        .set({ albumSortOrder: item.albumSortOrder })
        .where(galleryAlbumPhotoCondition(scope, albumKey));
    }
  });
}

export async function createGalleryItem(data: { imageUrl: string; galleryScopeKey?: string; albumKey?: string; albumTitle?: string; albumDescription?: string; albumSortOrder?: number; caption?: string; gridSpan?: string; sortOrder?: number; isHomeGallery?: boolean; createdAt?: Date }) {
  const db = await getDb();
  if (!db) return;
  const scope = data.galleryScopeKey?.trim() || null;
  const albumKey = data.albumKey?.trim() || null;
  const albumSortOrder = data.albumSortOrder ?? Math.floor(Date.now() / 1000);
  await db.transaction(async tx => {
    if (!data.isHomeGallery && scope && albumKey) {
      await tx.insert(galleryAlbums).values({
        galleryScopeKey: scope,
        albumKey,
        title: data.albumTitle?.trim() || "최근 행사 사진",
        description: data.albumDescription?.trim() || null,
        albumSortOrder,
        isVisible: true,
        ...(data.createdAt ? { createdAt: data.createdAt } : {}),
      }).onDuplicateKeyUpdate({
        set: {
          title: data.albumTitle?.trim() || "최근 행사 사진",
          description: data.albumDescription?.trim() || null,
          albumSortOrder,
          ...(data.createdAt ? { createdAt: data.createdAt } : {}),
        },
      });
    }

    const [result] = await tx.insert(galleryItems).values({
      imageUrl: data.imageUrl,
      galleryScopeKey: scope,
      albumKey,
      albumTitle: data.albumTitle ?? null,
      albumDescription: data.albumDescription ?? null,
      albumSortOrder,
      caption: data.caption ?? null,
      gridSpan: data.gridSpan ?? "col-span-1 row-span-1",
      sortOrder: data.sortOrder ?? 999,
      isVisible: true,
      isHomeGallery: data.isHomeGallery ?? false,
      ...(data.createdAt ? { createdAt: data.createdAt } : {}),
    }).$returningId();

    if (!data.isHomeGallery && scope && albumKey && result?.id) {
      const [album] = await tx.select({ coverImageId: galleryAlbums.coverImageId })
        .from(galleryAlbums)
        .where(galleryAlbumCondition(scope, albumKey))
        .limit(1);
      if (album && !album.coverImageId) {
        await tx.update(galleryAlbums).set({ coverImageId: result.id })
          .where(galleryAlbumCondition(scope, albumKey));
      }
    }
  });
}
/** 갤러리 항목 삭제 */
export async function deleteGalleryItem(id: number, galleryScopeKey?: string | null) {
  const db = await getDb();
  if (!db) return;
  await db.transaction(async tx => {
    const [item] = await tx.select().from(galleryItems)
      .where(and(eq(galleryItems.id, id), galleryScopeCondition(galleryScopeKey)))
      .limit(1);
    if (!item) return;

    const scope = item.galleryScopeKey?.trim();
    const albumKey = item.albumKey?.trim();
    const [album] = scope && albumKey && !item.isHomeGallery
      ? await tx.select({ coverImageId: galleryAlbums.coverImageId })
        .from(galleryAlbums)
        .where(galleryAlbumCondition(scope, albumKey))
        .limit(1)
      : [];

    await tx.delete(galleryItems)
      .where(and(eq(galleryItems.id, id), galleryScopeCondition(galleryScopeKey)));

    if (!scope || !albumKey || item.isHomeGallery) return;
    if (album?.coverImageId !== id) return;
    const candidates = await tx.select({
      id: galleryItems.id,
      isVisible: galleryItems.isVisible,
      sortOrder: galleryItems.sortOrder,
      createdAt: galleryItems.createdAt,
    }).from(galleryItems)
      .where(galleryAlbumPhotoCondition(scope, albumKey));
    const fallbackCoverId = chooseGalleryCoverId(candidates);
    await tx.update(galleryAlbums)
      .set({ coverImageId: fallbackCoverId })
      .where(galleryAlbumCondition(scope, albumKey));
  });
}

/** Delete every photo that belongs to one gallery album/post. */
export async function deleteGalleryItems(ids: number[], galleryScopeKey?: string | null) {
  const db = await getDb();
  if (!db || ids.length === 0) return;
  await db.transaction(async tx => {
    const affectedItems = await tx.select().from(galleryItems)
      .where(and(inArray(galleryItems.id, ids), galleryScopeCondition(galleryScopeKey)));
    await tx.delete(galleryItems)
      .where(and(inArray(galleryItems.id, ids), galleryScopeCondition(galleryScopeKey)));

    const albumPairs = new Map<string, { scope: string; albumKey: string }>();
    for (const item of affectedItems) {
      const scope = item.galleryScopeKey?.trim();
      const albumKey = item.albumKey?.trim();
      if (scope && albumKey && !item.isHomeGallery) {
        albumPairs.set(`${scope}\u0000${albumKey}`, { scope, albumKey });
      }
    }

    for (const { scope, albumKey } of Array.from(albumPairs.values())) {
      const remaining = await tx.select({
        id: galleryItems.id,
        isVisible: galleryItems.isVisible,
        sortOrder: galleryItems.sortOrder,
        createdAt: galleryItems.createdAt,
      }).from(galleryItems)
        .where(galleryAlbumPhotoCondition(scope, albumKey));
      if (remaining.length === 0) {
        await tx.delete(galleryAlbums).where(galleryAlbumCondition(scope, albumKey));
      } else {
        const [album] = await tx.select({ coverImageId: galleryAlbums.coverImageId })
          .from(galleryAlbums)
          .where(galleryAlbumCondition(scope, albumKey))
          .limit(1);
        await tx.update(galleryAlbums)
          .set({ coverImageId: chooseGalleryCoverId(remaining, album?.coverImageId) })
          .where(galleryAlbumCondition(scope, albumKey));
      }
    }
  });
}
