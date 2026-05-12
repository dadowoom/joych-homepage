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

import { useLocation, useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import SubPageLayout from "@/components/SubPageLayout";
import { ImageContent } from "@/components/dynamic-page/ImageContent";
import { GalleryContent } from "@/components/dynamic-page/GalleryContent";
import { BoardContent } from "@/components/dynamic-page/BoardContent";
import { YoutubeContent } from "@/components/dynamic-page/YoutubeContent";
import { EditorContent } from "@/components/dynamic-page/EditorContent";

type DynamicPageItem = {
  id: number;
  label: string;
  href?: string | null;
  pageType?: string | null;
  pageImageUrl?: string | null;
  playlistId?: number | null;
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

function decodePath(path: string) {
  try {
    return decodeURIComponent(path);
  } catch {
    return path;
  }
}

// ─── 페이지 타입에 따라 알맞은 콘텐츠 컴포넌트를 반환 ────────────────────────
function renderContent(
  pageType: string,
  label: string,
  imageUrl: string | null,
  menuItemId?: number,
  menuSubItemId?: number,
  playlistId?: number | null
) {
  switch (pageType) {
    case "image":
      return <ImageContent label={label} imageUrl={imageUrl} />;
    case "gallery":
      return <GalleryContent />;
    case "board":
      return <BoardContent />;
    case "youtube":
      return <YoutubeContent label={label} playlistId={playlistId} />;
    case "editor":
      return (
        <EditorContent menuItemId={menuItemId} menuSubItemId={menuSubItemId} />
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

function MenuItemPageContent({
  item,
  allMenus,
  activeHref,
}: {
  item: DynamicPageItem;
  allMenus?: DynamicMenuTree;
  activeHref?: string;
}) {
  const parentMenu = (allMenus ?? []).find((m) =>
    (m.items ?? []).some((s) => s.id === item.id)
  );
  const sideItems = (parentMenu?.items ?? []).map((s) => ({
    id: s.id,
    label: s.label,
    href: s.href ?? null,
    isActive: s.id === item.id || decodePath(s.href ?? "") === decodePath(activeHref ?? ""),
  }));

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
        item.playlistId
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
        sideItems = subItems.map((s) => ({
          id: s.id,
          label: s.label,
          href: s.href ?? null,
          isActive: s.id === item.id || decodePath(s.href ?? "") === decodePath(activeHref ?? ""),
        }));
        break;
      }
    }
    if (parentItemLabel) break;
  }

  return (
    <SubPageLayout
      pageTitle={item.label}
      parentLabel={parentItemLabel ?? grandParentLabel}
      sideMenuItems={sideItems}
    >
      {renderContent(
        item.pageType ?? "image",
        item.label,
        item.pageImageUrl ?? null,
        undefined,
        item.id,
        item.playlistId
      )}
    </SubPageLayout>
  );
}

// ─── 2단 메뉴 동적 페이지 ─────────────────────────────────────────────────────
export function DynamicMenuItemPage() {
  const { id } = useParams<{ id: string }>();
  const itemId = parseInt(id ?? "0", 10);

  const { data: item, isLoading } = trpc.home.menuItem.useQuery(
    { id: itemId },
    { enabled: !!itemId }
  );
  const { data: allMenus } = trpc.home.menus.useQuery();

  if (isLoading) {
    return <LoadingDynamicPage />;
  }

  if (!item) {
    return <MissingDynamicPage />;
  }

  return <MenuItemPageContent item={item} allMenus={allMenus} activeHref={`/page/item/${itemId}`} />;
}

// ─── 3단 메뉴 동적 페이지 ─────────────────────────────────────────────────────
export function DynamicMenuSubItemPage() {
  const { id } = useParams<{ id: string }>();
  const itemId = parseInt(id ?? "0", 10);

  const { data: item, isLoading } = trpc.home.menuSubItem.useQuery(
    { id: itemId },
    { enabled: !!itemId }
  );
  const { data: allMenus } = trpc.home.menus.useQuery();

  if (isLoading) {
    return <LoadingDynamicPage />;
  }

  if (!item) {
    return <MissingDynamicPage />;
  }

  return <MenuSubItemPageContent item={item} allMenus={allMenus} activeHref={`/page/sub/${itemId}`} />;
}

// ─── 깔끔한 CMS 페이지 URL (/page/상위메뉴-메뉴명) ─────────────────────────
export function DynamicMenuHrefPage() {
  const [location] = useLocation();
  const activeHref = decodePath(location);

  const { data: item, isLoading: itemLoading } = trpc.home.menuItemByHref.useQuery(
    { href: activeHref },
    { enabled: Boolean(activeHref) }
  );
  const { data: subItem, isLoading: subItemLoading } = trpc.home.menuSubItemByHref.useQuery(
    { href: activeHref },
    { enabled: Boolean(activeHref) }
  );
  const { data: allMenus } = trpc.home.menus.useQuery();

  if (itemLoading || subItemLoading) {
    return <LoadingDynamicPage />;
  }

  if (item) {
    return <MenuItemPageContent item={item} allMenus={allMenus} activeHref={activeHref} />;
  }

  if (subItem) {
    return <MenuSubItemPageContent item={subItem} allMenus={allMenus} activeHref={activeHref} />;
  }

  return <MissingDynamicPage />;
}
