import type { Express, Request, Response } from "express";
import { Readable } from "stream";
import type { ReadableStream } from "stream/web";
import { getYoutubeVideoByLegacySource } from "../db/youtube";

export type LegacyVodInfo = {
  pageCode: string;
  num: string;
  vodType: string;
  vodFile: string;
  subject: string;
  word: string;
  preacher: string;
  date: string;
};

const LEGACY_VOD_INFO_URL = "http://admin.joych.org/core/xml/vod/vodInfo.xml.html";
const LEGACY_VOD_REFERER_BASE =
  "http://admin.joych.org/core/module/vod/skin_001/vodIframe.html";
const LEGACY_VOD_CACHE_TTL_MS = 10 * 60 * 1000;
const LEGACY_VOD_CACHE = new Map<
  string,
  { expiresAt: number; info: LegacyVodInfo }
>();

type LegacyVodFallbackRule = {
  vodType: string;
  directory: string;
  filenameSuffix: string;
};

// The old joych.org XML endpoint disappeared when the domain moved to the new
// server, but these MP4 archives are still available on sermon.joych.org. The
// rules below were checked against every matching production row and the
// source server's directory inventory before being enabled.
const LEGACY_VOD_FALLBACK_RULES: Record<string, LegacyVodFallbackRule> = {
  "423": { vodType: "237", directory: "wed", filenameSuffix: "_wed.mp4" },
  "424": { vodType: "238", directory: "friday_night", filenameSuffix: "_fri.mp4" },
  "242": { vodType: "40", directory: "special", filenameSuffix: "_hyi.mp4" },
  "359": { vodType: "69", directory: "special", filenameSuffix: "_testi.mp4" },
  "192": { vodType: "19", directory: "hymn", filenameSuffix: "_hymn1.mp4" },
};

// Three archive rows use a filename that cannot be derived from their stored
// date. Keep the mapping tied to the legacy numeric ID so no unrelated video
// can be selected accidentally.
const LEGACY_VOD_FILE_OVERRIDES = new Map<string, string>([
  ["359:12390:69", "special/260412_testi_4.mp4"],
  ["192:11140:19", "hymn/240908_hymn1.mp4"],
  ["192:10199:19", "hymn/230611_hymn1.mp4"],
]);

function isAllowedSermonMp4Url(url: URL) {
  return (
    (url.protocol === "http:" || url.protocol === "https:") &&
    url.hostname === "sermon.joych.org" &&
    url.pathname.startsWith("/mp4/") &&
    url.pathname.toLowerCase().endsWith(".mp4")
  );
}

function isNumericId(value: string | undefined): value is string {
  return Boolean(value && /^\d{1,10}$/.test(value));
}

function isLegacyJoychPageUrl(url: URL) {
  return (
    (url.protocol === "http:" || url.protocol === "https:") &&
    (
      url.hostname === "www.joych.org" ||
      url.hostname === "joych.org" ||
      url.hostname === "admin.joych.org"
    ) &&
    (
      url.pathname === "/main/sub.html" ||
      url.pathname === "/core/module/vod/skin_001/vodIframe.html"
    )
  );
}

function decodeXmlText(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function getXmlTag(xml: string, tag: string) {
  const match = new RegExp(`<${tag}>\\s*(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?\\s*</${tag}>`).exec(xml);
  return match ? decodeXmlText(match[1].trim()) : "";
}

function validateLegacyVodFile(vodFile: string) {
  try {
    return isAllowedSermonMp4Url(new URL(vodFile));
  } catch {
    return false;
  }
}

function getCacheKey(pageCode: string, num: string, vodType: string) {
  return `${pageCode}:${num}:${vodType}`;
}

function getRequestParams(req: Request) {
  const { pageCode, num, vodType } = req.params;
  if (!isNumericId(pageCode) || !isNumericId(num) || !isNumericId(vodType)) {
    return null;
  }
  return { pageCode, num, vodType };
}

function getLegacyFallbackFilePath(
  pageCode: string,
  num: string,
  vodType: string,
  sermonDate: string | null,
) {
  const cacheKey = getCacheKey(pageCode, num, vodType);
  const override = LEGACY_VOD_FILE_OVERRIDES.get(cacheKey);
  if (override) return override;

  const rule = LEGACY_VOD_FALLBACK_RULES[pageCode];
  if (!rule || rule.vodType !== vodType) return null;

  const dateMatch = sermonDate?.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!dateMatch) return null;

  const compactDate = `${dateMatch[1].slice(2)}${dateMatch[2]}${dateMatch[3]}`;
  return `${rule.directory}/${compactDate}${rule.filenameSuffix}`;
}

