/**
 * 메뉴 DB 함수 (server/db/menu.ts)
 * ─────────────────────────────────────────────────────────────────────────────
 * 담당 기능:
 *   - getVisibleMenus: 홈페이지 GNB에 표시할 메뉴 조회
 *   - getAllMenus: 관리자용 전체 메뉴 조회 (1단+2단+3단)
 *   - createMenu / updateMenu / deleteMenu: 1단 메뉴 CRUD
 *   - createMenuItem / updateMenuItem / deleteMenuItem: 2단 메뉴 CRUD
 *   - createMenuSubItem / updateMenuSubItem / deleteMenuSubItem: 3단 메뉴 CRUD
 *   - reorderMenus / reorderMenuItems / reorderMenuSubItems: 순서 변경
 *   - getMenuItemByHref / getMenuSubItemByHref: href로 메뉴 조회 (페이지 연결용)
 */

import { eq, asc, and } from "drizzle-orm";
import { menus, menuItems, menuSubItems } from "../../drizzle/schema";
import { getDb } from "./connection";

// ─── 메뉴 조회 ────────────────────────────────────────────────────────────────

/**
 * 홈페이지 GNB에 표시할 메뉴 조회
 * - isVisible=true인 1단 메뉴와 하위 2단, 3단 메뉴를 포함합니다.
 */
export async function getVisibleMenus() {
  const db = await getDb();
  if (!db) return [];
  const menuList = await db.select().from(menus)
    .where(eq(menus.isVisible, true))
    .orderBy(asc(menus.sortOrder));
  const result = await Promise.all(menuList.map(async (menu) => {
    // 2단 메뉴도 isVisible=true인 것만 가져옵니다
    const items = await db.select().from(menuItems)
      .where(and(eq(menuItems.menuId, menu.id), eq(menuItems.isVisible, true)))
      .orderBy(asc(menuItems.sortOrder));
    const itemsWithSubs = await Promise.all(items.map(async (item) => {
      // 3단 메뉴도 isVisible=true인 것만 가져옵니다
      const subItems = await db.select().from(menuSubItems)
        .where(and(eq(menuSubItems.menuItemId, item.id), eq(menuSubItems.isVisible, true)))
        .orderBy(asc(menuSubItems.sortOrder));
      return { ...item, subItems };
    }));
    return { ...menu, items: itemsWithSubs };
  }));
  return result;
}

/**
 * 관리자용 전체 메뉴 조회 (비공개 포함)
 */
export async function getAllMenus() {
  const db = await getDb();
  if (!db) return [];
  const menuList = await db.select().from(menus).orderBy(asc(menus.sortOrder));

  const result = await Promise.all(menuList.map(async (menu) => {
    const items = await db.select().from(menuItems)
      .where(eq(menuItems.menuId, menu.id))
      .orderBy(asc(menuItems.sortOrder));

    const itemsWithSubs = await Promise.all(items.map(async (item) => {
      const subItems = await db.select().from(menuSubItems)
        .where(eq(menuSubItems.menuItemId, item.id))
        .orderBy(asc(menuSubItems.sortOrder));
      return { ...item, subItems };
    }));

    return { ...menu, items: itemsWithSubs };
  }));

  return result;
}

// ─── 1단 메뉴 CRUD ────────────────────────────────────────────────────────────

/** 1단 메뉴 생성 */
export async function createMenu(data: { label: string; href?: string | null; sortOrder?: number }) {
  const db = await getDb();
  if (!db) return null;
  const [result] = await db.insert(menus).values({
    label: data.label,
    href: data.href ?? null,
    sortOrder: data.sortOrder ?? 0,
  }).$returningId();
  return result?.id ?? null;
}

/** 1단 메뉴 수정 */
export async function updateMenu(id: number, data: Partial<typeof menus.$inferInsert>) {
  const db = await getDb();
  if (!db) return;
  await db.update(menus).set(data).where(eq(menus.id, id));
}

/** 1단 메뉴 삭제 (하위 2단, 3단 메뉴 포함) */
export async function deleteMenu(id: number) {
  const db = await getDb();
  if (!db) return;
  // 2단 메뉴 조회 후 각각의 3단 메뉴 삭제
  const items = await db.select().from(menuItems).where(eq(menuItems.menuId, id));
  for (const item of items) {
    await db.delete(menuSubItems).where(eq(menuSubItems.menuItemId, item.id));
  }
  await db.delete(menuItems).where(eq(menuItems.menuId, id));
  await db.delete(menus).where(eq(menus.id, id));
}

