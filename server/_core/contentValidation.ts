import { z } from "zod";

const SAFE_YOUTUBE_ID_RE = /^[a-zA-Z0-9_-]{11}$/;
const BLOCK_TYPES = new Set([
  "text-h1",
  "text-h2",
  "text-h3",
  "text-body",
  "image-single",
  "image-double",
  "image-triple",
  "youtube",
  "button",
  "divider",
]);

function isSafeAbsoluteUrl(value: string, allowedProtocols = ["http:", "https:"]) {
  try {
    const url = new URL(value);
    return allowedProtocols.includes(url.protocol);
  } catch {
    return false;
  }
}

export function isSafeHref(value: string) {
  const href = value.trim();
  if (!href) return true;
  if (href === "#") return true;
  if (href.startsWith("#")) return !href.includes("\\");
  if (href.startsWith("/")) return !href.startsWith("//") && !href.includes("\\");
  return isSafeAbsoluteUrl(href, ["http:", "https:", "mailto:", "tel:"]);
}

export function isSafeAssetUrl(value: string) {
  const url = value.trim();
  if (!url) return true;
  if (url.startsWith("/uploads/")) return !url.includes("\\") && !url.includes("..");
  return isSafeAbsoluteUrl(url);
}

export const safeHrefSchema = z.string()
  .trim()
  .max(512, "링크는 512자 이하로 입력해주세요.")
  .refine(isSafeHref, "허용되지 않는 링크 형식입니다.");

export const safeAssetUrlSchema = z.string()
  .trim()
  .max(2048, "URL은 2048자 이하로 입력해주세요.")
  .refine(isSafeAssetUrl, "허용되지 않는 URL 형식입니다.");

export const optionalTextSchema = (max: number) =>
  z.string().trim().max(max, `${max}자 이하로 입력해주세요.`).optional();

export const requiredTextSchema = (max: number, message: string) =>
  z.string().trim().min(1, message).max(max, `${max}자 이하로 입력해주세요.`);

export function extractYoutubeVideoId(input: string | null | undefined) {
  const value = input?.trim();
  if (!value) return null;
  if (SAFE_YOUTUBE_ID_RE.test(value)) return value;

  try {
    const url = new URL(value);
    if (url.hostname === "youtu.be") {
      const id = url.pathname.split("/").filter(Boolean)[0];
      return id && SAFE_YOUTUBE_ID_RE.test(id) ? id : null;
    }
    if (url.hostname.endsWith("youtube.com")) {
      const watchId = url.searchParams.get("v");
      if (watchId && SAFE_YOUTUBE_ID_RE.test(watchId)) return watchId;
      const parts = url.pathname.split("/").filter(Boolean);
      const embedIndex = parts.findIndex(part => part === "embed" || part === "shorts");
      const id = embedIndex >= 0 ? parts[embedIndex + 1] : null;
      return id && SAFE_YOUTUBE_ID_RE.test(id) ? id : null;
    }
  } catch {
    return null;
  }
  return null;
}

function normalizeString(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function normalizeNumber(value: unknown, fallback: number, min: number, max: number) {
  const number = typeof value === "number" && Number.isFinite(value) ? value : fallback;
  return Math.min(max, Math.max(min, number));
}

export function validateBlockType(blockType: string) {
  if (!BLOCK_TYPES.has(blockType)) {
    throw new Error("지원하지 않는 블록 타입입니다.");
  }
}

export function normalizeBlockContent(blockType: string, rawContent: string) {
  validateBlockType(blockType);
  if (rawContent.length > 20000) {
    throw new Error("블록 내용은 20000자 이하로 입력해주세요.");
  }

  let content: Record<string, unknown>;
  try {
    const parsed = JSON.parse(rawContent || "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error();
    }
    content = parsed as Record<string, unknown>;
  } catch {
    throw new Error("블록 내용 JSON 형식이 올바르지 않습니다.");
  }

  if (blockType.startsWith("text-")) {
    return JSON.stringify({
      text: normalizeString(content.text, 10000),
      fontSize: normalizeNumber(content.fontSize, 0, 0, 100) || undefined,
      align: ["left", "center", "right"].includes(String(content.align)) ? content.align : "left",
    });
  }

  if (blockType.startsWith("image-")) {
    const maxImages = blockType === "image-single" ? 1 : blockType === "image-double" ? 2 : 3;
    const urls = Array.isArray(content.urls) ? content.urls : [];
    const captions = Array.isArray(content.captions) ? content.captions : [];
    const normalizedUrls = urls
      .filter((url): url is string => typeof url === "string")
      .map(url => url.trim())
      .filter(url => url && isSafeAssetUrl(url))
      .slice(0, maxImages);

    if (normalizedUrls.length === 0) {
      throw new Error("이미지 블록에는 올바른 이미지 URL이 필요합니다.");
    }

    return JSON.stringify({
      urls: normalizedUrls,
      captions: captions.map(caption => normalizeString(caption, 128)).slice(0, maxImages),
    });
  }

  if (blockType === "youtube") {
    const videoId = extractYoutubeVideoId(String(content.videoId ?? ""));
    if (!videoId) {
      throw new Error("올바른 유튜브 영상 ID가 필요합니다.");
    }
    return JSON.stringify({
      videoId,
      title: normalizeString(content.title, 256),
    });
  }

  if (blockType === "button") {
    const href = normalizeString(content.href, 512);
    if (href && !isSafeHref(href)) {
      throw new Error("허용되지 않는 버튼 링크 형식입니다.");
    }
    return JSON.stringify({
      label: normalizeString(content.label, 64) || "링크",
      href: href || "#",
      style: content.style === "outline" ? "outline" : "solid",
    });
  }

  if (blockType === "divider") {
    return JSON.stringify({
      thickness: normalizeNumber(content.thickness, 1, 1, 10),
      lineStyle: ["solid", "dashed", "dotted"].includes(String(content.lineStyle)) ? content.lineStyle : "solid",
    });
  }

  return "{}";
}
