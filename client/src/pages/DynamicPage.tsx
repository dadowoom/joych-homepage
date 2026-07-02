/**
 * 동적 페이지 컴포넌트
 * ─────────────────────────────────────────────────────────────────────────────
 * 관리자가 CMS에서 등록한 메뉴 항목에 따라 동적으로 페이지를 렌더링합니다.
 *
 * 지원하는 pageType:
 *   - "image"   : 이미지 한 장 전체화면 표시
 *   - "gallery" : 갤러리 그리드 표시
 *   - "board"   : 공지사항 게시판 표시
 *   - "youtube" : 유튜브 플레이리스트 표시
 *   - "editor"  : 블록 에디터 (관리자가 자유롭게 내용 구성)
 *
 * 컴포넌트 구조:
 *   DynamicPage.tsx (이 파일)
 *   └── components/dynamic-page/
 *       ├── Lightbox.tsx         — 이미지 확대 팝업
 *       ├── ImageContent.tsx     — 이미지 표시
 *       ├── GalleryContent.tsx   — 갤러리
 *       ├── BoardContent.tsx     — 게시판
 *       ├── YoutubeContent.tsx   — 유튜브
 *       ├── BlockRenderer.tsx    — 블록 렌더러 (타입 정의 포함)
 *       ├── BlockEditDialog.tsx  — 블록 편집 다이얼로그
 *       └── EditorContent.tsx    — 에디터 콘텐츠 (뷰어 + 관리자 편집 UI)
 */

