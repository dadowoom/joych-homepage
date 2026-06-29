/**
 * 히어로 슬라이드 편집 슬라이드 패널
 * - 관리자 로그인 시 홈페이지 우측에서 슬라이드로 열림
 * - 히어로 슬라이드의 텍스트/버튼/링크 수정, 표시/숨기기, 추가/삭제 기능
 * - 영상 파일 직접 업로드 (S3 연동)
 */
import { useEffect, useState, useRef } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { Pencil, Check, X, Eye, EyeOff, Trash2, Plus, Upload, Video, Link as LinkIcon, RotateCcw } from "lucide-react";
import { toast } from "sonner";

const MAX_HERO_BUTTONS = 4;
const HERO_COMMON_BUTTONS_KEY = "home_hero_common_buttons";

type HeroButtonDraft = {
  label: string;
  href: string;
  color?: string;
  openInNewTab?: boolean;
};

const BUTTON_COLOR_OPTIONS = [
  { value: "primary", label: "기본 (초록)", className: "bg-[#1B5E20] hover:bg-[#2E7D32] text-white" },
  { value: "secondary", label: "테두리 (흰색)", className: "border-2 border-white/80 hover:bg-white/15 text-white" },
  { value: "blue", label: "파랑", className: "bg-blue-600 hover:bg-blue-700 text-white" },
  { value: "red", label: "빨강", className: "bg-red-600 hover:bg-red-700 text-white" },
  { value: "amber", label: "주황", className: "bg-amber-500 hover:bg-amber-600 text-white" },
  { value: "purple", label: "보라", className: "bg-purple-600 hover:bg-purple-700 text-white" },
] as const;

const DEFAULT_HERO_BUTTONS: HeroButtonDraft[] = [
  { label: "새가족 등록", href: "/support/new-member" },
  { label: "예배 안내", href: "/worship/schedule" },
];

type HeroSlideRow = {
  id: number;
  yearLabel: string | null;
  mainTitle: string | null;
  subTitle: string | null;
  bibleRef: string | null;
  btn1Text: string | null;
  btn1Href: string | null;
  btn2Text: string | null;
  btn2Href: string | null;
  buttonsJson: string | null;
  videoUrl: string | null;
  posterUrl: string | null;
  isVisible: boolean;
  sortOrder: number;
};

type EditState = {
  yearLabel: string;
  mainTitle: string;
  subTitle: string;
  bibleRef: string;
  btn1Text: string;
  btn1Href: string;
  btn2Text: string;
  btn2Href: string;
  useCustomButtons: boolean;
  buttons: HeroButtonDraft[];
  videoUrl: string;
  posterUrl: string;
};

const EMPTY_EDIT: EditState = {
  yearLabel: "", mainTitle: "", subTitle: "", bibleRef: "",
  btn1Text: "", btn1Href: "", btn2Text: "", btn2Href: "",
  useCustomButtons: false,
  buttons: DEFAULT_HERO_BUTTONS,
  videoUrl: "", posterUrl: "",
};

function normalizeButtonDrafts(buttons: HeroButtonDraft[]) {
  return buttons
    .map((button) => ({
      label: button.label.trim(),
      href: button.href.trim(),
      color: button.color || undefined,
      openInNewTab: button.openInNewTab || undefined,
    }))
    .filter((button) => button.label && button.href)
    .slice(0, MAX_HERO_BUTTONS);
}

function hasIncompleteButton(buttons: HeroButtonDraft[]) {
  return buttons.some((button) => {
    const hasLabel = button.label.trim().length > 0;
    const hasHref = button.href.trim().length > 0;
    return hasLabel !== hasHref;
  });
}

