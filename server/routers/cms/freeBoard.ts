import { z } from "zod";
import { adminPermissionProcedure, router } from "../../_core/trpc";
import { getAllFreeBoardPosts, updateFreeBoardPostStatus } from "../../db";

const idSchema = z.number().int().positive();
const statusSchema = z.enum(["published", "hidden", "deleted"]);
const freeBoardProcedure = adminPermissionProcedure("content:freeBoard");

export const freeBoardAdminRouter = router({
  posts: freeBoardProcedure.query(() => getAllFreeBoardPosts()),

  updatePostStatus: freeBoardProcedure
    .input(z.object({ id: idSchema, status: statusSchema }))
    .mutation(({ input }) => updateFreeBoardPostStatus(input.id, input.status)),
});
