import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { normalizeRichTextHtmlContent } from "../_core/contentValidation";
import { publicProcedure, router } from "../_core/trpc";
import { hasAdminContentPermission } from "../db/adminPermissions";
import {
  canViewPublishedFreeBoardPost,
  createFreeBoardPost,
  getFreeBoardPostById,
  getFreeBoardPostsByAuthor,
  getPublishedFreeBoardPosts,
  incrementFreeBoardPostViewCount,
  updateFreeBoardPost,
  updateFreeBoardPostStatus,
} from "../db";

const idSchema = z.number().int().positive();
const requiredText = (max: number, message: string) =>
  z.string().trim().min(1, message).max(max);

const postInputSchema = z.object({
  title: requiredText(256, "제목을 입력해 주세요."),
  content: requiredText(50000, "내용을 입력해 주세요."),
  isSecret: z.boolean().default(false),
});

const FREE_BOARD_PERMISSION_KEY = "content:freeBoard";
const ADMIN_FREE_BOARD_AUTHOR_MEMBER_ID = 0;

function normalizePostInput(input: z.infer<typeof postInputSchema>) {
  return {
    title: input.title,
    content: normalizeRichTextHtmlContent(input.content, 50000),
    isSecret: input.isSecret,
  };
}

function canManageFreeBoard(user: Parameters<typeof hasAdminContentPermission>[0]) {
  return hasAdminContentPermission(user, FREE_BOARD_PERMISSION_KEY);
}

function getFreeBoardAuthorMemberId(ctx: { user: Parameters<typeof hasAdminContentPermission>[0]; memberId: number | null }) {
  if (ctx.memberId) return ctx.memberId;
  if (canManageFreeBoard(ctx.user)) return ADMIN_FREE_BOARD_AUTHOR_MEMBER_ID;

  throw new TRPCError({
    code: "UNAUTHORIZED",
    message: "로그인이 필요합니다.",
  });
}

export const freeBoardRouter = router({
  posts: publicProcedure.query(({ ctx }) =>
    getPublishedFreeBoardPosts({ user: ctx.user, memberId: ctx.memberId }),
  ),

  trackPostView: publicProcedure
    .input(z.object({ id: idSchema }))
    .mutation(async ({ input, ctx }) => {
      const canView = await canViewPublishedFreeBoardPost(input.id, {
        user: ctx.user,
        memberId: ctx.memberId,
      });

      if (!canView) {
        return { success: true };
      }

      await incrementFreeBoardPostViewCount(input.id);
      return { success: true };
    }),

  myPosts: publicProcedure.query(({ ctx }) => {
    if (!ctx.memberId) return [];
    return getFreeBoardPostsByAuthor(ctx.memberId);
  }),

  createPost: publicProcedure
    .input(postInputSchema)
    .mutation(async ({ input, ctx }) => {
      const normalizedInput = normalizePostInput(input);
      const authorMemberId = getFreeBoardAuthorMemberId(ctx);
      const id = await createFreeBoardPost({
        authorMemberId,
        title: normalizedInput.title,
        content: normalizedInput.content,
        isSecret: normalizedInput.isSecret,
        status: "published",
      });

      if (!id) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "게시글 저장에 실패했습니다.",
        });
      }

      return { id };
    }),

  updatePost: publicProcedure
    .input(postInputSchema.extend({ id: idSchema }))
    .mutation(async ({ input, ctx }) => {
      const normalizedInput = normalizePostInput(input);
      const post = await getFreeBoardPostById(input.id);
      if (!post || post.status === "deleted") {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "게시글을 찾을 수 없습니다.",
        });
      }
      const canManage = canManageFreeBoard(ctx.user);
      const isOwner = Boolean(ctx.memberId && post.authorMemberId === ctx.memberId);
      if (!isOwner && !canManage) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "본인이 작성한 글 또는 관리 권한이 있는 글만 수정할 수 있습니다.",
        });
      }
      if (post.status !== "published" && !canManage) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "관리자가 숨긴 글은 수정할 수 없습니다.",
        });
      }

      await updateFreeBoardPost(input.id, {
        title: normalizedInput.title,
        content: normalizedInput.content,
        isSecret: normalizedInput.isSecret,
      });

      return { success: true };
    }),

  deletePost: publicProcedure
    .input(z.object({ id: idSchema }))
    .mutation(async ({ input, ctx }) => {
      const post = await getFreeBoardPostById(input.id);
      if (!post || post.status === "deleted") {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "게시글을 찾을 수 없습니다.",
        });
      }
      const canManage = canManageFreeBoard(ctx.user);
      const isOwner = Boolean(ctx.memberId && post.authorMemberId === ctx.memberId);
      if (!isOwner && !canManage) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "본인이 작성한 글 또는 관리 권한이 있는 글만 삭제할 수 있습니다.",
        });
      }

      await updateFreeBoardPostStatus(input.id, "deleted");
      return { success: true };
    }),
});
