/**
 * 인라인 수정 폼
 * 메뉴 항목 추가/수정 시 인라인으로 표시되는 작은 팝업 형태의 폼입니다.
 */
import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { Check, X, Image } from "lucide-react";
import { toast } from "sonner";
import {
  type PageType,
  PAGE_TYPE_OPTIONS,
  INTERNAL_PAGES,
  detectLinkType,
} from "./types.tsx";

export function InlineEditForm({
  initialLabel,
  initialHref,
  initialPageType,
  initialPageImageUrl,
  showPageType,
  colorClass,
  onSave,
  onCancel,
}: {
  initialLabel: string;
  initialHref: string;
  initialPageType?: PageType;
  initialPageImageUrl?: string | null;
  showPageType?: boolean;
  colorClass: string;
  onSave: (label: string, href: string, pageType?: PageType, pageImageUrl?: string | null) => void;
  onCancel: () => void;
}) {
  const [label, setLabel] = useState(initialLabel);
  const [linkType, setLinkType] = useState<'internal' | 'external' | 'custom'>(() => detectLinkType(initialHref));
  const [internalPath, setInternalPath] = useState(() => {
    const allPaths = INTERNAL_PAGES.flatMap(g => g.pages.map(p => p.path));
    return allPaths.includes(initialHref) ? initialHref : '';
  });
  const [externalUrl, setExternalUrl] = useState(() =>
    (initialHref.startsWith('http://') || initialHref.startsWith('https://')) ? initialHref : 'https://'
  );
  const [customHref, setCustomHref] = useState(() => {
    const allPaths = INTERNAL_PAGES.flatMap(g => g.pages.map(p => p.path));
    if (allPaths.includes(initialHref) || initialHref.startsWith('http')) return initialHref;
    return initialHref;
  });

  // 실제 href 값 계산
  const href = linkType === 'internal' ? internalPath
    : linkType === 'external' ? externalUrl
    : customHref;
  const [pageType, setPageType] = useState<PageType>(initialPageType ?? "image");
  const [pageImageUrl, setPageImageUrl] = useState<string | null>(initialPageImageUrl ?? null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadMutation = trpc.cms.upload.pageImage.useMutation();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error("파일 크기는 10MB 이하여야 합니다.");
      return;
    }
    setUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const base64 = (ev.target?.result as string).split(",")[1];
        const result = await uploadMutation.mutateAsync({
          base64,
          fileName: file.name,
          mimeType: file.type,
          context: "menu-page",
        });
        setPageImageUrl(result.url);
        toast.success("이미지 업로드 완료!");
      };
      reader.readAsDataURL(file);
    } catch {
      toast.error("이미지 업로드에 실패했습니다.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className={`p-2 rounded-lg border-2 ${colorClass} space-y-1.5 mt-1`}>
      <Input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        className="h-7 text-xs"
        placeholder="메뉴 이름"
        autoFocus
      />
      {/* 링크 타입 탭 */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="flex border-b border-gray-200 bg-gray-50">
          {(['internal', 'external', 'custom'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setLinkType(t)}
              className={`flex-1 text-[10px] py-1 font-medium transition-colors ${
                linkType === t ? 'bg-white text-green-700 border-b-2 border-green-600' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              {t === 'internal' ? '기존 페이지' : t === 'external' ? '외부 URL' : '직접 입력'}
            </button>
          ))}
        </div>
        <div className="p-2">
          {linkType === 'internal' && (
            <select
              value={internalPath}
              onChange={(e) => setInternalPath(e.target.value)}
              className="w-full h-7 text-xs border border-gray-200 rounded px-1 bg-white"
            >
              <option value="">— 페이지 선택 —</option>
              {INTERNAL_PAGES.map((group) => (
                <optgroup key={group.group} label={group.group}>
                  {group.pages.map((p) => (
                    <option key={p.path} value={p.path}>{p.label}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          )}
          {linkType === 'external' && (
            <div className="space-y-1">
              <Input
                value={externalUrl}
                onChange={(e) => setExternalUrl(e.target.value)}
                className="h-7 text-xs"
                placeholder="https://example.com"
              />
              <p className="text-[9px] text-blue-500">↗ 새 탭으로 열립니다</p>
            </div>
          )}
          {linkType === 'custom' && (
            <div className="space-y-1">
              <Input
                value={customHref}
                onChange={(e) => setCustomHref(e.target.value)}
                className="h-7 text-xs"
                placeholder="/직접 경로 입력"
              />
              <p className="text-[9px] text-gray-400">예: /page/item/12345</p>
            </div>
          )}
        </div>
      </div>
      {showPageType && (
        <select
          value={pageType}
          onChange={(e) => setPageType(e.target.value as PageType)}
          className="w-full h-7 text-xs border border-gray-200 rounded px-1 bg-white"
        >
          {PAGE_TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      )}
      {/* 이미지 전체화면 타입 선택 시 이미지 업로드 UI 표시 */}
      {showPageType && pageType === "image" && (
        <div className="space-y-1">
          <p className="text-[10px] text-gray-500 font-medium">페이지 이미지</p>
          {pageImageUrl && (
            <div className="relative">
              <img
                src={pageImageUrl}
                alt="페이지 이미지"
                className="w-full h-20 object-cover rounded border border-gray-200"
              />
              <button
                onClick={() => setPageImageUrl(null)}
                className="absolute top-0.5 right-0.5 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[9px] hover:bg-red-600"
              >
                <X size={8} />
              </button>
            </div>
          )}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="w-full h-7 text-[10px] border border-dashed border-gray-300 rounded px-2 bg-white hover:bg-gray-50 flex items-center justify-center gap-1 disabled:opacity-50"
          >
            {uploading ? (
              <><span className="animate-spin">⏳</span> 업로드 중...</>
            ) : (
              <><Image size={10} /> {pageImageUrl ? "이미지 변경" : "이미지 업로드"}</>
            )}
          </button>
          <p className="text-[9px] text-gray-400">권장 크기: 1920 × 1080px · 최대 10MB · JPG/PNG/WEBP</p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>
      )}
      <div className="flex gap-1">
        <Button
          size="sm"
          className="h-6 text-[10px] px-2 bg-[#1B5E20] hover:bg-[#2E7D32]"
          onClick={() => { if (label.trim()) onSave(label.trim(), href, showPageType ? pageType : undefined, showPageType ? pageImageUrl : undefined); }}
          disabled={!label.trim() || uploading}
        >
          <Check size={10} className="mr-0.5" /> 저장
        </Button>
        <Button size="sm" variant="outline" className="h-6 text-[10px] px-2" onClick={onCancel}>
          <X size={10} className="mr-0.5" /> 취소
        </Button>
      </div>
    </div>
  );
}
