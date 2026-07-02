/**
 * 생선 간증 관리자 라우터
 * 글과 댓글의 공개/숨김/삭제 상태를 관리합니다.
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { adminPermissionProcedure, router } from "../../_core/trpc";
import {
  getAllTestimonyComments,
  getAllTestimonyPosts,
  getTestimonyPostById,
  updateTestimonyPostWithImages,
  updateTestimonyCommentStatus,
  updateTestimonyPostStatus,
} from "../../db";
import { safeAssetUrlSchema } from "../../_core/contentValidation";

const idSchema = z.number().int().positive();
const statusSchema = z.enum(["published", "hidden", "deleted"]);
const testimonyProcedure = adminPermissionProcedure("content:testimonies");
const requiredText = (max: number, message: string) =>
  z.string().trim().min(1, message).max(max);
const optionalImage = safeAssetUrlSchema.optional();
const imageInputSchema = z.object({
  imageUrl: optionalImage,
  caption: z.string().trim().max(128).optional(),
}).refine((value) => Boolean(value.imageUrl), "이미지 URL이 필요합니다.");
const postInputSchema = z.object({
  title: requiredText(256, "제목을 입력해 주세요."),
  content: requiredText(50000, "간증 내용을 입력해 주세요."),
  thumbnailUrl: optionalImage,
  images: z.array(imageInputSchema).max(10).default([]),
  isSecret: z.boolean().default(false),
});

function normalizeImages(images: z.infer<typeof imageInputSchema>[]) {
  return images
    .filter((image): image is { imageUrl: string; caption?: string } => Boolean(image.imageUrl))
    .map((image, index) => ({
      imageUrl: image.imageUrl,
      caption: image.caption || undefined,
      sortOrder: index,
    }));
}

export const testimoniesRouter = router({
  posts: testimonyProcedure.query(() => getAllTestimonyPosts()),

  post: testimonyProcedure
    .input(z.object({ id: idSchema }))
    .query(({ input }) => getTestimonyPostById(input.id)),

  comments: testimonyProcedure.query(() => getAllTestimonyComments()),

  updatePost: testimonyProcedure
    .input(postInputSchema.extend({ id: idSchema }))
    .mutation(async ({ input }) => {
      const post = await getTestimonyPostById(input.id);
      if (!post || post.status === "deleted") {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "간증 글을 찾을 수 없습니다.",
        });
      }

      const images = normalizeImages(input.images);
      await updateTestimonyPostWithImages(
        input.id,
        {
          title: input.title,
          content: input.content,
          thumbnailUrl: input.thumbnailUrl || images[0]?.imageUrl || undefined,
          isSecret: input.isSecret,
          status: "published",
        },
        images,
      );

      return { success: true };
    }),

  updatePostStatus: testimonyProcedure
    .input(z.object({ id: idSchema, status: statusSchema }))
    .mutation(({ input }) => updateTestimonyPostStatus(input.id, input.status)),

  updateCommentStatus: testimonyProcedure
    .input(z.object({ id: idSchema, status: statusSchema }))
    .mutation(({ input }) => updateTestimonyCommentStatus(input.id, input.status)),
});
