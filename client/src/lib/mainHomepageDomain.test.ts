import { describe, expect, it } from "vitest";
import {
  DOMAIN_BRIDGE_RETURN_MARKER,
  DOMAIN_BRIDGE_RETURN_VALUE,
  DOMAIN_LOGOUT_RETURN_MARKER,
  buildDomainBridgeReturnTo,
  buildDomainSessionBridgeUrl,
  buildDomainSessionLogoutUrl,
  createDomainSessionProbeStorageValue,
  getSiteDomainGateAction,
  hasDomainBridgeReturnMarker,
  hasDomainLogoutReturnMarker,
  isRecentDomainSessionProbeStorageValue,
  stripDomainBridgeReturnMarker,
  type SiteDomainGateDecisionInput,
} from "./mainHomepageDomain";

const primaryAnonymousVisit: SiteDomainGateDecisionInput = {
  hostname: "www.joych.org",
  pathname: "/worship/bulletin",
  isStandalonePwa: false,
  isAdminSessionPending: false,
  isMemberSessionPending: false,
  isAdmin: false,
  hasMemberSession: false,
  hasBridgeReturnMarker: false,
  hasProbedLegacySession: false,
};

describe("getSiteDomainGateAction", () => {
  it.each([
    "newjoych.co.kr",
    "www.newjoych.co.kr",
    "joych.org",
    "m.joych.org",
  ])("moves regular browser traffic from %s through that legacy host's bridge", hostname => {
    expect(
      getSiteDomainGateAction({
        ...primaryAnonymousVisit,
        hostname,
      }),
    ).toBe("redirect-through-current-legacy-host");
  });

  it.each(["newjoych.co.kr", "www.newjoych.co.kr"])(
    "keeps an already-installed PWA on %s so its service worker and push origin remain valid",
    hostname => {
      expect(
        getSiteDomainGateAction({
          ...primaryAnonymousVisit,
          hostname,
          isStandalonePwa: true,
        }),
      ).toBe("render");
    },
  );

  it("does not treat a bare-domain browser as the preserved Newjoych PWA", () => {
    expect(
      getSiteDomainGateAction({
        ...primaryAnonymousVisit,
        hostname: "joych.org",
        isStandalonePwa: true,
      }),
    ).toBe("redirect-through-current-legacy-host");
  });

  it.each(["newjoych.co.kr", "www.newjoych.co.kr"])(
    "keeps social signup completion on %s until the temporary signup cookie is consumed",
    hostname => {
      expect(
        getSiteDomainGateAction({
          ...primaryAnonymousVisit,
          hostname,
          pathname: "/member/social-complete",
        }),
      ).toBe("render");
    },
  );

  it("still migrates social-complete from hosts that do not own the social signup cookie", () => {
    expect(
      getSiteDomainGateAction({
        ...primaryAnonymousVisit,
        hostname: "m.joych.org",
        pathname: "/member/social-complete",
      }),
    ).toBe("redirect-through-current-legacy-host");
  });

  it("waits for both primary-domain login checks before showing the site", () => {
    expect(
      getSiteDomainGateAction({
        ...primaryAnonymousVisit,
        isMemberSessionPending: true,
      }),
    ).toBe("wait-for-primary-session");

    expect(
      getSiteDomainGateAction({
        ...primaryAnonymousVisit,
        isAdminSessionPending: true,
      }),
    ).toBe("wait-for-primary-session");
  });

  it("renders immediately when only the administrator session exists on www", () => {
    expect(
      getSiteDomainGateAction({
        ...primaryAnonymousVisit,
        isAdmin: true,
      }),
    ).toBe("render");
  });

  it("does not wait for the member-session check after the administrator session is confirmed", () => {
    expect(
      getSiteDomainGateAction({
        ...primaryAnonymousVisit,
        isAdmin: true,
        isMemberSessionPending: true,
      }),
    ).toBe("render");
  });

  it("checks Newjoych once when only the member session exists on www", () => {
    expect(
      getSiteDomainGateAction({
        ...primaryAnonymousVisit,
        hasMemberSession: true,
      }),
    ).toBe("probe-legacy-session");
  });

  it("renders immediately when both primary-domain sessions are already present", () => {
    expect(
      getSiteDomainGateAction({
        ...primaryAnonymousVisit,
        isAdmin: true,
        hasMemberSession: true,
      }),
    ).toBe("render");
  });

  it("probes Newjoych once for an anonymous first visit to www", () => {
    expect(getSiteDomainGateAction(primaryAnonymousVisit)).toBe("probe-legacy-session");
  });

  it("keeps a PWA installed from www inside the primary app scope", () => {
    expect(getSiteDomainGateAction({
      ...primaryAnonymousVisit,
      isStandalonePwa: true,
    })).toBe("render");
  });

  it("does not loop after the bridge return marker is received", () => {
    expect(
      getSiteDomainGateAction({
        ...primaryAnonymousVisit,
        hasBridgeReturnMarker: true,
      }),
    ).toBe("render");
  });

  it("does not restore an old-domain session after an explicit logout", () => {
    expect(
      getSiteDomainGateAction({
        ...primaryAnonymousVisit,
        hasExplicitlyLoggedOut: true,
      }),
    ).toBe("render");
    expect(
      getSiteDomainGateAction({
        ...primaryAnonymousVisit,
        hasLogoutReturnMarker: true,
      }),
    ).toBe("render");
  });

  it("does not probe more than once in the same tab", () => {
    expect(
      getSiteDomainGateAction({
        ...primaryAnonymousVisit,
        hasProbedLegacySession: true,
      }),
    ).toBe("render");
  });

  it("does not interfere with localhost development", () => {
    expect(
      getSiteDomainGateAction({
        ...primaryAnonymousVisit,
        hostname: "localhost",
      }),
    ).toBe("render");
  });
});