function parseButtonsJson(raw: string | null | undefined) {
  if (typeof raw !== "string") return null;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return normalizeButtonDrafts(
      parsed.map((item) => {
        if (!item || typeof item !== "object" || Array.isArray(item)) {
          return { label: "", href: "" };
        }
        const record = item as Record<string, unknown>;
        return {
          label: typeof record.label === "string" ? record.label : "",
          href: typeof record.href === "string" ? record.href : "",
          color: typeof record.color === "string" ? record.color : undefined,
          openInNewTab: typeof record.openInNewTab === "boolean" ? record.openInNewTab : undefined,
        };
      }),
    );
  } catch {
    return null;
  }
}

function getLegacySlideButtons(slide: Pick<HeroSlideRow, "btn1Text" | "btn1Href" | "btn2Text" | "btn2Href">) {
  return normalizeButtonDrafts([
    {
      label: slide.btn1Text ?? "",
      href: slide.btn1Href ?? "",
    },
    {
      label: slide.btn2Text ?? "",
      href: slide.btn2Href ?? "",
    },
  ]);
}

function getButtonPayload(buttons: HeroButtonDraft[]) {
  const normalized = normalizeButtonDrafts(buttons);
  return {
    normalized,
    btn1Text: normalized[0]?.label || undefined,
    btn1Href: normalized[0]?.href || undefined,
    btn2Text: normalized[1]?.label || undefined,
    btn2Href: normalized[1]?.href || undefined,
  };
}

interface HeroEditPanelProps {
  open: boolean;
  onClose: () => void;
}

