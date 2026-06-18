import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Eye, EyeOff, Images, Paperclip, Pencil, Save, Trash2, Upload, X } from "lucide-react";

const fieldClass =
  "border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B5E20]/20 focus:border-[#1B5E20]";

const statusLabels: Record<string, string> = {
  published: "공개",
  hidden: "숨김",
  archived: "삭제됨",
};

const MAX_BULLETIN_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_BULLETIN_IMAGE_COUNT = 12;
const ALLOWED_BULLETIN_IMAGE_RE = /\.(jpg|jpeg|png)$/i;

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
    reader.onerror = () => reject(reader.error ?? new Error("파일을 읽지 못했습니다."));
    reader.readAsDataURL(file);
  });
}

function sortBulletinImages(files: File[]) {
  return [...files].sort((a, b) => a.name.localeCompare(b.name, "ko-KR", { numeric: true, sensitivity: "base" }));
}

function getBulletinImageCount(bulletin: { images?: unknown[] }) {
  return bulletin.images?.length ?? 1;
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
  const { data: bulletins = [], isLoading } = trpc.cms.bulletins.list.useQuery();
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [form, setForm] = useState<BulletinForm>(createEmptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<BulletinForm>(createEmptyForm);

  const resetCreateForm = () => {
    setForm(createEmptyForm());
    setSelectedFiles([]);
    setFileInputKey((key) => key + 1);
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
    onError: (error) => toast.error(error.message),
  });

  const updateBulletin = trpc.cms.bulletins.update.useMutation({
    onSuccess: async () => {
      toast.success("주보가 수정되었습니다.");
      setEditingId(null);
      await refreshBulletins();
    },
    onError: (error) => toast.error(error.message),
  });

  const archiveBulletin = trpc.cms.bulletins.archive.useMutation({
    onSuccess: async () => {
      toast.success("주보가 삭제 처리되었습니다.");
      setEditingId(null);
      await refreshBulletins();
    },
    onError: (error) => toast.error(error.message),
  });

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (selectedFiles.length === 0) {
      toast.error("등록할 주보 이미지를 선택해주세요.");
      return;
    }
    if (selectedFiles.length > MAX_BULLETIN_IMAGE_COUNT) {
      toast.error(`주보 이미지는 최대 ${MAX_BULLETIN_IMAGE_COUNT}장까지 등록할 수 있습니다.`);
      return;
    }
    if (selectedFiles.some((file) => !ALLOWED_BULLETIN_IMAGE_RE.test(file.name))) {
      toast.error("주보 이미지는 JPG, PNG 파일만 등록할 수 있습니다.");
      return;
    }
    if (selectedFiles.some((file) => file.size > MAX_BULLETIN_IMAGE_BYTES)) {
      toast.error("주보 이미지는 한 장당 최대 8MB까지 업로드할 수 있습니다.");
      return;
    }

    createBulletin.mutate({
      title: form.title,
      bulletinDate: form.bulletinDate,
      status: form.status,
      files: await Promise.all(
        selectedFiles.map(async (file) => ({
          fileName: file.name,
          mimeType: file.type || "application/octet-stream",
          base64: await fileToBase64(file),
        }))
      ),
    });
  }

  function startEdit(bulletin: (typeof bulletins)[number]) {
    setEditingId(bulletin.id);
    setEditForm({
      title: bulletin.title,
      bulletinDate: bulletin.bulletinDate,
      status: bulletin.status === "hidden" ? "hidden" : "published",
    });
  }

  function handleEditSave() {
    if (!editingId) return;
    updateBulletin.mutate({
      id: editingId,
      title: editForm.title,
      bulletinDate: editForm.bulletinDate,
      status: editForm.status,
    });
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
          주보 이미지를 여러 장 등록하면 공개 주보 보기 화면에 순서대로 표시됩니다.
        </p>
      </div>

      <section className="border border-gray-200 rounded-xl p-4">
        <h4 className="font-bold text-gray-800 mb-4">새 주보 등록</h4>
        <form onSubmit={handleSubmit} className="grid gap-4 lg:grid-cols-[1fr_160px_140px_auto]">
          <div>
            <label className="block mb-1.5 text-xs font-medium text-gray-500">제목</label>
            <input
              className={`${fieldClass} w-full`}
              required
              value={form.title}
              onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
              placeholder="예: 2026년 6월 7일 주보"
            />
          </div>
          <div>
            <label className="block mb-1.5 text-xs font-medium text-gray-500">주보 날짜</label>
            <input
              type="date"
              className={`${fieldClass} w-full`}
              required
              value={form.bulletinDate}
              onChange={(event) => setForm((prev) => ({ ...prev, bulletinDate: event.target.value }))}
            />
          </div>
          <div>
            <label className="block mb-1.5 text-xs font-medium text-gray-500">공개 상태</label>
            <select
              className={`${fieldClass} w-full bg-white`}
              value={form.status}
              onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value as "published" | "hidden" }))}
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
                onChange={(event) => {
                  const files = sortBulletinImages(Array.from(event.target.files ?? []));
                  if (files.length > MAX_BULLETIN_IMAGE_COUNT) {
                    toast.error(`주보 이미지는 최대 ${MAX_BULLETIN_IMAGE_COUNT}장까지 등록할 수 있습니다.`);
                    event.currentTarget.value = "";
                    return;
                  }
                  if (files.some((file) => !ALLOWED_BULLETIN_IMAGE_RE.test(file.name))) {
                    toast.error("주보 이미지는 JPG, PNG 파일만 등록할 수 있습니다.");
                    event.currentTarget.value = "";
                    return;
                  }
                  if (files.some((file) => file.size > MAX_BULLETIN_IMAGE_BYTES)) {
                    toast.error("주보 이미지는 한 장당 최대 8MB까지 업로드할 수 있습니다.");
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
                      setFileInputKey((key) => key + 1);
                    }}
                    className="inline-flex items-center gap-1 text-gray-400 hover:text-red-500"
                  >
                    <X className="h-3.5 w-3.5" />
                    지우기
                  </button>
                </div>
                <ol className="grid gap-1 text-xs text-gray-500 sm:grid-cols-2">
                  {selectedFiles.map((file, index) => (
                    <li key={`${file.name}-${file.lastModified}`} className="truncate">
                      {index + 1}. {file.name} · {formatFileSize(file.size)}
                    </li>
                  ))}
                </ol>
              </div>
            ) : (
              <p className="text-xs text-gray-400">JPG, PNG / 최대 12장 / 한 장당 8MB</p>
            )}
          </div>
        </form>
      </section>

      <section className="border border-gray-200 rounded-xl p-4">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <h4 className="font-bold text-gray-800">등록된 주보</h4>
            <p className="text-xs text-gray-400 mt-0.5">제목, 날짜, 공개 상태를 수정하거나 삭제 처리할 수 있습니다.</p>
          </div>
          <span className="text-xs bg-[#E8F5E9] text-[#1B5E20] px-2.5 py-1 rounded-full">
            {bulletins.length}건
          </span>
        </div>

        {isLoading ? (
          <p className="text-gray-500 py-8 text-center">불러오는 중...</p>
        ) : bulletins.length === 0 ? (
          <p className="text-sm text-gray-400 py-4">아직 등록된 주보가 없습니다.</p>
        ) : (
          <div className="space-y-3">
            {bulletins.map((bulletin) => {
              const isEditing = editingId === bulletin.id;
              const isBusy = updateBulletin.isPending || archiveBulletin.isPending;

              return (
                <div key={bulletin.id} className="border border-gray-100 rounded-lg p-4">
                  {isEditing ? (
                    <div className="space-y-3">
                      <div className="grid gap-3 lg:grid-cols-[1fr_160px_140px]">
                        <div>
                          <label className="block mb-1.5 text-xs font-medium text-gray-500">제목</label>
                          <input
                            className={`${fieldClass} w-full`}
                            value={editForm.title}
                            onChange={(event) => setEditForm((prev) => ({ ...prev, title: event.target.value }))}
                          />
                        </div>
                        <div>
                          <label className="block mb-1.5 text-xs font-medium text-gray-500">주보 날짜</label>
                          <input
                            type="date"
                            className={`${fieldClass} w-full`}
                            value={editForm.bulletinDate}
                            onChange={(event) => setEditForm((prev) => ({ ...prev, bulletinDate: event.target.value }))}
                          />
                        </div>
                        <div>
                          <label className="block mb-1.5 text-xs font-medium text-gray-500">공개 상태</label>
                          <select
                            className={`${fieldClass} w-full bg-white`}
                            value={editForm.status}
                            onChange={(event) => setEditForm((prev) => ({ ...prev, status: event.target.value as "published" | "hidden" }))}
                          >
                            <option value="published">공개</option>
                            <option value="hidden">숨김</option>
                          </select>
                        </div>
                      </div>
                      <p className="text-xs text-gray-400">
                        이미지를 바꾸려면 기존 주보를 삭제 처리한 뒤 새 주보로 다시 등록해주세요.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={handleEditSave}
                          disabled={isBusy || !editForm.title.trim()}
                          className="inline-flex h-9 items-center justify-center rounded-lg bg-[#1B5E20] px-3 text-xs font-medium text-white hover:bg-[#2E7D32] disabled:opacity-50"
                        >
                          <Save className="mr-1 h-3.5 w-3.5" />
                          저장
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
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
                        <p className="font-medium text-gray-800">{bulletin.title}</p>
                        <p className="mt-1 text-xs text-gray-400">
                          주보 날짜 {bulletin.bulletinDate} · 등록 {formatDate(bulletin.createdAt)} · 이미지 {getBulletinImageCount(bulletin)}장
                        </p>
                        <a
                          href={bulletin.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
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
                          onChange={(event) =>
                            updateBulletin.mutate({
                              id: bulletin.id,
                              status: event.target.value as "published" | "hidden",
                            })
                          }
                        >
                          <option value="published">공개</option>
                          <option value="hidden">숨김</option>
                        </select>
                        <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-500">
                          {bulletin.status === "published" ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
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
                          onClick={() => handleDelete(bulletin.id, bulletin.title)}
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
