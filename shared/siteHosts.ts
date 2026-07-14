export const SITE_HOSTNAMES = [
  "joych.org",
  "www.joych.org",
  "newjoych.co.kr",
  "www.newjoych.co.kr",
] as const;

const SITE_HOSTNAME_SET = new Set<string>(SITE_HOSTNAMES);

export function isSiteHostname(hostname: string) {
  return SITE_HOSTNAME_SET.has(hostname.trim().toLowerCase());
}
