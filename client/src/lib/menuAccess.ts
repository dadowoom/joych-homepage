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
  items?: MenuItemNode[];
};

export type MenuTreeForAccess = MenuTopNode[] | undefined;

export type MenuAccessMatch =
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

function normalizeHref(path: string | null | undefined) {
  return decodePath(path ?? "").trim();
}

export function isMemberOnlyMenuNode(
  node: Pick<MenuLeafNode, "allowGuest" | "allowMember"> | null | undefined
) {
  return Boolean(node?.allowMember) && !Boolean(node?.allowGuest);
}

export function findMenuAccessMatchByHref(
  menus: MenuTreeForAccess,
  href: string | null | undefined
): MenuAccessMatch | null {
  const normalizedHref = normalizeHref(href);
  if (!normalizedHref) return null;

  for (const topMenu of menus ?? []) {
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
  kind: "item" | "subItem",
  id: number
): MenuAccessMatch | null {
  if (!Number.isFinite(id) || id <= 0) return null;

  for (const topMenu of menus ?? []) {
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