import { useEffect, useMemo } from "react";
import { useLocation, useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import SubPageLayout from "@/components/SubPageLayout";
import MemberOnlyContentNotice from "@/components/MemberOnlyContentNotice";
import { ImageContent } from "@/components/dynamic-page/ImageContent";
import { GalleryContent } from "@/components/dynamic-page/GalleryContent";
import { BoardContent } from "@/components/dynamic-page/BoardContent";
import { YoutubeContent } from "@/components/dynamic-page/YoutubeContent";
import { EditorContent } from "@/components/dynamic-page/EditorContent";
import { StaffPage } from "./ChurchIntro";
import KakaoDirectionsMap from "@/components/KakaoDirectionsMap";
import {
  findMenuAccessMatchByHref,
  findMenuAccessMatchById,
  isMemberOnlyMenuNode,
  type MenuAccessMatch,
} from "@/lib/menuAccess";

type DynamicPageItem = {
  id: number;
  label: string;
  href?: string | null;
  pageType?: string | null;
  pageImageUrl?: string | null;
  playlistId?: number | null;
  defaultViewMode?: string | null;
  allowGuest?: boolean;
  allowMember?: boolean;
};

type DynamicPageSubItem = DynamicPageItem & {
  menuItemId: number;
};

type DynamicMenuTreeItem = DynamicPageItem & {
  subItems?: DynamicPageSubItem[];
};

type DynamicMenuTree = Array<{
  id: number;
  label: string;
  href?: string | null;
  items?: DynamicMenuTreeItem[];
}>;

type MenuAccessInfo = {
  kind: "item" | "subItem";
  id: number;
  label: string;
  href?: string | null;
  allowGuest: boolean;
  allowMember: boolean;
  isReadable: boolean;
  topMenu: {
    id: number;
    label: string;
    href?: string | null;
  };
  parentItem?: {
    id: number;
    label: string;
    href?: string | null;
  };
};

function getAccessMatchFromInfo(accessInfo: MenuAccessInfo | null | undefined): MenuAccessMatch | null {
  if (!accessInfo) return null;

  if (accessInfo.kind === "item") {
    const item = {
      id: accessInfo.id,
      label: accessInfo.label,
      href: accessInfo.href,
      allowGuest: accessInfo.allowGuest,
      allowMember: accessInfo.allowMember,
      subItems: [],
    };
    return {
      kind: "item",
      topMenu: { ...accessInfo.topMenu, items: [item] },
      item,
      node: item,
    };
  }

  const subItem = {
    id: accessInfo.id,
    label: accessInfo.label,
    href: accessInfo.href,
    allowGuest: accessInfo.allowGuest,
    allowMember: accessInfo.allowMember,
  };
  const item = {
    id: accessInfo.parentItem?.id ?? -1,
    label: accessInfo.parentItem?.label ?? accessInfo.label,
    href: accessInfo.parentItem?.href,
    allowGuest: accessInfo.allowGuest,
    allowMember: accessInfo.allowMember,
    subItems: [subItem],
  };

  return {
    kind: "subItem",
    topMenu: { ...accessInfo.topMenu, items: [item] },
    item,
    node: subItem,
  };
}

function decodePath(path: string) {
  try {
    return decodeURIComponent(path);
  } catch {
    return path;
  }
}

function normalizeDynamicHref(path: string | null | undefined) {
  return decodePath(path ?? "").replace(/[\s-]+/g, "");
}

const CODE_BACKED_PAGE_ALIASES = new Map<string, string>([
  ["/page/교회소개-담임목사-저서", "/about/pastor/books"],
  ["/page/교회소개-담임목사-소개-담임목사저서", "/about/pastor/books"],
  ["/page/교회소개-담임목사-소개-담임목사-저서", "/about/pastor/books"],
  ["/page/교회소개-담임목사소개-담임목사저서", "/about/pastor/books"],
  ["/page/교회소개-담임목사소개-담임목사-저서", "/about/pastor/books"],
  ["/page/교회소개-교회역사", "/about/history"],
  ["/page/교회소개-교회-역사", "/about/history"],
  ["/page/교회소개-교회연혁", "/about/history"],
  ["/page/교회소개-교회-연혁", "/about/history"],
]);

function getCodeBackedPageAlias(href: string | null | undefined) {
  const value = href?.trim();
  if (!value) return null;
  const decodedValue = decodePath(value);
  const directAlias = CODE_BACKED_PAGE_ALIASES.get(decodedValue);
  if (directAlias) return directAlias;
  if (normalizeDynamicHref(decodedValue).includes("/page/시설사용예약외부인")) {
    return "/facility/external";
  }
  return null;
}

function getCanonicalInternalHref(href: string | null | undefined, legacyHref: string) {
  const value = href?.trim();
  if (!value) return null;
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  const codeBackedHref = getCodeBackedPageAlias(value);
  if (codeBackedHref) {
    return decodePath(codeBackedHref) === decodePath(legacyHref) ? null : codeBackedHref;
  }
  return decodePath(value) === decodePath(legacyHref) ? null : value;
}

function getStaffCategoryForMenuItem(item: DynamicPageItem) {
  const label = item.label.trim();
  const href = item.href?.trim();
  if (label === "섬기는 분" || href === "/page/교회소개-섬기는-분") return "senior";
  if (label === "부교역자" || href === "/page/교회소개-부교역자") return "associate";
  return null;
}

function isDirectionsMenuItem(item: DynamicPageItem) {
  const label = item.label.replace(/\s+/g, "");
  const href = item.href?.replace(/\s+/g, "") ?? "";
  return label === "오시는길" || href.includes("오시는길") || href === "/about/directions";
}

function isContainerOnlySecondLevelItem(item: DynamicPageItem) {
  return item.label.replace(/\s+/g, "") === "자료실";
}

function isRepresentativeLinkSecondLevelItem(item: DynamicPageItem) {
  return item.label.replace(/\s+/g, "") === "주보";
}

function isBulletinViewMenuItem(item: DynamicPageItem) {
  return item.label.replace(/\s+/g, "") === "주보보기";
}

function isBulletinAdRequestMenuItem(item: DynamicPageItem) {
  return item.label.replace(/\s+/g, "") === "주보광고신청";
}

function isSubtitleRequestMenuItem(item: DynamicPageItem) {
  return item.label.replace(/\s+/g, "") === "자막신청";
}

function isVisitRequestMenuItem(item: DynamicPageItem) {
  return item.label.replace(/\s+/g, "") === "탐방신청";
}

function isExternalFacilityReservationMenuItem(item: DynamicPageItem) {
  return (
    item.label.replace(/\s+/g, "") === "외부인" &&
    normalizeDynamicHref(item.href).includes("시설사용예약외부인")
  );
}

function getRepresentativeSubItemHref(subItems: DynamicPageSubItem[] | undefined) {
  const items = subItems ?? [];
  const bulletinView = items.find((sub) => sub.label.replace(/\s+/g, "") === "주보보기");
  return bulletinView?.href?.trim()
    || items.find((sub) => Boolean(sub.href?.trim()))?.href?.trim()
    || null;
}

function getFirstSubItemHref(allMenus: DynamicMenuTree | undefined, itemId: number) {
  for (const menu of allMenus ?? []) {
    const matched = (menu.items ?? []).find((candidate) => candidate.id === itemId);
    const firstHref = matched?.subItems?.find((sub) => Boolean(sub.href?.trim()))?.href?.trim();
    if (firstHref) return firstHref;
  }
  return null;
}

function hasOwnMenuContent(item: DynamicPageItem) {
  const pageType = item.pageType ?? "image";
  if (pageType === "image") {
    return Boolean(item.pageImageUrl?.trim());
  }
  return true;
}

function getSecondLevelSideMenuItems(
  menu: DynamicMenuTree[number] | undefined,
  activeItemId?: number,
  activeHref?: string,
) {
  const normalizedActiveHref = decodePath(activeHref ?? "");
  return (menu?.items ?? []).map((item) => {
    const subItems = item.subItems ?? [];
    const hasSubItems = subItems.length > 0;
    const href = hasSubItems
      ? isContainerOnlySecondLevelItem(item)
        ? null
        : isRepresentativeLinkSecondLevelItem(item)
          ? getRepresentativeSubItemHref(subItems) ?? item.href ?? null
          : hasOwnMenuContent(item)
            ? item.href ?? null
            : null
      : item.href ?? null;
    return {
      id: item.id,
      label: item.label,
      href,
      isActive:
        item.id === activeItemId ||
        decodePath(item.href ?? "") === normalizedActiveHref ||
        subItems.some((sub) => decodePath(sub.href ?? "") === normalizedActiveHref),
      subItems: subItems.map((sub) => ({
        id: sub.id,
        label: sub.label,
        href: sub.href ?? null,
        isActive: decodePath(sub.href ?? "") === normalizedActiveHref,
      })),
    };
  });
}

// ─── 페이지 타입에 따라 알맞은 콘텐츠 컴포넌트를 반환 ────────────────────────
function renderContent(
  pageType: string,
  label: string,
  imageUrl: string | null,
  menuItemId?: number,
  menuSubItemId?: number,
  playlistId?: number | null,
  href?: string | null,
  defaultViewMode?: string | null
) {
  const shouldUseWideEditorLayout =
    label.replace(/\s+/g, "") === "차량시간표" ||
    (href ?? "").replace(/\s+/g, "").includes("차량시간표");

  switch (pageType) {
    case "image":
      return <ImageContent label={label} imageUrl={imageUrl} />;
    case "gallery":
      return <GalleryContent defaultViewMode={defaultViewMode === "list" ? "list" : "grid"} />;
    case "board":
      return (
        <BoardContent
          label={label}
          href={href}
          menuItemId={menuItemId}
          menuSubItemId={menuSubItemId}
          defaultViewMode={defaultViewMode === "grid" ? "grid" : "list"}
        />
      );
    case "youtube":
      return <YoutubeContent label={label} playlistId={playlistId} />;
    case "editor":
      return (
        <EditorContent
          menuItemId={menuItemId}
          menuSubItemId={menuSubItemId}
        />
      );
    default:
      return <ImageContent label={label} imageUrl={imageUrl} />;
  }
}

function LoadingDynamicPage() {
  return (
    <SubPageLayout pageTitle="불러오는 중...">
      <div className="flex items-center justify-center py-24 text-gray-400">
        페이지 불러오는 중...
      </div>
    </SubPageLayout>
  );
}

function MissingDynamicPage() {
  return (
    <SubPageLayout pageTitle="페이지를 찾을 수 없습니다">
      <div className="flex flex-col items-center justify-center py-24">
        <p className="text-gray-500 text-lg mb-4">
          요청하신 페이지가 존재하지 않습니다.
        </p>
      </div>
    </SubPageLayout>
  );
}

function MemberOnlyDynamicPage({
  match,
  activeHref,
}: {
  match: MenuAccessMatch;
  activeHref: string;
}) {
  const sideItems = getSecondLevelSideMenuItems(
    match.topMenu as DynamicMenuTree[number],
    match.item.id,
    activeHref
  );

  return (
    <SubPageLayout
      pageTitle={match.node.label}
      parentLabel={match.topMenu.label}
      sideMenuItems={sideItems}
    >
      <MemberOnlyContentNotice
        resourceLabel={match.node.label}
        fallbackPath={activeHref}
      />
    </SubPageLayout>
  );
}

function MenuItemPageContent({
  item,
  allMenus,
  activeHref,
}: {
  item: DynamicPageItem;
  allMenus?: DynamicMenuTree;
  activeHref?: string;
}) {
  const [, setLocation] = useLocation();
  const parentMenu = (allMenus ?? []).find((m) =>
    (m.items ?? []).some((s) => s.id === item.id)
  );
  const itemSubItems = parentMenu?.items?.find((candidate) => candidate.id === item.id)?.subItems ?? [];
  const isContainerOnly = isContainerOnlySecondLevelItem(item) && itemSubItems.length > 0;
  const sideItems = getSecondLevelSideMenuItems(parentMenu, item.id, activeHref);
  const staffCategory = getStaffCategoryForMenuItem(item);
  const shouldRedirectToBulletinView = isBulletinViewMenuItem(item);
  const shouldRedirectToBulletinAd = isBulletinAdRequestMenuItem(item);
  const shouldRedirectToSubtitle = isSubtitleRequestMenuItem(item);
  const shouldRedirectToVisitRequest = isVisitRequestMenuItem(item);
  const shouldRedirectToExternalFacility = isExternalFacilityReservationMenuItem(item);
  const firstSubItemHref = getFirstSubItemHref(allMenus, item.id);
  const shouldRedirectToFirstSubItem =
    !staffCategory &&
    Boolean(firstSubItemHref) &&
    (item.pageType ?? "image") === "image" &&
    !item.pageImageUrl &&
    decodePath(firstSubItemHref ?? "") !== decodePath(activeHref ?? "");

  useEffect(() => {
    if (shouldRedirectToBulletinView) {
      setLocation("/worship/bulletin");
      return;
    }
    if (shouldRedirectToBulletinAd) {
      setLocation("/support/bulletin-ad");
      return;
    }
    if (shouldRedirectToSubtitle) {
      setLocation("/support/subtitle");
      return;
    }
    if (shouldRedirectToVisitRequest) {
      setLocation("/support/tour");
      return;
    }
    if (shouldRedirectToExternalFacility) {
      setLocation("/facility/external");
      return;
    }
    if (shouldRedirectToFirstSubItem && firstSubItemHref) {
      setLocation(firstSubItemHref);
    }
  }, [
    firstSubItemHref,
    setLocation,
    shouldRedirectToBulletinAd,
    shouldRedirectToBulletinView,
    shouldRedirectToSubtitle,
    shouldRedirectToVisitRequest,
    shouldRedirectToExternalFacility,
    shouldRedirectToFirstSubItem,
  ]);

  if (staffCategory) {
    return <StaffPage initialCategory={staffCategory} />;
  }

  if (isDirectionsMenuItem(item)) {
    return (
      <SubPageLayout
        pageTitle={item.label}
        parentLabel={parentMenu?.label}
        sideMenuItems={sideItems}
      >
        <KakaoDirectionsMap />
      </SubPageLayout>
    );
  }

  if (shouldRedirectToBulletinView || shouldRedirectToBulletinAd || shouldRedirectToSubtitle || shouldRedirectToVisitRequest || shouldRedirectToExternalFacility) {
    return <LoadingDynamicPage />;
  }

  if (isContainerOnly) {
    return (
      <SubPageLayout
        pageTitle={item.label}
        parentLabel={parentMenu?.label}
        sideMenuItems={sideItems}
      >
        <div className="min-h-[240px]" aria-hidden="true" />
      </SubPageLayout>
    );
  }

  if (shouldRedirectToFirstSubItem) {
    return <LoadingDynamicPage />;
  }

  return (
    <SubPageLayout
      pageTitle={item.label}
      parentLabel={parentMenu?.label}
      sideMenuItems={sideItems}
    >
      {renderContent(
        item.pageType ?? "image",
        item.label,
        item.pageImageUrl ?? null,
        item.id,
        undefined,
        item.playlistId,
        item.href ?? activeHref ?? null,
        item.defaultViewMode ?? null
      )}
    </SubPageLayout>
  );
}

function MenuSubItemPageContent({
  item,
  allMenus,
  activeHref,
}: {
  item: DynamicPageSubItem;
  allMenus?: DynamicMenuTree;
  activeHref?: string;
}) {
  const [, setLocation] = useLocation();
  let parentItemLabel: string | undefined;
  let grandParentLabel: string | undefined;
  let sideItems: {
    id: number;
    label: string;
    href: string | null;
    isActive?: boolean;
  }[] = [];

  for (const topMenu of allMenus ?? []) {
    for (const midMenu of topMenu.items ?? []) {
      const subItems = midMenu.subItems ?? [];
      if (subItems.some((s) => s.id === item.id)) {
        parentItemLabel = midMenu.label;
        grandParentLabel = topMenu.label;
        sideItems = getSecondLevelSideMenuItems(topMenu, midMenu.id, activeHref);
        break;
      }
    }
    if (parentItemLabel) break;
  }

  const shouldRedirectToBulletinView = isBulletinViewMenuItem(item);
  const shouldRedirectToBulletinAd = isBulletinAdRequestMenuItem(item);
  const shouldRedirectToSubtitle = isSubtitleRequestMenuItem(item);
  const shouldRedirectToVisitRequest = isVisitRequestMenuItem(item);
  const shouldRedirectToExternalFacility = isExternalFacilityReservationMenuItem(item);

  useEffect(() => {
    if (shouldRedirectToBulletinView) {
      setLocation("/worship/bulletin");
      return;
    }
    if (shouldRedirectToBulletinAd) {
      setLocation("/support/bulletin-ad");
      return;
    }
    if (shouldRedirectToSubtitle) {
      setLocation("/support/subtitle");
      return;
    }
    if (shouldRedirectToVisitRequest) {
      setLocation("/support/tour");
      return;
    }
    if (shouldRedirectToExternalFacility) {
      setLocation("/facility/external");
    }
  }, [setLocation, shouldRedirectToBulletinAd, shouldRedirectToBulletinView, shouldRedirectToSubtitle, shouldRedirectToVisitRequest, shouldRedirectToExternalFacility]);

  if (shouldRedirectToBulletinView || shouldRedirectToBulletinAd || shouldRedirectToSubtitle || shouldRedirectToVisitRequest || shouldRedirectToExternalFacility) {
    return <LoadingDynamicPage />;
  }

  return (
    <SubPageLayout
      pageTitle={item.label}
      parentLabel={grandParentLabel ?? parentItemLabel}
      sideMenuItems={sideItems}
    >
      {renderContent(
        item.pageType ?? "image",
        item.label,
        item.pageImageUrl ?? null,
        undefined,
        item.id,
        item.playlistId,
        item.href ?? activeHref ?? null,
        item.defaultViewMode ?? null
      )}
    </SubPageLayout>
  );
}

// ─── 2단 메뉴 동적 페이지 ─────────────────────────────────────────────────────
export function DynamicMenuItemPage() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const itemId = parseInt(id ?? "0", 10);
  const legacyHref = `/page/item/${itemId}`;

  const { data: item, isLoading } = trpc.home.menuItem.useQuery(
    { id: itemId },
    { enabled: !!itemId }
  );
  const { data: allMenus, isLoading: menusLoading } = trpc.home.menus.useQuery();
  const { data: accessInfo, isLoading: accessLoading } = trpc.home.menuAccessById.useQuery(
    { kind: "item", id: itemId },
    { enabled: !!itemId }
  );
  const accessMatch = useMemo(
    () => findMenuAccessMatchById(allMenus, "item", itemId) ?? getAccessMatchFromInfo(accessInfo),
    [allMenus, itemId, accessInfo]
  );
  const canonicalHref = getCanonicalInternalHref(item?.href, legacyHref);

  useEffect(() => {
    if (canonicalHref) {
      setLocation(canonicalHref);
    }
  }, [canonicalHref, setLocation]);

  if (isLoading || menusLoading || accessLoading) {
    return <LoadingDynamicPage />;
  }

  if (!item) {
    if (accessMatch && isMemberOnlyMenuNode(accessMatch.node)) {
      return <MemberOnlyDynamicPage match={accessMatch} activeHref={legacyHref} />;
    }
    return <MissingDynamicPage />;
  }

  return <MenuItemPageContent item={item} allMenus={allMenus} activeHref={legacyHref} />;
}

