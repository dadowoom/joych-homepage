/**
 * 게시판 콘텐츠 컴포넌트
 * pageType="board" 메뉴에서 표시됩니다.
 * 공지사항 목록을 카드 형태로 표시합니다.
 */
import { FileText } from "lucide-react";
import { trpc } from "@/lib/trpc";

export function BoardContent() {
  const { data: notices, isLoading } = trpc.home.notices.useQuery();

  if (isLoading) {
    return <div className="text-center py-16 text-gray-400">불러오는 중...</div>;
  }

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
        <div
          key={notice.id}
          className="flex items-start gap-4 p-4 bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
        >
          {notice.thumbnailUrl && (
            <img
              src={notice.thumbnailUrl}
              alt={notice.title}
              className="w-16 h-16 object-cover rounded-lg shrink-0"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                {notice.category}
              </span>
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
