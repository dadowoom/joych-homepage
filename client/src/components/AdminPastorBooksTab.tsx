import { useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CalendarDays, Eye, EyeOff, GripVertical, Image as ImageIcon, Loader2, Pencil, Plus, Save, Star, Trash2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { RichTextEditor } from "@/components/ui/rich-text-editor";

type PastorBookItem = {
  id: number;
  title: string;
  summary: string | null;
  contentHtml: string | null;
  publishedAt: string | null;
  externalUrl: string | null;
  isVisible: boolean;
  sortOrder: number;
  coverImageUrl?: string | null;
};

type PastorBookImage = {
  id: number;
  bookId: number;
  imageUrl: string;
  caption: string | null;
  isThumbnail: boolean;
  sortOrder: number;
};

type BookFormState = {
  title: string;
  summary: string;
  contentHtml: string;
  publishedAt: string;
  externalUrl: string;
  isVisible: boolean;
  sortOrder: string;
};

type PastorBookEditorDialogProps = {
  open: boolean;
  book?: PastorBookItem | null;
  defaultSortOrder?: number;
  onClose: () => void;
  onSaved?: () => void;
};

const EMPTY_FORM: BookFormState = {
  title: "",
  summary: "",
  contentHtml: "",
  publishedAt: "",
  externalUrl: "",
  isVisible: true,
  sortOrder: "0",
};

function readFileAsBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("이미지 파일을 읽지 못했습니다."));
    reader.onload = () => {
      const result = String(reader.result ?? "");
      const [, base64] = result.split(",");
      if (!base64) reject(new Error("이미지 파일을 읽지 못했습니다."));
      else resolve(base64);
    };
    reader.readAsDataURL(file);
  });
}

function toForm(book?: PastorBookItem | null, defaultSortOrder = 1): BookFormState {
  if (!book) return { ...EMPTY_FORM, sortOrder: String(defaultSortOrder) };
  return {
    title: book.title ?? "",
    summary: book.summary ?? "",
    contentHtml: book.contentHtml ?? "",
    publishedAt: book.publishedAt ?? "",
    externalUrl: book.externalUrl ?? "",
    isVisible: Boolean(book.isVisible),
    sortOrder: String(book.sortOrder ?? 0),
  };
}

function normalizeDateInput(value: string) {
  return value.trim().replace(/-/g, ".");
}

function getBookPayload(form: BookFormState) {
  return {
    title: form.title.trim(),
    summary: form.summary.trim() || null,
    contentHtml: form.contentHtml.trim() || null,
    publishedAt: normalizeDateInput(form.publishedAt) || null,
    externalUrl: form.externalUrl.trim() || null,
    isVisible: form.isVisible,
    sortOrder: Number.parseInt(form.sortOrder, 10) || 0,
  };
}

