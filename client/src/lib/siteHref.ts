import { PRIMARY_SITE_ORIGIN, isSiteHostname } from "@shared/siteHosts";
import { getCanonicalPublicMenuPath } from "@shared/publicMenuRoutes";

const SITE_URL_BASE = PRIMARY_SITE_ORIGIN;

function isHttpProtocol(protocol: string) {
  return protocol === "http:" || protocol === "https:";
}

export function normalizeSiteHref(href?: string | null) {
  const value = href?.trim();
  if (!value || value === "#") return null;

  const canonicalPublicMenuPath = getCanonicalPublicMenuPath(value);
  if (canonicalPublicMenuPath && canonicalPublicMenuPath !== value) {
    return canonicalPublicMenuPath;
  }

  if (value.startsWith("/") && !value.startsWith("//")) {
    return getCanonicalPublicMenuPath(value) ?? value;
  }

  try {
    const url = new URL(value, SITE_URL_BASE);
    if (
      !isHttpProtocol(url.protocol) &&
      url.protocol !== "mailto:" &&
      url.protocol !== "tel:"
    ) {
      return null;
    }
    if (isSiteHostname(url.hostname)) {
      const path = `${url.pathname}${url.search}${url.hash}`;
      return getCanonicalPublicMenuPath(path) ?? path;
    }
    return value;
  } catch {
    return value;
  }
}

export function isExternalSiteHref(href?: string | null) {
  const value = href?.trim();
  if (!value) return false;

  try {
    const url = new URL(value, SITE_URL_BASE);
    return isHttpProtocol(url.protocol) && !isSiteHostname(url.hostname);
  } catch {
    return false;
  }
}

export function isInternalSiteHref(href?: string | null) {
  const normalized = normalizeSiteHref(href);
  return Boolean(normalized && normalized.startsWith("/") && !normalized.startsWith("//"));
}
