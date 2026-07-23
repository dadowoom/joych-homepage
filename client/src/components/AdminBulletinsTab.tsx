import { useEffect, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../server/routers";
import {
  ArrowDown,
  ArrowUp,
  Eye,
  EyeOff,
  ImagePlus,
  Images,
  Paperclip,
  Pencil,
  RotateCcw,
  Save,
  Trash2,
  Upload,
  X,
} from "lucide-react";

const fieldClass =
  "border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B5E20]/20 focus:border-[#1B5E20]";

const statusLabels: Record<string, string> = {
  published: "공개",
  hidden: "숨김",
  archived: "삭제됨",
};

const MAX_BULLETIN_IMAGE_BYTES = 1 * 1024 * 1024;
const MAX_BULLETIN_IMAGE_COUNT = 12;
const ALLOWED_BULLETIN_IMAGE_RE = /\.(jpg|jpeg|png)$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

type BulletinRow =
  inferRouterOutputs<AppRouter>["cms"]["bulletins"]["list"][number];
type BulletinImage = BulletinRow["images"][number];
type BulletinUpdateImages = NonNullable<
  inferRouterInputs<AppRouter>["cms"]["bulletins"]["update"]["images"]
>;
type ExistingPageDraft = {
  kind: "existing";
  image: BulletinImage;
};
type NewPageDraft = {
  kind: "new";
  file: File;
  previewUrl: string;
};
type PageDraft = ExistingPageDraft | NewPageDraft;
type EditPageSlot = {
  slotId: string;
  page: PageDraft | null;
  originalPage?: ExistingPageDraft;
};

function formatDate(value: Date | string | null | undefined) {
  if (!value) return "-";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatFileSize(bytes: number | null | undefined) {
  if (!bytes) return "-";
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () =>
      reject(reader.error ?? new Error("파일을 읽지 못했습니다."));
    reader.readAsDataURL(file);
  });
}

function sortBulletinImages(files: File[]) {
  return [...files].sort((a, b) =>
    a.name.localeCompare(b.name, "ko-KR", {
      numeric: true,
      sensitivity: "base",
    })
  );
}

function getBulletinFilesError(
  files: File[],
  maxCount = MAX_BULLETIN_IMAGE_COUNT
) {
  if (files.length > maxCount) {
    return `주보 이미지는 최대 ${MAX_BULLETIN_IMAGE_COUNT}장까지 등록할 수 있습니다.`;
  }
  if (files.some(file => !ALLOWED_BULLETIN_IMAGE_RE.test(file.name))) {
    return "주보 이미지는 JPG, PNG 파일만 등록할 수 있습니다.";
  }
  if (files.some(file => file.size === 0)) {
    return "빈 파일은 업로드할 수 없습니다.";
  }
  if (files.some(file => file.size > MAX_BULLETIN_IMAGE_BYTES)) {
    return "주보 이미지는 한 장당 최대 1MB까지 업로드할 수 있습니다.";
  }
  return null;
}

function getBulletinImageCount(bulletin: { images?: unknown[] }) {
  return bulletin.images?.length ?? 1;
}

