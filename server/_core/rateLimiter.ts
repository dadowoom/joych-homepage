import { TRPCError } from "@trpc/server";

/**
 * 로그인 실패 횟수 제한 (Rate Limiter)
 * ─────────────────────────────────────────────────────────────────────────────
 * - 같은 계정으로 반복 실패 시 짧게 차단
 * - 같은 IP에서는 여러 성도가 같은 네트워크를 쓸 수 있으므로 더 넉넉하게 제한
 * - 서버 메모리에 저장 (서버 재시작 시 초기화)
 * - 실패 로그에 비밀번호 원문 절대 기록하지 않음
 */

export const LOGIN_ACCOUNT_MAX_ATTEMPTS = 10;
export const LOGIN_ACCOUNT_LOCKOUT_MS = 5 * 60 * 1000;
export const LOGIN_IP_MAX_ATTEMPTS = 40;
export const LOGIN_IP_LOCKOUT_MS = 10 * 60 * 1000;
export const LOGIN_ATTEMPT_WINDOW_MS = 30 * 60 * 1000;
export const RATE_LIMIT_MAX_TRACKED_KEYS = 20_000;

type RateLimitPolicy = {
  maxAttempts: number;
  lockoutMs: number;
  label: string;
};

function getLoginPolicy(key: string): RateLimitPolicy {
  if (key.startsWith("ip:")) {
    return {
      maxAttempts: LOGIN_IP_MAX_ATTEMPTS,
      lockoutMs: LOGIN_IP_LOCKOUT_MS,
      label: "IP",
    };
  }
  return {
    maxAttempts: LOGIN_ACCOUNT_MAX_ATTEMPTS,
    lockoutMs: LOGIN_ACCOUNT_LOCKOUT_MS,
    label: "account",
  };
}

interface AttemptRecord {
  count: number;
  firstAttemptAt: number;
  lockedUntil: number | null; // Unix timestamp (ms), null = 차단 없음
}

// 메모리 저장소: key = "ip:xxx" 또는 "account:xxx"
const store = new Map<string, AttemptRecord>();

/** 오래된 로그인 기록 정리 (메모리 누수 방지) */
export function cleanupLoginRateLimitStore(now = Date.now()) {
  let deleted = 0;
  store.forEach((record, key) => {
    if (
      (record.lockedUntil && record.lockedUntil < now) ||
      (!record.lockedUntil && now - record.firstAttemptAt > LOGIN_ATTEMPT_WINDOW_MS)
    ) {
      store.delete(key);
      deleted += 1;
    }
  });
  return deleted;
}

function ensureLoginStoreCapacity(now: number) {
  if (store.size < RATE_LIMIT_MAX_TRACKED_KEYS) return;
  cleanupLoginRateLimitStore(now);
  while (store.size >= RATE_LIMIT_MAX_TRACKED_KEYS) {
    const oldestKey = store.keys().next().value as string | undefined;
    if (oldestKey === undefined) break;
    store.delete(oldestKey);
  }
}

/** 오래된 기록 정리 — 1시간마다 실행하며 프로세스 종료를 막지 않습니다. */
const loginCleanupTimer = setInterval(
  () => cleanupLoginRateLimitStore(),
  60 * 60 * 1000
);
loginCleanupTimer.unref();

/**
 * 로그인 시도 전 차단 여부 확인
 * @param key - "ip:1.2.3.4" 또는 "account:user@email.com"
 * @throws TRPCError(TOO_MANY_REQUESTS) — 차단 중인 경우
 */
export function checkRateLimit(key: string): void {
  const record = store.get(key);
  if (!record) return;

  const now = Date.now();
  if (record.lockedUntil && record.lockedUntil > now) {
    const remainingMin = Math.ceil((record.lockedUntil - now) / 60000);
    throw Object.assign(new Error(`로그인 시도가 잠시 제한되었습니다. ${remainingMin}분 후 다시 시도해 주세요.`), {
      code: "TOO_MANY_REQUESTS",
    });
  }
  if (
    (record.lockedUntil && record.lockedUntil <= now) ||
    (!record.lockedUntil && now - record.firstAttemptAt > LOGIN_ATTEMPT_WINDOW_MS)
  ) {
    store.delete(key);
  }
}

/**
 * 로그인 실패 기록
 * 정책별 최대 횟수 초과 시 잠시 차단
 * @param key - "ip:1.2.3.4" 또는 "account:user@email.com"
 */
export function recordFailure(key: string): void {
  const now = Date.now();
  const existing = store.get(key);
  if (!existing) ensureLoginStoreCapacity(now);
  const policy = getLoginPolicy(key);
  const record =
    !existing ||
    (existing.lockedUntil !== null && existing.lockedUntil <= now) ||
    (!existing.lockedUntil && now - existing.firstAttemptAt > LOGIN_ATTEMPT_WINDOW_MS)
      ? { count: 0, firstAttemptAt: now, lockedUntil: null }
      : existing;
  record.count += 1;

  if (record.count >= policy.maxAttempts) {
    record.lockedUntil = now + policy.lockoutMs;
    // 비밀번호 원문은 절대 로그에 남기지 않음
    const lockoutMin = Math.ceil(policy.lockoutMs / 60000);
    console.warn(
      `[RateLimit] 로그인 차단: ${policy.label} (${policy.maxAttempts}회 실패, ${lockoutMin}분 차단)`
    );
  }

  store.set(key, record);
}

/**
 * 로그인 성공 시 실패 기록 초기화
 * @param key - "ip:1.2.3.4" 또는 "account:user@email.com"
 */
