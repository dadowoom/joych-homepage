/**
 * 히어로 슬라이드 편집 슬라이드 패널
 * - 관리자 로그인 시 홈페이지 우측에서 슬라이드로 열림
 * - 히어로 슬라이드의 텍스트/링크 수정, 표시/숨기기, 추가/삭제 기능
 */
import { useState } from "react";
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
import { Pencil, Check, X, Eye, EyeOff, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";

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
  videoUrl: string;
  posterUrl: string;
};

const EMPTY_EDIT: EditState = {
  yearLabel: "", mainTitle: "", subTitle: "", bibleRef: "",
  btn1Text: "", btn1Href: "", btn2Text: "", btn2Href: "",
  videoUrl: "", posterUrl: "",
};

interface HeroEditPanelProps {
  open: boolean;
  onClose: () => void;
}

export default function HeroEditPanel({ open, onClose }: HeroEditPanelProps) {
  const utils = trpc.useUtils();

  const { data: slides, isLoading } = trpc.cms.heroSlides.list.useQuery(undefined, {
    enabled: open,
  });

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editState, setEditState] = useState<EditState>(EMPTY_EDIT);

  // 새 슬라이드 추가 폼 표시 여부
  const [showAddForm, setShowAddForm] = useState(false);
  const [newSlide, setNewSlide] = useState<EditState>(EMPTY_EDIT);

  // 삭제 확인 중인 슬라이드 ID
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const invalidateAll = () => {
    utils.cms.heroSlides.list.invalidate();
    utils.home.heroSlides.invalidate();
  };

  const updateMutation = trpc.cms.heroSlides.update.useMutation({
    onSuccess: () => {
      toast.success("슬라이드가 수정됐습니다.");
      setEditingId(null);
      invalidateAll();
    },
    onError: (e) => toast.error("수정 실패: " + e.message),
  });

  const toggleMutation = trpc.cms.heroSlides.update.useMutation({
    onSuccess: () => invalidateAll(),
    onError: (e) => toast.error("변경 실패: " + e.message),
  });

  const createMutation = trpc.cms.heroSlides.create.useMutation({
    onSuccess: () => {
      toast.success("새 슬라이드가 추가됐습니다.");
      setShowAddForm(false);
      setNewSlide(EMPTY_EDIT);
      invalidateAll();
    },
    onError: (e) => toast.error("추가 실패: " + e.message),
  });

  const deleteMutation = trpc.cms.heroSlides.delete.useMutation({
    onSuccess: () => {
      toast.success("슬라이드가 삭제됐습니다.");
      setConfirmDeleteId(null);
      invalidateAll();
    },
    onError: (e) => toast.error("삭제 실패: " + e.message),
  });

  const startEdit = (slide: HeroSlideRow) => {
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
      videoUrl: slide.videoUrl ?? "",
      posterUrl: slide.posterUrl ?? "",
    });
  };

  const saveEdit = () => {
    if (!editingId) return;
    updateMutation.mutate({
      id: editingId,
      yearLabel: editState.yearLabel || undefined,
      mainTitle: editState.mainTitle || undefined,
      subTitle: editState.subTitle || undefined,
      bibleRef: editState.bibleRef || undefined,
      btn1Text: editState.btn1Text || undefined,
      btn1Href: editState.btn1Href || undefined,
      btn2Text: editState.btn2Text || undefined,
      btn2Href: editState.btn2Href || undefined,
      videoUrl: editState.videoUrl || undefined,
      posterUrl: editState.posterUrl || undefined,
    });
  };

  const saveNewSlide = () => {
    createMutation.mutate({
      yearLabel: newSlide.yearLabel || undefined,
      mainTitle: newSlide.mainTitle || undefined,
      subTitle: newSlide.subTitle || undefined,
      bibleRef: newSlide.bibleRef || undefined,
      btn1Text: newSlide.btn1Text || undefined,
      btn1Href: newSlide.btn1Href || undefined,
      btn2Text: newSlide.btn2Text || undefined,
      btn2Href: newSlide.btn2Href || undefined,
      videoUrl: newSlide.videoUrl || undefined,
      posterUrl: newSlide.posterUrl || undefined,
    });
  };

  // 편집 폼 공통 렌더링
  const renderEditFields = (
    state: EditState,
    setState: (s: EditState) => void,
    label: string,
    onSave: () => void,
    onCancel: () => void,
    isPending: boolean
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
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-gray-500 mb-1 block">버튼1 텍스트</label>
          <Input value={state.btn1Text} onChange={(e) => setState({ ...state, btn1Text: e.target.value })} placeholder="새가족 등록" className="text-sm" />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">버튼1 링크</label>
          <Input value={state.btn1Href} onChange={(e) => setState({ ...state, btn1Href: e.target.value })} placeholder="/new-member" className="text-sm" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-gray-500 mb-1 block">버튼2 텍스트</label>
          <Input value={state.btn2Text} onChange={(e) => setState({ ...state, btn2Text: e.target.value })} placeholder="예배 안내" className="text-sm" />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">버튼2 링크</label>
          <Input value={state.btn2Href} onChange={(e) => setState({ ...state, btn2Href: e.target.value })} placeholder="/worship" className="text-sm" />
        </div>
      </div>
      <div>
        <label className="text-xs text-gray-500 mb-1 block">영상 URL (CDN)</label>
        <Input value={state.videoUrl} onChange={(e) => setState({ ...state, videoUrl: e.target.value })} placeholder="https://cdn.example.com/video.mp4" className="text-sm font-mono" />
      </div>
      <div>
        <label className="text-xs text-gray-500 mb-1 block">포스터 이미지 URL</label>
        <Input value={state.posterUrl} onChange={(e) => setState({ ...state, posterUrl: e.target.value })} placeholder="https://cdn.example.com/poster.webp" className="text-sm font-mono" />
      </div>
      <div className="flex gap-2 pt-1">
        <Button size="sm" className="bg-[#1B5E20] hover:bg-[#2E7D32] text-white" onClick={onSave} disabled={isPending}>
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
              createMutation.isPending
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
                    updateMutation.isPending
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
                      <div className="flex gap-2 mt-1">
                        {slide.btn1Text && (
                          <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">{slide.btn1Text}</span>
                        )}
                        {slide.btn2Text && (
                          <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{slide.btn2Text}</span>
                        )}
                      </div>
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
