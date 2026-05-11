/**
 * 예배영상 관리 라우터 (youtube)
 * ─────────────────────────────────────────────────────────────────────────────
 * 담당 기능:
 *   - getPlaylists: 플레이리스트 전체 목록 (공개)
 *   - createPlaylist: 플레이리스트 생성 (관리자)
 *   - updatePlaylist: 플레이리스트 수정 (관리자)
 *   - deletePlaylist: 플레이리스트 삭제 (관리자)
 *   - getVideos: 특정 플레이리스트 영상 목록 (공개)
 *   - getVideosAdmin: 특정 플레이리스트 영상 목록 (관리자, 숨김 포함)
 *   - addVideo: 영상 추가 (관리자)
 *   - updateVideo: 영상 수정 (관리자)
 *   - deleteVideo: 영상 삭제 (관리자)
 *   - reorderVideos: 영상 순서 일괄 변경 (관리자)
 *   - syncAllToMenus: 플레이리스트-메뉴 이름 기반 자동 연결 (관리자)
 *
 * 특이사항:
 *   - 플레이리스트 이름과 메뉴 이름이 같으면 자동으로 메뉴에 연결
 *   - syncAllToMenus로 기존 플레이리스트를 일괄 연결 가능
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { adminProcedure, publicProcedure, router } from "../_core/trpc";
import {
  extractYoutubeVideoId,
  isSafeAssetUrl,
  optionalTextSchema,
  requiredTextSchema,
  safeAssetUrlSchema,
} from "../_core/contentValidation";
import {
  getAllYoutubePlaylists,
  createYoutubePlaylist,
  updateYoutubePlaylist,
  deleteYoutubePlaylist,
  getYoutubeVideosByPlaylist,
  getVisibleYoutubeVideos,
  createYoutubeVideo,
  updateYoutubeVideo,
  deleteYoutubeVideo,
  reorderYoutubeVideos,
  syncPlaylistToMenu,
  syncAllPlaylistsToMenus,
} from "../db";

function normalizeVideoInput(input: {
  videoId?: string | null;
  videoUrl?: string | null;
}) {
  const videoId = extractYoutubeVideoId(input.videoId) ?? extractYoutubeVideoId(input.videoUrl);
  const rawVideoUrl = input.videoUrl?.trim() ?? "";

  if (videoId) {
    return { videoId, videoUrl: null };
  }
  if (!rawVideoUrl) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "유튜브 영상 ID 또는 직접 영상 URL을 입력해주세요.",
    });
  }
  if (!isSafeAssetUrl(rawVideoUrl)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "허용되지 않는 영상 URL 형식입니다.",
    });
  }
  return { videoId: null, videoUrl: rawVideoUrl };
}

export const youtubeRouter = router({
  // ─── 플레이리스트 관리 ───────────────────────────────────────────────────────

  /** 플레이리스트 전체 목록 (공개/관리자 공통) */
  getPlaylists: publicProcedure.query(() => getAllYoutubePlaylists()),

  /**
   * 플레이리스트 생성 (관리자)
   * - 생성 후 동일 이름의 메뉴가 있으면 자동으로 playlistId 연결
   */
  createPlaylist: adminProcedure
    .input(z.object({
      title: requiredTextSchema(128, "플레이리스트 이름을 입력해주세요."),
      description: optionalTextSchema(5000),
    }))
    .mutation(async ({ input }) => {
      const result = await createYoutubePlaylist(input);
      const newId = result?.insertId;

      // 동일 이름의 메뉴가 있으면 자동으로 playlistId 연결
      if (newId) {
        await syncPlaylistToMenu(newId, input.title);
      }

      return result;
    }),

  /**
   * 플레이리스트 수정 (관리자)
   * - 이름 변경 시 새 이름과 동일한 메뉴에 자동 연결
   */
  updatePlaylist: adminProcedure
    .input(z.object({
      id: z.number().int().positive(),
      title: requiredTextSchema(128, "플레이리스트 이름을 입력해주세요.").optional(),
      description: optionalTextSchema(5000),
    }))
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      const result = await updateYoutubePlaylist(id, data);

      // 이름이 변경된 경우 새 이름으로 메뉴 재연결
      if (data.title) {
        await syncPlaylistToMenu(id, data.title);
      }

      return result;
    }),

  /** 플레이리스트 삭제 (관리자) */
  deletePlaylist: adminProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(({ input }) => deleteYoutubePlaylist(input.id)),

  // ─── 영상 관리 ───────────────────────────────────────────────────────────────

  /**
   * 특정 플레이리스트의 영상 목록 (공개)
   * - isVisible=true인 영상만 반환
   */
  getVideos: publicProcedure
    .input(z.object({ playlistId: z.number().int().positive() }))
    .query(({ input }) => getVisibleYoutubeVideos(input.playlistId)),

  /**
   * 특정 플레이리스트의 영상 목록 (관리자)
   * - 숨김 영상 포함 전체 반환
   */
  getVideosAdmin: adminProcedure
    .input(z.object({ playlistId: z.number().int().positive() }))
    .query(({ input }) => getYoutubeVideosByPlaylist(input.playlistId)),

  /**
   * 유튜브 영상 추가 (관리자)
   * - videoId: 유튜브 영상 ID (예: dQw4w9WgXcQ)
   * - videoUrl: 유튜브 영상 전체 URL (videoId 대신 사용 가능)
   */
  addVideo: adminProcedure
    .input(z.object({
      playlistId: z.number().int().positive(),
      videoId: z.string().trim().max(2048).optional().nullable(),
      videoUrl: z.string().trim().max(2048).optional().nullable(),
      title: requiredTextSchema(256, "영상 제목을 입력해주세요."),
      thumbnailUrl: safeAssetUrlSchema.optional(),
      description: optionalTextSchema(10000),
      sortOrder: z.number().int().min(0).max(10000).optional(),
    }))
    .mutation(({ input }) => {
      const normalized = normalizeVideoInput(input);
      return createYoutubeVideo({ ...input, ...normalized });
    }),

  /** 유튜브 영상 수정 (관리자) */
  updateVideo: adminProcedure
    .input(z.object({
      id: z.number().int().positive(),
      title: requiredTextSchema(256, "영상 제목을 입력해주세요.").optional(),
      thumbnailUrl: safeAssetUrlSchema.optional(),
      description: optionalTextSchema(10000),
      sortOrder: z.number().int().min(0).max(10000).optional(),
      isVisible: z.boolean().optional(),
    }))
    .mutation(({ input }) => {
      const { id, ...data } = input;
      return updateYoutubeVideo(id, data);
    }),

  /** 유튜브 영상 삭제 (관리자) */
  deleteVideo: adminProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(({ input }) => deleteYoutubeVideo(input.id)),

  /**
   * 영상 순서 일괄 변경 (관리자)
   * - orderedIds: 새 순서대로 정렬된 영상 ID 배열
   */
  reorderVideos: adminProcedure
    .input(z.object({
      orderedIds: z.array(z.number().int().positive()).max(500),
    }))
    .mutation(({ input }) => reorderYoutubeVideos(input.orderedIds)),

  // ─── 메뉴 자동 연결 ─────────────────────────────────────────────────────────

  /**
   * 플레이리스트-메뉴 이름 기반 일괄 자동 연결 (관리자)
   * - 모든 플레이리스트를 순회하며 동일 이름의 메뉴에 playlistId 연결
   * - 기존에 연결이 안 된 플레이리스트를 한 번에 동기화할 때 사용
   */
  syncAllToMenus: adminProcedure
    .mutation(() => syncAllPlaylistsToMenus()),
});
