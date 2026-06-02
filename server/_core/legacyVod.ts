import type { Express, Request, Response } from "express";
import { Readable } from "stream";
import type { ReadableStream } from "stream/web";

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

const LEGACY_VOD_INFO_URL = "http://www.joych.org/core/xml/vod/vodInfo.xml.html";
const LEGACY_VOD_REFERER_BASE =
  "http://www.joych.org/core/module/vod/skin_001/vodIframe.html";
const LEGACY_VOD_CACHE_TTL_MS = 10 * 60 * 1000;
const LEGACY_VOD_CACHE = new Map<
  string,
  { expiresAt: number; info: LegacyVodInfo }
>();

function isNumericId(value: string | undefined): value is string {
  return Boolean(value && /^\d{1,10}$/.test(value));
}

function isLegacyJoychPageUrl(url: URL) {
  return (
    url.protocol === "http:" &&
    (url.hostname === "www.joych.org" || url.hostname === "joych.org") &&
    url.pathname === "/main/sub.html"
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
    const url = new URL(vodFile);
    return (
      url.protocol === "http:" &&
      url.hostname === "sermon.joych.org" &&
      url.pathname.startsWith("/mp4/") &&
      url.pathname.toLowerCase().endsWith(".mp4")
    );
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

  const controller = new AbortController();
  req.on("close", () => controller.abort());

  try {
    const upstream = await fetch(info.vodFile, {
      headers: {
        ...(req.headers.range ? { Range: req.headers.range } : {}),
        Referer: "http://www.joych.org/",
        "User-Agent": "Mozilla/5.0",
      },
      signal: controller.signal,
    });

    if (![200, 206].includes(upstream.status)) {
      res.status(502).json({ error: "Legacy VOD stream unavailable" });
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
      console.error("[LegacyVOD] stream error", error);
      if (!res.headersSent) {
        res.status(502).end();
      } else {
        res.end();
      }
    });
    stream.pipe(res);
  } catch (error) {
    if (controller.signal.aborted) return;
    console.error("[LegacyVOD] upstream error", error);
    if (!res.headersSent) {
      res.status(502).json({ error: "Legacy VOD stream unavailable" });
    }
  }
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
        originalPageUrl: `http://www.joych.org/main/sub.html?pageCode=${info.pageCode}&num=${info.num}&page=`,
      });
    } catch (error) {
      console.error("[LegacyVOD] info error", error);
      res.status(502).json({ error: "Legacy VOD info unavailable" });
    }
  });

  app.get("/api/legacy-vod/:pageCode/:num/:vodType.mp4", sendLegacyVodStream);
  app.head("/api/legacy-vod/:pageCode/:num/:vodType.mp4", sendLegacyVodStream);
}