async function isAvailableSermonVideo(vodFile: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(vodFile, {
      method: "HEAD",
      headers: {
        Referer: "http://www.joych.org/",
        "User-Agent": "Mozilla/5.0",
      },
      signal: controller.signal,
    });
    return (
      response.ok &&
      (response.headers.get("content-type") ?? "").toLowerCase().startsWith("video/mp4")
    );
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchStoredLegacyVodFallback(
  pageCode: string,
  num: string,
  vodType: string,
) {
  const cacheKey = getCacheKey(pageCode, num, vodType);
  const rule = LEGACY_VOD_FALLBACK_RULES[pageCode];
  if (!LEGACY_VOD_FILE_OVERRIDES.has(cacheKey) && (!rule || rule.vodType !== vodType)) {
    return null;
  }

  const video = await getYoutubeVideoByLegacySource(pageCode, num, vodType);
  if (!video) return null;

  const filePath = getLegacyFallbackFilePath(
    pageCode,
    num,
    vodType,
    video.sermonDate,
  );
  if (!filePath) return null;

  const vodFile = `http://sermon.joych.org/mp4/${filePath}`;
  if (!await isAvailableSermonVideo(vodFile)) return null;

  return {
    pageCode,
    num,
    vodType,
    vodFile,
    subject: video.title ?? "",
    word: video.scripture ?? "",
    preacher: video.preacher ?? "",
    date: video.sermonDate ?? "",
  } satisfies LegacyVodInfo;
}

export async function fetchLegacyVodInfo(
  pageCode: string,
  num: string,
  vodType: string
) {
  const cacheKey = getCacheKey(pageCode, num, vodType);
  const cached = LEGACY_VOD_CACHE.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.info;
  }

  // Prefer the verified MP4 fallback for records already stored in the new
  // database. This avoids calling the retired XML endpoint and immediately
  // restores the recoverable archive videos.
  let fallbackInfo: LegacyVodInfo | null = null;
  try {
    fallbackInfo = await fetchStoredLegacyVodFallback(pageCode, num, vodType);
  } catch (error) {
    console.warn("[LegacyVOD] stored fallback lookup failed", error);
  }
  if (fallbackInfo) {
    LEGACY_VOD_CACHE.set(cacheKey, {
      expiresAt: Date.now() + LEGACY_VOD_CACHE_TTL_MS,
      info: fallbackInfo,
    });
    return fallbackInfo;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const body = new URLSearchParams({ pageCode, num, vodType });
    const response = await fetch(LEGACY_VOD_INFO_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Referer: `${LEGACY_VOD_REFERER_BASE}?pageCode=${pageCode}&num=${num}&vodType=${vodType}`,
        "User-Agent": "Mozilla/5.0",
      },
      body,
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Legacy VOD metadata request failed: ${response.status}`);
    }

    const xml = await response.text();
    if (getXmlTag(xml, "code") !== "vodInfo") {
      throw new Error("Legacy VOD metadata response did not include vodInfo");
    }

    const info: LegacyVodInfo = {
      pageCode,
      num,
      vodType,
      vodFile: getXmlTag(xml, "vodFile"),
      subject: getXmlTag(xml, "subject"),
      word: getXmlTag(xml, "word"),
      preacher: getXmlTag(xml, "preacher"),
      date: getXmlTag(xml, "date"),
    };

    if (!validateLegacyVodFile(info.vodFile)) {
      throw new Error("Legacy VOD file URL is not allowed");
    }

    LEGACY_VOD_CACHE.set(cacheKey, {
      expiresAt: Date.now() + LEGACY_VOD_CACHE_TTL_MS,
      info,
    });
    return info;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchLegacyVodParamsFromPage(
  pageUrl: URL,
  pageCode: string,
  expectedNum?: string
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(pageUrl.toString(), {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`Legacy VOD page request failed: ${response.status}`);
    }

    const html = await response.text();
    const iframePattern = /<iframe\b[^>]*\bsrc=(["'])(.*?)\1/gi;
    let match: RegExpExecArray | null;
    while ((match = iframePattern.exec(html))) {
      const iframeSrc = decodeXmlText(match[2]);
      if (!iframeSrc.includes("vodIframe.html")) continue;

      try {
        const iframeUrl = new URL(iframeSrc, pageUrl);
        const iframePageCode = iframeUrl.searchParams.get("pageCode") ?? undefined;
        const iframeNum = iframeUrl.searchParams.get("num") ?? undefined;
        const iframeVodType = iframeUrl.searchParams.get("vodType") ?? undefined;

        if (iframePageCode !== pageCode) continue;
        if (!isNumericId(iframeNum) || !isNumericId(iframeVodType)) continue;
        if (expectedNum && iframeNum !== expectedNum) continue;

        return {
          num: iframeNum,
          vodType: iframeVodType,
        };
      } catch {
        continue;
      }
    }

    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function resolveLegacyVodInfoFromPageUrl(rawUrl: string) {
  let pageUrl: URL;
  try {
    pageUrl = new URL(rawUrl.trim());
  } catch {
    return null;
  }

  if (!isLegacyJoychPageUrl(pageUrl)) {
    return null;
  }

  const pageCode = pageUrl.searchParams.get("pageCode") ?? undefined;
  const num = pageUrl.searchParams.get("num") ?? undefined;
  const explicitVodType = pageUrl.searchParams.get("vodType") ?? undefined;
  if (!isNumericId(pageCode)) {
    throw new Error("옛 홈페이지 영상 주소에서 pageCode를 찾지 못했습니다.");
  }
  const validPageCode = pageCode as string;

  let resolvedNum = isNumericId(num) ? num : undefined;
  let resolvedVodType = isNumericId(explicitVodType) ? explicitVodType : undefined;
  if (!resolvedNum || !resolvedVodType) {
    const pageParams = await fetchLegacyVodParamsFromPage(
      pageUrl,
      validPageCode,
      resolvedNum
    );
    resolvedNum = resolvedNum ?? pageParams?.num;
    resolvedVodType = resolvedVodType ?? pageParams?.vodType;
  }

  if (!isNumericId(resolvedNum) || !isNumericId(resolvedVodType)) {
    throw new Error("옛 홈페이지 영상 목록에서 영상 정보를 찾지 못했습니다.");
  }

  return fetchLegacyVodInfo(validPageCode, resolvedNum, resolvedVodType);
}

function setHeaderFromUpstream(
  res: Response,
  upstream: globalThis.Response,
  header: string
) {
  const value = upstream.headers.get(header);
  if (value) {
    res.setHeader(header, value);
  }
}

function getApprovedDirectVideoUrl(req: Request) {
  const rawUrl = typeof req.query.url === "string" ? req.query.url : null;
  if (!rawUrl) return null;

  try {
    const url = new URL(rawUrl);
    return isAllowedSermonMp4Url(url) ? url : null;
  } catch {
    return null;
  }
}

function getApprovedDirectVideoPathUrl(req: Request) {
  const rawPath = req.params[0];
  if (typeof rawPath !== "string" || !rawPath) return null;

  try {
    const url = new URL(`http://sermon.joych.org/${rawPath}`);
    return isAllowedSermonMp4Url(url) ? url : null;
  } catch {
    return null;
  }
}

