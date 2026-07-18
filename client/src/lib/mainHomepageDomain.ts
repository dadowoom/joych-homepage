type MainHomepageDomainDecisionInput = {
  isMemberSite: boolean;
  isAdminSessionPending: boolean;
  isMemberSessionPending: boolean;
  isAdmin: boolean;
  hasMemberSession: boolean;
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
