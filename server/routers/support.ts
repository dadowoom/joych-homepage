/**
 * 공개 접수 라우터 (support)
 * - 기도 요청
 * - 새가족 등록 문의
 */

import crypto from "node:crypto";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { memberProtectedProcedure, publicProcedure, router } from "../_core/trpc";
import { storagePut } from "../storage";
import {
  archiveMemberBulletinAdRequest,
  archiveMemberSubtitleRequest,
  archiveOwnedVisitRequest,
  createBulletinAdRequest,
  createNewMemberRequest,
  createPrayerRequest,
  createSubtitleRequest,
  createVisitRequest,
  getMemberBulletinAdRequest,
  getMemberById,
  getMemberSubtitleRequest,
  listMemberBulletinAdRequests,
  listMemberSubtitleRequests,
  listOwnedVisitRequests,
  listPublicBulletinAdRequests,
  listPublicSubtitleRequests,
  listPublicVisitRequests,
  updateMemberBulletinAdRequest,
  updateMemberSubtitleRequest,
  updateOwnedVisitRequest,
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

function todayKstDateKey() {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

const futureOrTodayDate = (value: string) => value >= todayKstDateKey();

const dateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "방문 희망일을 선택해 주세요.")
  .refine(futureOrTodayDate, "오늘 이전 날짜는 선택할 수 없습니다.");

const timeSchema = z
  .string()
  .trim()
  .regex(/^\d{2}:\d{2}$/, "방문 희망 시간을 선택해 주세요.")
  .optional();

const visitorTypeSchema = z.enum(["church", "institution", "individual", "other"]);

const visitRequestSchema = z.object({
  organizationName: requiredText(128, "교회명 또는 단체명을 입력해 주세요."),
  applicantName: requiredText(64, "신청자 이름을 입력해 주세요."),
  phone: phoneSchema,
  region: requiredText(128, "지역을 입력해 주세요."),
  denomination: z.string().trim().max(128).optional(),
  email: z.string().trim().email("이메일 형식이 올바르지 않습니다.").max(320),
  visitDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "방문 희망일을 선택해 주세요."),
  visitTime: timeSchema,
  headcount: z.number().int().min(1, "방문 인원을 입력해 주세요.").max(500, "방문 인원이 너무 많습니다."),
  visitorType: visitorTypeSchema,
  purpose: requiredText(128, "탐방 목적을 입력해 주세요."),
  message: z.string().trim().max(2000).optional(),
}).superRefine((value, ctx) => {
  if (value.visitorType === "church" && !value.denomination) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["denomination"],
      message: "교회 방문은 소속 교단을 입력해 주세요.",
    });
  }
});

const newVisitRequestSchema = visitRequestSchema.refine(
  (value) => futureOrTodayDate(value.visitDate),
  { path: ["visitDate"], message: "오늘 이전 날짜는 선택할 수 없습니다." },
);

const manageTokenSchema = z.string().trim().min(32).max(256);

function hashManageToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

const subtitleAttachmentSchema = z.object({
  fileName: z.string().trim().min(1).max(255),
  mimeType: z.string().trim().min(1).max(128),
  base64: z.string().min(1),
}).optional();

const subtitleDateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "자막이 필요한 날짜를 선택해 주세요.")
  .refine(futureOrTodayDate, "오늘 이전 날짜는 선택할 수 없습니다.")
  .optional();

const bulletinAdDateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "광고 게재 희망일을 선택해 주세요.")
  .refine(futureOrTodayDate, "오늘 이전 날짜는 선택할 수 없습니다.")
  .optional();

const editableRequestDateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "날짜 형식이 올바르지 않습니다.")
  .optional();