// ─── 3단 메뉴 동적 페이지 ─────────────────────────────────────────────────────
export function DynamicMenuSubItemPage() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const itemId = parseInt(id ?? "0", 10);
  const legacyHref = `/page/sub/${itemId}`;

  const { data: item, isLoading } = trpc.home.menuSubItem.useQuery(
    { id: itemId },
    { enabled: !!itemId }
  );
  const { data: allMenus, isLoading: menusLoading } = trpc.home.menus.useQuery();
  const { data: accessInfo, isLoading: accessLoading } = trpc.home.menuAccessById.useQuery(
    { kind: "subItem", id: itemId },
    { enabled: !!itemId }
  );
  const accessMatch = useMemo(
    () => findMenuAccessMatchById(allMenus, "subItem", itemId) ?? getAccessMatchFromInfo(accessInfo),
    [allMenus, itemId, accessInfo]
  );
  const canonicalHref = getCanonicalInternalHref(item?.href, legacyHref);

  useEffect(() => {
    if (canonicalHref) {
      setLocation(canonicalHref);
    }
  }, [canonicalHref, setLocation]);

  if (isLoading || menusLoading || accessLoading) {
    return <LoadingDynamicPage />;
  }

  if (!item) {
    if (accessMatch && isMemberOnlyMenuNode(accessMatch.node)) {
      return <MemberOnlyDynamicPage match={accessMatch} activeHref={legacyHref} />;
    }
    return <MissingDynamicPage />;
  }

  return <MenuSubItemPageContent item={item} allMenus={allMenus} activeHref={legacyHref} />;
}

