/**
 * JoyfulTV.tsx
 * 조이풀TV 하위 메뉴 전체 페이지
 * - 각 예배 페이지는 href 기반으로 DB 메뉴 아이템을 조회해 playlistId를 가져온 뒤
 *   YoutubeListPage에 전달합니다. 관리자 대시보드에서 영상을 추가/삭제하면 즉시 반영됩니다.
 */
import { trpc } from "@/lib/trpc";
import SubPageLayout from "@/components/SubPageLayout";
import MemberOnlyContentNotice from "@/components/MemberOnlyContentNotice";
import { findMenuAccessMatchByHref, isMemberOnlyMenuNode } from "@/lib/menuAccess";
import YoutubeListPage from "./YoutubeListPage";

type VideoMenuSubItem = {
  id: number;
  label: string;
  href?: string | null;
  pageType?: string | null;
  pageImageUrl?: string | null;
  playlistId?: number | null;
  menuItemId?: number;
  allowGuest?: boolean;
  allowMember?: boolean;
};

type VideoMenuItem = {
  id: number;
  label: string;
  href?: string | null;
  pageType?: string | null;
  pageImageUrl?: string | null;
  playlistId?: number | null;
  menuId?: number;
  subItems?: VideoMenuSubItem[];
  allowGuest?: boolean;
  allowMember?: boolean;
};

type VideoMenuTree = Array<{
  id: number;
  label: string;
  href?: string | null;
  items?: VideoMenuItem[];
}>;

type VideoSideMenuItem = {
  id: number;
  label: string;
  href: string | null;
  isActive?: boolean;
  subItems?: VideoSideMenuItem[];
};

function decodePath(path: string) {
  try {
    return decodeURIComponent(path);
  } catch {
    return path;
  }
}

function hasOwnMenuContent(item: VideoMenuItem) {
  const pageType = item.pageType ?? "image";
  if (pageType === "image") {
    return Boolean(item.pageImageUrl?.trim());
  }
  return true;
}

function getJoyfulTvMenu(
  menuTree: VideoMenuTree | undefined,
  activeItemId?: number,
  activeSubItemId?: number
) {
  for (const menu of menuTree ?? []) {
    if (
      menu.items?.some(
        (item) =>
          item.id === activeItemId ||
          item.subItems?.some((subItem) => subItem.id === activeSubItemId)
      )
    ) {
      return menu;
    }
  }

  return (menuTree ?? []).find((menu) => menu.label === "조이풀TV");
}

function getVideoSideMenuItems(
  menuTree: VideoMenuTree | undefined,
  activeHref: string,
  activeItemId?: number,
  activeSubItemId?: number
): VideoSideMenuItem[] {
  const parentMenu = getJoyfulTvMenu(menuTree, activeItemId, activeSubItemId);
  const normalizedActiveHref = decodePath(activeHref);

  return (parentMenu?.items ?? []).map((item) => {
    const subItems = item.subItems ?? [];
    const hasSubItems = subItems.length > 0;
    const href = hasSubItems && !hasOwnMenuContent(item) ? null : item.href ?? null;

    return {
      id: item.id,
      label: item.label,
      href,
      isActive:
        item.id === activeItemId ||
        decodePath(item.href ?? "") === normalizedActiveHref ||
        subItems.some(
          (subItem) =>
            subItem.id === activeSubItemId ||
            decodePath(subItem.href ?? "") === normalizedActiveHref
        ),
      subItems: subItems.map((subItem) => ({
        id: subItem.id,
        label: subItem.label,
        href: subItem.href ?? null,
        isActive:
          subItem.id === activeSubItemId ||
          decodePath(subItem.href ?? "") === normalizedActiveHref,
      })),
    };
  });
}

function VideoPageShell({
  title,
  sideMenuItems,
  children,
}: {
  title: string;
  sideMenuItems: VideoSideMenuItem[];
  children: React.ReactNode;
}) {
  return (
    <SubPageLayout
      pageTitle={title}
      parentLabel="조이풀TV"
      sideMenuItems={sideMenuItems}
    >
      {children}
    </SubPageLayout>
  );
}

