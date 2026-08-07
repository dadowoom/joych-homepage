import { describe, expect, it } from "vitest";
import {
  BoundedFixedWindowRateLimiter,
  LOGIN_ATTEMPT_WINDOW_MS,
  MEMBER_REGISTRATION_RATE_LIMIT_POLICY,
  checkAccountRecoveryRateLimit,
  checkMemberOAuthCallbackRateLimit,
  checkMemberOAuthSignupCompleteRateLimit,
  checkMemberOAuthSignupContextIdentityRateLimit,
  checkMemberOAuthSignupContextIpRateLimit,
  checkMemberOAuthStartRateLimit,
  checkMemberRegistrationIngressRateLimit,
  checkMemberRegistrationRateLimit,
  checkSearchRateLimit,
  cleanupLoginRateLimitStore,
  getClientIp,
  recordFailure,
} from "./_core/rateLimiter";

describe("getClientIp", () => {
  it("Express가 검증한 req.ip를 임의의 전달 헤더보다 우선한다", () => {
    expect(
      getClientIp({
        ip: "203.0.113.10",
        headers: { "x-forwarded-for": "198.51.100.99" },
      })
    ).toBe("203.0.113.10");
  });

  it("req.ip가 없는 테스트 환경에서는 첫 전달 주소를 사용한다", () => {
    expect(
      getClientIp({
        headers: { "x-forwarded-for": "198.51.100.10, 127.0.0.1" },
      })
    ).toBe("198.51.100.10");
  });
});

