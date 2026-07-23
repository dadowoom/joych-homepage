import type { Express, Request, Response } from "express";
import { Readable } from "node:stream";
import type { ReadableStream } from "node:stream/web";

const CHURCH_PHOTO_ORIGIN = "http://photo.joych.org";
const CHURCH_PHOTO_CACHE_SECONDS = 24 * 60 * 60;
const CHURCH_PHOTO_TIMEOUT_MS = 20_000;
const CHURCH_PHOTO_MAX_BYTES = 20 * 1024 * 1024;
const ALLOWED_IMAGE_EXTENSIONS = /\.(?:jpe?g|png|gif|webp)$/i;
const ALLOWED_IMAGE_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);

function setHeaderFromUpstream(
  res: Response,
  upstream: globalThis.Response,
  header: string,
) {
  const value = upstream.headers.get(header);
  if (value) res.setHeader(header, value);
}

/**
 * Builds a URL on the fixed church photo server. Keeping the origin fixed and
 * validating every path segment prevents this public proxy from becoming an
 * arbitrary URL/SSRF proxy.
 */
export function getChurchPhotoUpstreamUrl(rawPath?: string) {
  if (!rawPath || rawPath.length > 2_048) return null;

  let decodedPath: string;
  try {
    decodedPath = decodeURIComponent(rawPath.replace(/^\/+/, ""));
  } catch {
    return null;
  }

  const segments = decodedPath.split("/");
  if (
    segments[0]?.toLowerCase() !== "photo" ||
    segments.length < 3 ||
    segments.some(
      segment =>
        !segment ||
        segment === "." ||
        segment === ".." ||
        /[\\\u0000-\u001f\u007f?#]/.test(segment),
    ) ||
    !ALLOWED_IMAGE_EXTENSIONS.test(segments.at(-1) ?? "")
  ) {
    return null;
  }

  const safePath = segments.map(segment => encodeURIComponent(segment)).join("/");
  return new URL(`/${safePath}`, CHURCH_PHOTO_ORIGIN);
}

async function sendChurchPhoto(req: Request, res: Response) {
  const upstreamUrl = getChurchPhotoUpstreamUrl(req.params[0]);
  if (!upstreamUrl) {
    res.status(400).json({ error: "Invalid church photo path" });
    return;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CHURCH_PHOTO_TIMEOUT_MS);
  res.on("close", () => {
    if (!res.writableEnded) controller.abort();
  });

  try {
    const range = typeof req.headers.range === "string" ? req.headers.range : null;
    const upstream = await fetch(upstreamUrl, {
      method: req.method === "HEAD" ? "HEAD" : "GET",
      headers: {
        ...(range ? { Range: range } : {}),
        Referer: "http://www.joych.org/",
        "User-Agent": "Mozilla/5.0 (compatible; JoychPhotoProxy/1.0)",
      },
      redirect: "error",
      signal: controller.signal,
    });

    if (upstream.status === 404) {
      res.status(404).json({ error: "Church photo not found" });
      return;
    }
    if (upstream.status === 416) {
      res.status(416);
      setHeaderFromUpstream(res, upstream, "content-range");
      res.end();
      return;
    }
    if (![200, 206].includes(upstream.status)) {
      res.status(502).json({ error: "Church photo server unavailable" });
      return;
    }

    const contentType = (upstream.headers.get("content-type") ?? "")
      .split(";", 1)[0]
      .trim()
      .toLowerCase();
    if (!ALLOWED_IMAGE_CONTENT_TYPES.has(contentType)) {
      res.status(502).json({ error: "Invalid church photo response" });
      return;
    }

    const contentLength = Number(upstream.headers.get("content-length"));
    if (Number.isFinite(contentLength) && contentLength > CHURCH_PHOTO_MAX_BYTES) {
      res.status(413).json({ error: "Church photo is too large" });
      return;
    }

    res.status(upstream.status);
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", `public, max-age=${CHURCH_PHOTO_CACHE_SECONDS}`);
    res.setHeader("X-Content-Type-Options", "nosniff");
    setHeaderFromUpstream(res, upstream, "content-length");
    setHeaderFromUpstream(res, upstream, "content-range");
    setHeaderFromUpstream(res, upstream, "accept-ranges");
    setHeaderFromUpstream(res, upstream, "etag");
    setHeaderFromUpstream(res, upstream, "last-modified");

    if (req.method === "HEAD") {
      res.end();
      return;
    }
    if (!upstream.body) {
      res.status(502).end();
      return;
    }

    const stream = Readable.fromWeb(
      upstream.body as unknown as ReadableStream<Uint8Array>,
    );
    stream.on("error", error => {
      if (controller.signal.aborted || error.name === "AbortError") return;
      console.error("[ChurchPhoto] stream error", error);
      if (!res.headersSent) res.status(502).end();
      else res.end();
    });
    stream.pipe(res);
  } catch (error) {
    if (controller.signal.aborted) {
      if (!res.headersSent) {
        res.status(504).json({ error: "Church photo server timed out" });
      }
      return;
    }
    console.error("[ChurchPhoto] upstream error", error);
    if (!res.headersSent) {
      res.status(502).json({ error: "Church photo server unavailable" });
    }
  } finally {
    clearTimeout(timeout);
  }
}

export function registerChurchPhotoRoutes(app: Express) {
  app.get("/api/church-photo/*", sendChurchPhoto);
  app.head("/api/church-photo/*", sendChurchPhoto);
}
