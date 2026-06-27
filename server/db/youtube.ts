/**
 * 예배영상(유튜브) DB 함수 (server/db/youtube.ts)
 * ─────────────────────────────────────────────────────────────────────────────
 * 담당 기능:
 *   - 플레이리스트 CRUD: getAllYoutubePlaylists, createYoutubePlaylist,
 *                       updateYoutubePlaylist, deleteYoutubePlaylist
 *   - 영상 CRUD: getYoutubeVideosByPlaylist, getVisibleYoutubeVideos,
 *               createYoutubeVideo, updateYoutubeVideo, deleteYoutubeVideo,
 *               reorderYoutubeVideos
 *   - 메뉴 자동 연결: syncPlaylistToMenu, syncAllPlaylistsToMenus
 */

import { and, asc, desc, eq, gte } from "drizzle-orm";
import { youtubePlaylists, youtubeVideos, menus, menuItems, menuSubItems } from "../../drizzle/schema";
import { makeUniqueMenuPageHref, type MenuHrefCandidate } from "../_core/menuHref";
import { getDb } from "./connection";

const JOYFUL_TV_MENU_LABEL = "조이풀TV";
const CHOIR_PLAYLIST_IDS = new Set<number>([
  90007,
  90008,
  90009,
]);
const YOUTUBE_PUBLIC_MIN_SERMON_DATE = "2010-01-01";

function isChoirPlaylist(playlistId: number) {
  return CHOIR_PLAYLIST_IDS.has(playlistId);
}

function getYoutubeVideoOrderBy(playlistId: number) {
  if (isChoirPlaylist(playlistId)) {
    return [desc(youtubeVideos.sermonDate), desc(youtubeVideos.id)];
  }
  return [asc(youtubeVideos.sortOrder), asc(youtubeVideos.id)];
}

function getVisibleChoirVideoConditions(playlistId: number) {
  if (!isChoirPlaylist(playlistId)) {
    return [];
  }
  return [gte(youtubeVideos.sermonDate, YOUTUBE_PUBLIC_MIN_SERMON_DATE)];
}

function normalizeMenuLabel(label: string) {
  return label.replace(/\s+/g, "").toLowerCase();
}

function isJoyfulTvMenuLabel(label: string) {
  const normalized = normalizeMenuLabel(label);
  return normalized === "조이풀tv" || normalized === "조이풀티비";
}

function collectMenuHrefCandidates(
  menuList: Array<{ href?: string | null }>,
  itemList: Array<{ href?: string | null }>,
  subItemList: Array<{ href?: string | null }>,
): MenuHrefCandidate[] {
  return [
    ...menuList.map(menu => ({ href: menu.href })),
    ...itemList.map(item => ({ href: item.href })),
    ...subItemList.map(subItem => ({ href: subItem.href })),
  ];
}

// ─── 플레이리스트 CRUD ────────────────────────────────────────────────────────

/** 플레이리스트 전체 목록 조회 */
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

// ─── 영상 CRUD ────────────────────────────────────────────────────────────────

/** 특정 플레이리스트의 영상 목록 (정렬순, 관리자용) */
export async function getYoutubeVideosByPlaylist(playlistId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(youtubeVideos)
    .where(eq(youtubeVideos.playlistId, playlistId))
    .orderBy(...getYoutubeVideoOrderBy(playlistId));
}

/** 특정 플레이리스트의 공개 영상 목록 (정렬순, 일반 사용자용) */
export async function getVisibleYoutubeVideos(playlistId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(youtubeVideos)
    .where(and(
      eq(youtubeVideos.playlistId, playlistId),
      eq(youtubeVideos.isVisible, true),
      ...getVisibleChoirVideoConditions(playlistId),
    ))
    .orderBy(...getYoutubeVideoOrderBy(playlistId));
}

