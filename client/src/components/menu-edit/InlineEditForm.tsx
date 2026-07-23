import { useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { Check, Image as ImageIcon, X } from "lucide-react";
import { toast } from "sonner";
import {
  type DefaultViewMode,
  type PageType,
  PAGE_TYPE_OPTIONS,
} from "./types.tsx";
import { isLargePageImageTarget } from "@shared/pageImageUploadPolicy";

const MAX_PAGE_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_STANDARD_IMAGE_BYTES = 1 * 1024 * 1024;

function getDefaultViewModeForPageType(pageType?: PageType): DefaultViewMode {
  return pageType === "gallery" ? "grid" : "list";
}

function readFileAsBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1] ?? "");
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function InlineEditForm({
  initialLabel,
  initialHref,
  initialPageType,
  initialPageImageUrl,
  initialDefaultViewMode,
  showPageType,
  menuItemId,
  menuSubItemId,
  colorClass,
  onSave,
  onCancel,
}: {
  initialLabel: string;
  initialHref: string;
  initialPageType?: PageType;
  initialPageImageUrl?: string | null;
  initialDefaultViewMode?: DefaultViewMode | null;
  showPageType?: boolean;
  menuItemId?: number;
  menuSubItemId?: number;
  colorClass: string;
  onSave: (
    label: string,
    href: string,
    pageType?: PageType,
    pageImageUrl?: string | null,
    defaultViewMode?: DefaultViewMode
  ) => void;
  onCancel: () => void;
}) {
  const urlInputId = useId();
  const [label, setLabel] = useState(initialLabel);
  const [href, setHref] = useState(initialHref);
  const [pageType, setPageType] = useState<PageType>(initialPageType ?? "image");
  const [pageImageUrl, setPageImageUrl] = useState<string | null>(initialPageImageUrl ?? null);
  const [defaultViewMode, setDefaultViewMode] = useState<DefaultViewMode>(
    initialDefaultViewMode ?? getDefaultViewModeForPageType(initialPageType)
  );
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const allowsLargePageImage = isLargePageImageTarget({ menuItemId, menuSubItemId });

  const uploadPageImage = trpc.cms.upload.pageImage.useMutation();

  const handlePageImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const maxBytes = allowsLargePageImage ? MAX_PAGE_IMAGE_BYTES : MAX_STANDARD_IMAGE_BYTES;
    if (file.size > maxBytes) {
      toast.error(
        allowsLargePageImage
          ? "페이지 이미지는 최대 10MB까지 업로드할 수 있습니다."
          : "페이지 이미지는 최대 1MB까지 업로드할 수 있습니다."
      );
      return;
    }

    setUploading(true);
    try {
      const base64 = await readFileAsBase64(file);
      const result = await uploadPageImage.mutateAsync({
        base64,
        fileName: file.name,
        mimeType: file.type || "image/jpeg",
        context: "menu-page",
        menuItemId,
        menuSubItemId,
      });
      setPageImageUrl(result.url);
      toast.success("이미지가 업로드됐습니다.");
    } catch {
      toast.error("이미지 업로드에 실패했습니다.");
    } finally {
      setUploading(false);
      e.target.value = "";
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

      <div className="space-y-1 rounded-lg border border-gray-200 bg-white p-2">
        <label htmlFor={urlInputId} className="block text-[10px] font-semibold text-gray-600">
          URL 연결
        </label>
        <Input
          id={urlInputId}
          value={href}
          onChange={(e) => setHref(e.target.value)}
          className="h-7 text-xs"
          placeholder="https://example.com 또는 /page/custom-path"
        />
        <p className="text-[9px] text-gray-400">
          교회 내부 주소는 현재 창, 다른 사이트 URL은 새 창으로 열립니다.
        </p>
      </div>

      {showPageType && (
        <select
          value={pageType}
          onChange={(e) => {
            const nextPageType = e.target.value as PageType;
            setPageType(nextPageType);
            if (nextPageType === "board" || nextPageType === "gallery") {
              setDefaultViewMode(getDefaultViewModeForPageType(nextPageType));
            }
          }}
          className="w-full h-7 text-xs border border-gray-200 rounded px-1 bg-white"
        >
          {PAGE_TYPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      )}

      {showPageType && (
        <label className="block text-[10px] font-semibold text-gray-600">
          기본 보기방식
          <select
            className="mt-1 w-full h-7 rounded border border-gray-200 px-1 text-xs bg-white"
            value={defaultViewMode}
            onChange={(e) => setDefaultViewMode(e.target.value as DefaultViewMode)}
          >
            <option value="list">게시판형</option>
            <option value="grid">갤러리형</option>
          </select>
        </label>
      )}

      {showPageType && pageType === "image" && (
        <div className="space-y-1 rounded border border-gray-200 bg-white p-2">
          <p className="text-[10px] text-gray-600 font-semibold">페이지 이미지</p>
          {pageImageUrl && (
            <div className="relative flex h-40 w-full items-center justify-center overflow-hidden rounded border border-gray-200 bg-gray-50">
              <img src={pageImageUrl} alt="페이지 이미지" className="max-h-full max-w-full object-contain"  loading="lazy"/>
              <button
                type="button"
                onClick={() => setPageImageUrl(null)}
                className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[9px] hover:bg-red-600"
              >
                <X size={8} />
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="w-full h-7 text-[10px] border border-dashed border-gray-300 rounded px-2 bg-white hover:bg-gray-50 flex items-center justify-center gap-1 disabled:opacity-50"
          >
            <ImageIcon size={10} />
            {uploading ? "업로드 중..." : pageImageUrl ? "이미지 변경" : "이미지 업로드"}
          </button>
          <p className="text-[9px] text-gray-400">
            권장: 1920 x 1080px, 최대 {allowsLargePageImage ? "10MB" : "1MB"}, JPG/PNG/WEBP/GIF
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={handlePageImageChange}
          />
        </div>
      )}

      {showPageType && pageType === "editor" && (
        <div className="space-y-1 rounded border border-green-100 bg-green-50 p-2">
          <p className="text-[10px] font-semibold text-green-800">HTML 편집기</p>
          <p className="text-[9px] leading-4 text-green-700">
            메뉴 저장 후 해당 페이지에서 관리자 권한으로 본문, 이미지, 버튼을 편집할 수 있습니다.
          </p>
        </div>
      )}

      <div className="flex gap-1">
        <Button
          size="sm"
          className="h-6 text-[10px] px-2 bg-[#1B5E20] hover:bg-[#2E7D32]"
          onClick={() => {
            if (!label.trim()) return;
            onSave(
              label.trim(),
              href,
              showPageType ? pageType : undefined,
              showPageType ? pageImageUrl : undefined,
              showPageType ? defaultViewMode : undefined
            );
          }}
          disabled={!label.trim() || uploading}
        >
          <Check size={10} className="mr-0.5" /> 저장
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-6 text-[10px] px-2"
          onClick={onCancel}
          disabled={uploading}
        >
          <X size={10} className="mr-0.5" /> 취소
        </Button>
      </div>
    </div>
  );
}
