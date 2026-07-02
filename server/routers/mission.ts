/**
 * 선교보고 공개/작성자 라우터 (mission)
 * ─────────────────────────────────────────────────────────────────────────────
 * 공개 화면 조회와 성도 작성자 기능을 담당합니다.
 * 관리자 승인/권한 관리는 cms.missionReports 라우터에서 처리합니다.
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { publicProcedure, router } from "../_core/trpc";
import { hasAdminContentPermission } from "../db/adminPermissions";
import {
  createMissionReportWithDetails,
  getMissionAuthorGrantsForMember,
  getMissionReportById,
  getMissionReportsByAuthor,
  getOtherPublishedReportsByMissionary,
  getPublishedMissionReportById,
  getPublishedMissionReports,
  getVisibleMissionaries,
  hasMissionWriteAccess,
  updateMissionReportWithDetails,
} from "../db";
import { validateImage } from "./cms/upload";
import { storagePut } from "../storage";
import { safeAssetUrlSchema } from "../_core/contentValidation";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const idSchema = z.number().int().positive();
const optionalText = (max: number) => z.string().trim().max(max).optional();
const requiredText = (max: number, message: string) => z.string().trim().min(1, message).max(max);
const safeImageUrl = safeAssetUrlSchema.optional();
const MISSION_REPORT_PERMISSION_KEY = "content:missionReports";
const ADMIN_MISSION_REPORT_AUTHOR_MEMBER_ID = 0;

const imageInputSchema = z.object({
  imageUrl: safeImageUrl,
  caption: optionalText(128),
}).refine(value => Boolean(value.imageUrl), "이미지 URL이 필요합니다.");

const reportPayloadSchema = z.object({
  missionaryId: idSchema,
  title: requiredText(256, "제목을 입력해주세요."),
  summary: optionalText(2000),
  content: optionalText(50000),
  thumbnailUrl: safeImageUrl,
  reportDate: z.string().regex(DATE_RE, "보고 날짜 형식이 올바르지 않습니다."),
  images: z.array(imageInputSchema).max(20).default([]),
  prayerTopics: z.array(requiredText(512, "기도제목을 입력해주세요.")).max(20).default([]),
  submitForReview: z.boolean().default(true),
});

function normalizeImages(images: z.infer<typeof imageInputSchema>[]) {
  return images
    .filter((img): img is { imageUrl: string; caption?: string } => Boolean(img.imageUrl))
    .map((img, index) => ({
      imageUrl: img.imageUrl,
      caption: img.caption || undefined,
      sortOrder: index,
    }));
}

function normalizePrayerTopics(topics: string[]) {
  return topics
    .map(topic => topic.trim())
    .filter(Boolean)
    .map((content, index) => ({ content, sortOrder: index }));
}

function canManageMissionReports(user: Parameters<typeof hasAdminContentPermission>[0]) {
  return hasAdminContentPermission(user, MISSION_REPORT_PERMISSION_KEY);
}

function getMissionReportAuthorMemberId(ctx: { user: Parameters<typeof hasAdminContentPermission>[0]; memberId: number | null }) {
  if (ctx.memberId) return ctx.memberId;
  if (canManageMissionReports(ctx.user)) return ADMIN_MISSION_REPORT_AUTHOR_MEMBER_ID;
  throw new TRPCError({ code: "UNAUTHORIZED", message: "로그인이 필요합니다." });
}

export const missionRouter = router({
  missionaries: publicProcedure.query(() => getVisibleMissionaries()),

  reports: publicProcedure.query(() => getPublishedMissionReports()),

  report: publicProcedure
    .input(z.object({ id: idSchema }))
    .query(async ({ input }) => {
      const report = await getPublishedMissionReportById(input.id);
      if (!report) return null;
      const related = await getOtherPublishedReportsByMissionary(report.missionaryId, report.id, 2);
      const all = await getPublishedMissionReports();
      const index = all.findIndex(item => item.id === report.id);
      return {
        report,
        related,
        prevReport: index > 0 ? all[index - 1] : null,
        nextReport: index >= 0 && index < all.length - 1 ? all[index + 1] : null,
      };
    }),

  myAuthorGrants: publicProcedure.query(({ ctx }) => {
    if (!ctx.memberId) return [];
    return getMissionAuthorGrantsForMember(ctx.memberId);
  }),

  myReports: publicProcedure.query(({ ctx }) => {
    if (!ctx.memberId) return [];
    return getMissionReportsByAuthor(ctx.memberId);
  }),

  createReport: publicProcedure
    .input(reportPayloadSchema)
    .mutation(async ({ input, ctx }) => {
      const canManage = canManageMissionReports(ctx.user);
      const authorMemberId = getMissionReportAuthorMemberId(ctx);
      const canWrite = canManage || await hasMissionWriteAccess(authorMemberId, input.missionaryId);
      if (!canWrite) {
        throw new TRPCError({ code: "FORBIDDEN", message: "해당 선교보고 작성 권한이 없습니다." });
      }
      const id = await createMissionReportWithDetails(
        {
          missionaryId: input.missionaryId,
          authorMemberId,
          title: input.title,
          summary: input.summary || undefined,
          content: input.content || undefined,
          thumbnailUrl: input.thumbnailUrl || undefined,
          reportDate: input.reportDate,
          status: input.submitForReview ? "pending" : "draft",
        },
        normalizeImages(input.images),
        normalizePrayerTopics(input.prayerTopics),
      );
      if (!id) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "선교보고 저장에 실패했습니다." });
      }
      return { id };
    }),

  updateReport: publicProcedure
    .input(reportPayloadSchema.extend({ id: idSchema }))
    .mutation(async ({ input, ctx }) => {
      const report = await getMissionReportById(input.id);
      if (!report) {
        throw new TRPCError({ code: "NOT_FOUND", message: "선교보고를 찾을 수 없습니다." });
      }
      const canManage = canManageMissionReports(ctx.user);
      const authorMemberId = getMissionReportAuthorMemberId(ctx);
      if (report.authorMemberId !== authorMemberId && !canManage) {
        throw new TRPCError({ code: "FORBIDDEN", message: "본인이 작성한 선교보고만 수정할 수 있습니다." });
      }
      const canWrite = canManage || await hasMissionWriteAccess(authorMemberId, input.missionaryId);
      if (!canWrite) {
        throw new TRPCError({ code: "FORBIDDEN", message: "해당 선교보고 작성 권한이 없습니다." });
      }
      await updateMissionReportWithDetails(
        input.id,
        {
          missionaryId: input.missionaryId,
          title: input.title,
          summary: input.summary || undefined,
          content: input.content || undefined,
          thumbnailUrl: input.thumbnailUrl || undefined,
          reportDate: input.reportDate,
          status: input.submitForReview ? "pending" : "draft",
          reviewComment: null,
        },
        normalizeImages(input.images),
        normalizePrayerTopics(input.prayerTopics),
      );
      return { success: true };
    }),

  uploadImage: publicProcedure
    .input(z.object({
      base64: z.string(),
      fileName: z.string(),
      mimeType: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      const canManage = canManageMissionReports(ctx.user);
      const authorMemberId = getMissionReportAuthorMemberId(ctx);
      const grants = await getMissionAuthorGrantsForMember(authorMemberId);
      if (!canManage && grants.length === 0) {
        throw new TRPCError({ code: "FORBIDDEN", message: "선교보고 작성 권한이 없습니다." });
      }
      const { buffer, ext } = validateImage(input.base64, input.mimeType);
      const key = `mission-reports/${authorMemberId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { url } = await storagePut(key, buffer, input.mimeType);
      return { url };
    }),
});
