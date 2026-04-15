/**
 * 동적 메뉴 페이지
 * - 메뉴 편집 패널에서 설정한 pageType에 따라 다른 UI를 표시합니다
 * - URL 형태: /page/item/:id (2단 메뉴) 또는 /page/sub/:id (3단 메뉴)
 * - 공통 레이아웃(헤더+GNB+브레드크럼+사이드메뉴+푸터)은 SubPageLayout이 담당
 *
 * pageType 종류:
 *   image   → 전체화면 이미지 표시
 *   gallery → 사진 갤러리 그리드
 *   board   → 게시판 목록
 *   youtube → 유튜브 영상 목록
 *   editor  → 텍스트+이미지 에디터 페이지
 */
import { useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import SubPageLayout from "@/components/SubPageLayout";
import { ImageIcon, LayoutGrid, FileText, Youtube, Edit3 } from "lucide-react";

// ─── pageType별 콘텐츠 컴포넌트 ─────────────────────────────────

function ImageContent({ label, imageUrl }: { label: string; imageUrl: string | null }) {
  if (!imageUrl) {
    return (
      <div className="flex flex-col items-center justify-center py-24 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
        <ImageIcon className="w-12 h-12 text-gray-300 mb-3" />
        <p className="text-gray-400 text-sm">아직 이미지가 등록되지 않았습니다.</p>
        <p className="text-gray-300 text-xs mt-1">관리자 메뉴 편집에서 이미지를 설정해 주세요.</p>
      </div>
    );
  }
  return (
    <div className="rounded-xl overflow-hidden shadow-lg">
      <img src={imageUrl} alt={label} className="w-full object-contain max-h-[80vh]" />
    </div>
  );
}

function GalleryContent() {
  const { data: items, isLoading } = trpc.home.gallery.useQuery();
  if (isLoading) return <div className="text-center py-16 text-gray-400">불러오는 중...</div>;
  if ((items ?? []).length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
        <LayoutGrid className="w-12 h-12 text-gray-300 mb-3" />
        <p className="text-gray-400 text-sm">등록된 사진이 없습니다.</p>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
      {(items ?? []).map((item) => (
        <div key={item.id} className="aspect-square rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow">
          <img
            src={item.imageUrl}
            alt={item.caption ?? ""}
            className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
          />
        </div>
      ))}
    </div>
  );
}

function BoardContent() {
  const { data: notices, isLoading } = trpc.home.notices.useQuery();
  if (isLoading) return <div className="text-center py-16 text-gray-400">불러오는 중...</div>;
  if ((notices ?? []).length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
        <FileText className="w-12 h-12 text-gray-300 mb-3" />
        <p className="text-gray-400 text-sm">등록된 게시글이 없습니다.</p>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {(notices ?? []).map((notice) => (
        <div key={notice.id} className="flex items-start gap-4 p-4 bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
          {notice.thumbnailUrl && (
            <img
              src={notice.thumbnailUrl}
              alt={notice.title}
              className="w-16 h-16 object-cover rounded-lg shrink-0"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">{notice.category}</span>
            </div>
            <p className="text-sm font-semibold text-gray-800 truncate">{notice.title}</p>
            {notice.content && (
              <p className="text-xs text-gray-500 truncate mt-0.5">{notice.content}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function YoutubeContent() {
  return (
    <div className="flex flex-col items-center justify-center py-24 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
      <Youtube className="w-12 h-12 text-red-400 mb-3" />
      <p className="text-gray-500 text-sm font-medium">유튜브 영상 목록 페이지</p>
      <p className="text-gray-400 text-xs mt-1">조이풀TV 유튜브 채널과 연동 예정입니다.</p>
    </div>
  );
}

function EditorContent() {
  return (
    <div className="flex flex-col items-center justify-center py-24 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
      <Edit3 className="w-12 h-12 text-blue-400 mb-3" />
      <p className="text-gray-500 text-sm font-medium">텍스트+이미지 편집 페이지</p>
      <p className="text-gray-400 text-xs mt-1">관리자가 직접 내용을 편집할 수 있는 페이지입니다.</p>
    </div>
  );
}

function renderContent(pageType: string, label: string, imageUrl: string | null) {
  switch (pageType) {
    case "image":   return <ImageContent label={label} imageUrl={imageUrl} />;
    case "gallery": return <GalleryContent />;
    case "board":   return <BoardContent />;
    case "youtube": return <YoutubeContent />;
    case "editor":  return <EditorContent />;
    default:        return <ImageContent label={label} imageUrl={imageUrl} />;
  }
}

// ─── 2단 메뉴 동적 페이지 ─────────────────────────────────

export function DynamicMenuItemPage() {
  const { id } = useParams<{ id: string }>();
  const itemId = parseInt(id ?? "0", 10);

  const { data: item, isLoading } = trpc.home.menuItem.useQuery(
    { id: itemId },
    { enabled: !!itemId }
  );
  // 전체 메뉴 데이터 (사이드 메뉴 구성용)
  const { data: allMenus } = trpc.home.menus.useQuery();

  if (isLoading) {
    return (
      <SubPageLayout pageTitle="불러오는 중...">
        <div className="flex items-center justify-center py-24 text-gray-400">페이지 불러오는 중...</div>
      </SubPageLayout>
    );
  }

  if (!item) {
    return (
      <SubPageLayout pageTitle="페이지를 찾을 수 없습니다">
        <div className="flex flex-col items-center justify-center py-24">
          <p className="text-gray-500 text-lg mb-4">요청하신 페이지가 존재하지 않습니다.</p>
        </div>
      </SubPageLayout>
    );
  }

  // 같은 레벨의 형제 메뉴 항목들 (사이드 메뉴)
  // 2단 메뉴의 경우: 같은 상위 메뉴 아래의 다른 2단 메뉴들
  // allMenus에서 현재 item을 포함하는 상위 메뉴 찾기
  const parentMenu = (allMenus ?? []).find(m => (m.items ?? []).some(s => s.href === `/page/item/${itemId}`));
  const sideItems = (parentMenu?.items ?? []).map(s => ({
    id: s.id,
    label: s.label,
    href: s.href ?? null,
    isActive: s.href === `/page/item/${itemId}`,
  }));

  return (
    <SubPageLayout
      pageTitle={item.label}
      parentLabel={parentMenu?.label}
      sideMenuItems={sideItems}
    >
      {renderContent(item.pageType ?? "image", item.label, item.pageImageUrl ?? null)}
    </SubPageLayout>
  );
}

// ─── 3단 메뉴 동적 페이지 ─────────────────────────────────

export function DynamicMenuSubItemPage() {
  const { id } = useParams<{ id: string }>();
  const itemId = parseInt(id ?? "0", 10);

  const { data: item, isLoading } = trpc.home.menuSubItem.useQuery(
    { id: itemId },
    { enabled: !!itemId }
  );
  const { data: allMenus } = trpc.home.menus.useQuery();

  if (isLoading) {
    return (
      <SubPageLayout pageTitle="불러오는 중...">
        <div className="flex items-center justify-center py-24 text-gray-400">페이지 불러오는 중...</div>
      </SubPageLayout>
    );
  }

  if (!item) {
    return (
      <SubPageLayout pageTitle="페이지를 찾을 수 없습니다">
        <div className="flex flex-col items-center justify-center py-24">
          <p className="text-gray-500 text-lg mb-4">요청하신 페이지가 존재하지 않습니다.</p>
        </div>
      </SubPageLayout>
    );
  }

  // 3단 메뉴: 같은 2단 메뉴 아래의 형제 3단 메뉴들을 사이드 메뉴로 표시
  // allMenus에서 현재 sub item을 포함하는 2단 메뉴 찾기
  let parentItemLabel: string | undefined;
  let grandParentLabel: string | undefined;
  let sideItems: { id: number; label: string; href: string | null; isActive?: boolean }[] = [];

  for (const topMenu of (allMenus ?? [])) {
    for (const midMenu of (topMenu.items ?? [])) {
      const subItems = (midMenu as { subItems?: { id: number; label: string; href?: string | null }[] }).subItems ?? [];
      if (subItems.some(s => s.href === `/page/sub/${itemId}`)) {
        parentItemLabel = midMenu.label;
        grandParentLabel = topMenu.label;
        sideItems = subItems.map(s => ({
          id: s.id,
          label: s.label,
          href: s.href ?? null,
          isActive: s.href === `/page/sub/${itemId}`,
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
      {renderContent(item.pageType ?? "image", item.label, item.pageImageUrl ?? null)}
    </SubPageLayout>
  );
}
