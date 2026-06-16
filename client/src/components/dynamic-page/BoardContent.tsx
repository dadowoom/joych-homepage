import { Fragment, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, FileText } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { FreeBoardContent } from "./FreeBoardContent";
import { ViewModeToggle, type ViewMode } from "./ViewModeToggle";

type BoardContentProps = {
  label?: string;
  href?: string | null;
};

function isFreeBoardPage(label?: string, href?: string | null) {
  const normalized = `${label ?? ""} ${href ?? ""}`.replace(/\s+/g, "");
  return normalized.includes("자유게시판") || normalized.includes("joytalk");
}

const NOTICE_CATEGORIES = ["공지", "부고", "결혼"] as const;
const ALL_NOTICE_CATEGORIES = ["전체", ...NOTICE_CATEGORIES] as const;

function normalizeNoticeCategory(category?: string | null) {
  const value = category?.trim();
  if (value === "부고" || value === "결혼") return value;
  return "공지";
}

function formatBoardDate(value: string | Date) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}.${month}.${day}`;
}

function isToday(value: string | Date) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const today = new Date();
  return date.getFullYear() === today.getFullYear()
    && date.getMonth() === today.getMonth()
    && date.getDate() === today.getDate();
}

function NoticeBoardContent() {
  const [activeCategory, setActiveCategory] = useState("전체");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [page, setPage] = useState(1);
  const [searchField, setSearchField] = useState("title");
  const [searchInput, setSearchInput] = useState("");
  const [searchKeyword, setSearchKeyword] = useState("");
  const { data: notices, isLoading } = trpc.home.noticeBoard.useQuery();
  const sortedNotices = useMemo(() => {
    return [...(notices ?? [])].sort((a, b) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [notices]);
  const categoryFilteredNotices = activeCategory === "전체"
    ? sortedNotices
    : sortedNotices.filter((notice) => normalizeNoticeCategory(notice.category) === activeCategory);
  const normalizedKeyword = searchKeyword.trim().toLowerCase();
  const filteredNotices = normalizedKeyword
    ? categoryFilteredNotices.filter((notice) => {
        const titleText = notice.title.toLowerCase();
        const categoryText = normalizeNoticeCategory(notice.category).toLowerCase();
        const contentText = (notice.content ?? "").toLowerCase();
        if (searchField === "category") return categoryText.includes(normalizedKeyword);
        if (searchField === "content") return contentText.includes(normalizedKeyword);
        return titleText.includes(normalizedKeyword);
      })
    : categoryFilteredNotices;
  const pageSize = 15;
  const totalPages = Math.max(1, Math.ceil(filteredNotices.length / pageSize));
  const activePage = Math.min(page, totalPages);
  const pageStart = (activePage - 1) * pageSize;
  const visibleNotices = filteredNotices.slice(pageStart, pageStart + pageSize);
  const pageNumbers = Array.from({ length: totalPages }, (_, index) => index + 1);
  const newNoticeCount = filteredNotices.filter((notice) => isToday(notice.createdAt)).length;

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
      <div className="border-b border-gray-100 pb-4">
        <p className="text-sm text-gray-500">
          총 <span className="font-semibold text-[#1B5E20]">{notices?.length ?? 0}</span>개의 소식
          {(activeCategory !== "전체" || searchKeyword) && (
            <span className="ml-2 text-gray-400">표시 {filteredNotices.length}개</span>
          )}
        </p>
        <p className="mt-1 text-xs text-gray-400">공지와 안내를 게시판 형태로 확인할 수 있습니다.</p>
      </div>

      <div className="flex flex-col gap-3 border-b border-[#86C5D8] pb-2 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <ViewModeToggle value={viewMode} onChange={setViewMode} />
          <span>새 글 {newNoticeCount} / {filteredNotices.length}</span>
        </div>
        <form
          className="flex min-w-0 flex-wrap justify-end gap-1"
          onSubmit={(event) => {
            event.preventDefault();
            setSearchKeyword(searchInput);
            setPage(1);
          }}
        >
          <select
            value={activeCategory}
            onChange={(event) => {
              setActiveCategory(event.target.value);
              setPage(1);
            }}
            className="h-8 rounded-none border border-gray-300 bg-white px-2 text-xs text-gray-700 outline-none focus:border-[#1B5E20]"
            aria-label="분류"
          >
            {ALL_NOTICE_CATEGORIES.map((category) => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
          <select
            value={searchField}
            onChange={(event) => setSearchField(event.target.value)}
            className="h-8 rounded-none border border-gray-300 bg-white px-2 text-xs text-gray-700 outline-none focus:border-[#1B5E20]"
            aria-label="검색 조건"
          >
            <option value="title">제목</option>
            <option value="content">내용</option>
            <option value="category">분류</option>
          </select>
          <input
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            className="h-8 min-w-0 flex-1 rounded-none border border-gray-300 px-2 text-xs outline-none focus:border-[#1B5E20] md:w-48"
            aria-label="검색어"
          />
          <button
            type="submit"
            className="h-8 border border-[#86C5D8] px-2 text-xs text-[#1B5E20] hover:bg-[#F1F8E9]"
            aria-label="검색"
          >
            검색
          </button>
        </form>
      </div>

      <div className="flex flex-wrap gap-2">
        {ALL_NOTICE_CATEGORIES.map((category) => {
          const isActive = activeCategory === category;
          return (
            <button
              key={category}
              type="button"
              onClick={() => {
                setActiveCategory(category);
                setPage(1);
              }}
              className={`h-8 border px-3 text-xs font-medium transition-colors ${
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

      {filteredNotices.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-gray-50 border-2 border-dashed border-gray-200">
          <FileText className="w-10 h-10 text-gray-300 mb-3" />
          <p className="text-gray-400 text-sm">해당 조건의 게시글이 없습니다.</p>
        </div>
      ) : (
        <>
          <div className={`${viewMode === "list" ? "hidden md:block" : "hidden"} overflow-hidden border border-gray-200 bg-white`}>
            <table className="w-full table-fixed text-sm">
              <colgroup>
                <col className="w-16" />
                <col />
                <col className="w-32" />
                <col className="w-32" />
              </colgroup>
              <thead className="border-t-2 border-[#62B5D1] bg-[#EAF8FC] text-[#0F607A]">
                <tr>
                  <th scope="col" className="px-3 py-3 text-center font-semibold">번호</th>
                  <th scope="col" className="px-3 py-3 text-center font-semibold">제목</th>
                  <th scope="col" className="px-3 py-3 text-center font-semibold">작성자</th>
                  <th scope="col" className="px-3 py-3 text-center font-semibold">등록일</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {visibleNotices.map((notice, index) => {
                  const postNumber = notice.isPinned ? "공지" : String(filteredNotices.length - (pageStart + index));
                  const isExpanded = expandedId === notice.id;
                  const displayCategory = normalizeNoticeCategory(notice.category);
                  return (
                    <Fragment key={notice.id}>
                      <tr className="transition-colors hover:bg-gray-50">
                        <td className="px-3 py-3 text-center text-gray-500">
                          {notice.isPinned ? (
                            <span className="inline-flex min-w-10 justify-center bg-[#1B5E20] px-2 py-0.5 text-xs font-semibold text-white">공지</span>
                          ) : postNumber}
                        </td>
                        <td className="px-3 py-3">
                          <button
                            type="button"
                            onClick={() => setExpandedId(isExpanded ? null : notice.id)}
                            className="block max-w-full truncate text-left text-gray-800 hover:text-[#1B5E20]"
                            aria-expanded={isExpanded}
                          >
                            <span className="mr-2 text-xs text-[#1B5E20]">[{displayCategory}]</span>
                            {notice.title}
                            {notice.thumbnailUrl && <span className="ml-2 text-[#0F8FB3]">▣</span>}
                          </button>
                        </td>
                        <td className="px-3 py-3 text-center text-gray-600">관리자</td>
                        <td className="px-3 py-3 text-center text-gray-500">{formatBoardDate(notice.createdAt)}</td>
                      </tr>
                      {isExpanded && (
                        <tr className="bg-gray-50/70">
                          <td colSpan={4} className="px-8 py-5">
                            {notice.thumbnailUrl && (
                              <img
                                src={notice.thumbnailUrl}
                                alt=""
                                className="mb-4 max-h-64 max-w-full border border-gray-100 object-contain"
                                onError={(event) => {
                                  (event.target as HTMLImageElement).style.display = "none";
                                }}
                              />
                            )}
                            <div className="whitespace-pre-line border-l-2 border-[#1B5E20]/30 pl-4 text-sm leading-7 text-gray-700">
                              {notice.content || "등록된 본문 내용이 없습니다."}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className={viewMode === "grid" ? "grid gap-4 md:grid-cols-2" : "divide-y divide-gray-100 border border-gray-200 bg-white md:hidden"}>
            {visibleNotices.map((notice, index) => {
              const postNumber = notice.isPinned ? "공지" : String(filteredNotices.length - (pageStart + index));
              const isExpanded = expandedId === notice.id;
              const displayCategory = normalizeNoticeCategory(notice.category);
              return (
                <article key={notice.id} className={viewMode === "grid" ? "border border-gray-200 bg-white p-4" : "p-4"}>
                  <div className="mb-2 flex items-center justify-between gap-3 text-xs text-gray-400">
                    <span>{postNumber}</span>
                    <span>{formatBoardDate(notice.createdAt)}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setExpandedId(isExpanded ? null : notice.id)}
                    className="block w-full text-left text-base font-bold text-gray-900"
                    aria-expanded={isExpanded}
                  >
                    <span className="mr-2 text-xs text-[#1B5E20]">[{displayCategory}]</span>
                    {notice.title}
                  </button>
                  <p className="mt-1 text-xs font-medium text-[#1B5E20]">관리자</p>
                  {isExpanded && (
                    <div className="mt-4 border-l-2 border-[#1B5E20]/30 pl-3 text-sm leading-6 text-gray-700">
                      {notice.thumbnailUrl && (
                        <img
                          src={notice.thumbnailUrl}
                          alt=""
                          className="mb-4 max-h-56 max-w-full border border-gray-100 object-contain"
                          onError={(event) => {
                            (event.target as HTMLImageElement).style.display = "none";
                          }}
                        />
                      )}
                      <p className="whitespace-pre-line">{notice.content || "등록된 본문 내용이 없습니다."}</p>
                    </div>
                  )}
                </article>
              );
            })}
          </div>

          <div className="flex justify-center gap-1">
            <button
              type="button"
              onClick={() => setPage(Math.max(1, activePage - 1))}
              disabled={activePage === 1}
              className="inline-flex h-8 w-8 items-center justify-center border border-gray-200 text-gray-500 hover:border-[#1B5E20]/40 hover:text-[#1B5E20] disabled:opacity-40"
              aria-label="이전 페이지"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            {pageNumbers.map((pageNumber) => (
              <button
                key={pageNumber}
                type="button"
                onClick={() => setPage(pageNumber)}
                className={`inline-flex h-8 min-w-8 items-center justify-center border px-2 text-sm ${
                  activePage === pageNumber
                    ? "border-[#1B5E20] bg-[#1B5E20] text-white"
                    : "border-gray-200 text-gray-500 hover:border-[#1B5E20]/40 hover:text-[#1B5E20]"
                }`}
                aria-current={activePage === pageNumber ? "page" : undefined}
              >
                {pageNumber}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setPage(Math.min(totalPages, activePage + 1))}
              disabled={activePage === totalPages}
              className="inline-flex h-8 w-8 items-center justify-center border border-gray-200 text-gray-500 hover:border-[#1B5E20]/40 hover:text-[#1B5E20] disabled:opacity-40"
              aria-label="다음 페이지"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export function BoardContent({ label, href }: BoardContentProps = {}) {
  if (isFreeBoardPage(label, href)) {
    return <FreeBoardContent />;
  }
  return <NoticeBoardContent />;
}
