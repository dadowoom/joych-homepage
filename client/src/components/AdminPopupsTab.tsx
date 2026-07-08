/**
 * 관리자 팝업/공지 배너 관리 탭
 * - 현재 운영 기준은 "오른쪽 팝업" 한 가지로 통일합니다.
 * - 실제 공개 노출은 NoticePopupLayer에서 슬라이드형 오른쪽 팝업으로 처리합니다.
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
type PopupAudience = "all" | "member";

type PopupForm = {
  title: string;
  imageUrl: string;
  linkLabel: string;
  linkHref: string;
  placement: PopupPlacement;
  audience: PopupAudience;
  isActive: boolean;
  isDismissible: boolean;
  dismissPeriodHours: number;
  priority: number;
  sizePercent: number;
  startAt: string;
  endAt: string;
};

type OptimizedImageResult = {
  dataUrl: string;
  fileName: string;
  mimeType: string;
  optimizedBytes: number;
  originalBytes: number;
};

const EMPTY_FORM: PopupForm = {
  title: "",
  imageUrl: "",
  linkLabel: "",
  linkHref: "",
  placement: "modal",
  audience: "all",
  isActive: true,
  isDismissible: true,
  dismissPeriodHours: 24,
  priority: 0,
  sizePercent: 100,
  startAt: "",
  endAt: "",
};

const BUTTON_LABEL_BYTE_LIMIT = 64;
const POPUP_SIZE_PRESETS = [80, 90, 100, 110, 120] as const;

const audienceOptions: { value: PopupAudience; label: string }[] = [
  { value: "all", label: "전체공개" },
  { value: "member", label: "성도" },
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

function getByteLength(value: string) {
  return new TextEncoder().encode(value).length;
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("파일을 읽지 못했습니다."));
    reader.readAsDataURL(file);
  });
}

function loadImageElement(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("이미지를 불러오지 못했습니다."));
    };
    image.src = objectUrl;
  });
}

async function optimizePopupImage(file: File): Promise<OptimizedImageResult> {
  if (file.type === "image/gif") {
    const dataUrl = await readFileAsDataUrl(file);
    return {
      dataUrl,
      fileName: file.name,
      mimeType: file.type,
      originalBytes: file.size,
      optimizedBytes: file.size,
    };
  }

  const image = await loadImageElement(file);
  const maxWidth = 1600;
  const maxHeight = 1600;
  const scale = Math.min(1, maxWidth / image.width, maxHeight / image.height);
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) throw new Error("이미지 최적화를 위한 캔버스를 만들지 못했습니다.");

  context.drawImage(image, 0, 0, width, height);

  const optimizedWebp = canvas.toDataURL("image/webp", 0.84);
  const canUseWebp = optimizedWebp.startsWith("data:image/webp");
  const mimeType = canUseWebp ? "image/webp" : "image/jpeg";
  const dataUrl = canUseWebp
    ? optimizedWebp
    : canvas.toDataURL("image/jpeg", 0.86);
  const base64 = dataUrl.split(",")[1] ?? "";
  const optimizedBytes = Math.ceil((base64.length * 3) / 4);
  const fileName = file.name.replace(/\.[^.]+$/, "") + (canUseWebp ? ".webp" : ".jpg");

  return {
    dataUrl,
    fileName,
    mimeType,
    originalBytes: file.size,
    optimizedBytes,
  };
}

function formatFileSize(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${bytes}B`;
}

function normalizePayload(form: PopupForm) {
  const sizePercent = Number.isFinite(form.sizePercent)
    ? Math.min(120, Math.max(70, Math.round(form.sizePercent)))
    : 100;

  return {
    title: form.title.trim(),
    content: "",
    imageUrl: form.imageUrl.trim() || null,
    linkLabel: form.linkLabel.trim() || null,
    linkHref: form.linkHref.trim() || null,
    placement: "modal" as const,
    audience: form.audience,
    isActive: form.isActive,
    isDismissible: form.isDismissible,
    dismissPeriodHours: Number.isFinite(form.dismissPeriodHours)
      ? form.dismissPeriodHours
      : 24,
    priority: Number.isFinite(form.priority) ? form.priority : 0,
    sizePercent,
    startAt: toDateOrNull(form.startAt),
    endAt: toDateOrNull(form.endAt),
  };
}

function getPlacementLabel(_value: PopupPlacement) {
  return "오른쪽 팝업";
}

function getAudienceLabel(value: string) {
  if (value === "guest") return "전체공개";
  return audienceOptions.find((option) => option.value === value)?.label ?? value;
}

export default function AdminPopupsTab() {
  const utils = trpc.useUtils();
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<PopupForm>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "hidden">("all");
  const [uploadSummary, setUploadSummary] = useState<{ originalBytes: number; optimizedBytes: number } | null>(null);

  const { data: popups = [], isLoading } = trpc.cms.popups.list.useQuery();
  const linkLabelBytes = getByteLength(form.linkLabel.trim());

  const uploadImage = trpc.cms.upload.image.useMutation({
    onSuccess: (result) => {
      setForm((prev) => ({ ...prev, imageUrl: result.url }));
      toast.success("팝업 이미지가 업로드됐습니다.");
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
    setUploadSummary(null);
  };

  const startEdit = (popup: PopupRow) => {
    setEditingId(popup.id);
    setForm({
      title: popup.title,
      imageUrl: popup.imageUrl ?? "",
      linkLabel: popup.linkLabel ?? "",
      linkHref: popup.linkHref ?? "",
      placement: popup.placement,
      audience: popup.audience === "member" ? "member" : "all",
      isActive: popup.isActive,
      isDismissible: popup.isDismissible,
      dismissPeriodHours: popup.dismissPeriodHours,
      priority: popup.priority,
      sizePercent: popup.sizePercent ?? 100,
      startAt: toDateTimeLocal(popup.startAt),
      endAt: toDateTimeLocal(popup.endAt),
    });
    setUploadSummary(null);
  };

  const submit = () => {
    const payload = normalizePayload(form);
    if (!payload.title) {
      toast.error("팝업 제목을 입력해 주세요.");
      return;
    }
    if (linkLabelBytes > BUTTON_LABEL_BYTE_LIMIT) {
      toast.error(`버튼 문구는 ${BUTTON_LABEL_BYTE_LIMIT}byte 이하로 입력해 주세요.`);
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

  const applySizeToAllPopups = () => {
    const sizePercent = normalizePayload(form).sizePercent;
    if (popups.length === 0) {
      toast.info("적용할 팝업이 없습니다.");
      return;
    }
    if (!confirm(`등록된 팝업 ${popups.length}개에 크기 ${sizePercent}%를 일괄 적용할까요?`)) {
      return;
    }
    popups.forEach((popup) => {
      updatePopup.mutate({ id: popup.id, sizePercent });
    });
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const maxSize = 25 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error("이미지는 25MB 이하로 선택해 주세요.");
      event.target.value = "";
      return;
    }

    try {
      const optimized = await optimizePopupImage(file);
      setUploadSummary({
        originalBytes: optimized.originalBytes,
        optimizedBytes: optimized.optimizedBytes,
      });

      const base64 = optimized.dataUrl.split(",")[1];
      uploadImage.mutate({
        base64,
        fileName: optimized.fileName,
        mimeType: optimized.mimeType,
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
      <div className="mb-5 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h3 className="text-lg font-bold text-gray-800">팝업 관리</h3>
          <p className="mt-1 text-sm text-gray-500">
            홈페이지 메인 우측 팝업을 등록합니다. 같은 노출 묶음은 공개 화면에서 자동 슬라이드됩니다.
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
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                statusFilter === option.value
                  ? "bg-[#1B5E20] text-white"
                  : "border border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[420px,1fr]">
        <div className="rounded-xl border border-gray-200 bg-gray-50/60 p-5">
          <div className="mb-4 flex items-center justify-between">
            <h4 className="font-bold text-gray-800">
              {editingId ? "팝업 수정" : "새 팝업 등록"}
            </h4>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
              >
                <X className="h-3 w-3" />
                취소
              </button>
            )}
          </div>

          <div className="space-y-4">
            <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-3 text-xs leading-5 text-emerald-800">
              노출 방식은 이제 <span className="font-semibold">오른쪽 팝업</span> 하나로 통일합니다.
              여러 개를 등록하면 공개 화면에서 자동으로 넘어가고, 버튼을 누르면 링크로 이동하면서 팝업은 닫힙니다.
            </div>

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
              <label className={labelClass}>이미지</label>
              {form.imageUrl && (
                <div className="relative mb-2 flex min-h-[260px] items-center justify-center overflow-hidden rounded-xl border border-gray-200 bg-gray-50 md:min-h-[320px]">
                  <img
                    src={form.imageUrl}
                    alt="팝업 이미지 미리보기"
                    className="max-h-[320px] w-full object-contain"
                    onError={(event) => {
                      (event.target as HTMLImageElement).style.display = "none";
                    }}
                    loading="lazy"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setForm((prev) => ({ ...prev, imageUrl: "" }));
                      setUploadSummary(null);
                    }}
                    className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white"
                  >
                    <X className="h-4 w-4" />
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
                  className="rounded-lg border border-[#1B5E20] px-3 py-2 text-sm text-[#1B5E20] hover:bg-green-50 disabled:opacity-50"
                >
                  {uploadImage.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ImageIcon className="h-4 w-4" />
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
              <p className="mt-1 text-xs text-gray-400">
                가로형 이미지를 권장합니다. 업로드 시 큰 이미지는 자동으로 최적화됩니다.
              </p>
              {uploadSummary && (
                <p className="mt-1 text-xs text-emerald-700">
                  최적화: {formatFileSize(uploadSummary.originalBytes)} → {formatFileSize(uploadSummary.optimizedBytes)}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className={labelClass}>버튼 문구</label>
                <input
                  value={form.linkLabel}
                  onChange={(event) => setForm((prev) => ({ ...prev, linkLabel: event.target.value }))}
                  className={`${fieldClass} w-full`}
                  placeholder="자세히 보기"
                />
                <p className={`mt-1 text-[11px] ${linkLabelBytes > BUTTON_LABEL_BYTE_LIMIT ? "text-red-500" : "text-gray-400"}`}>
                  {linkLabelBytes} / {BUTTON_LABEL_BYTE_LIMIT} byte
                </p>
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

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className={labelClass}>노출 방식</label>
                <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700">
                  오른쪽 팝업
                </div>
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

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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

            <div className="rounded-xl border border-gray-200 bg-white p-3">
              <div className="mb-2 flex items-center justify-between gap-3">
                <label className="text-xs font-medium text-gray-500">팝업 크기</label>
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-[#1B5E20]">
                  현재 {normalizePayload(form).sizePercent}%
                </span>
              </div>
              <input
                type="range"
                min={70}
                max={120}
                step={5}
                value={form.sizePercent}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, sizePercent: Number(event.target.value) }))
                }
                className="w-full accent-[#1B5E20]"
              />
              <div className="mt-2 grid grid-cols-5 gap-1">
                {POPUP_SIZE_PRESETS.map((size) => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, sizePercent: size }))}
                    className={`rounded-lg border px-2 py-1 text-xs ${
                      normalizePayload(form).sizePercent === size
                        ? "border-[#1B5E20] bg-[#1B5E20] text-white"
                        : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    {size}%
                  </button>
                ))}
              </div>
              <div className="mt-2 flex gap-2">
                <input
                  type="number"
                  min={70}
                  max={120}
                  value={form.sizePercent}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, sizePercent: Number(event.target.value) }))
                  }
                  className={`${fieldClass} min-w-0 flex-1`}
                />
                <button
                  type="button"
                  onClick={applySizeToAllPopups}
                  disabled={updatePopup.isPending || popups.length === 0}
                  className="rounded-lg border border-[#1B5E20] px-3 py-2 text-xs font-medium text-[#1B5E20] hover:bg-green-50 disabled:opacity-50"
                >
                  전체 적용
                </button>
              </div>
              <p className="mt-2 text-[11px] leading-4 text-gray-400">
                100을 기준으로 비율을 유지한 채 팝업 전체 크기만 조절합니다.
              </p>
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
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#1B5E20] py-2.5 text-sm font-medium text-white hover:bg-[#2E7D32] disabled:opacity-50"
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : editingId ? (
                <Save className="h-4 w-4" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              {editingId ? "저장" : "등록"}
            </button>
          </div>
        </div>

        <div>
          {isLoading ? (
            <p className="py-10 text-center text-gray-500">불러오는 중...</p>
          ) : filteredPopups.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-200 py-12 text-center text-gray-400">
              등록된 팝업이 없습니다.
            </div>
          ) : (
            <div className="space-y-3">
              {filteredPopups.map((popup) => (
                <div
                  key={popup.id}
                  className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-4 md:flex-row md:items-center"
                >
                  <div className="min-w-0 flex-1">
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <h4 className="truncate font-bold text-gray-900">{popup.title}</h4>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${
                          popup.isActive
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {popup.isActive ? "노출" : "숨김"}
                      </span>
                      <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">
                        {getPlacementLabel(popup.placement)}
                      </span>
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700">
                        {getAudienceLabel(popup.audience)}
                      </span>
                    </div>

                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                      <div className="overflow-hidden rounded-lg border border-gray-100 bg-gray-50">
                        {popup.imageUrl ? (
                          <img
                            src={popup.imageUrl}
                            alt=""
                            className="h-24 w-full object-contain sm:w-44"
                            loading="lazy"
                          />
                        ) : (
                          <div className="flex h-24 w-full items-center justify-center text-gray-300 sm:w-44">
                            <ImageIcon className="h-5 w-5" />
                          </div>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-gray-700">
                          버튼: {popup.linkLabel || "미사용"}
                        </p>
                        <p className="mt-1 truncate text-xs text-gray-400">
                          링크: {popup.linkHref || "연결 없음"}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-400">
                          <span className="inline-flex items-center gap-1">
                            <CalendarClock className="h-3 w-3" />
                            {formatDateTime(popup.startAt)} ~ {formatDateTime(popup.endAt)}
                          </span>
                          <span>우선순위 {popup.priority}</span>
                          <span>크기 {popup.sizePercent ?? 100}%</span>
                          {popup.isDismissible && (
                            <span>{popup.dismissPeriodHours}시간 숨김 가능</span>
                          )}
                        </div>
                      </div>
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
                      className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-600 hover:bg-gray-50"
                    >
                      {popup.isActive ? (
                        <EyeOff className="h-3 w-3" />
                      ) : (
                        <Eye className="h-3 w-3" />
                      )}
                      {popup.isActive ? "숨김" : "노출"}
                    </button>
                    <button
                      type="button"
                      onClick={() => startEdit(popup)}
                      className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-600 hover:bg-gray-50"
                    >
                      <Pencil className="h-3 w-3" />
                      수정
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`"${popup.title}" 팝업을 삭제할까요?`)) {
                          deletePopup.mutate({ id: popup.id });
                        }
                      }}
                      className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-2 text-xs text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="h-3 w-3" />
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
