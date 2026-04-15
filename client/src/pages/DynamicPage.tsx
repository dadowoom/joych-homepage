/**
 * 동적 메뉴 페이지
 * - 메뉴 편집 패널에서 설정한 pageType에 따라 다른 UI를 표시합니다
 * - URL 형태: /page/item/:id (2단 메뉴) 또는 /page/sub/:id (3단 메뉴)
 *
 * pageType 종류:
 *   image   → 전체화면 이미지 표시
 *   gallery → 사진 갤러리 그리드
 *   board   → 게시판 목록
 *   youtube → 유튜브 영상 목록
 *   editor  → 텍스트+이미지 에디터 페이지
 */
import { useParams, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, ImageIcon, LayoutGrid, FileText, Youtube, Edit3 } from "lucide-react";

// ─── pageType별 페이지 컴포넌트 ─────────────────────────────────

/** image 타입: pageImageUrl을 전체화면으로 표시 */
function ImagePage({ label, imageUrl }: { label: string; imageUrl: string | null }) {
  return (
    <div className="min-h-screen bg-[#FAFAF8]">
      <div className="container py-10">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-[#1B5E20] mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" /> 홈으로
        </Link>
        <h1 className="text-2xl font-bold text-gray-800 mb-6" style={{ fontFamily: "'Noto Serif KR', serif" }}>{label}</h1>
        {imageUrl ? (
          <div className="rounded-xl overflow-hidden shadow-lg">
            <img src={imageUrl} alt={label} className="w-full object-contain max-h-[80vh]" />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-24 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
            <ImageIcon className="w-12 h-12 text-gray-300 mb-3" />
            <p className="text-gray-400 text-sm">아직 이미지가 등록되지 않았습니다.</p>
            <p className="text-gray-300 text-xs mt-1">관리자 메뉴 편집에서 이미지를 설정해 주세요.</p>
          </div>
        )}
      </div>
    </div>
  );
}

/** gallery 타입: 갤러리 그리드 표시 */
function GalleryPage({ label }: { label: string }) {
  const { data: items, isLoading } = trpc.home.gallery.useQuery();
  return (
    <div className="min-h-screen bg-[#FAFAF8]">
      <div className="container py-10">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-[#1B5E20] mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" /> 홈으로
        </Link>
        <h1 className="text-2xl font-bold text-gray-800 mb-6" style={{ fontFamily: "'Noto Serif KR', serif" }}>{label}</h1>
        {isLoading ? (
          <div className="text-center py-16 text-gray-400">불러오는 중...</div>
        ) : (items ?? []).length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
            <LayoutGrid className="w-12 h-12 text-gray-300 mb-3" />
            <p className="text-gray-400 text-sm">등록된 사진이 없습니다.</p>
          </div>
        ) : (
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
        )}
      </div>
    </div>
  );
}

/** board 타입: 게시판 목록 표시 */
function BoardPage({ label }: { label: string }) {
  const { data: notices, isLoading } = trpc.home.notices.useQuery();
  return (
    <div className="min-h-screen bg-[#FAFAF8]">
      <div className="container py-10">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-[#1B5E20] mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" /> 홈으로
        </Link>
        <h1 className="text-2xl font-bold text-gray-800 mb-6" style={{ fontFamily: "'Noto Serif KR', serif" }}>{label}</h1>
        {isLoading ? (
          <div className="text-center py-16 text-gray-400">불러오는 중...</div>
        ) : (notices ?? []).length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
            <FileText className="w-12 h-12 text-gray-300 mb-3" />
            <p className="text-gray-400 text-sm">등록된 게시글이 없습니다.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {(notices ?? []).map((notice) => (
              <div key={notice.id} className="flex items-start gap-4 p-4 bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
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
        )}
      </div>
    </div>
  );
}

/** youtube 타입: 유튜브 영상 목록 표시 */
function YoutubePage({ label }: { label: string }) {
  return (
    <div className="min-h-screen bg-[#FAFAF8]">
      <div className="container py-10">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-[#1B5E20] mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" /> 홈으로
        </Link>
        <h1 className="text-2xl font-bold text-gray-800 mb-6" style={{ fontFamily: "'Noto Serif KR', serif" }}>{label}</h1>
        <div className="flex flex-col items-center justify-center py-24 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
          <Youtube className="w-12 h-12 text-red-400 mb-3" />
          <p className="text-gray-500 text-sm font-medium">유튜브 영상 목록 페이지</p>
          <p className="text-gray-400 text-xs mt-1">조이풀TV 유튜브 채널과 연동 예정입니다.</p>
        </div>
      </div>
    </div>
  );
}

/** editor 타입: 텍스트+이미지 에디터 페이지 */
function EditorPage({ label }: { label: string }) {
  return (
    <div className="min-h-screen bg-[#FAFAF8]">
      <div className="container py-10">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-[#1B5E20] mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" /> 홈으로
        </Link>
        <h1 className="text-2xl font-bold text-gray-800 mb-6" style={{ fontFamily: "'Noto Serif KR', serif" }}>{label}</h1>
        <div className="flex flex-col items-center justify-center py-24 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
          <Edit3 className="w-12 h-12 text-blue-400 mb-3" />
          <p className="text-gray-500 text-sm font-medium">텍스트+이미지 편집 페이지</p>
          <p className="text-gray-400 text-xs mt-1">관리자가 직접 내용을 편집할 수 있는 페이지입니다.</p>
        </div>
      </div>
    </div>
  );
}

// ─── 2단 메뉴 동적 페이지 ─────────────────────────────────

export function DynamicMenuItemPage() {
  const { id } = useParams<{ id: string }>();
  const itemId = parseInt(id ?? "0", 10);

  const { data: item, isLoading } = trpc.home.menuItem.useQuery(
    { id: itemId },
    { enabled: !!itemId }
  );

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-400 text-sm">페이지 불러오는 중...</div>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <p className="text-gray-500 text-lg mb-4">페이지를 찾을 수 없습니다.</p>
        <Link href="/" className="text-[#1B5E20] hover:underline text-sm">홈으로 돌아가기</Link>
      </div>
    );
  }

  switch (item.pageType) {
    case "image":
      return <ImagePage label={item.label} imageUrl={item.pageImageUrl ?? null} />;
    case "gallery":
      return <GalleryPage label={item.label} />;
    case "board":
      return <BoardPage label={item.label} />;
    case "youtube":
      return <YoutubePage label={item.label} />;
    case "editor":
      return <EditorPage label={item.label} />;
    default:
      return <ImagePage label={item.label} imageUrl={item.pageImageUrl ?? null} />;
  }
}

// ─── 3단 메뉴 동적 페이지 ─────────────────────────────────

export function DynamicMenuSubItemPage() {
  const { id } = useParams<{ id: string }>();
  const itemId = parseInt(id ?? "0", 10);

  const { data: item, isLoading } = trpc.home.menuSubItem.useQuery(
    { id: itemId },
    { enabled: !!itemId }
  );

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-400 text-sm">페이지 불러오는 중...</div>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <p className="text-gray-500 text-lg mb-4">페이지를 찾을 수 없습니다.</p>
        <Link href="/" className="text-[#1B5E20] hover:underline text-sm">홈으로 돌아가기</Link>
      </div>
    );
  }

  switch (item.pageType) {
    case "image":
      return <ImagePage label={item.label} imageUrl={item.pageImageUrl ?? null} />;
    case "gallery":
      return <GalleryPage label={item.label} />;
    case "board":
      return <BoardPage label={item.label} />;
    case "youtube":
      return <YoutubePage label={item.label} />;
    case "editor":
      return <EditorPage label={item.label} />;
    default:
      return <ImagePage label={item.label} imageUrl={item.pageImageUrl ?? null} />;
  }
}
