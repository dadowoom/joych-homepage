/**
 * 갤러리 콘텐츠 컴포넌트
 * pageType="gallery" 메뉴에서 최근 행사 사진을 게시판형 목록과 상세 이미지 보기로 표시합니다.
 * 관리자 로그인 시에는 이 화면에서 바로 앨범 단위 다중 업로드와 사진 순서 변경을 할 수 있습니다.
 */
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ChevronDown,
  ChevronUp,
  Download,
  FileImage,
  GripVertical,
  Images,
  LayoutGrid,
  Loader2,
  Pencil,
  Plus,
  Save,
  Search,
  Trash2,
  Upload,
  ZoomIn,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useLocation, useSearch } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { canManageBoardContent } from "@/lib/contentPermissions";
import { RichTextEditor, RichTextViewer, normalizeRichTextValue } from "@/components/ui/rich-text-editor";
import { Lightbox } from "./Lightbox";
import { ViewModeToggle, type ViewMode } from "./ViewModeToggle";

type GalleryItem = {
  id: number;
  imageUrl: string;
  albumKey?: string | null;
  albumTitle?: string | null;
  albumDescription?: string | null;
  albumSortOrder?: number | null;
  caption?: string | null;
  gridSpan?: string | null;
  sortOrder?: number | null;
  isVisible?: boolean | null;
  createdAt?: string | Date | null;
};

type GalleryGroup = {
  key: string;
  title: string;
  description: string;
  createdAt: string | Date | null | undefined;
  albumSortOrder: number;
  sortOrder: number;
  images: GalleryItem[];
};

function normalizeViewMode(value?: string | null, fallback: ViewMode = "grid"): ViewMode {
  return value === "list" ? "list" : fallback;
}

const MAX_GALLERY_UPLOAD_SIZE = 10 * 1024 * 1024;
const MAX_GALLERY_UPLOAD_COUNT = 100;
const ALLOWED_GALLERY_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

function getAlbumTitle(item: GalleryItem) {
  return item.albumTitle?.trim() || "최근 행사 사진";
}

