import type { Express, Request, Response } from "express";

const CHURCH_PHOTO_HTTP_ORIGIN = "http://photo.joych.org";
const CHURCH_PHOTO_HTTPS_ORIGIN = "https://photo.joych.org";
const CHURCH_PHOTO_CACHE_SECONDS = 24 * 60 * 60;
const CHURCH_PHOTO_STALE_WHILE_REVALIDATE_SECONDS = 7 * 24 * 60 * 60;
const CHURCH_PHOTO_STALE_IF_ERROR_SECONDS = 30 * 24 * 60 * 60;
const CHURCH_PHOTO_ATTEMPT_TIMEOUT_MS = 3_000;
const CHURCH_PHOTO_UPSTREAM_FAILURE_COOLDOWN_MS = 30_000;
const CHURCH_PHOTO_MAX_CONCURRENT_UPSTREAM_LOADS = 4;
const CHURCH_PHOTO_MAX_BYTES = 20 * 1024 * 1024;
const CHURCH_PHOTO_MEMORY_CACHE_MAX_BYTES = 64 * 1024 * 1024;
const CHURCH_PHOTO_CACHE_CONTROL = [
  "public",
  `max-age=${CHURCH_PHOTO_CACHE_SECONDS}`,
  `stale-while-revalidate=${CHURCH_PHOTO_STALE_WHILE_REVALIDATE_SECONDS}`,
  `stale-if-error=${CHURCH_PHOTO_STALE_IF_ERROR_SECONDS}`,
].join(", ");
const ALLOWED_IMAGE_EXTENSIONS = /\.(?:jpe?g|png|gif|webp)$/i;
const ALLOWED_IMAGE_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);

type FetchLike = (
  input: string | URL | globalThis.Request,
  init?: RequestInit
) => Promise<globalThis.Response>;

type ChurchPhotoCacheEntry = {
  body: Buffer;
  contentType: string;
  etag: string | null;
  lastModified: string | null;
  storedAt: number;
};

export type ChurchPhotoLoadResult = ChurchPhotoCacheEntry & {
  cacheStatus: "HIT" | "MISS" | "STALE";
};

export class ChurchPhotoLoadError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly reason:
      | "invalid-path"
      | "not-found"
      | "upstream-unavailable"
      | "upstream-overloaded"
      | "invalid-response"
      | "too-large" = "invalid-response",
    public readonly opensCircuit = false
  ) {
    super(message);
    this.name = "ChurchPhotoLoadError";
  }
}

class ChurchPhotoMemoryCache {
  private readonly entries = new Map<string, ChurchPhotoCacheEntry>();
  private totalBytes = 0;

  constructor(private readonly maxBytes: number) {}

  get(key: string, now: number) {
    const entry = this.entries.get(key);
    if (!entry) return null;

    const maxRetainedAgeMs = CHURCH_PHOTO_STALE_IF_ERROR_SECONDS * 1_000;
    if (now - entry.storedAt > maxRetainedAgeMs) {
      this.delete(key);
      return null;
    }

    // Map insertion order is the LRU order. Reinsert on every access.
    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry;
  }

  set(key: string, entry: ChurchPhotoCacheEntry) {
    if (entry.body.byteLength > this.maxBytes) return;

    this.delete(key);
    this.entries.set(key, entry);
    this.totalBytes += entry.body.byteLength;

    while (this.totalBytes > this.maxBytes) {
      const oldestKey = this.entries.keys().next().value;
      if (typeof oldestKey !== "string") break;
      this.delete(oldestKey);
    }
  }

  private delete(key: string) {
    const existing = this.entries.get(key);
    if (!existing) return;
    this.totalBytes -= existing.body.byteLength;
    this.entries.delete(key);
  }
}

type ChurchPhotoLoaderOptions = {
  fetchImpl?: FetchLike;
  now?: () => number;
  cacheMaxBytes?: number;
  attemptTimeoutMs?: number;
  upstreamFailureCooldownMs?: number;
  maxConcurrentUpstreamLoads?: number;
};

/**
 * Loads complete image objects so every request for the same photo can share
 * one upstream fetch. The bounded cache is memory-only and is intentionally
 * discarded whenever the Node process restarts.
 */
