/**
 * 유튜브 영상 목록 페이지
 * - 첫 번째(최신) 영상: 중앙에 크게 유튜브 플레이어로 표시
 * - 나머지 영상: 아래 카드 슬라이드 (좌우 버튼으로 이동)
 * - 카드 클릭 시 메인 플레이어 영상 전환
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { ChevronLeft, ChevronRight, LayoutGrid, List, PlayCircle, Search, Settings, X } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { canManageBoardContent } from "@/lib/contentPermissions";
import DirectVideoPlayer from "@/components/DirectVideoPlayer";
import YoutubeAdminTab from "@/components/YoutubeAdminTab";

interface YoutubeListPageProps {
  playlistId: number;
  title?: string;
}

function formatSermonDate(value?: string | null) {
  const trimmed = value?.trim();
  if (!trimmed) return "";
  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) return `${match[1]}.${match[2]}.${match[3]}`;
  return trimmed;
}

function getThumbnailUrl(video: {
  videoId?: string | null;
  thumbnailUrl?: string | null;
}) {
  return video.thumbnailUrl || (video.videoId ? `https://img.youtube.com/vi/${video.videoId}/mqdefault.jpg` : null);
}

function VideoThumbnail({ title, src }: { title: string; src: string | null }) {
  if (src) {
    return <img src={src} alt={title} className="h-full w-full object-cover"  loading="lazy"/>;
  }

  return (
    <div className="flex h-full w-full flex-col items-center justify-center bg-[#eef4ed] px-3 text-center">
      <PlayCircle className="mb-2 h-9 w-9 text-[#1B5E20]/60" />
      <span className="line-clamp-2 text-xs font-medium leading-tight text-[#1B5E20]">{title}</span>
    </div>
  );
}

export default function YoutubeListPage({ playlistId, title }: YoutubeListPageProps) {
  const { data: videos = [], isLoading } = trpc.youtube.getVideos.useQuery({ playlistId });
  const { user } = useAuth();
  const canManage = canManageBoardContent(user, "content:youtube");
  const [activeIndex, setActiveIndex] = useState(0);
  const [slideOffset, setSlideOffset] = useState(0);
  const [isEditPanelOpen, setIsEditPanelOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState<"thumbnail" | "list">("thumbnail");
  const containerRef = useRef<HTMLDivElement>(null);
  const filteredVideos = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();
    if (!keyword) return videos;
    return videos.filter((video) => [
      video.title,
      video.preacher,
      video.scripture,
      video.sermonDate,
      formatSermonDate(video.sermonDate),
      video.description,
      video.videoUrl,
    ].some((value) => (value ?? "").toLowerCase().includes(keyword)));
  }, [searchTerm, videos]);

  useEffect(() => {
    setActiveIndex(0);
    setSlideOffset(0);
  }, [playlistId, searchTerm, viewMode]);

  useEffect(() => {
    if (!isEditPanelOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsEditPanelOpen(false);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isEditPanelOpen]);

  const manageButton = canManage ? (
    <button
      type="button"
      onClick={() => setIsEditPanelOpen((current) => !current)}
      className="inline-flex items-center justify-center gap-2 rounded-md bg-[#1B5E20] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#2E7D32]"
    >
      <Settings className="h-4 w-4" />
      {isEditPanelOpen ? "관리 닫기" : "영상 관리"}
    </button>
  ) : null;

  const activeVideo = filteredVideos[activeIndex];
  const LIST_VIEW_LIMIT = 20;
  const listViewVideos = filteredVideos.slice(0, LIST_VIEW_LIMIT);
  const CARDS_PER_VIEW = 4; // 한 번에 보이는 카드 수
  const sermonInfoRows = activeVideo
    ? [
        { label: "제목", value: activeVideo.title },
        { label: "설교자", value: activeVideo.preacher },
        { label: "본문", value: activeVideo.scripture },
        { label: "날짜", value: formatSermonDate(activeVideo.sermonDate) },
      ].filter((row) => row.value?.trim())
    : [];

  const handlePrev = () => {
    setSlideOffset((prev) => Math.max(0, prev - 1));
  };

  const handleNext = () => {
    setSlideOffset((prev) => Math.min(Math.max(0, filteredVideos.length - CARDS_PER_VIEW), prev + 1));
  };

  const handleCardClick = (index: number) => {
    setActiveIndex(index);
    // 선택한 카드가 보이도록 슬라이드 조정
    if (index < slideOffset) setSlideOffset(index);
    else if (index >= slideOffset + CARDS_PER_VIEW) setSlideOffset(index - CARDS_PER_VIEW + 1);
  };

  const managementPanel = canManage && isEditPanelOpen ? (
    <div className="fixed inset-x-0 bottom-0 top-16 z-[80] bg-black/35 md:top-[108px]" role="dialog" aria-modal="true" aria-label="영상 관리">
      <button
        type="button"
        className="absolute inset-0 h-full w-full cursor-default"
        aria-label="영상 관리 닫기"
        onClick={() => setIsEditPanelOpen(false)}
      />
      <aside className="absolute inset-y-0 right-0 flex w-full max-w-[760px] flex-col bg-white shadow-2xl sm:w-[78vw] lg:w-[720px]">
        <div className="flex shrink-0 items-center justify-between border-b border-gray-200 px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[#1B5E20]">Joyful TV</p>
            <h2 className="mt-1 text-lg font-bold text-gray-900">영상 관리</h2>
          </div>
          <button
            type="button"
            onClick={() => setIsEditPanelOpen(false)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-900"
            aria-label="영상 관리 닫기"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          <YoutubeAdminTab />
        </div>
      </aside>
    </div>
  ) : null;

  if (isLoading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="text-center text-gray-400">
          <div className="w-10 h-10 border-4 border-[#1B5E20] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm">영상을 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (videos.length === 0) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {title && (
            <h2 className="text-2xl font-bold text-[#1B5E20]" style={{ fontFamily: "'Noto Serif KR', serif" }}>
              {title}
            </h2>
          )}
          {manageButton}
        </div>
        {managementPanel}
        <div className="min-h-[300px] flex items-center justify-center rounded-xl border border-gray-100 bg-white">
          <div className="text-center text-gray-400">
            <PlayCircle className="w-16 h-16 mx-auto mb-3 opacity-30" />
            <p className="text-base font-medium">현재 등록된 영상이 없습니다.</p>
            <p className="text-sm mt-1">영상이 준비되는 대로 이곳에서 보실 수 있습니다.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* 페이지 제목 */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {title && (
          <h2 className="text-2xl font-bold text-[#1B5E20]" style={{ fontFamily: "'Noto Serif KR', serif" }}>
            {title}
          </h2>
        )}
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:min-w-[360px] sm:flex-row sm:items-center sm:justify-end">
          <label className="relative min-w-0 flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="설교제목, 날짜 검색"
              className="h-10 w-full rounded-md border border-gray-300 bg-white pl-9 pr-3 text-sm outline-none focus:border-[#1B5E20]"
            />
          </label>
          <div className="flex shrink-0 rounded-md border border-gray-200 bg-white p-0.5">
            <button
              type="button"
              onClick={() => setViewMode("thumbnail")}
              className={`inline-flex h-9 items-center gap-1.5 rounded px-3 text-xs font-semibold ${
                viewMode === "thumbnail" ? "bg-[#1B5E20] text-white" : "text-gray-500 hover:bg-gray-50"
              }`}
            >
              <LayoutGrid className="h-4 w-4" />
              썸네일
            </button>
            <button
              type="button"
              onClick={() => setViewMode("list")}
              className={`inline-flex h-9 items-center gap-1.5 rounded px-3 text-xs font-semibold ${
                viewMode === "list" ? "bg-[#1B5E20] text-white" : "text-gray-500 hover:bg-gray-50"
              }`}
            >
              <List className="h-4 w-4" />
              목록
            </button>
          </div>
          {manageButton}
        </div>
      </div>
      {managementPanel}

      {/* 메인 플레이어 */}
      {filteredVideos.length === 0 && (
        <div className="min-h-[260px] rounded-xl border border-dashed border-gray-200 bg-white p-10 text-center text-gray-400">
          <PlayCircle className="mx-auto mb-3 h-12 w-12 opacity-30" />
          <p className="text-base font-medium">검색 결과가 없습니다.</p>
          <p className="mt-1 text-sm">설교제목, 날짜, 설교자, 본문을 다시 확인해 주세요.</p>
        </div>
      )}

      {activeVideo && (
        <div className="mb-6">
          <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
            {activeVideo.videoId ? (
              <iframe
                key={activeVideo.videoId}
                className="absolute inset-0 w-full h-full rounded-xl shadow-lg"
                src={`https://www.youtube.com/embed/${activeVideo.videoId}?autoplay=0&rel=0`}
                title={activeVideo.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            ) : activeVideo.videoUrl ? (
              <DirectVideoPlayer
                src={activeVideo.videoUrl}
                title={activeVideo.title}
                className="absolute inset-0 w-full h-full rounded-xl shadow-lg bg-black"
              />
            ) : null}
          </div>
          <div className="mt-4 overflow-hidden rounded-md border border-gray-200 bg-white">
            {sermonInfoRows.map((row) => (
              <div key={row.label} className="flex border-b border-gray-100 last:border-b-0">
                <div className="flex w-20 shrink-0 items-center justify-center bg-gray-600 px-3 py-2 text-sm font-semibold text-white sm:w-24">
                  {row.label}
                </div>
                <div className="flex min-w-0 flex-1 items-center px-4 py-2 text-sm text-gray-800 sm:text-base">
                  <span className="break-words leading-relaxed">{row.value}</span>
                </div>
              </div>
            ))}
          </div>
          {activeVideo.description && (
            <div className="mt-3">
              <p className="whitespace-pre-line text-sm leading-relaxed text-gray-500 line-clamp-3">
                {activeVideo.description}
              </p>
            </div>
          )}
        </div>
      )}

      {/* 영상 카드 슬라이드 (2개 이상일 때만 표시) */}
      {viewMode === "list" && filteredVideos.length > 0 && (
        <div>
          <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
            {listViewVideos.map((video, index) => (
              <button
                key={video.id}
                type="button"
                onClick={() => handleCardClick(index)}
                className={`flex w-full items-center gap-3 border-b border-gray-100 p-3 text-left last:border-b-0 ${
                  index === activeIndex ? "bg-[#F1F8E9]" : "hover:bg-gray-50"
                }`}
              >
                <div className="h-16 w-28 shrink-0 overflow-hidden rounded bg-gray-100">
                  <VideoThumbnail title={video.title} src={getThumbnailUrl(video)} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-gray-900">{video.title}</p>
                  <p className="mt-1 truncate text-xs text-gray-500">
                    {[video.preacher, formatSermonDate(video.sermonDate), video.scripture].filter(Boolean).join(" · ")}
                  </p>
                </div>
              </button>
            ))}
          </div>
          {filteredVideos.length > LIST_VIEW_LIMIT && (
            <p className="mt-2 text-right text-xs text-gray-400">
              목록은 최근 {LIST_VIEW_LIMIT}개까지만 표시됩니다. 검색으로 더 좁혀 볼 수 있습니다.
            </p>
          )}
        </div>
      )}

      {viewMode === "thumbnail" && filteredVideos.length > 1 && (
        <div className="relative">
          {/* 좌측 버튼 */}
          <button
            onClick={handlePrev}
            disabled={slideOffset === 0}
            className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 z-10 w-9 h-9 rounded-full bg-white shadow-md border border-gray-200 flex items-center justify-center hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>

          {/* 카드 목록 */}
          <div ref={containerRef} className="overflow-hidden">
            <div
              className="flex gap-3 transition-transform duration-300"
              style={{ transform: `translateX(calc(-${slideOffset} * (100% / ${CARDS_PER_VIEW} + 0.75rem)))` }}
            >
              {filteredVideos.map((video, index) => (
                <button
                  key={video.id}
                  onClick={() => handleCardClick(index)}
                  className={`flex-shrink-0 w-[calc(25%-0.5625rem)] rounded-lg overflow-hidden border-2 transition-all text-left ${
                    index === activeIndex
                      ? "border-[#1B5E20] shadow-md"
                      : "border-transparent hover:border-gray-300"
                  }`}
                >
                  {/* 썸네일 */}
                  <div className="relative aspect-video bg-gray-100">
                    <VideoThumbnail title={video.title} src={getThumbnailUrl(video)} />
                    {index === activeIndex && (
                      <div className="absolute inset-0 bg-[#1B5E20]/20 flex items-center justify-center">
                        <PlayCircle className="w-8 h-8 text-white drop-shadow" />
                      </div>
                    )}
                  </div>
                  {/* 제목 */}
                  <div className="p-2 bg-white">
                    <p className="text-xs font-medium text-gray-800 line-clamp-2 leading-tight">{video.title}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* 우측 버튼 */}
          <button
            onClick={handleNext}
            disabled={slideOffset >= filteredVideos.length - CARDS_PER_VIEW}
            className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 z-10 w-9 h-9 rounded-full bg-white shadow-md border border-gray-200 flex items-center justify-center hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            <ChevronRight className="w-5 h-5 text-gray-600" />
          </button>
        </div>
      )}
    </div>
  );
}
