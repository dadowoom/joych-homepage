/**
 * 관리자 팝업/공지 배너 관리 탭
 * - 제목, 내용, 이미지, 링크, 노출 기간, 우선순위를 관리합니다.
 * - 실제 공개 노출은 NoticePopupLayer에서 home.popups API를 통해 처리합니다.
 */

import { useMemo, useRef, useState } from "react";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../server/routers";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  CalendarClock,
  Eye,
  EyeOff,
  ImageIcon,
  Loader2,
  Pencil,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";

type PopupRow = inferRouterOutputs<AppRouter>["cms"]["popups"]["list"][number];
type PopupPlacement = "modal" | "top_banner" | "bottom_sheet";
type PopupAudience = "all" | "guest" | "member";

type PopupForm = {
  title: string;
  content: string;
  imageUrl: string;
  linkLabel: string;
  linkHref: string;
  placement: PopupPlacement;
  audience: PopupAudience;
  isActive: boolean;
  isDismissible: boolean;
  dismissPeriodHours: number;
  priority: number;
  startAt: string;
  endAt: string;
};

const EMPTY_FORM: PopupForm = {
  title: "",
  content: "",
  imageUrl: "",
  linkLabel: "",
  linkHref: "",
  placement: "modal",
  audience: "all",
  isActive: true,
  isDismissible: true,
  dismissPeriodHours: 24,
  priority: 0,
  startAt: "",
  endAt: "",
};

const placementOptions: { value: PopupPlacement; label: string }[] = [
  { value: "modal", label: "중앙 팝업" },
  { value: "top_banner", label: "상단 배너" },
  { value: "bottom_sheet", label: "하단 팝업" },
];

const audienceOptions: { value: PopupAudience; label: string }[] = [
  { value: "all", label: "전체 방문자" },
];

const fieldClass =
  "border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B5E20]/20 focus:border-[#1B5E20]";
const labelClass = "block text-xs font-medium text-gray-500 mb-1";

function toDateTimeLocal(value: Date | string | null | undefined) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60 * 1000);
  return local.toISOString().slice(0, 16);
}

function toDateOrNull(value: string) {
  return value ? new Date(value) : null;
}

function formatDateTime(value: Date | string | null | undefined) {
  if (!value) return "상시";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "상시";
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function readFileAsBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("파일을 읽지 못했습니다."));
    reader.readAsDataURL(file);
  });
}

function normalizePayload(form: PopupForm) {
  return {
    title: form.title.trim(),
    content: form.content.trim() || undefined,
    imageUrl: form.imageUrl.trim() || undefined,
    linkLabel: form.linkLabel.trim() || undefined,
    linkHref: form.linkHref.trim() || undefined,
    placement: form.placement,
    audience: form.audience,
    isActive: form.isActive,
    isDismissible: form.isDismissible,
    dismissPeriodHours: Number.isFinite(form.dismissPeriodHours)
      ? form.dismissPeriodHours
      : 24,
    priority: Number.isFinite(form.priority) ? form.priority : 0,
    startAt: toDateOrNull(form.startAt),
    endAt: toDateOrNull(form.endAt),
  };
}

function getPlacementLabel(value: string) {
  return placementOptions.find((option) => option.value === value)?.label ?? value;
}

function getAudienceLabel(value: string) {
  return audienceOptions.find((option) => option.value === value)?.label ?? value;
}

