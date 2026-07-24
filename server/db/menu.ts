/**
 * 메뉴 DB 함수 (server/db/menu.ts)
 * ─────────────────────────────────────────────────────────────────────────────
 * 담당 기능:
 *   - getVisibleMenus: 홈페이지 GNB에 표시할 메뉴 조회
 *   - getAllMenus: 관리자용 전체 메뉴 조회 (1단+2단+3단)
 *   - getMenusForReadAccessSettings: 메뉴 읽기 권한 설정용 공개 메뉴 조회
 *   - createMenu / updateMenu / deleteMenu: 1단 메뉴 CRUD
 *   - createMenuItem / updateMenuItem / deleteMenuItem: 2단 메뉴 CRUD
 *   - createMenuSubItem / updateMenuSubItem / deleteMenuSubItem: 3단 메뉴 CRUD
 *   - reorderMenus / reorderMenuItems / reorderMenuSubItems: 순서 변경
 *   - getMenuItemByHref / getMenuSubItemByHref: href로 메뉴 조회 (페이지 연결용)
 */

import { eq, asc, and, sql } from "drizzle-orm";
import { SITE_HOSTNAMES, isSiteHostname } from "@shared/siteHosts";
import {
  WORSHIP_SCHEDULE_HREF,
  WORSHIP_SCHEDULE_LEGACY_BETA_HREF,
} from "@shared/worshipSchedule";
import { menus, menuItems, menuSubItems } from "../../drizzle/schema";
import { getDb } from "./connection";

export type MenuReadAccess = "guest" | "member";

export type MenuParentMoveOrderRow = {
  id: number;
  sortOrder: number;
};

/**
 * 부모가 바뀌는 메뉴 이동의 저장 순서를 계산합니다.
 *
 * 기존 sortOrder가 비연속이거나 중복이어도 sortOrder, id 순으로 안정적으로
 * 정렬한 뒤 원본/대상 양쪽을 1..N으로 다시 매깁니다. 이동 항목은 대상의
 * 마지막에 배치하며, 호출자가 전달한 배열은 변경하지 않습니다.
 */
export function buildMenuParentMoveOrder(
  sourceRows: readonly MenuParentMoveOrderRow[],
  targetRows: readonly MenuParentMoveOrderRow[],
  movedId: number,
) {
  const moved = sourceRows.find((row) => row.id === movedId);
  if (!moved) return null;

  const byStoredOrderThenId = (a: MenuParentMoveOrderRow, b: MenuParentMoveOrderRow) =>
    a.sortOrder - b.sortOrder || a.id - b.id;
  const normalize = (rows: readonly MenuParentMoveOrderRow[]) =>
    [...rows]
      .sort(byStoredOrderThenId)
      .map((row, index) => ({ id: row.id, sortOrder: index + 1 }));

  const source = normalize(sourceRows.filter((row) => row.id !== movedId));
  const normalizedTarget = normalize(targetRows.filter((row) => row.id !== movedId));
  const target = [
    ...normalizedTarget,
    { id: moved.id, sortOrder: normalizedTarget.length + 1 },
  ];

  return { source, target };
}

type ReadableMenuLeaf = {
  allowGuest: boolean;
  allowMember: boolean;
  href?: string | null;
};

function canReadMenuLeaf(row: ReadableMenuLeaf, access: MenuReadAccess) {
  return access === "member" ? row.allowMember : row.allowGuest;
}

function getEffectiveLeafAccess(...rows: ReadableMenuLeaf[]) {
  return {
    allowGuest: rows.every(row => row.allowGuest),
    allowMember: rows.every(row => row.allowMember),
  };
}

function getTopMenuAccessForChild(menu: ReadableMenuLeaf) {
  return menu;
}

function shouldShowMenuLeaf(row: ReadableMenuLeaf) {
  return row.allowGuest || row.allowMember;
}

