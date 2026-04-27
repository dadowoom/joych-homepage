/**
 * 퀵메뉴 편집 슬라이드 패널
 * - 관리자 로그인 시 홈페이지 우측에서 슬라이드로 열림
 * - 퀵메뉴 항목의 추가, 수정, 삭제, 표시/숨기기 기능
 * - 아이콘은 IconPicker로 시각적 선택 가능
 * - 드래그 앤 드롭으로 순서 변경 가능
 */
import { useState } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
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
import { Pencil, Check, X, Eye, EyeOff, Smile, Plus, Trash2, GripVertical } from "lucide-react";
import { toast } from "sonner";
import IconPicker from "@/components/IconPicker";

type QuickMenuRow = {
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

interface QuickMenuEditPanelProps {
  open: boolean;
  onClose: () => void;
}

// ─── 드래그 가능한 개별 항목 컴포넌트 ──────────────────────────────────────────
function SortableMenuItem({
  menu,
  editingId,
  editState,
  setEditState,
  showEditIconPicker,
  setShowEditIconPicker,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onToggle,
  onDelete,
  updatePending,
  deletePending,
}: {
  menu: QuickMenuRow;
  editingId: number | null;
  editState: EditState;
  setEditState: (s: EditState) => void;
  showEditIconPicker: boolean;
  setShowEditIconPicker: (v: boolean) => void;
  onStartEdit: (menu: QuickMenuRow) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
  updatePending: boolean;
  deletePending: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: menu.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  const isEditing = editingId === menu.id;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`border rounded-lg p-3 ${!menu.isVisible ? "opacity-50 bg-gray-50" : "bg-white"}`}
    >
      {isEditing ? (
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
                onClick={() => setShowEditIconPicker(!showEditIconPicker)}
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

          {/* 메뉴 이름 */}
          <div>
            <label className="text-xs text-gray-500 mb-1 block">메뉴 이름</label>
            <Input
              value={editState.label}
              onChange={(e) => setEditState({ ...editState, label: e.target.value })}
              placeholder="메뉴 이름"
              className="text-sm"
            />
          </div>

          {/* 링크 URL */}
          <div>
            <label className="text-xs text-gray-500 mb-1 block">링크 URL</label>
            <Input
              value={editState.href}
              onChange={(e) => setEditState({ ...editState, href: e.target.value })}
              placeholder="/about/pastor"
              className="text-sm"
            />
          </div>

          <div className="flex gap-2 pt-1">
            <Button
              size="sm"
              className="bg-[#1B5E20] hover:bg-[#2E7D32] text-white"
              onClick={onSaveEdit}
              disabled={updatePending}
            >
              <Check className="w-3 h-3 mr-1" /> {updatePending ? "저장 중..." : "저장"}
            </Button>
            <Button size="sm" variant="outline" onClick={onCancelEdit}>
              <X className="w-3 h-3 mr-1" /> 취소
            </Button>
          </div>
        </div>
      ) : (
        /* 보기 모드 */
        <div className="flex items-center gap-2">
          {/* 드래그 핸들 */}
          <button
            {...attributes}
            {...listeners}
            className="p-1 text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing shrink-0 touch-none"
            title="드래그하여 순서 변경"
          >
            <GripVertical className="w-4 h-4" />
          </button>
          <div className="w-8 h-8 rounded-full bg-[#E8F5E9] flex items-center justify-center text-[#1B5E20] shrink-0">
            <i className={`fas ${menu.icon} text-sm`}></i>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-800">{menu.label}</p>
            {menu.href && (
              <p className="text-xs text-gray-400 truncate">{menu.href}</p>
            )}
          </div>
          <div className="flex gap-1 shrink-0">
            <button
              title={menu.isVisible ? "숨기기" : "표시하기"}
              onClick={onToggle}
              className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
            >
              {menu.isVisible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            </button>
            <button
              title="수정"
              onClick={() => onStartEdit(menu)}
              className="p-1.5 rounded hover:bg-blue-50 text-blue-500 hover:text-blue-700 transition-colors"
            >
              <Pencil className="w-4 h-4" />
            </button>
            <button
              title="삭제"
              onClick={onDelete}
              disabled={deletePending}
              className="p-1.5 rounded hover:bg-red-50 text-red-400 hover:text-red-600 transition-colors disabled:opacity-40"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── 메인 패널 컴포넌트 ──────────────────────────────────────────────────────
export default function QuickMenuEditPanel({ open, onClose }: QuickMenuEditPanelProps) {
  const utils = trpc.useUtils();

  const { data: menus, isLoading } = trpc.cms.content.quickMenus.list.useQuery(undefined, {
    enabled: open,
  });

  // 로컬 순서 상태 (드래그 중 즉시 반영)
  const [localOrder, setLocalOrder] = useState<QuickMenuRow[] | null>(null);
  const displayMenus = localOrder ?? (menus ?? []);

  // 수정 상태
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editState, setEditState] = useState<EditState>({ icon: "", label: "", href: "" });
  const [showEditIconPicker, setShowEditIconPicker] = useState(false);

  // 새 항목 추가 상태
  const [showAddForm, setShowAddForm] = useState(false);
  const [newItem, setNewItem] = useState<EditState>({ icon: "", label: "", href: "" });
  const [showAddIconPicker, setShowAddIconPicker] = useState(false);

  // 드래그 앤 드롭 센서
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const invalidate = () => {
    utils.cms.content.quickMenus.list.invalidate();
    utils.home.quickMenus.invalidate();
  };

  const updateMutation = trpc.cms.content.quickMenus.update.useMutation({
    onSuccess: () => {
      toast.success("퀵메뉴가 수정됐습니다.");
      setEditingId(null);
      setShowEditIconPicker(false);
      invalidate();
    },
    onError: (e) => toast.error("수정 실패: " + e.message),
  });

  const createMutation = trpc.cms.content.quickMenus.create.useMutation({
    onSuccess: () => {
      toast.success("퀵메뉴 항목이 추가됐습니다.");
      setShowAddForm(false);
      setNewItem({ icon: "", label: "", href: "" });
      setShowAddIconPicker(false);
      setLocalOrder(null);
      invalidate();
    },
    onError: (e) => toast.error("추가 실패: " + e.message),
  });

  const deleteMutation = trpc.cms.content.quickMenus.delete.useMutation({
    onSuccess: () => {
      toast.success("퀵메뉴 항목이 삭제됐습니다.");
      setLocalOrder(null);
      invalidate();
    },
    onError: (e) => toast.error("삭제 실패: " + e.message),
  });

  const toggleMutation = trpc.cms.content.quickMenus.update.useMutation({
    onSuccess: () => invalidate(),
    onError: (e) => toast.error("변경 실패: " + e.message),
  });

  const reorderMutation = trpc.cms.content.quickMenus.reorder.useMutation({
    onSuccess: () => {
      toast.success("순서가 저장됐습니다.");
      setLocalOrder(null);
      invalidate();
    },
    onError: (e) => {
      toast.error("순서 저장 실패: " + e.message);
      setLocalOrder(null);
    },
  });

  const startEdit = (menu: QuickMenuRow) => {
    setEditingId(menu.id);
    setShowEditIconPicker(false);
    setShowAddForm(false);
    setEditState({ icon: menu.icon, label: menu.label, href: menu.href ?? "" });
  };

  const saveEdit = () => {
    if (!editingId) return;
    updateMutation.mutate({
      id: editingId,
      icon: editState.icon || undefined,
      label: editState.label || undefined,
      href: editState.href || null,
    });
  };

  const handleCreate = () => {
    if (!newItem.icon) { toast.error("아이콘을 선택해 주세요."); return; }
    if (!newItem.label.trim()) { toast.error("메뉴 이름을 입력해 주세요."); return; }
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

  // 드래그 종료 시 순서 업데이트
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const current = localOrder ?? (menus ?? []);
    const oldIndex = current.findIndex((m) => m.id === active.id);
    const newIndex = current.findIndex((m) => m.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(current, oldIndex, newIndex);
    setLocalOrder(reordered);

    // 서버에 새 순서 저장
    reorderMutation.mutate(
      reordered.map((m, idx) => ({ id: m.id, sortOrder: idx + 1 }))
    );
  };

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="right"
        className="w-[420px] sm:w-[480px] overflow-y-auto bg-white"
        style={{ top: "144px", height: "calc(100vh - 144px)" }}
      >
        <SheetHeader className="mb-4">
          <SheetTitle>퀵메뉴 편집</SheetTitle>
          <SheetDescription>
            항목을 추가·수정·삭제하거나, 왼쪽 핸들(<GripVertical className="inline w-3 h-3" />)을 드래그해 순서를 바꿀 수 있습니다.
          </SheetDescription>
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

            {/* 메뉴 이름 */}
            <div>
              <label className="text-xs text-gray-500 mb-1 block">메뉴 이름 <span className="text-red-400">*</span></label>
              <Input
                value={newItem.label}
                onChange={(e) => setNewItem({ ...newItem, label: e.target.value })}
                placeholder="예: 새가족 안내"
                className="text-sm bg-white"
              />
            </div>

            {/* 링크 URL */}
            <div>
              <label className="text-xs text-gray-500 mb-1 block">링크 URL</label>
              <Input
                value={newItem.href}
                onChange={(e) => setNewItem({ ...newItem, href: e.target.value })}
                placeholder="/about/new-member"
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

        {/* 드래그 안내 */}
        {!isLoading && displayMenus.length > 1 && (
          <p className="text-xs text-gray-400 mb-2 flex items-center gap-1">
            <GripVertical className="w-3 h-3" /> 왼쪽 핸들을 드래그하면 순서를 바꿀 수 있습니다.
          </p>
        )}

        {isLoading ? (
          <div className="text-center text-gray-400 py-8 text-sm">불러오는 중...</div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={displayMenus.map((m) => m.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2">
                {displayMenus.map((menu) => (
                  <SortableMenuItem
                    key={menu.id}
                    menu={menu}
                    editingId={editingId}
                    editState={editState}
                    setEditState={setEditState}
                    showEditIconPicker={showEditIconPicker}
                    setShowEditIconPicker={setShowEditIconPicker}
                    onStartEdit={startEdit}
                    onSaveEdit={saveEdit}
                    onCancelEdit={() => { setEditingId(null); setShowEditIconPicker(false); }}
                    onToggle={() => toggleMutation.mutate({ id: menu.id, isVisible: !menu.isVisible })}
                    onDelete={() => handleDelete(menu.id, menu.label)}
                    updatePending={updateMutation.isPending}
                    deletePending={deleteMutation.isPending}
                  />
                ))}
                {displayMenus.length === 0 && (
                  <div className="text-center text-gray-400 py-8 text-sm">등록된 퀵메뉴가 없습니다.</div>
                )}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </SheetContent>
    </Sheet>
  );
}
