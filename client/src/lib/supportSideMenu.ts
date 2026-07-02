type PublicMenuSubItem = {
  id: number;
  label: string;
  href?: string | null;
};

type PublicMenuItem = PublicMenuSubItem & {
  subItems?: PublicMenuSubItem[];
};

type PublicMenu = {
  id: number;
  label: string;
  href?: string | null;
  items?: PublicMenuItem[];
};

const SUPPORT_FALLBACK_SIDE_ITEMS: PublicMenuItem[] = [
  { id: -1, label: "공지사항", href: "/page/행정지원-공지사항" },
  {
    id: -2,
    label: "주보",
    href: "/worship/bulletin",
    subItems: [
      { id: -21, label: "주보보기", href: "/worship/bulletin" },
      { id: -22, label: "주보 광고신청", href: "/support/bulletin-ad" },
    ],
  },
  { id: -3, label: "자막 신청", href: "/support/subtitle" },
  { id: -4, label: "탐방신청", href: "/support/tour" },
  { id: -5, label: "기부금 영수증", href: "/support/donation" },
  { id: -6, label: "자료실", href: null },
];

function normalizeMenuText(value: string) {
  return value.replace(/\s+/g, "");
}

function normalizeHref(value: string | null | undefined) {
  return value?.trim() ?? "";
}

function getSpecialSupportHref(label: string, href?: string | null) {
  const normalized = normalizeMenuText(label);
  if (normalized === "공지사항" || normalized === "공지") return "/page/행정지원-공지사항";
  if (normalized === "주보" || normalized === "주보보기") return "/worship/bulletin";
  if (normalized === "주보광고신청") return "/support/bulletin-ad";
  if (normalized === "자막신청") return "/support/subtitle";
  if (normalized === "탐방신청") return "/support/tour";
  if (normalized === "기부금영수증") return "/support/donation";
  return normalizeHref(href) || null;
}

export function getSupportSideMenuItems(menus: PublicMenu[] | undefined, activeHref: string) {
  const normalizedActiveHref = normalizeHref(activeHref);
  const supportMenu =
    menus?.find((menu) => normalizeMenuText(menu.label) === "행정지원") ??
    menus?.find((menu) =>
      (menu.items ?? []).some((item) => {
        const itemHref = getSpecialSupportHref(item.label, item.href);
        return itemHref === normalizedActiveHref ||
          (item.subItems ?? []).some((subItem) => getSpecialSupportHref(subItem.label, subItem.href) === normalizedActiveHref);
      })
    );

  const dbItems = supportMenu?.items ?? [];
  const shouldUseFallback = !menus;
  const sourceItems = dbItems.length > 0 ? dbItems : (shouldUseFallback ? SUPPORT_FALLBACK_SIDE_ITEMS : []);

  return {
    parentLabel: supportMenu?.label ?? "행정지원",
    sideMenuItems: sourceItems.map((item) => {
      const itemHref = getSpecialSupportHref(item.label, item.href);
      const subItems = "subItems" in item ? item.subItems ?? [] : [];
      const mappedSubItems = subItems.map((subItem) => {
        const subHref = getSpecialSupportHref(subItem.label, subItem.href);
        return {
          id: subItem.id,
          label: subItem.label,
          href: subHref,
          isActive: subHref === normalizedActiveHref,
        };
      });

      return {
        id: item.id,
        label: item.label,
        href: itemHref,
        isActive: itemHref === normalizedActiveHref || mappedSubItems.some((subItem) => subItem.isActive),
        subItems: mappedSubItems,
      };
    }),
  };
}
