/**
 * 생선 간증 관리자 라우터
 * 글과 댓글의 공개/숨김/삭제 상태를 관리합니다.
 */

import { z } from "zod";
import { adminProcedure, router } from "../../_core/trpc";
import {
  getAllTestimonyComments,
  getAllTestimonyPosts,
  updateTestimonyCommentStatus,
  updateTestimonyPostStatus,
} from "../../db";

const idSchema = z.number().int().positive();
const statusSchema = z.enum(["published", "hidden", "deleted"]);

export const testimoniesRouter = router({
  posts: adminProcedure.query(() => getAllTestimonyPosts()),

  comments: adminProcedure.query(() => getAllTestimonyComments()),

  updatePostStatus: adminProcedure
    .input(z.object({ id: idSchema, status: statusSchema }))
    .mutation(({ input }) => updateTestimonyPostStatus(input.id, input.status)),

  updateCommentStatus: adminProcedure
    .input(z.object({ id: idSchema, status: statusSchema }))
    .mutation(({ input }) => updateTestimonyCommentStatus(input.id, input.status)),
});
