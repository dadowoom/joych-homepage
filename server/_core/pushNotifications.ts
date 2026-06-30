import webpush from "web-push";
import { eq, inArray, or, type SQL } from "drizzle-orm";
import { adminContentPermissions, pushSubscriptions, users } from "../../drizzle/schema";
import { getDb } from "../db";

let initialized = false;
let warnedMissingVapid = false;

function initWebPush() {
  if (initialized) return true;

  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) {
    if (!warnedMissingVapid) {
      console.warn("[push] VAPID env is missing; push notifications are disabled.");
      warnedMissingVapid = true;
    }
    return false;
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  initialized = true;
  return true;
}

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

function memberIdFromAdminOpenId(openId: string | null | undefined) {
  const match = openId?.match(/^member:(\d+)$/);
  if (!match) return null;

  const memberId = Number(match[1]);
  return Number.isInteger(memberId) && memberId > 0 ? memberId : null;
}

export async function sendPushToPermissionHolders(
  permissionKey: string,
  payload: PushPayload,
): Promise<void> {
  try {
    if (!initWebPush()) return;

    const db = await getDb();
    if (!db) return;

    const permittedUsers = await db
      .select({ id: users.id, openId: users.openId })
      .from(users)
      .leftJoin(adminContentPermissions, eq(adminContentPermissions.userId, users.id))
      .where(or(
        eq(users.role, "admin"),
        eq(adminContentPermissions.permissionKey, permissionKey),
      ));
    const userIds = Array.from(new Set(permittedUsers.map((user) => user.id)));
    const memberIds = Array.from(
      new Set(
        permittedUsers
          .map((user) => memberIdFromAdminOpenId(user.openId))
          .filter((memberId): memberId is number => memberId !== null),
      ),
    );

    const subscriptionConditions: SQL[] = [];
    if (userIds.length > 0) {
      subscriptionConditions.push(inArray(pushSubscriptions.userId, userIds));
    }
    if (memberIds.length > 0) {
      subscriptionConditions.push(inArray(pushSubscriptions.memberId, memberIds));
    }
    if (subscriptionConditions.length === 0) return;

    const subscriptions = await db
      .select()
      .from(pushSubscriptions)
      .where(or(...subscriptionConditions));
    if (subscriptions.length === 0) {
      console.warn(`[push] No subscriptions for permission=${permissionKey}`);
      return;
    }

    const payloadJson = JSON.stringify(payload);
    const results = await Promise.allSettled(subscriptions.map(async (subscription) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: {
              p256dh: subscription.p256dh,
              auth: subscription.auth,
            },
          },
          payloadJson,
        );
      } catch (error: unknown) {
        const statusCode = typeof error === "object" && error !== null && "statusCode" in error
          ? Number((error as { statusCode?: unknown }).statusCode)
          : null;
        if (statusCode === 404 || statusCode === 410) {
          try {
            await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, subscription.id));
          } catch (deleteError) {
            console.warn("[push] Failed to delete expired subscription", deleteError);
          }
          return;
        }

        const message = error instanceof Error ? error.message : String(error);
        console.warn(`[push] Failed to send subscription id=${subscription.id}: ${statusCode ?? message}`);
      }
    }));
    const sentCount = results.filter((result) => result.status === "fulfilled").length;
    const failedCount = results.length - sentCount;
    console.log(`[push] Sent permission=${permissionKey} subscriptions=${subscriptions.length} fulfilled=${sentCount} failed=${failedCount}`);
  } catch (error) {
    console.error("[push] Notification dispatch failed", error);
  }
}

export function notifyFacilityReservation(params: {
  reserverName: string;
  facilityName: string;
  date: string;
  startTime: string;
  endTime: string;
  reservationType: "external" | "member";
  reservationId: number;
  extraCount?: number;
}) {
  const typeLabel = params.reservationType === "external" ? "외부인" : "성도";
  const extraLabel = params.extraCount && params.extraCount > 0 ? ` 외 ${params.extraCount}건` : "";
  return sendPushToPermissionHolders("content:reservations", {
    title: `새 ${typeLabel} 시설 예약 신청`,
    body: `[${params.reserverName}] ${params.facilityName}${extraLabel}\n${params.date} ${params.startTime}~${params.endTime}`,
    url: "/admin_joych_2026?tab=reservations",
    tag: `reservation-${params.reservationId}`,
  });
}
