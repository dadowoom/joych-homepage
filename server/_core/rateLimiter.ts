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

/** 오래된 기록 정리 (메모리 누수 방지) — 1시간마다 실행 */
setInterval(() => {
  const now = Date.now();
  store.forEach((record, key) => {
    if (
      (record.lockedUntil && record.lockedUntil < now) ||
      (!record.lockedUntil && now - record.firstAttemptAt > LOGIN_ATTEMPT_WINDOW_MS)
    ) {
      store.delete(key);
    }
  });
}, 60 * 60 * 1000);

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
 * Nginx 프록시 환경에서 X-Forwarded-For 헤더 우선 사용
 */
export function getClientIp(req: { ip?: string; headers: Record<string, string | string[] | undefined> }): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) {
    const ip = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(",")[0];
    return ip.trim();
  }
  return req.ip ?? "unknown";
}

// ─── 검색 API Rate Limiter (내부 주소록 남용 방지) ────────────────────────────
const SEARCH_MAX_PER_MIN = 30;   // 분당 최대 30회
const SEARCH_WINDOW_MS = 60 * 1000; // 1분 윈도우

interface SearchRecord {
  count: number;
  windowStart: number;
}
const searchStore = new Map<string, SearchRecord>();

/** 검색 API 호출 전 rate limit 확인 */
export function checkSearchRateLimit(key: string): void {
  const now = Date.now();
  const record = searchStore.get(key);
  if (!record || now - record.windowStart > SEARCH_WINDOW_MS) {
    searchStore.set(key, { count: 1, windowStart: now });
    return;
  }
  record.count += 1;
  if (record.count > SEARCH_MAX_PER_MIN) {
    throw Object.assign(new Error("검색 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요."), {
      code: "TOO_MANY_REQUESTS",
    });
  }
}

// ─── 회원가입 API Rate Limiter (가입 신청 스팸 방지) ────────────────────────
const REGISTER_MAX_PER_HOUR = 5;
const REGISTER_WINDOW_MS = 60 * 60 * 1000;
const registerStore = new Map<string, SearchRecord>();

/** 회원가입 호출 전 rate limit 확인 */
export function checkRegisterRateLimit(key: string): void {
  const now = Date.now();
  const record = registerStore.get(key);
  if (!record || now - record.windowStart > REGISTER_WINDOW_MS) {
    registerStore.set(key, { count: 1, windowStart: now });
    return;
  }
  record.count += 1;
  if (record.count > REGISTER_MAX_PER_HOUR) {
    throw Object.assign(new Error("회원가입 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요."), {
      code: "TOO_MANY_REQUESTS",
    });
  }
}
