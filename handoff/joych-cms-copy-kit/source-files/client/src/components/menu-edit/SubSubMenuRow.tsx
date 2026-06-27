/**
 * 3단 메뉴 행 컴포넌트 (드래그 가능)
 * DnD Kit의 useSortable 훅을 사용하여 드래그 앤 드롭 순서 변경을 지원합니다.
 */
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Pencil, Trash2, Eye, EyeOff } from "lucide-react";
import { PAGE_TYPE_OPTIONS, type MenuSubItemRow } from "./types.tsx";

export function SubSubMenuRow({
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
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };

  return (
    <div ref={setNodeRef} style={style}>
      <div className={`flex items-center gap-1 px-2 py-2 rounded-lg border bg-white border-gray-200 ${!item.isVisible ? "opacity-50" : ""}`}>
        <button
          {...attributes}
          {...listeners}
          className="p-0.5 touch-none text-gray-300 hover:text-gray-500"
          title="드래그해서 순서 변경"
        >
          <GripVertical size={12} />
        </button>
        <span className={`flex-1 text-xs font-medium truncate ${!item.isVisible ? "line-through text-gray-400" : "text-gray-700"}`}>
          {item.label}
        </span>
        <span className="flex items-center gap-0.5 text-[9px] px-1 py-0.5 rounded bg-gray-100 text-gray-400">
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
    </div>
  );
}
