/**
 * 블록 렌더러 컴포넌트
 * 에디터 페이지(pageType="editor")에서 각 블록을 화면에 그리는 컴포넌트입니다.
 * blockType에 따라 텍스트, 이미지, 유튜브, 버튼, 구분선 등을 렌더링합니다.
 */
import { useState } from "react";
import { ZoomIn } from "lucide-react";
import { Lightbox } from "./Lightbox";

// ─── 블록 콘텐츠 타입 정의 ────────────────────────────────────────────────────
export type BlockContent = {
  text?: string;
  urls?: string[];
  captions?: string[];
  videoId?: string;
  title?: string;
  label?: string;
  href?: string;
  style?: string;
  fontSize?: number;
  align?: "left" | "center" | "right";
  thickness?: number;
  lineStyle?: "solid" | "dashed" | "dotted";
};

export function parseContent(raw: string): BlockContent {
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

// ─── 블록 타입 선택지 (BlockEditDialog에서도 사용) ────────────────────────────
export const BLOCK_TYPES = [
  { value: "text-h1", label: "제목 1 (H1)", icon: "T" },
  { value: "text-h2", label: "제목 2 (H2)", icon: "T" },
  { value: "text-h3", label: "제목 3 (H3)", icon: "T" },
  { value: "text-body", label: "본문", icon: "¶" },
  { value: "image-single", label: "이미지 1장", icon: "🖼" },
  { value: "image-double", label: "이미지 2장", icon: "🖼" },
  { value: "image-triple", label: "이미지 3장", icon: "🖼" },
  { value: "youtube", label: "유튜브", icon: "▶" },
  { value: "button", label: "버튼/링크", icon: "🔗" },
  { value: "divider", label: "구분선", icon: "—" },
] as const;

// ─── 블록 렌더러 ──────────────────────────────────────────────────────────────
export function BlockRenderer({
  block,
}: {
  block: { id: number; blockType: string; content: string };
}) {
  const [imgLightbox, setImgLightbox] = useState<string | null>(null);
  const c = parseContent(block.content);

  const textStyle: React.CSSProperties = {
    fontSize: c.fontSize ? `${c.fontSize}px` : undefined,
    textAlign: (c.align as React.CSSProperties["textAlign"]) ?? "left",
  };

  switch (block.blockType) {
    case "text-h1":
      return (
        <h1
          className="font-bold text-gray-900 leading-tight mt-8 mb-4"
          style={{
            fontFamily: "'Noto Serif KR', serif",
            fontSize: c.fontSize ? `${c.fontSize}px` : undefined,
            textAlign: (c.align as React.CSSProperties["textAlign"]) ?? "left",
          }}
        >
          {c.text}
        </h1>
      );
    case "text-h2":
      return (
        <h2
          className="font-bold text-gray-800 leading-tight mt-6 mb-3 border-b-2 border-green-600 pb-2"
          style={textStyle}
        >
          {c.text}
        </h2>
      );
    case "text-h3":
      return (
        <h3 className="font-semibold text-gray-700 mt-5 mb-2" style={textStyle}>
          {c.text}
        </h3>
      );
    case "text-body":
      return (
        <p className="text-gray-700 leading-relaxed mb-4 whitespace-pre-wrap" style={textStyle}>
          {c.text}
        </p>
      );
    case "image-single":
      return (
        <>
          <div className="my-4">
            {(c.urls ?? []).slice(0, 1).map((url, i) => (
              <div
                key={i}
                className="rounded-xl overflow-hidden shadow-md cursor-zoom-in group relative"
                onClick={() => setImgLightbox(url)}
              >
                <img src={url} alt={c.captions?.[i] ?? ""} className="w-full h-auto object-cover" />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                  <ZoomIn className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>
            ))}
            {c.captions?.[0] && (
              <p className="text-center text-xs text-gray-400 mt-2">{c.captions[0]}</p>
            )}
          </div>
          {imgLightbox && (
            <Lightbox imageUrl={imgLightbox} alt="" onClose={() => setImgLightbox(null)} />
          )}
        </>
      );
    case "image-double":
    case "image-triple": {
      const cols = block.blockType === "image-triple" ? "grid-cols-3" : "grid-cols-2";
      return (
        <>
          <div className={`grid ${cols} gap-3 my-4`}>
            {(c.urls ?? []).map((url, i) => (
              <div
                key={i}
                className="rounded-lg overflow-hidden shadow-sm cursor-zoom-in group relative"
                onClick={() => setImgLightbox(url)}
              >
                <img
                  src={url}
                  alt={c.captions?.[i] ?? ""}
                  className="w-full h-full object-cover aspect-square"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                  <ZoomIn className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>
            ))}
          </div>
          {imgLightbox && (
            <Lightbox imageUrl={imgLightbox} alt="" onClose={() => setImgLightbox(null)} />
          )}
        </>
      );
    }
    case "youtube":
      return (
        <div className="my-4 rounded-xl overflow-hidden shadow-md aspect-video">
          <iframe
            src={`https://www.youtube.com/embed/${c.videoId}`}
            title={c.title ?? "유튜브 영상"}
            className="w-full h-full"
            allowFullScreen
          />
        </div>
      );
    case "button":
      return (
        <div className="my-4">
          <a
            href={c.href ?? "#"}
            target={c.href?.startsWith("http") ? "_blank" : undefined}
            rel={c.href?.startsWith("http") ? "noopener noreferrer" : undefined}
            className={
              c.style === "outline"
                ? "inline-block px-6 py-3 border-2 border-green-700 text-green-700 rounded-lg font-medium hover:bg-green-50 transition-colors"
                : "inline-block px-6 py-3 bg-green-700 text-white rounded-lg font-medium hover:bg-green-800 transition-colors"
            }
          >
            {c.label ?? "링크"}
          </a>
        </div>
      );
    case "divider": {
      const thickness = c.thickness ?? 1;
      const lineStyle = c.lineStyle ?? "solid";
      return (
        <div className="my-6">
          <hr
            style={{
              borderTopWidth: `${thickness}px`,
              borderTopStyle: lineStyle,
              borderColor: "#d1d5db",
            }}
          />
        </div>
      );
    }
    default:
      return null;
  }
}
