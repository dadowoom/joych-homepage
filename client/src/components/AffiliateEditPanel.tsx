/**
 * 관련 기관 편집 슬라이드 패널
 * - 관리자 로그인 시 홈페이지 우측에서 슬라이드로 열림
 * - 관련 기관의 추가, 수정, 삭제, 표시/숨기기 기능
 * - 아이콘은 IconPicker로 시각적 선택 가능
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
import { Pencil, Check, X, Eye, EyeOff, Smile, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import IconPicker from "@/components/IconPicker";

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

  const { data: affiliates, isLoading } = trpc.cms.content.affiliates.list.useQuery(undefined, {
    enabled: open,
  });

  // 수정 상태
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editState, setEditState] = useState<EditState>({ icon: "", label: "", href: "" });
  const [showEditIconPicker, setShowEditIconPicker] = useState(false);

  // 새 항목 추가 상태
  const [showAddForm, setShowAddForm] = useState(false);
  const [newItem, setNewItem] = useState<EditState>({ icon: "", label: "", href: "" });
  const [showAddIconPicker, setShowAddIconPicker] = useState(false);

  const invalidate = () => {
    utils.cms.content.affiliates.list.invalidate();
    utils.home.affiliates.invalidate();
  };

  const updateMutation = trpc.cms.content.affiliates.update.useMutation({
    onSuccess: () => {
      toast.success("관련 기관이 수정됐습니다.");
      setEditingId(null);
      setShowEditIconPicker(false);
      invalidate();
    },
    onError: (e) => toast.error("수정 실패: " + e.message),
  });

  const createMutation = trpc.cms.content.affiliates.create.useMutation({
    onSuccess: () => {
      toast.success("관련 기관이 추가됐습니다.");
      setShowAddForm(false);
      setNewItem({ icon: "", label: "", href: "" });
      setShowAddIconPicker(false);
      invalidate();
    },
    onError: (e) => toast.error("추가 실패: " + e.message),
  });

  const deleteMutation = trpc.cms.content.affiliates.delete.useMutation({
    onSuccess: () => {
      toast.success("관련 기관이 삭제됐습니다.");
      invalidate();
    },
    onError: (e) => toast.error("삭제 실패: " + e.message),
  });

  const toggleMutation = trpc.cms.content.affiliates.update.useMutation({
    onSuccess: () => invalidate(),
    onError: (e) => toast.error("변경 실패: " + e.message),
  });

  const startEdit = (affiliate: AffiliateRow) => {
    setEditingId(affiliate.id);
    setShowEditIconPicker(false);
    setShowAddForm(false);
    setEditState({ icon: affiliate.icon, label: affiliate.label, href: affiliate.href ?? "" });
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

  const handleCreate = () => {
    if (!newItem.icon) { toast.error("아이콘을 선택해 주세요."); return; }
    if (!newItem.label.trim()) { toast.error("기관 이름을 입력해 주세요."); return; }
    createMutation.mutate({
      icon: newItem.icon,
      label: newItem.label.trim(),
      href: newItem.href.trim() || undefined,
    });
  };

  const handleDelete = (id: number, label: string) => {
    if (!confirm(`"${label}" 항목을 삭제하시겠습니까?`)) return;
    deleteMutation.mutate({ id });
  };

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-[420px] sm:w-[480px] overflow-y-auto bg-white" style={{ top: "144px", height: "calc(100vh - 144px)" }}>
        <SheetHeader className="mb-4">
          <SheetTitle>관련 기관 편집</SheetTitle>
          <SheetDescription>홈페이지 하단 관련 기관을 추가, 수정, 삭제할 수 있습니다.</SheetDescription>
        </SheetHeader>

        {/* 새 항목 추가 버튼 */}
        {!showAddForm && (
          <Button
            size="sm"
            className="w-full mb-4 bg-[#1B5E20] hover:bg-[#2E7D32] text-white"
            onClick={() => { setShowAddForm(true); setEditingId(null); }}
          >
            <Plus className="w-4 h-4 mr-1.5" /> 새 항목 추가
          </Button>
        )}

        {/* 새 항목 추가 폼 */}
        {showAddForm && (
          <div className="mb-4 border-2 border-[#1B5E20] rounded-xl p-3 bg-[#F1F8E9] space-y-2">
            <p className="text-xs font-semibold text-[#1B5E20] mb-1">새 항목 추가</p>

            {/* 아이콘 선택 */}
            <div>
              <label className="text-xs text-gray-500 mb-1 block">아이콘 <span className="text-red-400">*</span></label>
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-full bg-white flex items-center justify-center text-[#1B5E20] shrink-0 border border-[#C8E6C9]">
                  {newItem.icon
                    ? <i className={`fas ${newItem.icon} text-sm`}></i>
                    : <span className="text-gray-300 text-xs">?</span>
                  }
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="text-xs h-8 flex-1 bg-white"
                  onClick={() => setShowAddIconPicker((v) => !v)}
                >
                  <Smile className="w-3.5 h-3.5 mr-1.5" />
                  {showAddIconPicker ? "닫기" : "아이콘 선택하기"}
                </Button>
              </div>
              {showAddIconPicker && (
                <div className="mt-2">
                  <IconPicker
                    value={newItem.icon}
                    onChange={(cls) => { setNewItem({ ...newItem, icon: cls }); setShowAddIconPicker(false); }}
                    onClose={() => setShowAddIconPicker(false)}
                  />
                </div>
              )}
            </div>

            {/* 기관 이름 */}
            <div>
              <label className="text-xs text-gray-500 mb-1 block">기관 이름 <span className="text-red-400">*</span></label>
              <Input
                value={newItem.label}
                onChange={(e) => setNewItem({ ...newItem, label: e.target.value })}
                placeholder="예: 기쁨의복지재단"
                className="text-sm bg-white"
              />
            </div>

            {/* 링크 URL */}
            <div>
              <label className="text-xs text-gray-500 mb-1 block">링크 URL</label>
              <Input
                value={newItem.href}
                onChange={(e) => setNewItem({ ...newItem, href: e.target.value })}
                placeholder="https://example.com"
                className="text-sm bg-white"
              />
            </div>

            <div className="flex gap-2 pt-1">
              <Button
                size="sm"
                className="bg-[#1B5E20] hover:bg-[#2E7D32] text-white"
                onClick={handleCreate}
                disabled={createMutation.isPending}
              >
                <Check className="w-3 h-3 mr-1" /> {createMutation.isPending ? "추가 중..." : "추가"}
              </Button>
              <Button size="sm" variant="outline" onClick={() => { setShowAddForm(false); setShowAddIconPicker(false); }}>
                <X className="w-3 h-3 mr-1" /> 취소
              </Button>
            </div>
          </div>
        )}

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
                    {/* 아이콘 선택 */}
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">아이콘</label>
                      <div className="flex items-center gap-2">
                        <div className="w-9 h-9 rounded-full bg-[#E8F5E9] flex items-center justify-center text-[#1B5E20] shrink-0 border border-[#C8E6C9]">
                          {editState.icon
                            ? <i className={`fas ${editState.icon} text-sm`}></i>
                            : <span className="text-gray-300 text-xs">?</span>
                          }
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="text-xs h-8 flex-1"
                          onClick={() => setShowEditIconPicker((v) => !v)}
                        >
                          <Smile className="w-3.5 h-3.5 mr-1.5" />
                          {showEditIconPicker ? "닫기" : "아이콘 선택하기"}
                        </Button>
                      </div>
                      {showEditIconPicker && (
                        <div className="mt-2">
                          <IconPicker
                            value={editState.icon}
                            onChange={(cls) => { setEditState({ ...editState, icon: cls }); setShowEditIconPicker(false); }}
                            onClose={() => setShowEditIconPicker(false)}
                          />
                        </div>
                      )}
                    </div>

                    {/* 기관 이름 */}
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">기관 이름</label>
                      <Input
                        value={editState.label}
                        onChange={(e) => setEditState({ ...editState, label: e.target.value })}
                        placeholder="기관 이름"
                        className="text-sm"
                      />
                    </div>

                    {/* 링크 URL */}
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
                      <Button size="sm" variant="outline" onClick={() => { setEditingId(null); setShowEditIconPicker(false); }}>
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
                      <button
                        title="삭제"
                        onClick={() => handleDelete(affiliate.id, affiliate.label)}
                        disabled={deleteMutation.isPending}
                        className="p-1.5 rounded hover:bg-red-50 text-red-400 hover:text-red-600 transition-colors disabled:opacity-40"
                      >
                        <Trash2 className="w-4 h-4" />
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
