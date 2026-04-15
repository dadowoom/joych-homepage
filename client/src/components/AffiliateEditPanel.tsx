/**
 * 관련 기관 편집 슬라이드 패널
 * - 관리자 로그인 시 홈페이지 우측에서 슬라이드로 열림
 * - 관련 기관의 이름, 링크, 아이콘 수정, 표시/숨기기 기능
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

type AffiliateRow = {
  id: number;
  icon: string;
  label: string;
  href: string | null;
  sortOrder: number;
  isVisible: boolean;
};

type EditState = {
  icon: string;
  label: string;
  href: string;
};

interface AffiliateEditPanelProps {
  open: boolean;
  onClose: () => void;
}

export default function AffiliateEditPanel({ open, onClose }: AffiliateEditPanelProps) {
  const utils = trpc.useUtils();

  const { data: affiliates, isLoading } = trpc.cms.affiliates.list.useQuery(undefined, {
    enabled: open,
  });

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editState, setEditState] = useState<EditState>({ icon: "", label: "", href: "" });

  const updateMutation = trpc.cms.affiliates.update.useMutation({
    onSuccess: () => {
      toast.success("관련 기관이 수정됐습니다.");
      setEditingId(null);
      utils.cms.affiliates.list.invalidate();
      utils.home.affiliates.invalidate();
    },
    onError: (e) => toast.error("수정 실패: " + e.message),
  });

  const toggleMutation = trpc.cms.affiliates.update.useMutation({
    onSuccess: () => {
      utils.cms.affiliates.list.invalidate();
      utils.home.affiliates.invalidate();
    },
    onError: (e) => toast.error("변경 실패: " + e.message),
  });

  const startEdit = (affiliate: AffiliateRow) => {
    setEditingId(affiliate.id);
    setEditState({
      icon: affiliate.icon,
      label: affiliate.label,
      href: affiliate.href ?? "",
    });
  };

  const saveEdit = () => {
    if (!editingId) return;
    updateMutation.mutate({
      id: editingId,
      icon: editState.icon || undefined,
      label: editState.label || undefined,
      href: editState.href || undefined,
    });
  };

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-[400px] sm:w-[460px] overflow-y-auto bg-white" style={{ top: "144px", height: "calc(100vh - 144px)" }}>
        <SheetHeader className="mb-4">
          <SheetTitle>관련 기관 편집</SheetTitle>
          <SheetDescription>홈페이지 하단 관련 기관의 이름, 링크, 아이콘을 수정할 수 있습니다.</SheetDescription>
        </SheetHeader>

        <div className="mb-3 p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-700">
          💡 아이콘은 Font Awesome 클래스명을 사용합니다. (예: fa-hands-helping, fa-building)
        </div>

        {isLoading ? (
          <div className="text-center text-gray-400 py-8 text-sm">불러오는 중...</div>
        ) : (
          <div className="space-y-2">
            {(affiliates ?? []).map((affiliate) => (
              <div
                key={affiliate.id}
                className={`border rounded-lg p-3 ${!affiliate.isVisible ? "opacity-50 bg-gray-50" : "bg-white"}`}
              >
                {editingId === affiliate.id ? (
                  /* 편집 모드 */
                  <div className="space-y-2">
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">아이콘 클래스</label>
                      <Input
                        value={editState.icon}
                        onChange={(e) => setEditState({ ...editState, icon: e.target.value })}
                        placeholder="fa-hands-helping"
                        className="text-sm font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">기관 이름</label>
                      <Input
                        value={editState.label}
                        onChange={(e) => setEditState({ ...editState, label: e.target.value })}
                        placeholder="기관 이름"
                        className="text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">링크 URL</label>
                      <Input
                        value={editState.href}
                        onChange={(e) => setEditState({ ...editState, href: e.target.value })}
                        placeholder="https://example.com"
                        className="text-sm"
                      />
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
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-[#E8F5E9] flex items-center justify-center text-[#1B5E20] shrink-0">
                      <i className={`fas ${affiliate.icon} text-sm`}></i>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800">{affiliate.label}</p>
                      {affiliate.href && (
                        <p className="text-xs text-gray-400 truncate">{affiliate.href}</p>
                      )}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button
                        title={affiliate.isVisible ? "숨기기" : "표시하기"}
                        onClick={() => toggleMutation.mutate({ id: affiliate.id, isVisible: !affiliate.isVisible })}
                        className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
                      >
                        {affiliate.isVisible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                      </button>
                      <button
                        title="수정"
                        onClick={() => startEdit(affiliate)}
                        className="p-1.5 rounded hover:bg-blue-50 text-blue-500 hover:text-blue-700 transition-colors"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
            {(affiliates ?? []).length === 0 && (
              <div className="text-center text-gray-400 py-8 text-sm">등록된 관련 기관이 없습니다.</div>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