const MENU_HREF_ALIASES: Record<string, string[]> = {
  "/about/pastor/books": [
    "/page/교회소개-담임목사-저서",
    "/page/교회소개-담임목사-소개-담임목사저서",
    "/page/교회소개-담임목사-소개-담임목사-저서",
    "/page/교회소개-담임목사소개-담임목사저서",
    "/page/교회소개-담임목사소개-담임목사-저서",
  ],
  "/about/history": [
    "/page/교회소개-교회역사",
    "/page/교회소개-교회-역사",
    "/page/교회소개-교회연혁",
    "/page/교회소개-교회-연혁",
  ],
  "/about/staff": ["/page/교회소개-섬기는-분"],
  "/about/staff/associate": ["/page/교회소개-부교역자"],
  "/community/testimony": [
    "/page/커뮤니티-생선간증",
    "/page/커뮤니티-생선-간증",
    "/page/커뮤니티-은혜의간증",
    "/page/커뮤니티-은혜의-간증",
  ],
  "/mission": [
    "/page/커뮤니티-선교소식",
    "/page/커뮤니티-선교-소식",
    "/page/사역선교-선교소식",
    "/page/사역선교-선교-소식",
    "/page/선교-선교소식",
    "/page/선교-선교-소식",
  ],
  "/worship/bulletin": [
    "/page/행정지원-주보-주보보기",
    "/page/행정지원-주보보기",
  ],
  "/support/bulletin-ad": [
    "/page/행정지원-주보-주보광고신청",
    "/page/행정지원-주보광고신청",
    "/page/행정지원-주보광고",
  ],
  "/support/subtitle": [
    "/page/행정지원-주보-자막신청",
    "/page/행정지원-자막신청",
    "/page/행정지원-자막",
  ],
  "/support/tour": [
    "/page/행정지원-탐방신청",
    "/page/행정지원-탐방",
  ],
  "/facility": [
    "/page/시설사용예약",
    "/page/시설-사용-예약",
    "/page/시설사용-예약",
  ],
};

function decodeHrefCandidate(href: string) {
  try {
    return decodeURIComponent(href);
  } catch {
    return href;
  }
}

