/**
 * 이미지 전체화면 콘텐츠 컴포넌트
 * pageType="image" 메뉴에서 표시됩니다.
 * 이미지 클릭 시 라이트박스로 원본 크기를 볼 수 있습니다.
 */
import { useState } from "react";
import { ImageIcon, ZoomIn } from "lucide-react";
import { Lightbox } from "./Lightbox";

export function ImageContent({
  label,
  imageUrl,
}: {
  label: string;
  imageUrl: string | null;
}) {
  const [lightboxOpen, setLightboxOpen] = useState(false);

  if (!imageUrl) {
    return (
      <div className="flex flex-col items-center justify-center py-32 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
        <ImageIcon className="w-14 h-14 text-gray-200 mb-4" />
        <p className="text-gray-400 text-base font-medium mb-1">
          아직 이미지가 등록되지 않았습니다.
        </p>
        <p className="text-gray-300 text-sm">
          편집 모드 → 메뉴 편집 → 해당 메뉴 선택 후 이미지를 업로드해 주세요.
        </p>
      </div>
    );
  }

  return (
    <>
      <div
        className="relative w-full overflow-hidden rounded-xl shadow-lg cursor-zoom-in group"
        onClick={() => setLightboxOpen(true)}
      >
        <img src={imageUrl} alt={label} className="w-full h-auto object-cover block" />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
          <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 rounded-full p-3 shadow-lg">
            <ZoomIn className="w-6 h-6 text-gray-700" />
          </div>
        </div>
      </div>
      <p className="text-center text-xs text-gray-400 mt-2">
        이미지를 클릭하면 크게 볼 수 있습니다.
      </p>
      {lightboxOpen && (
        <Lightbox imageUrl={imageUrl} alt={label} onClose={() => setLightboxOpen(false)} />
      )}
    </>
  );
}
