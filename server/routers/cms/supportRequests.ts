/**
 * 관리자 접수 관리 라우터 (cms.supportRequests)
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  SUPPORT_REQUEST_PERMISSION_KEYS,
  SUPPORT_REQUEST_ROOT_PERMISSION_KEY,
  type SupportRequestPermissionKind,
} from "@shared/adminPermissions";
import {
  SUPPORT_BOARD_INTRO_SETTING_KEYS,
  type SupportBoardIntroKind,
} from "@shared/supportBoardIntro";
import { hasAdminContentPermission } from "../../db/adminPermissions";
import { adminAnyPermissionProcedure, router } from "../../_core/trpc";
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
  upsertSiteSetting,
} from "../../db";

const adminMemoSchema = z.string().trim().max(1000).nullable().optional();

function supportRequestProcedure(kind: SupportRequestPermissionKind) {
  return adminAnyPermissionProcedure([
    SUPPORT_REQUEST_ROOT_PERMISSION_KEY,
    SUPPORT_REQUEST_PERMISSION_KEYS[kind],
  ]);
}

const supportRequestRootProcedure = adminAnyPermissionProcedure([
  SUPPORT_REQUEST_ROOT_PERMISSION_KEY,
]);

const supportBoardIntroKindSchema = z.enum(["bulletinAds", "subtitles", "visits"]);

function canManageSupportBoardIntro(
  user: Parameters<typeof hasAdminContentPermission>[0],
  kind: SupportBoardIntroKind,
) {
  return hasAdminContentPermission(user, SUPPORT_REQUEST_ROOT_PERMISSION_KEY)
    || hasAdminContentPermission(user, SUPPORT_REQUEST_PERMISSION_KEYS[kind]);
}

export const supportRequestsRouter = router({
  updateBoardIntro: adminAnyPermissionProcedure([
    SUPPORT_REQUEST_ROOT_PERMISSION_KEY,
    SUPPORT_REQUEST_PERMISSION_KEYS.bulletinAds,
    SUPPORT_REQUEST_PERMISSION_KEYS.subtitles,
    SUPPORT_REQUEST_PERMISSION_KEYS.visits,
  ])
    .input(z.object({
      kind: supportBoardIntroKindSchema,
      description: z.string().trim().max(500, "안내 문구는 500자 이하로 입력해주세요."),
    }))
    .mutation(async ({ input, ctx }) => {
      if (!canManageSupportBoardIntro(ctx.user, input.kind)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "이 신청 게시판의 안내 문구를 수정할 권한이 없습니다." });
      }
      return upsertSiteSetting(SUPPORT_BOARD_INTRO_SETTING_KEYS[input.kind], input.description);
    }),

  listPrayer: supportRequestRootProcedure.query(() => listPrayerRequests()),
  listNewMembers: supportRequestProcedure("newMembers").query(() => listNewMemberRequests()),
  listVisits: supportRequestProcedure("visits").query(() => listVisitRequests()),
  listSubtitles: supportRequestProcedure("subtitles").query(() => listSubtitleRequests()),
  listBulletinAds: supportRequestProcedure("bulletinAds").query(() => listBulletinAdRequests()),

  updatePrayerStatus: supportRequestRootProcedure
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

  updateNewMemberStatus: supportRequestProcedure("newMembers")
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

  updateVisitStatus: supportRequestProcedure("visits")
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

  updateSubtitleStatus: supportRequestProcedure("subtitles")
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

  updateBulletinAdStatus: supportRequestProcedure("bulletinAds")
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
