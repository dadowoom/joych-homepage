import { SignJWT } from "jose";
import { beforeEach, describe, expect, it } from "vitest";
import { getJwtSecretKey } from "./_core/jwtSecret";
import {
  buildPrimaryBridgeReturnUrl,
  buildPrimaryLogoutReturnUrl,
  assertSessionBridgeRequestOrigin,
  consumeSessionBridgeToken,
  createDomainLogoutIntent,
  createSessionBridgeToken,
  domainLogoutIntentMatchesSession,
  normalizeBridgeReturnTo,
  resetConsumedSessionBridgeTokensForTests,
  verifySessionBridgeToken,
  verifyDomainLogoutIntent,
  verifyAndConsumeSessionBridgeToken,
} from "./_core/domainSessionBridge";

describe("domain session bridge", () => {
  beforeEach(() => resetConsumedSessionBridgeTokensForTests());

  it("preserves a local path, query, and hash", () => {
    expect(normalizeBridgeReturnTo("/support/vehicle?tab=my#schedule"))
      .toBe("/support/vehicle?tab=my#schedule");
    expect(buildPrimaryBridgeReturnUrl("/support/vehicle?tab=my#schedule"))
      .toBe("https://www.joych.org/support/vehicle?tab=my&__joych_bridge=1#schedule");
  });

  it.each([
    "https://evil.example/phishing",
    "//evil.example/phishing",
    "/\\evil.example/phishing",
    "javascript:alert(1)",
    "\u0000/broken",
  ])("rejects unsafe return destinations: %s", value => {
    expect(normalizeBridgeReturnTo(value)).toBe("/");
  });

  it("accepts a valid token only once", async () => {
    const token = await createSessionBridgeToken({
      returnTo: "/admin_joych_2026",
      sourceOrigin: "https://newjoych.co.kr",
      memberId: 7,
      memberPersistent: true,
      memberSessionVersion: 3,
      adminOpenId: "admin-open-id",
    });

    await expect(verifyAndConsumeSessionBridgeToken(token)).resolves.toMatchObject({
      returnTo: "/admin_joych_2026",
      memberId: 7,
      memberPersistent: true,
      memberSessionVersion: 3,
      adminOpenId: "admin-open-id",
      sourceOrigin: "https://newjoych.co.kr",
    });
    await expect(verifyAndConsumeSessionBridgeToken(token)).rejects.toThrow("already used");
  });

  it("binds a token to its legacy source origin before consuming it", async () => {
    const token = await createSessionBridgeToken({
      returnTo: "/member/my-page",
      sourceOrigin: "https://newjoych.co.kr",
      memberId: 7,
      memberSessionVersion: 3,
    });
    const claims = await verifySessionBridgeToken(token);

    expect(() => assertSessionBridgeRequestOrigin(claims, "https://evil.example"))
      .toThrow("origin mismatch");
    expect(() => assertSessionBridgeRequestOrigin(claims, undefined))
      .toThrow("origin mismatch");

    expect(() => assertSessionBridgeRequestOrigin(claims, "https://newjoych.co.kr"))
      .not.toThrow();
    expect(() => consumeSessionBridgeToken(claims)).not.toThrow();
    await expect(verifyAndConsumeSessionBridgeToken(token)).rejects.toThrow("already used");
  });

  it("marks a completed cross-domain logout without re-entering the login bridge", () => {
    expect(buildPrimaryLogoutReturnUrl("/member/login?next=%2Fsupport%2Fvehicle#top"))
      .toBe("https://www.joych.org/member/login?next=%2Fsupport%2Fvehicle&__joych_logout=1#top");
  });

  it("binds a logout intent to the initiating browser or matching account", async () => {
    let cookieToken = "";
    const req = {
      protocol: "https",
      headers: { host: "www.joych.org" },
    } as any;
    const res = {
      cookie: (_name: string, value: string) => {
        cookieToken = value;
      },
    } as any;
    const token = await createDomainLogoutIntent(req, res, { memberId: 17 });

    expect(token).toBeTruthy();
    expect(cookieToken).toBe(token);
    const claims = await verifyDomainLogoutIntent(token!);
    expect(domainLogoutIntentMatchesSession(claims, {
      hasLocalIntent: false,
      memberId: 999,
    })).toBe(false);
    expect(domainLogoutIntentMatchesSession(claims, {
      hasLocalIntent: false,
      memberId: 17,
    })).toBe(true);
    expect(domainLogoutIntentMatchesSession(claims, {
      hasLocalIntent: true,
    })).toBe(true);
  });

  it("rejects expired tokens", async () => {
    const token = await new SignJWT({
      type: "joych_domain_session_bridge",
      returnTo: "/",
      sourceOrigin: "https://newjoych.co.kr",
    })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setIssuer("https://newjoych.co.kr")
      .setAudience("https://www.joych.org")
      .setJti("expired-token")
      .setIssuedAt(Math.floor(Date.now() / 1000) - 120)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
      .sign(getJwtSecretKey());

    await expect(verifyAndConsumeSessionBridgeToken(token)).rejects.toThrow();
  });
});
