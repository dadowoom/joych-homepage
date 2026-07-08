import { Link, useSearch } from "wouter";
import { useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight, FileText, Loader2, Search, Video } from "lucide-react";
import { trpc } from "@/lib/trpc";

const GROUP_DISPLAY_LIMIT = 3;
const GALLERY_PAGE_HREF =
  "/page/%EC%BB%A4%EB%AE%A4%EB%8B%88%ED%8B%B0-%EC%B5%9C%EA%B7%BC-%ED%96%89%EC%82%AC-%EC%82%AC%EC%A7%84";
const NOTICE_PAGE_HREF =
  "/page/%ED%96%89%EC%A0%95%EC%A7%80%EC%9B%90-%EA%B3%B5%EC%A7%80%EC%82%AC%ED%95%AD";
const RESOURCE_PAGE_HREF =
  "/page/%ED%96%89%EC%A0%95%EC%A7%80%EC%9B%90-%EC%9E%90%EB%A3%8C%EC%8B%A4";

type ResultItem = {
  id: string | number;
  title: string;
  category: string;
  summary?: string | null;
  date?: string | null;
  href: string;
};

type SearchGroup = {
  label: string;
  description: string;
  href: string;
  items: ResultItem[];
  icon: ReactNode;
};

function ResultRow({ item }: { item: ResultItem }) {
  return (
    <Link
      href={item.href}
      className="group flex items-center gap-4 rounded-md px-3 py-3 transition-colors hover:bg-[#F7FBF5]"
    >
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-[#F1F8E9] px-2 py-0.5 text-xs font-semibold text-[#1B5E20]">
            {item.category}
          </span>
          {item.date && <span className="text-xs text-gray-400">{item.date}</span>}
        </div>
        <p className="truncate text-sm font-semibold text-gray-950">{item.title}</p>
        {item.summary && <p className="mt-1 line-clamp-2 text-xs leading-5 text-gray-500">{item.summary}</p>}
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-gray-300 group-hover:text-[#1B5E20]" />
    </Link>
  );
}

function SearchGroupCard({ group }: { group: SearchGroup }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const visibleItems = isExpanded ? group.items : group.items.slice(0, GROUP_DISPLAY_LIMIT);
  const hiddenCount = Math.max(0, group.items.length - visibleItems.length);
  const canToggle = group.items.length > GROUP_DISPLAY_LIMIT;

  return (
    <section className="flex min-h-[300px] flex-col rounded-lg border border-gray-100 bg-white shadow-sm">
      <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-4 py-4">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#E8F5E9] text-[#1B5E20]">
            {group.icon}
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-gray-950">{group.label}</h3>
            <p className="mt-1 line-clamp-2 text-xs leading-5 text-gray-500">{group.description}</p>
            <p className="mt-1 text-xs text-gray-400">검색 결과 {group.items.length}건</p>
          </div>
        </div>
        <Link
          href={group.href}
          className="inline-flex shrink-0 items-center gap-1 rounded-md border border-[#C8E6C9] bg-white px-3 py-1.5 text-xs font-semibold text-[#1B5E20] hover:bg-[#F1F8E9]"
        >
          더보기
          <ChevronRight className="h-3 w-3" />
        </Link>
      </div>

      {visibleItems.length === 0 ? (
        <div className="flex flex-1 items-center justify-center px-4 py-10 text-center text-xs text-gray-400">
          검색된 내용이 없습니다.
        </div>
      ) : (
        <div className="divide-y divide-gray-100 p-2">
          {visibleItems.map((item) => (
            <ResultRow key={`${group.label}-${item.id}`} item={item} />
          ))}
        </div>
      )}

      {canToggle && (
        <button
          type="button"
          onClick={() => setIsExpanded((current) => !current)}
          className="mt-auto flex w-full items-center justify-center gap-1 border-t border-gray-100 bg-gray-50 px-4 py-3 text-xs font-semibold text-[#1B5E20] transition-colors hover:bg-[#F1F8E9]"
        >
          {isExpanded ? "접기" : `${hiddenCount}건 더 보기`}
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
        </button>
      )}
    </section>
  );
}

export default function SearchPage() {
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);
  const keyword = (params.get("q") ?? "").trim();
  const { data, isLoading } = trpc.search.global.useQuery(
    { q: keyword },
    { enabled: keyword.length > 0, retry: false },
  );

  const posts = data?.posts ?? [];
  const videos = data?.videos ?? [];
  const searchGroups: SearchGroup[] = [
    {
      label: "설교/영상",
      description: "조이풀TV 영상 제목, 설교자, 본문, 설명에서 찾은 결과입니다.",
      href: "/worship/tv",
      items: videos,
      icon: <Video className="h-4 w-4" />,
    },
    {
      label: "담임목사님 저서",
      description: "담임목사님 저서 제목과 책 소개에서 찾은 결과입니다.",
      href: "/about/pastor/books",
      items: posts.filter((item) => item.category === "담임목사님 저서"),
      icon: <FileText className="h-4 w-4" />,
    },
    {
      label: "행사사진",
      description: "최근 행사 사진 앨범과 사진 설명에서 찾은 결과입니다.",
      href: GALLERY_PAGE_HREF,
      items: posts.filter((item) => item.category === "행사사진"),
      icon: <FileText className="h-4 w-4" />,
    },
    {
      label: "은혜의 간증",
      description: "은혜의 간증 제목과 본문에서 찾은 결과입니다.",
      href: "/community/testimony",
      items: posts.filter((item) => item.category === "은혜의 간증"),
      icon: <FileText className="h-4 w-4" />,
    },
    {
      label: "공지사항",
      description: "공지사항 제목과 내용에서 찾은 결과입니다.",
      href: NOTICE_PAGE_HREF,
      items: posts.filter((item) => item.category === "공지사항"),
      icon: <FileText className="h-4 w-4" />,
    },
    {
      label: "자료실",
      description: "자료실 제목, 내용, 첨부파일명에서 찾은 결과입니다.",
      href: RESOURCE_PAGE_HREF,
      items: posts.filter((item) => item.category === "자료실"),
      icon: <FileText className="h-4 w-4" />,
    },
  ];
  const total = videos.length + posts.length;
  const visibleGroups = searchGroups.filter((group) => group.items.length > 0);

  return (
    <main className="min-h-screen bg-[#FAFAF8]">
      <div className="container py-12">
        <div className="mb-8 border-b-2 border-[#1B5E20] pb-6">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#1B5E20]">
            <Search className="h-4 w-4" />
            통합 검색
          </div>
          <h1 className="font-serif text-3xl font-bold text-gray-950">
            {keyword ? `"${keyword}" 검색 결과` : "검색어를 입력해 주세요"}
          </h1>
          <p className="mt-3 text-sm text-gray-500">
            설교/영상과 게시물(담임목사님 저서, 행사사진, 은혜의 간증, 공지사항, 자료실)을 함께 검색합니다.
          </p>
        </div>

        {!keyword ? (
          <div className="rounded-lg border border-dashed border-gray-200 bg-white py-20 text-center text-gray-400">
            상단 검색창에서 찾고 싶은 단어를 입력해 주세요.
          </div>
        ) : isLoading ? (
          <div className="flex items-center justify-center rounded-lg border border-gray-100 bg-white py-20">
            <Loader2 className="mr-2 h-5 w-5 animate-spin text-[#1B5E20]" />
            <span className="text-sm text-gray-500">검색 중입니다.</span>
          </div>
        ) : (
          <div className="grid gap-5">
            <div className="rounded-lg border border-[#C8E6C9] bg-[#F1F8E9] px-5 py-4 text-sm text-[#1B5E20]">
              총 <strong>{total}</strong>건을 찾았습니다.
            </div>

            {total === 0 ? (
              <div className="rounded-lg border border-dashed border-gray-200 bg-white py-20 text-center text-sm text-gray-400">
                검색된 내용이 없습니다.
              </div>
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                {visibleGroups.map((group) => (
                  <SearchGroupCard key={group.label} group={group} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
