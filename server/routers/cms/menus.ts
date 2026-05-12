/**
 * 메뉴 관리 라우터 (cms.menus)
 * ─────────────────────────────────────────────────────────────────────────────
 * 담당 기능:
 *   - list: 전체 메뉴 목록 조회
 *   - getItem: 2단 메뉴 단건 조회
 *   - createItem / updateItem / deleteItem: 2단 메뉴 CRUD
 *   - createSubItem / updateSubItem / deleteSubItem: 3단 메뉴 CRUD
 *   - reorder / reorderItems / reorderSubItems: 순서 일괄 변경
 *   - create / delete: 1단(상위) 메뉴 생성/삭제
 *
 * 특이사항:
 *   - pageType이 'youtube'인 메뉴 생성 시 동일 이름의 플레이리스트 자동 생성
 *   - href가 없는 메뉴 생성 시 사람이 읽을 수 있는 동적 페이지 URL 자동 설정
 *
 * 접근 권한: 모두 adminProcedure (관리자만 접근 가능)
 */

import { z } from "zod";
import { adminProcedure, router } from "../../_core/trpc";
import {
  requiredTextSchema,
  safeAssetUrlSchema,
  safeHrefSchema,
} from "../../_core/contentValidation";
import {
  getAllMenus,
  getMenuItemById,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
  deleteMenuItemWithSubs,
  createMenu,
  updateMenu,
  deleteMenu,
  reorderMenus,
  reorderMenuItems,
  reorderMenuSubItems,
  createMenuSubItem,
  updateMenuSubItem,
  deleteMenuSubItem,
  createYoutubePlaylist,
} from "../../db";
import {
  makeUniqueMenuPageHref,
  type MenuHrefCandidate,
  type MenuHrefOwner,
} from "../../_core/menuHref";

/** 메뉴 페이지 타입 목록 */
const PAGE_TYPE = z.enum(["image", "gallery", "board", "youtube", "editor"]);
const idSchema = z.number().int().positive();
const sortOrderSchema = z.number().int().min(0).max(10000).optional();
const pageImageSchema = safeAssetUrlSchema.nullable().optional();

type MenuTree = Awaited<ReturnType<typeof getAllMenus>>;

function collectMenuHrefs(tree: MenuTree): MenuHrefCandidate[] {
  return tree.flatMap((menu) => [
    { href: menu.href },
    ...(menu.items ?? []).flatMap((item) => [
      { href: item.href, owner: { kind: "item", id: item.id } as MenuHrefOwner },
      ...(((item as { subItems?: Array<{ id: number; href?: string | null }> }).subItems ?? [])
        .map(sub => ({
          href: sub.href,
          owner: { kind: "sub", id: sub.id } as MenuHrefOwner,
        }))),
    ]),
  ]);
}

function findMenuLabel(tree: MenuTree, menuId: number) {
  return tree.find(menu => menu.id === menuId)?.label;
}

function findMenuItemPath(tree: MenuTree, itemId: number) {
  for (const menu of tree) {
    const item = (menu.items ?? []).find(candidate => candidate.id === itemId);
    if (item) return { menuLabel: menu.label, itemLabel: item.label };
  }
  return null;
}

