/**
 * 메뉴 편집 슬라이드 패널
 * - 관리자 로그인 시 홈페이지 우측에서 슬라이드로 열림
 * - dnd-kit으로 드래그 순서 변경
 * - 이름/링크 수정, 추가, 삭제 가능
 * - 저장 즉시 GNB에 실시간 반영
 */
import { useState, useEffect } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
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
import { GripVertical, Pencil, Trash2, Plus, Check, X, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

type MenuRow = {
  id: number;
  label: string;
  href: string | null;
  sortOrder: number;
  isVisible: boolean;
};

// 드래그 가능한 메뉴 아이템
function SortableMenuItem({
  menu,
  onEdit,
  onDelete,
  onToggleVisible,
}: {
  menu: MenuRow;
  onEdit: (menu: MenuRow) => void;
  onDelete: (id: number) => void;
  onToggleVisible: (id: number, visible: boolean) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: menu.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 p-2 rounded-lg border bg-white ${
        isDragging ? "shadow-lg border-green-400" : "border-gray-200"
      } ${!menu.isVisible ? "opacity-50" : ""}`}
    >
      {/* 드래그 핸들 */}
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 p-1 touch-none"
        title="드래그해서 순서 변경"
      >
        <GripVertical size={16} />
      </button>

      {/* 메뉴 이름 */}
      <span className={`flex-1 text-sm font-medium ${!menu.isVisible ? "line-through text-gray-400" : "text-gray-800"}`}>
        {menu.label}
      </span>

      {/* 링크 */}
      {menu.href && (
        <span className="text-xs text-gray-400 truncate max-w-[80px]">{menu.href}</span>
      )}

      {/* 액션 버튼들 */}
      <button
        onClick={() => onToggleVisible(menu.id, !menu.isVisible)}
        className="p-1 text-gray-400 hover:text-gray-600"
        title={menu.isVisible ? "숨기기" : "표시"}
      >
        {menu.isVisible ? <Eye size={14} /> : <EyeOff size={14} />}
      </button>
      <button
        onClick={() => onEdit(menu)}
        className="p-1 text-blue-500 hover:text-blue-700"
        title="수정"
      >
        <Pencil size={14} />
      </button>
      <button
        onClick={() => onDelete(menu.id)}
        className="p-1 text-red-400 hover:text-red-600"
        title="삭제"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}

// 메뉴 수정 폼
function EditMenuForm({
  menu,
  onSave,
  onCancel,
}: {
  menu: MenuRow;
  onSave: (id: number, label: string, href: string | null) => void;
  onCancel: () => void;
}) {
  const [label, setLabel] = useState(menu.label);
  const [href, setHref] = useState(menu.href ?? "");

  return (
    <div className="p-3 rounded-lg border-2 border-blue-300 bg-blue-50 space-y-2">
      <div>
        <label className="text-xs text-gray-600 font-medium">메뉴 이름</label>
        <Input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="mt-1 h-8 text-sm"
          placeholder="메뉴 이름 입력"
          autoFocus
        />
      </div>
      <div>
        <label className="text-xs text-gray-600 font-medium">링크 (선택)</label>
        <Input
          value={href}
          onChange={(e) => setHref(e.target.value)}
          className="mt-1 h-8 text-sm"
          placeholder="/about 또는 비워두기"
        />
      </div>
      <div className="flex gap-2">
        <Button
          size="sm"
          className="h-7 text-xs bg-[#1B5E20] hover:bg-[#2E7D32]"
          onClick={() => onSave(menu.id, label, href || null)}
        >
          <Check size={12} className="mr-1" /> 저장
        </Button>
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onCancel}>
          <X size={12} className="mr-1" /> 취소
        </Button>
      </div>
    </div>
  );
}

// 새 메뉴 추가 폼
function AddMenuForm({
  onAdd,
  onCancel,
}: {
  onAdd: (label: string, href: string | null) => void;
  onCancel: () => void;
}) {
  const [label, setLabel] = useState("");
  const [href, setHref] = useState("");

  return (
    <div className="p-3 rounded-lg border-2 border-green-300 bg-green-50 space-y-2">
      <p className="text-xs font-semibold text-green-700">새 메뉴 추가</p>
      <div>
        <label className="text-xs text-gray-600 font-medium">메뉴 이름</label>
        <Input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="mt-1 h-8 text-sm"
          placeholder="예: 소식"
          autoFocus
        />
      </div>
      <div>
        <label className="text-xs text-gray-600 font-medium">링크 (선택)</label>
        <Input
          value={href}
          onChange={(e) => setHref(e.target.value)}
          className="mt-1 h-8 text-sm"
          placeholder="/news"
        />
      </div>
      <div className="flex gap-2">
        <Button
          size="sm"
          className="h-7 text-xs bg-[#1B5E20] hover:bg-[#2E7D32]"
          onClick={() => {
            if (label.trim()) onAdd(label.trim(), href || null);
          }}
          disabled={!label.trim()}
        >
          <Plus size={12} className="mr-1" /> 추가
        </Button>
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onCancel}>
          취소
        </Button>
      </div>
    </div>
  );
}

// ─── 메인 패널 컴포넌트 ───────────────────────────────
export default function MenuEditPanel({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const utils = trpc.useUtils();

  // 서버에서 메뉴 목록 가져오기
  const { data: serverMenus, isLoading } = trpc.cms.menus.list.useQuery(undefined, {
    enabled: open,
  });

  // 로컬 순서 상태 (드래그용)
  const [localMenus, setLocalMenus] = useState<MenuRow[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [isSavingOrder, setIsSavingOrder] = useState(false);

  // 서버 데이터 → 로컬 상태 동기화
  useEffect(() => {
    if (serverMenus) {
      setLocalMenus(
        [...serverMenus]
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((m) => ({
            id: m.id,
            label: m.label,
            href: m.href,
            sortOrder: m.sortOrder,
            isVisible: m.isVisible,
          }))
      );
    }
  }, [serverMenus]);

  // Mutations
  const updateMenu = trpc.cms.menus.update.useMutation({
    onSuccess: () => {
      utils.home.menus.invalidate();
      utils.cms.menus.list.invalidate();
      toast.success("메뉴가 업데이트뤌습니다.");
    },
    onError: (e) => toast.error("저장 실패: " + e.message),
  });

  const createMenu = trpc.cms.menus.create.useMutation({
    onSuccess: () => {
      utils.home.menus.invalidate();
      utils.cms.menus.list.invalidate();
      setShowAddForm(false);
      toast.success("새 메뉴가 추가뤌습니다.");
    },
    onError: (e) => toast.error("추가 실패: " + e.message),
  });

  const deleteMenu = trpc.cms.menus.delete.useMutation({
    onSuccess: () => {
      utils.home.menus.invalidate();
      utils.cms.menus.list.invalidate();
      toast.success("메뉴가 삭제뤌습니다.");
    },
    onError: (e) => toast.error("삭제 실패: " + e.message),
  });

  const reorderMenus = trpc.cms.menus.reorder.useMutation({
    onSuccess: () => {
      utils.home.menus.invalidate();
      utils.cms.menus.list.invalidate();
    },
    onError: (e) => toast.error("순서 저장 실패: " + e.message),
  });

  // dnd-kit 센서
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // 드래그 완료 시 순서 변경
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = localMenus.findIndex((m) => m.id === active.id);
    const newIndex = localMenus.findIndex((m) => m.id === over.id);
    const reordered = arrayMove(localMenus, oldIndex, newIndex).map((m, i) => ({
      ...m,
      sortOrder: i + 1,
    }));
    setLocalMenus(reordered);

    // DB에 순서 저장
    setIsSavingOrder(true);
    try {
      await reorderMenus.mutateAsync(
        reordered.map((m) => ({ id: m.id, sortOrder: m.sortOrder }))
      );
      toast.success("순서가 저장뤌습니다.");
    } finally {
      setIsSavingOrder(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-[360px] sm:w-[400px] overflow-y-auto p-4">
        <SheetHeader className="mb-4">
          <SheetTitle className="text-[#1B5E20] flex items-center gap-2">
            메뉴 편집
          </SheetTitle>
          <SheetDescription className="text-xs text-gray-500">
            드래그로 순서를 바꾸고, ✏️ 버튼으로 이름·링크를 수정하세요.
            변경사항은 즉시 홈페이지에 반영됩니다.
          </SheetDescription>
        </SheetHeader>

        {isLoading ? (
          <div className="text-center py-8 text-gray-400 text-sm">불러오는 중...</div>
        ) : (
          <div className="space-y-2">
            {isSavingOrder && (
              <p className="text-xs text-center text-green-600 animate-pulse">순서 저장 중...</p>
            )}

            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={localMenus.map((m) => m.id)}
                strategy={verticalListSortingStrategy}
              >
                {localMenus.map((menu) => (
                  <div key={menu.id}>
                    {editingId === menu.id ? (
                      <EditMenuForm
                        menu={menu}
                        onSave={(id, label, href) => {
                          updateMenu.mutate({ id, label, href });
                          setLocalMenus((prev) =>
                            prev.map((m) => (m.id === id ? { ...m, label, href } : m))
                          );
                          setEditingId(null);
                        }}
                        onCancel={() => setEditingId(null)}
                      />
                    ) : (
                      <SortableMenuItem
                        menu={menu}
                        onEdit={(m) => setEditingId(m.id)}
                        onDelete={(id) => {
                          if (confirm(`"${menu.label}" 메뉴를 삭제하시겠습니까?`)) {
                            deleteMenu.mutate({ id });
                            setLocalMenus((prev) => prev.filter((m) => m.id !== id));
                          }
                        }}
                        onToggleVisible={(id, visible) => {
                          updateMenu.mutate({ id, isVisible: visible });
                          setLocalMenus((prev) =>
                            prev.map((m) => (m.id === id ? { ...m, isVisible: visible } : m))
                          );
                        }}
                      />
                    )}
                  </div>
                ))}
              </SortableContext>
            </DndContext>

            {/* 새 메뉴 추가 */}
            {showAddForm ? (
              <AddMenuForm
                onAdd={(label, href) => {
                  createMenu.mutate({
                    label,
                    href,
                    sortOrder: localMenus.length + 1,
                  });
                }}
                onCancel={() => setShowAddForm(false)}
              />
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="w-full mt-2 border-dashed border-green-400 text-green-700 hover:bg-green-50"
                onClick={() => setShowAddForm(true)}
              >
                <Plus size={14} className="mr-1" /> 메뉴 추가
              </Button>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
