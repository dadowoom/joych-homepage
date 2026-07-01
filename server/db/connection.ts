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

/** 캐시된 DB 인스턴스 */
let _db: ReturnType<typeof drizzle> | null = null;

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
      });
      _db = drizzle(pool) as unknown as ReturnType<typeof drizzle>;
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}
