/**
 * 블록 렌더러 컴포넌트
 * 에디터 페이지(pageType="editor")에서 각 블록을 화면에 그리는 컴포넌트입니다.
 * blockType에 따라 텍스트, 이미지, 유튜브, 버튼, 구분선 등을 렌더링합니다.
 */
import { useState } from "react";
import { ZoomIn } from "lucide-react";
import { RichTextViewer } from "@/components/ui/rich-text-editor";
import { Lightbox } from "./Lightbox";
import { normalizeHtmlBlockValue } from "./htmlBlockUtils";

// ─── 블록 콘텐츠 타입 정의 ────────────────────────────────────────────────────
export type BlockContent = {
  text?: string;
  html?: string;
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
  { value: "html-rich", label: "HTML 편집기", icon: "H" },
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

function SingleImageBlock({
  url,
  alt,
  onClick,
}: {
  url: string;
  alt: string;
  onClick: () => void;
}) {
  const [isLongImage, setIsLongImage] = useState(false);

  return (
    <div
      className={`relative mx-auto flex justify-center overflow-hidden rounded-xl bg-white shadow-md cursor-zoom-in group ${
        isLongImage ? "w-full max-w-2xl" : "w-fit max-w-full md:max-w-4xl"
      }`}
      onClick={onClick}
    >
      <img
        src={url}
        alt={alt}
        loading="lazy"
        onLoad={(event) => {
          const { naturalWidth, naturalHeight } = event.currentTarget;
          setIsLongImage(naturalWidth > 0 && naturalHeight / naturalWidth > 1.6);
        }}
        className={`block max-w-full object-contain ${
          isLongImage ? "h-auto w-full" : "max-h-[72vh] w-auto"
        }`}
      />
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
        <ZoomIn className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </div>
  );
}

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
    case "html-rich":
      return (
        <RichTextViewer
          className="my-6 max-w-full text-base leading-8"
          html={normalizeHtmlBlockValue(c.html ?? c.text)}
        />
      );
    case "text-h1":
      return (
        <h1
          className="mt-8 mb-4 min-w-0 max-w-full break-words font-bold leading-tight text-gray-900 [overflow-wrap:anywhere]"
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
          className="mt-6 mb-3 min-w-0 max-w-full break-words border-b-2 border-green-600 pb-2 font-bold leading-tight text-gray-800 [overflow-wrap:anywhere]"
          style={textStyle}
        >
          {c.text}
        </h2>
      );
    case "text-h3":
      return (
        <h3
          className="mt-5 mb-2 min-w-0 max-w-full break-words font-semibold text-gray-700 [overflow-wrap:anywhere]"
          style={textStyle}
        >
          {c.text}
        </h3>
      );
    case "text-body":
      return (
        <p
          className="mb-4 min-w-0 max-w-full overflow-x-hidden whitespace-pre-wrap break-words leading-relaxed text-gray-700 [overflow-wrap:anywhere]"
          style={textStyle}
        >
          {c.text}
        </p>
      );
    case "image-single":
      return (
        <>
          <div className="my-4">
            {(c.urls ?? []).slice(0, 1).map((url, i) => (
              <SingleImageBlock
                key={i}
                url={url}
                alt={c.captions?.[i] ?? ""}
                onClick={() => setImgLightbox(url)}
              />
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
      const cols = block.blockType === "image-triple" ? "sm:grid-cols-3" : "sm:grid-cols-2";
      return (
        <>
          <div className={`my-4 grid grid-cols-1 ${cols} gap-3`}>
            {(c.urls ?? []).map((url, i) => (
              <div
                key={i}
                className="group relative min-w-0 cursor-zoom-in overflow-hidden rounded-lg shadow-sm"
                onClick={() => setImgLightbox(url)}
              >
                <img
                  src={url}
                  alt={c.captions?.[i] ?? ""}
                  loading="lazy"
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
    case "button": {
      const buttonClassName =
        c.style === "outline"
          ? "inline-block max-w-full whitespace-normal break-words rounded-lg border-2 border-green-700 px-6 py-3 text-center font-medium text-green-700 transition-colors hover:bg-green-50 [overflow-wrap:anywhere]"
          : "inline-block max-w-full whitespace-normal break-words rounded-lg bg-green-700 px-6 py-3 text-center font-medium text-white transition-colors hover:bg-green-800 [overflow-wrap:anywhere]";
      if (!c.href?.trim()) {
        return (
          <div className="my-4">
            <span className={`${buttonClassName} cursor-default`}>
              {c.label ?? "링크"}
            </span>
          </div>
        );
      }
      return (
        <div className="my-4">
          <a
            href={c.href}
            target={c.href.startsWith("http") ? "_blank" : undefined}
            rel={c.href.startsWith("http") ? "noopener noreferrer" : undefined}
            className={buttonClassName}
          >
            {c.label ?? "링크"}
          </a>
        </div>
      );
    }
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