function normalizeSameOriginHref(href: string) {
  const trimmed = href.trim();
  if (!/^https?:\/\//i.test(trimmed)) return trimmed;
  try {
    const url = new URL(trimmed);
    if (isSiteHostname(url.hostname)) {
      return `${url.pathname}${url.search}${url.hash}`;
    }
  } catch {
    return trimmed;
  }
  return trimmed;
}

function normalizeMenuLabel(label: string | null | undefined) {
  return (label ?? "").replace(/\s+/g, "");
}

const CHURCH_INTRO_LABEL = "\uAD50\uD68C\uC18C\uAC1C";
const WORSHIP_GUIDE_LABEL = "\uC608\uBC30\uC548\uB0B4";
const WORSHIP_GUIDE_LEGACY_HREF = "/page/\uAD50\uD68C\uC18C\uAC1C-\uC608\uBC30-\uC548\uB0B4";
const WORSHIP_GUIDE_HREFS = new Set([
  WORSHIP_SCHEDULE_HREF,
  WORSHIP_SCHEDULE_LEGACY_BETA_HREF,
  WORSHIP_GUIDE_LEGACY_HREF,
  "/page/\uAD50\uD68C\uC18C\uAC1C-\uC608\uBC30\uC548\uB0B4",
]);

export function getCanonicalPublicMenuHref(
  label: string | null | undefined,
  href: string | null | undefined,
  parentLabel?: string | null
) {
  const normalizedHref = href
    ? normalizeSameOriginHref(decodeHrefCandidate(href.trim()))
    : "";
  const isChurchIntroWorshipGuide =
    normalizeMenuLabel(parentLabel) === CHURCH_INTRO_LABEL &&
    normalizeMenuLabel(label) === WORSHIP_GUIDE_LABEL;
  if (
    isChurchIntroWorshipGuide ||
    (
      normalizeMenuLabel(label) === WORSHIP_GUIDE_LABEL &&
      WORSHIP_GUIDE_HREFS.has(normalizedHref)
    )
  ) {
    return WORSHIP_SCHEDULE_HREF;
  }
  return href ?? null;
}

function canonicalizePublicMenuNode<T extends { label: string; href: string | null }>(
  node: T,
  parentLabel?: string | null
): T {
  const href = getCanonicalPublicMenuHref(node.label, node.href, parentLabel);
  return href === node.href ? node : { ...node, href };
}

function getMenuHrefCandidates(href: string) {
  const decodedHref = normalizeSameOriginHref(decodeHrefCandidate(href.trim()));
  const candidates = [
    decodedHref,
    ...SITE_HOSTNAMES.map(hostname => `https://${hostname}${decodedHref}`),
    ...(MENU_HREF_ALIASES[decodedHref] ?? []),
  ];
  for (const [canonicalHref, aliasHrefs] of Object.entries(MENU_HREF_ALIASES)) {
    if (canonicalHref === decodedHref || aliasHrefs.includes(decodedHref)) {
      candidates.push(canonicalHref, ...aliasHrefs);
    }
  }
  return Array.from(new Set(candidates.filter(Boolean)));
}

function isWorshipGuideHref(href: string) {
  const decodedHref = normalizeSameOriginHref(decodeHrefCandidate(href.trim()));
  return WORSHIP_GUIDE_HREFS.has(decodedHref);
}

async function findWorshipGuideMenuItem(visibleOnly = false) {
  const db = await getDb();
  if (!db) return null;

  const menuList = await db.select().from(menus).orderBy(asc(menus.sortOrder));
  const parentIds = new Set(
    menuList
      .filter(menu =>
        normalizeMenuLabel(menu.label) === CHURCH_INTRO_LABEL &&
        (!visibleOnly || menu.isVisible)
      )
      .map(menu => menu.id)
  );
  if (parentIds.size === 0) return null;

  const itemList = await db.select().from(menuItems).orderBy(asc(menuItems.sortOrder));
  const item = itemList.find(row =>
    parentIds.has(row.menuId) &&
    normalizeMenuLabel(row.label) === WORSHIP_GUIDE_LABEL &&
    (!visibleOnly || row.isVisible)
  );
  if (!item) return null;

  const parent = menuList.find(menu => menu.id === item.menuId) ?? null;
  if (!parent) return null;

  return { item, parent };
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
    Array<(typeof visibleItems)[number] & {
      canRead: boolean;
      subItems: Array<(typeof visibleSubItems)[number] & { canRead: boolean }>;
    }>
  >();
  for (const item of visibleItems) {
    const parentMenu = menuList.find((menu) => menu.id === item.menuId);
    if (!parentMenu) continue;
    const itemAccess = getEffectiveLeafAccess(getTopMenuAccessForChild(parentMenu), item);
    if (!canReadMenuLeaf(itemAccess, access)) continue;

    const subItems = (subItemsByItemId.get(item.id) ?? []).filter((subItem) =>
      canReadMenuLeaf(getEffectiveLeafAccess(getTopMenuAccessForChild(parentMenu), item, subItem), access)
    );
    const visibleSubItemsWithAccess = subItems.map((subItem) => ({
      ...canonicalizePublicMenuNode(subItem),
      canRead: true,
    }));

    const list = itemsByMenuId.get(item.menuId) ?? [];
    list.push({
      ...canonicalizePublicMenuNode(item, parentMenu.label),
      canRead: true,
      subItems: visibleSubItemsWithAccess,
    });
    itemsByMenuId.set(item.menuId, list);
  }

  return menuList.map(menu => ({
    ...canonicalizePublicMenuNode(menu),
    items: itemsByMenuId.get(menu.id) ?? [],
  })).filter(menu => menu.items.length > 0 || menu.href);
}

/**
 * GNB/사이트맵 표시용 메뉴 조회
 * - 성도공개 메뉴도 노출하고, 실제 진입 시 MenuAccessGate에서 로그인 안내를 보여줍니다.
 * - 읽기 권한이 숨김(allowGuest=false, allowMember=false)인 메뉴는 표시하지 않습니다.
 */
export async function getNavigationMenus() {
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
    Array<(typeof visibleItems)[number] & {
      subItems: typeof visibleSubItems;
    }>
  >();
  for (const item of visibleItems) {
    const parentMenu = menuList.find((menu) => menu.id === item.menuId);
    if (!parentMenu) continue;
    const itemAccess = getEffectiveLeafAccess(getTopMenuAccessForChild(parentMenu), item);
    const subItems = (subItemsByItemId.get(item.id) ?? []).filter((subItem) =>
      shouldShowMenuLeaf(getEffectiveLeafAccess(getTopMenuAccessForChild(parentMenu), item, subItem))
    );

    if (!shouldShowMenuLeaf(itemAccess) && subItems.length === 0) continue;

    const list = itemsByMenuId.get(item.menuId) ?? [];
    list.push({
      ...canonicalizePublicMenuNode(item, parentMenu.label),
      subItems: subItems.map((subItem) => canonicalizePublicMenuNode(subItem)),
    });
    itemsByMenuId.set(item.menuId, list);
  }

  return menuList.map(menu => ({
    ...canonicalizePublicMenuNode(menu),
    items: itemsByMenuId.get(menu.id) ?? [],
  })).filter(menu => shouldShowMenuLeaf(menu) && (menu.items.length > 0 || menu.href));
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
    const parentMenu = menuList.find((menu) => menu.id === item.menuId);
    const list = itemsByMenuId.get(item.menuId) ?? [];
    list.push({
      ...canonicalizePublicMenuNode(item, parentMenu?.label),
      subItems: (subItemsByItemId.get(item.id) ?? [])
        .map((subItem) => canonicalizePublicMenuNode(subItem)),
    });
    itemsByMenuId.set(item.menuId, list);
  }

  return menuList.map(menu => ({
    ...canonicalizePublicMenuNode(menu),
    items: itemsByMenuId.get(menu.id) ?? [],
  }));
}