export const menusRouter = router({
  /** 전체 메뉴 목록 (1단 + 2단 + 3단 포함) */
  list: adminProcedure.query(() => getAllMenus()),

  /** 2단 메뉴 단건 조회 (playlistId 포함) */
  getItem: adminProcedure
    .input(z.object({ id: idSchema }))
    .query(({ input }) => getMenuItemById(input.id)),

  /** 1단 메뉴 수정 (이름, 링크, 순서, 공개 여부) */
  update: adminProcedure
    .input(z.object({
      id: idSchema,
      label: requiredTextSchema(64, "메뉴 이름을 입력해주세요.").optional(),
      href: safeHrefSchema.nullable().optional(),
      sortOrder: sortOrderSchema,
      isVisible: z.boolean().optional(),
    }))
    .mutation(({ input }) => {
      const { id, ...data } = input;
      return updateMenu(id, data);
    }),

  // ─── 2단 메뉴 관리 ──────────────────────────────────────────────────────────

  /**
   * 2단 메뉴 생성
   * - href 미입력 시 /page/상위메뉴-메뉴명 형식으로 자동 설정
   * - pageType이 'youtube'이면 동일 이름의 플레이리스트 자동 생성 후 연결
   */
  createItem: adminProcedure
    .input(z.object({
      menuId: idSchema,
      label: requiredTextSchema(64, "메뉴 이름을 입력해주세요."),
      href: safeHrefSchema.optional(),
      sortOrder: sortOrderSchema,
      pageType: PAGE_TYPE.optional(),
      pageImageUrl: pageImageSchema,
    }))
    .mutation(async ({ input }) => {
      const newId = await createMenuItem(input);
      if (!newId) return { insertId: newId };

      const updates: Partial<Parameters<typeof updateMenuItem>[1]> = {};

      // href가 없으면 동적 페이지 URL 자동 설정
      if (!input.href) {
        const tree = await getAllMenus();
        updates.href = makeUniqueMenuPageHref(
          [findMenuLabel(tree, input.menuId), input.label],
          collectMenuHrefs(tree),
          { kind: "item", id: newId },
        );
      }

      // youtube 타입이면 동일 이름의 플레이리스트 자동 생성 후 연결
      if (input.pageType === "youtube") {
        const plResult = await createYoutubePlaylist({ title: input.label });
        if (plResult?.insertId) {
          updates.playlistId = plResult.insertId;
        }
      }

      if (Object.keys(updates).length > 0) {
        await updateMenuItem(newId, updates);
      }

      return { insertId: newId };
    }),

  /**
   * 2단 메뉴 수정
   * - youtube 타입으로 변경 시 플레이리스트가 없으면 자동 생성
   */
  updateItem: adminProcedure
    .input(z.object({
      id: idSchema,
      label: requiredTextSchema(64, "메뉴 이름을 입력해주세요.").optional(),
      href: safeHrefSchema.nullable().optional(),
      sortOrder: sortOrderSchema,
      isVisible: z.boolean().optional(),
      pageType: PAGE_TYPE.optional(),
      pageImageUrl: pageImageSchema,
      playlistId: idSchema.nullable().optional(),
    }))
    .mutation(async ({ input }) => {
      const { id, ...data } = input;

      // youtube 타입으로 변경 시 플레이리스트가 없으면 자동 생성
      if (data.pageType === "youtube" && !data.playlistId) {
        const existing = await getMenuItemById(id);
        if (existing && !existing.playlistId) {
          const plResult = await createYoutubePlaylist({ title: existing.label });
          if (plResult?.insertId) {
            data.playlistId = plResult.insertId;
          }
        }
      }

      return updateMenuItem(id, data);
    }),

  /** 2단 메뉴 삭제 (하위 3단 메뉴도 함께 삭제) */
  deleteItem: adminProcedure
    .input(z.object({ id: idSchema }))
    .mutation(({ input }) => deleteMenuItemWithSubs(input.id)),

  // ─── 3단 메뉴 관리 ──────────────────────────────────────────────────────────

  /**
   * 3단 메뉴 생성
   * - href 미입력 시 /page/상위메뉴-하위메뉴-메뉴명 형식으로 자동 설정
   */
  createSubItem: adminProcedure
    .input(z.object({
      menuItemId: idSchema,
      label: requiredTextSchema(64, "메뉴 이름을 입력해주세요."),
      href: safeHrefSchema.optional(),
      sortOrder: sortOrderSchema,
      pageType: PAGE_TYPE.optional(),
      pageImageUrl: pageImageSchema,
    }))
    .mutation(async ({ input }) => {
      const newId = await createMenuSubItem(input);

      // href가 없으면 동적 페이지 URL 자동 설정
      if (newId && !input.href) {
        const tree = await getAllMenus();
        const parent = findMenuItemPath(tree, input.menuItemId);
        const href = makeUniqueMenuPageHref(
          [parent?.menuLabel, parent?.itemLabel, input.label],
          collectMenuHrefs(tree),
          { kind: "sub", id: newId },
        );
        await updateMenuSubItem(newId, { href });
      }

      return { insertId: newId };
    }),

  /** 3단 메뉴 수정 */
  updateSubItem: adminProcedure
    .input(z.object({
      id: idSchema,
      label: requiredTextSchema(64, "메뉴 이름을 입력해주세요.").optional(),
      href: safeHrefSchema.nullable().optional(),
      sortOrder: sortOrderSchema,
      isVisible: z.boolean().optional(),
      pageType: PAGE_TYPE.optional(),
      pageImageUrl: pageImageSchema,
    }))
    .mutation(({ input }) => {
      const { id, ...data } = input;
      return updateMenuSubItem(id, data);
    }),

  /** 3단 메뉴 삭제 */
  deleteSubItem: adminProcedure
    .input(z.object({ id: idSchema }))
    .mutation(({ input }) => deleteMenuSubItem(input.id)),

  // ─── 1단(상위) 메뉴 관리 ────────────────────────────────────────────────────

  /** 1단 메뉴 생성 */
  create: adminProcedure
    .input(z.object({
      label: requiredTextSchema(64, "메뉴 이름을 입력해주세요."),
      href: safeHrefSchema.nullable().optional(),
      sortOrder: sortOrderSchema,
    }))
    .mutation(({ input }) => createMenu(input)),

  /** 1단 메뉴 삭제 */
  delete: adminProcedure
    .input(z.object({ id: idSchema }))
    .mutation(({ input }) => deleteMenu(input.id)),

  // ─── 순서 일괄 변경 ─────────────────────────────────────────────────────────

  /** 1단 메뉴 순서 일괄 변경 */
  reorder: adminProcedure
    .input(z.array(z.object({
      id: idSchema,
      sortOrder: z.number().int().min(0).max(10000),
    })).max(500))
    .mutation(({ input }) => reorderMenus(input)),

  /** 2단 메뉴 순서 일괄 변경 */
  reorderItems: adminProcedure
    .input(z.array(z.object({
      id: idSchema,
      sortOrder: z.number().int().min(0).max(10000),
    })).max(500))
    .mutation(({ input }) => reorderMenuItems(input)),

  /** 3단 메뉴 순서 일괄 변경 */
  reorderSubItems: adminProcedure
    .input(z.array(z.object({
      id: idSchema,
      sortOrder: z.number().int().min(0).max(10000),
    })).max(500))
    .mutation(({ input }) => reorderMenuSubItems(input)),
});
