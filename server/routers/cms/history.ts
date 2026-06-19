import { z } from "zod";
import { adminPermissionProcedure, router } from "../../_core/trpc";
import {
  createHistoryDecade,
  createHistoryItem,
  deleteHistoryDecade,
  deleteHistoryItem,
  getAllHistoryDecades,
  getAllHistoryItems,
  reorderHistoryDecades,
  reorderHistoryItems,
  updateHistoryDecade,
  updateHistoryItem,
} from "../../db";

const historyProcedure = adminPermissionProcedure("content:history");
const idSchema = z.number().int().positive();
const yearSchema = z.number().int().min(1800).max(2200);
const monthSchema = z.number().int().min(1).max(12);
const sortSchema = z.number().int().min(0).max(9999).optional();

const decadeCreateSchema = z
  .object({
    title: z.string().trim().min(1).max(64),
    startYear: yearSchema,
    endYear: yearSchema,
    sortOrder: sortSchema,
    isVisible: z.boolean().default(true),
  })
  .refine((value) => value.startYear <= value.endYear, {
    path: ["endYear"],
    message: "종료 연도는 시작 연도보다 작을 수 없습니다.",
  });

const decadeUpdateSchema = z
  .object({
    id: idSchema,
    title: z.string().trim().min(1).max(64).optional(),
    startYear: yearSchema.optional(),
    endYear: yearSchema.optional(),
    sortOrder: sortSchema,
    isVisible: z.boolean().optional(),
  })
  .refine((value) => {
    if (value.startYear === undefined || value.endYear === undefined) return true;
    return value.startYear <= value.endYear;
  }, {
    path: ["endYear"],
    message: "종료 연도는 시작 연도보다 작을 수 없습니다.",
  });

const itemCreateSchema = z.object({
  decadeId: idSchema,
  year: yearSchema,
  month: monthSchema,
  content: z.string().trim().min(1).max(10000),
  sortOrder: sortSchema,
  isVisible: z.boolean().default(true),
});

const itemUpdateSchema = z.object({
  id: idSchema,
  decadeId: idSchema.optional(),
  year: yearSchema.optional(),
  month: monthSchema.optional(),
  content: z.string().trim().min(1).max(10000).optional(),
  sortOrder: sortSchema,
  isVisible: z.boolean().optional(),
});

const reorderSchema = z.object({
  ids: z.array(idSchema).min(1),
});

export const historyRouter = router({
  decades: historyProcedure.query(() => getAllHistoryDecades()),
  items: historyProcedure.query(() => getAllHistoryItems()),
  createDecade: historyProcedure.input(decadeCreateSchema).mutation(({ input }) => createHistoryDecade(input)),
  updateDecade: historyProcedure.input(decadeUpdateSchema).mutation(({ input }) => {
    const { id, ...data } = input;
    return updateHistoryDecade(id, data);
  }),
  deleteDecade: historyProcedure.input(z.object({ id: idSchema })).mutation(({ input }) => deleteHistoryDecade(input.id)),
  reorderDecades: historyProcedure.input(reorderSchema).mutation(({ input }) => reorderHistoryDecades(input.ids)),
  createItem: historyProcedure.input(itemCreateSchema).mutation(({ input }) => createHistoryItem(input)),
  updateItem: historyProcedure.input(itemUpdateSchema).mutation(({ input }) => {
    const { id, ...data } = input;
    return updateHistoryItem(id, data);
  }),
  deleteItem: historyProcedure.input(z.object({ id: idSchema })).mutation(({ input }) => deleteHistoryItem(input.id)),
  reorderItems: historyProcedure.input(reorderSchema).mutation(({ input }) => reorderHistoryItems(input.ids)),
});
