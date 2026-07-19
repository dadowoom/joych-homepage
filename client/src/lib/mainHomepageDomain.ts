export const PRIMARY_SITE_HOSTNAME = "www.joych.org";
export const PRIMARY_SITE_ORIGIN = `https://${PRIMARY_SITE_HOSTNAME}`;
export const LEGACY_SESSION_SITE_ORIGIN = "https://newjoych.co.kr";
export const DOMAIN_SESSION_BRIDGE_PATH = "/api/domain-session-bridge/start";
export const DOMAIN_SESSION_LOGOUT_PATH = "/api/domain-session-bridge/logout";
export const DOMAIN_BRIDGE_RETURN_MARKER = "__joych_bridge";
export const DOMAIN_BRIDGE_RETURN_VALUE = "1";
export const DOMAIN_LOGOUT_RETURN_MARKER = "__joych_logout";
export const DOMAIN_LOGOUT_RETURN_VALUE = "1";
export const DOMAIN_SESSION_PROBE_STORAGE_KEY = "joych.domainSessionProbe.v1";
export const DOMAIN_SESSION_PROBE_STORAGE_VALUE = "20260719";
export const DOMAIN_SESSION_PROBE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
export const DOMAIN_LOGOUT_STORAGE_KEY = "joych.domainLogout.v1";

const LEGACY_SITE_HOSTNAMES = new Set([
  "newjoych.co.kr",
  "www.newjoych.co.kr",
  "joych.org",
  "m.joych.org",
]);
const LEGACY_PWA_HOSTNAMES = new Set([
  "newjoych.co.kr",
  "www.newjoych.co.kr",
]);
const SOCIAL_SIGNUP_COMPLETION_PATH = "/member/social-complete";

export type SiteDomainGateAction =
  | "render"
  | "wait-for-primary-session"
  | "redirect-through-current-legacy-host"
  | "probe-legacy-session";

export type SiteDomainGateDecisionInput = {
  hostname: string;
  pathname: string;
  isStandalonePwa: boolean;
  isAdminSessionPending: boolean;
  isMemberSessionPending: boolean;
  isAdmin: boolean;
  hasMemberSession: boolean;
  hasBridgeReturnMarker: boolean;
  hasLogoutReturnMarker?: boolean;
  hasProbedLegacySession: boolean;
  hasExplicitlyLoggedOut?: boolean;
};

export type BrowserLocationParts = {
  origin: string;
  pathname: string;
  search: string;
  hash: string;
};

function normalizeHostname(hostname: string) {
  return hostname.trim().toLowerCase().replace(/\.$/, "");
}

function normalizePathname(pathname: string) {
  if (!pathname.startsWith("/") || pathname.startsWith("//")) return "/";
  return pathname;
}

function normalizeSearch(search: string) {
  if (!search) return "";
  return search.startsWith("?") ? search : `?${search}`;
}

function normalizeHash(hash: string) {
  if (!hash) return "";
  return hash.startsWith("#") ? hash : `#${hash}`;
}

function createRelativeUrl({ pathname, search, hash }: Omit<BrowserLocationParts, "origin">) {
  const url = new URL(PRIMARY_SITE_ORIGIN);
  url.pathname = normalizePathname(pathname);
  url.search = normalizeSearch(search);
  url.hash = normalizeHash(hash);
  return url;
}

export function isLegacySiteHostname(hostname: string) {
  return LEGACY_SITE_HOSTNAMES.has(normalizeHostname(hostname));
}

export function hasDomainBridgeReturnMarker(search: string) {
  return new URLSearchParams(normalizeSearch(search)).get(DOMAIN_BRIDGE_RETURN_MARKER) ===
    DOMAIN_BRIDGE_RETURN_VALUE;
}

export function hasDomainLogoutReturnMarker(search: string) {
  return new URLSearchParams(normalizeSearch(search)).get(DOMAIN_LOGOUT_RETURN_MARKER) ===
    DOMAIN_LOGOUT_RETURN_VALUE;
}

/**
 * The bridge marker is deliberately placed inside returnTo. The server can redirect
 * to that value unchanged, while the primary-site gate can identify the completed
 * round trip without exposing a session token in the address bar.
 */
export function buildDomainBridgeReturnTo(
  location: Omit<BrowserLocationParts, "origin">,
) {
  const url = createRelativeUrl(location);
  url.searchParams.set(DOMAIN_BRIDGE_RETURN_MARKER, DOMAIN_BRIDGE_RETURN_VALUE);
  return `${url.pathname}${url.search}${url.hash}`;
}

export function stripDomainBridgeReturnMarker(
  location: Omit<BrowserLocationParts, "origin">,
) {
  const url = createRelativeUrl(location);
  url.searchParams.delete(DOMAIN_BRIDGE_RETURN_MARKER);
  url.searchParams.delete(DOMAIN_LOGOUT_RETURN_MARKER);
  return `${url.pathname}${url.search}${url.hash}`;
}

