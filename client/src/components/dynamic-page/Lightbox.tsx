/**
 * 라이트박스 컴포넌트
 * 이미지 클릭 시 화면 전체를 어둡게 하고 원본 크기로 보여주는 팝업입니다.
 * ESC 키 또는 배경 클릭으로 닫을 수 있습니다.
 */
import { useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

export function Lightbox({
  imageUrl,
  alt,
  caption,
  currentLabel,
  onClose,
  onPrevious,
  onNext,
}: {
  imageUrl: string;
  alt: string;
  caption?: string | null;
  currentLabel?: string;
  onClose: () => void;
  onPrevious?: () => void;
  onNext?: () => void;
}) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") onPrevious?.();
      if (e.key === "ArrowRight") onNext?.();
    },
    [onClose, onPrevious, onNext]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [handleKeyDown]);

  return (
    <div
      className="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <button
        className="absolute top-4 right-4 text-white/80 hover:text-white bg-black/40 hover:bg-black/60 rounded-full p-2 transition-colors"
        onClick={onClose}
        aria-label="닫기"
      >
        <X className="w-6 h-6" />
      </button>
      {onPrevious && (
        <button
          className="absolute left-4 top-1/2 -translate-y-1/2 text-white/80 hover:text-white bg-black/40 hover:bg-black/60 rounded-full p-3 transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            onPrevious();
          }}
          aria-label="이전 사진"
        >
          <ChevronLeft className="w-7 h-7" />
        </button>
      )}
      {onNext && (
        <button
          className="absolute right-4 top-1/2 -translate-y-1/2 text-white/80 hover:text-white bg-black/40 hover:bg-black/60 rounded-full p-3 transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            onNext();
          }}
          aria-label="다음 사진"
        >
          <ChevronRight className="w-7 h-7" />
        </button>
      )}
      <img
        src={imageUrl}
        alt={alt}
        className="max-w-full max-h-[86vh] object-contain rounded-lg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />
      <div className="absolute bottom-4 left-4 right-4 text-center text-white">
        {caption && (
          <p className="mx-auto max-w-3xl text-sm sm:text-base font-medium drop-shadow">
            {caption}
          </p>
        )}
        <p className="mt-1 text-white/70 text-xs">
          {currentLabel ? `${currentLabel} · ` : ""}ESC 키 또는 배경 클릭으로 닫기
        </p>
      </div>
    </div>
  );
}