const MAX_SUBTITLE_ATTACHMENT_BYTES = 1 * 1024 * 1024;
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
    throw new TRPCError({ code: "BAD_REQUEST", message: "첨부파일은 최대 1MB까지 업로드할 수 있습니다." });
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

  mySubtitles: memberProtectedProcedure.query(async ({ ctx }) => {
    const rows = await listMemberSubtitleRequests(ctx.memberId);
    return rows.map(({ memberId: _memberId, ...row }) => row);
  }),

  myBulletinAds: memberProtectedProcedure.query(async ({ ctx }) => {
    const rows = await listMemberBulletinAdRequests(ctx.memberId);
    return rows.map(({ memberId: _memberId, ...row }) => row);
  }),

  myVisits: publicProcedure
    .input(z.object({
      manageTokens: z.array(z.object({
        id: z.number().int().positive(),
        token: manageTokenSchema,
      })).max(50).default([]),
    }))
    .query(async ({ input, ctx }) => {
      const rows = await listOwnedVisitRequests(
        ctx.memberId,
        input.manageTokens.map((entry) => ({
          id: entry.id,
          tokenHash: hashManageToken(entry.token),
        })),
      );
      return rows.map(({ memberId: _memberId, manageTokenHash: _manageTokenHash, ...row }) => row);
    }),

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
    .input(newVisitRequestSchema)
    .mutation(async ({ input, ctx }) => {
      const manageToken = crypto.randomBytes(32).toString("base64url");
      const requestId = await createVisitRequest({
        ...input,
        memberId: ctx.memberId ?? null,
        manageTokenHash: hashManageToken(manageToken),
        denomination: input.denomination || null,
        visitTime: input.visitTime || null,
        message: input.message || null,
      });
      return { ok: true, requestId, manageToken };
    }),

  updateMyVisit: publicProcedure
    .input(visitRequestSchema.and(z.object({
      id: z.number().int().positive(),
      manageToken: manageTokenSchema.optional(),
    })))
    .mutation(async ({ input, ctx }) => {
      const updated = await updateOwnedVisitRequest(
        input.id,
        ctx.memberId,
        input.manageToken ? hashManageToken(input.manageToken) : null,
        {
          organizationName: input.organizationName,
          applicantName: input.applicantName,
          phone: input.phone,
          region: input.region,
          denomination: input.denomination || null,
          email: input.email,
          visitDate: input.visitDate,
          visitTime: input.visitTime || null,
          headcount: input.headcount,
          visitorType: input.visitorType,
          purpose: input.purpose,
          message: input.message || null,
        },
      );
      if (!updated) {
        throw new TRPCError({ code: "FORBIDDEN", message: "본인이 신청한 탐방신청만 수정할 수 있습니다." });
      }
      return { ok: true };
    }),

  deleteMyVisit: publicProcedure
    .input(z.object({
      id: z.number().int().positive(),
      manageToken: manageTokenSchema.optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const archived = await archiveOwnedVisitRequest(
        input.id,
        ctx.memberId,
        input.manageToken ? hashManageToken(input.manageToken) : null,
      );
      if (!archived) {
        throw new TRPCError({ code: "FORBIDDEN", message: "본인이 신청한 탐방신청만 삭제할 수 있습니다." });
      }
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

  updateMySubtitle: memberProtectedProcedure
    .input(z.object({
      id: z.number().int().positive(),
      title: requiredText(160, "제목을 입력해 주세요."),
      requestedDate: editableRequestDateSchema,
      content: requiredText(3000, "자막 신청 내용을 입력해 주세요."),
      attachment: subtitleAttachmentSchema,
      removeAttachment: z.boolean().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const existing = await getMemberSubtitleRequest(input.id, ctx.memberId);
      if (!existing) {
        throw new TRPCError({ code: "FORBIDDEN", message: "본인이 신청한 자막 신청만 수정할 수 있습니다." });
      }
      const savedAttachment = input.attachment
        ? await saveSubtitleAttachment(input.attachment)
        : undefined;
      const updated = await updateMemberSubtitleRequest(input.id, ctx.memberId, {
        title: input.title,
        requestedDate: input.requestedDate || null,
        content: input.content,
        attachment: savedAttachment ?? (input.removeAttachment ? null : undefined),
      });
      if (!updated) {
        throw new TRPCError({ code: "CONFLICT", message: "자막 신청을 수정하지 못했습니다. 새로고침 후 다시 시도해주세요." });
      }
      return { ok: true };
    }),

  deleteMySubtitle: memberProtectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      const archived = await archiveMemberSubtitleRequest(input.id, ctx.memberId);
      if (!archived) {
        throw new TRPCError({ code: "FORBIDDEN", message: "본인이 신청한 자막 신청만 삭제할 수 있습니다." });
      }
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

  updateMyBulletinAd: memberProtectedProcedure
    .input(z.object({
      id: z.number().int().positive(),
      title: requiredText(160, "제목을 입력해 주세요."),
      requestedDate: editableRequestDateSchema,
      content: requiredText(3000, "주보 광고 신청 내용을 입력해 주세요."),
      attachment: subtitleAttachmentSchema,
      removeAttachment: z.boolean().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const existing = await getMemberBulletinAdRequest(input.id, ctx.memberId);
      if (!existing) {
        throw new TRPCError({ code: "FORBIDDEN", message: "본인이 신청한 주보 광고신청만 수정할 수 있습니다." });
      }
      const savedAttachment = input.attachment
        ? await saveBulletinAdAttachment(input.attachment)
        : undefined;
      const updated = await updateMemberBulletinAdRequest(input.id, ctx.memberId, {
        title: input.title,
        requestedDate: input.requestedDate || null,
        content: input.content,
        attachment: savedAttachment ?? (input.removeAttachment ? null : undefined),
      });
      if (!updated) {
        throw new TRPCError({ code: "CONFLICT", message: "주보 광고신청을 수정하지 못했습니다. 새로고침 후 다시 시도해주세요." });
      }
      return { ok: true };
    }),

  deleteMyBulletinAd: memberProtectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      const archived = await archiveMemberBulletinAdRequest(input.id, ctx.memberId);
      if (!archived) {
        throw new TRPCError({ code: "FORBIDDEN", message: "본인이 신청한 주보 광고신청만 삭제할 수 있습니다." });
      }
      return { ok: true };
    }),
});
