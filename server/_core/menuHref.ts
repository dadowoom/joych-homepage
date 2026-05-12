const PAGE_PREFIX = "/page/";
const MAX_HREF_LENGTH = 240;

export type MenuHrefOwner =
  | { kind: "item"; id: number }
  | { kind: "sub"; id: number };

export type MenuHrefCandidate = {
  href: string | null | undefined;
  owner?: MenuHrefOwner;
};

export function normalizeMenuHref(href: string | null | undefined) {
  const value = href?.trim();
  if (!value) return "";
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function isReadableSlugChar(char: string) {
  if (/^[a-z0-9\s_-]$/.test(char)) return true;
  const code = char.codePointAt(0) ?? 0;
  return (
    (code >= 0xac00 && code <= 0xd7af) || // Hangul syllables
    (code >= 0x1100 && code <= 0x11ff) || // Hangul jamo
    (code >= 0x3130 && code <= 0x318f) || // Hangul compatibility jamo
    (code >= 0x4e00 && code <= 0x9fff) // CJK unified ideographs
  );
}

function removeUnsafeSlugChars(value: string) {
  return Array.from(value)
    .map(char => (isReadableSlugChar(char) ? char : " "))
    .join("");
}

export function makeMenuPageSlug(parts: Array<string | null | undefined>) {
  const slug = parts
    .map(part => part?.normalize("NFKC").trim().toLowerCase() ?? "")
    .filter(Boolean)
    .join("-")
    .replace(/&/g, " and ");

  return (removeUnsafeSlugChars(slug)
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")) || "page";
}

function truncateHref(href: string) {
  if (href.length <= MAX_HREF_LENGTH) return href;
  const truncated = href.slice(0, MAX_HREF_LENGTH).replace(/-[^-]*$/, "");
  return truncated.length > PAGE_PREFIX.length ? truncated : href.slice(0, MAX_HREF_LENGTH);
}

function isSameOwner(left?: MenuHrefOwner, right?: MenuHrefOwner) {
  return Boolean(left && right && left.kind === right.kind && left.id === right.id);
}

export function makeMenuPageHref(parts: Array<string | null | undefined>) {
  return truncateHref(`${PAGE_PREFIX}${makeMenuPageSlug(parts)}`);
}

export function makeUniqueMenuPageHref(
  parts: Array<string | null | undefined>,
  existing: MenuHrefCandidate[],
  owner?: MenuHrefOwner,
) {
  const occupied = new Set(
    existing
      .filter(candidate => !isSameOwner(candidate.owner, owner))
      .map(candidate => normalizeMenuHref(candidate.href))
      .filter(Boolean),
  );

  const baseHref = makeMenuPageHref(parts);
  if (!occupied.has(baseHref)) return baseHref;

  const copyHref = truncateHref(`${baseHref}-page`);
  if (!occupied.has(copyHref)) return copyHref;

  for (let index = 2; index <= 1000; index += 1) {
    const href = truncateHref(`${baseHref}-page-${index}`);
    if (!occupied.has(href)) return href;
  }

  return truncateHref(`${baseHref}-${Date.now()}`);
}
