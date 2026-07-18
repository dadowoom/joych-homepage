import { describe, expect, it } from "vitest";
import { getMainHomepageDomainDecision } from "./mainHomepageDomain";

const settledSession = {
  isMemberSite: true,
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
