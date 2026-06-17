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

export type MenuReadAccess = "guest" | "member";

type ReadableMenuLeaf = {
  allowGuest: boolean;
  allowMember: boolean;
};

function canReadMenuLeaf(row: ReadableMenuLeaf, access: MenuReadAccess) {
  return access === "member" ? row.allowMember : row.allowGuest;
}

// ─── 메뉴 조회 ────────────────────────────────────────────────────────────────

/**
 * 홈페이지 GNB에 표시할 메뉴 조회
 * - isVisible=true인 1단 메뉴와 하위 2단, 3단 메뉴를 포함합니다.
 */
export async function getVisibleMenus(access: MenuReadAccess = "guest") {
  const db = await getDb();
  if (!db) return [];
  const [menuList, visibleItems, visibleSubItems] = await Promise.all([
    db.select().from(menus)
      .where(eq(menus.isVisible, true))
      .orderBy(asc(menus.sortOrder)),
    db.select().from(menuItems)
      .where(eq(menuItems.isVisible, true))
      .orderBy(asc(menuItems.sortOrder)),
    db.select().from(menuSubItems)
      .where(eq(menuSubItems.isVisible, true))
      .orderBy(asc(menuSubItems.sortOrder)),
  ]);

  const subItemsByItemId = new Map<number, typeof visibleSubItems>();
  for (const subItem of visibleSubItems) {
    const list = subItemsByItemId.get(subItem.menuItemId) ?? [];
    list.push(subItem);
    subItemsByItemId.set(subItem.menuItemId, list);
  }

  const itemsByMenuId = new Map<
    number,
    Array<(typeof visibleItems)[number] & { subItems: typeof visibleSubItems }>
  >();
  for (const item of visibleItems) {
    const subItems = subItemsByItemId.get(item.id) ?? [];
    const readableSubItems = subItems.filter((subItem) => canReadMenuLeaf(subItem, access));
    if (subItems.length > 0 && readableSubItems.length === 0) continue;
    if (subItems.length === 0 && !canReadMenuLeaf(item, access)) continue;

    const list = itemsByMenuId.get(item.menuId) ?? [];
    list.push({ ...item, subItems: readableSubItems });
    itemsByMenuId.set(item.menuId, list);
  }

  return menuList.map(menu => ({
    ...menu,
    items: itemsByMenuId.get(menu.id) ?? [],
  })).filter(menu => menu.items.length > 0 || menu.href);
}

/**
 * 관리자용 전체 메뉴 조회 (비공개 포함)
 */
export async function getAllMenus() {
  const db = await getDb();
  if (!db) return [];
  const [menuList, itemList, subItemList] = await Promise.all([
    db.select().from(menus).orderBy(asc(menus.sortOrder)),
    db.select().from(menuItems).orderBy(asc(menuItems.sortOrder)),
    db.select().from(menuSubItems).orderBy(asc(menuSubItems.sortOrder)),
  ]);

  const subItemsByItemId = new Map<number, typeof subItemList>();
  for (const subItem of subItemList) {
    const list = subItemsByItemId.get(subItem.menuItemId) ?? [];
    list.push(subItem);
    subItemsByItemId.set(subItem.menuItemId, list);
  }

  const itemsByMenuId = new Map<
    number,
    Array<(typeof itemList)[number] & { subItems: typeof subItemList }>
  >();
  for (const item of itemList) {
    const list = itemsByMenuId.get(item.menuId) ?? [];
    list.push({ ...item, subItems: subItemsByItemId.get(item.id) ?? [] });
    itemsByMenuId.set(item.menuId, list);
  }

  return menuList.map(menu => ({
    ...menu,
    items: itemsByMenuId.get(menu.id) ?? [],
  }));
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

/** 2단 메뉴 단건 조회 (공개용 — 상위 메뉴와 본인이 모두 공개된 경우만) */
export async function getVisibleMenuItemById(id: number, access: MenuReadAccess = "guest") {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(menuItems)
    .where(and(eq(menuItems.id, id), eq(menuItems.isVisible, true)))
    .limit(1);
  const item = rows[0];
  if (!item) return null;
  if (!canReadMenuLeaf(item, access)) return null;

  const parentRows = await db.select().from(menus)
    .where(and(eq(menus.id, item.menuId), eq(menus.isVisible, true)))
    .limit(1);
  return parentRows[0] ? item : null;
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

/** 3단 메뉴 단건 조회 (공개용 — 1/2/3단이 모두 공개된 경우만) */
export async function getVisibleMenuSubItemById(id: number, access: MenuReadAccess = "guest") {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(menuSubItems)
    .where(and(eq(menuSubItems.id, id), eq(menuSubItems.isVisible, true)))
    .limit(1);
  const subItem = rows[0];
  if (!subItem) return null;
  if (!canReadMenuLeaf(subItem, access)) return null;

  const itemRows = await db.select().from(menuItems)
    .where(and(eq(menuItems.id, subItem.menuItemId), eq(menuItems.isVisible, true)))
    .limit(1);
  const item = itemRows[0];
  if (!item) return null;

  const parentRows = await db.select().from(menus)
    .where(and(eq(menus.id, item.menuId), eq(menus.isVisible, true)))
    .limit(1);
  return parentRows[0] ? subItem : null;
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
 * href로 2단 메뉴 조회 (공개용 — 상위 메뉴와 본인이 모두 공개된 경우만)
 */
export async function getVisibleMenuItemByHref(href: string, access: MenuReadAccess = "guest") {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(menuItems)
    .where(and(eq(menuItems.href, href), eq(menuItems.isVisible, true)))
    .limit(1);
  const item = rows[0];
  if (!item) return null;
  if (!canReadMenuLeaf(item, access)) return null;

  const parentRows = await db.select().from(menus)
    .where(and(eq(menus.id, item.menuId), eq(menus.isVisible, true)))
    .limit(1);
  return parentRows[0] ? item : null;
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

/**
 * href로 3단 메뉴 조회 (공개용 — 1/2/3단이 모두 공개된 경우만)
 */
export async function getVisibleMenuSubItemByHref(href: string, access: MenuReadAccess = "guest") {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(menuSubItems)
    .where(and(eq(menuSubItems.href, href), eq(menuSubItems.isVisible, true)))
    .limit(1);
  const subItem = rows[0];
  if (!subItem) return null;
  if (!canReadMenuLeaf(subItem, access)) return null;

  const itemRows = await db.select().from(menuItems)
    .where(and(eq(menuItems.id, subItem.menuItemId), eq(menuItems.isVisible, true)))
    .limit(1);
  const item = itemRows[0];
  if (!item) return null;

  const parentRows = await db.select().from(menus)
    .where(and(eq(menus.id, item.menuId), eq(menus.isVisible, true)))
    .limit(1);
  return parentRows[0] ? subItem : null;
}
