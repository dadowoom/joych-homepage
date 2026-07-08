type MenuLeafNode = {
  id: number;
  label: string;
  href?: string | null;
  allowGuest?: boolean;
  allowMember?: boolean;
};

type MenuSubItemNode = MenuLeafNode;

type MenuItemNode = MenuLeafNode & {
  subItems?: MenuSubItemNode[];
};

type MenuTopNode = {
  id: number;
  label: string;
  href?: string | null;
  allowGuest?: boolean;
  allowMember?: boolean;
  items?: MenuItemNode[];
};

export type MenuTreeForAccess = MenuTopNode[] | undefined;

export type MenuAccessMatch =
  | {
      kind: "menu";
      topMenu: MenuTopNode;
      item: MenuLeafNode;
      node: MenuLeafNode;
    }
  | {
      kind: "item";
      topMenu: MenuTopNode;
      item: MenuItemNode;
      node: MenuItemNode;
    }
  | {
      kind: "subItem";
      topMenu: MenuTopNode;
      item: MenuItemNode;
      node: MenuSubItemNode;
    };

function decodePath(path: string) {
  try {
    return decodeURIComponent(path);
  } catch {
    return path;
  }
}

function normalizeSameOriginHref(path: string) {
  const trimmed = path.trim();
  if (!/^https?:\/\//i.test(trimmed)) return trimmed;

  try {
    const url = new URL(trimmed);
    if (url.hostname === "newjoych.co.kr" || url.hostname === "www.newjoych.co.kr") {
      return `${url.pathname}${url.search}${url.hash}`;
    }
  } catch {
    return trimmed;
  }

  return trimmed;
}

function normalizeHref(path: string | null | undefined) {
  return normalizeSameOriginHref(decodePath(path ?? ""));
}

export function isMemberOnlyMenuNode(
  node: Pick<MenuLeafNode, "allowGuest" | "allowMember"> | null | undefined
) {
  return Boolean(node?.allowMember) && !Boolean(node?.allowGuest);
}

export function isHiddenMenuNode(
  node: Pick<MenuLeafNode, "allowGuest" | "allowMember"> | null | undefined
) {
  return !Boolean(node?.allowGuest) && !Boolean(node?.allowMember);
}

export function findMenuAccessMatchByHref(
  menus: MenuTreeForAccess,
  href: string | null | undefined
): MenuAccessMatch | null {
  const normalizedHref = normalizeHref(href);
  if (!normalizedHref) return null;

  for (const topMenu of menus ?? []) {
    if (normalizeHref(topMenu.href) === normalizedHref) {
      const node = {
        id: topMenu.id,
        label: topMenu.label,
        href: topMenu.href,
        allowGuest: topMenu.allowGuest,
        allowMember: topMenu.allowMember,
      };
      return { kind: "menu", topMenu, item: node, node };
    }

    for (const item of topMenu.items ?? []) {
      if (normalizeHref(item.href) === normalizedHref) {
        return { kind: "item", topMenu, item, node: item };
      }

      for (const subItem of item.subItems ?? []) {
        if (normalizeHref(subItem.href) === normalizedHref) {
          return { kind: "subItem", topMenu, item, node: subItem };
        }
      }
    }
  }

  return null;
}

export function findMenuAccessMatchById(
  menus: MenuTreeForAccess,
  kind: "menu" | "item" | "subItem",
  id: number
): MenuAccessMatch | null {
  if (!Number.isFinite(id) || id <= 0) return null;

  for (const topMenu of menus ?? []) {
    if (kind === "menu" && topMenu.id === id) {
      const node = {
        id: topMenu.id,
        label: topMenu.label,
        href: topMenu.href,
        allowGuest: topMenu.allowGuest,
        allowMember: topMenu.allowMember,
      };
      return { kind: "menu", topMenu, item: node, node };
    }

    for (const item of topMenu.items ?? []) {
      if (kind === "item" && item.id === id) {
        return { kind: "item", topMenu, item, node: item };
      }

      if (kind === "subItem") {
        for (const subItem of item.subItems ?? []) {
          if (subItem.id === id) {
            return { kind: "subItem", topMenu, item, node: subItem };
          }
        }
      }
    }
  }

  return null;
}
