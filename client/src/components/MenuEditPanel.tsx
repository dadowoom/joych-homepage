/**
 * 메뉴 편집 패널 — 3컬럼 나란히 배치
 * 왼쪽: 1단 상위 메뉴 | 가운데: 2단 하위 메뉴 | 오른쪽: 3단 세부 메뉴
 * 각 컬럼은 독립적으로 스크롤 가능, 패널 높이 고정
 *
 * 서브 컴포넌트는 components/menu-edit/ 폴더에 분리되어 있습니다.
 */
import { useState, useEffect } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { trpc } from "@/lib/trpc";
import { Plus, Youtube } from "lucide-react";
import { toast } from "sonner";

// ─── 서브 컴포넌트 import ──────────────────────────────────────────────────────
import { type PageType, type MenuRow, type MenuItemRow, type MenuSubItemRow } from "./menu-edit/types.tsx";
import { InlineEditForm } from "./menu-edit/InlineEditForm.tsx";
import { SortableMenuRow } from "./menu-edit/SortableMenuRow.tsx";
import { SubMenuRow } from "./menu-edit/SubMenuRow.tsx";
import { SubSubMenuRow } from "./menu-edit/SubSubMenuRow.tsx";
import { YoutubeVideoManager } from "./menu-edit/YoutubeVideoManager.tsx";

function SubItemMoveTarget({ menuLabel, item }: { menuLabel: string; item: MenuItemRow }) {
  const { setNodeRef, isOver } = useDroppable({ id: `item-target:${item.id}` });

  return (
    <div
      ref={setNodeRef}
      className={`rounded border px-2 py-1.5 text-[11px] transition-colors ${
        isOver ? "border-[#1B5E20] bg-[#F1F8E9] text-[#1B5E20]" : "border-gray-200 bg-white text-gray-600"
      }`}
    >
      {menuLabel} › {item.label}
    </div>
  );
}

function ItemMoveTarget({ menu }: { menu: MenuRow }) {
  const { setNodeRef, isOver } = useDroppable({ id: `menu-target:${menu.id}` });

  return (
    <div
      ref={setNodeRef}
      className={`rounded border px-2 py-1.5 text-[11px] transition-colors ${
        isOver ? "border-blue-600 bg-blue-50 text-blue-700" : "border-gray-200 bg-white text-gray-600"
      }`}
    >
      {menu.label} 아래
    </div>
  );
}

