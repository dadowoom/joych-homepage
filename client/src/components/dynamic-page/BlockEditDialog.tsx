/**
 * 블록 편집 다이얼로그 컴포넌트
 * 관리자가 에디터 페이지에서 블록을 추가하거나 수정할 때 사용하는 팝업입니다.
 * 블록 종류(텍스트, 이미지, 유튜브, 버튼, 구분선)에 따라 다른 입력 폼을 보여줍니다.
 */
import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Code2, Eye, Pencil, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RichTextEditor, RichTextViewer } from "@/components/ui/rich-text-editor";
import { trpc } from "@/lib/trpc";
import { BLOCK_TYPES, HTML_EDITOR_BLOCK_TYPE } from "./BlockRenderer";
import { normalizeHtmlBlockValue } from "./htmlBlockUtils";

type DialogSize = {
  width: number;
  height: number;
};

type DialogOffset = {
  x: number;
  y: number;
};

type DialogInteraction =
  | {
      mode: "move";
      pointerId: number;
      startX: number;
      startY: number;
      startOffset: DialogOffset;
    }
  | {
      mode: "resize";
      pointerId: number;
      startX: number;
      startY: number;
      startSize: DialogSize;
    };

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

const VISUAL_EDITOR_ALLOWED_TAGS = new Set([
  "a",
  "blockquote",
  "br",
  "col",
  "colgroup",
  "em",
  "h2",
  "h3",
  "hr",
  "img",
  "li",
  "ol",
  "p",
  "s",
  "span",
  "strong",
  "table",
  "tbody",
  "td",
  "th",
  "thead",
  "tr",
  "u",
  "ul",
]);
const VISUAL_EDITOR_STYLE_TAGS = new Set([
  "a",
  "blockquote",
  "col",
  "h2",
  "h3",
  "img",
  "li",
  "ol",
  "p",
  "span",
  "strong",
  "table",
  "td",
  "th",
  "tr",
  "u",
  "ul",
]);
const STYLE_BLOCK_PATTERN = /<\s*style\b[^>]*>[\s\S]*?<\s*\/\s*style\s*>/i;
const OPENING_TAG_PATTERN = /<([a-z0-9-]+)\b([^>]*)>/gi;
const HTML_SOURCE_LINE_BREAK_PATTERN = /(<\/(?:blockquote|div|h[1-6]|li|ol|p|section|table|tbody|td|th|thead|tr|ul)>|<br\s*\/?>)/gi;
const HTML_SOURCE_BLOCK_START_PATTERN = /(<(?:blockquote|div|h[1-6]|li|ol|p|section|table|tbody|td|th|thead|tr|ul)\b[^>]*>)/gi;

function isVisualEditorSafeHtml(value: string) {
  const normalized = normalizeHtmlBlockValue(value).trim();
  if (!normalized) return true;
  if (STYLE_BLOCK_PATTERN.test(normalized)) return false;

  OPENING_TAG_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = OPENING_TAG_PATTERN.exec(normalized)) !== null) {
    const tagName = String(match[1] ?? "").toLowerCase();
    const attributes = String(match[2] ?? "");

    if (!VISUAL_EDITOR_ALLOWED_TAGS.has(tagName)) return false;
    if (/\sstyle\s*=/i.test(attributes) && !VISUAL_EDITOR_STYLE_TAGS.has(tagName)) return false;
  }

  return true;
}