export class ChurchPhotoLoader {
  private readonly fetchImpl: FetchLike;
  private readonly now: () => number;
  private readonly attemptTimeoutMs: number;
  private readonly upstreamFailureCooldownMs: number;
  private readonly maxConcurrentUpstreamLoads: number;
  private readonly cache: ChurchPhotoMemoryCache;
  private readonly inFlight = new Map<string, Promise<ChurchPhotoCacheEntry>>();
  private circuitOpenUntil = 0;
  private activeUpstreamLoads = 0;
  private upstreamSuccessGeneration = 0;

  constructor(options: ChurchPhotoLoaderOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.now = options.now ?? Date.now;
    this.attemptTimeoutMs =
      options.attemptTimeoutMs ?? CHURCH_PHOTO_ATTEMPT_TIMEOUT_MS;
    this.upstreamFailureCooldownMs =
      options.upstreamFailureCooldownMs ??
      CHURCH_PHOTO_UPSTREAM_FAILURE_COOLDOWN_MS;
    this.maxConcurrentUpstreamLoads = Math.max(
      1,
      options.maxConcurrentUpstreamLoads ??
        CHURCH_PHOTO_MAX_CONCURRENT_UPSTREAM_LOADS
    );
    this.cache = new ChurchPhotoMemoryCache(
      options.cacheMaxBytes ?? CHURCH_PHOTO_MEMORY_CACHE_MAX_BYTES
    );
  }

  async load(rawPath?: string): Promise<ChurchPhotoLoadResult> {
    const upstreamUrls = getChurchPhotoUpstreamUrls(rawPath);
    if (!upstreamUrls) {
      throw new ChurchPhotoLoadError(
        400,
        "Invalid church photo path",
        "invalid-path"
      );
    }

    const key = upstreamUrls[0].pathname;
    const now = this.now();
    const cached = this.cache.get(key, now);
    const isFresh =
      cached && now - cached.storedAt <= CHURCH_PHOTO_CACHE_SECONDS * 1_000;
    if (cached && isFresh) {
      return { ...cached, cacheStatus: "HIT" };
    }

    let pending = this.inFlight.get(key);
    if (!pending) {
      if (this.circuitOpenUntil > now) {
        if (cached) return { ...cached, cacheStatus: "STALE" };
        throw new ChurchPhotoLoadError(
          502,
          "Church photo server unavailable",
          "upstream-unavailable"
        );
      }

      if (this.activeUpstreamLoads >= this.maxConcurrentUpstreamLoads) {
        if (cached) return { ...cached, cacheStatus: "STALE" };
        throw new ChurchPhotoLoadError(
          503,
          "Church photo proxy is busy",
          "upstream-overloaded"
        );
      }

      this.activeUpstreamLoads += 1;
      const successGenerationAtStart = this.upstreamSuccessGeneration;
      pending = this.fetchAndValidate(upstreamUrls)
        .then(
          loaded => {
            // Any successful upstream response proves the shared source is back.
            this.upstreamSuccessGeneration += 1;
            this.circuitOpenUntil = 0;
            return loaded;
          },
          error => {
            if (
              error instanceof ChurchPhotoLoadError &&
              error.opensCircuit &&
              successGenerationAtStart === this.upstreamSuccessGeneration
            ) {
              this.circuitOpenUntil =
                this.now() + this.upstreamFailureCooldownMs;
            }
            throw error;
          }
        )
        .finally(() => {
          this.activeUpstreamLoads -= 1;
        });
      this.inFlight.set(key, pending);
      pending
        .finally(() => {
          if (this.inFlight.get(key) === pending) this.inFlight.delete(key);
        })
        .catch(() => {
          // The original caller observes the rejection. This catch only prevents
          // the cleanup branch created by finally() from becoming unhandled.
        });
    }

    try {
      const loaded = await pending;
      this.cache.set(key, loaded);
      return { ...loaded, cacheStatus: "MISS" };
    } catch (error) {
      // A stale copy is safe only when the source is temporarily unavailable.
      // A definitive 404 or an invalid/oversized response must not be masked.
      if (
        cached &&
        error instanceof ChurchPhotoLoadError &&
        error.reason === "upstream-unavailable"
      ) {
        return { ...cached, cacheStatus: "STALE" };
      }
      throw error;
    }
  }