/** 유튜브 영상 추가 */
export async function createYoutubeVideo(data: {
  playlistId: number;
  videoId?: string | null;
  videoUrl?: string | null;
  title: string;
  preacher?: string | null;
  scripture?: string | null;
  sermonDate?: string | null;
  thumbnailUrl?: string | null;
  description?: string | null;
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
  preacher?: string | null;
  scripture?: string | null;
  sermonDate?: string | null;
  thumbnailUrl?: string | null;
  description?: string | null;
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

// ─── 메뉴 자동 연결 ───────────────────────────────────────────────────────────

/**
 * 플레이리스트 이름과 메뉴에 playlistId 자동 연결
 * - 2단 메뉴(menuItems)와 3단 메뉴(menuSubItems) 모두 검색
 * - 이름이 같은 메뉴가 있으면 해당 메뉴의 playlistId를 업데이트
 * - 조이풀TV 아래에 동일 이름 메뉴가 없으면 2단 메뉴를 자동 생성
 */
export async function syncPlaylistToMenu(playlistId: number, title: string) {
  const db = await getDb();
  if (!db) return { createdMenuItem: false, updatedMenuItems: 0, updatedMenuSubItems: 0 };

  const [menuList, itemList, subItemList] = await Promise.all([
    db.select().from(menus).orderBy(asc(menus.sortOrder)),
    db.select().from(menuItems).orderBy(asc(menuItems.sortOrder)),
    db.select().from(menuSubItems).orderBy(asc(menuSubItems.sortOrder)),
  ]);

  let joyfulTvMenu = menuList.find(menu => isJoyfulTvMenuLabel(menu.label));
  if (!joyfulTvMenu) {
    const maxMenuSortOrder = menuList.reduce((max, menu) => Math.max(max, menu.sortOrder), 0);
    const [createdMenu] = await db.insert(menus).values({
      label: JOYFUL_TV_MENU_LABEL,
      href: null,
      sortOrder: maxMenuSortOrder + 1,
      isVisible: true,
    }).$returningId();
    if (createdMenu?.id) {
      joyfulTvMenu = {
        id: createdMenu.id,
        label: JOYFUL_TV_MENU_LABEL,
        href: null,
        sortOrder: maxMenuSortOrder + 1,
        isVisible: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      menuList.push(joyfulTvMenu);
    }
  }

  let updatedMenuItems = 0;
  let updatedMenuSubItems = 0;
  const joyfulItemIds = new Set(itemList
    .filter(item => joyfulTvMenu && item.menuId === joyfulTvMenu.id)
    .map(item => item.id));

  // 2단 메뉴에서 동일 이름 검색 후 연결
  const matchingItems = itemList.filter(item => item.label === title);
  const joyfulTvMatchingItems = matchingItems.filter(item =>
    joyfulTvMenu && item.menuId === joyfulTvMenu.id
  );
  const canonicalJoyfulTvItem =
    joyfulTvMatchingItems.find(item => item.href?.startsWith("/page/")) ??
    joyfulTvMatchingItems[0];
  const canonicalJoyfulTvSortOrder = joyfulTvMatchingItems.reduce(
    (min, item) => Math.min(min, item.sortOrder),
    canonicalJoyfulTvItem?.sortOrder ?? 0,
  );

  for (const item of matchingItems) {
    const isJoyfulTvItem = Boolean(joyfulTvMenu && item.menuId === joyfulTvMenu.id);
    const isDuplicateJoyfulTvItem =
      isJoyfulTvItem &&
      joyfulTvMatchingItems.length > 1 &&
      canonicalJoyfulTvItem &&
      item.id !== canonicalJoyfulTvItem.id;
    const isCanonicalJoyfulTvItem =
      isJoyfulTvItem &&
      joyfulTvMatchingItems.length > 1 &&
      canonicalJoyfulTvItem &&
      item.id === canonicalJoyfulTvItem.id;
    await db.update(menuItems)
      .set(isJoyfulTvItem
        ? {
            playlistId,
            pageType: "youtube",
            isVisible: !isDuplicateJoyfulTvItem,
            ...(isCanonicalJoyfulTvItem ? { sortOrder: canonicalJoyfulTvSortOrder } : {}),
          }
        : { playlistId })
      .where(eq(menuItems.id, item.id));
    updatedMenuItems += 1;
  }

  // 3단 메뉴에서 동일 이름 검색 후 연결
  const matchingSubItems = subItemList.filter(sub => sub.label === title);
  for (const sub of matchingSubItems) {
    const isJoyfulTvSubItem = joyfulItemIds.has(sub.menuItemId);
    await db.update(menuSubItems)
      .set(isJoyfulTvSubItem
        ? { playlistId, pageType: "youtube", isVisible: true }
        : { playlistId })
      .where(eq(menuSubItems.id, sub.id));
    updatedMenuSubItems += 1;
  }

  if (!joyfulTvMenu) {
    return { createdMenuItem: false, updatedMenuItems, updatedMenuSubItems };
  }

  const hasJoyfulTvMenuEntry =
    matchingItems.some(item => item.menuId === joyfulTvMenu.id) ||
    matchingSubItems.some(sub => joyfulItemIds.has(sub.menuItemId));

  if (hasJoyfulTvMenuEntry) {
    return { createdMenuItem: false, updatedMenuItems, updatedMenuSubItems };
  }

  const maxItemSortOrder = itemList
    .filter(item => item.menuId === joyfulTvMenu.id)
    .reduce((max, item) => Math.max(max, item.sortOrder), 0);
  const href = makeUniqueMenuPageHref(
    [JOYFUL_TV_MENU_LABEL, title],
    collectMenuHrefCandidates(menuList, itemList, subItemList),
  );
  await db.insert(menuItems).values({
    menuId: joyfulTvMenu.id,
    label: title,
    href,
    sortOrder: maxItemSortOrder + 1,
    isVisible: true,
    pageType: "youtube",
    playlistId,
  });

  return { createdMenuItem: true, updatedMenuItems, updatedMenuSubItems };
}

/**
 * 모든 플레이리스트를 순회하며 동일 이름의 메뉴에 playlistId 일괄 연결
 * - 관리자 대시보드 "메뉴 자동 연결" 버튼에서 호출
 */
export async function syncAllPlaylistsToMenus() {
  const playlists = await getAllYoutubePlaylists();
  let createdMenuItems = 0;
  let updatedMenuItems = 0;
  let updatedMenuSubItems = 0;

  for (const pl of playlists) {
    const result = await syncPlaylistToMenu(pl.id, pl.title);
    if (result?.createdMenuItem) createdMenuItems += 1;
    updatedMenuItems += result?.updatedMenuItems ?? 0;
    updatedMenuSubItems += result?.updatedMenuSubItems ?? 0;
  }

  return {
    synced: playlists.length,
    createdMenuItems,
    updatedMenuItems,
    updatedMenuSubItems,
  };
}
