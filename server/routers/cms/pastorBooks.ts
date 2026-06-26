import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { adminPermissionProcedure, router, publicProcedure } from "../../_core/trpc";
import { normalizeRichTextHtmlContent, optionalTextSchema, requiredTextSchema, safeAssetUrlSchema } from "../../_core/contentValidation";
import { storagePut } from "../../storage";
import { validateImage } from "./upload";
import {
  addPastorBookImage,
  createPastorBook,
  deletePastorBook,
  deletePastorBookImage,
  getPastorBookById,
  getPastorBookImages,
  getPastorBooksForAdmin,
  setPastorBookThumbnail,
  updatePastorBook,
} from "../../db";

const idSchema = z.number().int().positive();
const DATE_RE = /^\d{4}\.\d{2}\.\d{2}$|^\d{4}-\d{2}-\d{2}$/;
const pastorBookProcedure = adminPermissionProcedure("content:pastorBooks");

function normalizeBookHtml(value: string | null | undefined) {
  if (!value) return null;
  try {
    return normalizeRichTextHtmlContent(value, 50000);
  } catch (error) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: error instanceof Error ? error.message : "HTML 본문을 확인해주세요.",
    });
  }
}

const bookShape = {
  legacyNum: optionalTextSchema(32).nullable().optional(),
  title: requiredTextSchema(255, "책 제목을 입력해주세요."),
  summary: optionalTextSchema(500).nullable().optional(),
  contentHtml: z.string().max(50000).nullable().optional(),
  publishedAt: z.string().trim().regex(DATE_RE, "날짜는 2026.06.26 또는 2026-06-26 형식으로 입력해주세요.").nullable().optional(),
  externalUrl: safeAssetUrlSchema.nullable().optional(),
  isVisible: z.boolean().default(true),
  sortOrder: z.number().int().min(0).max(100000).default(0),
};

const createSchema = z.object(bookShape).transform((value) => ({
  ...value,
  contentHtml: normalizeBookHtml(value.contentHtml),
}));

const updateSchema = z.object(bookShape).partial().extend({
  id: idSchema,
}).transform((value) => ({
  ...value,
  contentHtml: Object.prototype.hasOwnProperty.call(value, "contentHtml")
    ? normalizeBookHtml(value.contentHtml)
    : undefined,
}));

export const pastorBooksRouter = router({
  list: pastorBookProcedure.query(() => getPastorBooksForAdmin()),

  get: pastorBookProcedure
    .input(z.object({ id: idSchema }))
    .query(({ input }) => getPastorBookById(input.id, true)),

  create: pastorBookProcedure
    .input(createSchema)
    .mutation(({ input }) => createPastorBook(input)),

  update: pastorBookProcedure
    .input(updateSchema)
    .mutation(({ input }) => {
      const { id, ...data } = input;
      return updatePastorBook(id, data);
    }),

  delete: pastorBookProcedure
    .input(z.object({ id: idSchema }))
    .mutation(({ input }) => deletePastorBook(input.id)),

  images: router({
    list: publicProcedure
      .input(z.object({ bookId: idSchema }))
      .query(({ input }) => getPastorBookImages(input.bookId)),

    upload: pastorBookProcedure
      .input(z.object({
        bookId: idSchema,
        base64: z.string(),
        fileName: z.string().optional(),
        mimeType: z.string(),
        caption: optionalTextSchema(128),
        isThumbnail: z.boolean().default(false),
      }))
      .mutation(async ({ input }) => {
        const { buffer, ext } = validateImage(input.base64, input.mimeType);
        const mimeType = input.mimeType.toLowerCase().trim();
        const key = `pastor-book-images/${input.bookId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { url } = await storagePut(key, buffer, mimeType);
        const id = await addPastorBookImage({
          bookId: input.bookId,
          imageUrl: url,
          fileKey: key,
          caption: input.caption,
          isThumbnail: input.isThumbnail,
          sortOrder: 0,
        });
        return { id, url };
      }),

    delete: pastorBookProcedure
      .input(z.object({ id: idSchema }))
      .mutation(({ input }) => deletePastorBookImage(input.id)),

    setThumbnail: pastorBookProcedure
      .input(z.object({ bookId: idSchema, imageId: idSchema }))
      .mutation(({ input }) => setPastorBookThumbnail(input.bookId, input.imageId)),
  }),
});
