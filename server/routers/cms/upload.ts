/**
 * 파일 업로드 라우터 (cms.upload)
 * ─────────────────────────────────────────────────────────────────────────────
 * 담당 기능:
 *   - video: 히어로 슬라이드용 영상 파일 업로드 (S3)
 *   - image: 공지사항 썸네일 이미지 업로드 (S3)
 *   - pageImage: 메뉴 페이지 이미지 업로드 (S3)
 *
 * 업로드 방식:
 *   - 클라이언트에서 base64로 인코딩된 파일을 전송
 *   - 서버에서 Buffer로 변환 후 S3에 저장
 *   - S3 CDN URL 반환
 *
 * 접근 권한: 모두 adminProcedure (관리자만 접근 가능)
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { adminProcedure, router } from "../../_core/trpc";
import { storagePut } from "../../storage";

// ── 허용 MIME 타입 및 확장자 화이트리스트 ────────────────────────────────────────────
const ALLOWED_IMAGE_MIMES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

const ALLOWED_VIDEO_MIMES: Record<string, string> = {
  "video/mp4": "mp4",
  "video/webm": "webm",
};

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;  // 10MB
const MAX_VIDEO_BYTES = 100 * 1024 * 1024; // 100MB

/** 파일명에서 위험 문자 제거 (경로 탐색 공격 방지) */
function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9가-힙\-_]/g, "_").replace(/_{2,}/g, "_").slice(0, 100);
}

/** 이미지 업로드 검증: MIME 기준으로 확장자 결정, 크기 제한 */
export function validateImage(base64: string, mimeType: string): { buffer: Buffer; ext: string } {
  const mime = mimeType.toLowerCase().trim();
  const ext = ALLOWED_IMAGE_MIMES[mime];
  if (!ext) {
    throw new TRPCError({ code: "BAD_REQUEST", message: `허용되지 않는 이미지 형식입니다. 허용 형식: jpg, png, webp, gif` });
  }
  const buffer = Buffer.from(base64, "base64");
  if (buffer.length > MAX_IMAGE_BYTES) {
    throw new TRPCError({ code: "BAD_REQUEST", message: `이미지 파일 크기가 너무 큽니다. 최대 10MB까지 업로드 가능합니다.` });
  }
  return { buffer, ext };
}

/** 영상 업로드 검증: MIME 기준으로 확장자 결정, 크기 제한 */
export function validateVideo(base64: string, mimeType: string): { buffer: Buffer; ext: string } {
  const mime = mimeType.toLowerCase().trim();
  const ext = ALLOWED_VIDEO_MIMES[mime];
  if (!ext) {
    throw new TRPCError({ code: "BAD_REQUEST", message: `허용되지 않는 영상 형식입니다. 허용 형식: mp4, webm` });
  }
  const buffer = Buffer.from(base64, "base64");
  if (buffer.length > MAX_VIDEO_BYTES) {
    throw new TRPCError({ code: "BAD_REQUEST", message: `영상 파일 크기가 너무 큽니다. 최대 100MB까지 업로드 가능합니다.` });
  }
  return { buffer, ext };
}

export const uploadRouter = router({
  /**
   * 영상 파일 업로드 (히어로 슬라이드용)
   * - S3 경로: hero-videos/{timestamp}-{random}.{ext}
   */
  video: adminProcedure
    .input(z.object({
      base64: z.string(),        // base64로 인코딩된 파일 내용
      fileName: z.string(),      // 원본 파일명 (예: church-video.mp4)
      mimeType: z.string(),      // MIME 타입 (예: video/mp4)
    }))
    .mutation(async ({ input }) => {
      const { buffer, ext } = validateVideo(input.base64, input.mimeType);
      sanitizeFileName(input.fileName);
      const key = `hero-videos/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { url } = await storagePut(key, buffer, input.mimeType);
      return { url };
    }),
  /**
   * 이미지 파일 업로드 (공지사항 썸네일용)
   * - S3 경로: notice-images/{timestamp}-{random}.{ext}
   * - 허용: jpg, png, webp, gif / 최대 10MB
   */
  image: adminProcedure
    .input(z.object({
      base64: z.string(),        // base64로 인코딩된 파일 내용
      fileName: z.string(),      // 원본 파일명 (예: notice.jpg)
      mimeType: z.string(),      // MIME 타입 (예: image/jpeg)
    }))
     .mutation(async ({ input }) => {
      const { buffer, ext } = validateImage(input.base64, input.mimeType);
      sanitizeFileName(input.fileName);
      const key = `notice-images/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { url } = await storagePut(key, buffer, input.mimeType);
      return { url };
    }),
  /**
   * 갤러리 이미지 업로드
   * - S3 경로: gallery-images/{timestamp}-{random}.{ext}
   * - 허용: jpg, png, webp, gif / 최대 10MB
   */
  galleryImage: adminProcedure
    .input(z.object({
      base64: z.string(),
      fileName: z.string(),
      mimeType: z.string(),
    }))
    .mutation(async ({ input }) => {
      const { buffer, ext } = validateImage(input.base64, input.mimeType);
      sanitizeFileName(input.fileName);
      const key = `gallery-images/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { url } = await storagePut(key, buffer, input.mimeType);
      return { url };
    }),
  /**
   * 메뉴 페이지 이미지 업로드
   * - 이미지 전체화면(pageType=image) 메뉴 페이지용
   * - 블록 에디터 이미지 블록에서도 재사용 가능
   * - S3 경로: page-images/{context}/{timestamp}-{random}.{ext}
   * - 반환: { url, key } — url은 CDN URL, key는 S3 경로(삭제 시 필요)
   */
  pageImage: adminProcedure
    .input(z.object({
      base64: z.string(),
      fileName: z.string(),
      mimeType: z.string(),
      context: z.string().optional(), // 업로드 맥락 (예: 'menu-page', 'block-editor')
    }))
    .mutation(async ({ input }) => {
      const { buffer, ext } = validateImage(input.base64, input.mimeType);
      sanitizeFileName(input.fileName);
      const context = (input.context ?? "page").replace(/[^a-zA-Z0-9\-_]/g, "_");
      const key = `page-images/${context}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { url } = await storagePut(key, buffer, input.mimeType);
      return { url, key };
    }),
});
