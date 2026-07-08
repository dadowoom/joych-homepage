const INTERNAL_HOSTS = new Set(["newjoych.co.kr", "www.newjoych.co.kr"]);

function isHttpProtocol(protocol: string) {
  return protocol === "http:" || protocol === "https:";
}

export function normalizeSiteHref(href?: string | null) {
  const value = href?.trim();
  if (!value || value === "#") return null;

  if (value.startsWith("/") && !value.startsWith("//")) {
    return value;
  }

  try {
    const url = new URL(value, "https://newjoych.co.kr");
    if (INTERNAL_HOSTS.has(url.hostname)) {
      return `${url.pathname}${url.search}${url.hash}`;
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
    const url = new URL(value, "https://newjoych.co.kr");
    return isHttpProtocol(url.protocol) && !INTERNAL_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}

export function isInternalSiteHref(href?: string | null) {
  const normalized = normalizeSiteHref(href);
  return Boolean(normalized && normalized.startsWith("/") && !normalized.startsWith("//"));
}

