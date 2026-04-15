/**
 * 메뉴 편집 슬라이드 패널
 * - 관리자 로그인 시 홈페이지 우측에서 슬라이드로 열림
 * - dnd-kit으로 드래그 순서 변경
 * - 상위 메뉴: 이름/링크 수정, 추가, 삭제, 표시/숨김
 * - 하위 메뉴: 상위 메뉴 클릭 시 펼침, 추가/수정/삭제/페이지타입 선택 가능
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
import {
  GripVertical, Pencil, Trash2, Plus, Check, X,
  Eye, EyeOff, ChevronDown, ChevronRight,
  Image, LayoutGrid, FileText, Youtube, Type
} from "lucide-react";
import { toast } from "sonner";

type PageType = "image" | "gallery" | "board" | "youtube" | "editor";

const PAGE_TYPE_OPTIONS: { value: PageType; label: string; desc: string; icon: React.ReactNode }[] = [
  { value: "image",   label: "이미지 전체화면", desc: "디자인 이미지 한 장을 전체화면으로 표시", icon: <Image size={14} /> },
  { value: "gallery", label: "갤러리",          desc: "사진 여러 장을 격자로 표시",             icon: <LayoutGrid size={14} /> },
  { value: "board",   label: "게시판",           desc: "글 목록 + 파일 첨부 가능",               icon: <FileText size={14} /> },
  { value: "youtube", label: "유튜브 목록",      desc: "유튜브 영상 카드 목록",                  icon: <Youtube size={14} /> },
  { value: "editor",  label: "텍스트+이미지",    desc: "자유롭게 편집 가능한 페이지",            icon: <Type size={14} /> },
];

type MenuItemRow = {
  id: number;
  menuId: number;
  label: string;
  href: string | null;
  sortOrder: number;
  isVisible: boolean;
  pageType: PageType;
  pageImageUrl: string | null;
};

type MenuRow = {
  id: number;
  label: string;
  href: string | null;
  sortOrder: number;
  isVisible: boolean;
  items: MenuItemRow[];
};

// ─── 페이지 타입 선택 컴포넌트 ───────────────────────
function PageTypeSelector({
  value,
  onChange,
}: {
  value: PageType;
  onChange: (v: PageType) => void;
}) {
  return (
    <div>
      <p className="text-[10px] font-semibold text-gray-600 mb-1">페이지 표시 방식</p>
      <div className="grid grid-cols-1 gap-1">
        {PAGE_TYPE_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`flex items-center gap-2 px-2 py-1.5 rounded border text-left transition-colors ${
              value === opt.value
                ? "border-[#1B5E20] bg-green-50 text-[#1B5E20]"
                : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50"
            }`}
          >
            <span className={value === opt.value ? "text-[#1B5E20]" : "text-gray-400"}>
              {opt.icon}
            </span>
            <span className="text-[11px] font-medium">{opt.label}</span>
            <span className="text-[10px] text-gray-400 ml-auto">{opt.desc}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── 하위 메뉴 아이템 행 ─────────────────────────────
function SubMenuItem({
  item,
  onEdit,
  onDelete,
  onToggleVisible,
}: {
  item: MenuItemRow;
  onEdit: (item: MenuItemRow) => void;
  onDelete: (id: number) => void;
  onToggleVisible: (id: number, visible: boolean) => void;
}) {
  const typeOpt = PAGE_TYPE_OPTIONS.find((o) => o.value === item.pageType);
  return (
    <div className={`flex items-center gap-2 px-2 py-1.5 rounded border bg-gray-50 ${!item.isVisible ? "opacity-50" : ""}`}>
      <span className="w-3" />
      <span className={`flex-1 text-xs ${!item.isVisible ? "line-through text-gray-400" : "text-gray-700"}`}>
        {item.label}
      </span>
      {/* 페이지 타입 뱃지 */}
      <span className="flex items-center gap-0.5 text-[9px] text-gray-400 bg-gray-100 rounded px-1 py-0.5">
        {typeOpt?.icon}
        <span>{typeOpt?.label ?? item.pageType}</span>
      </span>
      {item.href && (
        <span className="text-[10px] text-gray-400 truncate max-w-[50px]">{item.href}</span>
      )}
      <button
        onClick={() => onToggleVisible(item.id, !item.isVisible)}
        className="p-0.5 text-gray-400 hover:text-gray-600"
        title={item.isVisible ? "숨기기" : "표시"}
      >
        {item.isVisible ? <Eye size={12} /> : <EyeOff size={12} />}
      </button>
      <button
        onClick={() => onEdit(item)}
        className="p-0.5 text-blue-400 hover:text-blue-600"
        title="수정"
      >
        <Pencil size={12} />
      </button>
      <button
        onClick={() => onDelete(item.id)}
        className="p-0.5 text-red-300 hover:text-red-500"
        title="삭제"
      >
        <Trash2 size={12} />
      </button>
    </div>
  );
}

