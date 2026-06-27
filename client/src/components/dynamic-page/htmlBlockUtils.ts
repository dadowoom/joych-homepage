const escapedHtmlTagPattern = /&lt;\/?[a-z][\s\S]*?&gt;/i;
const htmlTagPattern = /<\/?[a-z][\s\S]*?>/i;

export function decodeHtmlEntities(value: string) {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

export function normalizeHtmlBlockValue(value?: string | null) {
  const raw = value ?? "";
  if (!escapedHtmlTagPattern.test(raw)) return raw;

  const decoded = decodeHtmlEntities(raw);
  return htmlTagPattern.test(decoded) ? decoded : raw;
}