function formatHtmlSource(value: string) {
  return normalizeHtmlBlockValue(value)
    .replace(/\s*(<hr\s*\/?>)\s*/gi, "\n\n$1\n\n")
    .replace(HTML_SOURCE_LINE_BREAK_PATTERN, "$1\n\n")
    .replace(HTML_SOURCE_BLOCK_START_PATTERN, "\n$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function getInitialHtmlSource(content?: string) {
  if (!content) return "";
  try {
    const c = JSON.parse(content);
    return formatHtmlSource(normalizeHtmlBlockValue(c.html ?? c.text ?? ""));
  } catch {
    return "";
  }
}

function getInitialDialogSize(): DialogSize {
  if (typeof window === "undefined") return { width: 1040, height: 780 };
  return {
    width: clamp(window.innerWidth - 96, 720, 1160),
    height: clamp(window.innerHeight - 96, 560, 860),
  };
}

function clampDialogOffset(offset: DialogOffset, size: DialogSize) {
  if (typeof window === "undefined") return offset;
  const maxX = Math.max(0, (window.innerWidth - Math.min(size.width, window.innerWidth - 24)) / 2);
  const maxY = Math.max(0, (window.innerHeight - Math.min(size.height, window.innerHeight - 24)) / 2);
  return {
    x: clamp(offset.x, -maxX, maxX),
    y: clamp(offset.y, -maxY, maxY),
  };
}

export function BlockEditDialog({
  block,
  onSave,
  onClose,
  isNew,
  menuItemId,
  menuSubItemId,
}: {
  block?: { id?: number; blockType: string; content: string };
  onSave: (blockType: string, content: string) => void;
  onClose: () => void;
  isNew?: boolean;
  menuItemId?: number;
  menuSubItemId?: number;
}) {
  const [blockType, setBlockType] = useState(block?.blockType ?? "text-body");
  const [text, setText] = useState(() => {
    if (!block?.content) return "";
    try {
      const c = JSON.parse(block.content);
      return c.text ?? "";
    } catch {
      return "";
    }
  });
  const [html, setHtml] = useState(() => getInitialHtmlSource(block?.content));
  const [htmlSourceDraft, setHtmlSourceDraft] = useState(() =>
    getInitialHtmlSource(block?.content)
  );
  const [htmlEditMode, setHtmlEditMode] = useState<"visual" | "source" | "preview">("source");
  const [urls, setUrls] = useState<string[]>(() => {
    if (!block?.content) return [];
    try {
      const c = JSON.parse(block.content);
      return c.urls ?? [];
    } catch {
      return [];
    }
  });
  const [captions, setCaptions] = useState<string[]>(() => {
    if (!block?.content) return [];
    try {
      const c = JSON.parse(block.content);
      return c.captions ?? [];
    } catch {
      return [];
    }
  });
  const [videoId, setVideoId] = useState(() => {
    if (!block?.content) return "";
    try {
      const c = JSON.parse(block.content);
      return c.videoId ?? "";
    } catch {
      return "";
    }
  });
  const [btnLabel, setBtnLabel] = useState(() => {
    if (!block?.content) return "";
    try {
      const c = JSON.parse(block.content);
      return c.label ?? "";
    } catch {
      return "";
    }
  });
  const [btnHref, setBtnHref] = useState(() => {
    if (!block?.content) return "";
    try {
      const c = JSON.parse(block.content);
      return c.href ?? "";
    } catch {
      return "";
    }
  });
  const [btnStyle, setBtnStyle] = useState<"solid" | "outline">(() => {
    if (!block?.content) return "solid";
    try {
      const c = JSON.parse(block.content);
      return c.style ?? "solid";
    } catch {
      return "solid";
    }
  });
  const [fontSize, setFontSize] = useState<number>(() => {
    if (!block?.content) return 16;
    try {
      const c = JSON.parse(block.content);
      return c.fontSize ?? 16;
    } catch {
      return 16;
    }
  });
  const [align, setAlign] = useState<"left" | "center" | "right">(() => {
    if (!block?.content) return "left";
    try {
      const c = JSON.parse(block.content);
      return c.align ?? "left";
    } catch {
      return "left";
    }
  });
  const [dividerThickness, setDividerThickness] = useState<number>(() => {
    if (!block?.content) return 1;
    try {
      const c = JSON.parse(block.content);
      return c.thickness ?? 1;
    } catch {
      return 1;
    }
  });
  const [dividerLineStyle, setDividerLineStyle] = useState<"solid" | "dashed" | "dotted">(() => {
    if (!block?.content) return "solid";
    try {
      const c = JSON.parse(block.content);
      return c.lineStyle ?? "solid";
    } catch {
      return "solid";
    }
  });
  const [uploading, setUploading] = useState(false);
  const [dialogSize, setDialogSize] = useState<DialogSize>(getInitialDialogSize);
  const [dialogOffset, setDialogOffset] = useState<DialogOffset>({ x: 0, y: 0 });
  const [dialogInteraction, setDialogInteraction] = useState<DialogInteraction | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileInputIdxRef = useRef<number>(0);

  const uploadMutation = trpc.cms.blocks.uploadImage.useMutation();
  const visualEditorSafeHtml = useMemo(() => isVisualEditorSafeHtml(html), [html]);

  const imgCount =
    blockType === "image-single" ? 1 : blockType === "image-double" ? 2 : 3;

  const handleImageUpload = async (idx: number, file: File) => {
    setUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64 = (e.target?.result as string).split(",")[1];
        const result = await uploadMutation.mutateAsync({
          base64,
          mimeType: file.type,
          fileName: file.name,
        });
        setUrls((prev) => {
          const next = [...prev];
          next[idx] = result.url;
          return next;
        });
        setUploading(false);
      };
      reader.readAsDataURL(file);
    } catch {
      setUploading(false);
    }
  };

  const buildContent = () => {
    if (blockType === HTML_EDITOR_BLOCK_TYPE) {
      const htmlForSave = htmlEditMode === "source" ? htmlSourceDraft : html;
      return JSON.stringify({ html: htmlForSave });
    }
    if (blockType.startsWith("text"))
      return JSON.stringify({ text, fontSize, align });
    if (blockType.startsWith("image"))
      return JSON.stringify({ urls, captions });
    if (blockType === "youtube") return JSON.stringify({ videoId, title: "" });
    if (blockType === "button")
      return JSON.stringify({ label: btnLabel, href: btnHref, style: btnStyle });
    if (blockType === "divider")
      return JSON.stringify({
        thickness: dividerThickness,
        lineStyle: dividerLineStyle,
      });
    return "{}";
  };

  const handleDialogMoveStart = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setDialogInteraction({
      mode: "move",
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startOffset: dialogOffset,
    });
  };

  const handleDialogResizeStart = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    setDialogInteraction({
      mode: "resize",
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startSize: dialogSize,
    });
  };

  const handleDialogPointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    if (!dialogInteraction || dialogInteraction.pointerId !== event.pointerId) return;
    event.preventDefault();

    if (dialogInteraction.mode === "move") {
      const nextOffset = {
        x: dialogInteraction.startOffset.x + event.clientX - dialogInteraction.startX,
        y: dialogInteraction.startOffset.y + event.clientY - dialogInteraction.startY,
      };
      setDialogOffset(clampDialogOffset(nextOffset, dialogSize));
      return;
    }

    const viewportWidth = typeof window === "undefined" ? 1200 : window.innerWidth;
    const viewportHeight = typeof window === "undefined" ? 900 : window.innerHeight;
    const nextSize = {
      width: clamp(
        dialogInteraction.startSize.width + event.clientX - dialogInteraction.startX,
        640,
        Math.max(640, viewportWidth - 24)
      ),
      height: clamp(
        dialogInteraction.startSize.height + event.clientY - dialogInteraction.startY,
        480,
        Math.max(480, viewportHeight - 24)
      ),
    };
    setDialogSize(nextSize);
    setDialogOffset((current) => clampDialogOffset(current, nextSize));
  };

  const handleDialogInteractionEnd = (event: ReactPointerEvent<HTMLElement>) => {
    if (!dialogInteraction || dialogInteraction.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setDialogInteraction(null);
  };

  const handleHtmlEditModeChange = (nextMode: "visual" | "source" | "preview") => {
    const currentHtml = htmlEditMode === "source" ? htmlSourceDraft : html;
    if (nextMode === "source") {
      const formatted = formatHtmlSource(currentHtml);
      setHtml(formatted);
      setHtmlSourceDraft(formatted);
    } else {
      setHtml(currentHtml);
    }
    setHtmlEditMode(nextMode);
  };

  return (
    <Dialog open onOpenChange={() => {}}>
      <DialogContent
        className="flex max-w-none flex-col overflow-hidden p-0 sm:max-w-none"
        showCloseButton={false}
        style={{
          width: `${dialogSize.width}px`,
          height: `${dialogSize.height}px`,
          maxWidth: "calc(100vw - 24px)",
          maxHeight: "calc(100vh - 24px)",
          marginLeft: `${dialogOffset.x}px`,
          marginTop: `${dialogOffset.y}px`,
        }}
        onInteractOutside={(event) => {
          // 바깥 화면을 실수로 눌러도 작성 중인 HTML 편집 내용이 날아가지 않게
          // 저장/취소/닫기 버튼으로만 편집창을 닫도록 한다.
          event.preventDefault();
        }}
        onPointerMove={handleDialogPointerMove}
        onPointerUp={handleDialogInteractionEnd}
        onPointerCancel={handleDialogInteractionEnd}
      >
        <button
          type="button"
          aria-label="편집창 닫기"
          className="absolute right-4 top-4 z-10 rounded-sm p-1 text-gray-500 transition hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-600"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </button>
        <DialogHeader
          className="cursor-move select-none border-b border-gray-100 px-6 py-5"
          onPointerDown={handleDialogMoveStart}
        >
          <DialogTitle>{isNew ? "블록 추가" : "블록 수정"}</DialogTitle>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-6 py-5">
        <div className="min-w-0 space-y-4">
          {/* 블록 타입 선택 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              블록 종류
            </label>
            <select
              className="w-full min-w-0 border border-gray-300 rounded-lg px-3 py-2 text-sm"
              value={blockType}
              onChange={(e) => setBlockType(e.target.value)}
            >
              {BLOCK_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          {/* HTML 편집기 블록: 2단/3단 신규 페이지 모두 공통 RichTextEditor를 사용합니다. */}
          {blockType === HTML_EDITOR_BLOCK_TYPE && (
            <div className="space-y-3">
              {!visualEditorSafeHtml && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
                  현재 HTML에 편집기가 모르는 태그나 직접 입력한 소스가 있습니다. 편집기로 열 수는 있지만 저장 전 미리보기로 모양을 확인해주세요.
                </div>
              )}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="block text-sm font-medium text-gray-700">
                  HTML 본문
                </label>
                <div className="flex rounded-md border border-gray-200 bg-white p-1">
                  {[
                    { value: "visual" as const, label: "편집기", icon: Pencil },
                    { value: "source" as const, label: "HTML 소스", icon: Code2 },
                    { value: "preview" as const, label: "미리보기", icon: Eye },
                  ].map((item) => {
                    const Icon = item.icon;
                    const active = htmlEditMode === item.value;
                    return (
                      <Button
                        key={item.value}
                        type="button"
                        variant={active ? "default" : "ghost"}
                        size="sm"
                        className={active ? "bg-green-700 hover:bg-green-800" : "text-gray-600"}
                        onClick={() => handleHtmlEditModeChange(item.value)}
                      >
                        <Icon className="h-4 w-4" />
                        {item.label}
                      </Button>
                    );
                  })}
                </div>
              </div>
              {htmlEditMode === "visual" && (
                <RichTextEditor
                  className="w-full max-w-full"
                  value={html}
                  onChange={setHtml}
                  placeholder="본문을 입력해주세요."
                  minHeightClassName="min-h-[420px]"
                />
              )}
              {htmlEditMode === "source" && (
                <textarea
                  className="min-h-[420px] w-full resize-y overflow-x-hidden overflow-y-auto whitespace-pre-wrap break-words rounded-lg border border-gray-200 bg-white px-3 py-3 font-mono text-xs leading-6 text-gray-900 outline-none [overflow-wrap:anywhere] focus:border-green-600 focus:ring-2 focus:ring-green-100"
                  value={htmlSourceDraft}
                  onChange={(event) => {
                    setHtmlSourceDraft(event.target.value);
                    setHtml(event.target.value);
                  }}
                  placeholder="<section>본문 HTML을 입력해주세요.</section>"
                  wrap="soft"
                />
              )}
              {htmlEditMode === "preview" && (
                <div className="min-h-[420px] overflow-auto rounded-lg border border-gray-200 bg-white p-4">
                  <RichTextViewer html={normalizeHtmlBlockValue(html)} />
                </div>
              )}
              <p className="text-xs text-gray-400">
                편집기 또는 HTML 소스로 작성할 수 있습니다. 스크립트 코드는 저장되지 않습니다.
              </p>
            </div>
          )}

          {/* 텍스트 블록 */}
          {blockType.startsWith("text") && (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  내용
                </label>
                <textarea
                  className="min-h-[120px] max-h-[55vh] w-full resize-y overflow-x-hidden overflow-y-auto whitespace-pre-wrap break-words rounded-lg border border-gray-300 px-3 py-2 text-sm [overflow-wrap:anywhere]"
                  wrap="soft"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder={
                    blockType === "text-body"
                      ? "본문 내용을 입력하세요..."
                      : "제목을 입력하세요"
                  }
                />
              </div>
              {/* 글씨 크기 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  글씨 크기 (10~100)
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={10}
                    max={100}
                    value={fontSize}
                    onChange={(e) => setFontSize(Number(e.target.value))}
                    className="flex-1 h-2 accent-green-700"
                  />
                  <input
                    type="number"
                    min={10}
                    max={100}
                    value={fontSize}
                    onChange={(e) =>
                      setFontSize(
                        Math.min(100, Math.max(10, Number(e.target.value)))
                      )
                    }
                    className="w-16 border border-gray-300 rounded px-2 py-1 text-sm text-center"
                  />
                  <span className="text-xs text-gray-400">px</span>
                </div>
                <p
                  className="mt-2 max-h-32 overflow-y-auto whitespace-pre-wrap break-words rounded border border-dashed border-gray-200 p-2 text-gray-500 [overflow-wrap:anywhere]"
                  style={{ fontSize: `${fontSize}px` }}
                >
                  {text || "미리보기"}
                </p>
              </div>
              {/* 정렬 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  정렬
                </label>
                <div className="flex gap-2">
                  {(["left", "center", "right"] as const).map((a) => (
                    <button
                      key={a}
                      onClick={() => setAlign(a)}
                      className={`flex-1 py-1.5 rounded text-sm border transition-colors ${
                        align === a
                          ? "bg-green-700 text-white border-green-700"
                          : "border-gray-300 text-gray-600 hover:border-green-400"
                      }`}
                    >
                      {a === "left" ? "◀ 왼쪽" : a === "center" ? "▶◀ 가운데" : "오른쪽 ▶"}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 이미지 블록 */}
          {blockType.startsWith("image") && (
            <div className="space-y-3">
              {Array.from({ length: imgCount }).map((_, i) => (
                <div key={i} className="border border-gray-200 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-2">이미지 {i + 1}</p>
                  {urls[i] ? (
                    <div className="relative">
                      <img
                        src={urls[i]}
                        alt=""
                        className="w-full h-32 object-cover rounded"
                       loading="lazy"/>
                      <button
                        className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"
                        onClick={() =>
                          setUrls((prev) => {
                            const n = [...prev];
                            n[i] = "";
                            return n;
                          })
                        }
                      >
                        ×
                      </button>
                    </div>
                  ) : (
                    <button
                      className="w-full h-24 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center text-gray-400 hover:border-green-400 hover:text-green-500 transition-colors"
                      onClick={() => {
                        fileInputIdxRef.current = i;
                        fileInputRef.current?.click();
                      }}
                      disabled={uploading}
                    >
                      <Plus className="w-5 h-5 mb-1" />
                      <span className="text-xs">
                        {uploading ? "업로드 중..." : "이미지 선택"}
                      </span>
                    </button>
                  )}
                  <input
                    className="mt-2 w-full border border-gray-200 rounded px-2 py-1 text-xs"
                    placeholder="설명 (선택)"
                    value={captions[i] ?? ""}
                    onChange={(e) =>
                      setCaptions((prev) => {
                        const n = [...prev];
                        n[i] = e.target.value;
                        return n;
                      })
                    }
                  />
                </div>
              ))}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  const idx = fileInputIdxRef.current ?? 0;
                  if (file) handleImageUpload(idx, file);
                  e.target.value = "";
                }}
              />
            </div>
          )}

          {/* 유튜브 블록 */}
          {blockType === "youtube" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                유튜브 링크 또는 영상 ID
              </label>
              <input
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                placeholder="https://youtu.be/xxxx 또는 xxxx"
                value={videoId}
                onChange={(e) => {
                  const val = e.target.value;
                  const match = val.match(/(?:youtu\.be\/|v=)([\w-]{11})/);
                  setVideoId(match ? match[1] : val);
                }}
              />
            </div>
          )}

          {/* 버튼 블록 */}
          {blockType === "button" && (
            <div className="space-y-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  버튼 텍스트
                </label>
                <input
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  value={btnLabel}
                  onChange={(e) => setBtnLabel(e.target.value)}
                  placeholder="버튼에 표시될 텍스트"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  링크 URL
                </label>
                <input
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  value={btnHref}
                  onChange={(e) => setBtnHref(e.target.value)}
                  placeholder="https://... 또는 /page/교회소개-담임목사-소개"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  스타일
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setBtnStyle("solid")}
                    className={`px-3 py-1 rounded text-sm ${
                      btnStyle === "solid"
                        ? "bg-green-700 text-white"
                        : "border border-gray-300 text-gray-600"
                    }`}
                  >
                    스타일 1 (실선)
                  </button>
                  <button
                    onClick={() => setBtnStyle("outline")}
                    className={`px-3 py-1 rounded text-sm ${
                      btnStyle === "outline"
                        ? "bg-green-700 text-white"
                        : "border border-gray-300 text-gray-600"
                    }`}
                  >
                    스타일 2 (선만)
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 구분선 블록 */}
          {blockType === "divider" && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  두께:{" "}
                  <span className="text-green-700 font-bold">
                    {dividerThickness}px
                  </span>
                </label>
                <input
                  type="range"
                  min={1}
                  max={10}
                  value={dividerThickness}
                  onChange={(e) => setDividerThickness(Number(e.target.value))}
                  className="w-full accent-green-700"
                />
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>얇게 (1px)</span>
                  <span>두껍게 (10px)</span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  선 스타일
                </label>
                <div className="flex gap-2">
                  {(["solid", "dashed", "dotted"] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setDividerLineStyle(s)}
                      className={`flex-1 py-2 px-3 rounded border text-sm transition-colors ${
                        dividerLineStyle === s
                          ? "bg-green-700 text-white border-green-700"
                          : "border-gray-300 text-gray-600 hover:border-green-400"
                      }`}
                    >
                      {s === "solid" ? "실선 ——" : s === "dashed" ? "파선 - - -" : "점선 ···"}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  미리보기
                </label>
                <div className="bg-gray-50 rounded-lg p-4">
                  <hr
                    style={{
                      borderTopWidth: `${dividerThickness}px`,
                      borderTopStyle: dividerLineStyle,
                      borderColor: "#9ca3af",
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* 저장 버튼 */}
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" onClick={onClose}>
              취소
            </Button>
            <Button
              className="bg-green-700 hover:bg-green-800 text-white"
              onClick={() => onSave(blockType, buildContent())}
              disabled={uploading}
            >
              {isNew ? "추가" : "저장"}
            </Button>
          </div>
        </div>
        </div>
        <div
          role="separator"
          aria-label="블록 수정 창 크기 조절"
          className="absolute bottom-1 right-1 h-5 w-5 cursor-nwse-resize rounded-sm border-b-2 border-r-2 border-gray-300 transition hover:border-green-700"
          onPointerDown={handleDialogResizeStart}
        />
      </DialogContent>
    </Dialog>
  );
}
