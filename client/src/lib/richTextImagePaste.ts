const MAX_PASTED_IMAGE_HTML_LENGTH = 50_000;
const MAX_PASTED_IMAGE_COUNT = 200;
const IMAGE_TAG_PATTERN = /<\s*img\b[^>]*>/gi;
const IMAGE_SRC_PATTERN = /(?:^|\s)src\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/i;
const SCRIPT_OR_STYLE_BLOCK_PATTERN = /<\s*(script|style)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi;
const PARAGRAPH_OR_BREAK_TAG_PATTERN = /<\s*\/?\s*(?:p|br)\b[^>]*>/gi;
const CLOSING_IMAGE_TAG_PATTERN = /<\s*\/\s*img\s*>/gi;
const IMAGE_SOURCE_INPUT_TOKEN_PATTERN = /<\s*img\b[^>]*>|https?:\/\/[^\s"'<>`]+/gi;
const IMAGE_SOURCE_INPUT_WRAPPER_PATTERN = /<\s*\/?\s*(?:p|br|div|span)\b[^>]*>/gi;
const IMAGE_SRC_ATTRIBUTE_PATTERN = /(\bsrc\s*=\s*)(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/i;
const JOYCH_PHOTO_HOST = "photo.joych.org";

function decodeHtmlTagEntities(value: string) {
  return value
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&");
}

function getSafeAbsoluteImageUrl(value: string, requireHttps = false) {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 2_048) return null;

  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (url.username || url.password) return null;

    // The public site only permits HTTPS images. The church photo server is
    // known to serve the same files over HTTPS, so legacy HTTP addresses can
    // be upgraded without changing the requested photo path.
    if (url.protocol === "http:" && url.hostname.toLowerCase() === JOYCH_PHOTO_HOST) {
      url.protocol = "https:";
    }

    if (requireHttps && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

function extractImageSrcFromTag(tag: string) {
  const srcMatch = tag.match(IMAGE_SRC_PATTERN);
  return srcMatch?.[1] ?? srcMatch?.[2] ?? srcMatch?.[3] ?? "";
}

/**
 * Parses the image toolbar input. It accepts one URL, URLs separated by lines
 * or whitespace, IMG tags, and mixtures of those formats. Only the extracted
 * HTTPS URLs are returned; pasted HTML itself is never inserted.
 */
export function extractImageSourceInputUrls(value?: string | null) {
  const rawValue = value ?? "";
  if (!rawValue.trim() || rawValue.length > MAX_PASTED_IMAGE_HTML_LENGTH) return null;

  const decoded = decodeHtmlTagEntities(rawValue).replace(SCRIPT_OR_STYLE_BLOCK_PATTERN, "");
  let invalidSource = false;
  const imageUrls: string[] = [];

  const remainingText = decoded.replace(IMAGE_SOURCE_INPUT_TOKEN_PATTERN, (token) => {
    const source = /^<\s*img\b/i.test(token) ? extractImageSrcFromTag(token) : token;
    const safeUrl = getSafeAbsoluteImageUrl(source, true);
    if (!safeUrl) {
      invalidSource = true;
      return token;
    }

    imageUrls.push(safeUrl);
    return "";
  });

  if (invalidSource || imageUrls.length === 0 || imageUrls.length > MAX_PASTED_IMAGE_COUNT) {
    return null;
  }

  const unsupportedText = remainingText
    .replace(CLOSING_IMAGE_TAG_PATTERN, "")
    .replace(IMAGE_SOURCE_INPUT_WRAPPER_PATTERN, "")
    // Legacy Excel lists sometimes contain a dot between malformed empty p tags.
    .replace(/[.,;|\s]+/g, "");

  return unsupportedText ? null : imageUrls;
}

/** Upgrades legacy church photo URLs inside HTML source without trusting HTML. */
export function normalizeRichTextImageSources(value?: string | null) {
  const html = value ?? "";
  if (!html) return "";

  return html.replace(IMAGE_TAG_PATTERN, (tag) =>
    tag.replace(IMAGE_SRC_ATTRIBUTE_PATTERN, (attribute, prefix, doubleQuoted, singleQuoted, bare) => {
      const source = doubleQuoted ?? singleQuoted ?? bare ?? "";
      const normalized = getSafeAbsoluteImageUrl(source);
      if (!normalized || normalized === source) return attribute;
      const escaped = normalized.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
      return `${prefix}"${escaped}"`;
    }),
  );
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
    const src = extractImageSrcFromTag(tag);
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