  private async fetchAndValidate(upstreamUrls: [URL, URL]) {
    const { response: upstream, body } = await fetchChurchPhotoWithRetry(
      upstreamUrls,
      this.fetchImpl,
      this.attemptTimeoutMs
    );

    if (upstream.status === 404) {
      throw new ChurchPhotoLoadError(
        404,
        "Church photo not found",
        "not-found"
      );
    }
    if (upstream.status !== 200) {
      throw new ChurchPhotoLoadError(
        502,
        "Church photo server unavailable",
        "upstream-unavailable"
      );
    }

    const contentType = (upstream.headers.get("content-type") ?? "")
      .split(";", 1)[0]
      .trim()
      .toLowerCase();
    return {
      body,
      contentType,
      etag: upstream.headers.get("etag"),
      lastModified: upstream.headers.get("last-modified"),
      storedAt: this.now(),
    };
  }
}

/**
 * Builds URLs on the two fixed church photo origins. Keeping the hosts fixed
 * and validating every path segment prevents this public endpoint from
 * becoming an arbitrary URL/SSRF proxy.
 */
export function getChurchPhotoUpstreamUrls(
  rawPath?: string
): [URL, URL] | null {
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
        /[\\\u0000-\u001f\u007f?#]/.test(segment)
    ) ||
    !ALLOWED_IMAGE_EXTENSIONS.test(segments.at(-1) ?? "")
  ) {
    return null;
  }

  const safePath = segments
    .map(segment => encodeURIComponent(segment))
    .join("/");
  return [
    new URL(`/${safePath}`, CHURCH_PHOTO_HTTP_ORIGIN),
    new URL(`/${safePath}`, CHURCH_PHOTO_HTTPS_ORIGIN),
  ];
}

export function getChurchPhotoUpstreamUrl(rawPath?: string) {
  return getChurchPhotoUpstreamUrls(rawPath)?.[0] ?? null;
}

/**
 * Retries only source-server failures. A 4xx (especially 404) is definitive
 * and is returned immediately. HTTP is attempted twice because it is the
 * legacy server's canonical endpoint; HTTPS is a final bounded fallback.
 */
export async function fetchChurchPhotoWithRetry(
  upstreamUrls: [URL, URL],
  fetchImpl: FetchLike = fetch,
  attemptTimeoutMs = CHURCH_PHOTO_ATTEMPT_TIMEOUT_MS
) {
  const attempts = [upstreamUrls[0], upstreamUrls[0], upstreamUrls[1]];
  let lastError: unknown;
  let sawRetryableHttpResponse = false;

  for (let index = 0; index < attempts.length; index += 1) {
    const upstreamUrl = attempts[index];
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), attemptTimeoutMs);

    try {
      const response = await fetchImpl(upstreamUrl, {
        method: "GET",
        headers: {
          Referer: "http://www.joych.org/",
          "User-Agent": "Mozilla/5.0 (compatible; JoychPhotoProxy/2.0)",
        },
        redirect: "error",
        signal: controller.signal,
      });

      if (response.status < 500) {
        if (response.status !== 200) {
          await response.body?.cancel().catch(() => undefined);
          return { response, body: Buffer.alloc(0) };
        }

        const contentType = (response.headers.get("content-type") ?? "")
          .split(";", 1)[0]
          .trim()
          .toLowerCase();
        if (!ALLOWED_IMAGE_CONTENT_TYPES.has(contentType)) {
          await response.body?.cancel().catch(() => undefined);
          throw new ChurchPhotoLoadError(
            502,
            "Invalid church photo response",
            "invalid-response"
          );
        }

        const contentLength = Number(response.headers.get("content-length"));
        if (
          Number.isFinite(contentLength) &&
          contentLength > CHURCH_PHOTO_MAX_BYTES
        ) {
          await response.body?.cancel().catch(() => undefined);
          throw new ChurchPhotoLoadError(
            413,
            "Church photo is too large",
            "too-large"
          );
        }

        const body = await readBodyWithLimit(
          response,
          CHURCH_PHOTO_MAX_BYTES,
          controller.signal
        );
        return { response, body };
      }

      sawRetryableHttpResponse = true;
      lastError = new Error(
        `Church photo upstream returned ${response.status}`
      );
      await response.body?.cancel().catch(() => undefined);
    } catch (error) {
      if (
        error instanceof ChurchPhotoLoadError &&
        error.reason !== "upstream-unavailable"
      ) {
        throw error;
      }
      lastError = error;
    } finally {
      clearTimeout(timeout);
    }

    if (index < attempts.length - 1) continue;
  }

  console.error("[ChurchPhoto] all upstream attempts failed", lastError);
  throw new ChurchPhotoLoadError(
    502,
    "Church photo server unavailable",
    "upstream-unavailable",
    !sawRetryableHttpResponse
  );
}

