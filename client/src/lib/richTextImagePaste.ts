const MAX_PASTED_IMAGE_HTML_LENGTH = 50_000;
const MAX_PASTED_IMAGE_COUNT = 200;
const IMAGE_TAG_PATTERN = /<\s*img\b[^>]*>/gi;
const IMAGE_SRC_PATTERN = /(?:^|\s)src\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/i;
const SCRIPT_OR_STYLE_BLOCK_PATTERN = /<\s*(script|style)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi;
const PARAGRAPH_OR_BREAK_TAG_PATTERN = /<\s*\/?\s*(?:p|br)\b[^>]*>/gi;
const CLOSING_IMAGE_TAG_PATTERN = /<\s*\/\s*img\s*>/gi;

function decodeHtmlTagEntities(value: string) {
  return value
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&");
}

function getSafeAbsoluteImageUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 2_048) return null;

  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (url.username || url.password) return null;
    return trimmed;
  } catch {
    return null;
  }
}

/**
 * Extracts safe image URLs from literal HTML copied as plain text (for example,
 * a list copied from Excel or Notepad). Returning null keeps the editor's
 * normal paste behavior. Raw HTML is never inserted into the document.
 */
export function extractPlainTextPastedImageUrls(value?: string | null) {
  const rawValue = value ?? "";
  if (rawValue.length > MAX_PASTED_IMAGE_HTML_LENGTH) return null;

  const trimmed = rawValue.trim();
  if (!trimmed) return null;

  const decoded = decodeHtmlTagEntities(trimmed);
  const withoutScriptOrStyle = decoded.replace(SCRIPT_OR_STYLE_BLOCK_PATTERN, "");
  const imageTags = withoutScriptOrStyle.match(IMAGE_TAG_PATTERN);
  if (!imageTags?.length || imageTags.length > MAX_PASTED_IMAGE_COUNT) return null;

  const imageUrls: string[] = [];
  for (const tag of imageTags) {
    const srcMatch = tag.match(IMAGE_SRC_PATTERN);
    const src = srcMatch?.[1] ?? srcMatch?.[2] ?? srcMatch?.[3] ?? "";
    const safeUrl = getSafeAbsoluteImageUrl(src);
    if (!safeUrl) return null;
    imageUrls.push(safeUrl);
  }

  const remainingText = withoutScriptOrStyle
    .replace(IMAGE_TAG_PATTERN, "")
    .replace(CLOSING_IMAGE_TAG_PATTERN, "")
    .replace(PARAGRAPH_OR_BREAK_TAG_PATTERN, "")
    // Legacy Excel lists sometimes contain a dot between malformed empty p tags.
    .replace(/[.\s]+/g, "");

  return remainingText ? null : imageUrls;
}
