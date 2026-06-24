/**
 * 공개 접수 라우터 (support)
 * - 기도 요청
 * - 새가족 등록 문의
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { memberProtectedProcedure, publicProcedure, router } from "../_core/trpc";
import { storagePut } from "../storage";
import {
  createBulletinAdRequest,
  createNewMemberRequest,
  createPrayerRequest,
  createSubtitleRequest,
  createVisitRequest,
  getMemberById,
  listPublicBulletinAdRequests,
  listPublicSubtitleRequests,
  listPublicVisitRequests,
} from "../db";

const requiredText = (max: number, message: string) =>
  z.string().trim().min(1, message).max(max);

const prayerCategorySchema = z.enum([
  "개인기도",
  "가정기도",
  "건강기도",
  "사업기도",
  "자녀기도",
  "기타",
]);

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
  .regex(/^\d{4}-\d{2}-\d{2}$/, "방문 희망일을 선택해 주세요.");

const timeSchema = z
  .string()
  .trim()
  .regex(/^\d{2}:\d{2}$/, "방문 희망 시간을 선택해 주세요.")
  .optional();

const visitorTypeSchema = z.enum(["church", "institution", "individual", "other"]);

const subtitleAttachmentSchema = z.object({
  fileName: z.string().trim().min(1).max(255),
  mimeType: z.string().trim().min(1).max(128),
  base64: z.string().min(1),
}).optional();

const subtitleDateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "자막이 필요한 날짜를 선택해 주세요.")
  .optional();

const bulletinAdDateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "광고 게재 희망일을 선택해 주세요.")
  .optional();

const MAX_SUBTITLE_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const ALLOWED_SUBTITLE_ATTACHMENT_EXTS = new Set([
  "pdf",
  "doc",
  "docx",
  "hwp",
  "hwpx",
  "txt",
  "jpg",
  "jpeg",
  "png",
]);

function sanitizeFileName(fileName: string) {
  return fileName
    .replace(/[\\/]/g, "_")
    .replace(/[^a-zA-Z0-9가-힣._ -]/g, "_")
    .replace(/\s+/g, "_")
    .replace(/_{2,}/g, "_")
    .slice(0, 120);
}

function getFileExt(fileName: string) {
  const lastPart = fileName.split(/[\\/]/).pop() ?? "";
  const ext = lastPart.includes(".") ? lastPart.split(".").pop()?.toLowerCase() : "";
  return ext && ALLOWED_SUBTITLE_ATTACHMENT_EXTS.has(ext) ? ext : null;
}

function decodeAttachmentBase64(base64: string) {
  const normalized = base64.trim().replace(/^data:[^;]+;base64,/, "");
  if (!normalized || normalized.length % 4 === 1 || /[^A-Za-z0-9+/=]/.test(normalized)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "첨부파일 데이터가 올바르지 않습니다." });
  }
  const buffer = Buffer.from(normalized, "base64");
  if (buffer.length === 0) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "빈 파일은 업로드할 수 없습니다." });
  }
  if (buffer.length > MAX_SUBTITLE_ATTACHMENT_BYTES) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "첨부파일은 최대 10MB까지 업로드할 수 있습니다." });
  }
  return buffer;
}

async function saveSubtitleAttachment(attachment: z.infer<typeof subtitleAttachmentSchema>) {
  if (!attachment) return null;
  const ext = getFileExt(attachment.fileName);
  if (!ext) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "첨부파일은 PDF, DOC, DOCX, HWP, HWPX, TXT, JPG, PNG 형식만 가능합니다.",
    });
  }

  const buffer = decodeAttachmentBase64(attachment.base64);
  const baseName = attachment.fileName.replace(/\.[^.]+$/, "");
  const safeName = sanitizeFileName(baseName) || "subtitle-request";
  const key = `subtitle-requests/${Date.now()}-${Math.random().toString(36).slice(2)}-${safeName}.${ext}`;
  const { url } = await storagePut(key, buffer, attachment.mimeType || "application/octet-stream");
  return {
    attachmentName: attachment.fileName,
    attachmentUrl: url,
    attachmentSize: buffer.length,
    attachmentMime: attachment.mimeType,
  };
}

async function saveBulletinAdAttachment(attachment: z.infer<typeof subtitleAttachmentSchema>) {
  if (!attachment) return null;
  const ext = getFileExt(attachment.fileName);
  if (!ext) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "첨부파일은 PDF, DOC, DOCX, HWP, HWPX, TXT, JPG, PNG 형식만 가능합니다.",
    });
  }

  const buffer = decodeAttachmentBase64(attachment.base64);
  const baseName = attachment.fileName.replace(/\.[^.]+$/, "");
  const safeName = sanitizeFileName(baseName) || "bulletin-ad-request";
  const key = `bulletin-ad-requests/${Date.now()}-${Math.random().toString(36).slice(2)}-${safeName}.${ext}`;
  const { url } = await storagePut(key, buffer, attachment.mimeType || "application/octet-stream");
  return {
    attachmentName: attachment.fileName,
    attachmentUrl: url,
    attachmentSize: buffer.length,
    attachmentMime: attachment.mimeType,
  };
}

export const supportRouter = router({
  listSubtitles: publicProcedure.query(() => listPublicSubtitleRequests()),

  listBulletinAds: publicProcedure.query(() => listPublicBulletinAdRequests()),

  listVisits: publicProcedure.query(() => listPublicVisitRequests()),

  submitPrayer: publicProcedure
    .input(
      z.object({
        name: requiredText(64, "이름을 입력해 주세요."),
        category: prayerCategorySchema,
        content: requiredText(2000, "기도 내용을 입력해 주세요."),
      })
    )
    .mutation(async ({ input }) => {
      await createPrayerRequest(input);
      return { ok: true };
    }),

  submitNewMember: publicProcedure
    .input(
      z.object({
        name: requiredText(64, "이름을 입력해 주세요."),
        phone: phoneSchema,
        age: z.number().int().min(0).max(120).nullable().optional(),
        address: z.string().trim().max(256).optional(),
        how: z.string().trim().max(64).optional(),
      })
    )
    .mutation(async ({ input }) => {
      await createNewMemberRequest({
        ...input,
        address: input.address || null,
        how: input.how || null,
      });
      return { ok: true };
    }),

  submitVisit: publicProcedure
    .input(
      z.object({
        organizationName: requiredText(128, "교회명 또는 단체명을 입력해 주세요."),
        applicantName: requiredText(64, "신청자 이름을 입력해 주세요."),
        phone: phoneSchema,
        email: optionalEmailSchema,
        visitDate: dateSchema,
        visitTime: timeSchema,
        headcount: z.number().int().min(1, "방문 인원을 입력해 주세요.").max(500, "방문 인원이 너무 많습니다."),
        visitorType: visitorTypeSchema,
        purpose: requiredText(128, "탐방 목적을 입력해 주세요."),
        message: z.string().trim().max(2000).optional(),
      })
    )
    .mutation(async ({ input }) => {
      await createVisitRequest({
        ...input,
        email: input.email || null,
        visitTime: input.visitTime || null,
        message: input.message || null,
      });
      return { ok: true };
    }),

  submitSubtitle: memberProtectedProcedure
    .input(
      z.object({
        title: requiredText(160, "제목을 입력해 주세요."),
        requestedDate: subtitleDateSchema,
        content: requiredText(3000, "자막 신청 내용을 입력해 주세요."),
        attachment: subtitleAttachmentSchema,
      })
    )
    .mutation(async ({ input, ctx }) => {
      const member = await getMemberById(ctx.memberId);
      if (!member) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "성도 로그인 정보가 확인되지 않습니다." });
      }
      const attachment = await saveSubtitleAttachment(input.attachment);
      await createSubtitleRequest({
        memberId: ctx.memberId,
        title: input.title,
        authorName: member.name || ctx.memberName,
        phone: member.phone || "",
        email: member.email || null,
        requestedDate: input.requestedDate || null,
        content: input.content,
        attachmentName: attachment?.attachmentName ?? null,
        attachmentUrl: attachment?.attachmentUrl ?? null,
        attachmentSize: attachment?.attachmentSize ?? null,
        attachmentMime: attachment?.attachmentMime ?? null,
      });
      return { ok: true };
    }),

  submitBulletinAd: memberProtectedProcedure
    .input(
      z.object({
        title: requiredText(160, "제목을 입력해 주세요."),
        requestedDate: bulletinAdDateSchema,
        content: requiredText(3000, "주보 광고 신청 내용을 입력해 주세요."),
        attachment: subtitleAttachmentSchema,
      })
    )
    .mutation(async ({ input, ctx }) => {
      const member = await getMemberById(ctx.memberId);
      if (!member) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "성도 로그인 정보가 확인되지 않습니다." });
      }
      const attachment = await saveBulletinAdAttachment(input.attachment);
      await createBulletinAdRequest({
        memberId: ctx.memberId,
        title: input.title,
        authorName: member.name || ctx.memberName,
        phone: member.phone || null,
        email: member.email || null,
        requestedDate: input.requestedDate || null,
        content: input.content,
        attachmentName: attachment?.attachmentName ?? null,
        attachmentUrl: attachment?.attachmentUrl ?? null,
        attachmentSize: attachment?.attachmentSize ?? null,
        attachmentMime: attachment?.attachmentMime ?? null,
      });
      return { ok: true };
    }),
});
