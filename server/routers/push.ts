import { TRPCError } from "@trpc/server";
import { and, eq, or } from "drizzle-orm";
import { z } from "zod";
import { pushSubscriptions } from "../../drizzle/schema";
import { getDb } from "../db";
import { protectedProcedure, router } from "../_core/trpc";

const endpointSchema = z.string().trim().min(1).max(500);

function ensurePushNotificationUser(ctx: {
  user: { id: number; role: string; contentPermissions?: string[] } | null;
  memberId: number | null;
}) {
  const canUsePush =
    ctx.user?.role === "admin" ||
    ctx.user?.contentPermissions?.includes("content:reservations") ||
    ctx.user?.contentPermissions?.includes("content:vehicles");

  if (
    !canUsePush
  ) {
    throw new TRPCError({ code: "FORBIDDEN", message: "알림을 설정할 권한이 없습니다." });
  }

  return {
    userId: ctx.user!.id,
    memberId: ctx.memberId,
  };
}

export const pushRouter = router({
  subscribe: protectedProcedure
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

      console.log(`[push] Subscribed userId=${owner.userId} memberId=${owner.memberId ?? "none"}`);
      return { success: true };
    }),

  unsubscribe: protectedProcedure
    .input(z.object({ endpoint: endpointSchema }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) {
        throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "DB unavailable" });
      }

      const owner = ensurePushNotificationUser(ctx);
      await db.delete(pushSubscriptions).where(and(
        eq(pushSubscriptions.endpoint, input.endpoint),
        or(
          eq(pushSubscriptions.userId, owner.userId),
          owner.memberId ? eq(pushSubscriptions.memberId, owner.memberId) : undefined,
        ),
      ));

      console.log(`[push] Unsubscribed userId=${owner.userId} memberId=${owner.memberId ?? "none"}`);
      return { success: true };
    }),

  getMySubscriptions: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];

    const owner = ensurePushNotificationUser(ctx);
    return db.select({
      id: pushSubscriptions.id,
      endpoint: pushSubscriptions.endpoint,
      userAgent: pushSubscriptions.userAgent,
      createdAt: pushSubscriptions.createdAt,
      lastUsedAt: pushSubscriptions.lastUsedAt,
    })
      .from(pushSubscriptions)
      .where(or(
        eq(pushSubscriptions.userId, owner.userId),
        owner.memberId ? eq(pushSubscriptions.memberId, owner.memberId) : undefined,
      ));
  }),
});
