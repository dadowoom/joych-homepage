import { sql } from "drizzle-orm";
import type { RequestHandler } from "express";
import { getDb } from "../db/connection";

export type ReadinessCheck = () => Promise<void>;

type ReadinessResult =
  | { ok: true }
  | { ok: false };

type ReadinessHandlerOptions = {
  cacheTtlMs?: number;
  now?: () => number;
};

function safeErrorLabel(value: unknown, fallback: string): string {
  if (typeof value !== "string" && typeof value !== "number") return fallback;
  const label = String(value);
  return /^[A-Za-z0-9_.-]{1,64}$/.test(label) ? label : fallback;
}

function getErrorIdentity(error: unknown) {
  const errorRecord =
    typeof error === "object" && error !== null
      ? (error as { code?: unknown; name?: unknown })
      : null;
  const errorName = safeErrorLabel(errorRecord?.name, "Error");
  const rawCode = errorRecord?.code;
  const errorCode =
    rawCode === undefined ? undefined : safeErrorLabel(rawCode, "UNKNOWN");
  return { errorName, errorCode };
}

export async function checkDatabaseReadiness(): Promise<void> {
  const db = await getDb();
  if (!db) {
    throw new Error("database is not configured");
  }

  await db.execute(sql`SELECT 1`);
}

export function createReadinessHandler(
  checkDatabase: ReadinessCheck = checkDatabaseReadiness,
  options: ReadinessHandlerOptions = {},
): RequestHandler {
  const cacheTtlMs = options.cacheTtlMs ?? 1_000;
  const now = options.now ?? Date.now;
  let cached: { expiresAt: number; result: ReadinessResult } | null = null;
  let inFlight: Promise<ReadinessResult> | null = null;

  const getResult = async (): Promise<ReadinessResult> => {
    if (cached && now() < cached.expiresAt) return cached.result;

    if (!inFlight) {
      inFlight = checkDatabase()
        .then<ReadinessResult>(() => ({ ok: true }))
        .catch((error: unknown): ReadinessResult => {
          const { errorName, errorCode } = getErrorIdentity(error);
          const code = errorCode ? ` code=${errorCode}` : "";
          console.error(
            `[readiness] database check failed name=${errorName}${code}`,
          );
          return { ok: false };
        })
        .then(result => {
          cached = { result, expiresAt: now() + cacheTtlMs };
          return result;
        })
        .finally(() => {
          inFlight = null;
        });
    }

    return inFlight;
  };

  return async (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    const result = await getResult();

    if (result.ok) {
      res.status(200).json({
        ok: true,
        checks: { database: "ok" },
      });
      return;
    }

    res.setHeader("Retry-After", "5");
    res.status(503).json({
      ok: false,
      checks: { database: "unavailable" },
    });
  };
}
