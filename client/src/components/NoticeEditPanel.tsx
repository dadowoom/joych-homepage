/**
 * 교회 소식 편집 슬라이드 패널
 * - 관리자 로그인 시 홈페이지 우측에서 슬라이드로 열림
 * - 소식 목록 조회, 추가, 수정, 삭제, 게시/숨기기 기능
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
import { Pencil, Trash2, Plus, Check, X, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

type NoticeRow = {
  id: number;
  category: string;
  title: string;
  content: string | null;
  thumbnailUrl: string | null;
  isPublished: boolean;
  isPinned: boolean;
};

type EditState = {
  category: string;
  title: string;
  content: string;
  thumbnailUrl: string;
};

interface NoticeEditPanelProps {
  open: boolean;
  onClose: () => void;
}

export default function NoticeEditPanel({ open, onClose }: NoticeEditPanelProps) {
  const utils = trpc.useUtils();

  // 소식 목록 불러오기
  const { data: notices, isLoading } = trpc.cms.notices.list.useQuery(undefined, {
    enabled: open,
  });

  // 편집 상태
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editState, setEditState] = useState<EditState>({ category: "", title: "", content: "", thumbnailUrl: "" });

  // 새 소식 추가 상태
  const [isAdding, setIsAdding] = useState(false);
  const [newState, setNewState] = useState<EditState>({ category: "공지", title: "", content: "", thumbnailUrl: "" });

  // 수정 mutation
  const updateMutation = trpc.cms.notices.update.useMutation({
    onSuccess: () => {
      toast.success("소식이 수정됐습니다.");
      setEditingId(null);
      utils.cms.notices.list.invalidate();
      utils.home.notices.invalidate();
    },
    onError: (e) => toast.error("수정 실패: " + e.message),
  });

  // 추가 mutation
  const createMutation = trpc.cms.notices.create.useMutation({
    onSuccess: () => {
      toast.success("새 소식이 추가됐습니다.");
      setIsAdding(false);
      setNewState({ category: "공지", title: "", content: "", thumbnailUrl: "" });
      utils.cms.notices.list.invalidate();
      utils.home.notices.invalidate();
    },
    onError: (e) => toast.error("추가 실패: " + e.message),
  });

  // 삭제 mutation
  const deleteMutation = trpc.cms.notices.delete.useMutation({
    onSuccess: () => {
      toast.success("소식이 삭제됐습니다.");
      utils.cms.notices.list.invalidate();
      utils.home.notices.invalidate();
    },
    onError: (e) => toast.error("삭제 실패: " + e.message),
  });

  // 게시/숨기기 mutation
  const toggleMutation = trpc.cms.notices.update.useMutation({
    onSuccess: () => {
      utils.cms.notices.list.invalidate();
      utils.home.notices.invalidate();
    },
    onError: (e) => toast.error("변경 실패: " + e.message),
  });

  const startEdit = (notice: NoticeRow) => {
    setEditingId(notice.id);
    setEditState({
      category: notice.category,
      title: notice.title,
      content: notice.content ?? "",
      thumbnailUrl: notice.thumbnailUrl ?? "",
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const saveEdit = () => {
    if (!editingId) return;
    updateMutation.mutate({
      id: editingId,
      category: editState.category,
      title: editState.title,
      content: editState.content || undefined,
      thumbnailUrl: editState.thumbnailUrl || undefined,
    });
  };

  const handleCreate = () => {
    if (!newState.title.trim()) {
      toast.error("제목을 입력해주세요.");
      return;
    }
    createMutation.mutate({
      category: newState.category || "공지",
      title: newState.title,
      content: newState.content || undefined,
      thumbnailUrl: newState.thumbnailUrl || undefined,
      isPublished: true,
      isPinned: false,
    });
  };

  const CATEGORIES = ["공지", "행사", "찬양", "선교", "기타"];

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-[420px] sm:w-[480px] overflow-y-auto bg-white" style={{ top: "144px", height: "calc(100vh - 144px)" }}>
        <SheetHeader className="mb-4">
          <SheetTitle>교회 소식 편집</SheetTitle>
          <SheetDescription>소식을 추가, 수정, 삭제하거나 게시 여부를 변경할 수 있습니다.</SheetDescription>
        </SheetHeader>

        {/* 새 소식 추가 버튼 */}
        {!isAdding && (
          <Button
            size="sm"
            className="mb-4 w-full bg-[#1B5E20] hover:bg-[#2E7D32] text-white"
            onClick={() => setIsAdding(true)}
          >
            <Plus className="w-4 h-4 mr-1" /> 새 소식 추가
          </Button>
        )}

        {/* 새 소식 추가 폼 */}
        {isAdding && (
          <div className="mb-4 p-3 border-2 border-[#1B5E20] rounded-lg bg-green-50 space-y-2">
            <p className="text-xs font-semibold text-[#1B5E20] mb-2">새 소식 추가</p>
            <div className="flex gap-2">
              <select
                value={newState.category}
                onChange={(e) => setNewState({ ...newState, category: e.target.value })}
                className="text-xs border rounded px-2 py-1 bg-white"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <Input
              placeholder="제목"
              value={newState.title}
              onChange={(e) => setNewState({ ...newState, title: e.target.value })}
              className="text-sm"
            />
            <Input
              placeholder="내용 (선택)"
              value={newState.content}
              onChange={(e) => setNewState({ ...newState, content: e.target.value })}
              className="text-sm"
            />
            <Input
              placeholder="썸네일 이미지 URL (선택)"
              value={newState.thumbnailUrl}
              onChange={(e) => setNewState({ ...newState, thumbnailUrl: e.target.value })}
              className="text-sm"
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                className="bg-[#1B5E20] hover:bg-[#2E7D32] text-white"
                onClick={handleCreate}
                disabled={createMutation.isPending}
              >
                <Check className="w-3 h-3 mr-1" /> {createMutation.isPending ? "추가 중..." : "추가"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => { setIsAdding(false); setNewState({ category: "공지", title: "", content: "", thumbnailUrl: "" }); }}
              >
                <X className="w-3 h-3 mr-1" /> 취소
              </Button>
            </div>
          </div>
        )}

        {/* 소식 목록 */}
        {isLoading ? (
          <div className="text-center text-gray-400 py-8 text-sm">불러오는 중...</div>
        ) : (
          <div className="space-y-2">
            {(notices ?? []).map((notice) => (
              <div
                key={notice.id}
                className={`border rounded-lg p-3 ${!notice.isPublished ? "opacity-50 bg-gray-50" : "bg-white"}`}
              >
                {editingId === notice.id ? (
                  /* 편집 모드 */
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <select
                        value={editState.category}
                        onChange={(e) => setEditState({ ...editState, category: e.target.value })}
                        className="text-xs border rounded px-2 py-1 bg-white"
                      >
                        {CATEGORIES.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                    <Input
                      value={editState.title}
                      onChange={(e) => setEditState({ ...editState, title: e.target.value })}
                      placeholder="제목"
                      className="text-sm"
                    />
                    <Input
                      value={editState.content}
                      onChange={(e) => setEditState({ ...editState, content: e.target.value })}
                      placeholder="내용 (선택)"
                      className="text-sm"
                    />
                    <Input
                      value={editState.thumbnailUrl}
                      onChange={(e) => setEditState({ ...editState, thumbnailUrl: e.target.value })}
                      placeholder="썸네일 URL (선택)"
                      className="text-sm"
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="bg-[#1B5E20] hover:bg-[#2E7D32] text-white"
                        onClick={saveEdit}
                        disabled={updateMutation.isPending}
                      >
                        <Check className="w-3 h-3 mr-1" /> {updateMutation.isPending ? "저장 중..." : "저장"}
                      </Button>
                      <Button size="sm" variant="outline" onClick={cancelEdit}>
                        <X className="w-3 h-3 mr-1" /> 취소
                      </Button>
                    </div>
                  </div>
                ) : (
                  /* 보기 모드 */
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-medium">
                          {notice.category}
                        </span>
                        {!notice.isPublished && (
                          <span className="text-xs text-gray-400">(숨김)</span>
                        )}
                      </div>
                      <p className="text-sm font-medium text-gray-800 truncate">{notice.title}</p>
                      {notice.content && (
                        <p className="text-xs text-gray-500 truncate mt-0.5">{notice.content}</p>
                      )}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      {/* 게시/숨기기 */}
                      <button
                        title={notice.isPublished ? "숨기기" : "게시하기"}
                        onClick={() => toggleMutation.mutate({ id: notice.id, isPublished: !notice.isPublished })}
                        className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
                      >
                        {notice.isPublished ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                      </button>
                      {/* 수정 */}
                      <button
                        title="수정"
                        onClick={() => startEdit(notice)}
                        className="p-1.5 rounded hover:bg-blue-50 text-blue-500 hover:text-blue-700 transition-colors"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      {/* 삭제 */}
                      <button
                        title="삭제"
                        onClick={() => {
                          if (confirm(`"${notice.title}" 소식을 삭제하시겠습니까?`)) {
                            deleteMutation.mutate({ id: notice.id });
                          }
                        }}
                        className="p-1.5 rounded hover:bg-red-50 text-red-400 hover:text-red-600 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
            {(notices ?? []).length === 0 && (
              <div className="text-center text-gray-400 py-8 text-sm">등록된 소식이 없습니다.</div>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
