/**
 * 블록 에디터 관리 라우터 (cms.blocks)
 * ─────────────────────────────────────────────────────────────────────────────
 * 담당 기능:
 *   - list: 페이지 블록 목록 조회 (숨김 포함, 관리자)
 *   - create: 블록 생성
 *   - update: 블록 수정
 *   - delete: 블록 삭제
 *   - reorder: 블록 순서 일괄 변경
 *   - uploadImage: 블록 이미지 업로드 (S3)
 *
 * 블록 타입 예시:
 *   - 'text': 텍스트 블록
 *   - 'image': 이미지 블록
 *   - 'video': 영상 블록
 *   - 'divider': 구분선 블록
 *
 * 접근 권한: 모두 adminProcedure (관리자만 접근 가능)
 */

import { z } from "zod";
import { adminProcedure, router } from "../../_core/trpc";
import { storagePut } from "../../storage";
import { validateImage } from "./upload";
import {
  getAllPageBlocks,
  createPageBlock,
  updatePageBlock,
  deletePageBlock,
  reorderPageBlocks,
} from "../../db";

export const blocksRouter = router({
  /**
   * 페이지 블록 목록 조회 (관리자용 — 숨김 포함)
   * - menuItemId 또는 menuSubItemId 중 하나를 입력
   */
  list: adminProcedure
    .input(z.object({
      menuItemId: z.number().optional(),
      menuSubItemId: z.number().optional(),
    }))
    .query(({ input }) => getAllPageBlocks(input)),

  /**
   * 블록 생성
   * - menuItemId 또는 menuSubItemId 중 하나를 반드시 입력
   * - blockType: 블록 종류 (text, image, video, divider 등)
   * - content: JSON 문자열로 저장 (블록 타입에 따라 구조 다름)
   */
  create: adminProcedure
    .input(z.object({
      menuItemId: z.number().optional(),
      menuSubItemId: z.number().optional(),
      blockType: z.string(),
      content: z.string(),
      sortOrder: z.number().default(0),
    }))
    .mutation(({ input }) => createPageBlock(input)),

  /**
   * 블록 수정
   * - 수정할 필드만 선택적으로 전달 가능
   * - isVisible: false로 설정하면 공개 페이지에서 숨김
   */
  update: adminProcedure
    .input(z.object({
      id: z.number(),
      blockType: z.string().optional(),
      content: z.string().optional(),
      sortOrder: z.number().optional(),
      isVisible: z.boolean().optional(),
    }))
    .mutation(({ input }) => {
      const { id, ...data } = input;
      return updatePageBlock(id, data);
    }),

  /** 블록 삭제 */
  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ input }) => deletePageBlock(input.id)),

  /**
   * 블록 순서 일괄 변경
   * - orderedIds: 새 순서대로 정렬된 블록 ID 배열
   */
  reorder: adminProcedure
    .input(z.object({ orderedIds: z.array(z.number()) }))
    .mutation(({ input }) => reorderPageBlocks(input.orderedIds)),

  /**
   * 블록 이미지 업로드 (S3)
   * - S3 경로: page-blocks/{timestamp}-{random}.{ext}
   * - 반환: { url, key }
   */
  uploadImage: adminProcedure
    .input(z.object({
      base64: z.string(),
      mimeType: z.string(),
      fileName: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const { buffer, ext } = validateImage(input.base64, input.mimeType);
      const mimeType = input.mimeType.toLowerCase().trim();
      const key = `page-blocks/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { url } = await storagePut(key, buffer, mimeType);
      return { url, key };
    }),
});