function getUpstreamVideoRange(req: Request) {
  const clientRange = typeof req.headers.range === "string" ? req.headers.range.trim() : "";
  return clientRange || null;
}

async function sendApprovedVideoStream(
  req: Request,
  res: Response,
  sourceUrl: string,
  logPrefix: string
) {
  const upstreamRange = getUpstreamVideoRange(req);
  const controller = new AbortController();
  res.on("close", () => {
    if (!res.writableEnded) controller.abort();
  });

  try {
    const upstream = await fetch(sourceUrl, {
      method: req.method === "HEAD" ? "HEAD" : "GET",
      headers: {
        ...(upstreamRange ? { Range: upstreamRange } : {}),
        Referer: "http://www.joych.org/",
        "User-Agent": "Mozilla/5.0",
      },
      signal: controller.signal,
    });

    if (upstream.status === 416) {
      res.status(416);
      setHeaderFromUpstream(res, upstream, "content-range");
      res.end();
      return;
    }

    if (![200, 206].includes(upstream.status)) {
      res.status(502).json({ error: "Upstream video stream unavailable" });
      return;
    }

    res.status(upstream.status);
    res.setHeader("Content-Type", upstream.headers.get("content-type") ?? "video/mp4");
    res.setHeader("Accept-Ranges", upstream.headers.get("accept-ranges") ?? "bytes");
    res.setHeader("Cache-Control", "public, max-age=3600");
    setHeaderFromUpstream(res, upstream, "content-length");
    setHeaderFromUpstream(res, upstream, "content-range");
    setHeaderFromUpstream(res, upstream, "last-modified");
    setHeaderFromUpstream(res, upstream, "etag");

    if (req.method === "HEAD") {
      res.end();
      return;
    }

    if (!upstream.body) {
      res.status(502).end();
      return;
    }

    const stream = Readable.fromWeb(
      upstream.body as unknown as ReadableStream<Uint8Array>
    );
    stream.on("error", error => {
      if (controller.signal.aborted || error.name === "AbortError") return;
      console.error(`${logPrefix} stream error`, error);
      if (!res.headersSent) {
        res.status(502).end();
      } else {
        res.end();
      }
    });
    stream.pipe(res);
  } catch (error) {
    if (controller.signal.aborted) return;
    console.error(`${logPrefix} upstream error`, error);
    if (!res.headersSent) {
      res.status(502).json({ error: "Upstream video stream unavailable" });
    }
  }
}

