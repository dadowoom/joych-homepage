import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { adminPermissionProcedure, router } from "../../_core/trpc";
import {
  isSafeAssetUrl,
  normalizeRichTextHtmlContent,
  optionalTextSchema,
  requiredTextSchema,
} from "../../_core/contentValidation";
import {
  createDynamicBoardPost,
  deleteDynamicBoardPost,
  ensureDynamicBoard,
  getDynamicBoardPostById,
  updateDynamicBoardPost,
} from "../../db";

const dynamicBoardProcedure = adminPermissionProcedure("content:notices");
const idSchema = z.number().int().positive();

const boardSourceBaseSchema = z.object({
  menuItemId: idSchema.optional(),
  menuSubItemId: idSchema.optional(),
  boardTitle: z.string().trim().max(128).optional(),
});

function validateSingleBoardSource(value: { menuItemId?: number; menuSubItemId?: number }, ctx: z.RefinementCtx) {
  if (Boolean(value.menuItemId) !== Boolean(value.menuSubItemId)) return;
  ctx.addIssue({
    code: z.ZodIssueCode.custom,
    message: "2단 메뉴 또는 3단 메뉴 중 하나만 선택해주세요.",
  });
}

const boardSourceSchema = boardSourceBaseSchema.superRefine(validateSingleBoardSource);

const optionalAssetUrlInputSchema = z.string()
  .trim()
  .max(2048, "URL 길이가 너무 깁니다.")
  .optional()
  .refine((value) => value === undefined || value.length === 0 || isSafeAssetUrl(value), "허용되지 않는 URL 형식입니다.");

function normalizeOptionalAssetUrlValue(value: string | undefined) {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : "";
}

function normalizeOptionalTextValue(value: string | undefined) {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : "";
}

function validateAttachmentPair(
  value: { attachmentName?: string; attachmentUrl?: string },
  ctx: z.RefinementCtx,
) {
  const hasName = Boolean(value.attachmentName?.trim());
  const hasUrl = Boolean(value.attachmentUrl?.trim());
  if (hasName === hasUrl) return;

  ctx.addIssue({
    code: z.ZodIssueCode.custom,
    message: "첨부파일명과 첨부 URL을 함께 입력해주세요.",
    path: [hasName ? "attachmentUrl" : "attachmentName"],
  });
}

function normalizeOptionalContent(value: string | undefined) {
  if (value === undefined) return undefined;
  if (!value.trim()) return "";
  return normalizeRichTextHtmlContent(value, 50000);
}

export const dynamicBoardsRouter = router({
  ensure: dynamicBoardProcedure
    .input(boardSourceSchema)
    .mutation(({ input }) => ensureDynamicBoard(input)),

  createPost: dynamicBoardProcedure
    .input(boardSourceBaseSchema.extend({
      title: requiredTextSchema(256, "제목을 입력해주세요."),
      content: optionalTextSchema(50000),
      thumbnailUrl: optionalAssetUrlInputSchema,
      attachmentName: optionalTextSchema(255),
      attachmentUrl: optionalAssetUrlInputSchema,
      isPublished: z.boolean().default(true),
      isPinned: z.boolean().default(false),
    }).superRefine(validateSingleBoardSource).superRefine(validateAttachmentPair))
    .mutation(async ({ input, ctx }) => {
      const id = await createDynamicBoardPost({
        menuItemId: input.menuItemId,
        menuSubItemId: input.menuSubItemId,
        title: input.title,
        content: normalizeOptionalContent(input.content),
        thumbnailUrl: normalizeOptionalAssetUrlValue(input.thumbnailUrl),
        attachmentName: normalizeOptionalTextValue(input.attachmentName),
        attachmentUrl: normalizeOptionalAssetUrlValue(input.attachmentUrl),
        isPublished: input.isPublished,
        isPinned: input.isPinned,
        authorId: ctx.user.id,
      });
      if (!id) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "게시글 저장에 실패했습니다.",
        });
      }
      return { id };
    }),

  updatePost: dynamicBoardProcedure
    .input(z.object({
      id: idSchema,
      title: requiredTextSchema(256, "제목을 입력해주세요.").optional(),
      content: optionalTextSchema(50000),
      thumbnailUrl: optionalAssetUrlInputSchema,
      attachmentName: optionalTextSchema(255),
      attachmentUrl: optionalAssetUrlInputSchema,
      isPublished: z.boolean().optional(),
      isPinned: z.boolean().optional(),
    }).superRefine(validateAttachmentPair))
    .mutation(async ({ input }) => {
      const post = await getDynamicBoardPostById(input.id);
      if (!post) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "게시글을 찾을 수 없습니다.",
        });
      }
      const { id, ...data } = input;
      await updateDynamicBoardPost(id, {
        ...data,
        content: normalizeOptionalContent(data.content),
        thumbnailUrl: normalizeOptionalAssetUrlValue(data.thumbnailUrl),
        attachmentName: normalizeOptionalTextValue(data.attachmentName),
        attachmentUrl: normalizeOptionalAssetUrlValue(data.attachmentUrl),
      });
      return { success: true };
    }),

  deletePost: dynamicBoardProcedure
    .input(z.object({ id: idSchema }))
    .mutation(async ({ input }) => {
      const post = await getDynamicBoardPostById(input.id);
      if (!post) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "게시글을 찾을 수 없습니다.",
        });
      }
      await deleteDynamicBoardPost(input.id);
      return { success: true };
    }),
});