async function readBodyWithLimit(
  response: globalThis.Response,
  maxBytes: number,
  signal: AbortSignal
) {
  if (!response.body) {
    throw new ChurchPhotoLoadError(
      502,
      "Invalid church photo response",
      "invalid-response"
    );
  }

  const reader = response.body.getReader();
  if (signal.aborted) {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
    throw new DOMException("Church photo body timed out", "AbortError");
  }

  const readPromise = (async () => {
    const chunks: Uint8Array[] = [];
    let totalBytes = 0;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        totalBytes += value.byteLength;
        if (totalBytes > maxBytes) {
          await reader.cancel();
          throw new ChurchPhotoLoadError(
            413,
            "Church photo is too large",
            "too-large"
          );
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }

    return Buffer.concat(chunks, totalBytes);
  })();

  let abortHandler: (() => void) | undefined;
  const abortPromise = new Promise<never>((_resolve, reject) => {
    abortHandler = () => {
      void reader.cancel().catch(() => undefined);
      reject(new DOMException("Church photo body timed out", "AbortError"));
    };
    signal.addEventListener("abort", abortHandler, { once: true });
  });

  try {
    return await Promise.race([readPromise, abortPromise]);
  } finally {
    if (abortHandler) signal.removeEventListener("abort", abortHandler);
  }
}

function parseByteRange(rangeHeader: string, totalBytes: number) {
  const match = /^bytes=(\d*)-(\d*)$/i.exec(rangeHeader.trim());
  if (!match || (!match[1] && !match[2]) || totalBytes === 0) return null;

  let start: number;
  let end: number;
  if (!match[1]) {
    const suffixLength = Number(match[2]);
    if (!Number.isSafeInteger(suffixLength) || suffixLength <= 0) return null;
    start = Math.max(0, totalBytes - suffixLength);
    end = totalBytes - 1;
  } else {
    start = Number(match[1]);
    end = match[2] ? Number(match[2]) : totalBytes - 1;
    if (
      !Number.isSafeInteger(start) ||
      !Number.isSafeInteger(end) ||
      start < 0 ||
      end < start ||
      start >= totalBytes
    ) {
      return null;
    }
    end = Math.min(end, totalBytes - 1);
  }

  return { start, end };
}

function sendError(res: Response, status: number, message: string) {
  res.setHeader("Cache-Control", "no-store");
  res.status(status).json({ error: message });
}

const churchPhotoLoader = new ChurchPhotoLoader();

async function sendChurchPhoto(req: Request, res: Response) {
  try {
    const photo = await churchPhotoLoader.load(req.params[0]);
    const rangeHeader =
      typeof req.headers.range === "string" ? req.headers.range : null;
    const range = rangeHeader
      ? parseByteRange(rangeHeader, photo.body.byteLength)
      : null;

    if (rangeHeader && !range) {
      res.setHeader("Cache-Control", "no-store");
      res.setHeader("Content-Range", `bytes */${photo.body.byteLength}`);
      res.status(416).end();
      return;
    }

    const body = range
      ? photo.body.subarray(range.start, range.end + 1)
      : photo.body;
    res.status(range ? 206 : 200);
    res.setHeader("Content-Type", photo.contentType);
    res.setHeader("Content-Length", String(body.byteLength));
    res.setHeader("Cache-Control", CHURCH_PHOTO_CACHE_CONTROL);
    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Church-Photo-Cache", photo.cacheStatus);
    if (range) {
      res.setHeader(
        "Content-Range",
        `bytes ${range.start}-${range.end}/${photo.body.byteLength}`
      );
    }
    if (photo.etag) res.setHeader("ETag", photo.etag);
    if (photo.lastModified) {
      res.setHeader("Last-Modified", photo.lastModified);
    }

    if (req.method === "HEAD") {
      res.end();
      return;
    }
    res.end(body);
  } catch (error) {
    if (error instanceof ChurchPhotoLoadError) {
      sendError(res, error.status, error.message);
      return;
    }
    console.error("[ChurchPhoto] unexpected proxy error", error);
    sendError(res, 502, "Church photo server unavailable");
  }
}

export function registerChurchPhotoRoutes(app: Express) {
  app.get("/api/church-photo/*", sendChurchPhoto);
  app.head("/api/church-photo/*", sendChurchPhoto);
}