async function sendLegacyVodStream(req: Request, res: Response) {
  const params = getRequestParams(req);
  if (!params) {
    res.status(400).json({ error: "Invalid legacy VOD parameters" });
    return;
  }

  let info: LegacyVodInfo;
  try {
    info = await fetchLegacyVodInfo(params.pageCode, params.num, params.vodType);
  } catch (error) {
    console.error("[LegacyVOD] metadata error", error);
    res.status(502).json({ error: "Legacy VOD metadata unavailable" });
    return;
  }

  await sendApprovedVideoStream(req, res, info.vodFile, "[LegacyVOD]");
}

async function sendDirectVideoProxy(req: Request, res: Response) {
  const sourceUrl = getApprovedDirectVideoUrl(req);
  if (!sourceUrl) {
    res.status(400).json({ error: "Invalid direct video URL" });
    return;
  }

  await sendApprovedVideoStream(req, res, sourceUrl.toString(), "[DirectVideoProxy]");
}

async function sendDirectVideoPathProxy(req: Request, res: Response) {
  const sourceUrl = getApprovedDirectVideoPathUrl(req);
  if (!sourceUrl) {
    res.status(400).json({ error: "Invalid direct video path" });
    return;
  }

  await sendApprovedVideoStream(req, res, sourceUrl.toString(), "[DirectVideoPathProxy]");
}

export function registerLegacyVodRoutes(app: Express) {
  app.get("/api/legacy-vod/:pageCode/:num/:vodType/info", async (req, res) => {
    const params = getRequestParams(req);
    if (!params) {
      res.status(400).json({ error: "Invalid legacy VOD parameters" });
      return;
    }

    try {
      const info = await fetchLegacyVodInfo(params.pageCode, params.num, params.vodType);
      res.setHeader("Cache-Control", "public, max-age=300");
      res.json({
        pageCode: info.pageCode,
        num: info.num,
        vodType: info.vodType,
        subject: info.subject,
        word: info.word,
        preacher: info.preacher,
        date: info.date,
        streamUrl: `/api/legacy-vod/${info.pageCode}/${info.num}/${info.vodType}.mp4`,
        originalPageUrl: `${LEGACY_VOD_REFERER_BASE}?pageCode=${info.pageCode}&num=${info.num}&vodType=${info.vodType}`,
      });
    } catch (error) {
      console.error("[LegacyVOD] info error", error);
      res.status(502).json({ error: "Legacy VOD info unavailable" });
    }
  });

  app.get("/api/legacy-vod/:pageCode/:num/:vodType.mp4", sendLegacyVodStream);
  app.head("/api/legacy-vod/:pageCode/:num/:vodType.mp4", sendLegacyVodStream);
  app.get("/api/direct-video/*", sendDirectVideoPathProxy);
  app.head("/api/direct-video/*", sendDirectVideoPathProxy);
  app.get("/api/direct-video-proxy", sendDirectVideoProxy);
  app.head("/api/direct-video-proxy", sendDirectVideoProxy);
}
