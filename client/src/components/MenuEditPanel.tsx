/**
 * 메뉴 편집 패널 — 3컬럼 나란히 배치
 * 왼쪽: 1단 상위 메뉴 | 가운데: 2단 하위 메뉴 | 오른쪽: 3단 세부 메뉴
 * 각 컬럼은 독립적으로 스크롤 가능, 패널 높이 고정
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
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import {
  GripVertical, Pencil, Trash2, Plus, Check, X,
  Eye, EyeOff, ChevronRight,
  Image, LayoutGrid, FileText, Youtube, Type
} from "lucide-react";
import { toast } from "sonner";

type PageType = "image" | "gallery" | "board" | "youtube" | "editor";

const PAGE_TYPE_OPTIONS: { value: PageType; label: string; icon: React.ReactNode }[] = [
  { value: "image",   label: "이미지 전체화면", icon: <Image size={12} /> },
  { value: "gallery", label: "갤러리",          icon: <LayoutGrid size={12} /> },
  { value: "board",   label: "게시판",           icon: <FileText size={12} /> },
  { value: "youtube", label: "유튜브 목록",      icon: <Youtube size={12} /> },
  { value: "editor",  label: "텍스트+이미지",    icon: <Type size={12} /> },
];

type MenuSubItemRow = {
  id: number;
  menuItemId: number;
  label: string;
  href: string | null;
  sortOrder: number;
  isVisible: boolean;
  pageType: PageType;
  pageImageUrl: string | null;
};

type MenuItemRow = {
  id: number;
  menuId: number;
  label: string;
  href: string | null;
  sortOrder: number;
  isVisible: boolean;
  pageType: PageType;
  pageImageUrl: string | null;
  subItems: MenuSubItemRow[];
};

type MenuRow = {
  id: number;
  label: string;
  href: string | null;
  sortOrder: number;
  isVisible: boolean;
  items: MenuItemRow[];
};

// ─── 인라인 수정 폼 (작은 팝업 형태) ─────────────────
function InlineEditForm({
  initialLabel,
  initialHref,
  initialPageType,
  showPageType,
  colorClass,
  onSave,
  onCancel,
}: {
  initialLabel: string;
  initialHref: string;
  initialPageType?: PageType;
  showPageType?: boolean;
  colorClass: string;
  onSave: (label: string, href: string, pageType?: PageType) => void;
  onCancel: () => void;
}) {
  const [label, setLabel] = useState(initialLabel);
  const [href, setHref] = useState(initialHref);
  const [pageType, setPageType] = useState<PageType>(initialPageType ?? "image");

  return (
    <div className={`p-2 rounded-lg border-2 ${colorClass} space-y-1.5 mt-1`}>
      <Input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        className="h-7 text-xs"
        placeholder="메뉴 이름"
        autoFocus
      />
      <Input
        value={href}
        onChange={(e) => setHref(e.target.value)}
        className="h-7 text-xs"
        placeholder="/경로 (선택)"
      />
      {showPageType && (
        <select
          value={pageType}
          onChange={(e) => setPageType(e.target.value as PageType)}
          className="w-full h-7 text-xs border border-gray-200 rounded px-1 bg-white"
        >
          {PAGE_TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      )}
      <div className="flex gap-1">
        <Button
          size="sm"
          className="h-6 text-[10px] px-2 bg-[#1B5E20] hover:bg-[#2E7D32]"
          onClick={() => { if (label.trim()) onSave(label.trim(), href, showPageType ? pageType : undefined); }}
          disabled={!label.trim()}
        >
          <Check size={10} className="mr-0.5" /> 저장
        </Button>
        <Button size="sm" variant="outline" className="h-6 text-[10px] px-2" onClick={onCancel}>
          <X size={10} className="mr-0.5" /> 취소
        </Button>
      </div>
    </div>
  );
}

// ─── 1단 메뉴 행 (드래그 가능) ─────────────────────
function SortableMenuRow({
  menu,
  isSelected,
  onSelect,
  onEdit,
  onDelete,
  onToggleVisible,
}: {
  menu: MenuRow;
  isSelected: boolean;
  onSelect: (id: number) => void;
  onEdit: (menu: MenuRow) => void;
  onDelete: (id: number) => void;
  onToggleVisible: (id: number, visible: boolean) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: menu.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <div
        className={`flex items-center gap-1 px-2 py-2 rounded-lg cursor-pointer transition-colors border ${
          isSelected
            ? "bg-[#1B5E20] text-white border-[#1B5E20]"
            : "bg-white border-gray-200 hover:border-[#1B5E20] hover:bg-green-50"
        } ${!menu.isVisible ? "opacity-50" : ""}`}
        onClick={() => onSelect(menu.id)}
      >
        <button
          {...attributes}
          {...listeners}
          className={`p-0.5 touch-none ${isSelected ? "text-white/60 hover:text-white" : "text-gray-300 hover:text-gray-500"}`}
          onClick={(e) => e.stopPropagation()}
          title="드래그해서 순서 변경"
        >
          <GripVertical size={14} />
        </button>
        <span className={`flex-1 text-sm font-medium min-w-0 ${!menu.isVisible ? "line-through" : ""}`} style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
          {menu.label}
        </span>
        {menu.items.length > 0 && (
          <span className={`text-[10px] px-1 rounded ${isSelected ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500"}`}>
            {menu.items.length}
          </span>
        )}
        <ChevronRight size={12} className={isSelected ? "text-white/70" : "text-gray-300"} />
        <button
          onClick={(e) => { e.stopPropagation(); onToggleVisible(menu.id, !menu.isVisible); }}
          className={`p-0.5 ${isSelected ? "text-white/70 hover:text-white" : "text-gray-300 hover:text-gray-600"}`}
          title={menu.isVisible ? "숨기기" : "표시"}
        >
          {menu.isVisible ? <Eye size={12} /> : <EyeOff size={12} />}
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onEdit(menu); }}
          className={`p-0.5 ${isSelected ? "text-white/70 hover:text-white" : "text-blue-300 hover:text-blue-600"}`}
          title="수정"
        >
          <Pencil size={12} />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(menu.id); }}
          className={`p-0.5 ${isSelected ? "text-white/70 hover:text-white" : "text-red-300 hover:text-red-500"}`}
          title="삭제"
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
}

// ─── 2단 메뉴 행 ────────────────────────────────────
function SubMenuRow({
  item,
  isSelected,
  onSelect,
  onEdit,
  onDelete,
  onToggleVisible,
}: {
  item: MenuItemRow;
  isSelected: boolean;
  onSelect: (id: number) => void;
  onEdit: (item: MenuItemRow) => void;
  onDelete: (id: number) => void;
  onToggleVisible: (id: number, visible: boolean) => void;
}) {
  const typeOpt = PAGE_TYPE_OPTIONS.find((o) => o.value === item.pageType);

  return (
    <div
      className={`flex items-center gap-1 px-2 py-2 rounded-lg cursor-pointer transition-colors border ${
        isSelected
          ? "bg-blue-600 text-white border-blue-600"
          : "bg-white border-gray-200 hover:border-blue-400 hover:bg-blue-50"
      } ${!item.isVisible ? "opacity-50" : ""}`}
      onClick={() => onSelect(item.id)}
    >
      <span className={`flex-1 text-xs font-medium truncate ${!item.isVisible ? "line-through" : ""}`}>
        {item.label}
      </span>
      {item.subItems.length > 0 && (
        <span className={`text-[10px] px-1 rounded ${isSelected ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500"}`}>
          {item.subItems.length}
        </span>
      )}
      <span className={`flex items-center gap-0.5 text-[9px] px-1 py-0.5 rounded ${isSelected ? "bg-white/20 text-white" : "bg-gray-100 text-gray-400"}`}>
        {typeOpt?.icon}
      </span>
      <ChevronRight size={11} className={isSelected ? "text-white/70" : "text-gray-300"} />
      <button
        onClick={(e) => { e.stopPropagation(); onToggleVisible(item.id, !item.isVisible); }}
        className={`p-0.5 ${isSelected ? "text-white/70 hover:text-white" : "text-gray-300 hover:text-gray-600"}`}
        title={item.isVisible ? "숨기기" : "표시"}
      >
        {item.isVisible ? <Eye size={11} /> : <EyeOff size={11} />}
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); onEdit(item); }}
        className={`p-0.5 ${isSelected ? "text-white/70 hover:text-white" : "text-blue-300 hover:text-blue-600"}`}
        title="수정"
      >
        <Pencil size={11} />
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(item.id); }}
        className={`p-0.5 ${isSelected ? "text-white/70 hover:text-white" : "text-red-300 hover:text-red-500"}`}
        title="삭제"
      >
        <Trash2 size={11} />
      </button>
    </div>
  );
}

// ─── 3단 메뉴 행 ────────────────────────────────────
function SubSubMenuRow({
  item,
  onEdit,
  onDelete,
  onToggleVisible,
}: {
  item: MenuSubItemRow;
  onEdit: (item: MenuSubItemRow) => void;
  onDelete: (id: number) => void;
  onToggleVisible: (id: number, visible: boolean) => void;
}) {
  const typeOpt = PAGE_TYPE_OPTIONS.find((o) => o.value === item.pageType);

  return (
    <div className={`flex items-center gap-1 px-2 py-2 rounded-lg border bg-white border-gray-200 ${!item.isVisible ? "opacity-50" : ""}`}>
      <span className={`flex-1 text-xs font-medium truncate ${!item.isVisible ? "line-through text-gray-400" : "text-gray-700"}`}>
        {item.label}
      </span>
      <span className={`flex items-center gap-0.5 text-[9px] px-1 py-0.5 rounded bg-gray-100 text-gray-400`}>
        {typeOpt?.icon}
      </span>
      <button
        onClick={() => onToggleVisible(item.id, !item.isVisible)}
        className="p-0.5 text-gray-300 hover:text-gray-600"
        title={item.isVisible ? "숨기기" : "표시"}
      >
        {item.isVisible ? <Eye size={11} /> : <EyeOff size={11} />}
      </button>
      <button
        onClick={() => onEdit(item)}
        className="p-0.5 text-blue-300 hover:text-blue-600"
        title="수정"
      >
        <Pencil size={11} />
      </button>
      <button
        onClick={() => onDelete(item.id)}
        className="p-0.5 text-red-300 hover:text-red-500"
        title="삭제"
      >
        <Trash2 size={11} />
      </button>
    </div>
  );
}

// ─── 메인 패널 ───────────────────────────────────────
export default function MenuEditPanel({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const utils = trpc.useUtils();

  const { data: serverMenus, isLoading } = trpc.cms.menus.list.useQuery(undefined, {
    enabled: open,
  });

  const [localMenus, setLocalMenus] = useState<MenuRow[]>([]);
  const [selectedMenuId, setSelectedMenuId] = useState<number | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);

  // 수정 폼 상태
  const [editingMenuId, setEditingMenuId] = useState<number | null>(null);
  const [editingItemId, setEditingItemId] = useState<number | null>(null);
  const [editingSubId, setEditingSubId] = useState<number | null>(null);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showAddItem, setShowAddItem] = useState(false);
  const [showAddSub, setShowAddSub] = useState(false);
  const [isSavingOrder, setIsSavingOrder] = useState(false);

  useEffect(() => {
    if (serverMenus) {
      const sorted = [...serverMenus]
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((m) => ({
          id: m.id,
          label: m.label,
          href: m.href,
          sortOrder: m.sortOrder,
          isVisible: m.isVisible,
          items: [...(m.items ?? [])].sort((a, b) => a.sortOrder - b.sortOrder).map((item) => ({
            ...item,
            pageType: (item.pageType ?? "image") as PageType,
            pageImageUrl: item.pageImageUrl ?? null,
            subItems: [...((item as { subItems?: MenuSubItemRow[] }).subItems ?? [])]
              .sort((a, b) => a.sortOrder - b.sortOrder)
              .map((sub) => ({
                ...sub,
                pageType: (sub.pageType ?? "image") as PageType,
                pageImageUrl: sub.pageImageUrl ?? null,
              })),
          })),
        }));
      setLocalMenus(sorted);
      // 첫 번째 메뉴 자동 선택
      if (sorted.length > 0 && selectedMenuId === null) {
        setSelectedMenuId(sorted[0].id);
      }
    }
  }, [serverMenus]);

  const invalidate = () => {
    utils.home.menus.invalidate();
    utils.cms.menus.list.invalidate();
  };

  // mutations
  const updateMenu = trpc.cms.menus.update.useMutation({
    onSuccess: () => { invalidate(); toast.success("저장됐습니다."); },
    onError: (e) => toast.error("저장 실패: " + e.message),
  });
  const createMenu = trpc.cms.menus.create.useMutation({
    onSuccess: () => { invalidate(); setShowAddMenu(false); toast.success("메뉴가 추가됐습니다."); },
    onError: (e) => toast.error("추가 실패: " + e.message),
  });
  const deleteMenu = trpc.cms.menus.delete.useMutation({
    onSuccess: () => { invalidate(); toast.success("메뉴가 삭제됐습니다."); },
    onError: (e) => toast.error("삭제 실패: " + e.message),
  });
  const reorderMenus = trpc.cms.menus.reorder.useMutation({
    onError: (e) => toast.error("순서 저장 실패: " + e.message),
  });
  const createItem = trpc.cms.menus.createItem.useMutation({
    onSuccess: () => { invalidate(); setShowAddItem(false); toast.success("하위 메뉴가 추가됐습니다."); },
    onError: (e) => toast.error("추가 실패: " + e.message),
  });
  const updateItem = trpc.cms.menus.updateItem.useMutation({
    onSuccess: () => { invalidate(); toast.success("저장됐습니다."); },
    onError: (e) => toast.error("저장 실패: " + e.message),
  });
  const deleteItem = trpc.cms.menus.deleteItem.useMutation({
    onSuccess: () => { invalidate(); toast.success("하위 메뉴가 삭제됐습니다."); },
    onError: (e) => toast.error("삭제 실패: " + e.message),
  });
  const createSubItem = trpc.cms.menus.createSubItem.useMutation({
    onSuccess: () => { invalidate(); setShowAddSub(false); toast.success("3단 메뉴가 추가됐습니다."); },
    onError: (e) => toast.error("추가 실패: " + e.message),
  });
  const updateSubItem = trpc.cms.menus.updateSubItem.useMutation({
    onSuccess: () => { invalidate(); toast.success("저장됐습니다."); },
    onError: (e) => toast.error("저장 실패: " + e.message),
  });
  const deleteSubItem = trpc.cms.menus.deleteSubItem.useMutation({
    onSuccess: () => { invalidate(); toast.success("3단 메뉴가 삭제됐습니다."); },
    onError: (e) => toast.error("삭제 실패: " + e.message),
  });

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = localMenus.findIndex((m) => m.id === active.id);
    const newIndex = localMenus.findIndex((m) => m.id === over.id);
    const reordered = arrayMove(localMenus, oldIndex, newIndex).map((m, i) => ({ ...m, sortOrder: i + 1 }));
    setLocalMenus(reordered);
    setIsSavingOrder(true);
    try {
      await reorderMenus.mutateAsync(reordered.map((m) => ({ id: m.id, sortOrder: m.sortOrder })));
      toast.success("순서가 저장됐습니다.");
    } finally {
      setIsSavingOrder(false);
    }
  };

  // 선택된 데이터
  const selectedMenu = localMenus.find((m) => m.id === selectedMenuId) ?? null;
  const selectedItem = selectedMenu?.items.find((i) => i.id === selectedItemId) ?? null;

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="right"
        className="p-0 flex flex-col overflow-hidden bg-white"
        style={{
          top: "112px",
          height: "calc(100vh - 112px)",
          width: "100vw",
          maxWidth: "100vw",
          boxShadow: "-4px 0 20px rgba(0,0,0,0.15)",
        }}
      >
        {/* 헤더 */}
        <SheetHeader className="px-4 pt-4 pb-3 border-b bg-white shrink-0">
          <SheetTitle className="text-[#1B5E20] text-base flex items-center gap-2">
            메뉴 편집
            {isSavingOrder && <span className="text-xs text-green-500 font-normal animate-pulse">순서 저장 중...</span>}
          </SheetTitle>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-gray-500 mt-1">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#1B5E20] inline-block" /> 1단 상위 메뉴 클릭 → 2단 표시</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500 inline-block" /> 2단 하위 메뉴 클릭 → 3단 표시</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-400 inline-block" /> 3단 세부 메뉴</span>
          </div>
        </SheetHeader>

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">불러오는 중...</div>
        ) : (
          <div className="flex flex-1 overflow-hidden">

            {/* ── 컬럼 1: 1단 상위 메뉴 ── */}
            <div className="w-[240px] shrink-0 border-r flex flex-col bg-gray-50">
              <div className="px-3 py-2 border-b bg-[#1B5E20]/5">
                <p className="text-[11px] font-semibold text-[#1B5E20]">1단 메뉴</p>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={localMenus.map((m) => m.id)} strategy={verticalListSortingStrategy}>
                    {localMenus.map((menu) => (
                      <div key={menu.id}>
                        {editingMenuId === menu.id ? (
                          <InlineEditForm
                            initialLabel={menu.label}
                            initialHref={menu.href ?? ""}
                            colorClass="border-green-300 bg-green-50"
                            onSave={(label, href) => {
                              updateMenu.mutate({ id: menu.id, label, href: href || null });
                              setLocalMenus((prev) => prev.map((m) => m.id === menu.id ? { ...m, label, href: href || null } : m));
                              setEditingMenuId(null);
                            }}
                            onCancel={() => setEditingMenuId(null)}
                          />
                        ) : (
                          <SortableMenuRow
                            menu={menu}
                            isSelected={selectedMenuId === menu.id}
                            onSelect={(id) => { setSelectedMenuId(id); setSelectedItemId(null); setEditingItemId(null); setEditingSubId(null); setShowAddItem(false); setShowAddSub(false); }}
                            onEdit={(m) => setEditingMenuId(m.id)}
                            onDelete={(id) => {
                              if (confirm(`"${menu.label}" 메뉴와 모든 하위 메뉴를 삭제하시겠습니까?`)) {
                                deleteMenu.mutate({ id });
                                setLocalMenus((prev) => prev.filter((m) => m.id !== id));
                                if (selectedMenuId === id) setSelectedMenuId(null);
                              }
                            }}
                            onToggleVisible={(id, visible) => {
                              updateMenu.mutate({ id, isVisible: visible });
                              setLocalMenus((prev) => prev.map((m) => m.id === id ? { ...m, isVisible: visible } : m));
                            }}
                          />
                        )}
                      </div>
                    ))}
                  </SortableContext>
                </DndContext>
              </div>
              {/* 상위 메뉴 추가 */}
              <div className="p-2 border-t bg-white shrink-0">
                {showAddMenu ? (
                  <InlineEditForm
                    initialLabel=""
                    initialHref=""
                    colorClass="border-green-300 bg-green-50"
                    onSave={(label, href) => {
                      createMenu.mutate({ label, href: href || null, sortOrder: localMenus.length + 1 });
                    }}
                    onCancel={() => setShowAddMenu(false)}
                  />
                ) : (
                  <button
                    onClick={() => setShowAddMenu(true)}
                    className="w-full text-xs text-[#1B5E20] border border-dashed border-[#1B5E20]/40 rounded-lg py-1.5 hover:bg-green-50 flex items-center justify-center gap-1"
                  >
                    <Plus size={12} /> 상위 메뉴 추가
                  </button>
                )}
              </div>
            </div>

            {/* ── 컬럼 2: 2단 하위 메뉴 ── */}
            <div className="w-[260px] shrink-0 border-r flex flex-col bg-white">
              <div className="px-3 py-2 border-b bg-blue-50">
                <p className="text-[11px] font-semibold text-blue-700">
                  2단 메뉴 {selectedMenu ? `— ${selectedMenu.label}` : ""}
                </p>
              </div>
              {!selectedMenu ? (
                <div className="flex-1 flex items-center justify-center text-xs text-gray-400 p-4 text-center">
                  왼쪽에서 상위 메뉴를<br />선택해주세요
                </div>
              ) : (
                <>
                  <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {selectedMenu.items.length === 0 && (
                      <p className="text-xs text-gray-400 text-center py-4">하위 메뉴가 없습니다</p>
                    )}
                    {selectedMenu.items.map((item) => (
                      <div key={item.id}>
                        {editingItemId === item.id ? (
                          <InlineEditForm
                            initialLabel={item.label}
                            initialHref={item.href ?? ""}
                            initialPageType={item.pageType}
                            showPageType
                            colorClass="border-blue-300 bg-blue-50"
                            onSave={(label, href, pageType) => {
                              updateItem.mutate({ id: item.id, label, href: href || null, pageType });
                              setLocalMenus((prev) => prev.map((m) => ({
                                ...m,
                                items: m.items.map((i) => i.id === item.id ? { ...i, label, href: href || null, pageType: pageType ?? i.pageType } : i),
                              })));
                              setEditingItemId(null);
                            }}
                            onCancel={() => setEditingItemId(null)}
                          />
                        ) : (
                          <SubMenuRow
                            item={item}
                            isSelected={selectedItemId === item.id}
                            onSelect={(id) => { setSelectedItemId(id); setEditingSubId(null); setShowAddSub(false); }}
                            onEdit={(i) => setEditingItemId(i.id)}
                            onDelete={(id) => {
                              if (confirm(`"${item.label}" 하위 메뉴를 삭제하시겠습니까?`)) {
                                deleteItem.mutate({ id });
                                setLocalMenus((prev) => prev.map((m) => ({
                                  ...m,
                                  items: m.items.filter((i) => i.id !== id),
                                })));
                                if (selectedItemId === id) setSelectedItemId(null);
                              }
                            }}
                            onToggleVisible={(id, visible) => {
                              updateItem.mutate({ id, isVisible: visible });
                              setLocalMenus((prev) => prev.map((m) => ({
                                ...m,
                                items: m.items.map((i) => i.id === id ? { ...i, isVisible: visible } : i),
                              })));
                            }}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="p-2 border-t bg-white shrink-0">
                    {showAddItem ? (
                      <InlineEditForm
                        initialLabel=""
                        initialHref=""
                        initialPageType="image"
                        showPageType
                        colorClass="border-blue-300 bg-blue-50"
                        onSave={(label, href, pageType) => {
                          createItem.mutate({
                            menuId: selectedMenu.id,
                            label,
                            href: href || undefined,
                            sortOrder: selectedMenu.items.length + 1,
                            pageType: pageType ?? "image",
                          });
                        }}
                        onCancel={() => setShowAddItem(false)}
                      />
                    ) : (
                      <button
                        onClick={() => setShowAddItem(true)}
                        className="w-full text-xs text-blue-600 border border-dashed border-blue-300 rounded-lg py-1.5 hover:bg-blue-50 flex items-center justify-center gap-1"
                      >
                        <Plus size={12} /> 하위 메뉴 추가
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* ── 컬럼 3: 3단 세부 메뉴 ── */}
            <div className="flex-1 flex flex-col bg-white">
              <div className="px-3 py-2 border-b bg-gray-50">
                <p className="text-[11px] font-semibold text-gray-600">
                  3단 메뉴 {selectedItem ? `— ${selectedItem.label}` : ""}
                </p>
              </div>
              {!selectedItem ? (
                <div className="flex-1 flex items-center justify-center text-xs text-gray-400 p-4 text-center">
                  가운데에서 하위 메뉴를<br />선택해주세요
                </div>
              ) : (
                <>
                  <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {selectedItem.subItems.length === 0 && (
                      <p className="text-xs text-gray-400 text-center py-4">3단 메뉴가 없습니다</p>
                    )}
                    {selectedItem.subItems.map((sub) => (
                      <div key={sub.id}>
                        {editingSubId === sub.id ? (
                          <InlineEditForm
                            initialLabel={sub.label}
                            initialHref={sub.href ?? ""}
                            initialPageType={sub.pageType}
                            showPageType
                            colorClass="border-gray-300 bg-gray-50"
                            onSave={(label, href, pageType) => {
                              updateSubItem.mutate({ id: sub.id, label, href: href || null, pageType });
                              setLocalMenus((prev) => prev.map((m) => ({
                                ...m,
                                items: m.items.map((i) => ({
                                  ...i,
                                  subItems: i.subItems.map((s) => s.id === sub.id ? { ...s, label, href: href || null, pageType: pageType ?? s.pageType } : s),
                                })),
                              })));
                              setEditingSubId(null);
                            }}
                            onCancel={() => setEditingSubId(null)}
                          />
                        ) : (
                          <SubSubMenuRow
                            item={sub}
                            onEdit={(s) => setEditingSubId(s.id)}
                            onDelete={(id) => {
                              if (confirm(`"${sub.label}" 3단 메뉴를 삭제하시겠습니까?`)) {
                                deleteSubItem.mutate({ id });
                                setLocalMenus((prev) => prev.map((m) => ({
                                  ...m,
                                  items: m.items.map((i) => ({
                                    ...i,
                                    subItems: i.subItems.filter((s) => s.id !== id),
                                  })),
                                })));
                              }
                            }}
                            onToggleVisible={(id, visible) => {
                              updateSubItem.mutate({ id, isVisible: visible });
                              setLocalMenus((prev) => prev.map((m) => ({
                                ...m,
                                items: m.items.map((i) => ({
                                  ...i,
                                  subItems: i.subItems.map((s) => s.id === id ? { ...s, isVisible: visible } : s),
                                })),
                              })));
                            }}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="p-2 border-t bg-white shrink-0">
                    {showAddSub ? (
                      <InlineEditForm
                        initialLabel=""
                        initialHref=""
                        initialPageType="image"
                        showPageType
                        colorClass="border-gray-300 bg-gray-50"
                        onSave={(label, href, pageType) => {
                          createSubItem.mutate({
                            menuItemId: selectedItem.id,
                            label,
                            href: href || undefined,
                            sortOrder: selectedItem.subItems.length + 1,
                            pageType: pageType ?? "image",
                          });
                        }}
                        onCancel={() => setShowAddSub(false)}
                      />
                    ) : (
                      <button
                        onClick={() => setShowAddSub(true)}
                        className="w-full text-xs text-gray-600 border border-dashed border-gray-300 rounded-lg py-1.5 hover:bg-gray-50 flex items-center justify-center gap-1"
                      >
                        <Plus size={12} /> 3단 메뉴 추가
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>

          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
