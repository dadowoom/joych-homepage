export const PRIMARY_SITE_ORIGIN = "https://www.joych.org";
export const PRIMARY_SITE_HOSTNAME = "www.joych.org";
export const LEGACY_PWA_SITE_ORIGIN = "https://newjoych.co.kr";

export const SITE_HOSTNAMES = [
  "joych.org",
  "www.joych.org",
  "m.joych.org",
  "newjoych.co.kr",
  "www.newjoych.co.kr",
] as const;

const SITE_HOSTNAME_SET = new Set<string>(SITE_HOSTNAMES);

export function isSiteHostname(hostname: string) {
  return SITE_HOSTNAME_SET.has(hostname.trim().toLowerCase());
}