// ─── 2단 메뉴 CRUD ────────────────────────────────────────────────────────────

/** 2단 메뉴 단건 조회 */
export async function getMenuItemById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(menuItems).where(eq(menuItems.id, id)).limit(1);
  return rows[0] ?? null;
}

/** 2단 메뉴 생성 */
export async function createMenuItem(data: typeof menuItems.$inferInsert) {
  const db = await getDb();
  if (!db) return null;
  const [result] = await db.insert(menuItems).values(data).$returningId();
  return result?.id ?? null;
}

/** 2단 메뉴 수정 */
export async function updateMenuItem(id: number, data: Partial<typeof menuItems.$inferInsert>) {
  const db = await getDb();
  if (!db) return;
  await db.update(menuItems).set(data).where(eq(menuItems.id, id));
}

/** 2단 메뉴 삭제 */
export async function deleteMenuItem(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(menuItems).where(eq(menuItems.id, id));
}

/** 2단 메뉴 + 하위 3단 메뉴 함께 삭제 */
export async function deleteMenuItemWithSubs(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(menuSubItems).where(eq(menuSubItems.menuItemId, id));
  await db.delete(menuItems).where(eq(menuItems.id, id));
}

// ─── 3단 메뉴 CRUD ────────────────────────────────────────────────────────────

/** 3단 메뉴 단건 조회 */
export async function getMenuSubItemById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(menuSubItems).where(eq(menuSubItems.id, id)).limit(1);
  return rows[0] ?? null;
}

/** 3단 메뉴 생성 */
export async function createMenuSubItem(data: typeof menuSubItems.$inferInsert) {
  const db = await getDb();
  if (!db) return null;
  const [result] = await db.insert(menuSubItems).values(data).$returningId();
  return result?.id ?? null;
}

/** 3단 메뉴 수정 */
export async function updateMenuSubItem(id: number, data: Partial<typeof menuSubItems.$inferInsert>) {
  const db = await getDb();
  if (!db) return;
  await db.update(menuSubItems).set(data).where(eq(menuSubItems.id, id));
}

/** 3단 메뉴 삭제 */
export async function deleteMenuSubItem(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(menuSubItems).where(eq(menuSubItems.id, id));
}

// ─── 순서 변경 ────────────────────────────────────────────────────────────────

/** 1단 메뉴 순서 일괄 변경 */
export async function reorderMenus(items: { id: number; sortOrder: number }[]) {
  const db = await getDb();
  if (!db) return;
  await Promise.all(
    items.map(item => db.update(menus).set({ sortOrder: item.sortOrder }).where(eq(menus.id, item.id)))
  );
}

/** 2단 메뉴 순서 일괄 변경 */
export async function reorderMenuItems(items: { id: number; sortOrder: number }[]) {
  const db = await getDb();
  if (!db) return;
  await Promise.all(
    items.map(item => db.update(menuItems).set({ sortOrder: item.sortOrder }).where(eq(menuItems.id, item.id)))
  );
}

/** 3단 메뉴 순서 일괄 변경 */
export async function reorderMenuSubItems(items: { id: number; sortOrder: number }[]) {
  const db = await getDb();
  if (!db) return;
  await Promise.all(
    items.map(item => db.update(menuSubItems).set({ sortOrder: item.sortOrder }).where(eq(menuSubItems.id, item.id)))
  );
}

// ─── href 기반 메뉴 조회 (페이지 연결용) ─────────────────────────────────────

/**
 * href로 2단 메뉴 조회
 * - 예배영상 페이지에서 해당 메뉴의 playlistId를 찾을 때 사용합니다.
 */
export async function getMenuItemByHref(href: string) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(menuItems).where(eq(menuItems.href, href)).limit(1);
  return rows[0] ?? null;
}

/**
 * href로 3단 메뉴 조회
 * - 예배영상 서브 페이지에서 해당 메뉴의 playlistId를 찾을 때 사용합니다.
 */
export async function getMenuSubItemByHref(href: string) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(menuSubItems).where(eq(menuSubItems.href, href)).limit(1);
  return rows[0] ?? null;
}
