/**
 * 2단 메뉴 행 컴포넌트 (드래그 가능)
 * DnD Kit의 useSortable 훅을 사용하여 드래그 앤 드롭 순서 변경을 지원합니다.
 */
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Pencil, Trash2, Eye, EyeOff, ChevronRight } from "lucide-react";
import { PAGE_TYPE_OPTIONS, type MenuItemRow } from "./types.tsx";

export function SubMenuRow({
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
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };

  return (
    <div ref={setNodeRef} style={style}>
      <div
        className={`flex items-center gap-1 px-2 py-2 rounded-lg cursor-pointer transition-colors border ${
          isSelected
            ? "bg-blue-600 text-white border-blue-600"
            : "bg-white border-gray-200 hover:border-blue-400 hover:bg-blue-50"
        } ${!item.isVisible ? "opacity-50" : ""}`}
        onClick={() => onSelect(item.id)}
      >
        <button
          {...attributes}
          {...listeners}
          className={`p-0.5 touch-none ${isSelected ? "text-white/60 hover:text-white" : "text-gray-300 hover:text-gray-500"}`}
          onClick={(e) => e.stopPropagation()}
          title="드래그해서 순서 변경"
        >
          <GripVertical size={12} />
        </button>
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
    </div>
  );
}