export function buildDomainSessionBridgeUrl(
  bridgeOrigin: string,
  returnLocation: Omit<BrowserLocationParts, "origin">,
) {
  const destination = new URL(DOMAIN_SESSION_BRIDGE_PATH, bridgeOrigin);
  destination.searchParams.set("returnTo", buildDomainBridgeReturnTo(returnLocation));
  return destination.toString();
}

export function buildDomainSessionLogoutUrl(
  bridgeOrigin: string,
  returnLocation: Omit<BrowserLocationParts, "origin">,
  intentToken?: string | null,
) {
  const destination = new URL(DOMAIN_SESSION_LOGOUT_PATH, bridgeOrigin);
  const returnUrl = createRelativeUrl(returnLocation);
  returnUrl.searchParams.set(DOMAIN_LOGOUT_RETURN_MARKER, DOMAIN_LOGOUT_RETURN_VALUE);
  destination.searchParams.set(
    "returnTo",
    `${returnUrl.pathname}${returnUrl.search}${returnUrl.hash}`,
  );
  if (intentToken) destination.searchParams.set("intent", intentToken);
  return destination.toString();
}

export function markDomainLogout() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DOMAIN_LOGOUT_STORAGE_KEY, String(Date.now()));
  } catch {
    // Privacy-restricted browsers can disable storage.
  }
}

export function clearDomainLogoutMark() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(DOMAIN_LOGOUT_STORAGE_KEY);
  } catch {
    // Privacy-restricted browsers can disable storage.
  }
}

export function hasDomainLogoutMark() {
  if (typeof window === "undefined") return false;
  try {
    return Boolean(window.localStorage.getItem(DOMAIN_LOGOUT_STORAGE_KEY));
  } catch {
    return false;
  }
}

export function createDomainSessionProbeStorageValue(now = Date.now()) {
  return `${DOMAIN_SESSION_PROBE_STORAGE_VALUE}:${now}`;
}

export function isRecentDomainSessionProbeStorageValue(
  value: string | null,
  now = Date.now(),
) {
  if (!value) return false;
  const [version, timestampText, ...extra] = value.split(":");
  if (extra.length > 0 || version !== DOMAIN_SESSION_PROBE_STORAGE_VALUE) return false;

  const timestamp = Number(timestampText);
  if (!Number.isFinite(timestamp) || timestamp > now) return false;
  return now - timestamp <= DOMAIN_SESSION_PROBE_MAX_AGE_MS;
}

export function finishDomainLogout(returnTo = "/", intentToken?: string | null) {
  if (typeof window === "undefined") return;
  markDomainLogout();

  const safeReturn = createRelativeUrl({ pathname: returnTo, search: "", hash: "" });
  // Always clear both host-only cookie jars. The legacy endpoint clears the old
  // origin, then hands off to the primary completion endpoint to clear www.
  if (intentToken) {
    window.location.replace(buildDomainSessionLogoutUrl(LEGACY_SESSION_SITE_ORIGIN, {
      pathname: safeReturn.pathname,
      search: safeReturn.search,
      hash: safeReturn.hash,
    }, intentToken));
    return;
  }

  window.location.replace(`${safeReturn.pathname}${safeReturn.search}${safeReturn.hash}`);
}

export function getSiteDomainGateAction({
  hostname,
  pathname,
  isStandalonePwa,
  isAdminSessionPending,
  isMemberSessionPending,
  isAdmin,
  hasMemberSession,
  hasBridgeReturnMarker,
  hasLogoutReturnMarker = false,
  hasProbedLegacySession,
  hasExplicitlyLoggedOut = false,
}: SiteDomainGateDecisionInput): SiteDomainGateAction {
  const normalizedHostname = normalizeHostname(hostname);

  if (LEGACY_SITE_HOSTNAMES.has(normalizedHostname)) {
    const mustKeepLegacyOrigin =
      LEGACY_PWA_HOSTNAMES.has(normalizedHostname) &&
      (isStandalonePwa || pathname === SOCIAL_SIGNUP_COMPLETION_PATH);

    return mustKeepLegacyOrigin ? "render" : "redirect-through-current-legacy-host";
  }

  if (normalizedHostname !== PRIMARY_SITE_HOSTNAME) return "render";

  if (isAdminSessionPending || isMemberSessionPending) {
    return "wait-for-primary-session";
  }

  // A PWA installed from the new primary origin must stay inside its own scope.
  // Top-level probing of Newjoych would eject it into an external browser tab.
  if (isStandalonePwa) return "render";

  if (
    (isAdmin && hasMemberSession) ||
    hasBridgeReturnMarker ||
    hasLogoutReturnMarker ||
    hasExplicitlyLoggedOut ||
    hasProbedLegacySession
  ) {
    return "render";
  }

  return "probe-legacy-session";
}
