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
import { adminProcedure, router } from "../../_core/trpc";
import { storagePut } from "../../storage";

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
      const buffer = Buffer.from(input.base64, "base64");
      const ext = input.fileName.split(".").pop() || "mp4";
      const key = `hero-videos/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { url } = await storagePut(key, buffer, input.mimeType);
      return { url };
    }),

  /**
   * 이미지 파일 업로드 (공지사항 썸네일용)
   * - S3 경로: notice-images/{timestamp}-{random}.{ext}
   */
  image: adminProcedure
    .input(z.object({
      base64: z.string(),        // base64로 인코딩된 파일 내용
      fileName: z.string(),      // 원본 파일명 (예: notice.jpg)
      mimeType: z.string(),      // MIME 타입 (예: image/jpeg)
    }))
    .mutation(async ({ input }) => {
      const buffer = Buffer.from(input.base64, "base64");
      const ext = input.fileName.split(".").pop() || "jpg";
      const key = `notice-images/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
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
      const buffer = Buffer.from(input.base64, "base64");
      const ext = input.fileName.split(".").pop() || "jpg";
      const context = input.context ?? "page";
      const key = `page-images/${context}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { url } = await storagePut(key, buffer, input.mimeType);
      return { url, key };
    }),
});
