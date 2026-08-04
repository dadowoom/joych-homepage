import type { TrpcContext } from "./context";
import {
  BoundedFixedWindowRateLimiter,
  RATE_LIMIT_MAX_TRACKED_KEYS,
  getClientIp,
} from "./rateLimiter";

const HOUR_MS = 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

export const PUBLIC_RATE_LIMIT_POLICIES = {
  prayerSubmission: { limit: 60, windowMs: HOUR_MS },
  newMemberSubmission: { limit: 60, windowMs: HOUR_MS },
  visitSubmission: { limit: 60, windowMs: HOUR_MS },
  externalFacilityReservation: { limit: 60, windowMs: HOUR_MS },
  guestCourseApplication: { limit: 120, windowMs: HOUR_MS },
  globalSearch: { limit: 120, windowMs: MINUTE_MS },
} as const;

export type PublicRateLimitScope = keyof typeof PUBLIC_RATE_LIMIT_POLICIES;

function createLimiter(scope: PublicRateLimitScope, message: string) {
  const policy = PUBLIC_RATE_LIMIT_POLICIES[scope];
  return new BoundedFixedWindowRateLimiter({
    ...policy,
    maxKeys: RATE_LIMIT_MAX_TRACKED_KEYS,
    message,
  });
}

const publicLimiters: Record<
  PublicRateLimitScope,
  BoundedFixedWindowRateLimiter
> = {
  prayerSubmission: createLimiter(
    "prayerSubmission",
    "기도 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요."
  ),
  newMemberSubmission: createLimiter(
    "newMemberSubmission",
    "새가족 등록 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요."
  ),
  visitSubmission: createLimiter(
    "visitSubmission",
    "탐방 신청 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요."
  ),
  externalFacilityReservation: createLimiter(
    "externalFacilityReservation",
    "시설 예약 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요."
  ),
  guestCourseApplication: createLimiter(
    "guestCourseApplication",
    "강좌 신청 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요."
  ),
  globalSearch: createLimiter(
    "globalSearch",
    "검색 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요."
  ),
};

export function enforcePublicRateLimit(
  scope: PublicRateLimitScope,
  ctx: Pick<TrpcContext, "req" | "user" | "memberId">
) {
  const actorKey = ctx.user?.id != null
    ? `user:${ctx.user.id}`
    : ctx.memberId != null
      ? `member:${ctx.memberId}`
      : `ip:${getClientIp(ctx.req)}`;
  publicLimiters[scope].consume(actorKey);
}
