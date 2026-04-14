/**
 * 히어로 슬라이드 편집 슬라이드 패널
 * - 관리자 로그인 시 홈페이지 우측에서 슬라이드로 열림
 * - 히어로 슬라이드의 텍스트/링크 수정, 표시/숨기기 기능
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
import { Pencil, Check, X, Eye, EyeOff } from "lucide-react";
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
  const [editState, setEditState] = useState<EditState>({
    yearLabel: "", mainTitle: "", subTitle: "", bibleRef: "",
    btn1Text: "", btn1Href: "", btn2Text: "", btn2Href: "",
  });

  const updateMutation = trpc.cms.heroSlides.update.useMutation({
    onSuccess: () => {
      toast.success("슬라이드가 수정됐습니다.");
      setEditingId(null);
      utils.cms.heroSlides.list.invalidate();
      utils.home.heroSlides.invalidate();
    },
    onError: (e) => toast.error("수정 실패: " + e.message),
  });

  const toggleMutation = trpc.cms.heroSlides.update.useMutation({
    onSuccess: () => {
      utils.cms.heroSlides.list.invalidate();
      utils.home.heroSlides.invalidate();
    },
    onError: (e) => toast.error("변경 실패: " + e.message),
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
    });
  };

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-[420px] sm:w-[500px] overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle>히어로 슬라이드 편집</SheetTitle>
          <SheetDescription>홈페이지 상단 영상 슬라이드의 텍스트와 버튼을 수정할 수 있습니다.</SheetDescription>
        </SheetHeader>

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
                  /* 편집 모드 */
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-gray-500 mb-2">슬라이드 {index + 1} 편집</p>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">연도 레이블</label>
                      <Input
                        value={editState.yearLabel}
                        onChange={(e) => setEditState({ ...editState, yearLabel: e.target.value })}
                        placeholder="예: 2026 JOYFUL"
                        className="text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">메인 제목</label>
                      <Input
                        value={editState.mainTitle}
                        onChange={(e) => setEditState({ ...editState, mainTitle: e.target.value })}
                        placeholder="메인 제목"
                        className="text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">부제목</label>
                      <Input
                        value={editState.subTitle}
                        onChange={(e) => setEditState({ ...editState, subTitle: e.target.value })}
                        placeholder="부제목 / 성경 구절"
                        className="text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">성경 구절 출처</label>
                      <Input
                        value={editState.bibleRef}
                        onChange={(e) => setEditState({ ...editState, bibleRef: e.target.value })}
                        placeholder="예: 잠언 3장 9절"
                        className="text-sm"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs text-gray-500 mb-1 block">버튼1 텍스트</label>
                        <Input
                          value={editState.btn1Text}
                          onChange={(e) => setEditState({ ...editState, btn1Text: e.target.value })}
                          placeholder="새가족 등록"
                          className="text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 mb-1 block">버튼1 링크</label>
                        <Input
                          value={editState.btn1Href}
                          onChange={(e) => setEditState({ ...editState, btn1Href: e.target.value })}
                          placeholder="/new-member"
                          className="text-sm"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs text-gray-500 mb-1 block">버튼2 텍스트</label>
                        <Input
                          value={editState.btn2Text}
                          onChange={(e) => setEditState({ ...editState, btn2Text: e.target.value })}
                          placeholder="예배 안내"
                          className="text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 mb-1 block">버튼2 링크</label>
                        <Input
                          value={editState.btn2Href}
                          onChange={(e) => setEditState({ ...editState, btn2Href: e.target.value })}
                          placeholder="/worship"
                          className="text-sm"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2 pt-1">
                      <Button
                        size="sm"
                        className="bg-[#1B5E20] hover:bg-[#2E7D32] text-white"
                        onClick={saveEdit}
                        disabled={updateMutation.isPending}
                      >
                        <Check className="w-3 h-3 mr-1" /> {updateMutation.isPending ? "저장 중..." : "저장"}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>
                        <X className="w-3 h-3 mr-1" /> 취소
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
                        onClick={() => startEdit(slide)}
                        className="p-1.5 rounded hover:bg-blue-50 text-blue-500 hover:text-blue-700 transition-colors"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
            {(slides ?? []).length === 0 && (
              <div className="text-center text-gray-400 py-8 text-sm">등록된 슬라이드가 없습니다.</div>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
