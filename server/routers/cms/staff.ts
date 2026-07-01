/**
 * 섬기는 분 관리 라우터 (cms.staff)
 * ─────────────────────────────────────────────────────────────────────────────
 * 관리자에서 섬기는 분 정보를 등록하고 공개 여부를 관리합니다.
 */

import { z } from "zod";
import { adminProcedure, router } from "../../_core/trpc";
import {
  optionalTextSchema,
  requiredTextSchema,
  safeAssetUrlSchema,
} from "../../_core/contentValidation";
import {
  createStaffCategory,
  createStaffMember,
  createStaffTitleOption,
  deleteStaffCategory,
  deleteStaffMember,
  deleteStaffTitleOption,
  getAllStaffCategories,
  getAllStaffMembers,
  getAllStaffTitleOptions,
  moveStaffCategory,
  reorderStaffCategories,
  reorderStaffTitleOptions,
  updateStaffCategoryVisibility,
  updateStaffMember,
} from "../../db";

const staffCategorySchema = z.string().trim().min(1).max(64).regex(/^[a-z0-9][a-z0-9_-]{0,63}$/);
const idSchema = z.number().int().positive();
const sortOrderSchema = z.number().int().min(0).max(10000).optional();

const staffCreateSchema = z.object({
  category: staffCategorySchema.default("associate"),
  name: requiredTextSchema(64, "이름을 입력해주세요."),
  title: requiredTextSchema(64, "직책을 입력해주세요."),
  department: optionalTextSchema(128),
  email: optionalTextSchema(128),
  phone: optionalTextSchema(32),
  description: optionalTextSchema(2000),
  profile: optionalTextSchema(10000),
  imageUrl: safeAssetUrlSchema.optional(),
  sortOrder: sortOrderSchema,
  isVisible: z.boolean().default(true),
});

const staffUpdateSchema = staffCreateSchema.partial().extend({
  id: idSchema,
});

export const staffRouter = router({
  categories: adminProcedure.query(() => getAllStaffCategories()),

  titleOptions: adminProcedure.query(() => getAllStaffTitleOptions()),

  createCategory: adminProcedure
    .input(z.object({ label: requiredTextSchema(64, "분류명을 입력해주세요.") }))
    .mutation(({ input }) => createStaffCategory(input.label)),

  updateCategoryVisibility: adminProcedure
    .input(z.object({
      categoryKey: staffCategorySchema,
      isVisible: z.boolean(),
    }))
    .mutation(({ input }) => updateStaffCategoryVisibility(input.categoryKey, input.isVisible)),

  moveCategory: adminProcedure
    .input(z.object({
      categoryKey: staffCategorySchema,
      direction: z.enum(["up", "down"]),
    }))
    .mutation(({ input }) => moveStaffCategory(input.categoryKey, input.direction)),

  reorderCategories: adminProcedure
    .input(z.object({ categoryKeys: z.array(staffCategorySchema).min(1).max(50) }))
    .mutation(({ input }) => reorderStaffCategories(input.categoryKeys)),

  deleteCategory: adminProcedure
    .input(z.object({ categoryKey: staffCategorySchema }))
    .mutation(({ input }) => deleteStaffCategory(input.categoryKey)),

  createTitleOption: adminProcedure
    .input(z.object({
      categoryKey: staffCategorySchema,
      label: requiredTextSchema(64, "사역 구분명을 입력해주세요."),
    }))
    .mutation(({ input }) => createStaffTitleOption(input.categoryKey, input.label)),

  deleteTitleOption: adminProcedure
    .input(z.object({
      categoryKey: staffCategorySchema,
      label: requiredTextSchema(64, "사역 구분명을 입력해주세요."),
    }))
    .mutation(({ input }) => deleteStaffTitleOption(input.categoryKey, input.label)),

  reorderTitleOptions: adminProcedure
    .input(z.object({
      categoryKey: staffCategorySchema,
      labels: z.array(requiredTextSchema(64, "사역 구분명을 입력해주세요.")).min(1).max(100),
    }))
    .mutation(({ input }) => reorderStaffTitleOptions(input.categoryKey, input.labels)),

  list: adminProcedure.query(() => getAllStaffMembers()),

  create: adminProcedure
    .input(staffCreateSchema)
    .mutation(({ input }) => createStaffMember(input)),

  update: adminProcedure
    .input(staffUpdateSchema)
    .mutation(({ input }) => {
      const { id, ...data } = input;
      return updateStaffMember(id, data);
    }),

  delete: adminProcedure
    .input(z.object({ id: idSchema }))
    .mutation(({ input }) => deleteStaffMember(input.id)),
});
