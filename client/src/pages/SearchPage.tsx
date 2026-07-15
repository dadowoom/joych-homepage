import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useSearch } from "wouter";
import {
  ChevronDown,
  ChevronRight,
  ExternalLink,
  FileText,
  FolderOpen,
  ImageIcon,
  Loader2,
  MessageSquareText,
  Search,
  Video,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { splitSearchHighlightParts } from "@/lib/searchHighlight";
import { isExternalSiteHref, normalizeSiteHref } from "@/lib/siteHref";

const GROUP_DISPLAY_LIMIT = 3;
const GALLERY_PAGE_HREF =
  "/page/%EC%BB%A4%EB%AE%A4%EB%8B%88%ED%8B%B0-%EC%B5%9C%EA%B7%BC-%ED%96%89%EC%82%AC-%EC%82%AC%EC%A7%84";
const NOTICE_PAGE_HREF =
  "/page/%ED%96%89%EC%A0%95%EC%A7%80%EC%9B%90-%EA%B3%B5%EC%A7%80%EC%82%AC%ED%95%AD";
const RESOURCE_PAGE_HREF =
  "/page/%ED%96%89%EC%A0%95%EC%A7%80%EC%9B%90-%EC%9E%90%EB%A3%8C%EC%8B%A4";

type ResultLinkType = "internal" | "external" | "none";

type SearchResultItem = {
  id: string | number;
  title: string;
  category: string;
  summary?: string | null;
  date?: string | null;
  href?: string | null;
  linkType: ResultLinkType;
};

type SearchResultGroup = {
  key: string;
  label: string;
  description?: string | null;
  href?: string | null;
  items: SearchResultItem[];
};

type LegacyResultItem = {
  id: string | number;
  title: string;
  category: string;
  summary?: string | null;
  date?: string | null;
  href: string;
};

type LegacySearchResponse = {
  keyword?: string;
  videos?: LegacyResultItem[];
  posts?: LegacyResultItem[];
};

type GroupedSearchResponse = {
  keyword?: string;
  groups?: Array<{
    key: string;
    label: string;
    description?: string | null;
    href?: string | null;
    items?: Array<{
      id: string | number;
      title: string;
      category: string;
      summary?: string | null;
      date?: string | null;
      href?: string | null;
      linkType?: ResultLinkType;
    }>;
  }>;
};

function parseSearchKeyword(searchString: string) {
  return (new URLSearchParams(searchString).get("q") ?? "").trim();
}

function splitHref(href: string) {
  const [pathname, query = ""] = href.split("?");
  return { pathname, query };
}

function appendQueryParam(href: string, key: string, value: string) {
  const { pathname, query } = splitHref(href);
  const params = new URLSearchParams(query);
  params.set(key, value);
  const nextQuery = params.toString();
  return nextQuery ? `${pathname}?${nextQuery}` : pathname;
}

function parseNumericId(value: string | number) {
  if (typeof value === "number" && Number.isFinite(value)) return value;

  const match = String(value).match(/(\d+)$/);
  return match ? Number(match[1]) : null;
}

function normalizeLinkType(
  href: string | null,
  linkType?: ResultLinkType
): ResultLinkType {
  if (linkType) return linkType;
  if (!href) return "none";
  return isExternalSiteHref(href) ? "external" : "internal";
}

function normalizeSearchItem(item: {
  id: string | number;
  title: string;
  category: string;
  summary?: string | null;
  date?: string | null;
  href?: string | null;
  linkType?: ResultLinkType;
}): SearchResultItem {
  const href = normalizeSiteHref(item.href);
  return {
    id: item.id,
    title: item.title,
    category: item.category,
    summary: item.summary ?? null,
    date: item.date ?? null,
    href,
    linkType: normalizeLinkType(href, item.linkType),
  };
}

function normalizeGroup(group: {
  key: string;
  label: string;
  description?: string | null;
  href?: string | null;
  items?: Array<{
    id: string | number;
    title: string;
    category: string;
    summary?: string | null;
    date?: string | null;
    href?: string | null;
    linkType?: ResultLinkType;
  }>;
}): SearchResultGroup {
  return {
    key: group.key,
    label: group.label,
    description: group.description ?? null,
    href: normalizeSiteHref(group.href),
    items: Array.isArray(group.items)
      ? group.items.map(normalizeSearchItem)
      : [],
  };
}

function buildLegacyHref(item: LegacyResultItem) {
  const href = normalizeSiteHref(item.href);
  if (!href) return null;

  const postId = parseNumericId(item.id);
  if (!postId) return href;

  if (href === NOTICE_PAGE_HREF || href === RESOURCE_PAGE_HREF) {
    return appendQueryParam(href, "post", String(postId));
  }

  return href;
}

function buildLegacyGroups(data: LegacySearchResponse): SearchResultGroup[] {
  const videos = (data.videos ?? []).map(item =>
    normalizeSearchItem({
      ...item,
      href: buildLegacyHref(item),
      linkType: "internal",
    })
  );
  const posts = data.posts ?? [];

  const pastorBooks = posts
    .filter(item => item.href.startsWith("/about/pastor/books"))
    .map(item => normalizeSearchItem({ ...item, href: buildLegacyHref(item) }));
  const galleries = posts
    .filter(item => item.href.startsWith(GALLERY_PAGE_HREF))
    .map(item => normalizeSearchItem({ ...item, href: buildLegacyHref(item) }));
  const testimonies = posts
    .filter(item => item.href.startsWith("/community/testimony"))
    .map(item => normalizeSearchItem({ ...item, href: buildLegacyHref(item) }));
  const notices = posts
    .filter(item => normalizeSiteHref(item.href) === NOTICE_PAGE_HREF)
    .map(item => normalizeSearchItem({ ...item, href: buildLegacyHref(item) }));
  const resources = posts
    .filter(item => normalizeSiteHref(item.href) === RESOURCE_PAGE_HREF)
    .map(item => normalizeSearchItem({ ...item, href: buildLegacyHref(item) }));
  const others = posts
    .filter(
      item =>
        !item.href.startsWith("/about/pastor/books") &&
        !item.href.startsWith(GALLERY_PAGE_HREF) &&
        !item.href.startsWith("/community/testimony") &&
        normalizeSiteHref(item.href) !== NOTICE_PAGE_HREF &&
        normalizeSiteHref(item.href) !== RESOURCE_PAGE_HREF
    )
    .map(item => normalizeSearchItem({ ...item, href: buildLegacyHref(item) }));

  return [
    {
      key: "videos",
      label: "예배 영상",
      description: "예배 영상 검색 결과입니다.",
      href: "/worship/tv",
      items: videos,
    },
    {
      key: "pastor-books",
      label: "담임목사님 저서",
      description: "담임목사님 저서 검색 결과입니다.",
      href: "/about/pastor/books",
      items: pastorBooks,
    },
    {
      key: "gallery",
      label: "행사사진",
      description: "최근 행사사진 검색 결과입니다.",
      href: GALLERY_PAGE_HREF,
      items: galleries,
    },
    {
      key: "testimony",
      label: "은혜의 간증",
      description: "간증 게시물 검색 결과입니다.",
      href: "/community/testimony",
      items: testimonies,
    },
    {
      key: "notice",
      label: "공지사항",
      description: "공지사항 검색 결과입니다.",
      href: NOTICE_PAGE_HREF,
      items: notices,
    },
    {
      key: "resource",
      label: "자료실",
      description: "자료실 검색 결과입니다.",
      href: RESOURCE_PAGE_HREF,
      items: resources,
    },
    {
      key: "other",
      label: "기타",
      description: "그 밖의 공개 페이지 검색 결과입니다.",
      href: null,
      items: others,
    },
  ];
}

function normalizeSearchGroups(data: unknown): SearchResultGroup[] {
  const grouped = data as GroupedSearchResponse | undefined;
  if (Array.isArray(grouped?.groups)) {
    return grouped.groups.map(normalizeGroup);
  }

  return buildLegacyGroups((data as LegacySearchResponse | undefined) ?? {});
}

function getGroupIcon(group: SearchResultGroup): ReactNode {
  const value = `${group.key} ${group.label} ${group.href ?? ""}`.toLowerCase();
  if (
    value.includes("video") ||
    value.includes("tv") ||
    value.includes("sermon")
  ) {
    return <Video className="h-4 w-4" />;
  }
  if (
    value.includes("gallery") ||
    value.includes("album") ||
    value.includes("photo")
  ) {
    return <ImageIcon className="h-4 w-4" />;
  }
  if (value.includes("notice") || value.includes("announcement")) {
    return <MessageSquareText className="h-4 w-4" />;
  }
  if (
    value.includes("resource") ||
    value.includes("file") ||
    value.includes("document")
  ) {
    return <FolderOpen className="h-4 w-4" />;
  }
  return <FileText className="h-4 w-4" />;
}

function HighlightedText({ text, keyword }: { text: string; keyword: string }) {
  return (
    <>
      {splitSearchHighlightParts(text, keyword).map((part, index) =>
        part.isMatch ? (
          <mark
            key={`${index}-${part.text}`}
            className="rounded-sm bg-yellow-200 px-0.5 text-inherit decoration-clone"
          >
            {part.text}
          </mark>
        ) : (
          <span key={`${index}-${part.text}`}>{part.text}</span>
        ),
      )}
    </>
  );
}

function ResultRow({ item, keyword }: { item: SearchResultItem; keyword: string }) {
  const isClickable = item.linkType !== "none" && Boolean(item.href);
  const content = (
    <>
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-[#F1F8E9] px-2 py-0.5 text-[11px] font-semibold text-[#1B5E20]">
            <HighlightedText text={item.category} keyword={keyword} />
          </span>
          {item.date && (
            <span className="text-[11px] text-gray-400">{item.date}</span>
          )}
        </div>
        <p className="break-words text-sm font-semibold leading-5 text-gray-950">
          <HighlightedText text={item.title} keyword={keyword} />
        </p>
        {item.summary && (
          <p className="mt-1 line-clamp-2 break-words text-xs leading-5 text-gray-500">
            <HighlightedText text={item.summary} keyword={keyword} />
          </p>
        )}
      </div>
      {isClickable ? (
        item.linkType === "external" ? (
          <ExternalLink className="mt-0.5 h-4 w-4 shrink-0 text-gray-300 group-hover:text-[#1B5E20]" />
        ) : (
          <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-gray-300 group-hover:text-[#1B5E20]" />
        )
      ) : null}
    </>
  );

  const className = `group flex items-start gap-4 rounded-md px-3 py-3 ${
    isClickable ? "transition-colors hover:bg-[#F7FBF5]" : ""
  }`;

  if (!isClickable || !item.href) {
    return <div className={className}>{content}</div>;
  }

  if (item.linkType === "external") {
    return (
      <a
        href={item.href}
        target="_blank"
        rel="noreferrer noopener"
        className={className}
      >
        {content}
      </a>
    );
  }

  return (
    <Link href={item.href} className={className}>
      {content}
    </Link>
  );
}

function GroupLink({ href }: { href: string }) {
  if (isExternalSiteHref(href)) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer noopener"
        className="inline-flex shrink-0 items-center gap-1 rounded-md border border-[#C8E6C9] bg-white px-3 py-1.5 text-xs font-semibold text-[#1B5E20] hover:bg-[#F1F8E9]"
      >
        더보기
        <ExternalLink className="h-3 w-3" />
      </a>
    );
  }

  return (
    <Link
      href={href}
      className="inline-flex shrink-0 items-center gap-1 rounded-md border border-[#C8E6C9] bg-white px-3 py-1.5 text-xs font-semibold text-[#1B5E20] hover:bg-[#F1F8E9]"
    >
      더보기
      <ChevronRight className="h-3 w-3" />
    </Link>
  );
}

function SearchGroupCard({
  group,
  keyword,
  isExpanded,
  onToggle,
}: {
  group: SearchResultGroup;
  keyword: string;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const visibleItems = isExpanded
    ? group.items
    : group.items.slice(0, GROUP_DISPLAY_LIMIT);
  const hiddenCount = Math.max(0, group.items.length - GROUP_DISPLAY_LIMIT);
  const canToggle = group.items.length > GROUP_DISPLAY_LIMIT;

  return (
    <section className="flex min-h-[280px] flex-col overflow-hidden rounded-lg border border-gray-100 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-gray-100 px-4 py-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#E8F5E9] text-[#1B5E20]">
            {getGroupIcon(group)}
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-gray-950">{group.label}</h3>
            {group.description && (
              <p className="mt-1 break-words text-xs leading-5 text-gray-500">
                {group.description}
              </p>
            )}
            <p className="mt-1 text-xs text-gray-400">
              검색 결과 {group.items.length}건
            </p>
          </div>
        </div>
        {group.href ? <GroupLink href={group.href} /> : null}
      </div>

      <div className="divide-y divide-gray-100 p-2">
        {visibleItems.map(item => (
          <ResultRow key={`${group.key}-${item.id}`} item={item} keyword={keyword} />
        ))}
      </div>

      {canToggle && (
        <button
          type="button"
          onClick={onToggle}
          className="mt-auto flex w-full items-center justify-center gap-1 border-t border-gray-100 bg-gray-50 px-4 py-3 text-xs font-semibold text-[#1B5E20] transition-colors hover:bg-[#F1F8E9]"
        >
          {isExpanded ? "접기" : `${hiddenCount}건 더 보기`}
          <ChevronDown
            className={`h-3.5 w-3.5 transition-transform ${isExpanded ? "rotate-180" : ""}`}
          />
        </button>
      )}
    </section>
  );
}

export default function SearchPage() {
  const searchString = useSearch();
  const keyword = parseSearchKeyword(searchString);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(
    {}
  );
  const { data, isLoading } = trpc.search.global.useQuery(
    { q: keyword },
    { enabled: keyword.length > 0, retry: false }
  );

  useEffect(() => {
    setExpandedGroups({});
  }, [keyword]);

  const groups = useMemo(() => normalizeSearchGroups(data as unknown), [data]);
  const visibleGroups = useMemo(
    () => groups.filter(group => group.items.length > 0),
    [groups]
  );
  const totalResults = useMemo(
    () => visibleGroups.reduce((sum, group) => sum + group.items.length, 0),
    [visibleGroups]
  );

  return (
    <main className="min-h-screen bg-[#FAFAF8]">
      <div className="container py-10 sm:py-12">
        <div className="mb-8 border-b-2 border-[#1B5E20] pb-6">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#1B5E20]">
            <Search className="h-4 w-4" />
            통합 검색
          </div>
          <h1 className="break-words font-serif text-2xl font-bold text-gray-950 sm:text-3xl">
            {keyword ? `"${keyword}" 검색 결과` : "검색어를 입력해 주세요"}
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-gray-500">
            예배 영상과 공개 게시물, 행사사진, 공지사항, 자료실 등
            홈페이지에 노출되는 공개 정보를 함께 검색합니다.
          </p>
        </div>

        {!keyword ? (
          <div className="rounded-lg border border-dashed border-gray-200 bg-white px-6 py-16 text-center text-sm text-gray-400">
            상단 검색창에서 찾고 싶은 단어를 입력해 주세요.
          </div>
        ) : isLoading ? (
          <div className="flex items-center justify-center rounded-lg border border-gray-100 bg-white py-20">
            <Loader2 className="mr-2 h-5 w-5 animate-spin text-[#1B5E20]" />
            <span className="text-sm text-gray-500">검색 중입니다.</span>
          </div>
        ) : (
          <div className="grid gap-5">
            <div className="flex flex-col gap-2 rounded-lg border border-[#C8E6C9] bg-[#F1F8E9] px-5 py-4 text-sm text-[#1B5E20] sm:flex-row sm:items-center sm:justify-between">
              <p>
                총 <strong>{totalResults}</strong>건을 찾았습니다.
              </p>
              <p className="text-xs font-medium text-[#2E7D32] sm:text-sm">
                분류 {visibleGroups.length}개
              </p>
            </div>

            {totalResults === 0 ? (
              <div className="rounded-lg border border-dashed border-gray-200 bg-white px-6 py-16 text-center text-sm text-gray-400">
                검색된 내용이 없습니다.
              </div>
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                {visibleGroups.map(group => (
                  <SearchGroupCard
                    key={group.key}
                    group={group}
                    keyword={keyword}
                    isExpanded={Boolean(expandedGroups[group.key])}
                    onToggle={() =>
                      setExpandedGroups(current => ({
                        ...current,
                        [group.key]: !current[group.key],
                      }))
                    }
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