/**
 * 관리자 메뉴 읽기 권한 설정용 메뉴 조회
 * - 메뉴편집에서 숨김 처리한 1/2/3단 메뉴는 제외합니다.
 * - 권한값(allowGuest/allowMember)은 필터링하지 않고 그대로 내려보내 숨김 해제 후에도 유지됩니다.
 */
function isVehicleReservationAccessHref(href: string | null | undefined) {
  return href === "/support/vehicle" ||
    href === "/admin/vehicle" ||
    Boolean(href?.startsWith("/support/vehicle/"));
}

export async function getMenusForReadAccessSettings() {
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
    if (isVehicleReservationAccessHref(subItem.href)) continue;
    const list = subItemsByItemId.get(subItem.menuItemId) ?? [];
    list.push(subItem);
    subItemsByItemId.set(subItem.menuItemId, list);
  }

  const itemsByMenuId = new Map<
    number,
    Array<(typeof visibleItems)[number] & { subItems: typeof visibleSubItems }>
  >();
  for (const item of visibleItems) {
    if (isVehicleReservationAccessHref(item.href)) continue;
    const list = itemsByMenuId.get(item.menuId) ?? [];
    list.push({ ...item, subItems: subItemsByItemId.get(item.id) ?? [] });
    itemsByMenuId.set(item.menuId, list);
  }

  return menuList.map(menu => ({
    ...menu,
    items: itemsByMenuId.get(menu.id) ?? [],
  })).filter(menu => (menu.items.length > 0) || (menu.href && !isVehicleReservationAccessHref(menu.href)));
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

  const parentRows = await db.select().from(menus)
    .where(and(eq(menus.id, item.menuId), eq(menus.isVisible, true)))
    .limit(1);
  const parent = parentRows[0];
  if (!parent) return null;
  if (!canReadMenuLeaf(getEffectiveLeafAccess(getTopMenuAccessForChild(parent), item), access)) return null;
  return item;
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

/** 2단 메뉴를 다른 1단 메뉴 아래로 이동하고 양쪽 순서를 정리합니다. */
export async function moveMenuItemToMenu(id: number, targetMenuId: number) {
  const db = await getDb();
  if (!db) return null;

  return db.transaction(async (tx) => {
    // 메뉴 순서/부모 변경은 하나씩 처리해 동시 이동의 중복 순서를 막습니다.
    await tx.execute(sql`SELECT id FROM menus ORDER BY id LIMIT 1 FOR UPDATE`);
    const source = (await tx.select().from(menuItems).where(eq(menuItems.id, id)).limit(1))[0];
    const target = (await tx.select().from(menus).where(eq(menus.id, targetMenuId)).limit(1))[0];
    if (!source || !target) return null;
    if (source.menuId === targetMenuId) return { moved: false, fromMenuId: source.menuId, toMenuId: targetMenuId };

    const [sourceSiblings, targetSiblings] = await Promise.all([
      tx.select().from(menuItems).where(eq(menuItems.menuId, source.menuId)).orderBy(asc(menuItems.sortOrder)),
      tx.select().from(menuItems).where(eq(menuItems.menuId, targetMenuId)).orderBy(asc(menuItems.sortOrder)),
    ]);

    const moveOrder = buildMenuParentMoveOrder(sourceSiblings, targetSiblings, id);
    if (!moveOrder) return null;

    await Promise.all(
      [
        ...moveOrder.source.map((item) =>
          tx.update(menuItems).set({ sortOrder: item.sortOrder }).where(eq(menuItems.id, item.id))
        ),
        ...moveOrder.target.map((item) =>
          item.id === id
            ? tx.update(menuItems)
              .set({ menuId: targetMenuId, sortOrder: item.sortOrder })
              .where(eq(menuItems.id, item.id))
            : tx.update(menuItems).set({ sortOrder: item.sortOrder }).where(eq(menuItems.id, item.id))
        ),
      ]
    );

    return { moved: true, fromMenuId: source.menuId, toMenuId: targetMenuId };
  });
}

