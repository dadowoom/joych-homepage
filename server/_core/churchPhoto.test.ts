import { describe, expect, it, vi } from "vitest";
import {
  ChurchPhotoLoadError,
  ChurchPhotoLoader,
  fetchChurchPhotoWithRetry,
  getChurchPhotoUpstreamUrl,
  getChurchPhotoUpstreamUrls,
} from "./churchPhoto";

describe("getChurchPhotoUpstreamUrl", () => {
  it("maps a valid photo path to the fixed HTTP church photo server", () => {
    expect(
      getChurchPhotoUpstreamUrl("photo/2026/0621/11.jpg")?.toString()
    ).toBe("http://photo.joych.org/photo/2026/0621/11.jpg");
  });

  it("supports the image formats allowed by the editor", () => {
    for (const extension of ["jpg", "jpeg", "png", "gif", "webp"]) {
      expect(
        getChurchPhotoUpstreamUrl(`photo/2026/0621/image.${extension}`)
      ).not.toBeNull();
    }
  });

  it.each([
    "",
    "other/2026/0621/11.jpg",
    "photo/../secret.jpg",
    "photo/%2e%2e/secret.jpg",
    "photo/2026/0621/11.svg",
    "photo/2026/0621/11.jpg?target=http://example.com",
    "photo/2026/0621/11.jpg%00.png",
  ])("rejects unsafe or unsupported path %s", path => {
    expect(getChurchPhotoUpstreamUrl(path)).toBeNull();
  });
});

describe("fetchChurchPhotoWithRetry", () => {
  const urls = getChurchPhotoUpstreamUrls("photo/2026/0621/11.jpg")!;

  it("retries network and 5xx failures, then uses the HTTPS fallback", async () => {
    const fetchImpl = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("network unavailable"))
      .mockResolvedValueOnce(new Response("temporary", { status: 503 }))
      .mockResolvedValueOnce(
        new Response(new Uint8Array([1]), {
          status: 200,
          headers: { "content-type": "image/jpeg" },
        })
      );

    const result = await fetchChurchPhotoWithRetry(urls, fetchImpl, 1_000);

    expect(result.response.status).toBe(200);
    expect(result.body).toEqual(Buffer.from([1]));
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(String(fetchImpl.mock.calls[0][0])).toMatch(/^http:/);
    expect(String(fetchImpl.mock.calls[1][0])).toMatch(/^http:/);
    expect(String(fetchImpl.mock.calls[2][0])).toMatch(/^https:/);
  });

  it("does not retry a definitive 404", async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 404 }));

    const result = await fetchChurchPhotoWithRetry(urls, fetchImpl, 1_000);

    expect(result.response.status).toBe(404);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});

