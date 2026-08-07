/**
 * DB 연결 모듈 (server/db/connection.ts)
 * ─────────────────────────────────────────────────────────────────────────────
 * MySQL/TiDB 연결을 관리합니다.
 * - 첫 호출 시 연결을 생성하고 이후에는 캐시된 인스턴스를 반환합니다.
 * - DB가 없는 환경(로컬 개발)에서도 안전하게 null을 반환합니다.
 *
 * 사용법: const db = await getDb();
 */

import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { getDatabasePoolConfig } from "./poolConfig";

/** 캐시된 DB 인스턴스 */
let _db: ReturnType<typeof drizzle> | null = null;
let _pool: mysql.Pool | null = null;

export function getSafeDatabaseErrorMetadata(error: unknown) {
  const knownNames = new Set([
    "Error",
    "TypeError",
    "RangeError",
    "SyntaxError",
    "URIError",
    "EvalError",
    "AggregateError",
  ]);
  const candidateName = error instanceof Error ? error.name : "Error";
  const name = knownNames.has(candidateName) ? candidateName : "Error";
  const candidateCode = typeof error === "object" && error !== null && "code" in error
    ? String((error as { code?: unknown }).code ?? "")
    : "";
  const code = /^[A-Z][A-Z0-9_]{0,63}$/.test(candidateCode)
    ? candidateCode
    : "UNKNOWN";

  return { name, code };
}

/**
 * DB 인스턴스를 반환합니다.
 * DATABASE_URL 환경변수가 없으면 null을 반환합니다.
 */
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      const pool = mysql.createPool({
        uri: process.env.DATABASE_URL,
        timezone: "+09:00",
        ...getDatabasePoolConfig(),
      });
      _pool = pool;
      _db = drizzle(pool) as unknown as ReturnType<typeof drizzle>;
    } catch (error) {
      const { name, code } = getSafeDatabaseErrorMetadata(error);
      console.warn(`[Database] Failed to initialize connection (name=${name}, code=${code})`);
      _pool = null;
      _db = null;
    }
  }
  return _db;
}

/**
 * Returns the same mysql2 pool used by the Drizzle singleton.
 *
 * Reservation advisory locks must stay on one physical connection until the
 * surrounding transaction has committed or rolled back. Callers use this
 * accessor instead of creating a second pool, which would otherwise multiply
 * the production connection count.
 */
export async function getRawDbPool() {
  await getDb();
  return _pool;
}
