/**
 * 유튜브 영상 목록 페이지
 * - 첫 번째(최신) 영상: 중앙에 크게 유튜브 플레이어로 표시
 * - 나머지 영상: 아래 카드 슬라이드 (좌우 버튼으로 이동)
 * - 카드 클릭 시 메인 플레이어 영상 전환
 */
import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { ChevronLeft, ChevronRight, PlayCircle } from "lucide-react";

interface YoutubeListPageProps {
  playlistId: number;
  title?: string;
}

export default function YoutubeListPage({ playlistId, title }: YoutubeListPageProps) {
  const { data: videos = [], isLoading } = trpc.youtube.getVideos.useQuery({ playlistId });
  const [activeIndex, setActiveIndex] = useState(0);
  const [slideOffset, setSlideOffset] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const activeVideo = videos[activeIndex];
  const CARDS_PER_VIEW = 4; // 한 번에 보이는 카드 수

  const handlePrev = () => {
    setSlideOffset((prev) => Math.max(0, prev - 1));
  };

  const handleNext = () => {
    setSlideOffset((prev) => Math.min(videos.length - CARDS_PER_VIEW, prev + 1));
  };

  const handleCardClick = (index: number) => {
    setActiveIndex(index);
    // 선택한 카드가 보이도록 슬라이드 조정
    if (index < slideOffset) setSlideOffset(index);
    else if (index >= slideOffset + CARDS_PER_VIEW) setSlideOffset(index - CARDS_PER_VIEW + 1);
  };

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
      <div className="min-h-[300px] flex items-center justify-center">
        <div className="text-center text-gray-400">
          <PlayCircle className="w-16 h-16 mx-auto mb-3 opacity-30" />
          <p className="text-base font-medium">등록된 영상이 없습니다.</p>
          <p className="text-sm mt-1">관리자 패널에서 영상을 추가해 주세요.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* 페이지 제목 */}
      {title && (
        <h2 className="text-2xl font-bold text-[#1B5E20] mb-6" style={{ fontFamily: "'Noto Serif KR', serif" }}>
          {title}
        </h2>
      )}

      {/* 메인 플레이어 */}
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
              <video
                key={activeVideo.videoUrl}
                className="absolute inset-0 w-full h-full rounded-xl shadow-lg bg-black"
                src={activeVideo.videoUrl}
                controls
                playsInline
                preload="metadata"
              />
            ) : null}
          </div>
          <div className="mt-3">
            <h3 className="text-lg font-semibold text-gray-900 leading-tight">{activeVideo.title}</h3>
            {activeVideo.description && (
              <p className="text-sm text-gray-500 mt-1 line-clamp-2">{activeVideo.description}</p>
            )}
          </div>
        </div>
      )}

      {/* 영상 카드 슬라이드 (2개 이상일 때만 표시) */}
      {videos.length > 1 && (
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
              {videos.map((video, index) => (
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
                    <img
                      src={video.thumbnailUrl || (video.videoId ? `https://img.youtube.com/vi/${video.videoId}/mqdefault.jpg` : undefined)}
                      alt={video.title}
                      className="w-full h-full object-cover"
                    />
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
            disabled={slideOffset >= videos.length - CARDS_PER_VIEW}
            className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 z-10 w-9 h-9 rounded-full bg-white shadow-md border border-gray-200 flex items-center justify-center hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            <ChevronRight className="w-5 h-5 text-gray-600" />
          </button>
        </div>
      )}
    </div>
  );
}
