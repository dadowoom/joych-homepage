import { describe, expect, it } from "vitest";
import type { TrpcContext } from "./context";
import {
  PUBLIC_RATE_LIMIT_POLICIES,
  enforcePublicIpRateLimit,
  enforcePublicRateLimit,
  enforcePublicRateLimitForHashedIdentifier,
} from "./publicRateLimits";

function createContext(
  ip: string,
  authenticated: "none" | "admin" | "member" = "none"
) {
  return {
    req: { ip, headers: {} } as TrpcContext["req"],
    user: authenticated === "admin"
      ? ({ id: 101 } as TrpcContext["user"])
      : null,
    memberId: authenticated === "member" ? 1 : null,
  };
}

describe("public rate limits", () => {
  it("enforces the documented support-submission ceiling", () => {
    const ctx = createContext("203.0.113.210");
    for (
      let index = 0;
      index < PUBLIC_RATE_LIMIT_POLICIES.prayerSubmission.limit;
      index += 1
    ) {
      expect(() =>
        enforcePublicRateLimit("prayerSubmission", ctx)
      ).not.toThrow();
    }
    expect(() =>
      enforcePublicRateLimit("prayerSubmission", ctx)
    ).toThrowError(expect.objectContaining({ code: "TOO_MANY_REQUESTS" }));
    expect(() =>
      enforcePublicRateLimit("newMemberSubmission", ctx)
    ).not.toThrow();
  });

  it("rate-limits authenticated flows per account instead of shared IP", () => {
    const adminCtx = createContext("203.0.113.211", "admin");
    const memberCtx = createContext("203.0.113.211", "member");
    for (
      let index = 0;
      index < PUBLIC_RATE_LIMIT_POLICIES.prayerSubmission.limit;
      index += 1
    ) {
      expect(() =>
        enforcePublicRateLimit("prayerSubmission", adminCtx)
      ).not.toThrow();
    }
    expect(() =>
      enforcePublicRateLimit("prayerSubmission", adminCtx)
    ).toThrowError(expect.objectContaining({ code: "TOO_MANY_REQUESTS" }));
    expect(() =>
      enforcePublicRateLimit("prayerSubmission", memberCtx)
    ).not.toThrow();
  });

  it("keeps global search limited for authenticated sessions", () => {
    const ctx = createContext("203.0.113.213", "member");
    for (
      let index = 0;
      index < PUBLIC_RATE_LIMIT_POLICIES.globalSearch.limit;
      index += 1
    ) {
      expect(() => enforcePublicRateLimit("globalSearch", ctx)).not.toThrow();
    }
    expect(() => enforcePublicRateLimit("globalSearch", ctx)).toThrowError(
      expect.objectContaining({ code: "TOO_MANY_REQUESTS" })
    );
  });

  it("separately limits external reservation lookup and management attempts", () => {
    const ctx = createContext("203.0.113.214");
    for (
      let index = 0;
      index < PUBLIC_RATE_LIMIT_POLICIES.externalFacilityReservationLookup.limit;
      index += 1
    ) {
      expect(() =>
        enforcePublicRateLimit("externalFacilityReservationLookup", ctx)
      ).not.toThrow();
    }
    expect(() =>
      enforcePublicRateLimit("externalFacilityReservationLookup", ctx)
    ).toThrowError(expect.objectContaining({ code: "TOO_MANY_REQUESTS" }));
    expect(() =>
      enforcePublicRateLimit("externalFacilityReservationManagement", ctx)
    ).not.toThrow();
  });

  it("keeps external reservation self-service IP limits shared across login states", () => {
    const ip = "203.0.113.215";
    const contexts = [
      createContext(ip, "none"),
      createContext(ip, "admin"),
      createContext(ip, "member"),
    ];
    for (
      let index = 0;
      index < PUBLIC_RATE_LIMIT_POLICIES.externalFacilityReservationLookup.limit;
      index += 1
    ) {
      expect(() =>
        enforcePublicIpRateLimit(
          "externalFacilityReservationLookup",
          contexts[index % contexts.length],
        )
      ).not.toThrow();
    }
    expect(() =>
      enforcePublicIpRateLimit(
        "externalFacilityReservationLookup",
        createContext(ip, "admin"),
      )
    ).toThrowError(expect.objectContaining({ code: "TOO_MANY_REQUESTS" }));
    expect(() =>
      enforcePublicIpRateLimit(
        "externalFacilityReservationLookup",
        createContext("203.0.113.216", "admin"),
      )
    ).not.toThrow();
  });

  it("limits external reservation credentials by SHA-256 digest without accepting raw identifiers", () => {
    const firstDigest = "a".repeat(64);
    const secondDigest = "b".repeat(64);
    for (
      let index = 0;
      index < PUBLIC_RATE_LIMIT_POLICIES.externalFacilityReservationCredential.limit;
      index += 1
    ) {
      expect(() =>
        enforcePublicRateLimitForHashedIdentifier(
          "externalFacilityReservationCredential",
          firstDigest,
        )
      ).not.toThrow();
    }
    expect(() =>
      enforcePublicRateLimitForHashedIdentifier(
        "externalFacilityReservationCredential",
        firstDigest,
      )
    ).toThrowError(expect.objectContaining({ code: "TOO_MANY_REQUESTS" }));
    expect(() =>
      enforcePublicRateLimitForHashedIdentifier(
        "externalFacilityReservationCredential",
        secondDigest,
      )
    ).not.toThrow();
    expect(() =>
      enforcePublicRateLimitForHashedIdentifier(
        "externalFacilityReservationCredential",
        "raw-manage-code",
      )
    ).toThrowError(TypeError);
  });
});