describe("domain bridge URL handling", () => {
  const currentLocation = {
    pathname: "/page/%EC%84%AC%EA%B8%B0%EB%8A%94-%EB%B6%84",
    search: "?tab=elder&tag=%EC%9E%A5%EB%A1%9C&tag=staff",
    hash: "#song-gukhyeon",
  };

  it("preserves the complete path, query values, duplicate query keys and hash", () => {
    const returnTo = buildDomainBridgeReturnTo(currentLocation);
    const parsed = new URL(returnTo, "https://www.joych.org");

    expect(parsed.pathname).toBe(currentLocation.pathname);
    expect(parsed.searchParams.get("tab")).toBe("elder");
    expect(parsed.searchParams.getAll("tag")).toEqual(["장로", "staff"]);
    expect(parsed.hash).toBe("#song-gukhyeon");
    expect(parsed.searchParams.get(DOMAIN_BRIDGE_RETURN_MARKER)).toBe(
      DOMAIN_BRIDGE_RETURN_VALUE,
    );
  });

  it("uses the current legacy origin for a legacy-to-primary transfer", () => {
    const destination = new URL(
      buildDomainSessionBridgeUrl("https://m.joych.org", currentLocation),
    );

    expect(destination.origin).toBe("https://m.joych.org");
    expect(destination.pathname).toBe("/api/domain-session-bridge/start");
    expect(destination.searchParams.get("returnTo")).toBe(
      buildDomainBridgeReturnTo(currentLocation),
    );
  });

  it("uses Newjoych for the one-time old-session probe from www", () => {
    const destination = new URL(
      buildDomainSessionBridgeUrl("https://newjoych.co.kr", currentLocation),
    );

    expect(destination.origin).toBe("https://newjoych.co.kr");
    expect(destination.searchParams.get("returnTo")).toContain("#song-gukhyeon");
  });

  it("sends logout through Newjoych and preserves a safe primary return", () => {
    const destination = new URL(
      buildDomainSessionLogoutUrl("https://newjoych.co.kr", {
        pathname: "/member/login",
        search: "?next=%2Fsupport%2Fvehicle",
        hash: "#top",
      }, "signed-logout-intent"),
    );
    const returnTo = new URL(
      destination.searchParams.get("returnTo")!,
      "https://www.joych.org",
    );

    expect(destination.pathname).toBe("/api/domain-session-bridge/logout");
    expect(destination.searchParams.get("intent")).toBe("signed-logout-intent");
    expect(returnTo.pathname).toBe("/member/login");
    expect(returnTo.searchParams.get("next")).toBe("/support/vehicle");
    expect(returnTo.searchParams.get(DOMAIN_LOGOUT_RETURN_MARKER)).toBe("1");
    expect(returnTo.hash).toBe("#top");
    expect(hasDomainLogoutReturnMarker(returnTo.search)).toBe(true);
  });

  it("recognizes only the current bridge marker value", () => {
    expect(
      hasDomainBridgeReturnMarker(`?${DOMAIN_BRIDGE_RETURN_MARKER}=${DOMAIN_BRIDGE_RETURN_VALUE}`),
    ).toBe(true);
    expect(hasDomainBridgeReturnMarker(`?${DOMAIN_BRIDGE_RETURN_MARKER}=old`)).toBe(false);
  });

  it("removes only the internal marker after returning to www", () => {
    const marked = buildDomainBridgeReturnTo(currentLocation);
    const parsed = new URL(marked, "https://www.joych.org");
    const visibleUrl = stripDomainBridgeReturnMarker({
      pathname: parsed.pathname,
      search: parsed.search,
      hash: parsed.hash,
    });
    const visible = new URL(visibleUrl, "https://www.joych.org");

    expect(visible.pathname).toBe(currentLocation.pathname);
    expect(visible.searchParams.get("tab")).toBe("elder");
    expect(visible.searchParams.getAll("tag")).toEqual(["장로", "staff"]);
    expect(visible.searchParams.has(DOMAIN_BRIDGE_RETURN_MARKER)).toBe(false);
    expect(visible.hash).toBe("#song-gukhyeon");
  });

  it("does not allow malformed path input to turn returnTo into a different origin", () => {
    const returnTo = buildDomainBridgeReturnTo({
      pathname: "//attacker.example/steal",
      search: "?keep=1",
      hash: "#safe",
    });
    const parsed = new URL(returnTo, "https://www.joych.org");

    expect(parsed.origin).toBe("https://www.joych.org");
    expect(parsed.pathname).toBe("/");
    expect(parsed.searchParams.get("keep")).toBe("1");
  });
});

describe("domain session probe storage", () => {
  it("reuses a completed probe for seven days without depending on Newjoych in every tab", () => {
    const now = Date.UTC(2026, 6, 19, 12);
    const value = createDomainSessionProbeStorageValue(now - 6 * 24 * 60 * 60 * 1000);

    expect(isRecentDomainSessionProbeStorageValue(value, now)).toBe(true);
  });

  it("expires old, future, and malformed probe values", () => {
    const now = Date.UTC(2026, 6, 19, 12);

    expect(isRecentDomainSessionProbeStorageValue(
      createDomainSessionProbeStorageValue(now - 8 * 24 * 60 * 60 * 1000),
      now,
    )).toBe(false);
    expect(isRecentDomainSessionProbeStorageValue(
      createDomainSessionProbeStorageValue(now + 1),
      now,
    )).toBe(false);
    expect(isRecentDomainSessionProbeStorageValue("old:123", now)).toBe(false);
  });
});
