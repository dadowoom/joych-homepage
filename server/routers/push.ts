import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { pushSubscriptions } from "../../drizzle/schema";
import { getDb } from "../db";
import { memberProtectedProcedure, router } from "../_core/trpc";

const endpointSchema = z.string().trim().min(1).max(500);

export const pushRouter = router({
  subscribe: memberProtectedProcedure
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

      const lastUsedAt = new Date();
      await db.insert(pushSubscriptions).values({
        memberId: ctx.memberId,
        endpoint: input.endpoint,
        p256dh: input.keys.p256dh,
        auth: input.keys.auth,
        userAgent: input.userAgent ?? null,
        lastUsedAt,
      }).onDuplicateKeyUpdate({
        set: {
          memberId: ctx.memberId,
          p256dh: input.keys.p256dh,
          auth: input.keys.auth,
          userAgent: input.userAgent ?? null,
          lastUsedAt,
        },
      });

      return { success: true };
    }),

  unsubscribe: memberProtectedProcedure
    .input(z.object({ endpoint: endpointSchema }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) {
        throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "DB unavailable" });
      }

      await db.delete(pushSubscriptions).where(and(
        eq(pushSubscriptions.endpoint, input.endpoint),
        eq(pushSubscriptions.memberId, ctx.memberId),
      ));

      return { success: true };
    }),

  getMySubscriptions: memberProtectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];

    return db.select({
      id: pushSubscriptions.id,
      endpoint: pushSubscriptions.endpoint,
      userAgent: pushSubscriptions.userAgent,
      createdAt: pushSubscriptions.createdAt,
      lastUsedAt: pushSubscriptions.lastUsedAt,
    })
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.memberId, ctx.memberId));
  }),
});
