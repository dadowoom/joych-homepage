/**
 * 갤러리 콘텐츠 컴포넌트
 * pageType="gallery" 메뉴에서 표시됩니다.
 * 관리자 페이지에서 등록한 갤러리 사진을 그리드로 표시합니다.
 */
import { useState } from "react";
import { LayoutGrid, ZoomIn } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Lightbox } from "./Lightbox";

export function GalleryContent() {
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const { data: items, isLoading } = trpc.home.gallery.useQuery();

  if (isLoading) {
    return <div className="text-center py-16 text-gray-400">불러오는 중...</div>;
  }

  if ((items ?? []).length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
        <LayoutGrid className="w-12 h-12 text-gray-300 mb-3" />
        <p className="text-gray-400 text-sm">등록된 사진이 없습니다.</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {(items ?? []).map((item) => (
          <div
            key={item.id}
            className="aspect-square rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow cursor-zoom-in group relative"
            onClick={() => setLightboxUrl(item.imageUrl)}
          >
            <img
              src={item.imageUrl}
              alt={item.caption ?? ""}
              className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
              <ZoomIn className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>
        ))}
      </div>
      {lightboxUrl && (
        <Lightbox
          imageUrl={lightboxUrl}
          alt="갤러리 사진"
          onClose={() => setLightboxUrl(null)}
        />
      )}
    </>
  );
}
