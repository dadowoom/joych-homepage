import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  MISSION_REPORT_BOARD_DESCRIPTION_SETTING_KEY,
  TESTIMONY_BOARD_DESCRIPTION_SETTING_KEY,
  getDynamicBoardDescriptionSettingKey,
} from "@shared/boardIntroductions";
import { hasAdminContentPermission } from "../../db/adminPermissions";
import { upsertSiteSetting } from "../../db";
import { adminAnyPermissionProcedure, router } from "../../_core/trpc";

const boardIntroKindSchema = z.enum(["testimony", "missionReport", "dynamic"]);
const boardIntroInputSchema = z.object({
  kind: boardIntroKindSchema,
  description: z
    .string()
    .trim()
    .min(1, "안내 문구를 입력해 주세요.")
    .max(500, "안내 문구는 500자 이하로 입력해 주세요."),
  menuItemId: z.number().int().positive().optional(),
  menuSubItemId: z.number().int().positive().optional(),
}).superRefine((value, ctx) => {
  if (value.kind !== "dynamic") return;
  if (Boolean(value.menuItemId) === Boolean(value.menuSubItemId)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "일반 게시판의 메뉴 정보를 찾을 수 없습니다.",
    });
  }
});

function requiredPermission(kind: z.infer<typeof boardIntroKindSchema>) {
  if (kind === "testimony") return "content:testimonies";
  if (kind === "missionReport") return "content:missionReports";
  return "content:notices";
}

function settingKey(input: z.infer<typeof boardIntroInputSchema>) {
  if (input.kind === "testimony") return TESTIMONY_BOARD_DESCRIPTION_SETTING_KEY;
  if (input.kind === "missionReport") return MISSION_REPORT_BOARD_DESCRIPTION_SETTING_KEY;
  return getDynamicBoardDescriptionSettingKey(input);
}

export const boardIntroductionsRouter = router({
  update: adminAnyPermissionProcedure([
    "content:notices",
    "content:testimonies",
    "content:missionReports",
  ])
    .input(boardIntroInputSchema)
    .mutation(async ({ input, ctx }) => {
      if (!hasAdminContentPermission(ctx.user, requiredPermission(input.kind))) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "이 게시판의 안내 문구를 수정할 권한이 없습니다.",
        });
      }
      return upsertSiteSetting(settingKey(input), input.description);
    }),
});
