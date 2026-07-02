import { TRPCError } from "@trpc/server";
import { and, eq, or, type SQL } from "drizzle-orm";
import { z } from "zod";
import { pushSubscriptions } from "../../drizzle/schema";
import { getDb } from "../db";
import { publicProcedure, router } from "../_core/trpc";

const endpointSchema = z.string().trim().min(1).max(500);

function endpointPreview(endpoint: string) {
  return `${endpoint.slice(0, 32)}...${endpoint.slice(-12)}`;
}

function userAgentPreview(userAgent: string | null | undefined) {
  if (!userAgent) return "unknown";
  return userAgent.length > 120 ? `${userAgent.slice(0, 120)}...` : userAgent;
}

const diagnosticSchema = z.object({
  event: z.string().trim().min(1).max(80),
  supported: z.boolean(),
  isIos: z.boolean(),
  standalone: z.boolean(),
  permission: z.enum(["default", "denied", "granted", "unsupported"]),
  hasLocalSubscription: z.boolean().optional(),
  serverSubscriptionCount: z.number().int().min(0).max(100).optional(),
  endpointHost: z.string().trim().max(120).optional(),
  errorName: z.string().trim().max(120).optional(),
  errorMessage: z.string().trim().max(500).optional(),
  userAgent: z.string().trim().max(500).optional(),
});

function ensurePushNotificationUser(ctx: {
  user: { id: number; role: string; contentPermissions?: string[] } | null;
  memberId: number | null;
}) {
  const canUsePush =
    Boolean(ctx.memberId) ||
    ctx.user?.role === "admin" ||
    ctx.user?.contentPermissions?.includes("content:reservations") ||
    ctx.user?.contentPermissions?.includes("content:vehicles") ||
    ctx.user?.contentPermissions?.includes("content:pushBroadcast");

  if (
    !canUsePush
  ) {
    throw new TRPCError({ code: "FORBIDDEN", message: "알림을 설정할 권한이 없습니다." });
  }

  return {
    userId: ctx.user?.id ?? null,
    memberId: ctx.memberId,
  };
}

function ownerConditions(owner: { userId: number | null; memberId: number | null }): SQL[] {
  const conditions: SQL[] = [];
  if (owner.userId) conditions.push(eq(pushSubscriptions.userId, owner.userId));
  if (owner.memberId) conditions.push(eq(pushSubscriptions.memberId, owner.memberId));
  return conditions;
}

export const pushRouter = router({
  reportDiagnostic: publicProcedure
    .input(diagnosticSchema)
    .mutation(({ input, ctx }) => {
      const owner = ensurePushNotificationUser(ctx);
      console.log(
        [
          `[push-client] event=${input.event}`,
          `userId=${owner.userId}`,
          `memberId=${owner.memberId ?? "none"}`,
          `supported=${input.supported}`,
          `ios=${input.isIos}`,
          `standalone=${input.standalone}`,
          `permission=${input.permission}`,
          `local=${input.hasLocalSubscription ?? "unknown"}`,
          `serverCount=${input.serverSubscriptionCount ?? "unknown"}`,
          `endpointHost=${input.endpointHost ?? "none"}`,
          `error=${input.errorName ?? "none"}`,
          `message=${input.errorMessage ?? "none"}`,
          `ua=${userAgentPreview(input.userAgent)}`,
        ].join(" "),
      );
      return { success: true };
    }),

  subscribe: publicProcedure
    .input(z.object({
      endpoint: endpointSchema,
      keys: z.object({
        p256dh: z.string().trim().min(1).max(255),
        auth: z.string().trim().min(1).max(255),
      }),
      userAgent: z.string().trim().max(500).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) {
        throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "DB unavailable" });
      }

      const owner = ensurePushNotificationUser(ctx);
      const lastUsedAt = new Date();
      await db.insert(pushSubscriptions).values({
        memberId: owner.memberId,
        userId: owner.userId,
        endpoint: input.endpoint,
        p256dh: input.keys.p256dh,
        auth: input.keys.auth,
        userAgent: input.userAgent ?? null,
        lastUsedAt,
      }).onDuplicateKeyUpdate({
        set: {
          memberId: owner.memberId,
          userId: owner.userId,
          p256dh: input.keys.p256dh,
          auth: input.keys.auth,
          userAgent: input.userAgent ?? null,
          lastUsedAt,
        },
      });

      console.log(`[push] Subscribed userId=${owner.userId} memberId=${owner.memberId ?? "none"} endpoint=${endpointPreview(input.endpoint)} ua=${userAgentPreview(input.userAgent)}`);
      return { success: true };
    }),

  unsubscribe: publicProcedure
    .input(z.object({ endpoint: endpointSchema }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) {
        throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "DB unavailable" });
      }

      const owner = ensurePushNotificationUser(ctx);
      const conditions = ownerConditions(owner);
      if (conditions.length === 0) {
        throw new TRPCError({ code: "FORBIDDEN", message: "알림 설정 권한이 없습니다." });
      }
      await db.delete(pushSubscriptions).where(and(
        eq(pushSubscriptions.endpoint, input.endpoint),
        or(...conditions),
      ));

      console.log(`[push] Unsubscribed userId=${owner.userId} memberId=${owner.memberId ?? "none"} endpoint=${endpointPreview(input.endpoint)}`);
      return { success: true };
    }),

  getMySubscriptions: publicProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];

    const owner = ensurePushNotificationUser(ctx);
    const conditions = ownerConditions(owner);
    if (conditions.length === 0) return [];
    return db.select({
      id: pushSubscriptions.id,
      endpoint: pushSubscriptions.endpoint,
      userAgent: pushSubscriptions.userAgent,
      createdAt: pushSubscriptions.createdAt,
      lastUsedAt: pushSubscriptions.lastUsedAt,
    })
      .from(pushSubscriptions)
      .where(or(...conditions));
  }),
});