export function PastorBookEditorDialog({ open, book, defaultSortOrder = 1, onClose, onSaved }: PastorBookEditorDialogProps) {
  const utils = trpc.useUtils();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [editingId, setEditingId] = useState<number | null>(book?.id ?? null);
  const [form, setForm] = useState<BookFormState>(() => toForm(book, defaultSortOrder));
  const [uploading, setUploading] = useState(false);

  const bookDetailQuery = trpc.cms.pastorBooks.get.useQuery(
    { id: editingId ?? 0 },
    { enabled: open && Boolean(editingId) },
  );
  const imagesQuery = trpc.cms.pastorBooks.images.list.useQuery(
    { bookId: editingId ?? 0 },
    { enabled: open && Boolean(editingId) },
  );

  const createBook = trpc.cms.pastorBooks.create.useMutation();
  const updateBook = trpc.cms.pastorBooks.update.useMutation();
  const uploadImage = trpc.cms.pastorBooks.images.upload.useMutation();
  const deleteImage = trpc.cms.pastorBooks.images.delete.useMutation();
  const setThumbnail = trpc.cms.pastorBooks.images.setThumbnail.useMutation();

  const currentBook = bookDetailQuery.data ?? book ?? null;
  const images = (imagesQuery.data ?? []) as PastorBookImage[];
  const isSaving = createBook.isPending || updateBook.isPending;
  const canManageImages = Boolean(editingId);

  useEffect(() => {
    if (!open) return;
    setEditingId(book?.id ?? null);
    setForm(toForm(book, defaultSortOrder));
  }, [book, defaultSortOrder, open]);

  useEffect(() => {
    if (!open || !book?.id || !bookDetailQuery.data || bookDetailQuery.data.id !== book.id) return;
    setForm(toForm(bookDetailQuery.data, defaultSortOrder));
  }, [book?.id, bookDetailQuery.data, defaultSortOrder, open]);

  async function invalidateAll(id?: number | null) {
    await Promise.all([
      utils.home.pastorBooks.invalidate(),
      utils.cms.pastorBooks.list.invalidate(),
      id ? utils.home.pastorBook.invalidate({ id }) : Promise.resolve(),
      id ? utils.cms.pastorBooks.get.invalidate({ id }) : Promise.resolve(),
      id ? utils.cms.pastorBooks.images.list.invalidate({ bookId: id }) : Promise.resolve(),
    ]);
  }

  async function handleSave() {
    const payload = getBookPayload(form);
    if (!payload.title) {
      toast.error("책 제목을 입력해주세요.");
      return;
    }

    if (editingId) {
      await updateBook.mutateAsync({ id: editingId, ...payload });
      await invalidateAll(editingId);
      toast.success("저서가 수정되었습니다.");
      onSaved?.();
      return;
    }

    const id = await createBook.mutateAsync(payload);
    const createdId = typeof id === "number" ? id : null;
    setEditingId(createdId);
    await invalidateAll(createdId);
    toast.success("저서가 추가되었습니다. 이제 이미지를 업로드할 수 있습니다.");
    onSaved?.();
  }

  async function handleUpload(file?: File | null) {
    if (!file || !editingId) return;
    setUploading(true);
    try {
      const base64 = await readFileAsBase64(file);
      await uploadImage.mutateAsync({
        bookId: editingId,
        base64,
        fileName: file.name,
        mimeType: file.type || "image/jpeg",
        isThumbnail: images.length === 0,
      });
      await invalidateAll(editingId);
      toast.success("이미지가 업로드되었습니다.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "이미지 업로드에 실패했습니다.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleSetThumbnail(imageId: number) {
    if (!editingId) return;
    await setThumbnail.mutateAsync({ bookId: editingId, imageId });
    await invalidateAll(editingId);
    toast.success("대표 이미지가 변경되었습니다.");
  }

  async function handleDeleteImage(imageId: number) {
    if (!editingId || !window.confirm("이 이미지를 삭제할까요?")) return;
    await deleteImage.mutateAsync({ id: imageId });
    await invalidateAll(editingId);
    toast.success("이미지가 삭제되었습니다.");
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/45 px-4 py-8">
      <div className="flex w-full max-w-6xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl" style={{ maxHeight: "calc(100vh - 4rem)" }}>
        <div className="flex items-center justify-between border-b bg-white px-5 py-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              {editingId ? "담임목사 저서 수정" : "담임목사 저서 추가"}
            </h2>
            <p className="mt-1 text-xs text-gray-500">
              각 책마다 별도의 HTML 본문과 대표 이미지를 관리합니다.
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid min-h-0 flex-1 gap-6 overflow-y-auto p-5 lg:grid-cols-[320px_1fr]">
          <aside className="space-y-4">
            <section className="rounded-xl border border-gray-200 p-4">
              <h3 className="mb-3 text-sm font-bold text-gray-900">기본 정보</h3>
              <div className="space-y-3">
                <label className="block text-xs font-semibold text-gray-600">
                  책 제목 *
                  <input
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#1B5E20]"
                    value={form.title}
                    onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                    placeholder="예: 열두 물멧돌"
                  />
                </label>
                <label className="block text-xs font-semibold text-gray-600">
                  출간일
                  <input
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#1B5E20]"
                    value={form.publishedAt}
                    onChange={(event) => setForm((prev) => ({ ...prev, publishedAt: event.target.value }))}
                    placeholder="2026.06.26"
                  />
                </label>
                <label className="block text-xs font-semibold text-gray-600">
                  목록 설명
                  <textarea
                    className="mt-1 min-h-20 w-full resize-y rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#1B5E20]"
                    value={form.summary}
                    onChange={(event) => setForm((prev) => ({ ...prev, summary: event.target.value }))}
                    placeholder="목록이나 상세 상단에 표시할 짧은 설명"
                  />
                  <span className="mt-1 block text-right text-[11px] font-normal text-gray-400">
                    {new TextEncoder().encode(form.summary).length.toLocaleString()} bytes
                  </span>
                </label>
                <label className="block text-xs font-semibold text-gray-600">
                  정렬 순서
                  <input
                    type="number"
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#1B5E20]"
                    value={form.sortOrder}
                    onChange={(event) => setForm((prev) => ({ ...prev, sortOrder: event.target.value }))}
                  />
                </label>
                <label className="block text-xs font-semibold text-gray-600">
                  기존 외부 링크
                  <input
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#1B5E20]"
                    value={form.externalUrl}
                    onChange={(event) => setForm((prev) => ({ ...prev, externalUrl: event.target.value }))}
                    placeholder="필요할 때만 입력"
                  />
                </label>
                <label className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={form.isVisible}
                    onChange={(event) => setForm((prev) => ({ ...prev, isVisible: event.target.checked }))}
                  />
                  홈페이지에 노출
                </label>
              </div>
            </section>

            <section className="rounded-xl border border-gray-200 p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-bold text-gray-900">이미지</h3>
                <button
                  type="button"
                  disabled={!canManageImages || uploading}
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1 rounded-md border border-[#A5D6A7] px-2 py-1 text-xs font-semibold text-[#1B5E20] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                  업로드
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={(event) => handleUpload(event.target.files?.[0])}
                />
              </div>
              {!canManageImages ? (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
                  책을 먼저 저장하면 이미지를 업로드할 수 있습니다.
                </p>
              ) : images.length === 0 ? (
                <div className="rounded-lg border border-dashed border-gray-200 py-8 text-center text-xs text-gray-400">
                  <ImageIcon className="mx-auto mb-2 h-8 w-8 text-gray-300" />
                  등록된 이미지가 없습니다.
                </div>
              ) : (
                <div className="space-y-3">
                  {images.map((image) => (
                    <div key={image.id} className="rounded-lg border border-gray-200 p-2">
                      <img src={image.imageUrl} alt="" className="h-40 w-full rounded-md bg-gray-50 object-contain"  loading="lazy"/>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => handleSetThumbnail(image.id)}
                          disabled={image.isThumbnail || setThumbnail.isPending}
                          className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold ${
                            image.isThumbnail
                              ? "bg-[#EAF6EA] text-[#1B5E20]"
                              : "border border-gray-200 text-gray-600 hover:border-[#A5D6A7] hover:text-[#1B5E20]"
                          }`}
                        >
                          <Star className="h-3.5 w-3.5" />
                          {image.isThumbnail ? "대표 이미지" : "대표로 선택"}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteImage(image.id)}
                          className="rounded-md p-1.5 text-red-500 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </aside>

          <main className="min-w-0 space-y-4">
            <section>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-bold text-gray-900">책 상세 본문</h3>
                {currentBook?.id && (
                  <span className="text-xs text-gray-400">책 ID: {currentBook.id}</span>
                )}
              </div>
              <RichTextEditor value={form.contentHtml} onChange={(value) => setForm((prev) => ({ ...prev, contentHtml: value }))} />
            </section>
          </main>
        </div>

        <div className="flex justify-end gap-2 border-t bg-white px-5 py-4">
          <button type="button" onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50">
            닫기
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || !form.title.trim()}
            className="inline-flex items-center gap-2 rounded-lg bg-[#1B5E20] px-4 py-2 text-sm font-semibold text-white hover:bg-[#2E7D32] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            저장
          </button>
        </div>
      </div>
    </div>
  );
}

function SortablePastorBookRow({
  book,
  isDeleting,
  isOrdering,
  onEdit,
  onDelete,
}: {
  book: PastorBookItem;
  isDeleting: boolean;
  isOrdering: boolean;
  onEdit: (book: PastorBookItem) => void;
  onDelete: (book: PastorBookItem) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: book.id, disabled: isOrdering });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
    opacity: isDragging ? 0.7 : 1,
  };

  return (
    <article
      ref={setNodeRef}
      style={style}
      className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center"
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        disabled={isOrdering}
        title="드래그해서 책 순서 변경"
        aria-label={`${book.title} 순서 변경`}
        className="flex h-10 w-8 shrink-0 cursor-grab items-center justify-center rounded-lg text-gray-300 transition-colors hover:bg-gray-50 hover:text-gray-600 active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-50 touch-none"
      >
        <GripVertical className="h-5 w-5" />
      </button>
      <div className="flex h-28 w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gray-50">
        {book.coverImageUrl ? (
          <img src={book.coverImageUrl} alt="" className="h-full w-full object-contain"  loading="lazy"/>
        ) : (
          <ImageIcon className="h-8 w-8 text-gray-300" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
            book.isVisible ? "bg-[#EAF6EA] text-[#1B5E20]" : "bg-gray-100 text-gray-500"
          }`}>
            {book.isVisible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
            {book.isVisible ? "노출" : "숨김"}
          </span>
          {book.publishedAt && (
            <span className="inline-flex items-center gap-1 text-xs text-gray-400">
              <CalendarDays className="h-3.5 w-3.5" />
              {book.publishedAt}
            </span>
          )}
          <span className="text-xs text-gray-400">정렬 {book.sortOrder}</span>
        </div>
        <h4 className="line-clamp-2 font-bold text-gray-900">{book.title}</h4>
        {book.summary && <p className="mt-1 line-clamp-2 text-sm text-gray-500">{book.summary}</p>}
      </div>
      <div className="flex shrink-0 gap-2">
        <button
          type="button"
          onClick={() => onEdit(book)}
          className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-600 hover:border-[#A5D6A7] hover:text-[#1B5E20]"
        >
          <Pencil className="h-4 w-4" />
          수정
        </button>
        <button
          type="button"
          onClick={() => onDelete(book)}
          disabled={isDeleting}
          className="inline-flex items-center gap-1 rounded-lg border border-red-100 px-3 py-2 text-sm font-semibold text-red-500 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Trash2 className="h-4 w-4" />
          삭제
        </button>
      </div>
    </article>
  );
}

export default function AdminPastorBooksTab() {
  const utils = trpc.useUtils();
  const { data: books = [], isLoading } = trpc.cms.pastorBooks.list.useQuery();
  const deleteBook = trpc.cms.pastorBooks.delete.useMutation();
  const [editorOpen, setEditorOpen] = useState(false);
  const [selectedBook, setSelectedBook] = useState<PastorBookItem | null>(null);
  const [orderedBooks, setOrderedBooks] = useState<PastorBookItem[]>([]);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const reorderBooks = trpc.cms.pastorBooks.reorder.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.cms.pastorBooks.list.invalidate(),
        utils.home.pastorBooks.invalidate(),
      ]);
      toast.success("저서 순서가 저장되었습니다.");
    },
    onError: (error) => {
      setOrderedBooks(books);
      toast.error(error.message || "순서 저장에 실패했습니다.");
    },
  });

  useEffect(() => {
    setOrderedBooks(books);
  }, [books]);

  const displayBooks = orderedBooks.length === books.length ? orderedBooks : books;
  const visibleCount = useMemo(() => displayBooks.filter((book) => book.isVisible).length, [displayBooks]);

  function openCreate() {
    setSelectedBook(null);
    setEditorOpen(true);
  }

  function openEdit(book: PastorBookItem) {
    setSelectedBook(book);
    setEditorOpen(true);
  }

  async function handleDelete(book: PastorBookItem) {
    if (!window.confirm(`"${book.title}" 저서를 삭제할까요?`)) return;
    await deleteBook.mutateAsync({ id: book.id });
    await Promise.all([
      utils.cms.pastorBooks.list.invalidate(),
      utils.home.pastorBooks.invalidate(),
      utils.home.pastorBook.invalidate({ id: book.id }),
    ]);
    toast.success("저서가 삭제되었습니다.");
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id || reorderBooks.isPending) return;

    const activeId = Number(active.id);
    const overId = Number(over.id);
    const oldIndex = displayBooks.findIndex((book) => book.id === activeId);
    const newIndex = displayBooks.findIndex((book) => book.id === overId);
    if (oldIndex < 0 || newIndex < 0) return;

    const nextBooks = arrayMove(displayBooks, oldIndex, newIndex).map((book, index) => ({
      ...book,
      sortOrder: index + 1,
    }));
    setOrderedBooks(nextBooks);
    reorderBooks.mutate({
      items: nextBooks.map((book) => ({
        id: book.id,
        sortOrder: book.sortOrder,
      })),
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-bold text-gray-900">담임목사 저서 관리</h3>
          <p className="mt-1 text-sm text-gray-500">
            책 목록, 대표 이미지, 상세 HTML 본문을 관리합니다.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#1B5E20] px-4 py-2 text-sm font-semibold text-white hover:bg-[#2E7D32]"
        >
          <Plus className="h-4 w-4" />
          저서 추가
        </button>
      </div>

      <div className="rounded-xl border border-[#D7F0D8] bg-[#F7FBF7] px-4 py-3 text-sm text-[#1B5E20]">
        총 {books.length}권 중 {visibleCount}권이 홈페이지에 노출됩니다.
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          불러오는 중...
        </div>
      ) : books.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 py-16 text-center text-sm text-gray-400">
          등록된 저서가 없습니다.
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={displayBooks.map((book) => book.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-3">
              {displayBooks.map((book) => (
                <SortablePastorBookRow
                  key={book.id}
                  book={{ ...book, sortOrder: displayBooks.findIndex((item) => item.id === book.id) + 1 }}
                  isDeleting={deleteBook.isPending}
                  isOrdering={reorderBooks.isPending}
                  onEdit={openEdit}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <PastorBookEditorDialog
        key={selectedBook?.id ?? "new"}
        open={editorOpen}
        book={selectedBook}
        defaultSortOrder={selectedBook ? selectedBook.sortOrder : 1}
        onClose={() => setEditorOpen(false)}
        onSaved={() => {
          utils.cms.pastorBooks.list.invalidate();
          utils.home.pastorBooks.invalidate();
        }}
      />
    </div>
  );
}
