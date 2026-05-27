/**
 * 공개 접수 라우터 (support)
 * - 기도 요청
 * - 새가족 등록 문의
 */

import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { createNewMemberRequest, createPrayerRequest } from "../db";

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

export const supportRouter = router({
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
});
