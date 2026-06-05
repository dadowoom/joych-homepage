/**
 * 갤러리 콘텐츠 컴포넌트
 * pageType="gallery" 메뉴에서 표시됩니다.
 * 관리자 페이지에서 등록한 갤러리 사진을 그리드로 표시합니다.
 */
import { useState } from "react";
import { CalendarDays, Camera, Images, LayoutGrid, ZoomIn } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Lightbox } from "./Lightbox";

const GRID_SPAN_CLASS: Record<string, string> = {
  "col-span-1 row-span-1": "",
  "col-span-2 row-span-1": "sm:col-span-2",
  "col-span-1 row-span-2": "sm:row-span-2",
  "col-span-2 row-span-2": "sm:col-span-2 sm:row-span-2",
};

function getGalleryCaption(item: { caption?: string | null }, index: number) {
  const caption = item.caption?.trim();
  return caption || `최근 행사 사진 ${index + 1}`;
}

function formatGalleryDate(value: unknown) {
  if (!value) return null;

  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return null;

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}.${month}.${day}`;
}

export function GalleryContent() {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const { data: items, isLoading } = trpc.home.gallery.useQuery();
  const galleryItems = items ?? [];
  const activeItem = lightboxIndex === null ? null : galleryItems[lightboxIndex];

  if (isLoading) {
    return <div className="text-center py-16 text-gray-400">불러오는 중...</div>;
  }

  if (galleryItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
        <LayoutGrid className="w-12 h-12 text-gray-300 mb-3" />
        <p className="text-gray-400 text-sm">등록된 사진이 없습니다.</p>
      </div>
    );
  }

  return (
    <>
      <div className="mb-6 flex flex-col gap-4 border-b border-gray-100 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="inline-flex items-center gap-2 text-sm font-semibold text-[#1B5E20]">
            <Camera className="h-4 w-4" />
            Joyful Gallery
          </p>
          <p className="mt-2 text-sm leading-6 text-gray-500">
            기쁨의교회 공동체의 예배와 사역 현장을 사진으로 전합니다.
          </p>
        </div>
        <div className="inline-flex w-fit items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm text-gray-600 shadow-sm">
          <Images className="h-4 w-4 text-[#1B5E20]" />
          총 <span className="font-semibold text-[#1B5E20]">{galleryItems.length}</span>장
        </div>
      </div>

      <div className="grid auto-rows-[220px] grid-cols-1 gap-4 sm:auto-rows-[170px] sm:grid-cols-2 lg:auto-rows-[190px] lg:grid-cols-4">
        {galleryItems.map((item, index) => {
          const isFeature = index === 0;
          const caption = getGalleryCaption(item, index);
          const dateLabel = formatGalleryDate(item.createdAt);
          const spanClass = isFeature
            ? "sm:col-span-2 sm:row-span-2"
            : GRID_SPAN_CLASS[item.gridSpan ?? ""] ?? "";

          return (
            <button
              key={item.id}
              type="button"
              className={`group relative h-full w-full overflow-hidden rounded-lg bg-gray-100 text-left shadow-sm ring-1 ring-gray-100 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B5E20] ${spanClass}`}
              onClick={() => setLightboxIndex(index)}
              aria-label={`${caption} 크게 보기`}
            >
              <img
                src={item.imageUrl}
                alt={caption}
                loading={index === 0 ? "eager" : "lazy"}
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-transparent opacity-85 transition-opacity duration-300 group-hover:opacity-95" />
              <div className="absolute left-0 right-0 bottom-0 p-4 text-white">
                {isFeature && (
                  <span className="mb-2 inline-flex rounded-full bg-[#1B5E20] px-3 py-1 text-xs font-semibold">
                    대표 사진
                  </span>
                )}
                <p className={`${isFeature ? "text-lg sm:text-xl" : "text-sm"} font-semibold leading-snug line-clamp-2 drop-shadow`}>
                  {caption}
                </p>
                {dateLabel && (
                  <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-white/80">
                    <CalendarDays className="h-3.5 w-3.5" />
                    {dateLabel}
                  </p>
                )}
              </div>
              <span className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-[#1B5E20] opacity-0 shadow-sm transition-opacity duration-300 group-hover:opacity-100">
                <ZoomIn className="h-4 w-4" />
              </span>
            </button>
          );
        })}
      </div>
      {activeItem && lightboxIndex !== null && (
        <Lightbox
          imageUrl={activeItem.imageUrl}
          alt={getGalleryCaption(activeItem, lightboxIndex)}
          caption={getGalleryCaption(activeItem, lightboxIndex)}
          currentLabel={`${lightboxIndex + 1} / ${galleryItems.length}`}
          onClose={() => setLightboxIndex(null)}
          onPrevious={
            galleryItems.length > 1
              ? () =>
                  setLightboxIndex((current) =>
                    current === null
                      ? current
                      : (current - 1 + galleryItems.length) % galleryItems.length
                  )
              : undefined
          }
          onNext={
            galleryItems.length > 1
              ? () =>
                  setLightboxIndex((current) =>
                    current === null ? current : (current + 1) % galleryItems.length
                  )
              : undefined
          }
        />
      )}
    </>
  );
}
