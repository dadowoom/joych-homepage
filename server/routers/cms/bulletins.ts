/**
 * 주보 관리 라우터 (cms.bulletins)
 * ─────────────────────────────────────────────────────────────────────────────
 * 관리자만 주보 PDF/이미지를 등록하고 공개 상태를 관리합니다.
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { adminProcedure, router } from "../../_core/trpc";
import { storagePut } from "../../storage";
import {
  archiveBulletin,
  createBulletin,
  listAdminBulletins,
  updateBulletin,
} from "../../db";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_BULLETIN_FILE_BYTES = 20 * 1024 * 1024;
const ALLOWED_BULLETIN_EXTS = new Set(["pdf", "jpg", "jpeg", "png"]);

const bulletinFileSchema = z.object({
  fileName: z.string().trim().min(1).max(255),
  mimeType: z.string().trim().min(1).max(128),
  base64: z.string().min(1),
});

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
  return ext && ALLOWED_BULLETIN_EXTS.has(ext) ? ext : null;
}

function decodeUploadBase64(base64: string) {
  const normalized = base64.trim().replace(/^data:[^;]+;base64,/, "");
  if (!normalized || normalized.length % 4 === 1 || /[^A-Za-z0-9+/=]/.test(normalized)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "주보 파일 데이터가 올바르지 않습니다." });
  }
  const buffer = Buffer.from(normalized, "base64");
  if (buffer.length === 0) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "빈 파일은 업로드할 수 없습니다." });
  }
  if (buffer.length > MAX_BULLETIN_FILE_BYTES) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "주보 파일은 최대 20MB까지 업로드할 수 있습니다." });
  }
  return buffer;
}

async function saveBulletinFile(file: z.infer<typeof bulletinFileSchema>) {
  const ext = getFileExt(file.fileName);
  if (!ext) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "주보 파일은 PDF, JPG, PNG 형식만 가능합니다.",
    });
  }

  const buffer = decodeUploadBase64(file.base64);
  const baseName = file.fileName.replace(/\.[^.]+$/, "");
  const safeName = sanitizeFileName(baseName) || "bulletin";
  const key = `bulletins/${Date.now()}-${Math.random().toString(36).slice(2)}-${safeName}.${ext}`;
  const { url } = await storagePut(key, buffer, file.mimeType || "application/octet-stream");
  return {
    fileName: file.fileName,
    fileUrl: url,
    fileSize: buffer.length,
    fileMime: file.mimeType,
  };
}

export const bulletinsRouter = router({
  list: adminProcedure.query(() => listAdminBulletins()),

  create: adminProcedure
    .input(z.object({
      title: z.string().trim().min(1, "주보 제목을 입력해주세요.").max(160),
      bulletinDate: z.string().trim().regex(DATE_RE, "주보 날짜는 YYYY-MM-DD 형식으로 입력해주세요."),
      status: z.enum(["published", "hidden"]).default("published"),
      file: bulletinFileSchema,
    }))
    .mutation(async ({ input, ctx }) => {
      const file = await saveBulletinFile(input.file);
      const id = await createBulletin({
        title: input.title,
        bulletinDate: input.bulletinDate,
        status: input.status,
        authorId: ctx.user.id,
        ...file,
      });
      return { ok: true, id };
    }),

  update: adminProcedure
    .input(z.object({
      id: z.number().int().positive(),
      title: z.string().trim().min(1).max(160).optional(),
      bulletinDate: z.string().trim().regex(DATE_RE).optional(),
      status: z.enum(["published", "hidden"]).optional(),
    }))
    .mutation(({ input }) => {
      const { id, ...data } = input;
      return updateBulletin(id, data);
    }),

  archive: adminProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(({ input }) => archiveBulletin(input.id)),
});
