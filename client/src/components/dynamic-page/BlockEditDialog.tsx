/**
 * 블록 편집 다이얼로그 컴포넌트
 * 관리자가 에디터 페이지에서 블록을 추가하거나 수정할 때 사용하는 팝업입니다.
 * 블록 종류(텍스트, 이미지, 유튜브, 버튼, 구분선)에 따라 다른 입력 폼을 보여줍니다.
 */
import { useState, useRef } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { BLOCK_TYPES } from "./BlockRenderer";

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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadMutation = trpc.cms.blocks.uploadImage.useMutation();

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

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isNew ? "블록 추가" : "블록 수정"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* 블록 타입 선택 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              블록 종류
            </label>
            <select
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
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

          {/* 텍스트 블록 */}
          {blockType.startsWith("text") && (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  내용
                </label>
                <textarea
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm min-h-[120px] resize-y"
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
                  className="mt-2 text-gray-500 border border-dashed border-gray-200 rounded p-2 truncate"
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
                      />
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
                        fileInputRef.current?.click();
                        (fileInputRef.current as any)._idx = i;
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
                  const idx = (e.target as any)._idx ?? 0;
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
                  placeholder="https://... 또는 /page/item/1"
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
      </DialogContent>
    </Dialog>
  );
}
