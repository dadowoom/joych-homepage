import { findMenuAccessMatchByHref, type MenuTreeForAccess } from "@/lib/menuAccess";
import { isSiteHostname } from "@shared/siteHosts";

type MenuSideSubItem = {
  id: number;
  label: string;
  href?: string | null;
};

type MenuSideItem = MenuSideSubItem & {
  pageType?: string | null;
  pageImageUrl?: string | null;
  subItems?: MenuSideSubItem[];
};

type SideMenuItem = {
  id: number;
  label: string;
  href: string | null;
  isActive?: boolean;
  subItems?: SideMenuItem[];
};

const MENU_ROUTE_ALIASES = new Map<string, string[]>([
  [
    "/about/pastor/books",
    [
      "/page/교회소개-담임목사-저서",
      "/page/교회소개-담임목사-소개-담임목사저서",
      "/page/교회소개-담임목사-소개-담임목사-저서",
      "/page/교회소개-담임목사소개-담임목사저서",
      "/page/교회소개-담임목사소개-담임목사-저서",
    ],
  ],
  [
    "/about/history",
    [
      "/page/교회소개-교회역사",
      "/page/교회소개-교회-역사",
      "/page/교회소개-교회연혁",
      "/page/교회소개-교회-연혁",
    ],
  ],
  ["/about/staff", ["/page/교회소개-섬기는-분"]],
  ["/about/staff/associate", ["/page/교회소개-부교역자"]],
  [
    "/community/testimony",
    [
      "/page/커뮤니티-생선간증",
      "/page/커뮤니티-생선-간증",
      "/page/커뮤니티-은혜의간증",
      "/page/커뮤니티-은혜의-간증",
    ],
  ],
  [
    "/mission",
    [
      "/page/커뮤니티-선교소식",
      "/page/커뮤니티-선교-소식",
      "/page/사역선교-선교소식",
      "/page/사역선교-선교-소식",
      "/page/선교-선교소식",
      "/page/선교-선교-소식",
    ],
  ],
  [
    "/worship/bulletin",
    [
      "/page/행정지원-주보-주보보기",
      "/page/행정지원-주보보기",
    ],
  ],
  [
    "/support/bulletin-ad",
    [
      "/page/행정지원-주보-주보광고신청",
      "/page/행정지원-주보광고신청",
      "/page/행정지원-주보광고",
    ],
  ],
  [
    "/support/subtitle",
    [
      "/page/행정지원-자막신청",
      "/page/행정지원-자막",
    ],
  ],
  [
    "/support/tour",
    [
      "/page/행정지원-탐방신청",
      "/page/행정지원-탐방",
    ],
  ],
  [
    "/facility",
    [
      "/page/시설사용예약",
      "/page/시설-사용-예약",
      "/page/시설사용-예약",
    ],
  ],
]);

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
    if (isSiteHostname(url.hostname)) {
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

function getAliasCandidates(path: string | null | undefined) {
  const normalizedPath = normalizeHref(path);
  const aliases = MENU_ROUTE_ALIASES.get(normalizedPath) ?? [];
  return [normalizedPath, ...aliases.map((alias) => normalizeHref(alias))];
}

function hasOwnMenuContent(item: MenuSideItem) {
  const pageType = item.pageType ?? "image";
  if (pageType === "image") {
    return Boolean(item.pageImageUrl?.trim());
  }
  return true;
}

export function getSideLayoutByHref(
  menus: MenuTreeForAccess,
  href: string,
  fallbackTitle?: string,
): {
  parentLabel: string;
  pageTitle: string;
  sideMenuItems: SideMenuItem[];
} | null {
  const aliasCandidates = getAliasCandidates(href);
  const match =
    aliasCandidates
      .map((candidate) => findMenuAccessMatchByHref(menus, candidate))
      .find(Boolean) ?? null;
  if (!match) return null;

  const normalizedActiveHrefSet = new Set(aliasCandidates);
  const sideMenuItems = (match.topMenu.items ?? []).map((item) => {
    const subItems = (item.subItems ?? []).map((subItem) => ({
      id: subItem.id,
      label: subItem.label,
      href: subItem.href ?? null,
      isActive:
        match.kind === "subItem"
          ? subItem.id === match.node.id
          : normalizedActiveHrefSet.has(normalizeHref(subItem.href)),
    }));

    const itemHref =
      subItems.length > 0 && !hasOwnMenuContent(item as MenuSideItem)
        ? null
        : item.href ?? null;

    return {
      id: item.id,
      label: item.label,
      href: itemHref,
      isActive:
        match.kind === "item"
          ? item.id === match.node.id
          : normalizedActiveHrefSet.has(normalizeHref(item.href)) || subItems.some((subItem) => subItem.isActive),
      subItems,
    };
  });

  return {
    parentLabel: match.topMenu.label,
    pageTitle: fallbackTitle ?? match.node.label ?? match.item.label,
    sideMenuItems,
  };
}