function createSlotId() {
  return `bulletin-page-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function createNewPageDraft(file: File): NewPageDraft {
  return {
    kind: "new",
    file,
    previewUrl: URL.createObjectURL(file),
  };
}

function revokeNewPageUrls(slots: EditPageSlot[]) {
  for (const slot of slots) {
    if (slot.page?.kind === "new") URL.revokeObjectURL(slot.page.previewUrl);
  }
}

function getSortedBulletinImages(bulletin: BulletinRow) {
  return [...bulletin.images].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.id - b.id
  );
}

function didBulletinPagesChange(
  slots: EditPageSlot[],
  originalImages: BulletinImage[]
) {
  const pages = slots.flatMap(slot => (slot.page ? [slot.page] : []));
  if (pages.length !== originalImages.length) return true;
  return pages.some(
    (page, index) =>
      page.kind === "new" || page.image.id !== originalImages[index]?.id
  );
}

type BulletinForm = {
  title: string;
  bulletinDate: string;
  status: "published" | "hidden";
};

function createEmptyForm(): BulletinForm {
  return {
    title: "",
    bulletinDate: new Date().toISOString().slice(0, 10),
    status: "published",
  };
}

export default function AdminBulletinsTab() {
  const utils = trpc.useUtils();
  const { data: bulletins = [], isLoading } =
    trpc.cms.bulletins.list.useQuery();
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [form, setForm] = useState<BulletinForm>(createEmptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<BulletinForm>(createEmptyForm);
  const [editPageSlots, setEditPageSlots] = useState<EditPageSlot[]>([]);
  const editPageSlotsRef = useRef<EditPageSlot[]>([]);
  const [isPreparingEditFiles, setIsPreparingEditFiles] = useState(false);

  useEffect(() => {
    return () => revokeNewPageUrls(editPageSlotsRef.current);
  }, []);

  const replaceEditPageSlots = (nextSlots: EditPageSlot[]) => {
    editPageSlotsRef.current = nextSlots;
    setEditPageSlots(nextSlots);
  };

  const closeEditor = () => {
    revokeNewPageUrls(editPageSlotsRef.current);
    replaceEditPageSlots([]);
    setEditingId(null);
    setIsPreparingEditFiles(false);
  };

  const resetCreateForm = () => {
    setForm(createEmptyForm());
    setSelectedFiles([]);
    setFileInputKey(key => key + 1);
  };

  const refreshBulletins = async () => {
    await Promise.all([
      utils.cms.bulletins.list.invalidate(),
      utils.home.bulletins.invalidate(),
    ]);
  };

  const createBulletin = trpc.cms.bulletins.create.useMutation({
    onSuccess: async () => {
      toast.success("주보가 등록되었습니다.");
      resetCreateForm();
      await refreshBulletins();
    },
    onError: error => toast.error(error.message),
  });

  const updateBulletin = trpc.cms.bulletins.update.useMutation({
    onSuccess: async () => {
      toast.success("주보가 수정되었습니다.");
      await refreshBulletins();
    },
    onError: error => toast.error(error.message),
  });

  const archiveBulletin = trpc.cms.bulletins.archive.useMutation({
    onSuccess: async (_data, variables) => {
      toast.success("주보가 삭제 처리되었습니다.");
      if (editingId === variables.id) closeEditor();
      await refreshBulletins();
    },
    onError: error => toast.error(error.message),
  });

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (selectedFiles.length === 0) {
      toast.error("등록할 주보 이미지를 선택해주세요.");
      return;
    }
    const filesError = getBulletinFilesError(selectedFiles);
    if (filesError) {
      toast.error(filesError);
      return;
    }

    createBulletin.mutate({
      title: form.title,
      bulletinDate: form.bulletinDate,
      status: form.status,
      files: await Promise.all(
        selectedFiles.map(async file => ({
          fileName: file.name,
          mimeType: file.type || "application/octet-stream",
          base64: await fileToBase64(file),
        }))
      ),
    });
  }

  function startEdit(bulletin: BulletinRow) {
    revokeNewPageUrls(editPageSlotsRef.current);
    const slots = getSortedBulletinImages(bulletin).map(image => {
      const originalPage: ExistingPageDraft = { kind: "existing", image };
      return {
        slotId: `existing-${bulletin.id}-${image.id}-${image.sortOrder}`,
        page: originalPage,
        originalPage,
      };
    });
    replaceEditPageSlots(slots);
    setEditingId(bulletin.id);
    setEditForm({
      title: bulletin.title,
      bulletinDate: bulletin.bulletinDate,
      status: bulletin.status === "hidden" ? "hidden" : "published",
    });
  }

  function replacePageAtSlot(slotId: string, file: File) {
    const filesError = getBulletinFilesError([file]);
    if (filesError) {
      toast.error(filesError);
      return;
    }
    const target = editPageSlotsRef.current.find(
      slot => slot.slotId === slotId
    );
    if (!target) return;
    if (target.page?.kind === "new")
      URL.revokeObjectURL(target.page.previewUrl);
    const nextPage = createNewPageDraft(file);
    replaceEditPageSlots(
      editPageSlotsRef.current.map(slot =>
        slot.slotId === slotId ? { ...slot, page: nextPage } : slot
      )
    );
  }

  function addEditPages(files: File[]) {
    if (files.length === 0) return;
    const sortedFiles = sortBulletinImages(files);
    const finalPageCount = editPageSlotsRef.current.filter(
      slot => slot.page
    ).length;
    const filesError = getBulletinFilesError(
      sortedFiles,
      MAX_BULLETIN_IMAGE_COUNT - finalPageCount
    );
    if (filesError) {
      toast.error(filesError);
      return;
    }
    replaceEditPageSlots([
      ...editPageSlotsRef.current,
      ...sortedFiles.map(file => ({
        slotId: createSlotId(),
        page: createNewPageDraft(file),
      })),
    ]);
  }

  function removeEditPage(slotId: string) {
    const target = editPageSlotsRef.current.find(
      slot => slot.slotId === slotId
    );
    if (!target) return;
    if (target.page?.kind === "new")
      URL.revokeObjectURL(target.page.previewUrl);
    if (target.originalPage) {
      replaceEditPageSlots(
        editPageSlotsRef.current.map(slot =>
          slot.slotId === slotId ? { ...slot, page: null } : slot
        )
      );
      return;
    }
    replaceEditPageSlots(
      editPageSlotsRef.current.filter(slot => slot.slotId !== slotId)
    );
  }

  function restoreOriginalPage(slotId: string) {
    const target = editPageSlotsRef.current.find(
      slot => slot.slotId === slotId
    );
    if (!target?.originalPage) return;
    if (target.page?.kind === "new")
      URL.revokeObjectURL(target.page.previewUrl);
    replaceEditPageSlots(
      editPageSlotsRef.current.map(slot =>
        slot.slotId === slotId
          ? { ...slot, page: slot.originalPage ?? null }
          : slot
      )
    );
  }

  function moveEditPage(slotId: string, direction: -1 | 1) {
    const currentIndex = editPageSlotsRef.current.findIndex(
      slot => slot.slotId === slotId
    );
    if (currentIndex < 0) return;
    const activeIndices = editPageSlotsRef.current.flatMap((slot, index) =>
      slot.page ? [index] : []
    );
    const activeIndex = activeIndices.indexOf(currentIndex);
    const nextIndex = activeIndices[activeIndex + direction];
    if (nextIndex === undefined) return;
    const nextSlots = [...editPageSlotsRef.current];
    [nextSlots[currentIndex], nextSlots[nextIndex]] = [
      nextSlots[nextIndex],
      nextSlots[currentIndex],
    ];
    replaceEditPageSlots(nextSlots);
  }

  async function handleEditSave() {
    if (!editingId) return;
    if (!editForm.title.trim()) {
      toast.error("주보 제목을 입력해주세요.");
      return;
    }
    if (!DATE_RE.test(editForm.bulletinDate)) {
      toast.error("주보 날짜를 확인해주세요.");
      return;
    }

    const bulletin = bulletins.find(item => item.id === editingId);
    if (!bulletin) {
      toast.error("수정할 주보를 찾지 못했습니다. 목록을 새로고침해 주세요.");
      return;
    }

    const finalPages = editPageSlotsRef.current.flatMap(slot =>
      slot.page ? [slot.page] : []
    );
    if (finalPages.length === 0) {
      toast.error("주보 이미지는 1장 이상 남겨야 합니다.");
      return;
    }
    if (finalPages.length > MAX_BULLETIN_IMAGE_COUNT) {
      toast.error(
        `주보 이미지는 최대 ${MAX_BULLETIN_IMAGE_COUNT}장까지 저장할 수 있습니다.`
      );
      return;
    }

    const originalImages = getSortedBulletinImages(bulletin);
    const pagesChanged = didBulletinPagesChange(
      editPageSlotsRef.current,
      originalImages
    );
    let images: BulletinUpdateImages | undefined;
    if (pagesChanged) {
      setIsPreparingEditFiles(true);
      try {
        images = await Promise.all(
          finalPages.map(async page =>
            page.kind === "existing"
              ? { existingImageId: page.image.id }
              : {
                  file: {
                    fileName: page.file.name,
                    mimeType: page.file.type || "application/octet-stream",
                    base64: await fileToBase64(page.file),
                  },
                }
          )
        );
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "주보 이미지를 읽지 못했습니다."
        );
        setIsPreparingEditFiles(false);
        return;
      }
      setIsPreparingEditFiles(false);
    }

    updateBulletin.mutate(
      {
        id: editingId,
        title: editForm.title.trim(),
        bulletinDate: editForm.bulletinDate,
        status: editForm.status,
        ...(images ? { images } : {}),
      },
      {
        onSuccess: closeEditor,
      }
    );
  }

  function handleDelete(id: number, title: string) {
    const ok = window.confirm(
      `"${title}" 주보를 삭제 처리할까요?\n공개 화면과 관리 목록에서는 사라지고, DB에서는 보관 상태로 남습니다.`
    );
    if (!ok) return;
    archiveBulletin.mutate({ id });
  }

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-bold text-gray-800">주보 관리</h3>
        <p className="text-sm text-gray-500 mt-0.5">
          주보 이미지를 여러 장 등록하면 공개 주보 보기 화면에 순서대로
          표시됩니다.
        </p>
      </div>

      <section className="border border-gray-200 rounded-xl p-4">
        <h4 className="font-bold text-gray-800 mb-4">새 주보 등록</h4>
        <form
          onSubmit={handleSubmit}
          className="grid gap-4 lg:grid-cols-[1fr_160px_140px_auto]"
        >
          <div>
            <label className="block mb-1.5 text-xs font-medium text-gray-500">
              제목
            </label>
            <input
              className={`${fieldClass} w-full`}
              required
              value={form.title}
              onChange={event =>
                setForm(prev => ({ ...prev, title: event.target.value }))
              }
              placeholder="예: 2026년 6월 7일 주보"
            />
          </div>
          <div>
            <label className="block mb-1.5 text-xs font-medium text-gray-500">
              주보 날짜
            </label>
            <input
              type="date"
              className={`${fieldClass} w-full`}
              required
              value={form.bulletinDate}
              onChange={event =>
                setForm(prev => ({ ...prev, bulletinDate: event.target.value }))
              }
            />
          </div>
          <div>
            <label className="block mb-1.5 text-xs font-medium text-gray-500">
              공개 상태
            </label>
            <select
              className={`${fieldClass} w-full bg-white`}
              value={form.status}
              onChange={event =>
                setForm(prev => ({
                  ...prev,
                  status: event.target.value as "published" | "hidden",
                }))
              }
            >
              <option value="published">공개</option>
              <option value="hidden">숨김</option>
            </select>
          </div>
          <div className="flex items-end gap-2">
            <label className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border border-[#1B5E20]/30 px-4 text-sm font-medium text-[#1B5E20] transition-colors hover:bg-[#F1F8E9]">
              <Paperclip className="h-4 w-4" />
              이미지
              <input
                key={fileInputKey}
                type="file"
                className="sr-only"
                accept=".jpg,.jpeg,.png"
                multiple
                onChange={event => {
                  const files = sortBulletinImages(
                    Array.from(event.target.files ?? [])
                  );
                  const filesError = getBulletinFilesError(files);
                  if (filesError) {
                    toast.error(filesError);
                    event.currentTarget.value = "";
                    return;
                  }
                  setSelectedFiles(files);
                }}
              />
            </label>
            <button
              type="submit"
              disabled={createBulletin.isPending}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#1B5E20] px-4 text-sm font-semibold text-white hover:bg-[#2E7D32] disabled:opacity-50"
            >
              <Upload className="h-4 w-4" />
              등록
            </button>
          </div>
          <div className="lg:col-span-4">
            {selectedFiles.length > 0 ? (
              <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                <div className="mb-2 flex items-center justify-between gap-3 text-xs text-gray-500">
                  <span className="inline-flex items-center gap-1 font-medium text-gray-700">
                    <Images className="h-3.5 w-3.5" />
                    선택된 이미지 {selectedFiles.length}장
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedFiles([]);
                      setFileInputKey(key => key + 1);
                    }}
                    className="inline-flex items-center gap-1 text-gray-400 hover:text-red-500"
                  >
                    <X className="h-3.5 w-3.5" />
                    지우기
                  </button>
                </div>
                <ol className="grid gap-1 text-xs text-gray-500 sm:grid-cols-2">
                  {selectedFiles.map((file, index) => (
                    <li
                      key={`${file.name}-${file.lastModified}`}
                      className="truncate"
                    >
                      {index + 1}. {file.name} · {formatFileSize(file.size)}
                    </li>
                  ))}
                </ol>
              </div>
            ) : (
              <p className="text-xs text-gray-400">
                JPG, PNG / 최대 12장 / 한 장당 1MB
              </p>
            )}
          </div>
        </form>
      </section>

      <section className="border border-gray-200 rounded-xl p-4">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <h4 className="font-bold text-gray-800">등록된 주보</h4>
            <p className="text-xs text-gray-400 mt-0.5">
              제목, 날짜, 공개 상태와 각 페이지 파일을 수정하거나 삭제 처리할 수
              있습니다.
            </p>
          </div>
          <span className="text-xs bg-[#E8F5E9] text-[#1B5E20] px-2.5 py-1 rounded-full">
            {bulletins.length}건
          </span>
        </div>

        {isLoading ? (
          <p className="text-gray-500 py-8 text-center">불러오는 중...</p>
        ) : bulletins.length === 0 ? (
          <p className="text-sm text-gray-400 py-4">
            아직 등록된 주보가 없습니다.
          </p>
        ) : (
          <div className="space-y-3">
            {bulletins.map(bulletin => {
              const isEditing = editingId === bulletin.id;
              const isBusy =
                updateBulletin.isPending ||
                archiveBulletin.isPending ||
                isPreparingEditFiles;
              const finalPageCount = editPageSlots.filter(
                slot => slot.page
              ).length;
              const deletedPageCount = editPageSlots.filter(
                slot => !slot.page && slot.originalPage
              ).length;
              const newPageCount = editPageSlots.filter(
                slot => slot.page?.kind === "new"
              ).length;

              return (
                <div
                  key={bulletin.id}
                  className="border border-gray-100 rounded-lg p-4"
                >
                  {isEditing ? (
                    <div className="space-y-3">
                      <div className="grid gap-3 lg:grid-cols-[1fr_160px_140px]">
                        <div>
                          <label className="block mb-1.5 text-xs font-medium text-gray-500">
                            제목
                          </label>
                          <input
                            className={`${fieldClass} w-full`}
                            value={editForm.title}
                            onChange={event =>
                              setEditForm(prev => ({
                                ...prev,
                                title: event.target.value,
                              }))
                            }
                          />
                        </div>
                        <div>
                          <label className="block mb-1.5 text-xs font-medium text-gray-500">
                            주보 날짜
                          </label>
                          <input
                            type="date"
                            className={`${fieldClass} w-full`}
                            value={editForm.bulletinDate}
                            onChange={event =>
                              setEditForm(prev => ({
                                ...prev,
                                bulletinDate: event.target.value,
                              }))
                            }
                          />
                        </div>
                        <div>
                          <label className="block mb-1.5 text-xs font-medium text-gray-500">
                            공개 상태
                          </label>
                          <select
                            className={`${fieldClass} w-full bg-white`}
                            value={editForm.status}
                            onChange={event =>
                              setEditForm(prev => ({
                                ...prev,
                                status: event.target.value as
                                  | "published"
                                  | "hidden",
                              }))
                            }
                          >
                            <option value="published">공개</option>
                            <option value="hidden">숨김</option>
                          </select>
                        </div>
                      </div>

                      <section className="rounded-xl border border-[#D8E8DA] bg-[#F8FCF8] p-3 sm:p-4">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <h5 className="text-sm font-bold text-gray-800">
                              페이지 파일 관리
                            </h5>
                            <p className="mt-1 text-xs leading-5 text-gray-500">
                              교정할 페이지의{" "}
                              <strong className="font-semibold text-gray-700">
                                교체
                              </strong>
                              를 누르면 그 자리와 뒤 페이지 순서가 그대로
                              유지됩니다. 삭제한 자리에도 새 파일을 다시 넣을 수
                              있습니다.
                            </p>
                          </div>
                          <div
                            className="flex shrink-0 flex-wrap gap-1.5 text-[11px]"
                            aria-live="polite"
                          >
                            <span className="rounded-full bg-white px-2.5 py-1 font-semibold text-[#1B5E20] ring-1 ring-[#C8E6C9]">
                              최종 {finalPageCount}페이지
                            </span>
                            {newPageCount > 0 && (
                              <span className="rounded-full bg-blue-50 px-2.5 py-1 text-blue-700">
                                새 파일 {newPageCount}장
                              </span>
                            )}
                            {deletedPageCount > 0 && (
                              <span className="rounded-full bg-amber-50 px-2.5 py-1 text-amber-700">
                                삭제 예정 {deletedPageCount}장
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="mt-4 space-y-2">
                          {editPageSlots.map((slot, index) => {
                            const page = slot.page;
                            const finalPageNumber = page
                              ? editPageSlots
                                  .slice(0, index + 1)
                                  .filter(item => item.page).length
                              : null;
                            const originalPageNumber =
                              (slot.originalPage?.image.sortOrder ?? index) + 1;
                            const isReplacement =
                              page?.kind === "new" &&
                              Boolean(slot.originalPage);

                            if (!page) {
                              return (
                                <div
                                  key={slot.slotId}
                                  className="rounded-lg border border-dashed border-amber-300 bg-amber-50/70 p-3"
                                >
                                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                    <div className="min-w-0">
                                      <p className="text-xs font-bold text-amber-800">
                                        기존 {originalPageNumber}페이지 삭제
                                        예정
                                      </p>
                                      <p className="mt-1 text-xs leading-5 text-amber-700/80">
                                        그대로 저장하면 뒤 페이지가 한 칸씩
                                        당겨집니다. 이 위치에 교정본을 올리면
                                        순서가 유지됩니다.
                                      </p>
                                    </div>
                                    <div className="flex shrink-0 flex-wrap gap-2">
                                      <label className="inline-flex h-9 cursor-pointer items-center justify-center rounded-lg bg-[#1B5E20] px-3 text-xs font-semibold text-white hover:bg-[#2E7D32]">
                                        <Upload className="mr-1 h-3.5 w-3.5" />
                                        이 위치에 업로드
                                        <input
                                          type="file"
                                          className="sr-only"
                                          accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                                          disabled={isBusy}
                                          onChange={event => {
                                            const file =
                                              event.target.files?.[0];
                                            if (file)
                                              replacePageAtSlot(
                                                slot.slotId,
                                                file
                                              );
                                            event.currentTarget.value = "";
                                          }}
                                        />
                                      </label>
                                      {slot.originalPage && (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            restoreOriginalPage(slot.slotId)
                                          }
                                          disabled={isBusy}
                                          className="inline-flex h-9 items-center justify-center rounded-lg border border-amber-200 bg-white px-3 text-xs font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-50"
                                        >
                                          <RotateCcw className="mr-1 h-3.5 w-3.5" />
                                          삭제 취소
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            }

                            const fileName =
                              page.kind === "existing"
                                ? page.image.fileName
                                : page.file.name;
                            const fileSize =
                              page.kind === "existing"
                                ? page.image.fileSize
                                : page.file.size;
                            const previewUrl =
                              page.kind === "existing"
                                ? page.image.fileUrl
                                : page.previewUrl;

                            return (
                              <div
                                key={slot.slotId}
                                className="grid gap-3 rounded-lg border border-gray-200 bg-white p-3 sm:grid-cols-[72px_minmax(0,1fr)_auto] sm:items-center"
                              >
                                <a
                                  href={previewUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="block h-24 w-[72px] overflow-hidden rounded border border-gray-100 bg-gray-50"
                                  aria-label={`${finalPageNumber}페이지 이미지 크게 보기`}
                                >
                                  <img
                                    src={previewUrl}
                                    alt={`${bulletin.title} ${finalPageNumber}페이지`}
                                    className="h-full w-full object-cover"
                                    loading="lazy"
                                  />
                                </a>

                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <span className="rounded-full bg-[#E8F5E9] px-2 py-0.5 text-[11px] font-bold text-[#1B5E20]">
                                      최종 {finalPageNumber}페이지
                                    </span>
                                    {isReplacement ? (
                                      <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] text-blue-700">
                                        교체 예정
                                      </span>
                                    ) : page.kind === "new" ? (
                                      <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] text-blue-700">
                                        새 페이지
                                      </span>
                                    ) : (
                                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-500">
                                        기존 페이지
                                      </span>
                                    )}
                                  </div>
                                  <p
                                    className="mt-1.5 truncate text-sm font-medium text-gray-800"
                                    title={fileName}
                                  >
                                    {fileName}
                                  </p>
                                  <p className="mt-0.5 text-xs text-gray-400">
                                    {formatFileSize(fileSize)}
                                    {isReplacement && slot.originalPage
                                      ? ` · 기존 ${slot.originalPage.image.fileName} 교체`
                                      : ""}
                                  </p>
                                </div>

                                <div className="flex flex-wrap items-center gap-1.5 sm:max-w-[220px] sm:justify-end">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      moveEditPage(slot.slotId, -1)
                                    }
                                    disabled={
                                      isBusy ||
                                      !editPageSlots
                                        .slice(0, index)
                                        .some(item => item.page)
                                    }
                                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30"
                                    aria-label={`${finalPageNumber}페이지 위로 이동`}
                                    title="위로 이동"
                                  >
                                    <ArrowUp className="h-4 w-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => moveEditPage(slot.slotId, 1)}
                                    disabled={
                                      isBusy ||
                                      !editPageSlots
                                        .slice(index + 1)
                                        .some(item => item.page)
                                    }
                                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30"
                                    aria-label={`${finalPageNumber}페이지 아래로 이동`}
                                    title="아래로 이동"
                                  >
                                    <ArrowDown className="h-4 w-4" />
                                  </button>
                                  <label className="inline-flex h-9 cursor-pointer items-center justify-center rounded-lg border border-[#1B5E20]/30 px-3 text-xs font-semibold text-[#1B5E20] hover:bg-[#F1F8E9]">
                                    <Upload className="mr-1 h-3.5 w-3.5" />
                                    교체
                                    <input
                                      type="file"
                                      className="sr-only"
                                      accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                                      disabled={isBusy}
                                      onChange={event => {
                                        const file = event.target.files?.[0];
                                        if (file)
                                          replacePageAtSlot(slot.slotId, file);
                                        event.currentTarget.value = "";
                                      }}
                                    />
                                  </label>
                                  {isReplacement && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        restoreOriginalPage(slot.slotId)
                                      }
                                      disabled={isBusy}
                                      className="inline-flex h-9 items-center justify-center rounded-lg border border-gray-200 px-3 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                                    >
                                      <RotateCcw className="mr-1 h-3.5 w-3.5" />
                                      원본
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => removeEditPage(slot.slotId)}
                                    disabled={isBusy}
                                    className="inline-flex h-9 items-center justify-center rounded-lg border border-red-100 px-3 text-xs font-medium text-red-500 hover:bg-red-50 disabled:opacity-50"
                                  >
                                    <Trash2 className="mr-1 h-3.5 w-3.5" />
                                    {slot.originalPage ? "삭제" : "추가 취소"}
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        <div className="mt-3 flex flex-col gap-2 border-t border-[#D8E8DA] pt-3 sm:flex-row sm:items-center sm:justify-between">
                          <p className="text-xs text-gray-500">
                            위·아래 버튼으로 최종 표시 순서를 바꿀 수 있습니다.
                          </p>
                          <label
                            className={`inline-flex h-9 items-center justify-center rounded-lg border border-[#1B5E20]/30 bg-white px-3 text-xs font-semibold text-[#1B5E20] hover:bg-[#F1F8E9] ${
                              isBusy ||
                              finalPageCount >= MAX_BULLETIN_IMAGE_COUNT
                                ? "cursor-not-allowed opacity-50"
                                : "cursor-pointer"
                            }`}
                          >
                            <ImagePlus className="mr-1 h-3.5 w-3.5" />
                            맨 뒤에 페이지 추가
                            <input
                              type="file"
                              className="sr-only"
                              accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                              multiple
                              disabled={
                                isBusy ||
                                finalPageCount >= MAX_BULLETIN_IMAGE_COUNT
                              }
                              onChange={event => {
                                addEditPages(
                                  Array.from(event.target.files ?? [])
                                );
                                event.currentTarget.value = "";
                              }}
                            />
                          </label>
                        </div>

                        {finalPageCount === 0 && (
                          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-600">
                            주보 이미지는 1장 이상 필요합니다. 삭제를 취소하거나
                            새 이미지를 올려주세요.
                          </p>
                        )}
                      </section>

                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={handleEditSave}
                          disabled={
                            isBusy ||
                            !editForm.title.trim() ||
                            finalPageCount === 0
                          }
                          className="inline-flex h-9 items-center justify-center rounded-lg bg-[#1B5E20] px-3 text-xs font-medium text-white hover:bg-[#2E7D32] disabled:opacity-50"
                        >
                          <Save className="mr-1 h-3.5 w-3.5" />
                          {isPreparingEditFiles
                            ? "파일 준비 중..."
                            : "변경사항 저장"}
                        </button>
                        <button
                          type="button"
                          onClick={closeEditor}
                          disabled={isBusy}
                          className="inline-flex h-9 items-center justify-center rounded-lg border border-gray-200 px-3 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                        >
                          취소
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div className="min-w-0">
                        <p className="font-medium text-gray-800">
                          {bulletin.title}
                        </p>
                        <p className="mt-1 text-xs text-gray-400">
                          주보 날짜 {bulletin.bulletinDate} · 등록{" "}
                          {formatDate(bulletin.createdAt)} · 이미지{" "}
                          {getBulletinImageCount(bulletin)}장
                        </p>
                        <a
                          href={bulletin.fileUrl}
                          className="mt-2 inline-flex items-center gap-1 text-xs text-[#1B5E20] underline-offset-2 hover:underline"
                        >
                          <Paperclip className="h-3.5 w-3.5" />
                          대표 이미지: {bulletin.fileName}
                        </a>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <select
                          className={`${fieldClass} bg-white`}
                          value={bulletin.status}
                          disabled={isBusy}
                          onChange={event =>
                            updateBulletin.mutate({
                              id: bulletin.id,
                              status: event.target.value as
                                | "published"
                                | "hidden",
                            })
                          }
                        >
                          <option value="published">공개</option>
                          <option value="hidden">숨김</option>
                        </select>
                        <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-500">
                          {bulletin.status === "published" ? (
                            <Eye className="h-3.5 w-3.5" />
                          ) : (
                            <EyeOff className="h-3.5 w-3.5" />
                          )}
                          {statusLabels[bulletin.status] ?? bulletin.status}
                        </span>
                        <button
                          type="button"
                          onClick={() => startEdit(bulletin)}
                          disabled={isBusy}
                          className="inline-flex h-9 items-center justify-center rounded-lg border border-gray-200 px-3 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                        >
                          <Pencil className="mr-1 h-3.5 w-3.5" />
                          수정
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            handleDelete(bulletin.id, bulletin.title)
                          }
                          disabled={isBusy}
                          className="inline-flex h-9 items-center justify-center rounded-lg border border-red-100 px-3 text-xs font-medium text-red-500 hover:bg-red-50 disabled:opacity-50"
                        >
                          <Trash2 className="mr-1 h-3.5 w-3.5" />
                          삭제
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