describe("BoundedFixedWindowRateLimiter", () => {
  function createLimiter(
    overrides: Partial<
      ConstructorParameters<typeof BoundedFixedWindowRateLimiter>[0]
    > = {}
  ) {
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

describe("public limiter policies", () => {
  it("keeps directory search at 30 requests per minute", () => {
    const key = `search:policy-${Date.now()}`;
    for (let index = 0; index < 30; index += 1) {
      expect(() => checkSearchRateLimit(key)).not.toThrow();
    }
    expect(() => checkSearchRateLimit(key)).toThrowError(
      expect.objectContaining({ code: "TOO_MANY_REQUESTS" })
    );
  });

  it("keeps account recovery at 5 requests per hour", () => {
    const suffix = `${Date.now()}-${Math.random()}`;
    const recoveryKey = `password-reset:policy-${suffix}`;
    for (let index = 0; index < 5; index += 1) {
      expect(() => checkAccountRecoveryRateLimit(recoveryKey)).not.toThrow();
    }
    expect(() => checkAccountRecoveryRateLimit(recoveryKey)).toThrowError(
      expect.objectContaining({ code: "TOO_MANY_REQUESTS" })
    );
  });
});

describe("member registration abuse policies", () => {
  it("bounds registration work before configuration database reads", () => {
    const suffix = `${Date.now()}-${Math.random()}`;
    const clientIp = `registration-ingress-${suffix}`;
    for (
      let index = 0;
      index < MEMBER_REGISTRATION_RATE_LIMIT_POLICY.registrationIngressIp.limit;
      index += 1
    ) {
      expect(() => checkMemberRegistrationIngressRateLimit(clientIp)).not.toThrow();
    }
    expect(() => checkMemberRegistrationIngressRateLimit(clientIp)).toThrowError(
      expect.objectContaining({ code: "TOO_MANY_REQUESTS" })
    );
  });

  it("allows well beyond the sixth signup from one shared church IP", () => {
    const suffix = `${Date.now()}-${Math.random()}`;
    const sharedIp = `church-network-${suffix}`;

    for (
      let index = 0;
      index < MEMBER_REGISTRATION_RATE_LIMIT_POLICY.ip.limit;
      index += 1
    ) {
      expect(() =>
        checkMemberRegistrationRateLimit({
          clientIp: sharedIp,
          identities: [
            { kind: "phone", value: `010-0000-${suffix}-${index}` },
            { kind: "email", value: `member-${suffix}-${index}@example.test` },
          ],
        })
      ).not.toThrow();
    }

    const nextPhone = `next-${suffix}`;
    for (
      let index = 0;
      index < MEMBER_REGISTRATION_RATE_LIMIT_POLICY.identity.limit;
      index += 1
    ) {
      expect(() =>
        checkMemberRegistrationRateLimit({
          clientIp: sharedIp,
          identities: [{ kind: "phone", value: nextPhone }],
        })
      ).toThrowError(expect.objectContaining({ code: "TOO_MANY_REQUESTS" }));
    }

    expect(() =>
      checkMemberRegistrationRateLimit({
        clientIp: `fresh-shared-ip-${suffix}`,
        identities: [{ kind: "phone", value: nextPhone }],
      })
    ).not.toThrow();
  });

  it("blocks repeated use of one identity without consuming other IP quotas", () => {
    const suffix = `${Date.now()}-${Math.random()}`;
    const phone = `same-phone-${suffix}`;

    for (
      let index = 0;
      index < MEMBER_REGISTRATION_RATE_LIMIT_POLICY.identity.limit;
      index += 1
    ) {
      expect(() =>
        checkMemberRegistrationRateLimit({
          clientIp: `rotating-ip-${suffix}-${index}`,
          identities: [{ kind: "phone", value: phone }],
        })
      ).not.toThrow();
    }

    expect(() =>
      checkMemberRegistrationRateLimit({
        clientIp: `another-ip-${suffix}`,
        identities: [{ kind: "phone", value: phone }],
      })
    ).toThrowError(expect.objectContaining({ code: "TOO_MANY_REQUESTS" }));

    expect(() =>
      checkMemberRegistrationRateLimit({
        clientIp: `another-ip-${suffix}`,
        identities: [{ kind: "phone", value: `different-phone-${suffix}` }],
      })
    ).not.toThrow();
  });

  it("does not consume earlier identities when a later identity rejects the request", () => {
    const suffix = `${Date.now()}-${Math.random()}`;
    const blockedEmail = `blocked-${suffix}@example.test`;

    for (
      let index = 0;
      index < MEMBER_REGISTRATION_RATE_LIMIT_POLICY.identity.limit;
      index += 1
    ) {
      expect(() =>
        checkMemberRegistrationRateLimit({
          clientIp: `email-prime-ip-${suffix}-${index}`,
          identities: [
            { kind: "phone", value: `email-prime-phone-${suffix}-${index}` },
            { kind: "email", value: blockedEmail },
          ],
        })
      ).not.toThrow();
    }

    const victimPhone = `victim-phone-${suffix}`;
    for (
      let index = 0;
      index < MEMBER_REGISTRATION_RATE_LIMIT_POLICY.identity.limit;
      index += 1
    ) {
      expect(() =>
        checkMemberRegistrationRateLimit({
          clientIp: `rejected-ip-${suffix}-${index}`,
          identities: [
            { kind: "phone", value: victimPhone },
            { kind: "email", value: blockedEmail },
          ],
        })
      ).toThrowError(expect.objectContaining({ code: "TOO_MANY_REQUESTS" }));
    }

    expect(() =>
      checkMemberRegistrationRateLimit({
        clientIp: `fresh-ip-${suffix}`,
        identities: [
          { kind: "phone", value: victimPhone },
          { kind: "email", value: `fresh-${suffix}@example.test` },
        ],
      })
    ).not.toThrow();
  });

  it("limits OAuth start and callback work before external provider requests", () => {
    const suffix = `${Date.now()}-${Math.random()}`;
    const startIp = `oauth-start-${suffix}`;
    const callbackIp = `oauth-callback-${suffix}`;
    const completeIp = `oauth-complete-${suffix}`;

    for (
      let index = 0;
      index < MEMBER_REGISTRATION_RATE_LIMIT_POLICY.oauthStartIp.limit;
      index += 1
    ) {
      expect(() => checkMemberOAuthStartRateLimit(startIp)).not.toThrow();
    }
    expect(() => checkMemberOAuthStartRateLimit(startIp)).toThrowError(
      expect.objectContaining({ code: "TOO_MANY_REQUESTS" })
    );

    for (
      let index = 0;
      index < MEMBER_REGISTRATION_RATE_LIMIT_POLICY.oauthCallbackIp.limit;
      index += 1
    ) {
      expect(() => checkMemberOAuthCallbackRateLimit(callbackIp)).not.toThrow();
    }
    expect(() => checkMemberOAuthCallbackRateLimit(callbackIp)).toThrowError(
      expect.objectContaining({ code: "TOO_MANY_REQUESTS" })
    );

    for (
      let index = 0;
      index < MEMBER_REGISTRATION_RATE_LIMIT_POLICY.oauthSignupCompleteIp.limit;
      index += 1
    ) {
      expect(() =>
        checkMemberOAuthSignupCompleteRateLimit(completeIp)
      ).not.toThrow();
    }
    expect(() =>
      checkMemberOAuthSignupCompleteRateLimit(completeIp)
    ).toThrowError(expect.objectContaining({ code: "TOO_MANY_REQUESTS" }));
  });

  it("limits OAuth signup context by signed social identity as well as IP", () => {
    const suffix = `${Date.now()}-${Math.random()}`;
    const providerUserId = `google-user-${suffix}`;

    for (
      let index = 0;
      index <
      MEMBER_REGISTRATION_RATE_LIMIT_POLICY.oauthSignupContextIdentity.limit;
      index += 1
    ) {
      expect(() =>
        checkMemberOAuthSignupContextIdentityRateLimit({
          provider: "google",
          providerUserId,
        })
      ).not.toThrow();
    }

    expect(() =>
      checkMemberOAuthSignupContextIdentityRateLimit({
        provider: "google",
        providerUserId,
      })
    ).toThrowError(expect.objectContaining({ code: "TOO_MANY_REQUESTS" }));

    const sharedIp = `context-shared-ip-${suffix}`;
    for (
      let index = 0;
      index < MEMBER_REGISTRATION_RATE_LIMIT_POLICY.oauthSignupContextIp.limit;
      index += 1
    ) {
      expect(() =>
        checkMemberOAuthSignupContextIpRateLimit(sharedIp)
      ).not.toThrow();
    }

    expect(() =>
      checkMemberOAuthSignupContextIpRateLimit(sharedIp)
    ).toThrowError(expect.objectContaining({ code: "TOO_MANY_REQUESTS" }));
  });
});