// ─── 하위 메뉴 수정 폼 ───────────────────────────────
function EditSubMenuForm({
  item,
  onSave,
  onCancel,
}: {
  item: MenuItemRow;
  onSave: (id: number, label: string, href: string | null, pageType: PageType) => void;
  onCancel: () => void;
}) {
  const [label, setLabel] = useState(item.label);
  const [href, setHref] = useState(item.href ?? "");
  const [pageType, setPageType] = useState<PageType>(item.pageType ?? "image");

  return (
    <div className="p-2 rounded border-2 border-blue-200 bg-blue-50 space-y-2 ml-4">
      <p className="text-[10px] font-semibold text-blue-700">하위 메뉴 수정</p>
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
        placeholder="/about/pastor"
      />
      <PageTypeSelector value={pageType} onChange={setPageType} />
      <div className="flex gap-1">
        <Button size="sm" className="h-6 text-[10px] bg-[#1B5E20] hover:bg-[#2E7D32] px-2"
          onClick={() => onSave(item.id, label, href || null, pageType)}>
          <Check size={10} className="mr-1" /> 저장
        </Button>
        <Button size="sm" variant="outline" className="h-6 text-[10px] px-2" onClick={onCancel}>
          취소
        </Button>
      </div>
    </div>
  );
}

// ─── 하위 메뉴 추가 폼 ───────────────────────────────
function AddSubMenuForm({
  onAdd,
  onCancel,
}: {
  onAdd: (label: string, href: string | null, pageType: PageType) => void;
  onCancel: () => void;
}) {
  const [label, setLabel] = useState("");
  const [href, setHref] = useState("");
  const [pageType, setPageType] = useState<PageType>("image");

  return (
    <div className="p-2 rounded border-2 border-green-200 bg-green-50 space-y-2 ml-4">
      <p className="text-[10px] font-semibold text-green-700">하위 메뉴 추가</p>
      <Input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        className="h-7 text-xs"
        placeholder="예: 담임목사 소개"
        autoFocus
      />
      <Input
        value={href}
        onChange={(e) => setHref(e.target.value)}
        className="h-7 text-xs"
        placeholder="/about/pastor"
      />
      <PageTypeSelector value={pageType} onChange={setPageType} />
      <div className="flex gap-1">
        <Button
          size="sm"
          className="h-6 text-[10px] bg-[#1B5E20] hover:bg-[#2E7D32] px-2"
          onClick={() => { if (label.trim()) onAdd(label.trim(), href || null, pageType); }}
          disabled={!label.trim()}
        >
          <Plus size={10} className="mr-1" /> 추가
        </Button>
        <Button size="sm" variant="outline" className="h-6 text-[10px] px-2" onClick={onCancel}>
          취소
        </Button>
      </div>
    </div>
  );
}

