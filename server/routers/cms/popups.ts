/**
 * 팝업/공지 배너 관리 라우터 (cms.popups)
 * ─────────────────────────────────────────────────────────────────────────────
 * 담당 기능:
 *   - list: 전체 팝업 목록 조회 (관리자)
 *   - create/update/delete: 팝업 관리
 *
 * 접근 권한: 모두 adminProcedure (관리자만 접근 가능)
 */

import { z } from "zod";
import { adminProcedure, router } from "../../_core/trpc";
import {
  optionalTextSchema,
  requiredTextSchema,
  safeAssetUrlSchema,
  safeHrefSchema,
} from "../../_core/contentValidation";
import {
  createNoticePopup,
  deleteNoticePopup,
  getAllNoticePopups,
  updateNoticePopup,
} from "../../db";

const placementSchema = z.enum(["modal", "top_banner", "bottom_sheet"]);
const audienceSchema = z.enum(["all", "guest", "member"]);
const nullableDateSchema = z.coerce.date().nullable().optional();

const popupCreateFields = {
  title: requiredTextSchema(160, "팝업 제목을 입력해주세요."),
  content: optionalTextSchema(10000),
  imageUrl: safeAssetUrlSchema.optional(),
  linkLabel: optionalTextSchema(64),
  linkHref: safeHrefSchema.optional(),
  placement: placementSchema.default("modal"),
  audience: audienceSchema.default("all"),
  isActive: z.boolean().default(true),
  isDismissible: z.boolean().default(true),
  dismissPeriodHours: z.number().int().min(1).max(720).default(24),
  priority: z.number().int().min(0).max(9999).default(0),
  startAt: nullableDateSchema,
  endAt: nullableDateSchema,
};

const popupUpdateFields = {
  title: requiredTextSchema(160, "팝업 제목을 입력해주세요.").optional(),
  content: optionalTextSchema(10000),
  imageUrl: safeAssetUrlSchema.optional(),
  linkLabel: optionalTextSchema(64),
  linkHref: safeHrefSchema.optional(),
  placement: placementSchema.optional(),
  audience: audienceSchema.optional(),
  isActive: z.boolean().optional(),
  isDismissible: z.boolean().optional(),
  dismissPeriodHours: z.number().int().min(1).max(720).optional(),
  priority: z.number().int().min(0).max(9999).optional(),
  startAt: nullableDateSchema,
  endAt: nullableDateSchema,
};

const validatePopupRules = <
  T extends {
    startAt?: Date | null;
    endAt?: Date | null;
    linkLabel?: string;
    linkHref?: string;
  },
>(
  schema: z.ZodType<T>
) =>
  schema
  .refine(
    (input) => !input.startAt || !input.endAt || input.startAt <= input.endAt,
    {
      message: "노출 종료 시각은 시작 시각보다 늦어야 합니다.",
      path: ["endAt"],
    }
  )
  .refine((input) => !input.linkLabel || Boolean(input.linkHref?.trim()), {
    message: "버튼 문구를 입력했다면 버튼 링크도 입력해주세요.",
    path: ["linkHref"],
  });

const popupBaseSchema = validatePopupRules(z.object(popupCreateFields));
const popupUpdateSchema = validatePopupRules(
  z.object({ id: z.number().int().positive(), ...popupUpdateFields })
);

export const popupsRouter = router({
  /** 전체 팝업 목록 조회 (숨김/기간 종료 포함) */
  list: adminProcedure.query(() => getAllNoticePopups()),

  /** 팝업 생성 */
  create: adminProcedure
    .input(popupBaseSchema)
    .mutation(({ input, ctx }) =>
      createNoticePopup({ ...input, authorId: ctx.user.id })
    ),

  /** 팝업 수정 */
  update: adminProcedure
    .input(popupUpdateSchema)
    .mutation(({ input }) => {
      const { id, ...data } = input;
      return updateNoticePopup(id, data);
    }),

  /** 팝업 삭제 */
  delete: adminProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(({ input }) => deleteNoticePopup(input.id)),
});
