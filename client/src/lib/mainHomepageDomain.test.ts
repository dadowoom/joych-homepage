import { describe, expect, it } from "vitest";
import {
  getMainHomepageDomainDecision,
  shouldProbeMemberSiteSession,
} from "./mainHomepageDomain";

const settledSession = {
  isMemberSite: true,
  isLegacyInstalledPwa: false,
  isAdminSessionPending: false,
  isMemberSessionPending: false,
  isAdmin: false,
  hasMemberSession: false,
};

describe("getMainHomepageDomainDecision", () => {
  it("keeps a logged-in member on newjoych when the logo opens the homepage", () => {
    expect(
      getMainHomepageDomainDecision({
        ...settledSession,
        hasMemberSession: true,
      })
    ).toEqual({ isCheckingSession: false, shouldRedirect: false });
  });

  it("keeps a logged-in administrator on newjoych", () => {
    expect(
      getMainHomepageDomainDecision({
        ...settledSession,
        isAdmin: true,
      })
    ).toEqual({ isCheckingSession: false, shouldRedirect: false });
  });

  it("waits for both login checks before deciding whether to redirect", () => {
    expect(
      getMainHomepageDomainDecision({
        ...settledSession,
        isMemberSessionPending: true,
      })
    ).toEqual({ isCheckingSession: true, shouldRedirect: false });
  });

  it("redirects only anonymous newjoych visitors to the public main domain", () => {
    expect(getMainHomepageDomainDecision(settledSession)).toEqual({
      isCheckingSession: false,
      shouldRedirect: true,
    });
  });

  it("keeps an anonymous legacy installed PWA on newjoych so its push channel can recover", () => {
    expect(
      getMainHomepageDomainDecision({
        ...settledSession,
        isLegacyInstalledPwa: true,
      }),
    ).toEqual({ isCheckingSession: false, shouldRedirect: false });
  });

  it("does not apply member-domain routing on the public main domain", () => {
    expect(
      getMainHomepageDomainDecision({
        ...settledSession,
        isMemberSite: false,
        isAdminSessionPending: true,
        isMemberSessionPending: true,
      })
    ).toEqual({ isCheckingSession: false, shouldRedirect: false });
  });
});

describe("shouldProbeMemberSiteSession", () => {
  it("checks the saved member session when the main domain opens in a new tab", () => {
    expect(shouldProbeMemberSiteSession({
      isMainSite: true,
      hasAnonymousReturnMarker: false,
      hasCheckedThisTab: false,
    })).toBe(true);
  });

  it("does not loop after an anonymous visitor returns to the main domain", () => {
    expect(shouldProbeMemberSiteSession({
      isMainSite: true,
      hasAnonymousReturnMarker: true,
      hasCheckedThisTab: false,
    })).toBe(false);
  });

  it("checks at most once in the same tab", () => {
    expect(shouldProbeMemberSiteSession({
      isMainSite: true,
      hasAnonymousReturnMarker: false,
      hasCheckedThisTab: true,
    })).toBe(false);
  });

  it("does not run on the member domain", () => {
    expect(shouldProbeMemberSiteSession({
      isMainSite: false,
      hasAnonymousReturnMarker: false,
      hasCheckedThisTab: false,
    })).toBe(false);
  });
});