/** 2단 메뉴 읽기 권한 수정 가능 여부 확인 (메뉴편집 숨김 메뉴 방어) */
export async function canUpdateTopMenuReadAccess(id: number) {
  const db = await getDb();
  if (!db) return false;
  const rows = await db.select().from(menus)
    .where(and(eq(menus.id, id), eq(menus.isVisible, true)))
    .limit(1);
  return Boolean(rows[0]);
}

export async function canUpdateMenuItemReadAccess(id: number) {
  const db = await getDb();
  if (!db) return false;
  const rows = await db.select().from(menuItems)
    .where(and(eq(menuItems.id, id), eq(menuItems.isVisible, true)))
    .limit(1);
  const item = rows[0];
  if (!item) return false;

  const parentRows = await db.select().from(menus)
    .where(and(eq(menus.id, item.menuId), eq(menus.isVisible, true)))
    .limit(1);
  return Boolean(parentRows[0]);
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
  if (!canReadMenuLeaf(item, access)) return null;

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

/** 3단 메뉴를 다른 2단 메뉴 아래로 이동하고 양쪽 순서를 정리합니다. */
export async function moveMenuSubItemToItem(id: number, targetMenuItemId: number) {
  const db = await getDb();
  if (!db) return null;

  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT id FROM menus ORDER BY id LIMIT 1 FOR UPDATE`);
    const source = (await tx.select().from(menuSubItems).where(eq(menuSubItems.id, id)).limit(1))[0];
    const target = (await tx.select().from(menuItems).where(eq(menuItems.id, targetMenuItemId)).limit(1))[0];
    if (!source || !target) return null;
    if (source.menuItemId === targetMenuItemId) {
      return { moved: false, fromMenuItemId: source.menuItemId, toMenuItemId: targetMenuItemId };
    }

    const [sourceSiblings, targetSiblings] = await Promise.all([
      tx.select().from(menuSubItems).where(eq(menuSubItems.menuItemId, source.menuItemId)).orderBy(asc(menuSubItems.sortOrder)),
      tx.select().from(menuSubItems).where(eq(menuSubItems.menuItemId, targetMenuItemId)).orderBy(asc(menuSubItems.sortOrder)),
    ]);

    const moveOrder = buildMenuParentMoveOrder(sourceSiblings, targetSiblings, id);
    if (!moveOrder) return null;

    await Promise.all(
      [
        ...moveOrder.source.map((item) =>
          tx.update(menuSubItems).set({ sortOrder: item.sortOrder }).where(eq(menuSubItems.id, item.id))
        ),
        ...moveOrder.target.map((item) =>
          item.id === id
            ? tx.update(menuSubItems)
              .set({ menuItemId: targetMenuItemId, sortOrder: item.sortOrder })
              .where(eq(menuSubItems.id, item.id))
            : tx.update(menuSubItems).set({ sortOrder: item.sortOrder }).where(eq(menuSubItems.id, item.id))
        ),
      ]
    );

    return { moved: true, fromMenuItemId: source.menuItemId, toMenuItemId: targetMenuItemId };
  });
}

/** 3단 메뉴 읽기 권한 수정 가능 여부 확인 (부모 숨김 포함 방어) */
export async function canUpdateMenuSubItemReadAccess(id: number) {
  const db = await getDb();
  if (!db) return false;
  const rows = await db.select().from(menuSubItems)
    .where(and(eq(menuSubItems.id, id), eq(menuSubItems.isVisible, true)))
    .limit(1);
  const subItem = rows[0];
  if (!subItem) return false;

  const itemRows = await db.select().from(menuItems)
    .where(and(eq(menuItems.id, subItem.menuItemId), eq(menuItems.isVisible, true)))
    .limit(1);
  const item = itemRows[0];
  if (!item) return false;

  const parentRows = await db.select().from(menus)
    .where(and(eq(menus.id, item.menuId), eq(menus.isVisible, true)))
    .limit(1);
  return Boolean(parentRows[0]);
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
  await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT id FROM menus ORDER BY id LIMIT 1 FOR UPDATE`);
    await Promise.all(
      items.map(item => tx.update(menus).set({ sortOrder: item.sortOrder }).where(eq(menus.id, item.id)))
    );
  });
}