// ─── 드래그 가능한 상위 메뉴 행 ─────────────────────
function SortableMenuItem({
  menu,
  onEdit,
  onDelete,
  onToggleVisible,
  onToggleExpand,
  isExpanded,
  onAddSubMenu,
  onEditSubMenu,
  onDeleteSubMenu,
  onToggleSubVisible,
}: {
  menu: MenuRow;
  onEdit: (menu: MenuRow) => void;
  onDelete: (id: number) => void;
  onToggleVisible: (id: number, visible: boolean) => void;
  onToggleExpand: (id: number) => void;
  isExpanded: boolean;
  onAddSubMenu: (menuId: number, label: string, href: string | null, pageType: PageType) => void;
  onEditSubMenu: (id: number, label: string, href: string | null, pageType: PageType) => void;
  onDeleteSubMenu: (id: number, menuId: number) => void;
  onToggleSubVisible: (id: number, menuId: number, visible: boolean) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: menu.id });

  const [editingSubId, setEditingSubId] = useState<number | null>(null);
  const [showAddSubForm, setShowAddSubForm] = useState(false);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      {/* 상위 메뉴 행 */}
      <div className={`flex items-center gap-2 p-2 rounded-lg border bg-white ${
        isDragging ? "shadow-lg border-green-400" : "border-gray-200"
      } ${!menu.isVisible ? "opacity-50" : ""}`}>
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 p-1 touch-none"
          title="드래그해서 순서 변경"
        >
          <GripVertical size={16} />
        </button>
        <button
          onClick={() => onToggleExpand(menu.id)}
          className="text-gray-400 hover:text-gray-600 p-0.5"
          title={isExpanded ? "접기" : "하위 메뉴 보기"}
        >
          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
        <span className={`flex-1 text-sm font-medium ${!menu.isVisible ? "line-through text-gray-400" : "text-gray-800"}`}>
          {menu.label}
          {menu.items.length > 0 && (
            <span className="ml-1 text-[10px] text-gray-400">({menu.items.length})</span>
          )}
        </span>
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

      {/* 하위 메뉴 영역 (펼침 시) */}
      {isExpanded && (
        <div className="ml-6 mt-1 space-y-1 pb-1">
          {menu.items.map((item) => (
            <div key={item.id}>
              {editingSubId === item.id ? (
                <EditSubMenuForm
                  item={item}
                  onSave={(id, label, href, pageType) => {
                    onEditSubMenu(id, label, href, pageType);
                    setEditingSubId(null);
                  }}
                  onCancel={() => setEditingSubId(null)}
                />
              ) : (
                <SubMenuItem
                  item={item}
                  onEdit={(i) => setEditingSubId(i.id)}
                  onDelete={(id) => {
                    if (confirm(`"${item.label}" 하위 메뉴를 삭제하시겠습니까?`)) {
                      onDeleteSubMenu(id, menu.id);
                    }
                  }}
                  onToggleVisible={(id, visible) => onToggleSubVisible(id, menu.id, visible)}
                />
              )}
            </div>
          ))}

          {showAddSubForm ? (
            <AddSubMenuForm
              onAdd={(label, href, pageType) => {
                onAddSubMenu(menu.id, label, href, pageType);
                setShowAddSubForm(false);
              }}
              onCancel={() => setShowAddSubForm(false)}
            />
          ) : (
            <button
              onClick={() => setShowAddSubForm(true)}
              className="w-full text-left text-[11px] text-green-600 hover:text-green-800 px-2 py-1 rounded border border-dashed border-green-300 hover:bg-green-50 flex items-center gap-1"
            >
              <Plus size={10} /> 하위 메뉴 추가
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── 상위 메뉴 수정 폼 ───────────────────────────────
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
      <p className="text-xs font-semibold text-blue-700">상위 메뉴 수정</p>
      <div>
        <label className="text-xs text-gray-600 font-medium">메뉴 이름</label>
        <Input value={label} onChange={(e) => setLabel(e.target.value)}
          className="mt-1 h-8 text-sm" placeholder="메뉴 이름 입력" autoFocus />
      </div>
      <div>
        <label className="text-xs text-gray-600 font-medium">링크 (선택)</label>
        <Input value={href} onChange={(e) => setHref(e.target.value)}
          className="mt-1 h-8 text-sm" placeholder="/about 또는 비워두기" />
      </div>
      <div className="flex gap-2">
        <Button size="sm" className="h-7 text-xs bg-[#1B5E20] hover:bg-[#2E7D32]"
          onClick={() => onSave(menu.id, label, href || null)}>
          <Check size={12} className="mr-1" /> 저장
        </Button>
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onCancel}>
          <X size={12} className="mr-1" /> 취소
        </Button>
      </div>
    </div>
  );
}

// ─── 새 상위 메뉴 추가 폼 ────────────────────────────
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
        <Input value={label} onChange={(e) => setLabel(e.target.value)}
          className="mt-1 h-8 text-sm" placeholder="예: 소식" autoFocus />
      </div>
      <div>
        <label className="text-xs text-gray-600 font-medium">링크 (선택)</label>
        <Input value={href} onChange={(e) => setHref(e.target.value)}
          className="mt-1 h-8 text-sm" placeholder="/news" />
      </div>
      <div className="flex gap-2">
        <Button size="sm" className="h-7 text-xs bg-[#1B5E20] hover:bg-[#2E7D32]"
          onClick={() => { if (label.trim()) onAdd(label.trim(), href || null); }}
          disabled={!label.trim()}>
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

  const { data: serverMenus, isLoading } = trpc.cms.menus.list.useQuery(undefined, {
    enabled: open,
  });

  const [localMenus, setLocalMenus] = useState<MenuRow[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [isSavingOrder, setIsSavingOrder] = useState(false);

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
            items: [...(m.items ?? [])].sort((a, b) => a.sortOrder - b.sortOrder).map((item) => ({
              ...item,
              pageType: (item.pageType ?? "image") as PageType,
              pageImageUrl: item.pageImageUrl ?? null,
            })),
          }))
      );
    }
  }, [serverMenus]);

  const invalidate = () => {
    utils.home.menus.invalidate();
    utils.cms.menus.list.invalidate();
  };

  const updateMenu = trpc.cms.menus.update.useMutation({
    onSuccess: () => { invalidate(); toast.success("메뉴가 업데이트됐습니다."); },
    onError: (e) => toast.error("저장 실패: " + e.message),
  });

  const createMenu = trpc.cms.menus.create.useMutation({
    onSuccess: () => { invalidate(); setShowAddForm(false); toast.success("새 메뉴가 추가됐습니다."); },
    onError: (e) => toast.error("추가 실패: " + e.message),
  });

  const deleteMenu = trpc.cms.menus.delete.useMutation({
    onSuccess: () => { invalidate(); toast.success("메뉴가 삭제됐습니다."); },
    onError: (e) => toast.error("삭제 실패: " + e.message),
  });

  const reorderMenus = trpc.cms.menus.reorder.useMutation({
    onSuccess: () => invalidate(),
    onError: (e) => toast.error("순서 저장 실패: " + e.message),
  });

  const createItem = trpc.cms.menus.createItem.useMutation({
    onSuccess: () => { invalidate(); toast.success("하위 메뉴가 추가됐습니다."); },
    onError: (e) => toast.error("추가 실패: " + e.message),
  });

  const updateItem = trpc.cms.menus.updateItem.useMutation({
    onSuccess: () => { invalidate(); toast.success("하위 메뉴가 수정됐습니다."); },
    onError: (e) => toast.error("수정 실패: " + e.message),
  });

  const deleteItem = trpc.cms.menus.deleteItem.useMutation({
    onSuccess: () => { invalidate(); toast.success("하위 메뉴가 삭제됐습니다."); },
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
    const reordered = arrayMove(localMenus, oldIndex, newIndex).map((m, i) => ({
      ...m,
      sortOrder: i + 1,
    }));
    setLocalMenus(reordered);

    setIsSavingOrder(true);
    try {
      await reorderMenus.mutateAsync(
        reordered.map((m) => ({ id: m.id, sortOrder: m.sortOrder }))
      );
      toast.success("순서가 저장됐습니다.");
    } finally {
      setIsSavingOrder(false);
    }
  };

  const toggleExpand = (id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-[400px] sm:w-[440px] overflow-y-auto p-4">
        <SheetHeader className="mb-4">
          <SheetTitle className="text-[#1B5E20] flex items-center gap-2">
            메뉴 편집
          </SheetTitle>
          <SheetDescription className="text-xs text-gray-500">
            드래그로 순서 변경 · ▶ 클릭으로 하위 메뉴 펼침 · ✏️ 수정 시 페이지 표시 방식 선택 가능
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
                        isExpanded={expandedIds.has(menu.id)}
                        onToggleExpand={toggleExpand}
                        onEdit={(m) => setEditingId(m.id)}
                        onDelete={(id) => {
                          if (confirm(`"${menu.label}" 메뉴와 하위 메뉴 전체를 삭제하시겠습니까?`)) {
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
                        onAddSubMenu={(menuId, label, href, pageType) => {
                          const currentItems = localMenus.find(m => m.id === menuId)?.items ?? [];
                          createItem.mutate({
                            menuId,
                            label,
                            href: href ?? undefined,
                            sortOrder: currentItems.length + 1,
                            pageType,
                          });
                        }}
                        onEditSubMenu={(id, label, href, pageType) => {
                          updateItem.mutate({ id, label, href, pageType });
                          setLocalMenus((prev) =>
                            prev.map((m) => ({
                              ...m,
                              items: m.items.map((item) =>
                                item.id === id ? { ...item, label, href, pageType } : item
                              ),
                            }))
                          );
                        }}
                        onDeleteSubMenu={(id, menuId) => {
                          deleteItem.mutate({ id });
                          setLocalMenus((prev) =>
                            prev.map((m) =>
                              m.id === menuId
                                ? { ...m, items: m.items.filter((item) => item.id !== id) }
                                : m
                            )
                          );
                        }}
                        onToggleSubVisible={(id, menuId, visible) => {
                          updateItem.mutate({ id, isVisible: visible });
                          setLocalMenus((prev) =>
                            prev.map((m) =>
                              m.id === menuId
                                ? {
                                    ...m,
                                    items: m.items.map((item) =>
                                      item.id === id ? { ...item, isVisible: visible } : item
                                    ),
                                  }
                                : m
                            )
                          );
                        }}
                      />
                    )}
                  </div>
                ))}
              </SortableContext>
            </DndContext>

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
                <Plus size={14} className="mr-1" /> 상위 메뉴 추가
              </Button>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
