/**
 * 선교보고 관리자 라우터 (cms.missionReports)
 * ─────────────────────────────────────────────────────────────────────────────
 * 담당 기능:
 *   - 선교사/사역지 관리
 *   - 작성자 권한 부여/회수
 *   - 선교보고 목록 조회 및 승인/반려/수정
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { adminPermissionProcedure, router } from "../../_core/trpc";
import {
  optionalTextSchema,
  requiredTextSchema,
  safeAssetUrlSchema,
} from "../../_core/contentValidation";
import {
  createMissionAuthorGrant,
  createMissionAuthorGrants,
  createMissionReportWithDetails,
  createMissionary,
  deleteMissionAuthorGrant,
  deleteMissionary,
  deleteMissionReport,
  getAllMissionaries,
  getAllMembers,
  getMissionReportById,
  getAllMissionReports,
  getMissionAuthorGrants,
  reorderMissionaries,
  updateMissionAuthorGrant,
  updateMissionReportStatus,
  updateMissionReportWithDetails,
  updateMissionary,
} from "../../db";
import { validateAttachment, validateImage } from "./upload";
import { storagePut } from "../../storage";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const idSchema = z.number().int().positive();
const continentSchema = z.enum(["asia", "africa", "americas", "europe", "oceania"]);
const reportStatusSchema = z.enum(["draft", "pending", "published", "rejected"]);
const missionReportProcedure = adminPermissionProcedure("content:missionReports");
const MISSION_ATTACHMENT_MAX_BYTES = 1 * 1024 * 1024;

const imageSchema = z.object({
  imageUrl: safeAssetUrlSchema,
  caption: optionalTextSchema(128),
});

const fileSchema = z.object({
  fileName: requiredTextSchema(256, "첨부파일 이름이 필요합니다."),
  fileUrl: safeAssetUrlSchema,
  fileSize: z.number().int().min(0).optional(),
  mimeType: optionalTextSchema(128),
});

const reportInputSchema = z.object({
  missionaryId: idSchema,
  authorMemberId: idSchema.optional(),
  title: requiredTextSchema(256, "제목을 입력해주세요."),
  summary: optionalTextSchema(2000),
  content: optionalTextSchema(50000),
  thumbnailUrl: safeAssetUrlSchema.optional(),
  reportDate: z.string().regex(DATE_RE, "보고 날짜 형식이 올바르지 않습니다."),
  status: reportStatusSchema.default("published"),
  images: z.array(imageSchema).max(100).default([]),
  files: z.array(fileSchema).max(20).default([]),
  prayerTopics: z.array(requiredTextSchema(512, "기도제목을 입력해주세요.")).max(20).default([]),
});

function normalizeImages(images: z.infer<typeof imageSchema>[]) {
  return images
    .filter(image => Boolean(image.imageUrl))
    .map((image, index) => ({
      imageUrl: image.imageUrl,
      caption: image.caption || undefined,
      sortOrder: index,
    }));
}

function normalizePrayerTopics(prayerTopics: string[]) {
  return prayerTopics
    .map(topic => topic.trim())
    .filter(Boolean)
    .map((content, index) => ({ content, sortOrder: index }));
}

function normalizeFiles(files: z.infer<typeof fileSchema>[]) {
  return files
    .filter(file => Boolean(file.fileUrl))
    .map((file, index) => ({
      fileName: file.fileName,
      fileUrl: file.fileUrl,
      fileSize: file.fileSize,
      mimeType: file.mimeType || undefined,
      sortOrder: index,
    }));
}

export const missionReportsRouter = router({
  missionaries: missionReportProcedure.query(() => getAllMissionaries()),
  members: missionReportProcedure.query(async () => {
    const members = await getAllMembers();
    return members.map((member) => ({
      id: member.id,
      name: member.name,
      phone: member.phone,
      email: member.email,
      position: member.position,
      department: member.department,
      district: member.district,
      status: member.status,
    }));
  }),
  report: missionReportProcedure
    .input(z.object({ id: idSchema }))
    .query(({ input }) => getMissionReportById(input.id)),

  createMissionary: missionReportProcedure
    .input(z.object({
      name: requiredTextSchema(128, "선교사/사역 이름을 입력해주세요."),
      region: requiredTextSchema(128, "사역 지역을 입력해주세요."),
      continent: continentSchema.default("asia"),
      sentYear: z.number().int().min(0).max(9999).default(0),
      profileImage: safeAssetUrlSchema.optional(),
      organization: optionalTextSchema(128),
      description: optionalTextSchema(20000),
      isActive: z.boolean().default(true),
      sortOrder: z.number().int().min(0).max(10000).default(0),
    }))
    .mutation(({ input }) => createMissionary(input)),

  updateMissionary: missionReportProcedure
    .input(z.object({
      id: idSchema,
      name: requiredTextSchema(128, "선교사/사역 이름을 입력해주세요.").optional(),
      region: requiredTextSchema(128, "사역 지역을 입력해주세요.").optional(),
      continent: continentSchema.optional(),
      sentYear: z.number().int().min(0).max(9999).optional(),
      profileImage: safeAssetUrlSchema.nullable().optional(),
      organization: optionalTextSchema(128),
      description: optionalTextSchema(20000),
      isActive: z.boolean().optional(),
      sortOrder: z.number().int().min(0).max(10000).optional(),
    }))
    .mutation(({ input }) => {
      const { id, ...data } = input;
      return updateMissionary(id, data);
    }),

  reorderMissionaries: missionReportProcedure
    .input(z.object({
      items: z.array(z.object({
        id: idSchema,
        sortOrder: z.number().int().min(1).max(10000),
      })).min(1).max(1000),
    }))
    .mutation(({ input }) => reorderMissionaries(input.items)),

  deleteMissionary: missionReportProcedure
    .input(z.object({ id: idSchema }))
    .mutation(async ({ input }) => {
      const result = await deleteMissionary(input.id);
      if (!result.deleted) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: result.reason ?? "선교사/사역지를 삭제하지 못했습니다.",
        });
      }
      return result;
    }),

  authorGrants: missionReportProcedure.query(() => getMissionAuthorGrants()),

  createAuthorGrant: missionReportProcedure
    .input(z.object({
      memberId: idSchema,
      missionaryId: idSchema,
    }))
    .mutation(({ input, ctx }) =>
      createMissionAuthorGrant({ ...input, canWrite: true, createdBy: ctx.user.id })
    ),

  createAuthorGrants: missionReportProcedure
    .input(z.object({
      memberId: idSchema,
      missionaryIds: z.array(idSchema).min(1).max(1000),
    }))
    .mutation(({ input, ctx }) =>
      createMissionAuthorGrants({
        memberId: input.memberId,
        missionaryIds: input.missionaryIds,
        createdBy: ctx.user.id,
      })
    ),

  updateAuthorGrant: missionReportProcedure
    .input(z.object({
      id: idSchema,
      canWrite: z.boolean(),
    }))
    .mutation(({ input }) => updateMissionAuthorGrant(input.id, { canWrite: input.canWrite })),

  deleteAuthorGrant: missionReportProcedure
    .input(z.object({ id: idSchema }))
    .mutation(({ input }) => deleteMissionAuthorGrant(input.id)),

  reports: missionReportProcedure.query(() => getAllMissionReports()),

  uploadImage: missionReportProcedure
    .input(z.object({
      base64: z.string(),
      fileName: z.string(),
      mimeType: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { buffer, ext } = validateImage(input.base64, input.mimeType);
      const key = `mission-reports/admin-${ctx.user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { url } = await storagePut(key, buffer, input.mimeType);
      return { url };
    }),

  uploadFile: missionReportProcedure
    .input(z.object({
      base64: z.string(),
      fileName: z.string(),
      mimeType: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { buffer, ext, mimeType } = validateAttachment(
        input.base64,
        input.fileName,
        input.mimeType,
        MISSION_ATTACHMENT_MAX_BYTES,
      );
      const safeName = input.fileName
        .replace(/\.[^.]+$/, "")
        .replace(/[^a-zA-Z0-9가-힣._-]/g, "_")
        .slice(0, 80);
      const key = `mission-report-files/admin-${ctx.user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}-${safeName}.${ext}`;
      const { url } = await storagePut(key, buffer, mimeType);
      return { url, fileName: input.fileName, fileSize: buffer.length, mimeType };
    }),

  createReport: missionReportProcedure
    .input(reportInputSchema)
    .mutation(({ input }) =>
      createMissionReportWithDetails(
        {
          missionaryId: input.missionaryId,
          authorMemberId: input.authorMemberId,
          title: input.title,
          summary: input.summary || undefined,
          content: input.content || undefined,
          thumbnailUrl: input.thumbnailUrl || undefined,
          reportDate: input.reportDate,
          status: input.status,
          publishedAt: input.status === "published" ? new Date() : undefined,
        },
        normalizeImages(input.images),
        normalizeFiles(input.files),
        normalizePrayerTopics(input.prayerTopics),
      )
    ),

  updateReport: missionReportProcedure
    .input(reportInputSchema.extend({ id: idSchema }))
    .mutation(({ input }) => {
      const { id, ...data } = input;
      return updateMissionReportWithDetails(
        id,
        {
          missionaryId: data.missionaryId,
          authorMemberId: data.authorMemberId,
          title: data.title,
          summary: data.summary || undefined,
          content: data.content || undefined,
          thumbnailUrl: data.thumbnailUrl || undefined,
          reportDate: data.reportDate,
          status: data.status,
          publishedAt: data.status === "published" ? new Date() : undefined,
        },
        normalizeImages(data.images),
        normalizeFiles(data.files),
        normalizePrayerTopics(data.prayerTopics),
      );
    }),

  reviewReport: missionReportProcedure
    .input(z.object({
      id: idSchema,
      status: z.enum(["published", "rejected", "pending", "draft"]),
      comment: optionalTextSchema(20000),
    }))
    .mutation(({ input, ctx }) => {
      // missionReportProcedure has already verified the mission-report management permission.
      return updateMissionReportStatus(input.id, input.status, ctx.user.id, input.comment);
    }),

  deleteReport: missionReportProcedure
    .input(z.object({ id: idSchema }))
    .mutation(({ input }) => deleteMissionReport(input.id)),
});