// ─── 깔끔한 CMS 페이지 URL (/page/상위메뉴-메뉴명) ─────────────────────────
export function DynamicMenuHrefPage() {
  const [location, setLocation] = useLocation();
  const activeHref = decodePath(location);
  const codeBackedHref = getCodeBackedPageAlias(activeHref);
  const shouldLoadDynamicPage = Boolean(activeHref) && !codeBackedHref;

  const { data: item, isLoading: itemLoading } = trpc.home.menuItemByHref.useQuery(
    { href: activeHref },
    { enabled: shouldLoadDynamicPage }
  );
  const { data: subItem, isLoading: subItemLoading } = trpc.home.menuSubItemByHref.useQuery(
    { href: activeHref },
    { enabled: shouldLoadDynamicPage }
  );
  const { data: allMenus, isLoading: menusLoading } = trpc.home.menus.useQuery();
  const { data: accessInfo, isLoading: accessLoading } = trpc.home.menuAccessByHref.useQuery(
    { href: activeHref },
    { enabled: shouldLoadDynamicPage }
  );
  const accessMatch = useMemo(
    () => findMenuAccessMatchByHref(allMenus, activeHref) ?? getAccessMatchFromInfo(accessInfo),
    [allMenus, activeHref, accessInfo]
  );

  useEffect(() => {
    if (codeBackedHref) {
      setLocation(codeBackedHref, { replace: true });
    }
  }, [codeBackedHref, setLocation]);

  if (codeBackedHref) {
    return <LoadingDynamicPage />;
  }

  if (itemLoading || subItemLoading || menusLoading || accessLoading) {
    return <LoadingDynamicPage />;
  }

  if (item) {
    return <MenuItemPageContent item={item} allMenus={allMenus} activeHref={activeHref} />;
  }

  if (subItem) {
    return <MenuSubItemPageContent item={subItem} allMenus={allMenus} activeHref={activeHref} />;
  }

  if (accessMatch && isMemberOnlyMenuNode(accessMatch.node)) {
    return <MemberOnlyDynamicPage match={accessMatch} activeHref={activeHref} />;
  }

  return <MissingDynamicPage />;
}
