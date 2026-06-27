import { z } from "zod";
import { adminProcedure, router } from "../../_core/trpc";
import { getAllFreeBoardPosts, updateFreeBoardPostStatus } from "../../db";

const idSchema = z.number().int().positive();
const statusSchema = z.enum(["published", "hidden", "deleted"]);

export const freeBoardAdminRouter = router({
  posts: adminProcedure.query(() => getAllFreeBoardPosts()),

  updatePostStatus: adminProcedure
    .input(z.object({ id: idSchema, status: statusSchema }))
    .mutation(({ input }) => updateFreeBoardPostStatus(input.id, input.status)),
});
