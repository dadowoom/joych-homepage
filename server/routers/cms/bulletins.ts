/**
 * 주보 관리 라우터 (cms.bulletins)
 * ─────────────────────────────────────────────────────────────────────────────
 * 관리자만 주보 페이지 이미지를 등록하고 공개 상태를 관리합니다.
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { adminPermissionProcedure, router } from "../../_core/trpc";
import { storageDelete, storageDeleteByUrl, storagePut } from "../../storage";
import {
  archiveBulletin,
  createBulletinWithImages,
  listAdminBulletins,
  updateBulletin,
  updateBulletinWithImages,
} from "../../db";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_BULLETIN_IMAGE_BYTES = 1 * 1024 * 1024;
const MAX_BULLETIN_IMAGE_COUNT = 12;
const ALLOWED_BULLETIN_EXTS = new Set(["jpg", "jpeg", "png"]);
const bulletinProcedure = adminPermissionProcedure("content:bulletins");

const bulletinFileSchema = z.object({
  fileName: z.string().trim().min(1).max(255),
  mimeType: z.string().trim().min(1).max(128),
  base64: z.string().min(1),
});
const bulletinPageUpdateSchema = z.union([
  z.object({
    existingImageId: z.number().int().nonnegative(),
  }).strict(),
  z.object({
    file: bulletinFileSchema,
  }).strict(),
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
  return ext && ALLOWED_BULLETIN_EXTS.has(ext) ? ext : null;
}

function decodeUploadBase64(base64: string) {
  const normalized = base64.trim().replace(/^data:[^;]+;base64,/, "");
  if (!normalized || normalized.length % 4 === 1 || /[^A-Za-z0-9+/=]/.test(normalized)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "주보 이미지 데이터가 올바르지 않습니다." });
  }
  const buffer = Buffer.from(normalized, "base64");
  if (buffer.length === 0) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "빈 파일은 업로드할 수 없습니다." });
  }
  if (buffer.length > MAX_BULLETIN_IMAGE_BYTES) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "주보 이미지는 한 장당 최대 1MB까지 업로드할 수 있습니다." });
  }
  return buffer;
}

async function saveBulletinImage(file: z.infer<typeof bulletinFileSchema>, sortOrder: number) {
  const ext = getFileExt(file.fileName);
  if (!ext) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "주보 이미지는 JPG, PNG 형식만 가능합니다.",
    });
  }

  const buffer = decodeUploadBase64(file.base64);
  const baseName = file.fileName.replace(/\.[^.]+$/, "");
  const safeName = sanitizeFileName(baseName) || "bulletin";
  const key = `bulletins/${Date.now()}-${sortOrder}-${Math.random().toString(36).slice(2)}-${safeName}.${ext}`;
  const { url } = await storagePut(key, buffer, file.mimeType || "application/octet-stream");
  return {
    storageKey: key,
    image: {
      fileName: file.fileName,
      fileUrl: url,
      fileSize: buffer.length,
      fileMime: file.mimeType,
      sortOrder,
    },
  };
}

async function deleteStorageKeysBestEffort(keys: string[]) {
  const results = await Promise.allSettled(keys.map((key) => storageDelete(key)));
  for (const result of results) {
    if (result.status === "rejected") {
      console.error("[bulletins] Failed to clean up an uploaded image:", result.reason);
    }
  }
}

async function deleteStorageUrlsBestEffort(urls: string[]) {
  const results = await Promise.allSettled(urls.map((url) => storageDeleteByUrl(url)));
  for (const result of results) {
    if (result.status === "rejected") {
      console.error("[bulletins] Failed to delete a removed image:", result.reason);
    }
  }
}

async function saveBulletinImages(
  files: Array<z.infer<typeof bulletinFileSchema>>,
) {
  const saved: Array<Awaited<ReturnType<typeof saveBulletinImage>>> = [];
  try {
    for (let index = 0; index < files.length; index += 1) {
      saved.push(await saveBulletinImage(files[index]!, index));
    }
    return saved;
  } catch (error) {
    await deleteStorageKeysBestEffort(saved.map((item) => item.storageKey));
    throw error;
  }
}

export const bulletinsRouter = router({
  list: bulletinProcedure.query(() => listAdminBulletins()),

  create: bulletinProcedure
    .input(z.object({
      title: z.string().trim().min(1, "주보 제목을 입력해주세요.").max(160),
      bulletinDate: z.string().trim().regex(DATE_RE, "주보 날짜는 YYYY-MM-DD 형식으로 입력해주세요."),
      status: z.enum(["published", "hidden"]).default("published"),
      files: z.array(bulletinFileSchema)
        .min(1, "주보 이미지를 1장 이상 선택해주세요.")
        .max(MAX_BULLETIN_IMAGE_COUNT, `주보 이미지는 최대 ${MAX_BULLETIN_IMAGE_COUNT}장까지 등록할 수 있습니다.`),
    }))
    .mutation(async ({ input, ctx }) => {
      const savedImages = await saveBulletinImages(input.files);
      const images = savedImages.map((item) => item.image);
      const firstImage = images[0];
      if (!firstImage) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "주보 이미지를 선택해주세요." });
      }

      try {
        const id = await createBulletinWithImages({
          title: input.title,
          bulletinDate: input.bulletinDate,
          status: input.status,
          authorId: ctx.user.id,
          fileName: firstImage.fileName,
          fileUrl: firstImage.fileUrl,
          fileSize: firstImage.fileSize,
          fileMime: firstImage.fileMime,
        }, images);
        if (!id) {
          throw new Error("Failed to create bulletin.");
        }
        return { ok: true, id };
      } catch (error) {
        await deleteStorageKeysBestEffort(savedImages.map((item) => item.storageKey));
        throw error;
      }
    }),

  update: bulletinProcedure
    .input(z.object({
      id: z.number().int().positive(),
      title: z.string().trim().min(1).max(160).optional(),
      bulletinDate: z.string().trim().regex(DATE_RE).optional(),
      status: z.enum(["published", "hidden"]).optional(),
      images: z.array(bulletinPageUpdateSchema)
        .min(1, "주보 이미지는 최소 1장 이상 남겨야 합니다.")
        .max(MAX_BULLETIN_IMAGE_COUNT, `주보 이미지는 최대 ${MAX_BULLETIN_IMAGE_COUNT}장까지 등록할 수 있습니다.`)
        .optional(),
    }).superRefine((input, ctx) => {
      if (!input.images) return;
      const existingIds = input.images.flatMap((page) =>
        "existingImageId" in page ? [page.existingImageId] : []
      );
      if (new Set(existingIds).size !== existingIds.length) {
        ctx.addIssue({
          code: "custom",
          path: ["images"],
          message: "같은 주보 페이지를 두 번 선택할 수 없습니다.",
        });
      }
    }))
    .mutation(async ({ input }) => {
      const { id, images, ...data } = input;
      if (!images) {
        return updateBulletin(id, data);
      }

      const uploadedKeys: string[] = [];
      const pages: Parameters<typeof updateBulletinWithImages>[2] = [];
      try {
        for (let sortOrder = 0; sortOrder < images.length; sortOrder += 1) {
          const page = images[sortOrder]!;
          if ("existingImageId" in page) {
            pages.push({ existingImageId: page.existingImageId });
            continue;
          }

          const saved = await saveBulletinImage(page.file, sortOrder);
          uploadedKeys.push(saved.storageKey);
          const { sortOrder: _sortOrder, ...image } = saved.image;
          pages.push({ image });
        }
      } catch (error) {
        await deleteStorageKeysBestEffort(uploadedKeys);
        throw error;
      }

      let result: Awaited<ReturnType<typeof updateBulletinWithImages>>;
      try {
        result = await updateBulletinWithImages(id, data, pages);
      } catch (error) {
        await deleteStorageKeysBestEffort(uploadedKeys);
        throw error;
      }

      if (result.status !== "updated") {
        await deleteStorageKeysBestEffort(uploadedKeys);
        if (result.status === "not_found") {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "수정할 주보를 찾을 수 없습니다.",
          });
        }
        throw new TRPCError({
          code: "CONFLICT",
          message: "선택한 주보 페이지가 변경되었거나 현재 주보에 속하지 않습니다. 새로고침 후 다시 시도해주세요.",
        });
      }

      await deleteStorageUrlsBestEffort(result.deletedFileUrls);
      return { ok: true };
    }),

  archive: bulletinProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(({ input }) => archiveBulletin(input.id)),
});