export default function HeroEditPanel({ open, onClose }: HeroEditPanelProps) {
  const utils = trpc.useUtils();

  const { data: slides, isLoading } = trpc.cms.content.heroSlides.list.useQuery(undefined, {
    enabled: open,
  });
  const { data: siteSettings } = trpc.home.settings.useQuery(undefined, {
    enabled: open,
  });

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editState, setEditState] = useState<EditState>(EMPTY_EDIT);
  const [commonButtons, setCommonButtons] = useState<HeroButtonDraft[]>(DEFAULT_HERO_BUTTONS);

  // 새 슬라이드 추가 폼 표시 여부
  const [showAddForm, setShowAddForm] = useState(false);
  const [newSlide, setNewSlide] = useState<EditState>(EMPTY_EDIT);

  // 삭제 확인 중인 슬라이드 ID
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  // 영상 업로드 진행 상태
  const [uploadingFor, setUploadingFor] = useState<"edit" | "new" | null>(null);
  const [uploadProgress, setUploadProgress] = useState<string>("");
  const videoInputRef = useRef<HTMLInputElement>(null);
  const newVideoInputRef = useRef<HTMLInputElement>(null);

  const uploadVideoMutation = trpc.cms.upload.video.useMutation({
    onError: (e) => {
      toast.error("영상 업로드 실패: " + e.message);
      setUploadingFor(null);
      setUploadProgress("");
    },
  });

  const invalidateAll = () => {
    utils.cms.content.heroSlides.list.invalidate();
    utils.home.heroSlides.invalidate();
    utils.home.settings.invalidate();
  };

  const updateMutation = trpc.cms.content.heroSlides.update.useMutation({
    onSuccess: () => {
      toast.success("슬라이드가 수정됐습니다.");
      setEditingId(null);
      invalidateAll();
    },
    onError: (e) => toast.error("수정 실패: " + e.message),
  });

  const toggleMutation = trpc.cms.content.heroSlides.update.useMutation({
    onSuccess: () => invalidateAll(),
    onError: (e) => toast.error("변경 실패: " + e.message),
  });

  const createMutation = trpc.cms.content.heroSlides.create.useMutation({
    onSuccess: () => {
      toast.success("새 슬라이드가 추가됐습니다.");
      setShowAddForm(false);
      setNewSlide(EMPTY_EDIT);
      invalidateAll();
    },
    onError: (e) => toast.error("추가 실패: " + e.message),
  });

  const deleteMutation = trpc.cms.content.heroSlides.delete.useMutation({
    onSuccess: () => {
      toast.success("슬라이드가 삭제됐습니다.");
      setConfirmDeleteId(null);
      invalidateAll();
    },
    onError: (e) => toast.error("삭제 실패: " + e.message),
  });

  const updateCommonButtonsMutation = trpc.cms.content.settings.update.useMutation({
    onSuccess: () => {
      toast.success("공통 버튼 설정이 저장됐습니다.");
      invalidateAll();
    },
    onError: (e) => toast.error("공통 버튼 저장 실패: " + e.message),
  });

  const useCommonButtonsForAllMutation = trpc.cms.content.heroSlides.useCommonButtonsForAll.useMutation({
    onSuccess: () => {
      toast.success("모든 슬라이드가 공통 버튼을 사용하도록 변경됐습니다.");
      setEditingId(null);
      invalidateAll();
    },
    onError: (e) => toast.error("일괄 적용 실패: " + e.message),
  });

  useEffect(() => {
    if (!open) return;
    const parsed = parseButtonsJson(siteSettings?.[HERO_COMMON_BUTTONS_KEY]);
    setCommonButtons(parsed && parsed.length > 0 ? parsed : DEFAULT_HERO_BUTTONS);
  }, [open, siteSettings]);

  const startEdit = (slide: HeroSlideRow) => {
    const customButtons = parseButtonsJson(slide.buttonsJson);
    const legacyButtons = getLegacySlideButtons(slide);
    setEditingId(slide.id);
    setEditState({
      yearLabel: slide.yearLabel ?? "",
      mainTitle: slide.mainTitle ?? "",
      subTitle: slide.subTitle ?? "",
      bibleRef: slide.bibleRef ?? "",
      btn1Text: slide.btn1Text ?? "",
      btn1Href: slide.btn1Href ?? "",
      btn2Text: slide.btn2Text ?? "",
      btn2Href: slide.btn2Href ?? "",
      useCustomButtons: customButtons !== null,
      buttons: customButtons ?? (legacyButtons.length > 0 ? legacyButtons : DEFAULT_HERO_BUTTONS),
      videoUrl: slide.videoUrl ?? "",
      posterUrl: slide.posterUrl ?? "",
    });
  };

  const saveEdit = () => {
    if (!editingId) return;
    if (editState.useCustomButtons && hasIncompleteButton(editState.buttons)) {
      toast.error("버튼 텍스트와 링크는 함께 입력해주세요.");
      return;
    }
    const buttonPayload = getButtonPayload(editState.buttons);
    updateMutation.mutate({
      id: editingId,
      yearLabel: editState.yearLabel || undefined,
      mainTitle: editState.mainTitle || undefined,
      subTitle: editState.subTitle || undefined,
      bibleRef: editState.bibleRef || undefined,
      btn1Text: editState.useCustomButtons ? buttonPayload.btn1Text : editState.btn1Text || undefined,
      btn1Href: editState.useCustomButtons ? buttonPayload.btn1Href : editState.btn1Href || undefined,
      btn2Text: editState.useCustomButtons ? buttonPayload.btn2Text : editState.btn2Text || undefined,
      btn2Href: editState.useCustomButtons ? buttonPayload.btn2Href : editState.btn2Href || undefined,
      buttonsJson: editState.useCustomButtons ? buttonPayload.normalized : null,
      videoUrl: editState.videoUrl || undefined,
      posterUrl: editState.posterUrl || undefined,
    });
  };

  const saveNewSlide = () => {
    if (newSlide.useCustomButtons && hasIncompleteButton(newSlide.buttons)) {
      toast.error("버튼 텍스트와 링크는 함께 입력해주세요.");
      return;
    }
    const buttonPayload = getButtonPayload(newSlide.buttons);
    createMutation.mutate({
      yearLabel: newSlide.yearLabel || undefined,
      mainTitle: newSlide.mainTitle || undefined,
      subTitle: newSlide.subTitle || undefined,
      bibleRef: newSlide.bibleRef || undefined,
      btn1Text: newSlide.useCustomButtons ? buttonPayload.btn1Text : newSlide.btn1Text || undefined,
      btn1Href: newSlide.useCustomButtons ? buttonPayload.btn1Href : newSlide.btn1Href || undefined,
      btn2Text: newSlide.useCustomButtons ? buttonPayload.btn2Text : newSlide.btn2Text || undefined,
      btn2Href: newSlide.useCustomButtons ? buttonPayload.btn2Href : newSlide.btn2Href || undefined,
      buttonsJson: newSlide.useCustomButtons ? buttonPayload.normalized : null,
      videoUrl: newSlide.videoUrl || undefined,
      posterUrl: newSlide.posterUrl || undefined,
    });
  };

  const saveCommonButtons = () => {
    if (hasIncompleteButton(commonButtons)) {
      toast.error("공통 버튼의 텍스트와 링크는 함께 입력해주세요.");
      return;
    }
    updateCommonButtonsMutation.mutate({
      key: HERO_COMMON_BUTTONS_KEY,
      value: JSON.stringify(normalizeButtonDrafts(commonButtons)),
    });
  };

  const applyCommonButtonsToAllSlides = async () => {
    if (hasIncompleteButton(commonButtons)) {
      toast.error("공통 버튼의 텍스트와 링크는 함께 입력해주세요.");
      return;
    }
    const confirmed = window.confirm("현재 공통 버튼을 저장하고, 모든 슬라이드가 공통 버튼을 사용하도록 변경할까요?");
    if (!confirmed) return;

    try {
      await updateCommonButtonsMutation.mutateAsync({
        key: HERO_COMMON_BUTTONS_KEY,
        value: JSON.stringify(normalizeButtonDrafts(commonButtons)),
      });
      await useCommonButtonsForAllMutation.mutateAsync();
    } catch {
      // 각 mutation의 onError에서 사용자에게 원인을 보여준다.
    }
  };

  /**
   * 영상 파일을 선택하면 Base64로 변환 후 서버에 업로드합니다.
   * 업로드 완료 시 반환된 CDN URL을 videoUrl 필드에 자동으로 채웁니다.
   */
  const handleVideoFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
    target: "edit" | "new"
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 파일 크기 제한: 50MB
    const MAX_SIZE = 50 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      toast.error("파일 크기가 너무 큽니다. 50MB 이하의 영상 파일을 선택해 주세요.");
      return;
    }

    setUploadingFor(target);
    setUploadProgress("파일 읽는 중...");

    try {
      // 파일을 Base64 문자열로 변환
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          // "data:video/mp4;base64,XXXX" 형태에서 실제 base64 부분만 추출
          const base64Data = result.split(",")[1];
          resolve(base64Data);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      setUploadProgress("서버에 업로드 중...");

      const { url } = await uploadVideoMutation.mutateAsync({
        base64,
        fileName: file.name,
        mimeType: file.type || "video/mp4",
      });

      // 업로드된 CDN URL을 해당 폼의 videoUrl에 자동 입력
      if (target === "edit") {
        setEditState((prev) => ({ ...prev, videoUrl: url }));
      } else {
        setNewSlide((prev) => ({ ...prev, videoUrl: url }));
      }

      toast.success("영상 업로드 완료! 저장 버튼을 눌러 적용하세요.");
    } catch (err) {
      // 에러는 useMutation의 onError에서 처리됨
    } finally {
      setUploadingFor(null);
      setUploadProgress("");
      // 파일 입력 초기화 (같은 파일 재선택 가능하도록)
      e.target.value = "";
    }
  };

  // 영상 업로드 버튼 + URL 입력 필드 렌더링
  const renderVideoUploadField = (
    state: EditState,
    setState: (s: EditState) => void,
    target: "edit" | "new",
    inputRef: React.RefObject<HTMLInputElement | null>
  ) => {
    const isUploading = uploadingFor === target;
    return (
      <div>
        <label className="text-xs text-gray-500 mb-1 block">배경 영상</label>
        <div className="space-y-2">
          {/* 파일 업로드 버튼 */}
          <div className="flex gap-2 items-center">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="flex-1 border-dashed border-[#1B5E20] text-[#1B5E20] hover:bg-green-50"
              disabled={isUploading}
              onClick={() => inputRef.current?.click()}
            >
              {isUploading ? (
                <>
                  <Upload className="w-3 h-3 mr-1 animate-bounce" />
                  {uploadProgress}
                </>
              ) : (
                <>
                  <Upload className="w-3 h-3 mr-1" />
                  영상 파일 선택 (최대 50MB)
                </>
              )}
            </Button>
            <input
              ref={inputRef}
              type="file"
              accept="video/mp4,video/webm,video/ogg"
              className="hidden"
              onChange={(e) => handleVideoFileChange(e, target)}
            />
          </div>
          {/* 업로드된 영상 미리보기 */}
          {state.videoUrl && (
            <div className="flex items-center gap-2 p-2 bg-green-50 rounded border border-green-200">
              <Video className="w-4 h-4 text-green-600 shrink-0" />
              <span className="text-xs text-green-700 truncate flex-1">{state.videoUrl.split("/").pop()}</span>
              <button
                type="button"
                className="text-xs text-red-400 hover:text-red-600 shrink-0"
                onClick={() => setState({ ...state, videoUrl: "" })}
              >
                제거
              </button>
            </div>
          )}
          {/* 직접 URL 입력 (고급 사용자용) */}
          <details className="text-xs">
            <summary className="text-gray-400 cursor-pointer hover:text-gray-600">직접 URL 입력 (고급)</summary>
            <Input
              value={state.videoUrl}
              onChange={(e) => setState({ ...state, videoUrl: e.target.value })}
              placeholder="https://cdn.example.com/video.mp4"
              className="text-xs font-mono mt-1"
            />
          </details>
        </div>
      </div>
    );
  };

  const updateButtonDraft = (
    buttons: HeroButtonDraft[],
    setButtons: (buttons: HeroButtonDraft[]) => void,
    index: number,
    patch: Partial<HeroButtonDraft>,
  ) => {
    setButtons(buttons.map((button, buttonIndex) => (
      buttonIndex === index ? { ...button, ...patch } : button
    )));
  };

  const renderButtonListEditor = (
    buttons: HeroButtonDraft[],
    setButtons: (buttons: HeroButtonDraft[]) => void,
    options?: { disabled?: boolean; compact?: boolean },
  ) => {
    const disabled = options?.disabled ?? false;
    const visibleButtons = buttons.length > 0 ? buttons : [{ label: "", href: "" }];

    return (
      <div className="space-y-2">
        {visibleButtons.map((button, index) => (
          <div key={index} className="rounded-md border border-gray-200 bg-white p-2">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[11px] font-semibold text-gray-500">버튼 {index + 1}</span>
              <button
                type="button"
                className="text-[11px] text-red-400 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
                disabled={disabled || visibleButtons.length <= 1}
                onClick={() => setButtons(visibleButtons.filter((_, buttonIndex) => buttonIndex !== index))}
              >
                삭제
              </button>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Input
                value={button.label}
                disabled={disabled}
                onChange={(event) => updateButtonDraft(visibleButtons, setButtons, index, { label: event.target.value })}
                placeholder="버튼 텍스트"
                className="text-sm"
              />
              <Input
                value={button.href}
                disabled={disabled}
                onChange={(event) => updateButtonDraft(visibleButtons, setButtons, index, { href: event.target.value })}
                placeholder="/support/new-member"
                className="text-sm font-mono"
              />
            </div>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <label className="text-[11px] text-gray-600">
                버튼 색상
                <select
                  className="mt-0.5 w-full rounded border border-gray-300 px-2 py-1 text-xs"
                  value={button.color ?? ""}
                  disabled={disabled}
                  onChange={(event) => updateButtonDraft(visibleButtons, setButtons, index, { color: event.target.value || undefined })}
                >
                  <option value="">기본 디자인</option>
                  {BUTTON_COLOR_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              <label className="flex items-end gap-2 text-[11px] text-gray-600">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-[#1B5E20]"
                  checked={Boolean(button.openInNewTab)}
                  disabled={disabled}
                  onChange={(event) => updateButtonDraft(visibleButtons, setButtons, index, { openInNewTab: event.target.checked })}
                />
                <span>새 창으로 열기</span>
              </label>
            </div>
          </div>
        ))}
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="w-full border-dashed text-gray-600"
          disabled={disabled || visibleButtons.length >= MAX_HERO_BUTTONS}
          onClick={() => setButtons([...visibleButtons, { label: "", href: "" }])}
        >
          <Plus className="mr-1 h-3 w-3" />
          버튼 추가 ({visibleButtons.length}/{MAX_HERO_BUTTONS})
        </Button>
      </div>
    );
  };

  const renderCommonButtonsPanel = () => (
    <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-3">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[#1B5E20]">공통 버튼 설정</p>
          <p className="mt-0.5 text-xs leading-5 text-gray-500">
            개별 버튼을 쓰지 않는 모든 히어로 슬라이드에 적용됩니다.
          </p>
        </div>
        <LinkIcon className="mt-0.5 h-4 w-4 shrink-0 text-[#1B5E20]" />
      </div>
      {renderButtonListEditor(commonButtons, setCommonButtons)}
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Button
          type="button"
          size="sm"
          className="bg-[#1B5E20] text-white hover:bg-[#2E7D32]"
          disabled={updateCommonButtonsMutation.isPending}
          onClick={saveCommonButtons}
        >
          <Check className="mr-1 h-3 w-3" />
          {updateCommonButtonsMutation.isPending ? "저장 중..." : "공통 버튼 저장"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={updateCommonButtonsMutation.isPending || useCommonButtonsForAllMutation.isPending}
          onClick={applyCommonButtonsToAllSlides}
        >
          <RotateCcw className="mr-1 h-3 w-3" />
          {useCommonButtonsForAllMutation.isPending ? "적용 중..." : "저장 후 전체 일괄 적용"}
        </Button>
      </div>
    </div>
  );

  const renderSlideButtonEditor = (
    state: EditState,
    setState: (s: EditState) => void,
  ) => (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
      <label className="flex items-start gap-2">
        <input
          type="checkbox"
          checked={state.useCustomButtons}
          onChange={(event) => setState({
            ...state,
            useCustomButtons: event.target.checked,
            buttons: state.buttons.length > 0 ? state.buttons : DEFAULT_HERO_BUTTONS,
          })}
          className="mt-1"
        />
        <span>
          <span className="block text-xs font-semibold text-gray-700">이 슬라이드만 개별 버튼 사용</span>
          <span className="block text-xs leading-5 text-gray-500">
            체크하지 않으면 상단 공통 버튼 설정을 그대로 사용합니다.
          </span>
        </span>
      </label>
      <div className="mt-3">
        {renderButtonListEditor(
          state.buttons,
          (buttons) => setState({ ...state, buttons }),
          { disabled: !state.useCustomButtons },
        )}
      </div>
    </div>
  );

  const getSlidePreviewButtons = (slide: HeroSlideRow) => {
    const customButtons = parseButtonsJson(slide.buttonsJson);
    if (customButtons !== null) {
      return { source: "개별 버튼", buttons: customButtons };
    }
    const normalizedCommonButtons = normalizeButtonDrafts(commonButtons);
    return {
      source: "공통 버튼",
      buttons: normalizedCommonButtons.length > 0 ? normalizedCommonButtons : getLegacySlideButtons(slide),
    };
  };

  // 편집 폼 공통 렌더링
  const renderEditFields = (
    state: EditState,
    setState: (s: EditState) => void,
    label: string,
    onSave: () => void,
    onCancel: () => void,
    isPending: boolean,
    target: "edit" | "new",
    inputRef: React.RefObject<HTMLInputElement | null>
  ) => (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-gray-500 mb-2">{label}</p>
      <div>
        <label className="text-xs text-gray-500 mb-1 block">연도 레이블</label>
        <Input value={state.yearLabel} onChange={(e) => setState({ ...state, yearLabel: e.target.value })} placeholder="예: 2026 JOYFUL" className="text-sm" />
      </div>
      <div>
        <label className="text-xs text-gray-500 mb-1 block">메인 제목</label>
        <Input value={state.mainTitle} onChange={(e) => setState({ ...state, mainTitle: e.target.value })} placeholder="메인 제목" className="text-sm" />
      </div>
      <div>
        <label className="text-xs text-gray-500 mb-1 block">부제목</label>
        <Input value={state.subTitle} onChange={(e) => setState({ ...state, subTitle: e.target.value })} placeholder="부제목 / 성경 구절" className="text-sm" />
      </div>
      <div>
        <label className="text-xs text-gray-500 mb-1 block">성경 구절 출처</label>
        <Input value={state.bibleRef} onChange={(e) => setState({ ...state, bibleRef: e.target.value })} placeholder="예: 잠언 3장 9절" className="text-sm" />
      </div>
      {renderSlideButtonEditor(state, setState)}

      {/* 영상 업로드 필드 */}
      {renderVideoUploadField(state, setState, target, inputRef)}

      <div>
        <label className="text-xs text-gray-500 mb-1 block">포스터 이미지 URL (영상 로딩 전 표시)</label>
        <Input value={state.posterUrl} onChange={(e) => setState({ ...state, posterUrl: e.target.value })} placeholder="https://cdn.example.com/poster.webp" className="text-sm font-mono" />
      </div>
      <div className="flex gap-2 pt-1">
        <Button size="sm" className="bg-[#1B5E20] hover:bg-[#2E7D32] text-white" onClick={onSave} disabled={isPending || uploadingFor !== null}>
          <Check className="w-3 h-3 mr-1" /> {isPending ? "저장 중..." : "저장"}
        </Button>
        <Button size="sm" variant="outline" onClick={onCancel}>
          <X className="w-3 h-3 mr-1" /> 취소
        </Button>
      </div>
    </div>
  );

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-[440px] sm:w-[520px] overflow-y-auto bg-white" style={{ top: "144px", height: "calc(100vh - 144px)" }}>
        <SheetHeader className="mb-4">
          <SheetTitle>히어로 슬라이드 편집</SheetTitle>
          <SheetDescription>홈페이지 상단 영상 슬라이드의 텍스트, 버튼, 영상을 수정하거나 새 슬라이드를 추가할 수 있습니다.</SheetDescription>
        </SheetHeader>

        {renderCommonButtonsPanel()}

        {/* 슬라이드 추가 버튼 */}
        {!showAddForm && (
          <Button
            size="sm"
            className="w-full mb-4 bg-[#1B5E20] hover:bg-[#2E7D32] text-white"
            onClick={() => { setShowAddForm(true); setEditingId(null); }}
          >
            <Plus className="w-4 h-4 mr-1" /> 새 슬라이드 추가
          </Button>
        )}

        {/* 새 슬라이드 추가 폼 */}
        {showAddForm && (
          <div className="border-2 border-dashed border-[#1B5E20] rounded-lg p-3 mb-4 bg-green-50">
            {renderEditFields(
              newSlide,
              setNewSlide,
              "새 슬라이드",
              saveNewSlide,
              () => { setShowAddForm(false); setNewSlide(EMPTY_EDIT); },
              createMutation.isPending,
              "new",
              newVideoInputRef
            )}
          </div>
        )}

        {isLoading ? (
          <div className="text-center text-gray-400 py-8 text-sm">불러오는 중...</div>
        ) : (
          <div className="space-y-3">
            {(slides ?? []).map((slide, index) => (
              <div
                key={slide.id}
                className={`border rounded-lg p-3 ${!slide.isVisible ? "opacity-50 bg-gray-50" : "bg-white"}`}
              >
                {editingId === slide.id ? (
                  renderEditFields(
                    editState,
                    setEditState,
                    `슬라이드 ${index + 1} 편집`,
                    saveEdit,
                    () => setEditingId(null),
                    updateMutation.isPending,
                    "edit",
                    videoInputRef
                  )
                ) : confirmDeleteId === slide.id ? (
                  /* 삭제 확인 */
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-red-600">정말 삭제하시겠습니까?</p>
                    <p className="text-xs text-gray-500">"{slide.mainTitle}" 슬라이드가 영구적으로 삭제됩니다.</p>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => deleteMutation.mutate({ id: slide.id })}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="w-3 h-3 mr-1" /> {deleteMutation.isPending ? "삭제 중..." : "삭제 확인"}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setConfirmDeleteId(null)}>
                        취소
                      </Button>
                    </div>
                  </div>
                ) : (
                  /* 보기 모드 */
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-semibold text-[#1B5E20]">슬라이드 {index + 1}</span>
                        {!slide.isVisible && (
                          <span className="text-xs text-gray-400">(숨김)</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400">{slide.yearLabel}</p>
                      <p className="text-sm font-medium text-gray-800 truncate">{slide.mainTitle}</p>
                      {slide.subTitle && (
                        <p className="text-xs text-gray-500 truncate mt-0.5">{slide.subTitle}</p>
                      )}
                      {/* 영상 파일 표시 */}
                      {slide.videoUrl && (
                        <div className="flex items-center gap-1 mt-1">
                          <Video className="w-3 h-3 text-gray-400" />
                          <span className="text-xs text-gray-400 truncate">{slide.videoUrl.split("/").pop()}</span>
                        </div>
                      )}
                      {(() => {
                        const preview = getSlidePreviewButtons(slide);
                        return (
                          <div className="mt-2 space-y-1">
                            <span className="inline-flex rounded bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-500">
                              {preview.source}
                            </span>
                            <div className="flex flex-wrap gap-1">
                              {preview.buttons.map((button, buttonIndex) => (
                                <span
                                  key={`${button.label}-${buttonIndex}`}
                                  className={`rounded px-1.5 py-0.5 text-xs ${buttonIndex === 0 ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}
                                >
                                  {button.label}
                                </span>
                              ))}
                              {preview.buttons.length === 0 && (
                                <span className="text-xs text-gray-400">표시할 버튼 없음</span>
                              )}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button
                        title={slide.isVisible ? "숨기기" : "표시하기"}
                        onClick={() => toggleMutation.mutate({ id: slide.id, isVisible: !slide.isVisible })}
                        className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
                      >
                        {slide.isVisible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                      </button>
                      <button
                        title="수정"
                        onClick={() => { startEdit(slide); setShowAddForm(false); }}
                        className="p-1.5 rounded hover:bg-blue-50 text-blue-500 hover:text-blue-700 transition-colors"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        title="삭제"
                        onClick={() => setConfirmDeleteId(slide.id)}
                        className="p-1.5 rounded hover:bg-red-50 text-red-400 hover:text-red-600 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
            {(slides ?? []).length === 0 && (
              <div className="text-center text-gray-400 py-8 text-sm">등록된 슬라이드가 없습니다.<br />위의 버튼으로 새 슬라이드를 추가해 보세요.</div>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