/** 2단 메뉴 순서 일괄 변경 */
export async function reorderMenuItems(items: { id: number; sortOrder: number }[]) {
  const db = await getDb();
  if (!db) return;
  await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT id FROM menus ORDER BY id LIMIT 1 FOR UPDATE`);
    await Promise.all(
      items.map(item => tx.update(menuItems).set({ sortOrder: item.sortOrder }).where(eq(menuItems.id, item.id)))
    );
  });
}

/** 3단 메뉴 순서 일괄 변경 */
export async function reorderMenuSubItems(items: { id: number; sortOrder: number }[]) {
  const db = await getDb();
  if (!db) return;
  await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT id FROM menus ORDER BY id LIMIT 1 FOR UPDATE`);
    await Promise.all(
      items.map(item => tx.update(menuSubItems).set({ sortOrder: item.sortOrder }).where(eq(menuSubItems.id, item.id)))
    );
  });
}

// ─── href 기반 메뉴 조회 (페이지 연결용) ─────────────────────────────────────

/**
 * href로 2단 메뉴 조회
 * - 예배영상 페이지에서 해당 메뉴의 playlistId를 찾을 때 사용합니다.
 */
export async function getMenuItemByHref(href: string) {
  const db = await getDb();
  if (!db) return null;
  for (const candidate of getMenuHrefCandidates(href)) {
    const rows = await db.select().from(menuItems).where(eq(menuItems.href, candidate)).limit(1);
    if (rows[0]) return rows[0];
  }
  if (isWorshipGuideHref(href)) {
    const match = await findWorshipGuideMenuItem();
    if (match) return match.item;
  }
  return null;
}

/**
 * href로 2단 메뉴 조회 (공개용 — 상위 메뉴와 본인이 모두 공개된 경우만)
 */
export async function getVisibleMenuItemByHref(href: string, access: MenuReadAccess = "guest") {
  const db = await getDb();
  if (!db) return null;
  let item: (typeof menuItems.$inferSelect) | undefined;
  let fallbackParent: (typeof menus.$inferSelect) | undefined;
  for (const candidate of getMenuHrefCandidates(href)) {
    const rows = await db.select().from(menuItems)
      .where(and(eq(menuItems.href, candidate), eq(menuItems.isVisible, true)))
      .limit(1);
    if (rows[0]) {
      item = rows[0];
      break;
    }
  }
  if (!item && isWorshipGuideHref(href)) {
    const match = await findWorshipGuideMenuItem(true);
    if (match) {
      item = match.item;
      fallbackParent = match.parent;
    }
  }
  if (!item) return null;

  const parent = fallbackParent ?? (await db.select().from(menus)
    .where(and(eq(menus.id, item.menuId), eq(menus.isVisible, true)))
    .limit(1))[0];
  if (!parent) return null;
  if (!canReadMenuLeaf(getEffectiveLeafAccess(getTopMenuAccessForChild(parent), item), access)) return null;
  return item;
}

/**
 * href로 3단 메뉴 조회
 * - 예배영상 서브 페이지에서 해당 메뉴의 playlistId를 찾을 때 사용합니다.
 */
