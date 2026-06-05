/**
 * 관리자 접수 관리 라우터 (cms.supportRequests)
 */

import { z } from "zod";
import { adminProcedure, router } from "../../_core/trpc";
import {
  listBulletinAdRequests,
  listNewMemberRequests,
  listPrayerRequests,
  listSubtitleRequests,
  listVisitRequests,
  updateBulletinAdRequestStatus,
  updateNewMemberRequestStatus,
  updatePrayerRequestStatus,
  updateSubtitleRequestStatus,
  updateVisitRequestStatus,
} from "../../db";

const adminMemoSchema = z.string().trim().max(1000).nullable().optional();

export const supportRequestsRouter = router({
  listPrayer: adminProcedure.query(() => listPrayerRequests()),
  listNewMembers: adminProcedure.query(() => listNewMemberRequests()),
  listVisits: adminProcedure.query(() => listVisitRequests()),
  listSubtitles: adminProcedure.query(() => listSubtitleRequests()),
  listBulletinAds: adminProcedure.query(() => listBulletinAdRequests()),

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

  updateVisitStatus: adminProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        status: z.enum(["new", "contacted", "scheduled", "completed", "archived"]),
        adminMemo: adminMemoSchema,
      })
    )
    .mutation(({ input }) =>
      updateVisitRequestStatus(input.id, {
        status: input.status,
        adminMemo: input.adminMemo,
      })
    ),

  updateSubtitleStatus: adminProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        status: z.enum(["new", "reviewed", "completed", "archived"]),
        adminMemo: adminMemoSchema,
      })
    )
    .mutation(({ input }) =>
      updateSubtitleRequestStatus(input.id, {
        status: input.status,
        adminMemo: input.adminMemo,
      })
    ),

  updateBulletinAdStatus: adminProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        status: z.enum(["new", "reviewed", "completed", "archived"]),
        adminMemo: adminMemoSchema,
      })
    )
    .mutation(({ input }) =>
      updateBulletinAdRequestStatus(input.id, {
        status: input.status,
        adminMemo: input.adminMemo,
      })
    ),
});
