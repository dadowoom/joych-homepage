import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { churchMembers, memberFieldOptions } from "../../../drizzle/schema";
import { getDb } from "../../db";
import { adminAnyPermissionProcedure, router } from "../../_core/trpc";
import {
  previewMemberPushTarget,
  sendPushToMemberTarget,
  type MemberPushTarget,
} from "../../_core/pushNotifications";

const pushBroadcastProcedure = adminAnyPermissionProcedure(["content:pushBroadcast"]);

const targetSchema = z.discriminatedUnion("scope", [
  z.object({ scope: z.literal("all") }),
  z.object({ scope: z.literal("position"), values: z.array(z.string().trim().min(1).max(64)).min(1).max(50) }),
  z.object({ scope: z.literal("department"), values: z.array(z.string().trim().min(1).max(64)).min(1).max(50) }),
  z.object({ scope: z.literal("district"), values: z.array(z.string().trim().min(1).max(64)).min(1).max(50) }),
  z.object({ scope: z.literal("members"), memberIds: z.array(z.number().int().positive()).min(1).max(200) }),
]);

const payloadInputSchema = z.object({
  title: z.string().trim().min(1, "제목을 입력해주세요.").max(80),
  body: z.string().trim().min(1, "내용을 입력해주세요.").max(240),
  url: z.string().trim().max(512).optional(),
  target: targetSchema,
});

function normalizeAppUrl(url: string | undefined) {
  const trimmed = url?.trim();
  if (!trimmed) return "/";
  if (trimmed.startsWith("/")) return trimmed;
  try {
    const parsed = new URL(trimmed);
    return `${parsed.pathname}${parsed.search}${parsed.hash}` || "/";
  } catch {
    return "/";
  }
}

function toMemberPushTarget(target: z.infer<typeof targetSchema>): MemberPushTarget {
  if (target.scope === "all") return { scope: "all" };
  if (target.scope === "members") return { scope: "members", memberIds: target.memberIds };
  return { scope: target.scope, values: target.values };
}

export const pushBroadcastRouter = router({
  targetOptions: pushBroadcastProcedure.query(async () => {
    const db = await getDb();
    if (!db) {
      return { positions: [], departments: [], districts: [], members: [] };
    }

    const options = await db
      .select({
        fieldType: memberFieldOptions.fieldType,
        label: memberFieldOptions.label,
        sortOrder: memberFieldOptions.sortOrder,
      })
      .from(memberFieldOptions)
      .where(eq(memberFieldOptions.isActive, true))
      .orderBy(asc(memberFieldOptions.fieldType), asc(memberFieldOptions.sortOrder), asc(memberFieldOptions.label));

    const members = await db
      .select({
        id: churchMembers.id,
        name: churchMembers.name,
        phone: churchMembers.phone,
        position: churchMembers.position,
        department: churchMembers.department,
        district: churchMembers.district,
      })
      .from(churchMembers)
      .where(eq(churchMembers.status, "approved"))
      .orderBy(asc(churchMembers.name), asc(churchMembers.id));

    const labelsByType = (fieldType: string) =>
      Array.from(
        new Set(
          options
            .filter((option) => option.fieldType === fieldType)
            .map((option) => option.label)
            .filter(Boolean),
        ),
      );

    return {
      positions: labelsByType("position"),
      departments: labelsByType("department"),
      districts: labelsByType("district"),
      members,
    };
  }),

  preview: pushBroadcastProcedure
    .input(z.object({ target: targetSchema }))
    .mutation(({ input }) => previewMemberPushTarget(toMemberPushTarget(input.target))),

  send: pushBroadcastProcedure
    .input(payloadInputSchema)
    .mutation(({ input }) =>
      sendPushToMemberTarget(toMemberPushTarget(input.target), {
        title: input.title,
        body: input.body,
        url: normalizeAppUrl(input.url),
        tag: `broadcast-${Date.now()}`,
      }),
    ),
});