// ─── 메인 패널 ────────────────────────────────────────────────────────────────
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
      if (sorted.length > 0 && selectedMenuId === null) {
        setSelectedMenuId(sorted[0].id);
      }
    }
  }, [serverMenus]);

  const invalidate = () => {
    utils.home.menus.invalidate();
    utils.cms.menus.list.invalidate();
  };

  // ─── mutations ──────────────────────────────────────────────────────────────
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
  const reorderItems = trpc.cms.menus.reorderItems.useMutation({
    onError: (e) => toast.error("2단 순서 저장 실패: " + e.message),
  });
  const reorderSubItems = trpc.cms.menus.reorderSubItems.useMutation({
    onError: (e) => toast.error("3단 순서 저장 실패: " + e.message),
  });
  const moveItem = trpc.cms.menus.moveItem.useMutation({
    onError: (e) => toast.error("2단 메뉴 이동 실패: " + e.message),
  });
  const moveSubItem = trpc.cms.menus.moveSubItem.useMutation({
    onError: (e) => toast.error("3단 메뉴 이동 실패: " + e.message),
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

  // ─── 드래그 핸들러 ──────────────────────────────────────────────────────────
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const parseDragId = (value: string | number) => {
      const [rawKind, id] = String(value).split(":");
      const numericId = Number(id);
      const kind = rawKind === "item-target"
        ? "item"
        : rawKind === "menu-target"
          ? "menu"
          : rawKind;
      return Number.isInteger(numericId) ? { kind, id: numericId } : null;
    };
    const source = parseDragId(active.id);
    const target = parseDragId(over.id);
    if (!source || !target || (source.kind === target.kind && source.id === target.id)) return;

    if (source.kind === "menu") {
      if (target.kind !== "menu") {
        toast.error("1단 메뉴는 2단 또는 3단으로 이동할 수 없습니다.");
        return;
      }
      const oldIndex = localMenus.findIndex((menu) => menu.id === source.id);
      const newIndex = localMenus.findIndex((menu) => menu.id === target.id);
      if (oldIndex < 0 || newIndex < 0) return;
      const reordered = arrayMove(localMenus, oldIndex, newIndex).map((menu, index) => ({ ...menu, sortOrder: index + 1 }));
      setIsSavingOrder(true);
      try {
        await reorderMenus.mutateAsync(reordered.map((menu) => ({ id: menu.id, sortOrder: menu.sortOrder })));
        setLocalMenus(reordered);
        toast.success("1단 메뉴 순서가 저장됐습니다.");
      } finally {
        setIsSavingOrder(false);
      }
      return;
    }

    if (source.kind === "item") {
      const sourceMenu = localMenus.find((menu) => menu.items.some((item) => item.id === source.id));
      const sourceItem = sourceMenu?.items.find((item) => item.id === source.id);
      if (!sourceMenu || !sourceItem) return;

      if (target.kind === "menu") {
        if (sourceMenu.id === target.id) {
          toast.info("이미 이 1단 메뉴 아래에 있는 2단 메뉴입니다.");
          return;
        }
        const targetMenu = localMenus.find((menu) => menu.id === target.id);
        if (!targetMenu) return;
        setIsSavingOrder(true);
        try {
          await moveItem.mutateAsync({ id: source.id, targetMenuId: target.id });
          setLocalMenus((current) => current.map((menu) => {
            if (menu.id === sourceMenu.id) {
              return {
                ...menu,
                items: menu.items.filter((item) => item.id !== source.id).map((item, index) => ({ ...item, sortOrder: index + 1 })),
              };
            }
            if (menu.id === target.id) {
              return {
                ...menu,
                items: [...menu.items, { ...sourceItem, menuId: target.id }]
                  .map((item, index) => ({ ...item, sortOrder: index + 1 })),
              };
            }
            return menu;
          }));
          setSelectedMenuId(target.id);
          setSelectedItemId(source.id);
          invalidate();
          toast.success(`2단 메뉴를 '${targetMenu.label}' 아래로 이동했습니다.`);
        } finally {
          setIsSavingOrder(false);
        }
        return;
      }

      if (target.kind !== "item") {
        toast.error("2단 메뉴는 3단으로 이동할 수 없습니다. 1단 메뉴 위에 놓아 이동하세요.");
        return;
      }
      const targetMenu = localMenus.find((menu) => menu.items.some((item) => item.id === target.id));
      if (!targetMenu || targetMenu.id !== sourceMenu.id) {
        toast.error("2단 메뉴는 다른 1단 메뉴 위에 놓아 이동하세요.");
        return;
      }
      const oldIndex = sourceMenu.items.findIndex((item) => item.id === source.id);
      const newIndex = sourceMenu.items.findIndex((item) => item.id === target.id);
      if (oldIndex < 0 || newIndex < 0) return;
      const reordered = arrayMove(sourceMenu.items, oldIndex, newIndex).map((item, index) => ({ ...item, sortOrder: index + 1 }));
      setIsSavingOrder(true);
      try {
        await reorderItems.mutateAsync(reordered.map((item) => ({ id: item.id, sortOrder: item.sortOrder })));
        setLocalMenus((current) => current.map((menu) => menu.id === sourceMenu.id ? { ...menu, items: reordered } : menu));
        toast.success("2단 메뉴 순서가 저장됐습니다.");
      } finally {
        setIsSavingOrder(false);
      }
      return;
    }

    if (source.kind === "sub") {
      const sourceMenu = localMenus.find((menu) => menu.items.some((item) => item.subItems.some((sub) => sub.id === source.id)));
      const sourceItem = sourceMenu?.items.find((item) => item.subItems.some((sub) => sub.id === source.id));
      const sourceSub = sourceItem?.subItems.find((sub) => sub.id === source.id);
      if (!sourceMenu || !sourceItem || !sourceSub) return;

      if (target.kind === "item") {
        const targetMenu = localMenus.find((menu) => menu.items.some((item) => item.id === target.id));
        const targetItem = targetMenu?.items.find((item) => item.id === target.id);
        if (!targetMenu || !targetItem) return;
        if (sourceItem.id === target.id) {
          toast.info("이미 이 2단 메뉴 아래에 있는 3단 메뉴입니다.");
          return;
        }
        setIsSavingOrder(true);
        try {
          await moveSubItem.mutateAsync({ id: source.id, targetMenuItemId: target.id });
          setLocalMenus((current) => current.map((menu) => ({
            ...menu,
            items: menu.items.map((item) => {
              if (item.id === sourceItem.id) {
                return {
                  ...item,
                  subItems: item.subItems.filter((sub) => sub.id !== source.id).map((sub, index) => ({ ...sub, sortOrder: index + 1 })),
                };
              }
              if (item.id === target.id) {
                return {
                  ...item,
                  subItems: [...item.subItems, { ...sourceSub, menuItemId: target.id }]
                    .map((sub, index) => ({ ...sub, sortOrder: index + 1 })),
                };
              }
              return item;
            }),
          })));
          setSelectedMenuId(targetMenu.id);
          setSelectedItemId(target.id);
          invalidate();
          toast.success(`3단 메뉴를 '${targetItem.label}' 아래로 이동했습니다.`);
        } finally {
          setIsSavingOrder(false);
        }
        return;
      }

      if (target.kind !== "sub") {
        toast.error("3단 메뉴는 1단 또는 2단으로 변경할 수 없습니다. 다른 2단 메뉴 위에 놓으면 3단으로 이동합니다.");
        return;
      }
      const targetItem = localMenus.flatMap((menu) => menu.items).find((item) => item.subItems.some((sub) => sub.id === target.id));
      if (!targetItem || targetItem.id !== sourceItem.id) {
        toast.error("3단 메뉴는 다른 2단 메뉴 위에 놓아 이동하세요.");
        return;
      }
      const oldIndex = sourceItem.subItems.findIndex((sub) => sub.id === source.id);
      const newIndex = sourceItem.subItems.findIndex((sub) => sub.id === target.id);
      if (oldIndex < 0 || newIndex < 0) return;
      const reordered = arrayMove(sourceItem.subItems, oldIndex, newIndex).map((sub, index) => ({ ...sub, sortOrder: index + 1 }));
      setIsSavingOrder(true);
      try {
        await reorderSubItems.mutateAsync(reordered.map((sub) => ({ id: sub.id, sortOrder: sub.sortOrder })));
        setLocalMenus((current) => current.map((menu) => ({
          ...menu,
          items: menu.items.map((item) => item.id === sourceItem.id ? { ...item, subItems: reordered } : item),
        })));
        toast.success("3단 메뉴 순서가 저장됐습니다.");
      } finally {
        setIsSavingOrder(false);
      }
      return;
    }

    toast.error("지원하지 않는 메뉴 이동입니다.");
  };

  // ─── 선택된 데이터 ──────────────────────────────────────────────────────────
  const selectedMenu = localMenus.find((m) => m.id === selectedMenuId) ?? null;
  const selectedItem = selectedMenu?.items.find((i) => i.id === selectedItemId) ?? null;

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="right"
        draggableKey="menu-edit-panel"
        className="p-0 flex flex-col overflow-hidden bg-white w-full sm:w-[92vw] lg:w-1/2 lg:max-w-none"
        style={{
          top: "144px",
          height: "calc(100vh - 144px)",
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
            <span className="basis-full text-[#1B5E20]">2단은 다른 1단 아래로, 3단은 다른 2단 아래로 드래그해 부모 메뉴를 바꿀 수 있습니다.</span>
          </div>
        </SheetHeader>

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">불러오는 중...</div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <div className="flex flex-1 overflow-hidden">

            {/* ── 컬럼 1: 1단 상위 메뉴 ── */}
            <div className="w-[240px] shrink-0 border-r flex flex-col bg-gray-50">
              <div className="px-3 py-2 border-b bg-[#1B5E20]/5">
                <p className="text-[11px] font-semibold text-[#1B5E20]">1단 메뉴</p>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                  <SortableContext items={localMenus.map((menu) => `menu:${menu.id}`)} strategy={verticalListSortingStrategy}>
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
                            sortableId={`menu:${menu.id}`}
                            isSelected={selectedMenuId === menu.id}
                            onSelect={(id) => {
                              setSelectedMenuId(id);
                              setSelectedItemId(null);
                              setEditingItemId(null);
                              setEditingSubId(null);
                              setShowAddItem(false);
                              setShowAddSub(false);
                            }}
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
                  <details open className="shrink-0 border-b bg-[#F4F8FF] px-2 py-2">
                    <summary className="cursor-pointer text-[11px] font-semibold text-blue-700">
                      2단 이동 대상: 다른 1단 위에 놓으면 하위 2단 상태로 이동
                    </summary>
                    <div className="mt-2 grid max-h-28 grid-cols-2 gap-1 overflow-y-auto pr-1">
                      {localMenus
                        .filter((menu) => menu.id !== selectedMenu.id)
                        .map((menu) => <ItemMoveTarget key={menu.id} menu={menu} />)}
                    </div>
                  </details>
                  <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {selectedMenu.items.length === 0 && (
                      <p className="text-xs text-gray-400 text-center py-4">하위 메뉴가 없습니다</p>
                    )}
                      <SortableContext items={selectedMenu.items.map((item) => `item:${item.id}`)} strategy={verticalListSortingStrategy}>
                        {selectedMenu.items.map((item) => (
                          <div key={item.id}>
                            {editingItemId === item.id ? (
                              <InlineEditForm
                                initialLabel={item.label}
                                initialHref={item.href ?? ""}
                                initialPageType={item.pageType}
                                initialPageImageUrl={item.pageImageUrl}
                                initialDefaultViewMode={item.defaultViewMode === "grid" ? "grid" : "list"}
                                showPageType
                                colorClass="border-blue-300 bg-blue-50"
                                onSave={(label, href, pageType, pageImageUrl, defaultViewMode) => {
                                  updateItem.mutate({
                                    id: item.id,
                                    label,
                                    href: href || null,
                                    pageType,
                                    pageImageUrl: pageImageUrl ?? null,
                                    defaultViewMode,
                                  });
                                  setLocalMenus((prev) => prev.map((m) => ({
                                    ...m,
                                    items: m.items.map((i) => i.id === item.id
                                      ? {
                                        ...i,
                                        label,
                                        href: href || null,
                                        pageType: pageType ?? i.pageType,
                                        pageImageUrl: pageImageUrl ?? i.pageImageUrl,
                                        defaultViewMode: defaultViewMode ?? i.defaultViewMode,
                                      }
                                      : i),
                                  })));
                                  setEditingItemId(null);
                                }}
                                onCancel={() => setEditingItemId(null)}
                              />
                            ) : (
                              <SubMenuRow
                                item={item}
                                sortableId={`item:${item.id}`}
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
                      </SortableContext>
                  </div>
                  <div className="p-2 border-t bg-white shrink-0">
                    {showAddItem ? (
                      <InlineEditForm
                        initialLabel=""
                        initialHref=""
                        initialPageType="image"
                        initialDefaultViewMode="list"
                        showPageType
                        colorClass="border-blue-300 bg-blue-50"
                        onSave={(label, href, pageType, pageImageUrl, defaultViewMode) => {
                          createItem.mutate({
                            menuId: selectedMenu.id,
                            label,
                            href: href || undefined,
                            sortOrder: selectedMenu.items.length + 1,
                            pageType: pageType ?? "image",
                            pageImageUrl: pageImageUrl ?? undefined,
                            defaultViewMode,
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
                  <span className="flex items-center gap-1">
                    3단 메뉴 {selectedItem ? `— ${selectedItem.label}` : ''}
                    {selectedItem?.pageType === 'youtube' && (
                      <span className="inline-flex items-center gap-0.5 text-red-500">
                        <Youtube size={11} /> 예배영상 연결
                      </span>
                    )}
                  </span>
                </p>
              </div>
              {!selectedItem ? (
                <div className="flex-1 flex items-center justify-center text-xs text-gray-400 p-4 text-center">
                  가운데에서 하위 메뉴를<br />선택해주세요
                </div>
              ) : (
                <>
                  {selectedItem.pageType === 'youtube' && (
                    <div className="shrink-0 p-2 border-b bg-white">
                      <YoutubeVideoManager menuItemId={selectedItem.id} label={selectedItem.label} compact />
                    </div>
                  )}
                  <details open className="shrink-0 border-b bg-[#F7FBF5] px-2 py-2">
                    <summary className="cursor-pointer text-[11px] font-semibold text-[#1B5E20]">
                      3단 이동 대상: 다른 2단 위에 놓으면 3단 상태로 이동
                    </summary>
                    <div className="mt-2 grid max-h-28 grid-cols-2 gap-1 overflow-y-auto pr-1">
                      {localMenus.flatMap((menu) => menu.items.map((item) => (
                        <SubItemMoveTarget key={item.id} menuLabel={menu.label} item={item} />
                      )))}
                    </div>
                  </details>
                  <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {selectedItem.subItems.length === 0 && (
                      <p className="text-xs text-gray-400 text-center py-4">3단 메뉴가 없습니다</p>
                    )}
                      <SortableContext items={selectedItem.subItems.map((sub) => `sub:${sub.id}`)} strategy={verticalListSortingStrategy}>
                        {selectedItem.subItems.map((sub) => (
                          <div key={sub.id}>
                            {editingSubId === sub.id ? (
                              <InlineEditForm
                                initialLabel={sub.label}
                                initialHref={sub.href ?? ""}
                                initialPageType={sub.pageType}
                                initialPageImageUrl={sub.pageImageUrl}
                                initialDefaultViewMode={sub.defaultViewMode === "grid" ? "grid" : "list"}
                                showPageType
                                colorClass="border-gray-300 bg-gray-50"
                                onSave={(label, href, pageType, pageImageUrl, defaultViewMode) => {
                                  updateSubItem.mutate({
                                    id: sub.id,
                                    label,
                                    href: href || null,
                                    pageType,
                                    pageImageUrl: pageImageUrl ?? null,
                                    defaultViewMode,
                                  });
                                  setLocalMenus((prev) => prev.map((m) => ({
                                    ...m,
                                    items: m.items.map((i) => ({
                                      ...i,
                                      subItems: i.subItems.map((s) => s.id === sub.id
                                        ? {
                                          ...s,
                                          label,
                                          href: href || null,
                                          pageType: pageType ?? s.pageType,
                                          pageImageUrl: pageImageUrl ?? s.pageImageUrl,
                                          defaultViewMode: defaultViewMode ?? s.defaultViewMode,
                                        }
                                        : s),
                                    })),
                                  })));
                                  setEditingSubId(null);
                                }}
                                onCancel={() => setEditingSubId(null)}
                              />
                            ) : (
                              <SubSubMenuRow
                                item={sub}
                                sortableId={`sub:${sub.id}`}
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
                      </SortableContext>
                  </div>
                  <div className="p-2 border-t bg-white shrink-0">
                    {showAddSub ? (
                      <InlineEditForm
                        initialLabel=""
                        initialHref=""
                        initialPageType="image"
                        initialDefaultViewMode="list"
                        showPageType
                        colorClass="border-gray-300 bg-gray-50"
                        onSave={(label, href, pageType, pageImageUrl, defaultViewMode) => {
                          createSubItem.mutate({
                            menuItemId: selectedItem.id,
                            label,
                            href: href || undefined,
                            sortOrder: selectedItem.subItems.length + 1,
                            pageType: pageType ?? "image",
                            pageImageUrl: pageImageUrl ?? undefined,
                            defaultViewMode,
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
          </DndContext>
        )}
      </SheetContent>
    </Sheet>
  );
}
