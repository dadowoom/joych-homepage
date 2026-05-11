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

import { and, eq, asc } from "drizzle-orm";
import { youtubePlaylists, youtubeVideos, menuItems, menuSubItems } from "../../drizzle/schema";
import { getDb } from "./connection";

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
    .orderBy(asc(youtubeVideos.sortOrder));
}

/** 특정 플레이리스트의 공개 영상 목록 (정렬순, 일반 사용자용) */
export async function getVisibleYoutubeVideos(playlistId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(youtubeVideos)
    .where(and(
      eq(youtubeVideos.playlistId, playlistId),
      eq(youtubeVideos.isVisible, true),
    ))
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

// ─── 메뉴 자동 연결 ───────────────────────────────────────────────────────────

/**
 * 플레이리스트 이름과 동일한 메뉴에 playlistId 자동 연결
 * - 2단 메뉴(menuItems)와 3단 메뉴(menuSubItems) 모두 검색
 * - 이름이 같은 메뉴가 있으면 해당 메뉴의 playlistId를 업데이트
 */
export async function syncPlaylistToMenu(playlistId: number, title: string) {
  const db = await getDb();
  if (!db) return;

  // 2단 메뉴에서 동일 이름 검색 후 연결
  const matchingItems = await db.select().from(menuItems).where(eq(menuItems.label, title));
  for (const item of matchingItems) {
    await db.update(menuItems).set({ playlistId }).where(eq(menuItems.id, item.id));
  }

  // 3단 메뉴에서 동일 이름 검색 후 연결
  const matchingSubItems = await db.select().from(menuSubItems).where(eq(menuSubItems.label, title));
  for (const sub of matchingSubItems) {
    await db.update(menuSubItems).set({ playlistId }).where(eq(menuSubItems.id, sub.id));
  }
}

/**
 * 모든 플레이리스트를 순회하며 동일 이름의 메뉴에 playlistId 일괄 연결
 * - 관리자 대시보드 "메뉴 자동 연결" 버튼에서 호출
 */
export async function syncAllPlaylistsToMenus() {
  const playlists = await getAllYoutubePlaylists();
  for (const pl of playlists) {
    await syncPlaylistToMenu(pl.id, pl.title);
  }
  return { synced: playlists.length };
}
