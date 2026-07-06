/**
 * 관리자 접수 관리 라우터 (cms.supportRequests)
 */

import { z } from "zod";
import {
  SUPPORT_REQUEST_PERMISSION_KEYS,
  SUPPORT_REQUEST_ROOT_PERMISSION_KEY,
  type SupportRequestPermissionKind,
} from "@shared/adminPermissions";
import { adminAnyPermissionProcedure, router } from "../../_core/trpc";
import {
  deleteBulletinAdRequest,
  deleteSubtitleRequest,
  deleteVisitRequest,
  listBulletinAdRequests,
  listNewMemberRequests,
  listPrayerRequests,
  listSubtitleRequests,
  listVisitRequests,
  updateBulletinAdRequest,
  updateBulletinAdRequestStatus,
  updateSubtitleRequest,
  updateNewMemberRequestStatus,
  updatePrayerRequestStatus,
  updateVisitRequest,
  updateSubtitleRequestStatus,
  updateVisitRequestStatus,
} from "../../db";

const adminMemoSchema = z.string().trim().max(1000).nullable().optional();
const requiredText = (max: number, message: string) =>
  z.string().trim().min(1, message).max(max);
const phoneSchema = z
  .string()
  .trim()
  .min(1, "연락처를 입력해 주세요.")
  .max(32)
  .regex(/^[0-9+()\-\s]+$/, "연락처 형식이 올바르지 않습니다.");
const optionalEmailSchema = z
  .string()
  .trim()
  .max(320)
  .optional()
  .refine((value) => !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value), "이메일 형식이 올바르지 않습니다.");
const dateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "날짜 형식이 올바르지 않습니다.");
const timeSchema = z
  .string()
  .trim()
  .regex(/^\d{2}:\d{2}$/, "시간 형식이 올바르지 않습니다.")
  .optional();
const visitorTypeSchema = z.enum(["church", "institution", "individual", "other"]);

function supportRequestProcedure(kind: SupportRequestPermissionKind) {
  return adminAnyPermissionProcedure([
    SUPPORT_REQUEST_ROOT_PERMISSION_KEY,
    SUPPORT_REQUEST_PERMISSION_KEYS[kind],
  ]);
}

const supportRequestRootProcedure = adminAnyPermissionProcedure([
  SUPPORT_REQUEST_ROOT_PERMISSION_KEY,
]);

export const supportRequestsRouter = router({
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

  updateVisit: supportRequestProcedure("visits")
    .input(
      z.object({
        id: z.number().int().positive(),
        organizationName: requiredText(128, "교회명 또는 단체명을 입력해 주세요."),
        applicantName: requiredText(64, "신청자 이름을 입력해 주세요."),
        phone: phoneSchema,
        email: optionalEmailSchema,
        visitDate: dateSchema,
        visitTime: timeSchema,
        headcount: z.number().int().min(1).max(500),
        visitorType: visitorTypeSchema,
        purpose: requiredText(128, "방문 목적을 입력해 주세요."),
        message: z.string().trim().max(2000).optional(),
        status: z.enum(["new", "contacted", "scheduled", "completed", "archived"]),
        adminMemo: adminMemoSchema,
      })
    )
    .mutation(({ input }) =>
      updateVisitRequest(input.id, {
        organizationName: input.organizationName,
        applicantName: input.applicantName,
        phone: input.phone,
        email: input.email || null,
        visitDate: input.visitDate,
        visitTime: input.visitTime || null,
        headcount: input.headcount,
        visitorType: input.visitorType,
        purpose: input.purpose,
        message: input.message || null,
        status: input.status,
        adminMemo: input.adminMemo,
      })
    ),

  deleteVisit: supportRequestProcedure("visits")
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(({ input }) => deleteVisitRequest(input.id)),

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

  updateSubtitle: supportRequestProcedure("subtitles")
    .input(
      z.object({
        id: z.number().int().positive(),
        title: requiredText(160, "제목을 입력해 주세요."),
        requestedDate: dateSchema.optional(),
        content: requiredText(3000, "자막 요청 내용을 입력해 주세요."),
        status: z.enum(["new", "reviewed", "completed", "archived"]),
        adminMemo: adminMemoSchema,
      })
    )
    .mutation(({ input }) =>
      updateSubtitleRequest(input.id, {
        title: input.title,
        requestedDate: input.requestedDate || null,
        content: input.content,
        status: input.status,
        adminMemo: input.adminMemo,
      })
    ),

  deleteSubtitle: supportRequestProcedure("subtitles")
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(({ input }) => deleteSubtitleRequest(input.id)),

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

  updateBulletinAd: supportRequestProcedure("bulletinAds")
    .input(
      z.object({
        id: z.number().int().positive(),
        title: requiredText(160, "제목을 입력해 주세요."),
        requestedDate: dateSchema.optional(),
        content: requiredText(3000, "주보 광고 요청 내용을 입력해 주세요."),
        status: z.enum(["new", "reviewed", "completed", "archived"]),
        adminMemo: adminMemoSchema,
      })
    )
    .mutation(({ input }) =>
      updateBulletinAdRequest(input.id, {
        title: input.title,
        requestedDate: input.requestedDate || null,
        content: input.content,
        status: input.status,
        adminMemo: input.adminMemo,
      })
    ),

  deleteBulletinAd: supportRequestProcedure("bulletinAds")
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(({ input }) => deleteBulletinAdRequest(input.id)),
});
