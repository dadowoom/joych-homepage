import crypto from "node:crypto";
import webpush from "web-push";
import { eq, inArray, or, type SQL } from "drizzle-orm";
import { adminContentPermissions, pushSubscriptions, users } from "../../drizzle/schema";
import { getDb, getMembersAssignedToDistrict } from "../db";

let initialized = false;
let warnedMissingVapid = false;
let vapidPublicKeyFingerprint = "";

function fingerprint(value: string | null | undefined) {
  if (!value) return "missing";
  return crypto.createHash("sha256").update(value).digest("hex").slice(0, 12);
}

function endpointPreview(endpoint: string) {
  return `${endpoint.slice(0, 32)}...${endpoint.slice(-12)}`;
}

function initWebPush() {
  if (initialized) return true;

  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  const subject = process.env.VAPID_SUBJECT?.trim();
  if (!publicKey || !privateKey || !subject) {
    if (!warnedMissingVapid) {
      console.warn("[push] VAPID env is missing; push notifications are disabled.");
      warnedMissingVapid = true;
    }
    return false;
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  vapidPublicKeyFingerprint = fingerprint(publicKey);
  console.log(`[push] VAPID initialized publicKeyFingerprint=${vapidPublicKeyFingerprint} subject=${subject}`);
  initialized = true;
  return true;
}

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

type PushSendOutcome = "sent" | "expired" | "failed";

function memberIdFromAdminOpenId(openId: string | null | undefined) {
  const match = openId?.match(/^member:(\d+)$/);
  if (!match) return null;

  const memberId = Number(match[1]);
  return Number.isInteger(memberId) && memberId > 0 ? memberId : null;
}

async function dispatchPushSubscriptions(
  subscriptions: Array<typeof pushSubscriptions.$inferSelect>,
  payload: PushPayload,
  context: string,
) {
  const db = await getDb();
  if (!db) return;

  if (subscriptions.length === 0) {
    console.warn(`[push] No subscriptions for ${context} vapid=${vapidPublicKeyFingerprint || "uninitialized"}`);
    return;
  }

  const payloadJson = JSON.stringify(payload);
  const results = await Promise.allSettled(subscriptions.map(async (subscription): Promise<PushSendOutcome> => {
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
      return "sent";
    } catch (error: unknown) {
      const statusCode = typeof error === "object" && error !== null && "statusCode" in error
        ? Number((error as { statusCode?: unknown }).statusCode)
        : null;
      if (statusCode === 404 || statusCode === 410) {
        console.warn(`[push] Expired subscription id=${subscription.id} status=${statusCode} endpoint=${endpointPreview(subscription.endpoint)} vapid=${vapidPublicKeyFingerprint}; deleting`);
        try {
          await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, subscription.id));
        } catch (deleteError) {
          console.warn("[push] Failed to delete expired subscription", deleteError);
        }
        return "expired";
      }

      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[push] Failed to send subscription id=${subscription.id} endpoint=${endpointPreview(subscription.endpoint)}: ${statusCode ?? message}`);
      return "failed";
    }
  }));

  const outcomes = results.map((result): PushSendOutcome =>
    result.status === "fulfilled" ? result.value : "failed",
  );
  const sentCount = outcomes.filter((outcome) => outcome === "sent").length;
  const expiredCount = outcomes.filter((outcome) => outcome === "expired").length;
  const failedCount = outcomes.filter((outcome) => outcome === "failed").length;
  console.log(`[push] Dispatch ${context} subscriptions=${subscriptions.length} sent=${sentCount} expired=${expiredCount} failed=${failedCount} vapid=${vapidPublicKeyFingerprint}`);
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
      console.warn(`[push] No subscriptions for permission=${permissionKey} permittedUsers=${userIds.length} linkedMembers=${memberIds.length} vapid=${vapidPublicKeyFingerprint || "uninitialized"}`);
      return;
    }

    await dispatchPushSubscriptions(subscriptions, payload, `permission=${permissionKey}`);
  } catch (error) {
    console.error("[push] Notification dispatch failed", error);
  }
}

export async function sendPushToMember(
  memberId: number | null | undefined,
  payload: PushPayload,
  context: string,
): Promise<void> {
  try {
    if (!memberId) {
      console.warn(`[push] No member target for ${context}`);
      return;
    }
    if (!initWebPush()) return;

    const db = await getDb();
    if (!db) return;

    const subscriptions = await db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.memberId, memberId));

    await dispatchPushSubscriptions(subscriptions, payload, `${context} memberId=${memberId}`);
  } catch (error) {
    console.error(`[push] Member notification failed context=${context}`, error);
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

export function notifyFacilityReservationResult(params: {
  memberId: number | null | undefined;
  status: "approved" | "rejected" | "cancelled";
  facilityName: string | null | undefined;
  date: string;
  startTime: string;
  endTime: string;
  reservationId: number;
  extraCount?: number;
}) {
  const statusLabel = params.status === "approved"
    ? "승인"
    : params.status === "rejected"
      ? "거절"
      : "취소";
  const extraLabel = params.extraCount && params.extraCount > 0 ? ` 외 ${params.extraCount}건` : "";
  return sendPushToMember(params.memberId, {
    title: `시설 예약이 ${statusLabel}되었습니다`,
    body: `${params.facilityName ?? "시설"}${extraLabel}\n${params.date} ${params.startTime}~${params.endTime}`,
    url: "/facility/my-reservations",
    tag: `reservation-result-${params.reservationId}-${params.status}`,
  }, `reservation-result id=${params.reservationId} status=${params.status}`);
}

export function notifyVehicleReservationResult(params: {
  memberId: number | null | undefined;
  status: "approved" | "rejected" | "cancelled";
  vehicleName: string | null | undefined;
  date: string;
  startTime: string;
  endTime: string;
  reservationId: number;
}) {
  const statusLabel = params.status === "approved"
    ? "승인"
    : params.status === "rejected"
      ? "거절"
      : "취소";
  return sendPushToMember(params.memberId, {
    title: `차량 예약이 ${statusLabel}되었습니다`,
    body: `${params.vehicleName ?? "차량"}\n${params.date} ${params.startTime}~${params.endTime}`,
    url: "/support/vehicle/my-reservations",
    tag: `vehicle-reservation-result-${params.reservationId}-${params.status}`,
  }, `vehicle-reservation-result id=${params.reservationId} status=${params.status}`);
}

export async function sendPushToDistrictManagers(
  district: string | null | undefined,
  payload: PushPayload,
): Promise<void> {
  const normalizedDistrict = district?.trim();
  if (!normalizedDistrict) return;

  try {
    const managers = await getMembersAssignedToDistrict(normalizedDistrict);
    if (managers.length === 0) {
      console.warn(`[push] No district managers for district=${normalizedDistrict}`);
      return;
    }

    await Promise.allSettled(
      managers.map((manager) =>
        sendPushToMember(
          manager.id,
          payload,
          `district-manager district=${normalizedDistrict}`,
        )
      ),
    );
  } catch (error) {
    console.error(`[push] District manager notification failed district=${normalizedDistrict}`, error);
  }
}

export function notifyCourseApplicationToDistrictManager(params: {
  applicantName: string;
  applicantDistrict: string | null | undefined;
  courseTitle: string;
  applicationId: number;
}): void {
  if (!params.applicantDistrict?.trim()) return;

  void sendPushToDistrictManagers(params.applicantDistrict, {
    title: "우리 구역 강좌 신청",
    body: `[${params.applicantName}] ${params.courseTitle} 신청`,
    url: "/admin_joych_2026?tab=courses",
    tag: `course-application-${params.applicationId}`,
  });
}
