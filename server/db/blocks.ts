/**
 * 블록 에디터 DB 함수 (server/db/blocks.ts)
 * ─────────────────────────────────────────────────────────────────────────────
 * 담당 기능:
 *   - 동적 페이지 콘텐츠 블록 관리
 *   - getPageBlocks: 공개용 블록 조회 (isVisible=true)
 *   - getAllPageBlocks: 관리자용 블록 조회 (숨김 포함)
 *   - getPageBlockById: 블록 단건 조회
 *   - createPageBlock: 블록 생성
 *   - updatePageBlock: 블록 내용 수정
 *   - deletePageBlock: 블록 삭제
 *   - reorderPageBlocks: 블록 순서 일괄 변경
 */

import { eq, asc } from "drizzle-orm";
import { pageBlocks, PageBlock } from "../../drizzle/schema";
import { getDb } from "./connection";

/**
 * 특정 페이지의 블록 목록 조회 (공개용 — isVisible=true 만)
 * menuItemId 또는 menuSubItemId 중 하나를 전달합니다.
 */
export async function getPageBlocks(params: {
  menuItemId?: number;
  menuSubItemId?: number;
}): Promise<PageBlock[]> {
  const db = await getDb();
  if (!db) return [];
  if (params.menuItemId !== undefined) {
    return db.select().from(pageBlocks)
      .where(eq(pageBlocks.menuItemId, params.menuItemId))
      .orderBy(asc(pageBlocks.sortOrder));
  }
  if (params.menuSubItemId !== undefined) {
    return db.select().from(pageBlocks)
      .where(eq(pageBlocks.menuSubItemId, params.menuSubItemId))
      .orderBy(asc(pageBlocks.sortOrder));
  }
  return [];
}

/**
 * 특정 페이지의 블록 목록 조회 (관리자용 — 숨김 포함)
 */
export async function getAllPageBlocks(params: {
  menuItemId?: number;
  menuSubItemId?: number;
}): Promise<PageBlock[]> {
  const db = await getDb();
  if (!db) return [];
  if (params.menuItemId !== undefined) {
    return db.select().from(pageBlocks)
      .where(eq(pageBlocks.menuItemId, params.menuItemId))
      .orderBy(asc(pageBlocks.sortOrder));
  }
  if (params.menuSubItemId !== undefined) {
    return db.select().from(pageBlocks)
      .where(eq(pageBlocks.menuSubItemId, params.menuSubItemId))
      .orderBy(asc(pageBlocks.sortOrder));
  }
  return [];
}

/** 블록 단건 조회 */
export async function getPageBlockById(id: number): Promise<PageBlock | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(pageBlocks).where(eq(pageBlocks.id, id)).limit(1);
  return rows[0] ?? null;
}

/** 블록 생성 — 새 블록을 페이지 맨 끝에 추가 */
export async function createPageBlock(data: {
  menuItemId?: number;
  menuSubItemId?: number;
  blockType: string;
  content: string;
  sortOrder: number;
}): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error('DB not available');
  const [result] = await db.insert(pageBlocks).values({
    menuItemId: data.menuItemId ?? null,
    menuSubItemId: data.menuSubItemId ?? null,
    blockType: data.blockType,
    content: data.content,
    sortOrder: data.sortOrder,
    isVisible: true,
  });
  return (result as any).insertId as number;
}

/** 블록 내용 수정 */
export async function updatePageBlock(id: number, data: Partial<{
  blockType: string;
  content: string;
  sortOrder: number;
  isVisible: boolean;
}>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error('DB not available');
  await db.update(pageBlocks).set({ ...data, updatedAt: new Date() }).where(eq(pageBlocks.id, id));
}

/** 블록 삭제 */
export async function deletePageBlock(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error('DB not available');
  await db.delete(pageBlocks).where(eq(pageBlocks.id, id));
}

/**
 * 블록 순서 일괄 변경
 * orderedIds: 새 순서대로 정렬된 블록 ID 배열
 * 예: [3, 1, 2] → id=3이 sortOrder=0, id=1이 sortOrder=1, id=2가 sortOrder=2
 */
export async function reorderPageBlocks(orderedIds: number[]): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error('DB not available');
  // 각 블록의 sortOrder를 인덱스 값으로 업데이트
  await Promise.all(
    orderedIds.map((id, index) =>
      db.update(pageBlocks)
        .set({ sortOrder: index, updatedAt: new Date() })
        .where(eq(pageBlocks.id, id))
    )
  );
}
