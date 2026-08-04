import type { Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "../db/connection";
import {
  checkDatabaseReadiness,
  createReadinessHandler,
} from "./readiness";

vi.mock("../db/connection", () => ({
  getDb: vi.fn(),
}));

function createResponse() {
  const response = {
    json: vi.fn(),
    setHeader: vi.fn(),
    status: vi.fn(),
  };
  response.status.mockReturnValue(response);
  response.json.mockReturnValue(response);
  return response;
}

describe("database readiness", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("runs a query against the configured database", async () => {
    const execute = vi.fn().mockResolvedValue([]);
    vi.mocked(getDb).mockResolvedValue({ execute } as never);

    await expect(checkDatabaseReadiness()).resolves.toBeUndefined();
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it("fails when no database is configured", async () => {
    vi.mocked(getDb).mockResolvedValue(null);

    await expect(checkDatabaseReadiness()).rejects.toThrow(
      "database is not configured",
    );
  });

  it("returns 200 only after the database probe succeeds", async () => {
    const checkDatabase = vi.fn().mockResolvedValue(undefined);
    const response = createResponse();
    const handler = createReadinessHandler(checkDatabase);

    await handler({} as Request, response as unknown as Response, vi.fn());

    expect(response.setHeader).toHaveBeenCalledWith("Cache-Control", "no-store");
    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith({
      ok: true,
      checks: { database: "ok" },
    });
  });

  it("returns 503 without exposing database errors", async () => {
    const checkDatabase = vi.fn().mockRejectedValue(
      new Error("mysql://secret-host"),
    );
    const response = createResponse();
    const handler = createReadinessHandler(checkDatabase);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    await handler({} as Request, response as unknown as Response, vi.fn());

    expect(response.setHeader).toHaveBeenCalledWith("Retry-After", "5");
    expect(response.status).toHaveBeenCalledWith(503);
    expect(response.json).toHaveBeenCalledWith({
      ok: false,
      checks: { database: "unavailable" },
    });
    expect(JSON.stringify(response.json.mock.calls)).not.toContain("secret-host");
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain("secret-host");
    expect(consoleError).toHaveBeenCalledWith(
      "[readiness] database check failed name=Error",
    );
    consoleError.mockRestore();
  });

  it("coalesces concurrent probes and caches their result briefly", async () => {
    let finishProbe: (() => void) | undefined;
    const checkDatabase = vi.fn(
      () => new Promise<void>(resolve => {
        finishProbe = resolve;
      }),
    );
    let now = 1_000;
    const handler = createReadinessHandler(checkDatabase, {
      cacheTtlMs: 1_000,
      now: () => now,
    });
    const firstResponse = createResponse();
    const secondResponse = createResponse();

    const firstRequest = handler(
      {} as Request,
      firstResponse as unknown as Response,
      vi.fn(),
    );
    const secondRequest = handler(
      {} as Request,
      secondResponse as unknown as Response,
      vi.fn(),
    );
    expect(checkDatabase).toHaveBeenCalledTimes(1);
    finishProbe?.();
    await Promise.all([firstRequest, secondRequest]);

    await handler(
      {} as Request,
      createResponse() as unknown as Response,
      vi.fn(),
    );
    expect(checkDatabase).toHaveBeenCalledTimes(1);

    now += 1_001;
    finishProbe = undefined;
    const expiredRequest = handler(
      {} as Request,
      createResponse() as unknown as Response,
      vi.fn(),
    );
    expect(checkDatabase).toHaveBeenCalledTimes(2);
    finishProbe?.();
    await expiredRequest;
  });
});
