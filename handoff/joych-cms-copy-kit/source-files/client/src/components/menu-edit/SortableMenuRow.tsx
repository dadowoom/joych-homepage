/**
 * 1단 메뉴 행 컴포넌트 (드래그 가능)
 * DnD Kit의 useSortable 훅을 사용하여 드래그 앤 드롭 순서 변경을 지원합니다.
 */
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Pencil, Trash2, Eye, EyeOff, ChevronRight } from "lucide-react";
import type { MenuRow } from "./types.tsx";

export function SortableMenuRow({
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
        <span
          className={`flex-1 text-sm font-medium min-w-0 ${!menu.isVisible ? "line-through" : ""}`}
          style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        >
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
