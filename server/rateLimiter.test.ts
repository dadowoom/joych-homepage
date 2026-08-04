import { describe, expect, it } from "vitest";
import {
  BoundedFixedWindowRateLimiter,
  LOGIN_ATTEMPT_WINDOW_MS,
  checkAccountRecoveryRateLimit,
  checkRegisterRateLimit,
  checkSearchRateLimit,
  cleanupLoginRateLimitStore,
  getClientIp,
  recordFailure,
} from "./_core/rateLimiter";

describe("getClientIp", () => {
  it("Express가 검증한 req.ip를 임의의 전달 헤더보다 우선한다", () => {
    expect(getClientIp({
      ip: "203.0.113.10",
      headers: { "x-forwarded-for": "198.51.100.99" },
    })).toBe("203.0.113.10");
  });

  it("req.ip가 없는 테스트 환경에서는 첫 전달 주소를 사용한다", () => {
    expect(getClientIp({
      headers: { "x-forwarded-for": "198.51.100.10, 127.0.0.1" },
    })).toBe("198.51.100.10");
  });
});

describe("BoundedFixedWindowRateLimiter", () => {
  function createLimiter(overrides: Partial<ConstructorParameters<typeof BoundedFixedWindowRateLimiter>[0]> = {}) {
    return new BoundedFixedWindowRateLimiter({
      limit: 2,
      windowMs: 100,
      maxKeys: 2,
      message: "Too many requests",
      cleanupIntervalMs: 1,
      ...overrides,
    });
  }

  it("allows the configured count and rejects the next request", () => {
    const limiter = createLimiter();
    limiter.consume("client-a", 1_000);
    limiter.consume("client-a", 1_001);
    expect(() => limiter.consume("client-a", 1_002)).toThrowError(
      expect.objectContaining({ code: "TOO_MANY_REQUESTS" })
    );
  });

  it("expires records after the fixed window and removes stale keys", () => {
    const limiter = createLimiter();
    limiter.consume("client-a", 1_000);
    limiter.consume("client-a", 1_001);
    expect(() => limiter.consume("client-a", 1_100)).toThrow();
    expect(() => limiter.consume("client-a", 1_101)).not.toThrow();

    limiter.consume("client-b", 1_101);
    expect(limiter.cleanupExpired(1_202)).toBe(2);
    expect(limiter.size).toBe(0);
  });

  it("keeps the tracked-key map at its configured hard cap", () => {
    const limiter = createLimiter({ windowMs: 10_000 });
    limiter.consume("client-a", 1_000);
    limiter.consume("client-b", 1_001);
    limiter.consume("client-c", 1_002);
    expect(limiter.size).toBe(2);
  });
});

describe("login limiter cleanup", () => {
  it("removes an unlocked login record after the existing 30-minute TTL", () => {
    const now = Date.now();
    recordFailure(`account:cleanup-${now}@example.test`);
    expect(
      cleanupLoginRateLimitStore(now + LOGIN_ATTEMPT_WINDOW_MS + 1_000)
    ).toBeGreaterThanOrEqual(1);
  });
});

describe("legacy public limiter policies", () => {
  it("keeps directory search at 30 requests per minute", () => {
    const key = `search:policy-${Date.now()}`;
    for (let index = 0; index < 30; index += 1) {
      expect(() => checkSearchRateLimit(key)).not.toThrow();
    }
    expect(() => checkSearchRateLimit(key)).toThrowError(
      expect.objectContaining({ code: "TOO_MANY_REQUESTS" })
    );
  });

  it("keeps registration and account recovery at 5 requests per hour", () => {
    const suffix = Date.now();
    const registrationKey = `register:policy-${suffix}`;
    const recoveryKey = `password-reset:policy-${suffix}`;
    for (let index = 0; index < 5; index += 1) {
      expect(() => checkRegisterRateLimit(registrationKey)).not.toThrow();
      expect(() => checkAccountRecoveryRateLimit(recoveryKey)).not.toThrow();
    }
    expect(() => checkRegisterRateLimit(registrationKey)).toThrowError(
      expect.objectContaining({ code: "TOO_MANY_REQUESTS" })
    );
    expect(() => checkAccountRecoveryRateLimit(recoveryKey)).toThrowError(
      expect.objectContaining({ code: "TOO_MANY_REQUESTS" })
    );
  });
});
