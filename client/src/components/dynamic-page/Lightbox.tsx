/**
 * 라이트박스 컴포넌트
 * 이미지 클릭 시 화면 전체를 어둡게 하고 원본 크기로 보여주는 팝업입니다.
 * ESC 키 또는 배경 클릭으로 닫을 수 있습니다.
 */
import { useEffect, useCallback, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, RotateCcw, X, ZoomIn, ZoomOut } from "lucide-react";

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
  const [scale, setScale] = useState(1);
  const imageRef = useRef<HTMLImageElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const scaleRef = useRef(1);
  const positionRef = useRef({ x: 0, y: 0 });
  const pinchStartDistanceRef = useRef<number | null>(null);
  const pinchStartScaleRef = useRef(1);
  const panStartRef = useRef<{ x: number; y: number; offsetX: number; offsetY: number } | null>(null);

  const applyTransform = useCallback((nextScale: number, nextPosition: { x: number; y: number }) => {
    scaleRef.current = nextScale;
    positionRef.current = nextPosition;

    if (animationFrameRef.current !== null) return;

    animationFrameRef.current = requestAnimationFrame(() => {
      const image = imageRef.current;
      if (image) {
        image.style.transform = `translate3d(${positionRef.current.x}px, ${positionRef.current.y}px, 0) scale3d(${scaleRef.current}, ${scaleRef.current}, 1)`;
      }
      animationFrameRef.current = null;
    });
  }, []);

  const resetZoom = useCallback(() => {
    setScale(1);
    applyTransform(1, { x: 0, y: 0 });
  }, [applyTransform]);

  const updateScale = useCallback((nextScale: number, syncState = true) => {
    const clampedScale = Math.min(Math.max(nextScale, 1), 4);
    if (syncState) setScale(clampedScale);
    applyTransform(clampedScale, clampedScale === 1 ? { x: 0, y: 0 } : positionRef.current);
  }, [applyTransform]);

  const getTouchDistance = (
    first: { clientX: number; clientY: number },
    second: { clientX: number; clientY: number }
  ) => {
    return Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY);
  };

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") onPrevious?.();
      if (e.key === "ArrowRight") onNext?.();
    },
    [onClose, onPrevious, onNext]
  );

  useEffect(() => {
    resetZoom();
  }, [imageUrl, resetZoom]);

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
      if (animationFrameRef.current !== null) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [handleKeyDown]);

  return (
    <div
      className="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <button
        className="absolute right-4 top-4 z-10 rounded-full bg-black/40 p-2 text-white/80 transition-colors hover:bg-black/60 hover:text-white"
        onClick={onClose}
        aria-label="닫기"
      >
        <X className="w-6 h-6" />
      </button>
      <div className="absolute left-4 top-4 z-10 flex items-center gap-2">
        <button
          type="button"
          className="rounded-full bg-black/40 p-2 text-white/80 transition-colors hover:bg-black/60 hover:text-white disabled:opacity-40"
          onClick={(event) => {
            event.stopPropagation();
            updateScale(scaleRef.current - 0.5);
          }}
          disabled={scale <= 1}
          aria-label="이미지 축소"
        >
          <ZoomOut className="h-5 w-5" />
        </button>
        <button
          type="button"
          className="rounded-full bg-black/40 p-2 text-white/80 transition-colors hover:bg-black/60 hover:text-white"
          onClick={(event) => {
            event.stopPropagation();
            updateScale(scaleRef.current + 0.5);
          }}
          aria-label="이미지 확대"
        >
          <ZoomIn className="h-5 w-5" />
        </button>
        {scale > 1 && (
          <button
            type="button"
            className="rounded-full bg-black/40 p-2 text-white/80 transition-colors hover:bg-black/60 hover:text-white"
            onClick={(event) => {
              event.stopPropagation();
              resetZoom();
            }}
            aria-label="확대 초기화"
          >
            <RotateCcw className="h-5 w-5" />
          </button>
        )}
      </div>
      {onPrevious && (
        <button
          className="absolute left-4 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/40 p-3 text-white/80 transition-colors hover:bg-black/60 hover:text-white"
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
          className="absolute right-4 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/40 p-3 text-white/80 transition-colors hover:bg-black/60 hover:text-white"
          onClick={(e) => {
            e.stopPropagation();
            onNext();
          }}
          aria-label="다음 사진"
        >
          <ChevronRight className="w-7 h-7" />
        </button>
      )}
      <div
        className="absolute inset-0 z-0 flex touch-none items-center justify-center overflow-hidden"
        onClick={(event) => event.stopPropagation()}
        onTouchStart={(event) => {
          if (event.touches.length === 2) {
            pinchStartDistanceRef.current = getTouchDistance(event.touches[0], event.touches[1]);
            pinchStartScaleRef.current = scaleRef.current;
            panStartRef.current = null;
            return;
          }

          if (event.touches.length === 1 && scaleRef.current > 1) {
            const touch = event.touches[0];
            panStartRef.current = {
              x: touch.clientX,
              y: touch.clientY,
              offsetX: positionRef.current.x,
              offsetY: positionRef.current.y,
            };
          }
        }}
        onTouchMove={(event) => {
          if (event.touches.length === 2 && pinchStartDistanceRef.current) {
            event.preventDefault();
            const nextDistance = getTouchDistance(event.touches[0], event.touches[1]);
            updateScale(pinchStartScaleRef.current * (nextDistance / pinchStartDistanceRef.current), false);
            return;
          }

          if (event.touches.length === 1 && panStartRef.current && scaleRef.current > 1) {
            event.preventDefault();
            const touch = event.touches[0];
            applyTransform(scaleRef.current, {
              x: panStartRef.current.offsetX + touch.clientX - panStartRef.current.x,
              y: panStartRef.current.offsetY + touch.clientY - panStartRef.current.y,
            });
          }
        }}
        onTouchEnd={() => {
          pinchStartDistanceRef.current = null;
          panStartRef.current = null;
          setScale(scaleRef.current);
        }}
        onTouchCancel={() => {
          pinchStartDistanceRef.current = null;
          panStartRef.current = null;
          setScale(scaleRef.current);
        }}
      >
        <img
          ref={imageRef}
          src={imageUrl}
          alt={alt}
          className="max-h-[calc(100dvh-2rem)] max-w-[calc(100vw-2rem)] select-none rounded-lg object-contain shadow-2xl will-change-transform"
          draggable={false}
        />
      </div>
      <div className="absolute bottom-4 left-4 right-4 z-10 text-center text-white">
        {caption && (
          <p className="mx-auto max-w-3xl text-sm sm:text-base font-medium drop-shadow">
            {caption}
          </p>
        )}
        <p className="mt-1 text-white/70 text-xs">
          {currentLabel ? `${currentLabel} · ` : ""}두 손가락으로 확대하고, 확대 후 한 손가락으로 이동할 수 있습니다.
        </p>
      </div>
    </div>
  );
}
