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
import { createStaffMember, deleteStaffMember, getAllStaffMembers, updateStaffMember } from "../../db";

const staffCategorySchema = z.enum(["senior", "associate", "education", "cooperation", "elder", "office", "other"]);
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
  list: adminProcedure.query(() => getAllStaffMembers()),

  create: adminProcedure
    .input(staffCreateSchema)
    .mutation(({ input }) => createStaffMember({
      ...input,
      sortOrder: input.sortOrder ?? 0,
    })),

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