describe("ChurchPhotoLoader", () => {
  it("deduplicates concurrent requests for the same URL", async () => {
    let releaseFetch!: (response: Response) => void;
    const upstreamResponse = new Promise<Response>(resolve => {
      releaseFetch = resolve;
    });
    const fetchImpl = vi.fn(() => upstreamResponse);
    const loader = new ChurchPhotoLoader({
      fetchImpl,
      attemptTimeoutMs: 5_000,
    });

    const first = loader.load("photo/2026/0621/11.jpg");
    const second = loader.load("photo/2026/0621/11.jpg");
    releaseFetch(
      new Response(new Uint8Array([1, 2, 3]), {
        headers: { "content-type": "image/jpeg" },
      })
    );

    const [firstResult, secondResult] = await Promise.all([first, second]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(firstResult.body).toEqual(Buffer.from([1, 2, 3]));
    expect(secondResult.body).toEqual(Buffer.from([1, 2, 3]));
  });

  it("limits concurrent upstream loads while preserving same-URL deduplication", async () => {
    let releaseFetch!: (response: Response) => void;
    const pendingResponse = new Promise<Response>(resolve => {
      releaseFetch = resolve;
    });
    const fetchImpl = vi.fn(() => pendingResponse);
    const loader = new ChurchPhotoLoader({
      fetchImpl,
      maxConcurrentUpstreamLoads: 1,
      attemptTimeoutMs: 5_000,
    });

    const first = loader.load("photo/2026/0621/1.jpg");
    const deduplicated = loader.load("photo/2026/0621/1.jpg");
    await expect(loader.load("photo/2026/0621/2.jpg")).rejects.toMatchObject({
      status: 503,
      reason: "upstream-overloaded",
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    releaseFetch(
      new Response(new Uint8Array([1]), {
        headers: { "content-type": "image/jpeg" },
      })
    );
    await Promise.all([first, deduplicated]);
  });

  it("serves a stale cache entry instead of adding an overloaded upstream load", async () => {
    let now = 0;
    let releaseBlockingFetch!: (response: Response) => void;
    const blockingResponse = new Promise<Response>(resolve => {
      releaseBlockingFetch = resolve;
    });
    const fetchImpl = vi.fn((input: string | URL | Request) => {
      const pathname = new URL(String(input)).pathname;
      if (pathname.endsWith("/1.jpg")) return blockingResponse;
      return Promise.resolve(
        new Response(new Uint8Array([9]), {
          headers: { "content-type": "image/jpeg" },
        })
      );
    });
    const loader = new ChurchPhotoLoader({
      fetchImpl,
      now: () => now,
      maxConcurrentUpstreamLoads: 1,
      attemptTimeoutMs: 5_000,
    });

    await loader.load("photo/2026/0621/9.jpg");
    now = 24 * 60 * 60 * 1_000 + 1;
    const blocking = loader.load("photo/2026/0621/1.jpg");

    await expect(loader.load("photo/2026/0621/9.jpg")).resolves.toMatchObject({
      cacheStatus: "STALE",
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);

    releaseBlockingFetch(
      new Response(new Uint8Array([1]), {
        headers: { "content-type": "image/jpeg" },
      })
    );
    await blocking;
  });

  it("keeps a byte-bounded LRU memory cache", async () => {
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      const pathname = new URL(String(input)).pathname;
      const marker = Number(pathname.match(/(\d+)\.jpg$/)?.[1] ?? 0);
      return new Response(new Uint8Array([marker, marker, marker, marker]), {
        headers: { "content-type": "image/jpeg" },
      });
    });
    const loader = new ChurchPhotoLoader({
      fetchImpl,
      cacheMaxBytes: 8,
    });

    await loader.load("photo/2026/0621/1.jpg");
    await loader.load("photo/2026/0621/2.jpg");
    await loader.load("photo/2026/0621/1.jpg"); // Refreshes photo 1's LRU age.
    await loader.load("photo/2026/0621/3.jpg"); // Evicts photo 2.
    await loader.load("photo/2026/0621/2.jpg");

    expect(fetchImpl).toHaveBeenCalledTimes(4);
  });

  it("opens a short global circuit after total failure and retries after cooldown", async () => {
    let now = 0;
    const fetchImpl = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("network unavailable"))
      .mockRejectedValueOnce(new TypeError("network unavailable"))
      .mockRejectedValueOnce(new TypeError("network unavailable"))
      .mockResolvedValueOnce(
        new Response(new Uint8Array([1]), {
          headers: { "content-type": "image/jpeg" },
        })
      );
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const loader = new ChurchPhotoLoader({
      fetchImpl,
      now: () => now,
      attemptTimeoutMs: 1_000,
      upstreamFailureCooldownMs: 30_000,
    });

    await expect(loader.load("photo/2026/0621/1.jpg")).rejects.toMatchObject({
      reason: "upstream-unavailable",
    });
    expect(fetchImpl).toHaveBeenCalledTimes(3);

    await expect(loader.load("photo/2026/0621/2.jpg")).rejects.toMatchObject({
      reason: "upstream-unavailable",
    });
    expect(fetchImpl).toHaveBeenCalledTimes(3);

    now = 30_001;
    await expect(loader.load("photo/2026/0621/2.jpg")).resolves.toMatchObject({
      cacheStatus: "MISS",
    });
    expect(fetchImpl).toHaveBeenCalledTimes(4);
    consoleError.mockRestore();
  });

  it("does not open the global circuit for upstream 5xx responses", async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 503 }));
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const loader = new ChurchPhotoLoader({
      fetchImpl,
      attemptTimeoutMs: 1_000,
      upstreamFailureCooldownMs: 30_000,
    });

    await expect(loader.load("photo/2026/0621/1.jpg")).rejects.toMatchObject({
      reason: "upstream-unavailable",
      opensCircuit: false,
    });
    await expect(loader.load("photo/2026/0621/2.jpg")).rejects.toMatchObject({
      reason: "upstream-unavailable",
      opensCircuit: false,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(6);
    consoleError.mockRestore();
  });

  it("serves stale cached content when every retry returns 5xx", async () => {
    let now = 0;
    let sourceHealthy = true;
    const fetchImpl = vi.fn(async () =>
      sourceHealthy
        ? new Response(new Uint8Array([1]), {
            headers: { "content-type": "image/jpeg" },
          })
        : new Response(null, { status: 503 })
    );
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const loader = new ChurchPhotoLoader({
      fetchImpl,
      now: () => now,
      attemptTimeoutMs: 1_000,
    });

    await loader.load("photo/2026/0621/1.jpg");
    sourceHealthy = false;
    now = 24 * 60 * 60 * 1_000 + 1;

    await expect(loader.load("photo/2026/0621/1.jpg")).resolves.toMatchObject({
      cacheStatus: "STALE",
    });
    expect(fetchImpl).toHaveBeenCalledTimes(4);
    consoleError.mockRestore();
  });

  it("closes the global circuit immediately when another in-flight photo succeeds", async () => {
    let releaseSuccess!: (response: Response) => void;
    const pendingSuccess = new Promise<Response>(resolve => {
      releaseSuccess = resolve;
    });
    const fetchImpl = vi.fn((input: string | URL | Request) => {
      const pathname = new URL(String(input)).pathname;
      if (pathname.endsWith("/1.jpg")) {
        return Promise.reject(new TypeError("network unavailable"));
      }
      if (pathname.endsWith("/2.jpg")) return pendingSuccess;
      return Promise.resolve(
        new Response(new Uint8Array([3]), {
          headers: { "content-type": "image/jpeg" },
        })
      );
    });
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const loader = new ChurchPhotoLoader({
      fetchImpl,
      attemptTimeoutMs: 1_000,
      upstreamFailureCooldownMs: 30_000,
    });

    const failed = loader.load("photo/2026/0621/1.jpg");
    const successful = loader.load("photo/2026/0621/2.jpg");
    await expect(failed).rejects.toMatchObject({
      reason: "upstream-unavailable",
    });

    await expect(loader.load("photo/2026/0621/3.jpg")).rejects.toMatchObject({
      reason: "upstream-unavailable",
    });

    releaseSuccess(
      new Response(new Uint8Array([2]), {
        headers: { "content-type": "image/jpeg" },
      })
    );
    await successful;

    await expect(loader.load("photo/2026/0621/3.jpg")).resolves.toMatchObject({
      cacheStatus: "MISS",
    });
    consoleError.mockRestore();
  });

  it("does not let an older late transport failure reopen a circuit after success", async () => {
    let rejectLateFailure!: (error: Error) => void;
    const lateFailureResponse = new Promise<Response>((_resolve, reject) => {
      rejectLateFailure = reject;
    });
    let firstFailureAttempt = true;
    const fetchImpl = vi.fn((input: string | URL | Request) => {
      const pathname = new URL(String(input)).pathname;
      if (pathname.endsWith("/1.jpg")) {
        if (firstFailureAttempt) {
          firstFailureAttempt = false;
          return lateFailureResponse;
        }
        return Promise.reject(new TypeError("network unavailable"));
      }
      return Promise.resolve(
        new Response(new Uint8Array([2]), {
          headers: { "content-type": "image/jpeg" },
        })
      );
    });
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const loader = new ChurchPhotoLoader({
      fetchImpl,
      attemptTimeoutMs: 5_000,
      upstreamFailureCooldownMs: 30_000,
    });

    const lateFailure = loader.load("photo/2026/0621/1.jpg");
    await expect(loader.load("photo/2026/0621/2.jpg")).resolves.toMatchObject({
      cacheStatus: "MISS",
    });

    rejectLateFailure(new TypeError("network unavailable"));
    await expect(lateFailure).rejects.toMatchObject({
      reason: "upstream-unavailable",
      opensCircuit: true,
    });

    await expect(loader.load("photo/2026/0621/3.jpg")).resolves.toMatchObject({
      cacheStatus: "MISS",
    });
    expect(fetchImpl).toHaveBeenCalledTimes(5);
    consoleError.mockRestore();
  });

  it("times out and retries when the response body stalls after headers", async () => {
    const fetchImpl = vi.fn(async () => {
      const stream = new ReadableStream<Uint8Array>({
        pull() {
          return new Promise<void>(() => undefined);
        },
      });
      return new Response(stream, {
        headers: { "content-type": "image/jpeg" },
      });
    });
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const loader = new ChurchPhotoLoader({
      fetchImpl,
      attemptTimeoutMs: 20,
      upstreamFailureCooldownMs: 30_000,
    });

    await expect(loader.load("photo/2026/0621/11.jpg")).rejects.toMatchObject({
      reason: "upstream-unavailable",
      opensCircuit: true,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    consoleError.mockRestore();
  });

  it("rejects bodies that exceed 20MB even without content-length", async () => {
    const fetchImpl = vi.fn(async () => {
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new Uint8Array(20 * 1024 * 1024));
          controller.enqueue(new Uint8Array([1]));
          controller.close();
        },
      });
      return new Response(stream, {
        headers: { "content-type": "image/jpeg" },
      });
    });
    const loader = new ChurchPhotoLoader({ fetchImpl });

    await expect(loader.load("photo/2026/0621/11.jpg")).rejects.toMatchObject<
      Partial<ChurchPhotoLoadError>
    >({ status: 413 });
  });
});
