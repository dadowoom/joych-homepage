/**
 * 선교보고 관리자 라우터 (cms.missionReports)
 * ─────────────────────────────────────────────────────────────────────────────
 * 담당 기능:
 *   - 선교사/사역지 관리
 *   - 작성자 권한 부여/회수
 *   - 선교보고 목록 조회 및 승인/반려/수정
 */

import { z } from "zod";
import { adminProcedure, router } from "../../_core/trpc";
import {
  optionalTextSchema,
  requiredTextSchema,
  safeAssetUrlSchema,
} from "../../_core/contentValidation";
import {
  createMissionAuthorGrant,
  createMissionReportWithDetails,
  createMissionary,
  getAllMissionaries,
  getAllMissionReports,
  getMissionAuthorGrants,
  updateMissionAuthorGrant,
  updateMissionReportStatus,
  updateMissionReportWithDetails,
  updateMissionary,
} from "../../db";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const idSchema = z.number().int().positive();
const continentSchema = z.enum(["asia", "africa", "americas", "europe", "oceania"]);
const reportStatusSchema = z.enum(["draft", "pending", "published", "rejected"]);

const imageSchema = z.object({
  imageUrl: safeAssetUrlSchema,
  caption: optionalTextSchema(128),
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
  images: z.array(imageSchema).max(20).default([]),
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

export const missionReportsRouter = router({
  missionaries: adminProcedure.query(() => getAllMissionaries()),

  createMissionary: adminProcedure
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

  updateMissionary: adminProcedure
    .input(z.object({
      id: idSchema,
      name: requiredTextSchema(128, "선교사/사역 이름을 입력해주세요.").optional(),
      region: requiredTextSchema(128, "사역 지역을 입력해주세요.").optional(),
      continent: continentSchema.optional(),
      sentYear: z.number().int().min(0).max(9999).optional(),
      profileImage: safeAssetUrlSchema.optional(),
      organization: optionalTextSchema(128),
      description: optionalTextSchema(20000),
      isActive: z.boolean().optional(),
      sortOrder: z.number().int().min(0).max(10000).optional(),
    }))
    .mutation(({ input }) => {
      const { id, ...data } = input;
      return updateMissionary(id, data);
    }),

  authorGrants: adminProcedure.query(() => getMissionAuthorGrants()),

  createAuthorGrant: adminProcedure
    .input(z.object({
      memberId: idSchema,
      missionaryId: idSchema,
    }))
    .mutation(({ input, ctx }) =>
      createMissionAuthorGrant({ ...input, canWrite: true, createdBy: ctx.user.id })
    ),

  updateAuthorGrant: adminProcedure
    .input(z.object({
      id: idSchema,
      canWrite: z.boolean(),
    }))
    .mutation(({ input }) => updateMissionAuthorGrant(input.id, { canWrite: input.canWrite })),

  reports: adminProcedure.query(() => getAllMissionReports()),

  createReport: adminProcedure
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
        normalizePrayerTopics(input.prayerTopics),
      )
    ),

  updateReport: adminProcedure
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
        normalizePrayerTopics(data.prayerTopics),
      );
    }),

  reviewReport: adminProcedure
    .input(z.object({
      id: idSchema,
      status: z.enum(["published", "rejected", "pending", "draft"]),
      comment: optionalTextSchema(20000),
    }))
    .mutation(({ input, ctx }) =>
      updateMissionReportStatus(input.id, input.status, ctx.user.id, input.comment)
    ),
});