export function resetFailures(key: string): void {
  store.delete(key);
}

/**
 * Express Request에서 클라이언트 IP 추출
 * Express의 trust proxy 검증이 끝난 req.ip를 우선 사용합니다.
 * 테스트 등 req.ip가 없는 환경에서만 전달 헤더를 보조값으로 사용합니다.
 */
export function getClientIp(req: { ip?: string; headers: Record<string, string | string[] | undefined> }): string {
  const trustedIp = req.ip?.trim();
  if (trustedIp) return trustedIp;

  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) {
    const ip = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(",")[0];
    return ip.trim();
  }
  return "unknown";
}

export type BoundedFixedWindowRateLimiterOptions = {
  limit: number;
  windowMs: number;
  maxKeys: number;
  message: string;
  cleanupIntervalMs?: number;
};

type FixedWindowRecord = {
  count: number;
  expiresAt: number;
};

/**
 * A process-local fixed-window limiter with opportunistic TTL cleanup and a
 * hard key cap. The cap keeps spoofed/high-cardinality client identifiers from
 * growing the process heap without bound.
 */
export class BoundedFixedWindowRateLimiter {
  private readonly records = new Map<string, FixedWindowRecord>();
  private readonly cleanupIntervalMs: number;
  private nextCleanupAt = 0;

  constructor(private readonly options: BoundedFixedWindowRateLimiterOptions) {
    if (!Number.isInteger(options.limit) || options.limit < 1) {
      throw new Error("Rate-limit limit must be a positive integer.");
    }
    if (!Number.isFinite(options.windowMs) || options.windowMs < 1) {
      throw new Error("Rate-limit windowMs must be positive.");
    }
    if (!Number.isInteger(options.maxKeys) || options.maxKeys < 1) {
      throw new Error("Rate-limit maxKeys must be a positive integer.");
    }
    this.cleanupIntervalMs = Math.max(
      1,
      options.cleanupIntervalMs ?? Math.min(options.windowMs, 60_000)
    );
  }

  get size() {
    return this.records.size;
  }

  consume(key: string, now = Date.now()) {
    if (now >= this.nextCleanupAt) {
      this.cleanupExpired(now);
      this.nextCleanupAt = now + this.cleanupIntervalMs;
    }

    const normalizedKey = key.trim() || "unknown";
    const existing = this.records.get(normalizedKey);
    if (!existing || existing.expiresAt < now) {
      if (existing) this.records.delete(normalizedKey);
      this.ensureCapacity(now);
      this.records.set(normalizedKey, {
        count: 1,
        expiresAt: now + this.options.windowMs,
      });
      return;
    }

    if (existing.count >= this.options.limit) {
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: this.options.message,
      });
    }
    existing.count += 1;
  }

  cleanupExpired(now = Date.now()) {
    let deleted = 0;
    this.records.forEach((record, key) => {
      if (record.expiresAt < now) {
        this.records.delete(key);
        deleted += 1;
      }
    });
    return deleted;
  }

  private ensureCapacity(now: number) {
    if (this.records.size < this.options.maxKeys) return;
    this.cleanupExpired(now);
    while (this.records.size >= this.options.maxKeys) {
      const oldestKey = this.records.keys().next().value as string | undefined;
      if (oldestKey === undefined) break;
      this.records.delete(oldestKey);
    }
  }
}

// ─── 검색 API Rate Limiter (내부 주소록 남용 방지) ────────────────────────────
const SEARCH_MAX_PER_MIN = 30;   // 분당 최대 30회
const SEARCH_WINDOW_MS = 60 * 1000; // 1분 윈도우
const searchLimiter = new BoundedFixedWindowRateLimiter({
  limit: SEARCH_MAX_PER_MIN,
  windowMs: SEARCH_WINDOW_MS,
  maxKeys: RATE_LIMIT_MAX_TRACKED_KEYS,
  message: "검색 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.",
});

/** 검색 API 호출 전 rate limit 확인 */
export function checkSearchRateLimit(key: string): void {
  searchLimiter.consume(key);
}

// ─── 회원가입 API Rate Limiter (가입 신청 스팸 방지) ────────────────────────
const REGISTER_MAX_PER_HOUR = 5;
const REGISTER_WINDOW_MS = 60 * 60 * 1000;
const registerLimiter = new BoundedFixedWindowRateLimiter({
  limit: REGISTER_MAX_PER_HOUR,
  windowMs: REGISTER_WINDOW_MS,
  maxKeys: RATE_LIMIT_MAX_TRACKED_KEYS,
  message: "회원가입 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.",
});

/** 회원가입 호출 전 rate limit 확인 */
export function checkRegisterRateLimit(key: string): void {
  registerLimiter.consume(key);
}

// ─── 계정 찾기/재설정 요청 Rate Limiter ──────────────────────────────────────
const ACCOUNT_RECOVERY_MAX_PER_HOUR = 5;
const accountRecoveryLimiter = new BoundedFixedWindowRateLimiter({
  limit: ACCOUNT_RECOVERY_MAX_PER_HOUR,
  windowMs: REGISTER_WINDOW_MS,
  maxKeys: RATE_LIMIT_MAX_TRACKED_KEYS,
  message: "계정 찾기 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.",
});

/** 개인정보 대조와 재설정 요청은 IP·동작별로 시간당 5회까지만 허용합니다. */
export function checkAccountRecoveryRateLimit(key: string): void {
  accountRecoveryLimiter.consume(key);
}
