import { useMemo, useState } from "react";
import { FileText } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { FreeBoardContent } from "./FreeBoardContent";

type BoardContentProps = {
  label?: string;
  href?: string | null;
};

function isFreeBoardPage(label?: string, href?: string | null) {
  const normalized = `${label ?? ""} ${href ?? ""}`.replace(/\s+/g, "");
  return normalized.includes("자유게시판") || normalized.includes("joytalk");
}

const CATEGORY_ORDER = ["공지", "행사", "찬양", "선교", "기타"];

function NoticeBoardContent() {
  const [activeCategory, setActiveCategory] = useState("전체");
  const { data: notices, isLoading } = trpc.home.noticeBoard.useQuery();
  const categories = useMemo(() => {
    const values = Array.from(new Set((notices ?? []).map((notice) => notice.category).filter(Boolean)));
    return values.sort((a, b) => {
      const aIndex = CATEGORY_ORDER.indexOf(a);
      const bIndex = CATEGORY_ORDER.indexOf(b);
      if (aIndex !== -1 || bIndex !== -1) {
        return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
      }
      return a.localeCompare(b, "ko-KR");
    });
  }, [notices]);
  const filteredNotices = activeCategory === "전체"
    ? notices ?? []
    : (notices ?? []).filter((notice) => notice.category === activeCategory);

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
    <div className="space-y-5">
      <div className="flex flex-col gap-3 border-b border-gray-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-gray-500">
          총 <span className="font-semibold text-[#1B5E20]">{filteredNotices.length}</span>개의 소식
        </p>
        <div className="flex flex-wrap gap-2">
          {["전체", ...categories].map((category) => {
            const isActive = activeCategory === category;
            return (
              <button
                key={category}
                type="button"
                onClick={() => setActiveCategory(category)}
                className={`h-9 rounded-full border px-4 text-sm font-medium transition-colors ${
                  isActive
                    ? "border-[#1B5E20] bg-[#1B5E20] text-white"
                    : "border-gray-200 bg-white text-gray-500 hover:border-[#1B5E20]/30 hover:text-[#1B5E20]"
                }`}
              >
                {category}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-3">
        {filteredNotices.map((notice) => (
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
        {filteredNotices.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
            <FileText className="w-10 h-10 text-gray-300 mb-3" />
            <p className="text-gray-400 text-sm">해당 카테고리의 소식이 없습니다.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export function BoardContent({ label, href }: BoardContentProps = {}) {
  if (isFreeBoardPage(label, href)) {
    return <FreeBoardContent />;
  }
  return <NoticeBoardContent />;
}
