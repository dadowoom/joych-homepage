import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { normalizeRichTextHtmlContent } from "../_core/contentValidation";
import { memberProtectedProcedure, publicProcedure, router } from "../_core/trpc";
import {
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
  title: requiredText(256, "제목을 입력해주세요."),
  content: requiredText(50000, "내용을 입력해주세요."),
});

function normalizePostInput(input: z.infer<typeof postInputSchema>) {
  return {
    title: input.title,
    content: normalizeRichTextHtmlContent(input.content, 50000),
  };
}

export const freeBoardRouter = router({
  posts: publicProcedure.query(() => getPublishedFreeBoardPosts()),

  trackPostView: publicProcedure
    .input(z.object({ id: idSchema }))
    .mutation(({ input }) => incrementFreeBoardPostViewCount(input.id)),

  myPosts: memberProtectedProcedure.query(({ ctx }) =>
    getFreeBoardPostsByAuthor(ctx.memberId),
  ),

  createPost: memberProtectedProcedure
    .input(postInputSchema)
    .mutation(async ({ input, ctx }) => {
      const normalizedInput = normalizePostInput(input);
      const id = await createFreeBoardPost({
        authorMemberId: ctx.memberId,
        title: normalizedInput.title,
        content: normalizedInput.content,
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

  updatePost: memberProtectedProcedure
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
      if (post.authorMemberId !== ctx.memberId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "본인이 작성한 글만 수정할 수 있습니다.",
        });
      }
      if (post.status !== "published") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "관리자가 숨긴 글은 수정할 수 없습니다.",
        });
      }
      await updateFreeBoardPost(input.id, {
        title: normalizedInput.title,
        content: normalizedInput.content,
      });
      return { success: true };
    }),

  deletePost: memberProtectedProcedure
    .input(z.object({ id: idSchema }))
    .mutation(async ({ input, ctx }) => {
      const post = await getFreeBoardPostById(input.id);
      if (!post || post.status === "deleted") {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "게시글을 찾을 수 없습니다.",
        });
      }
      if (post.authorMemberId !== ctx.memberId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "본인이 작성한 글만 삭제할 수 있습니다.",
        });
      }
      await updateFreeBoardPostStatus(input.id, "deleted");
      return { success: true };
    }),
});
