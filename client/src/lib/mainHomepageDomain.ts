type MainHomepageDomainDecisionInput = {
  isMemberSite: boolean;
  isAdminSessionPending: boolean;
  isMemberSessionPending: boolean;
  isAdmin: boolean;
  hasMemberSession: boolean;
};

type MainHomepageSessionProbeInput = {
  isMainSite: boolean;
  hasAnonymousReturnMarker: boolean;
  hasCheckedThisTab: boolean;
};

export function getMainHomepageDomainDecision({
  isMemberSite,
  isAdminSessionPending,
  isMemberSessionPending,
  isAdmin,
  hasMemberSession,
}: MainHomepageDomainDecisionInput) {
  const isCheckingSession =
    isMemberSite && (isAdminSessionPending || isMemberSessionPending);
  const shouldRedirect =
    isMemberSite && !isCheckingSession && !isAdmin && !hasMemberSession;

  return { isCheckingSession, shouldRedirect };
}

/**
 * 대표 도메인은 회원 도메인의 host-only 로그인 쿠키를 직접 읽을 수 없습니다.
 * 새 탭의 첫 진입에만 회원 도메인을 왕복해 저장된 로그인이 있는지 확인합니다.
 */
export function shouldProbeMemberSiteSession({
  isMainSite,
  hasAnonymousReturnMarker,
  hasCheckedThisTab,
}: MainHomepageSessionProbeInput) {
  return isMainSite && !hasAnonymousReturnMarker && !hasCheckedThisTab;
}
