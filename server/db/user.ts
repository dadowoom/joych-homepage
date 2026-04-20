/**
 * 사용자 DB 함수 (server/db/user.ts)
 * ─────────────────────────────────────────────────────────────────────────────
 * 담당 기능:
 *   - upsertUser: 로그인 시 사용자 생성 또는 업데이트
 *   - getUserByOpenId: openId로 사용자 조회
 *   - setUserRole: 사용자 역할 변경 (admin / user)
 */

import { eq } from "drizzle-orm";
import { InsertUser, users } from "../../drizzle/schema";
import { getDb } from "./connection";

/**
 * 사용자 생성 또는 업데이트 (Upsert)
 * - Manus OAuth 로그인 시 호출됩니다.
 * - openId가 같으면 이름/아바타를 업데이트합니다.
 */
export async function upsertUser(user: InsertUser): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.insert(users).values(user).onDuplicateKeyUpdate({
    set: {
      name: user.name,
      updatedAt: new Date(),
    },
  });
}

/**
 * openId로 사용자 조회
 * - 로그인 후 세션 검증 시 사용됩니다.
 */
export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return rows[0] ?? null;
}

/**
 * 사용자 역할 변경
 * - 관리자 페이지에서 특정 사용자를 admin으로 승격하거나 user로 강등할 때 사용합니다.
 */
export async function setUserRole(openId: string, role: "admin" | "user"): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ role }).where(eq(users.openId, openId));
}