function EmptyVideoPage({
  title,
  message,
  sideMenuItems,
}: {
  title: string;
  message: string;
  sideMenuItems: VideoSideMenuItem[];
}) {
  return (
    <VideoPageShell title={title} sideMenuItems={sideMenuItems}>
      <div className="min-h-[320px] flex items-center justify-center rounded-xl border border-gray-100 bg-white">
        <div className="text-center text-gray-500 px-6">
          <i className="fas fa-video text-4xl text-[#1B5E20] mb-4 opacity-70"></i>
          <p className="text-base font-semibold text-gray-700">{message}</p>
          <p className="text-sm mt-2 text-gray-400">영상이 준비되는 대로 이곳에서 보실 수 있습니다.</p>
        </div>
      </div>
    </VideoPageShell>
  );
}

// ── 공통: href로 playlistId를 조회해 YoutubeListPage를 렌더링 ──
function MemberOnlyVideoPage({
  title,
  href,
  sideMenuItems,
}: {
  title: string;
  href: string;
  sideMenuItems: VideoSideMenuItem[];
}) {
  return (
    <VideoPageShell title={title} sideMenuItems={sideMenuItems}>
      <MemberOnlyContentNotice resourceLabel={title} fallbackPath={href} />
    </VideoPageShell>
  );
}

function WorshipVideoPage({ href, title }: { href: string; title: string }) {
  const { data: menuItem, isLoading: l1 } = trpc.home.menuItemByHref.useQuery({ href });
  const { data: subItem, isLoading: l2 } = trpc.home.menuSubItemByHref.useQuery({ href });
  const { data: menuTree, isLoading: menuLoading } = trpc.home.menus.useQuery();
  const accessMatch = findMenuAccessMatchByHref(menuTree, href);

  const playlistId = menuItem?.playlistId ?? subItem?.playlistId ?? null;
  const activeItemId = menuItem?.id ?? subItem?.menuItemId;
  const activeSubItemId = subItem?.id;
  const sideMenuItems = getVideoSideMenuItems(
    menuTree,
    href,
    activeItemId,
    activeSubItemId
  );
  const isLoading = l1 || l2 || menuLoading;

  if (isLoading) {
    return (
      <VideoPageShell title={title} sideMenuItems={sideMenuItems}>
        <div className="min-h-[320px] flex items-center justify-center">
          <div className="text-center text-gray-400">
            <div className="w-10 h-10 border-4 border-[#1B5E20] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm">영상 목록을 불러오는 중...</p>
          </div>
        </div>
      </VideoPageShell>
    );
  }

  if (!playlistId && accessMatch && isMemberOnlyMenuNode(accessMatch.node)) {
    return (
      <MemberOnlyVideoPage
        title={title}
        href={href}
        sideMenuItems={sideMenuItems}
      />
    );
  }

  if (!playlistId) {
    return (
      <EmptyVideoPage
        title={title}
        message="현재 등록된 영상이 없습니다."
        sideMenuItems={sideMenuItems}
      />
    );
  }

  return (
    <VideoPageShell title={title} sideMenuItems={sideMenuItems}>
      <YoutubeListPage playlistId={playlistId} title={title} />
    </VideoPageShell>
  );
}

export function SundayWorshipPage() {
  return <WorshipVideoPage href="/page/조이풀tv-주일예배" title="주일예배" />;
}
export function WednesdayWorshipPage() {
  return <WorshipVideoPage href="/worship/tv/hebron" title="헤브론 수요예배" />;
}
export function FridayPrayerPage() {
  return <WorshipVideoPage href="/worship/tv/shekhinah" title="쉐키나 금요기도회" />;
}
export function DawnBiblePage() {
  return <WorshipVideoPage href="/worship/tv/gloria" title="새벽 글로리아 성서학당" />;
}
export function PastorSeriesPage() {
  return <WorshipVideoPage href="/worship/tv/pastor-series" title="박진석 목사 시리즈설교" />;
}
export function HaDawnPage() {
  return <WorshipVideoPage href="/worship/tv/hayoungin" title="하영인 새벽기도회 설교" />;
}
export function SpecialWorshipPage() {
  return <WorshipVideoPage href="/worship/tv/special" title="특별예배" />;
}
export function SpecialFeaturePage() {
  return <WorshipVideoPage href="/worship/tv/feature" title="특집" />;
}
export function TestimonyPage() {
  return <WorshipVideoPage href="/worship/tv/testimony" title="간증" />;
}
export function PraisePage() {
  return <WorshipVideoPage href="/worship/tv/praise" title="찬양" />;
}