export default function AdminPopupsTab() {
  const utils = trpc.useUtils();
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<PopupForm>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "hidden">("all");

  const { data: popups = [], isLoading } = trpc.cms.popups.list.useQuery();

  const uploadImage = trpc.cms.upload.image.useMutation({
    onSuccess: (result) => {
      setForm((prev) => ({ ...prev, imageUrl: result.url }));
      toast.success("이미지가 업로드됐습니다.");
    },
    onError: (error) => toast.error(error.message),
  });

  const createPopup = trpc.cms.popups.create.useMutation({
    onSuccess: () => {
      toast.success("팝업이 등록됐습니다.");
      resetForm();
      utils.cms.popups.list.invalidate();
      utils.home.popups.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const updatePopup = trpc.cms.popups.update.useMutation({
    onSuccess: () => {
      toast.success("팝업이 저장됐습니다.");
      resetForm();
      utils.cms.popups.list.invalidate();
      utils.home.popups.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const deletePopup = trpc.cms.popups.delete.useMutation({
    onSuccess: () => {
      toast.success("팝업이 삭제됐습니다.");
      utils.cms.popups.list.invalidate();
      utils.home.popups.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const filteredPopups = useMemo(() => {
    if (statusFilter === "active") {
      return popups.filter((popup) => popup.isActive);
    }
    if (statusFilter === "hidden") {
      return popups.filter((popup) => !popup.isActive);
    }
    return popups;
  }, [popups, statusFilter]);

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
  };

  const startEdit = (popup: PopupRow) => {
    setEditingId(popup.id);
    setForm({
      title: popup.title,
      content: popup.content ?? "",
      imageUrl: popup.imageUrl ?? "",
      linkLabel: popup.linkLabel ?? "",
      linkHref: popup.linkHref ?? "",
      placement: popup.placement,
      audience: popup.audience,
      isActive: popup.isActive,
      isDismissible: popup.isDismissible,
      dismissPeriodHours: popup.dismissPeriodHours,
      priority: popup.priority,
      startAt: toDateTimeLocal(popup.startAt),
      endAt: toDateTimeLocal(popup.endAt),
    });
  };

  const submit = () => {
    const payload = normalizePayload(form);
    if (!payload.title) {
      toast.error("팝업 제목을 입력해 주세요.");
      return;
    }
    if (payload.linkLabel && !payload.linkHref) {
      toast.error("버튼 문구를 입력했다면 버튼 링크도 입력해 주세요.");
      return;
    }
    if (payload.startAt && payload.endAt && payload.startAt > payload.endAt) {
      toast.error("노출 종료 시각은 시작 시각보다 늦어야 합니다.");
      return;
    }

    if (editingId) {
      updatePopup.mutate({ id: editingId, ...payload });
    } else {
      createPopup.mutate(payload);
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error("이미지는 10MB 이하로 선택해 주세요.");
      event.target.value = "";
      return;
    }

    try {
      const dataUrl = await readFileAsBase64(file);
      const base64 = dataUrl.split(",")[1];
      uploadImage.mutate({
        base64,
        fileName: file.name,
        mimeType: file.type || "image/jpeg",
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "이미지를 읽지 못했습니다.");
    } finally {
      event.target.value = "";
    }
  };

  const isSaving = createPopup.isPending || updatePopup.isPending;

  return (
    <div>
      <div className="flex flex-col gap-2 mb-5 md:flex-row md:items-end md:justify-between">
        <div>
          <h3 className="text-lg font-bold text-gray-800">팝업 관리</h3>
          <p className="text-sm text-gray-500 mt-1">
            행사, 긴급공지, 신청 안내를 홈페이지에 노출합니다.
          </p>
        </div>
        <div className="flex gap-2">
          {[
            { value: "all", label: "전체" },
            { value: "active", label: "노출" },
            { value: "hidden", label: "숨김" },
          ].map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setStatusFilter(option.value as typeof statusFilter)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                statusFilter === option.value
                  ? "bg-[#1B5E20] text-white"
                  : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[380px,1fr] gap-6">
        <div className="border border-gray-200 rounded-xl p-5 bg-gray-50/60">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-bold text-gray-800">
              {editingId ? "팝업 수정" : "새 팝업 등록"}
            </h4>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
              >
                <X className="w-3 h-3" />
                취소
              </button>
            )}
          </div>

          <div className="space-y-4">
            <div>
              <label className={labelClass}>제목</label>
              <input
                value={form.title}
                onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                className={`${fieldClass} w-full`}
                placeholder="예: 이번 주 특별집회 안내"
              />
            </div>

            <div>
              <label className={labelClass}>내용</label>
              <textarea
                value={form.content}
                onChange={(event) => setForm((prev) => ({ ...prev, content: event.target.value }))}
                className={`${fieldClass} w-full min-h-24 resize-y`}
                placeholder="홈페이지 방문자에게 보여줄 안내 문구"
              />
            </div>

            <div>
              <label className={labelClass}>이미지</label>
              {form.imageUrl && (
                <div className="relative mb-2 overflow-hidden rounded-lg border border-gray-200 bg-white">
                  <img
                    src={form.imageUrl}
                    alt="팝업 이미지 미리보기"
                    className="h-32 w-full object-cover"
                    onError={(event) => {
                      (event.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, imageUrl: "" }))}
                    className="absolute right-2 top-2 rounded-full bg-black/60 text-white w-6 h-6 flex items-center justify-center text-xs"
                  >
                    ×
                  </button>
                </div>
              )}
              <div className="flex gap-2">
                <input
                  value={form.imageUrl}
                  onChange={(event) => setForm((prev) => ({ ...prev, imageUrl: event.target.value }))}
                  className={`${fieldClass} min-w-0 flex-1`}
                  placeholder="이미지 URL 또는 업로드"
                />
                <button
                  type="button"
                  onClick={() => imageInputRef.current?.click()}
                  disabled={uploadImage.isPending}
                  className="px-3 py-2 text-sm rounded-lg border border-[#1B5E20] text-[#1B5E20] hover:bg-green-50 disabled:opacity-50"
                >
                  {uploadImage.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ImageIcon className="w-4 h-4" />
                  )}
                </button>
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>버튼 문구</label>
                <input
                  value={form.linkLabel}
                  onChange={(event) => setForm((prev) => ({ ...prev, linkLabel: event.target.value }))}
                  className={`${fieldClass} w-full`}
                  placeholder="자세히 보기"
                />
              </div>
              <div>
                <label className={labelClass}>버튼 링크</label>
                <input
                  value={form.linkHref}
                  onChange={(event) => setForm((prev) => ({ ...prev, linkHref: event.target.value }))}
                  className={`${fieldClass} w-full`}
                  placeholder="/worship/schedule"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>노출 방식</label>
                <select
                  value={form.placement}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, placement: event.target.value as PopupPlacement }))
                  }
                  className={`${fieldClass} w-full`}
                >
                  {placementOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>대상</label>
                <select
                  value={form.audience}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, audience: event.target.value as PopupAudience }))
                  }
                  className={`${fieldClass} w-full`}
                >
                  {audienceOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>노출 시작</label>
                <input
                  type="datetime-local"
                  value={form.startAt}
                  onChange={(event) => setForm((prev) => ({ ...prev, startAt: event.target.value }))}
                  className={`${fieldClass} w-full`}
                />
              </div>
              <div>
                <label className={labelClass}>노출 종료</label>
                <input
                  type="datetime-local"
                  value={form.endAt}
                  onChange={(event) => setForm((prev) => ({ ...prev, endAt: event.target.value }))}
                  className={`${fieldClass} w-full`}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>우선순위</label>
                <input
                  type="number"
                  min={0}
                  max={9999}
                  value={form.priority}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, priority: Number(event.target.value) }))
                  }
                  className={`${fieldClass} w-full`}
                />
              </div>
              <div>
                <label className={labelClass}>다시 보지 않기 시간</label>
                <input
                  type="number"
                  min={1}
                  max={720}
                  value={form.dismissPeriodHours}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      dismissPeriodHours: Number(event.target.value),
                    }))
                  }
                  className={`${fieldClass} w-full`}
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-3 text-sm text-gray-600">
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(event) => setForm((prev) => ({ ...prev, isActive: event.target.checked }))}
                  className="accent-[#1B5E20]"
                />
                노출
              </label>
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.isDismissible}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, isDismissible: event.target.checked }))
                  }
                  className="accent-[#1B5E20]"
                />
                오늘 하루 보지 않기
              </label>
            </div>

            <button
              type="button"
              onClick={submit}
              disabled={isSaving}
              className="w-full bg-[#1B5E20] text-white rounded-lg py-2.5 text-sm font-medium hover:bg-[#2E7D32] disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : editingId ? (
                <Save className="w-4 h-4" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              {editingId ? "저장" : "등록"}
            </button>
          </div>
        </div>

        <div>
          {isLoading ? (
            <p className="text-gray-500 py-10 text-center">불러오는 중...</p>
          ) : filteredPopups.length === 0 ? (
            <div className="border border-dashed border-gray-200 rounded-xl py-12 text-center text-gray-400">
              등록된 팝업이 없습니다.
            </div>
          ) : (
            <div className="space-y-3">
              {filteredPopups.map((popup) => (
                <div
                  key={popup.id}
                  className="border border-gray-200 rounded-xl bg-white p-4 flex flex-col gap-4 md:flex-row md:items-center"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <h4 className="font-bold text-gray-900 truncate">{popup.title}</h4>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          popup.isActive
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {popup.isActive ? "노출" : "숨김"}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
                        {getPlacementLabel(popup.placement)}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">
                        {getAudienceLabel(popup.audience)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 line-clamp-2">
                      {popup.content || "내용 없음"}
                    </p>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 text-xs text-gray-400">
                      <span className="inline-flex items-center gap-1">
                        <CalendarClock className="w-3 h-3" />
                        {formatDateTime(popup.startAt)} ~ {formatDateTime(popup.endAt)}
                      </span>
                      <span>우선순위 {popup.priority}</span>
                      {popup.isDismissible && (
                        <span>{popup.dismissPeriodHours}시간 숨김 가능</span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 md:shrink-0">
                    <button
                      type="button"
                      onClick={() =>
                        updatePopup.mutate({
                          id: popup.id,
                          isActive: !popup.isActive,
                        })
                      }
                      className="px-3 py-2 text-xs rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 inline-flex items-center gap-1"
                    >
                      {popup.isActive ? (
                        <EyeOff className="w-3 h-3" />
                      ) : (
                        <Eye className="w-3 h-3" />
                      )}
                      {popup.isActive ? "숨김" : "노출"}
                    </button>
                    <button
                      type="button"
                      onClick={() => startEdit(popup)}
                      className="px-3 py-2 text-xs rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 inline-flex items-center gap-1"
                    >
                      <Pencil className="w-3 h-3" />
                      수정
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`"${popup.title}" 팝업을 삭제할까요?`)) {
                          deletePopup.mutate({ id: popup.id });
                        }
                      }}
                      className="px-3 py-2 text-xs rounded-lg border border-red-200 text-red-600 hover:bg-red-50 inline-flex items-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" />
                      삭제
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
