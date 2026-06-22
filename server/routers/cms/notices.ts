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
import { adminPermissionProcedure, router } from "../../_core/trpc";
import {
  ADMIN_RESOURCE_CATEGORY,
  NOTICE_ALL_CATEGORY_LABEL,
  NOTICE_CATEGORY_SETTINGS_KEY,
  normalizeNoticeCategorySettings,
} from "@shared/noticeCategories";
import {
  normalizeRichTextHtmlContent,
  optionalTextSchema,
  requiredTextSchema,
  safeAssetUrlSchema,
} from "../../_core/contentValidation";
import { getAllNotices, createNotice, updateNotice, deleteNotice, upsertSiteSetting } from "../../db";
const noticeProcedure = adminPermissionProcedure("content:notices");

const noticeCategorySettingsSchema = z.array(z.object({
  label: requiredTextSchema(24, "분류 이름을 입력해주세요."),
  isVisible: z.boolean(),
})).min(1, "분류를 1개 이상 등록해주세요.").max(30, "분류는 최대 30개까지 등록할 수 있습니다.").superRefine((categories, ctx) => {
  const seen = new Set<string>();
  const visibleLabels = new Set<string>();

  categories.forEach((category, index) => {
    const label = category.label.trim().replace(/\s+/g, " ");
    if (label === ADMIN_RESOURCE_CATEGORY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "행정자료는 공지사항 분류로 사용할 수 없습니다.",
        path: [index, "label"],
      });
    }
    if (seen.has(label)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "같은 이름의 분류가 이미 있습니다.",
        path: [index, "label"],
      });
    }
    seen.add(label);
    if (category.isVisible) visibleLabels.add(label);
  });

  if (visibleLabels.size === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "화면에 보일 분류를 1개 이상 선택해주세요.",
    });
  }

  if (!seen.has(NOTICE_ALL_CATEGORY_LABEL) && categories.length === 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "전체를 제외하려면 공지/부고/결혼 등 실제 분류를 1개 이상 남겨주세요.",
    });
  }
});

function normalizeNoticeContent(value: string | undefined) {
  if (value === undefined) return undefined;
  if (!value.trim()) return "";
  return normalizeRichTextHtmlContent(value, 50000);
}

export const noticesRouter = router({
  /** 전체 공지사항 목록 조회 (숨김 포함) */
  list: noticeProcedure.query(() => getAllNotices()),

  /**
   * 공지사항 생성
   * - authorId는 현재 로그인한 관리자 ID로 자동 설정
   */
  create: noticeProcedure
    .input(z.object({
      category: requiredTextSchema(32, "카테고리를 입력해주세요.").default("공지"),
      title: requiredTextSchema(256, "제목을 입력해주세요."),
      content: optionalTextSchema(50000),
      thumbnailUrl: safeAssetUrlSchema.optional(),
      isPublished: z.boolean().default(true),
      isPinned: z.boolean().default(false),
    }))
    .mutation(({ input, ctx }) =>
      createNotice({
        ...input,
        content: normalizeNoticeContent(input.content),
        authorId: ctx.user.id,
      })
    ),

  /**
   * 공지사항 수정
   * - 수정할 필드만 선택적으로 전달 가능
   */
  update: noticeProcedure
    .input(z.object({
      id: z.number().int().positive(),
      category: requiredTextSchema(32, "카테고리를 입력해주세요.").optional(),
      title: requiredTextSchema(256, "제목을 입력해주세요.").optional(),
      content: optionalTextSchema(50000),
      thumbnailUrl: safeAssetUrlSchema.optional(),
      isPublished: z.boolean().optional(),
      isPinned: z.boolean().optional(),
    }))
    .mutation(({ input }) => {
      const { id, ...data } = input;
      if (data.content !== undefined) {
        data.content = normalizeNoticeContent(data.content);
      }
      return updateNotice(id, data);
    }),

  /** 공지사항 삭제 */
  delete: noticeProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(({ input }) => deleteNotice(input.id)),

  /** 공지사항 분류 메뉴 저장 */
  categories: router({
    update: noticeProcedure
      .input(z.object({ categories: noticeCategorySettingsSchema }))
      .mutation(({ input }) => {
        const categories = normalizeNoticeCategorySettings(input.categories);
        return upsertSiteSetting(NOTICE_CATEGORY_SETTINGS_KEY, JSON.stringify(categories));
      }),
  }),
});
