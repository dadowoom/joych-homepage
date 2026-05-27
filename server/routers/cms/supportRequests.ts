/**
 * 관리자 접수 관리 라우터 (cms.supportRequests)
 */

import { z } from "zod";
import { adminProcedure, router } from "../../_core/trpc";
import {
  listNewMemberRequests,
  listPrayerRequests,
  updateNewMemberRequestStatus,
  updatePrayerRequestStatus,
} from "../../db";

const adminMemoSchema = z.string().trim().max(1000).nullable().optional();

export const supportRequestsRouter = router({
  listPrayer: adminProcedure.query(() => listPrayerRequests()),
  listNewMembers: adminProcedure.query(() => listNewMemberRequests()),

  updatePrayerStatus: adminProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        status: z.enum(["new", "reviewed", "archived"]),
        adminMemo: adminMemoSchema,
      })
    )
    .mutation(({ input }) =>
      updatePrayerRequestStatus(input.id, {
        status: input.status,
        adminMemo: input.adminMemo,
      })
    ),

  updateNewMemberStatus: adminProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        status: z.enum(["new", "contacted", "archived"]),
        adminMemo: adminMemoSchema,
      })
    )
    .mutation(({ input }) =>
      updateNewMemberRequestStatus(input.id, {
        status: input.status,
        adminMemo: input.adminMemo,
      })
    ),
});