export async function getMenuSubItemByHref(href: string) {
  const db = await getDb();
  if (!db) return null;
  for (const candidate of getMenuHrefCandidates(href)) {
    const rows = await db.select().from(menuSubItems).where(eq(menuSubItems.href, candidate)).limit(1);
    if (rows[0]) return rows[0];
  }
  return null;
}

/**
 * href로 3단 메뉴 조회 (공개용 — 1/2/3단이 모두 공개된 경우만)
 */
export async function getVisibleMenuSubItemByHref(href: string, access: MenuReadAccess = "guest") {
  const db = await getDb();
  if (!db) return null;
  let subItem: (typeof menuSubItems.$inferSelect) | undefined;
  for (const candidate of getMenuHrefCandidates(href)) {
    const rows = await db.select().from(menuSubItems)
      .where(and(eq(menuSubItems.href, candidate), eq(menuSubItems.isVisible, true)))
      .limit(1);
    if (rows[0]) {
      subItem = rows[0];
      break;
    }
  }
  if (!subItem) return null;

  const itemRows = await db.select().from(menuItems)
    .where(and(eq(menuItems.id, subItem.menuItemId), eq(menuItems.isVisible, true)))
    .limit(1);
  const item = itemRows[0];
  if (!item) return null;

  const parentRows = await db.select().from(menus)
    .where(and(eq(menus.id, item.menuId), eq(menus.isVisible, true)))
    .limit(1);
  const parent = parentRows[0];
  if (!parent) return null;
  if (!canReadMenuLeaf(getEffectiveLeafAccess(getTopMenuAccessForChild(parent), item, subItem), access)) return null;
  return subItem;
}

export async function getMenuAccessByHref(href: string, access: MenuReadAccess = "guest") {
  const db = await getDb();
  if (!db) return null;

  for (const candidate of getMenuHrefCandidates(href)) {
    const menuRows = await db.select().from(menus)
      .where(eq(menus.href, candidate));
    for (const menu of menuRows) {
      if (!menu.isVisible) continue;
      return {
        kind: "menu" as const,
        id: menu.id,
        label: menu.label,
        href: menu.href,
        topMenu: {
          id: menu.id,
          label: menu.label,
          href: menu.href,
        },
        allowGuest: menu.allowGuest,
        allowMember: menu.allowMember,
        isReadable: canReadMenuLeaf(menu, access),
      };
    }

    const itemRows = await db.select().from(menuItems)
      .where(eq(menuItems.href, candidate));
    for (const item of itemRows) {
      const parentRows = await db.select().from(menus)
        .where(eq(menus.id, item.menuId))
        .limit(1);
      const parent = parentRows[0];
      if (!parent) continue;
      const isVisible = Boolean(parent.isVisible) && Boolean(item.isVisible);
      if (!isVisible) continue;

      return {
        kind: "item" as const,
        id: item.id,
        label: item.label,
        href: item.href,
        topMenu: {
          id: parent.id,
          label: parent.label,
          href: parent.href,
        },
        allowGuest: getEffectiveLeafAccess(getTopMenuAccessForChild(parent), item).allowGuest,
        allowMember: getEffectiveLeafAccess(getTopMenuAccessForChild(parent), item).allowMember,
        isReadable: canReadMenuLeaf(getEffectiveLeafAccess(getTopMenuAccessForChild(parent), item), access),
      };
    }

    const subItemRows = await db.select().from(menuSubItems)
      .where(eq(menuSubItems.href, candidate));
    for (const subItem of subItemRows) {

      const itemRowsForSub = await db.select().from(menuItems)
        .where(eq(menuItems.id, subItem.menuItemId))
        .limit(1);
      const parentItem = itemRowsForSub[0];
      if (!parentItem) continue;

      const parentRows = await db.select().from(menus)
        .where(eq(menus.id, parentItem.menuId))
        .limit(1);
      const parent = parentRows[0];
      if (!parent) continue;

      const effectiveAccess = getEffectiveLeafAccess(getTopMenuAccessForChild(parent), parentItem, subItem);
      const isVisible = Boolean(parent.isVisible) && Boolean(parentItem.isVisible) && Boolean(subItem.isVisible);
      if (!isVisible) continue;
      return {
        kind: "subItem" as const,
        id: subItem.id,
        label: subItem.label,
        href: subItem.href,
        topMenu: {
          id: parent.id,
          label: parent.label,
          href: parent.href,
        },
        parentItem: {
          id: parentItem.id,
          label: parentItem.label,
          href: parentItem.href,
        },
        allowGuest: effectiveAccess.allowGuest,
        allowMember: effectiveAccess.allowMember,
        isReadable: canReadMenuLeaf(effectiveAccess, access),
      };
    }
  }

  if (isWorshipGuideHref(href)) {
    const match = await findWorshipGuideMenuItem(true);
    if (match) {
      const { item, parent } = match;
      const effectiveAccess = getEffectiveLeafAccess(getTopMenuAccessForChild(parent), item);
      return {
        kind: "item" as const,
        id: item.id,
        label: item.label,
        href: WORSHIP_SCHEDULE_HREF,
        topMenu: {
          id: parent.id,
          label: parent.label,
          href: parent.href,
        },
        allowGuest: effectiveAccess.allowGuest,
        allowMember: effectiveAccess.allowMember,
        isReadable: canReadMenuLeaf(effectiveAccess, access),
      };
    }
  }

  return null;
}

