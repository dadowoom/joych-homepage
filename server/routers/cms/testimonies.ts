/**
 * 생선 간증 관리자 라우터
 * 글과 댓글의 공개/숨김/삭제 상태를 관리합니다.
 */

import { z } from "zod";
import { adminPermissionProcedure, router } from "../../_core/trpc";
import {
  getAllTestimonyComments,
  getAllTestimonyPosts,
  updateTestimonyCommentStatus,
  updateTestimonyPostStatus,
} from "../../db";

const idSchema = z.number().int().positive();
const statusSchema = z.enum(["published", "hidden", "deleted"]);
const testimonyProcedure = adminPermissionProcedure("content:testimonies");

export const testimoniesRouter = router({
  posts: testimonyProcedure.query(() => getAllTestimonyPosts()),

  comments: testimonyProcedure.query(() => getAllTestimonyComments()),

  updatePostStatus: testimonyProcedure
    .input(z.object({ id: idSchema, status: statusSchema }))
    .mutation(({ input }) => updateTestimonyPostStatus(input.id, input.status)),

  updateCommentStatus: testimonyProcedure
    .input(z.object({ id: idSchema, status: statusSchema }))
    .mutation(({ input }) => updateTestimonyCommentStatus(input.id, input.status)),
});