function formatGalleryDate(value: unknown) {
  if (!value) return "-";

  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return "-";

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}.${month}.${day}`;
}

function toDateTimeLocalValue(value?: string | Date | null) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return "";
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return offsetDate.toISOString().slice(0, 16);
}

function getPlainRichText(value: string) {
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|li|blockquote)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function getPhotoStory(caption: string | null | undefined, albumTitle: string, index: number) {
  const text = normalizeRichTextValue(caption);
  if (!text) return "";

  const title = albumTitle.trim();
  const plainText = getPlainRichText(text);
  if (!plainText) return "";
  if (title && (plainText === title || plainText === `${title} ${index + 1}`)) return "";

  return text;
}

function toTime(value: unknown) {
  if (!value) return 0;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function isToday(value: unknown) {
  if (!value) return false;
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return false;
  const today = new Date();
  return date.getFullYear() === today.getFullYear()
    && date.getMonth() === today.getMonth()
    && date.getDate() === today.getDate();
}

function makeGroupKey(item: GalleryItem) {
  const albumKey = item.albumKey?.trim();
  if (albumKey) return `album:${albumKey}`;

  const albumTitle = item.albumTitle?.trim();
  if (albumTitle) return `album-title:${albumTitle}`;

  return "legacy:recent-gallery";
}

function getItemSortOrder(item: GalleryItem, index: number) {
  return typeof item.sortOrder === "number" ? item.sortOrder : index + 1;
}

function getAlbumSortOrder(item: GalleryItem) {
  return typeof item.albumSortOrder === "number" ? item.albumSortOrder : 0;
}

function splitLocation(location: string) {
  const queryIndex = location.indexOf("?");
  if (queryIndex === -1) return { pathname: location, search: "" };
  return {
    pathname: location.slice(0, queryIndex),
    search: location.slice(queryIndex + 1),
  };
}

function getGalleryDetailKey(search: string) {
  return new URLSearchParams(search).get("gallery");
}

function buildGalleryHref(location: string, search: string, groupKey?: string) {
  const { pathname } = splitLocation(location);
  const params = new URLSearchParams(search);

  if (groupKey) {
    params.set("gallery", groupKey);
  } else {
    params.delete("gallery");
  }

  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

function buildGalleryGroups(items: GalleryItem[]) {
  const groups = new Map<string, GalleryGroup>();

  items.forEach((item, index) => {
    const key = makeGroupKey(item);
    const title = getAlbumTitle(item);
    const description = item.albumDescription?.trim() || "";
    const sortOrder = getItemSortOrder(item, index);
    const albumSortOrder = getAlbumSortOrder(item);
    const existing = groups.get(key);

    if (existing) {
      existing.images.push(item);
      if (!existing.description && description) {
        existing.description = description;
      }
      existing.sortOrder = Math.min(existing.sortOrder, sortOrder);
      existing.albumSortOrder = Math.max(existing.albumSortOrder, albumSortOrder);
      if (toTime(item.createdAt) > toTime(existing.createdAt)) {
        existing.createdAt = item.createdAt;
      }
      return;
    }

    groups.set(key, {
      key,
      title,
      description,
      createdAt: item.createdAt,
      albumSortOrder,
      sortOrder,
      images: [item],
    });
  });

  return Array.from(groups.values()).sort((a, b) => {
    if (a.albumSortOrder !== b.albumSortOrder) return b.albumSortOrder - a.albumSortOrder;
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return toTime(b.createdAt) - toTime(a.createdAt);
  });
}

function getGalleryGroupVisibility(group: GalleryGroup) {
  const visibleCount = group.images.filter((image) => image.isVisible !== false).length;
  if (visibleCount === 0) return "hidden" as const;
  if (visibleCount === group.images.length) return "visible" as const;
  return "partial" as const;
}

function readFileAsBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      const [, base64] = result.split(",");
      if (!base64) {
        reject(new Error("이미지 파일을 읽을 수 없습니다."));
        return;
      }
      resolve(base64);
    };
    reader.onerror = () => reject(new Error("이미지 파일을 읽을 수 없습니다."));
    reader.readAsDataURL(file);
  });
}

function sortGalleryUploadFiles(files: File[]) {
  return [...files].sort((a, b) =>
    a.name.localeCompare(b.name, "ko-KR", { numeric: true, sensitivity: "base" })
  );
}

function SortableGalleryOrderItem({
  item,
  index,
  title,
}: {
  item: GalleryItem;
  index: number;
  title: string;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.55 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 border border-dashed border-gray-200 bg-white p-2 text-xs"
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="flex h-8 w-8 shrink-0 cursor-grab items-center justify-center bg-gray-50 text-gray-500 shadow-sm active:cursor-grabbing"
        title="드래그해서 사진 순서 변경"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <img
        src={item.imageUrl}
        alt={item.caption || `${title} ${index + 1}`}
        className="h-12 w-16 shrink-0 object-cover"
        loading="lazy"
      />
      <div className="min-w-0 flex-1">
        <span className="inline-flex h-5 min-w-5 items-center justify-center bg-[#1B5E20] px-1 text-white">
          {index + 1}
        </span>
        <span className="ml-2 text-gray-700">
          {item.caption || `사진 ${index + 1}`}
        </span>
      </div>
    </div>
  );
}

function SortableGalleryAlbumOrderItem({
  group,
  index,
}: {
  group: GalleryGroup;
  index: number;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: group.key });
  const thumbnail = group.images[0];

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.55 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 border border-dashed border-gray-200 bg-white p-2 text-xs"
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="flex h-8 w-8 shrink-0 cursor-grab items-center justify-center bg-gray-50 text-gray-500 shadow-sm active:cursor-grabbing"
        title="드래그해서 앨범 순서 변경"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      {thumbnail && (
        <img
          src={thumbnail.imageUrl}
          alt={group.title}
          className="h-12 w-16 shrink-0 object-cover"
          loading="lazy"
        />
      )}
      <div className="min-w-0 flex-1">
        <span className="inline-flex h-5 min-w-5 items-center justify-center bg-[#1B5E20] px-1 text-white">
          {index + 1}
        </span>
        <span className="ml-2 text-gray-700">{group.title}</span>
        <span className="ml-2 text-gray-400">{group.images.length}장</span>
      </div>
    </div>
  );
}

export function GalleryContent({ defaultViewMode }: { defaultViewMode?: ViewMode | null } = {}) {
  const { user } = useAuth();
  const canManage = canManageBoardContent(user);
  const utils = trpc.useUtils();
  const publicGalleryQuery = trpc.home.gallery.useQuery(undefined, {
    enabled: !canManage,
  });
  const adminGalleryQuery = trpc.cms.content.gallery.list.useQuery(undefined, {
    enabled: canManage,
  });
  const [location, navigate] = useLocation();
  const searchString = useSearch();
  const [lightbox, setLightbox] = useState<{ groupKey: string; imageIndex: number } | null>(null);
  const [page, setPage] = useState(1);
  const [viewMode, setViewMode] = useState<ViewMode>(normalizeViewMode(defaultViewMode));
  const [searchInput, setSearchInput] = useState("");
  const [searchKeyword, setSearchKeyword] = useState("");
  const [albumTitle, setAlbumTitle] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isAlbumOrderOpen, setIsAlbumOrderOpen] = useState(false);
  const [localOrder, setLocalOrder] = useState<GalleryItem[] | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const detailFileInputRef = useRef<HTMLInputElement>(null);

  const items = canManage ? adminGalleryQuery.data : publicGalleryQuery.data;
  const isLoading = canManage ? adminGalleryQuery.isLoading : publicGalleryQuery.isLoading;
  const galleryItems = (localOrder ?? items ?? []) as GalleryItem[];
  const galleryGroups = useMemo(() => buildGalleryGroups(galleryItems), [galleryItems]);
  const filteredGroups = useMemo(() => {
    const keyword = searchKeyword.trim().toLowerCase();
    if (!keyword) return galleryGroups;
    return galleryGroups.filter((group) => group.title.toLowerCase().includes(keyword));
  }, [galleryGroups, searchKeyword]);

  const pageSize = 16;
  const totalPages = Math.max(1, Math.ceil(filteredGroups.length / pageSize));
  const activePage = Math.min(page, totalPages);
  const visibleGroups = filteredGroups.slice((activePage - 1) * pageSize, activePage * pageSize);
  const detailGroupKey = useMemo(() => getGalleryDetailKey(searchString), [searchString]);
  const detailGroup = detailGroupKey ? galleryGroups.find((group) => group.key === detailGroupKey) ?? null : null;
  const newGroupCount = filteredGroups.filter((group) => isToday(group.createdAt)).length;
  const activeLightboxGroup = lightbox ? galleryGroups.find((group) => group.key === lightbox.groupKey) : null;
  const activeLightboxImage = activeLightboxGroup && lightbox ? activeLightboxGroup.images[lightbox.imageIndex] : null;
  const pageNumbers = Array.from({ length: totalPages }, (_, index) => index + 1);
  const [isDetailEditing, setIsDetailEditing] = useState(false);
  const [editAlbumTitle, setEditAlbumTitle] = useState("");
  const [editAlbumDescription, setEditAlbumDescription] = useState("");
  const [editAlbumCreatedAt, setEditAlbumCreatedAt] = useState("");
  const [editPhotoCaptions, setEditPhotoCaptions] = useState<Record<number, string>>({});
  const [editingPhotoId, setEditingPhotoId] = useState<number | null>(null);
  const [isSavingDetail, setIsSavingDetail] = useState(false);
  const [isAddingDetailPhotos, setIsAddingDetailPhotos] = useState(false);
  const [deletingAlbumKey, setDeletingAlbumKey] = useState<string | null>(null);

  useEffect(() => {
    setViewMode(normalizeViewMode(defaultViewMode));
  }, [defaultViewMode]);

  useEffect(() => {
    if (!detailGroup) {
      setIsDetailEditing(false);
      setEditAlbumTitle("");
      setEditAlbumDescription("");
      setEditAlbumCreatedAt("");
      setEditPhotoCaptions({});
      return;
    }

    setIsDetailEditing(false);
    setEditAlbumTitle(detailGroup.title);
    setEditAlbumDescription(normalizeRichTextValue(detailGroup.description));
    setEditAlbumCreatedAt(toDateTimeLocalValue(detailGroup.createdAt));
    setEditPhotoCaptions(Object.fromEntries(
      detailGroup.images.map((image) => [image.id, normalizeRichTextValue(image.caption)])
    ));
  }, [detailGroup?.key]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const uploadGalleryImage = trpc.cms.upload.galleryImage.useMutation();
  const createGalleryItem = trpc.cms.content.gallery.create.useMutation();
  const updateGalleryItem = trpc.cms.content.gallery.update.useMutation();
  const updateGalleryAlbum = trpc.cms.content.gallery.updateAlbum.useMutation();
  const deleteGalleryItem = trpc.cms.content.gallery.delete.useMutation();
  const deleteGalleryAlbum = trpc.cms.content.gallery.deleteAlbum.useMutation();
  const reorderGalleryAlbums = trpc.cms.content.gallery.reorderAlbums.useMutation({
    onSuccess: () => {
      setLocalOrder(null);
      utils.home.gallery.invalidate();
      utils.cms.content.gallery.list.invalidate();
      toast.success("앨범 순서가 저장되었습니다.");
    },
    onError: (error) => {
      setLocalOrder(null);
      toast.error(`앨범 순서 저장 실패: ${error.message}`);
    },
  });
  const reorderGalleryItems = trpc.cms.content.gallery.reorder.useMutation({
    onSuccess: () => {
      setLocalOrder(null);
      utils.home.gallery.invalidate();
      utils.cms.content.gallery.list.invalidate();
      toast.success("사진 순서가 저장되었습니다.");
    },
    onError: (error) => {
      setLocalOrder(null);
      toast.error(`사진 순서 저장 실패: ${error.message}`);
    },
  });

  const handleFilesChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = sortGalleryUploadFiles(Array.from(event.target.files ?? []));
    if (files.length === 0) return;

    const title = albumTitle.trim();
    if (!title) {
      toast.error("앨범 제목을 먼저 입력해주세요.");
      event.target.value = "";
      return;
    }

    if (files.length > MAX_GALLERY_UPLOAD_COUNT) {
      toast.error(`한 번에 최대 ${MAX_GALLERY_UPLOAD_COUNT}장까지 업로드할 수 있습니다.`);
      event.target.value = "";
      return;
    }

    const invalidTypeFile = files.find((file) => !ALLOWED_GALLERY_IMAGE_TYPES.has(file.type));
    if (invalidTypeFile) {
      toast.error("JPG, PNG, WEBP, GIF 이미지만 업로드할 수 있습니다.");
      event.target.value = "";
      return;
    }

    const oversizedFile = files.find((file) => file.size > MAX_GALLERY_UPLOAD_SIZE);
    if (oversizedFile) {
      toast.error("이미지 1장당 10MB 이하로 업로드해주세요.");
      event.target.value = "";
      return;
    }

    setIsUploading(true);
    const albumKey = `gallery-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const albumSortOrder = Math.floor(Date.now() / 1000);
    try {
      for (let index = 0; index < files.length; index += 1) {
        const file = files[index];
        const base64 = await readFileAsBase64(file);
        const { url } = await uploadGalleryImage.mutateAsync({
          base64,
          fileName: file.name,
          mimeType: file.type,
        });
        await createGalleryItem.mutateAsync({
          imageUrl: url,
          albumKey,
          albumTitle: title,
          albumSortOrder,
          caption: "",
          gridSpan: "col-span-1 row-span-1",
          sortOrder: index + 1,
        });
      }

      setAlbumTitle("");
      await Promise.all([
        utils.home.gallery.invalidate(),
        utils.cms.content.gallery.list.invalidate(),
      ]);
      toast.success(`${files.length}장의 사진을 업로드했습니다. 목록에서 앨범을 선택해 확인할 수 있습니다.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "업로드 중 문제가 발생했습니다.";
      toast.error(`사진 업로드 실패: ${message}`);
    } finally {
      setIsUploading(false);
      event.target.value = "";
    }
  };

  const refreshGallery = async () => {
    setLocalOrder(null);
    await Promise.all([
      utils.home.gallery.invalidate(),
      utils.cms.content.gallery.list.invalidate(),
    ]);
  };

  const validateGalleryFiles = (files: File[]) => {
    if (files.length > MAX_GALLERY_UPLOAD_COUNT) {
      toast.error(`한 번에 최대 ${MAX_GALLERY_UPLOAD_COUNT}장까지 업로드할 수 있습니다.`);
      return false;
    }

    const invalidTypeFile = files.find((file) => !ALLOWED_GALLERY_IMAGE_TYPES.has(file.type));
    if (invalidTypeFile) {
      toast.error("JPG, PNG, WEBP, GIF 이미지만 업로드할 수 있습니다.");
      return false;
    }

    const oversizedFile = files.find((file) => file.size > MAX_GALLERY_UPLOAD_SIZE);
    if (oversizedFile) {
      toast.error("이미지 1장당 10MB 이하로 업로드해주세요.");
      return false;
    }

    return true;
  };

  const handleSaveDetailAlbum = async () => {
    if (!detailGroup) return;

    const title = editAlbumTitle.trim();
    if (!title) {
      toast.error("앨범 제목을 입력해주세요.");
      return;
    }

    const description = editAlbumDescription.trim();
    setIsSavingDetail(true);
    try {
      await updateGalleryAlbum.mutateAsync({
        ids: detailGroup.images.map((image) => image.id),
        albumTitle: title,
        albumDescription: description,
        createdAt: editAlbumCreatedAt ? new Date(editAlbumCreatedAt) : undefined,
      });

      await Promise.all(detailGroup.images.map((image) => {
        const caption = normalizeRichTextValue(editPhotoCaptions[image.id]).trim();
        if ((image.caption ?? "") === caption) return Promise.resolve();
        return updateGalleryItem.mutateAsync({
          id: image.id,
          caption,
        });
      }));

      await refreshGallery();
      setIsDetailEditing(false);
      toast.success("앨범 내용을 저장했습니다.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "앨범 저장 중 문제가 발생했습니다.";
      toast.error(`앨범 저장 실패: ${message}`);
    } finally {
      setIsSavingDetail(false);
    }
  };

  const handleAddDetailPhotos = async (event: ChangeEvent<HTMLInputElement>) => {
    if (!detailGroup) return;
    const files = sortGalleryUploadFiles(Array.from(event.target.files ?? []));
    if (files.length === 0) return;
    if (!validateGalleryFiles(files)) {
      event.target.value = "";
      return;
    }

    const title = editAlbumTitle.trim() || detailGroup.title;
    const description = editAlbumDescription.trim();
    const firstImage = detailGroup.images[0];
    setIsAddingDetailPhotos(true);
    try {
      for (let index = 0; index < files.length; index += 1) {
        const file = files[index];
        const base64 = await readFileAsBase64(file);
        const { url } = await uploadGalleryImage.mutateAsync({
          base64,
          fileName: file.name,
          mimeType: file.type,
        });
        await createGalleryItem.mutateAsync({
          imageUrl: url,
          albumKey: firstImage?.albumKey ?? undefined,
          albumTitle: title,
          albumDescription: description,
          albumSortOrder: detailGroup.albumSortOrder,
          caption: "",
          gridSpan: "col-span-1 row-span-1",
          sortOrder: detailGroup.images.length + index + 1,
        });
      }

      await refreshGallery();
      toast.success(`${files.length}장의 사진을 앨범에 추가했습니다.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "사진 추가 중 문제가 발생했습니다.";
      toast.error(`사진 추가 실패: ${message}`);
    } finally {
      setIsAddingDetailPhotos(false);
      event.target.value = "";
    }
  };

  const handleReplacePhoto = async (item: GalleryItem, file: File | undefined) => {
    if (!file) return;
    if (!validateGalleryFiles([file])) return;

    setEditingPhotoId(item.id);
    try {
      const base64 = await readFileAsBase64(file);
      const { url } = await uploadGalleryImage.mutateAsync({
        base64,
        fileName: file.name,
        mimeType: file.type,
      });
      await updateGalleryItem.mutateAsync({
        id: item.id,
        imageUrl: url,
      });
      await refreshGallery();
      toast.success("사진을 교체했습니다.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "사진 교체 중 문제가 발생했습니다.";
      toast.error(`사진 교체 실패: ${message}`);
    } finally {
      setEditingPhotoId(null);
    }
  };

  const handleDeletePhoto = async (item: GalleryItem) => {
    if (!detailGroup) return;
    const shouldDelete = window.confirm("이 사진을 삭제할까요? 삭제 후에는 되돌릴 수 없습니다.");
    if (!shouldDelete) return;

    setEditingPhotoId(item.id);
    try {
      await deleteGalleryItem.mutateAsync({ id: item.id });
      await refreshGallery();
      if (detailGroup.images.length <= 1) {
        navigate(buildGalleryHref(location, searchString));
      }
      toast.success("사진을 삭제했습니다.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "사진 삭제 중 문제가 발생했습니다.";
      toast.error(`사진 삭제 실패: ${message}`);
    } finally {
      setEditingPhotoId(null);
    }
  };

  const handleDeleteAlbum = async (group: GalleryGroup) => {
    if (!canManage || group.images.length === 0) return;

    const shouldDelete = window.confirm(
      `"${group.title}" 앨범 전체를 삭제할까요?\n\n사진 ${group.images.length}개가 함께 삭제되며, 삭제 후에는 되돌릴 수 없습니다.`
    );
    if (!shouldDelete) return;

    setDeletingAlbumKey(group.key);
    try {
      await deleteGalleryAlbum.mutateAsync({
        ids: group.images.map((image) => image.id),
      });
      await refreshGallery();
      if (detailGroupKey === group.key) {
        navigate(buildGalleryHref(location, searchString));
      }
      toast.success("앨범을 삭제했습니다.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "앨범 삭제 중 문제가 발생했습니다.";
      toast.error(`앨범 삭제 실패: ${message}`);
    } finally {
      setDeletingAlbumKey(null);
    }
  };

  const handleToggleAlbumVisibility = async (group: GalleryGroup) => {
    if (!canManage || group.images.length === 0) return;

    const visibility = getGalleryGroupVisibility(group);
    const nextVisible = visibility !== "visible";

    try {
      await updateGalleryAlbum.mutateAsync({
        ids: group.images.map((image) => image.id),
        isVisible: nextVisible,
      });
      await refreshGallery();
      toast.success(nextVisible ? "앨범을 다시 공개했습니다." : "앨범을 숨김 처리했습니다.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "앨범 공개 상태를 변경하지 못했습니다.";
      toast.error(message);
    }
  };

  const handleGroupDragEnd = (group: GalleryGroup, event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = group.images.findIndex((item) => item.id === active.id);
    const newIndex = group.images.findIndex((item) => item.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reorderedGroupImages = arrayMove(group.images, oldIndex, newIndex);
    const groupIds = new Set(group.images.map((item) => item.id));
    let groupIndex = 0;
    const reordered = galleryItems.map((item) => {
      if (!groupIds.has(item.id)) return item;
      const reorderedItem = reorderedGroupImages[groupIndex];
      groupIndex += 1;
      return reorderedItem;
    });

    setLocalOrder(reordered);
    reorderGalleryItems.mutate(
      reordered.map((item, index) => ({ id: item.id, sortOrder: index + 1 }))
    );
  };

  const handleAlbumDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = galleryGroups.findIndex((group) => group.key === active.id);
    const newIndex = galleryGroups.findIndex((group) => group.key === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reorderedGroups = arrayMove(galleryGroups, oldIndex, newIndex);
    const updates = reorderedGroups.map((group, index) => {
        const first = group.images[0];
        return {
          albumKey: first?.albumKey ?? undefined,
          albumTitle: first?.albumTitle ?? undefined,
          albumSortOrder: reorderedGroups.length - index,
        };
      });
    const albumOrderByKey = new Map(reorderedGroups.map((group, index) => [group.key, reorderedGroups.length - index]));

    setLocalOrder(reorderedGroups.flatMap((group) =>
      group.images.map((image) => ({
        ...image,
        albumSortOrder: albumOrderByKey.get(group.key) ?? image.albumSortOrder ?? 0,
      }))
    ));
    reorderGalleryAlbums.mutate(updates);
  };

  const renderLightbox = () => {
    if (!activeLightboxImage || !activeLightboxGroup || !lightbox) return null;

    return (
      <Lightbox
        imageUrl={activeLightboxImage.imageUrl}
        alt={activeLightboxGroup.title}
        caption={activeLightboxGroup.title}
        currentLabel={`${lightbox.imageIndex + 1} / ${activeLightboxGroup.images.length}`}
        onClose={() => setLightbox(null)}
        onPrevious={
          activeLightboxGroup.images.length > 1
            ? () =>
                setLightbox((current) =>
                  current
                    ? {
                        groupKey: current.groupKey,
                        imageIndex: (current.imageIndex - 1 + activeLightboxGroup.images.length) % activeLightboxGroup.images.length,
                      }
                    : current
                )
            : undefined
        }
        onNext={
          activeLightboxGroup.images.length > 1
            ? () =>
                setLightbox((current) =>
                  current
                    ? {
                        groupKey: current.groupKey,
                        imageIndex: (current.imageIndex + 1) % activeLightboxGroup.images.length,
                      }
                    : current
                )
            : undefined
        }
      />
    );
  };

  const adminGalleryTools = canManage ? (
    <section className="border border-[#D8E8DA] bg-[#F8FCF8] p-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-[#1B5E20]">갤러리 사진 업로드</p>
          <p className="mt-1 text-xs text-gray-500">
            앨범 제목을 입력하고 사진을 여러 장 선택하면 같은 앨범으로 묶여 등록됩니다.
          </p>
          <label className="mt-3 block text-xs font-semibold text-gray-600" htmlFor="gallery-album-title">
            앨범 제목
          </label>
          <input
            id="gallery-album-title"
            value={albumTitle}
            onChange={(event) => setAlbumTitle(event.target.value)}
            className="mt-1 h-9 w-full max-w-xl border border-gray-300 bg-white px-3 text-sm outline-none focus:border-[#1B5E20]"
            placeholder="예: 2026년 6월 7일 창립 80주년 기념주일"
          />
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row lg:flex-col">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="inline-flex h-10 items-center justify-center gap-2 bg-[#1B5E20] px-4 text-sm font-semibold text-white transition hover:bg-[#2E7D32] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {isUploading ? "업로드 중" : "사진 업로드"}
          </button>
          <p className="text-xs text-gray-400">JPG, PNG, WEBP, GIF / 장당 10MB</p>
        </div>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={handleFilesChange}
      />
    </section>
  ) : null;

  const adminAlbumOrderTools = canManage && galleryGroups.length > 1 ? (
    <section className="border border-[#D8E8DA] bg-[#F8FCF8] p-4">
      <button
        type="button"
        onClick={() => setIsAlbumOrderOpen((current) => !current)}
        className="flex w-full items-center justify-between gap-3 text-left"
        aria-expanded={isAlbumOrderOpen}
      >
        <span className="flex min-w-0 flex-col gap-1">
          <span className="text-sm font-bold text-[#1B5E20]">앨범 순서 변경</span>
          <span className="text-xs text-gray-500">
            {galleryGroups.length}개의 앨범이 있습니다. 펼친 뒤 드래그하면 공개 화면의 행사 앨범 표시 순서가 바뀝니다.
          </span>
        </span>
        <span className="inline-flex shrink-0 items-center gap-1 border border-[#CFE5D3] bg-white px-3 py-1 text-xs font-semibold text-[#1B5E20]">
          {isAlbumOrderOpen ? "접기" : "펼치기"}
          {isAlbumOrderOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </span>
      </button>
      {isAlbumOrderOpen && (
        <div className="mt-3 max-h-56 overflow-y-auto overscroll-contain pr-1 md:max-h-64 xl:max-h-72">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleAlbumDragEnd}
          >
            <SortableContext items={galleryGroups.map((group) => group.key)} strategy={rectSortingStrategy}>
              <div className="grid gap-2 sm:grid-cols-2">
                {galleryGroups.map((group, index) => (
                  <SortableGalleryAlbumOrderItem key={group.key} group={group} index={index} />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      )}
    </section>
  ) : null;

  if (isLoading) {
    return <div className="text-center py-16 text-gray-400">불러오는 중...</div>;
  }

  if (galleryItems.length === 0) {
    return (
      <div className="space-y-5">
        {adminGalleryTools}
        {adminAlbumOrderTools}
        <div className="flex flex-col items-center justify-center py-24 bg-gray-50 border-2 border-dashed border-gray-200">
          <LayoutGrid className="w-12 h-12 text-gray-300 mb-3" />
          <p className="text-gray-400 text-sm">등록된 사진이 없습니다.</p>
        </div>
      </div>
    );
  }

  if (detailGroupKey && !detailGroup) {
    const listHref = buildGalleryHref(location, searchString);

    return (
      <div className="space-y-5">
        <a
          href={listHref}
          onClick={(event) => {
            event.preventDefault();
            navigate(listHref);
          }}
          className="inline-flex text-sm text-[#1B5E20] hover:underline"
        >
          ← 목록으로
        </a>
        <div className="flex flex-col items-center justify-center border-2 border-dashed border-gray-200 bg-gray-50 py-20">
          <Images className="mb-3 h-10 w-10 text-gray-300" />
          <p className="text-sm text-gray-400">해당 앨범을 찾을 수 없습니다.</p>
        </div>
      </div>
    );
  }

  if (detailGroup) {
    const listHref = buildGalleryHref(location, searchString);
    const detailVisibility = getGalleryGroupVisibility(detailGroup);

    return (
      <>
        <div className="space-y-5">
          <a
            href={listHref}
            onClick={(event) => {
              event.preventDefault();
              navigate(listHref);
            }}
            className="inline-flex text-sm text-[#1B5E20] hover:underline"
          >
            ← 목록으로
          </a>

          <article className="border border-gray-200 bg-white">
            <header className="flex flex-col gap-3 border-t-2 border-[#86C5D8] bg-[#E9F8FC] px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-bold text-[#006B8F]">{detailGroup.title}</h2>
                {canManage && detailVisibility !== "visible" && (
                  <span className="rounded-full bg-gray-900/80 px-2 py-1 text-[11px] font-semibold text-white">
                    {detailVisibility === "hidden" ? "숨김 앨범" : "부분 숨김"}
                  </span>
                )}
              </div>
              {canManage && (
                <button
                  type="button"
                  onClick={() => setIsDetailEditing((current) => !current)}
                  className="inline-flex h-8 items-center justify-center gap-1.5 self-start border border-[#1B5E20] bg-white px-3 text-xs font-semibold text-[#1B5E20] hover:bg-[#F1F8E9] sm:self-auto"
                >
                  {isDetailEditing ? <X className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
                  {isDetailEditing ? "수정 닫기" : "앨범 수정"}
                </button>
              )}
              {canManage && (
                <button
                  type="button"
                  onClick={() => handleToggleAlbumVisibility(detailGroup)}
                  className="inline-flex h-8 items-center justify-center gap-1.5 self-start border border-yellow-200 bg-white px-3 text-xs font-semibold text-yellow-700 hover:bg-yellow-50 sm:self-auto"
                >
                  {detailVisibility === "visible" ? "앨범 숨김" : "앨범 공개"}
                </button>
              )}
              {canManage && (
                <button
                  type="button"
                  onClick={() => handleDeleteAlbum(detailGroup)}
                  disabled={deletingAlbumKey === detailGroup.key}
                  className="inline-flex h-8 items-center justify-center gap-1.5 self-start border border-red-200 bg-white px-3 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 sm:self-auto"
                >
                  {deletingAlbumKey === detailGroup.key ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  앨범 삭제
                </button>
              )}
            </header>
            <div className="flex flex-wrap items-center gap-3 border-b border-gray-100 px-5 py-3 text-xs text-gray-500">
              <span className="font-semibold text-[#1B5E20]">관리자</span>
              <span className="h-3 w-px bg-gray-200" />
              <span>등록일 {formatGalleryDate(detailGroup.createdAt)}</span>
              <span className="h-3 w-px bg-gray-200" />
              <span>첨부 {detailGroup.images.length}개</span>
            </div>
            {detailGroup.description && !isDetailEditing && (
              <div className="border-b border-gray-100 px-5 py-5">
                <RichTextViewer className="mx-auto max-w-3xl text-center" html={detailGroup.description} />
              </div>
            )}
            {canManage && isDetailEditing && (
              <section className="border-b border-[#D8E8DA] bg-[#F8FCF8] px-5 py-5">
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600" htmlFor="gallery-edit-title">
                        앨범 제목
                      </label>
                      <input
                        id="gallery-edit-title"
                        value={editAlbumTitle}
                        onChange={(event) => setEditAlbumTitle(event.target.value)}
                        className="mt-1 h-9 w-full border border-gray-300 bg-white px-3 text-sm outline-none focus:border-[#1B5E20]"
                        placeholder="앨범 제목"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600" htmlFor="gallery-edit-created-at">
                        등록일시
                      </label>
                      <input
                        id="gallery-edit-created-at"
                        type="datetime-local"
                        value={editAlbumCreatedAt}
                        onChange={(event) => setEditAlbumCreatedAt(event.target.value)}
                        className="mt-1 h-9 w-full border border-gray-300 bg-white px-3 text-sm outline-none focus:border-[#1B5E20]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600" htmlFor="gallery-edit-description">
                        앨범 글/설명
                      </label>
                      <RichTextEditor
                        id="gallery-edit-description"
                        value={editAlbumDescription}
                        onChange={setEditAlbumDescription}
                        placeholder="행사 설명, 설교 요약, 사진 설명 등을 입력할 수 있습니다."
                        minHeightClassName="min-h-56"
                      />
                    </div>
                  </div>
                  <div className="flex flex-col justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => detailFileInputRef.current?.click()}
                      disabled={isAddingDetailPhotos}
                      className="inline-flex h-10 items-center justify-center gap-2 border border-[#1B5E20] bg-white px-4 text-sm font-semibold text-[#1B5E20] hover:bg-[#F1F8E9] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isAddingDetailPhotos ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                      사진 추가
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveDetailAlbum}
                      disabled={isSavingDetail}
                      className="inline-flex h-10 items-center justify-center gap-2 bg-[#1B5E20] px-4 text-sm font-semibold text-white hover:bg-[#2E7D32] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isSavingDetail ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      저장
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditAlbumTitle(detailGroup.title);
                        setEditAlbumDescription(normalizeRichTextValue(detailGroup.description));
                        setEditAlbumCreatedAt(toDateTimeLocalValue(detailGroup.createdAt));
                        setEditPhotoCaptions(Object.fromEntries(
                          detailGroup.images.map((image) => [image.id, normalizeRichTextValue(image.caption)])
                        ));
                        setIsDetailEditing(false);
                      }}
                      className="inline-flex h-9 items-center justify-center border border-gray-300 bg-white px-4 text-xs font-semibold text-gray-600 hover:bg-gray-50"
                    >
                      취소
                    </button>
                  </div>
                </div>
                <p className="mt-3 text-xs text-gray-400">사진 설명, 사진 교체, 삭제는 각 사진 아래에서 수정할 수 있습니다.</p>
                <input
                  ref={detailFileInputRef}
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={handleAddDetailPhotos}
                />
              </section>
            )}
            <div className="grid gap-6 px-4 py-6 lg:grid-cols-[minmax(0,1fr)_260px]">
              <div className="space-y-5">
                {detailGroup.images.map((image, imageIndex) => {
                  const photoStory = getPhotoStory(image.caption, detailGroup.title, imageIndex);

                  return (
                  <figure key={image.id} className="w-full max-w-none">
                    <button
                      type="button"
                      onClick={() => setLightbox({ groupKey: detailGroup.key, imageIndex })}
                      className="group relative block w-full overflow-hidden bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B5E20]"
                      aria-label={`${detailGroup.title} ${imageIndex + 1}번째 사진 크게 보기`}
                    >
                      <img
                        src={image.imageUrl}
                        alt={`${detailGroup.title} ${imageIndex + 1}`}
                        loading={imageIndex === 0 ? "eager" : "lazy"}
                        className="mx-auto w-full object-contain"
                      />
                      <span className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-[#1B5E20] opacity-0 shadow-sm transition-opacity group-hover:opacity-100">
                        <ZoomIn className="h-4 w-4" />
                      </span>
                    </button>
                    <figcaption className="mt-2 flex items-center justify-between text-xs text-gray-400">
                      <span>{imageIndex + 1} / {detailGroup.images.length}</span>
                      <span>{photoStory ? "사진 설명" : detailGroup.title}</span>
                    </figcaption>
                    {photoStory && (
                      <RichTextViewer
                        html={photoStory}
                        className="mx-auto mb-12 mt-10 max-w-3xl text-center text-base leading-8 text-gray-700"
                      />
                    )}
                    {canManage && isDetailEditing && (
                      <div className="mt-3 border border-gray-200 bg-white p-3">
                        <label className="block text-xs font-semibold text-gray-600" htmlFor={`gallery-photo-caption-${image.id}`}>
                          사진 설명
                        </label>
                        <RichTextEditor
                          id={`gallery-photo-caption-${image.id}`}
                          value={editPhotoCaptions[image.id] ?? ""}
                          onChange={(value) =>
                            setEditPhotoCaptions((current) => ({
                              ...current,
                              [image.id]: value,
                            }))
                          }
                          minHeightClassName="min-h-[160px]"
                          className="mt-1"
                          placeholder="이 사진 아래, 다음 사진 위에 표시할 설명 글을 입력해주세요."
                        />
                        <p className="mt-1 text-xs text-gray-400">입력한 글은 사진과 사진 사이에 본문처럼 표시됩니다.</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <label className="inline-flex h-8 cursor-pointer items-center justify-center gap-1.5 border border-[#1B5E20] bg-white px-3 text-xs font-semibold text-[#1B5E20] hover:bg-[#F1F8E9]">
                            {editingPhotoId === image.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                            사진 교체
                            <input
                              type="file"
                              accept="image/jpeg,image/png,image/webp,image/gif"
                              className="hidden"
                              disabled={editingPhotoId === image.id}
                              onChange={(event) => {
                                const file = event.target.files?.[0];
                                event.target.value = "";
                                handleReplacePhoto(image, file);
                              }}
                            />
                          </label>
                          <button
                            type="button"
                            onClick={() => handleDeletePhoto(image)}
                            disabled={editingPhotoId === image.id}
                            className="inline-flex h-8 items-center justify-center gap-1.5 border border-red-200 bg-white px-3 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {editingPhotoId === image.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                            삭제
                          </button>
                        </div>
                      </div>
                    )}
                  </figure>
                  );
                })}
              </div>

              <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
                {canManage && detailGroup.images.length > 1 && (
                  <section className="border border-[#D8E8DA] bg-[#F8FCF8] p-4">
                    <h3 className="text-sm font-bold text-[#1B5E20]">사진 순서 변경</h3>
                    <p className="mt-1 text-xs text-gray-500">드래그하면 이 앨범 안의 표시 순서가 바뀝니다.</p>
                    <div className="mt-3">
                      <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={(event) => handleGroupDragEnd(detailGroup, event)}
                      >
                        <SortableContext items={detailGroup.images.map((item) => item.id)} strategy={rectSortingStrategy}>
                          <div className="space-y-2">
                            {detailGroup.images.map((image, imageIndex) => (
                              <SortableGalleryOrderItem
                                key={image.id}
                                item={image}
                                index={imageIndex}
                                title={detailGroup.title}
                              />
                            ))}
                          </div>
                        </SortableContext>
                      </DndContext>
                    </div>
                  </section>
                )}

                <section className="border border-gray-100 p-4">
                  <h3 className="mb-4 text-sm font-bold text-gray-900">첨부 이미지</h3>
                  <div className="space-y-3">
                    {detailGroup.images.map((image, imageIndex) => (
                      <a
                        key={image.id}
                        href={image.imageUrl}
                        className="flex items-start gap-2 border border-dashed border-gray-200 p-3 text-xs text-gray-600 hover:border-[#86C5D8] hover:text-[#1B5E20]"
                      >
                        <FileImage className="mt-0.5 h-4 w-4 shrink-0 text-[#1B5E20]" />
                        <span className="min-w-0 flex-1">
                          <span className="block font-semibold">{imageIndex + 1}페이지</span>
                          <span className="block truncate">{detailGroup.title}</span>
                        </span>
                        <Download className="h-4 w-4 shrink-0" />
                      </a>
                    ))}
                  </div>
                </section>
              </aside>
            </div>
          </article>
        </div>

        {renderLightbox()}
      </>
    );
  }

  return (
    <>
      <div className="space-y-5">
        {adminGalleryTools}
        {adminAlbumOrderTools}

        <div className="border-b border-gray-100 pb-4">
          <p className="text-sm text-gray-500">
            총 <span className="font-semibold text-[#1B5E20]">{galleryGroups.length}</span>개의 행사
            <span className="ml-2 text-gray-400">사진 {galleryItems.length}장</span>
            {searchKeyword && <span className="ml-2 text-gray-400">검색 결과 {filteredGroups.length}개</span>}
          </p>
          <p className="mt-1 text-xs text-gray-400">행사 제목을 선택하면 사진을 크게 확인할 수 있습니다.</p>
        </div>

        <div className="flex flex-col gap-3 border-b border-[#86C5D8] pb-2 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <ViewModeToggle value={viewMode} onChange={setViewMode} />
            <span>새 글 {newGroupCount} / {filteredGroups.length}</span>
          </div>
          <form
            className="flex min-w-0 justify-end gap-1"
            onSubmit={(event) => {
              event.preventDefault();
              setSearchKeyword(searchInput);
              setPage(1);
            }}
          >
            <select
              className="h-8 rounded-none border border-gray-300 bg-white px-2 text-xs text-gray-700 outline-none focus:border-[#1B5E20]"
              aria-label="검색 조건"
              defaultValue="title"
            >
              <option value="title">제목</option>
            </select>
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              className="h-8 min-w-0 flex-1 rounded-none border border-gray-300 px-2 text-xs outline-none focus:border-[#1B5E20] md:w-56"
              aria-label="검색어"
            />
            <button
              type="submit"
              className="flex h-8 items-center gap-1 border border-[#86C5D8] px-2 text-xs text-[#1B5E20] hover:bg-[#F1F8E9]"
            >
              <Search className="h-3.5 w-3.5" />
              검색
            </button>
          </form>
        </div>

        {filteredGroups.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 bg-gray-50 border-2 border-dashed border-gray-200">
            <Images className="w-10 h-10 text-gray-300 mb-3" />
            <p className="text-gray-400 text-sm">해당 조건의 사진이 없습니다.</p>
          </div>
        ) : (
          <>
            {viewMode === "list" ? (
              <div className="overflow-hidden border border-gray-200 bg-white">
                <table className="w-full table-fixed text-sm">
                  <colgroup>
                    <col className="w-16" />
                    <col />
                    <col className="w-32" />
                    <col className="w-32" />
                    <col className="w-20" />
                    {canManage && <col className="w-24" />}
                  </colgroup>
                  <thead className="border-t-2 border-[#62B5D1] bg-[#EAF8FC] text-[#0F607A]">
                    <tr>
                      <th scope="col" className="px-3 py-3 text-center font-semibold">번호</th>
                      <th scope="col" className="px-3 py-3 text-center font-semibold">제목</th>
                      <th scope="col" className="px-3 py-3 text-center font-semibold">작성자</th>
                      <th scope="col" className="px-3 py-3 text-center font-semibold">등록일</th>
                      <th scope="col" className="px-3 py-3 text-center font-semibold">첨부</th>
                      {canManage && <th scope="col" className="px-3 py-3 text-center font-semibold">관리</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {visibleGroups.map((group, index) => {
                      const detailHref = buildGalleryHref(location, searchString, group.key);
                      const postNumber = filteredGroups.length - ((activePage - 1) * pageSize + index);
                      const visibility = getGalleryGroupVisibility(group);

                      return (
                        <tr key={group.key} className={`transition-colors hover:bg-gray-50 ${canManage && visibility !== "visible" ? "bg-gray-50/70" : ""}`}>
                          <td className="px-3 py-3 text-center text-gray-500">{postNumber}</td>
                          <td className="px-3 py-3">
                            <a
                              href={detailHref}
                              onClick={(event) => {
                                event.preventDefault();
                                navigate(detailHref);
                              }}
                              className="block max-w-full truncate text-left text-gray-800 hover:text-[#1B5E20]"
                            >
                              {group.title}
                            </a>
                            {canManage && visibility !== "visible" && (
                              <span className="mt-1 inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-500">
                                {visibility === "hidden" ? "숨김" : "부분 숨김"}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-3 text-center text-gray-600">관리자</td>
                          <td className="px-3 py-3 text-center text-gray-500">{formatGalleryDate(group.createdAt)}</td>
                          <td className="px-3 py-3 text-center text-gray-500">{group.images.length}</td>
                          {canManage && (
                            <td className="px-3 py-3 text-center">
                              <button
                                type="button"
                                onClick={() => handleToggleAlbumVisibility(group)}
                                className="mr-1 inline-flex h-7 items-center justify-center gap-1 border border-yellow-200 bg-white px-2 text-xs font-semibold text-yellow-700 hover:bg-yellow-50"
                              >
                                {visibility === "visible" ? "숨김" : "공개"}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteAlbum(group)}
                                disabled={deletingAlbumKey === group.key}
                                className="inline-flex h-7 items-center justify-center gap-1 border border-red-200 bg-white px-2 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {deletingAlbumKey === group.key ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                                삭제
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-x-8 gap-y-7 border-y border-[#86C5D8] py-5 sm:grid-cols-3 lg:grid-cols-4">
                {visibleGroups.map((group) => {
                  const thumbnail = group.images[0];
                  const detailHref = buildGalleryHref(location, searchString, group.key);
                  const visibility = getGalleryGroupVisibility(group);

                  return (
                    <div key={group.key} className={`relative text-center ${canManage && visibility !== "visible" ? "opacity-75" : ""}`}>
                      <a
                        href={detailHref}
                        onClick={(event) => {
                          event.preventDefault();
                          navigate(detailHref);
                        }}
                        className="group block focus:outline-none"
                      >
                        <span className="mx-auto block overflow-hidden bg-gray-100 ring-1 ring-gray-200 transition group-hover:ring-[#86C5D8]">
                          <img
                            src={thumbnail.imageUrl}
                            alt={group.title}
                            loading="lazy"
                            className="aspect-[4/3] w-full object-cover transition duration-300 group-hover:scale-105"
                          />
                        </span>
                        <span className="mt-2 block break-keep text-xs leading-5 text-gray-700 group-hover:text-[#1B5E20]">
                          {group.title}
                        </span>
                      </a>
                      {canManage && visibility !== "visible" && (
                        <span className="absolute left-2 top-2 inline-flex rounded-full bg-gray-900/80 px-2 py-1 text-[11px] font-semibold text-white shadow-sm">
                          {visibility === "hidden" ? "숨김" : "부분 숨김"}
                        </span>
                      )}
                      {canManage && (
                        <button
                          type="button"
                          onClick={() => handleToggleAlbumVisibility(group)}
                          className="absolute right-16 top-2 inline-flex h-8 items-center justify-center rounded-full border border-yellow-200 bg-white/95 px-2 text-xs font-semibold text-yellow-700 shadow-sm hover:bg-yellow-50"
                        >
                          {visibility === "visible" ? "숨김" : "공개"}
                        </button>
                      )}
                      {canManage && (
                        <button
                          type="button"
                          onClick={() => handleDeleteAlbum(group)}
                          disabled={deletingAlbumKey === group.key}
                          className="absolute right-2 top-2 inline-flex h-8 items-center justify-center gap-1 rounded-full border border-red-200 bg-white/95 px-2 text-xs font-semibold text-red-600 shadow-sm hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {deletingAlbumKey === group.key ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                          삭제
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {totalPages > 1 && (
              <div className="flex justify-center gap-1 pt-1">
                {pageNumbers.map((pageNumber) => (
                  <button
                    key={pageNumber}
                    type="button"
                    onClick={() => setPage(pageNumber)}
                    className={`h-7 min-w-7 border px-2 text-xs ${
                      activePage === pageNumber
                        ? "border-[#1B5E20] bg-[#1B5E20] text-white"
                        : "border-gray-200 bg-white text-gray-500 hover:border-[#86C5D8] hover:text-[#1B5E20]"
                    }`}
                  >
                    {pageNumber}
                  </button>
                ))}
              </div>
            )}

          </>
        )}
      </div>

      {renderLightbox()}
    </>
  );
}