export async function getMenuAccessById(
  kind: "menu" | "item" | "subItem",
  id: number,
  access: MenuReadAccess = "guest"
) {
  const db = await getDb();
  if (!db) return null;

  if (kind === "menu") {
    const rows = await db.select().from(menus)
      .where(eq(menus.id, id))
      .limit(1);
    const menu = rows[0];
    if (!menu) return null;

    return {
      kind: "menu" as const,
      id: menu.id,
      label: menu.label,
      href: menu.href,
      topMenu: {
        id: menu.id,
        label: menu.label,
        href: menu.href,
      },
      allowGuest: menu.allowGuest,
      allowMember: menu.allowMember,
      isReadable: Boolean(menu.isVisible) && canReadMenuLeaf(menu, access),
    };
  }

  if (kind === "item") {
    const rows = await db.select().from(menuItems)
      .where(eq(menuItems.id, id))
      .limit(1);
    const item = rows[0];
    if (!item) return null;

    const parentRows = await db.select().from(menus)
      .where(eq(menus.id, item.menuId))
      .limit(1);
    const parent = parentRows[0];
    if (!parent) return null;
    const isVisible = Boolean(parent.isVisible) && Boolean(item.isVisible);

    return {
      kind: "item" as const,
      id: item.id,
      label: item.label,
      href: item.href,
      topMenu: {
        id: parent.id,
        label: parent.label,
        href: parent.href,
      },
      allowGuest: getEffectiveLeafAccess(getTopMenuAccessForChild(parent), item).allowGuest,
      allowMember: getEffectiveLeafAccess(getTopMenuAccessForChild(parent), item).allowMember,
      isReadable: isVisible && canReadMenuLeaf(getEffectiveLeafAccess(getTopMenuAccessForChild(parent), item), access),
    };
  }

  const rows = await db.select().from(menuSubItems)
    .where(eq(menuSubItems.id, id))
    .limit(1);
  const subItem = rows[0];
  if (!subItem) return null;

  const itemRows = await db.select().from(menuItems)
    .where(eq(menuItems.id, subItem.menuItemId))
    .limit(1);
  const parentItem = itemRows[0];
  if (!parentItem) return null;

  const parentRows = await db.select().from(menus)
    .where(eq(menus.id, parentItem.menuId))
    .limit(1);
  const parent = parentRows[0];
  if (!parent) return null;

  const effectiveAccess = getEffectiveLeafAccess(getTopMenuAccessForChild(parent), parentItem, subItem);
  const isVisible = Boolean(parent.isVisible) && Boolean(parentItem.isVisible) && Boolean(subItem.isVisible);
  return {
    kind: "subItem" as const,
    id: subItem.id,
    label: subItem.label,
    href: subItem.href,
    topMenu: {
      id: parent.id,
      label: parent.label,
      href: parent.href,
    },
    parentItem: {
      id: parentItem.id,
      label: parentItem.label,
      href: parentItem.href,
    },
    allowGuest: effectiveAccess.allowGuest,
    allowMember: effectiveAccess.allowMember,
    isReadable: isVisible && canReadMenuLeaf(effectiveAccess, access),
  };
}
