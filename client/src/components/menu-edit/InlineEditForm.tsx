import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { Check, Image as ImageIcon, LayoutGrid, X } from "lucide-react";
import { toast } from "sonner";
import {
  type DefaultViewMode,
  type PageType,
  PAGE_TYPE_OPTIONS,
  INTERNAL_PAGES,
  detectLinkType,
} from "./types.tsx";

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
  const utils = trpc.useUtils();
  const [label, setLabel] = useState(initialLabel);
  const [linkType, setLinkType] = useState<"internal" | "external" | "custom">(
    () => detectLinkType(initialHref)
  );
  const [internalPath, setInternalPath] = useState(() => {
    const allPaths = INTERNAL_PAGES.flatMap((group) => group.pages.map((page) => page.path));
    return allPaths.includes(initialHref) ? initialHref : "";
  });
  const [externalUrl, setExternalUrl] = useState(() =>
    initialHref.startsWith("http://") || initialHref.startsWith("https://")
      ? initialHref
      : "https://"
  );
  const [customHref, setCustomHref] = useState(() => {
    const allPaths = INTERNAL_PAGES.flatMap((group) => group.pages.map((page) => page.path));
    if (allPaths.includes(initialHref) || initialHref.startsWith("http")) return initialHref;
    return initialHref;
  });
  const [pageType, setPageType] = useState<PageType>(initialPageType ?? "image");
  const [pageImageUrl, setPageImageUrl] = useState<string | null>(initialPageImageUrl ?? null);
  const [defaultViewMode, setDefaultViewMode] = useState<DefaultViewMode>(
    initialDefaultViewMode ?? getDefaultViewModeForPageType(initialPageType)
  );
  const [uploading, setUploading] = useState(false);
  const [galleryUploading, setGalleryUploading] = useState(false);
  const [galleryCaption, setGalleryCaption] = useState(initialLabel);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const galleryFileInputRef = useRef<HTMLInputElement>(null);

  const uploadPageImage = trpc.cms.upload.pageImage.useMutation();
  const uploadGalleryImage = trpc.cms.upload.galleryImage.useMutation();
  const createGalleryItem = trpc.cms.content.gallery.create.useMutation({
    onSuccess: () => {
      utils.cms.content.gallery.list.invalidate();
      utils.home.gallery.invalidate();
    },
  });

  const href =
    linkType === "internal"
      ? internalPath
      : linkType === "external"
        ? externalUrl
        : customHref;

  const handlePageImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error("파일 크기는 10MB 이하만 가능합니다.");
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

  const handleGalleryImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error("파일 크기는 10MB 이하만 가능합니다.");
      return;
    }

    setGalleryUploading(true);
    try {
      const base64 = await readFileAsBase64(file);
      const { url } = await uploadGalleryImage.mutateAsync({
        base64,
        fileName: file.name,
        mimeType: file.type || "image/jpeg",
      });
      const title = galleryCaption.trim() || label.trim() || "최근 행사 사진";
      await createGalleryItem.mutateAsync({
        imageUrl: url,
        albumKey: `gallery-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
        albumTitle: title,
        caption: title,
        gridSpan: "col-span-1 row-span-1",
      });
      toast.success("갤러리 사진이 추가됐습니다.");
    } catch {
      toast.error("갤러리 사진 업로드에 실패했습니다.");
    } finally {
      setGalleryUploading(false);
      e.target.value = "";
    }
  };

  return (
    <div className={`p-2 rounded-lg border-2 ${colorClass} space-y-1.5 mt-1`}>
      <Input
        value={label}
        onChange={(e) => {
          setLabel(e.target.value);
          if (!galleryCaption || galleryCaption === initialLabel) setGalleryCaption(e.target.value);
        }}
        className="h-7 text-xs"
        placeholder="메뉴 이름"
        autoFocus
      />

      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="flex border-b border-gray-200 bg-gray-50">
          {(["internal", "external", "custom"] as const).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setLinkType(type)}
              className={`flex-1 text-[10px] py-1 font-medium transition-colors ${
                linkType === type
                  ? "bg-white text-green-700 border-b-2 border-green-600"
                  : "text-gray-400 hover:text-gray-600"
              }`}
            >
              {type === "internal" ? "기존 페이지" : type === "external" ? "외부 URL" : "직접 입력"}
            </button>
          ))}
        </div>
        <div className="p-2">
          {linkType === "internal" && (
            <select
              value={internalPath}
              onChange={(e) => setInternalPath(e.target.value)}
              className="w-full h-7 text-xs border border-gray-200 rounded px-1 bg-white"
            >
              <option value="">페이지 선택</option>
              {INTERNAL_PAGES.map((group) => (
                <optgroup key={group.group} label={group.group}>
                  {group.pages.map((page) => (
                    <option key={page.path} value={page.path}>
                      {page.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          )}
          {linkType === "external" && (
            <div className="space-y-1">
              <Input
                value={externalUrl}
                onChange={(e) => setExternalUrl(e.target.value)}
                className="h-7 text-xs"
                placeholder="https://example.com"
              />
              <p className="text-[9px] text-blue-500">새 창으로 열립니다.</p>
            </div>
          )}
          {linkType === "custom" && (
            <div className="space-y-1">
              <Input
                value={customHref}
                onChange={(e) => setCustomHref(e.target.value)}
                className="h-7 text-xs"
                placeholder="/page/custom-path"
              />
              <p className="text-[9px] text-gray-400">예: /page/community-gallery</p>
            </div>
          )}
        </div>
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

      {showPageType && (pageType === "board" || pageType === "gallery") && (
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
          <p className="text-[9px] text-gray-400">권장: 1920 x 1080px, 최대 10MB, JPG/PNG/WEBP</p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={handlePageImageChange}
          />
        </div>
      )}

      {showPageType && pageType === "gallery" && (
        <div className="space-y-1 rounded border border-gray-200 bg-white p-2">
          <p className="text-[10px] text-gray-600 font-semibold">갤러리 사진 추가</p>
          <Input
            value={galleryCaption}
            onChange={(e) => setGalleryCaption(e.target.value)}
            className="h-7 text-xs"
            placeholder="사진 제목 또는 행사명"
          />
          <button
            type="button"
            onClick={() => galleryFileInputRef.current?.click()}
            disabled={galleryUploading}
            className="w-full h-7 text-[10px] border border-dashed border-gray-300 rounded px-2 bg-white hover:bg-gray-50 flex items-center justify-center gap-1 disabled:opacity-50"
          >
            <LayoutGrid size={10} />
            {galleryUploading ? "업로드 중..." : "사진 업로드해서 갤러리에 추가"}
          </button>
          <p className="text-[9px] text-gray-400">업로드한 사진은 최근 행사 사진 갤러리에 바로 표시됩니다.</p>
          <input
            ref={galleryFileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={handleGalleryImageChange}
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
              showPageType && (pageType === "board" || pageType === "gallery")
                ? defaultViewMode
                : undefined
            );
          }}
          disabled={!label.trim() || uploading || galleryUploading}
        >
          <Check size={10} className="mr-0.5" /> 저장
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-6 text-[10px] px-2"
          onClick={onCancel}
          disabled={uploading || galleryUploading}
        >
          <X size={10} className="mr-0.5" /> 취소
        </Button>
      </div>
    </div>
  );
}
