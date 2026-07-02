import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { safeAssetUrlSchema } from "../_core/contentValidation";
import { hasAdminContentPermission } from "../db/adminPermissions";
import {
  canViewPublishedTestimonyPost,
  createTestimonyComment,
  createTestimonyPostWithImages,
  getPublishedTestimonyPostById,
  getPublishedTestimonyPosts,
  getTestimonyCommentById,
  getTestimonyPostById,
  getTestimonyPostsByAuthor,
  updateTestimonyComment,
  updateTestimonyCommentStatus,
  updateTestimonyPostStatus,
  updateTestimonyPostWithImages,
} from "../db";
import { storagePut } from "../storage";
import { validateImage } from "./cms/upload";

const idSchema = z.number().int().positive();
const requiredText = (max: number, message: string) =>
  z.string().trim().min(1, message).max(max);
const optionalImage = safeAssetUrlSchema.optional();
const TESTIMONY_PERMISSION_KEY = "content:testimonies";
const ADMIN_TESTIMONY_AUTHOR_MEMBER_ID = 0;

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

function canManageTestimonies(user: Parameters<typeof hasAdminContentPermission>[0]) {
  return hasAdminContentPermission(user, TESTIMONY_PERMISSION_KEY);
}

function getTestimonyAuthorMemberId(ctx: { user: Parameters<typeof hasAdminContentPermission>[0]; memberId: number | null }) {
  if (ctx.memberId) return ctx.memberId;
  if (canManageTestimonies(ctx.user)) return ADMIN_TESTIMONY_AUTHOR_MEMBER_ID;

  throw new TRPCError({
    code: "UNAUTHORIZED",
    message: "로그인이 필요합니다.",
  });
}

export const testimonyRouter = router({
  posts: publicProcedure.query(({ ctx }) =>
    getPublishedTestimonyPosts({ user: ctx.user, memberId: ctx.memberId }),
  ),

  post: publicProcedure
    .input(z.object({ id: idSchema }))
    .query(({ input, ctx }) =>
      getPublishedTestimonyPostById(input.id, { user: ctx.user, memberId: ctx.memberId }),
    ),

  myPosts: publicProcedure.query(({ ctx }) => {
    if (!ctx.memberId) return [];
    return getTestimonyPostsByAuthor(ctx.memberId);
  }),

  createPost: publicProcedure
    .input(postInputSchema)
    .mutation(async ({ input, ctx }) => {
      const images = normalizeImages(input.images);
      const authorMemberId = getTestimonyAuthorMemberId(ctx);
      const id = await createTestimonyPostWithImages(
        {
          authorMemberId,
          title: input.title,
          content: input.content,
          thumbnailUrl: input.thumbnailUrl || images[0]?.imageUrl || undefined,
          isSecret: input.isSecret,
          status: "published",
        },
        images,
      );

      if (!id) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "간증 저장에 실패했습니다.",
        });
      }

      return { id };
    }),

  updatePost: publicProcedure
    .input(postInputSchema.extend({ id: idSchema }))
    .mutation(async ({ input, ctx }) => {
      const post = await getTestimonyPostById(input.id);
      if (!post || post.status === "deleted") {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "간증 글을 찾을 수 없습니다.",
        });
      }
      const canManage = canManageTestimonies(ctx.user);
      const isOwner = Boolean(ctx.memberId && post.authorMemberId === ctx.memberId);
      if (!isOwner && !canManage) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "본인이 작성한 간증 또는 관리 권한이 있는 글만 수정할 수 있습니다.",
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

  deletePost: publicProcedure
    .input(z.object({ id: idSchema }))
    .mutation(async ({ input, ctx }) => {
      const post = await getTestimonyPostById(input.id);
      if (!post || post.status === "deleted") {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "간증 글을 찾을 수 없습니다.",
        });
      }
      const canManage = canManageTestimonies(ctx.user);
      const isOwner = Boolean(ctx.memberId && post.authorMemberId === ctx.memberId);
      if (!isOwner && !canManage) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "본인이 작성한 간증 또는 관리 권한이 있는 글만 삭제할 수 있습니다.",
        });
      }

      await updateTestimonyPostStatus(input.id, "deleted");
      return { success: true };
    }),

  createComment: publicProcedure
    .input(z.object({
      postId: idSchema,
      content: requiredText(5000, "댓글 내용을 입력해 주세요."),
    }))
    .mutation(async ({ input, ctx }) => {
      const post = await getTestimonyPostById(input.postId);
      if (!post || post.status !== "published") {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "댓글을 작성할 수 없는 간증 글입니다.",
        });
      }

      const authorMemberId = getTestimonyAuthorMemberId(ctx);
      const canView = await canViewPublishedTestimonyPost(input.postId, {
        user: ctx.user,
        memberId: ctx.memberId,
      });
      if (!canView) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "비밀글에는 권한이 있는 사용자만 댓글을 작성할 수 있습니다.",
        });
      }

      const id = await createTestimonyComment({
        postId: input.postId,
        authorMemberId,
        content: input.content,
        status: "published",
      });

      if (!id) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "댓글 저장에 실패했습니다.",
        });
      }

      return { id };
    }),

  deleteComment: publicProcedure
    .input(z.object({ id: idSchema }))
    .mutation(async ({ input, ctx }) => {
      const comment = await getTestimonyCommentById(input.id);
      if (!comment || comment.status === "deleted") {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "댓글을 찾을 수 없습니다.",
        });
      }
      const canManage = canManageTestimonies(ctx.user);
      const isOwner = Boolean(ctx.memberId && comment.authorMemberId === ctx.memberId);
      if (!isOwner && !canManage) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "본인이 작성한 댓글 또는 관리 권한이 있는 댓글만 삭제할 수 있습니다.",
        });
      }

      await updateTestimonyCommentStatus(input.id, "deleted");
      return { success: true };
    }),

  updateComment: publicProcedure
    .input(z.object({
      id: idSchema,
      content: requiredText(5000, "댓글 내용을 입력해 주세요."),
    }))
    .mutation(async ({ input, ctx }) => {
      const comment = await getTestimonyCommentById(input.id);
      if (!comment || comment.status === "deleted") {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "댓글을 찾을 수 없습니다.",
        });
      }
      const canManage = canManageTestimonies(ctx.user);
      const isOwner = Boolean(ctx.memberId && comment.authorMemberId === ctx.memberId);
      if (!isOwner && !canManage) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "본인이 작성한 댓글 또는 관리 권한이 있는 댓글만 수정할 수 있습니다.",
        });
      }

      await updateTestimonyComment(input.id, {
        content: input.content,
        status: "published",
      });

      return { success: true };
    }),

  uploadImage: publicProcedure
    .input(z.object({
      base64: z.string(),
      fileName: z.string(),
      mimeType: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      const authorMemberId = getTestimonyAuthorMemberId(ctx);
      const { buffer, ext } = validateImage(input.base64, input.mimeType);
      const key = `testimonies/${authorMemberId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { url } = await storagePut(key, buffer, input.mimeType);
      return { url };
    }),
});
