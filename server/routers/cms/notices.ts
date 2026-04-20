/**
 * 공지사항 관리 라우터 (cms.notices)
 * ─────────────────────────────────────────────────────────────────────────────
 * 담당 기능:
 *   - list: 전체 공지사항 목록 조회 (관리자)
 *   - create: 공지사항 생성 (관리자)
 *   - update: 공지사항 수정 (관리자)
 *   - delete: 공지사항 삭제 (관리자)
 *
 * 접근 권한: 모두 adminProcedure (관리자만 접근 가능)
 */

import { z } from "zod";
import { adminProcedure, router } from "../../_core/trpc";
import { getAllNotices, createNotice, updateNotice, deleteNotice } from "../../db";

export const noticesRouter = router({
  /** 전체 공지사항 목록 조회 (숨김 포함) */
  list: adminProcedure.query(() => getAllNotices()),

  /**
   * 공지사항 생성
   * - authorId는 현재 로그인한 관리자 ID로 자동 설정
   */
  create: adminProcedure
    .input(z.object({
      category: z.string().default("공지"),
      title: z.string().min(1, "제목을 입력해주세요."),
      content: z.string().optional(),
      thumbnailUrl: z.string().optional(),
      isPublished: z.boolean().default(true),
      isPinned: z.boolean().default(false),
    }))
    .mutation(({ input, ctx }) =>
      createNotice({ ...input, authorId: ctx.user.id })
    ),

  /**
   * 공지사항 수정
   * - 수정할 필드만 선택적으로 전달 가능
   */
  update: adminProcedure
    .input(z.object({
      id: z.number(),
      category: z.string().optional(),
      title: z.string().optional(),
      content: z.string().optional(),
      thumbnailUrl: z.string().optional(),
      isPublished: z.boolean().optional(),
      isPinned: z.boolean().optional(),
    }))
    .mutation(({ input }) => {
      const { id, ...data } = input;
      return updateNotice(id, data);
    }),

  /** 공지사항 삭제 */
  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ input }) => deleteNotice(input.id)),
});
