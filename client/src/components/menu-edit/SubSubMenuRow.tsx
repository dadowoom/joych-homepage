import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Eye, EyeOff, GripVertical, Pencil, Trash2 } from "lucide-react";
import { PAGE_TYPE_OPTIONS, type MenuSubItemRow } from "./types.tsx";

export function SubSubMenuRow({
  item,
  onEdit,
  onDelete,
  onToggleVisible,
  sortableId,
}: {
  item: MenuSubItemRow;
  onEdit: (item: MenuSubItemRow) => void;
  onDelete: (id: number) => void;
  onToggleVisible: (id: number, visible: boolean) => void;
  sortableId: string;
}) {
  const typeOpt = PAGE_TYPE_OPTIONS.find((o) => o.value === item.pageType);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: sortableId });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <div
        {...attributes}
        {...listeners}
        className={`flex items-center gap-1 px-2 py-2 rounded-lg border bg-white border-gray-200 transition-colors hover:border-gray-400 hover:bg-gray-50 cursor-grab active:cursor-grabbing touch-none ${
          !item.isVisible ? "opacity-50" : ""
        }`}
        title="Drag to change order"
      >
        <button
          className="p-0.5 text-gray-300 hover:text-gray-500"
          onPointerDown={(e) => e.stopPropagation()}
          title="Drag to change order"
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
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => onToggleVisible(item.id, !item.isVisible)}
          className="p-0.5 text-gray-300 hover:text-gray-600"
          title={item.isVisible ? "Hide" : "Show"}
        >
          {item.isVisible ? <Eye size={11} /> : <EyeOff size={11} />}
        </button>
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => onEdit(item)}
          className="p-0.5 text-blue-300 hover:text-blue-600"
          title="Edit"
        >
          <Pencil size={11} />
        </button>
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => onDelete(item.id)}
          className="p-0.5 text-red-300 hover:text-red-500"
          title="Delete"
        >
          <Trash2 size={11} />
        </button>
      </div>
    </div>
  );
}
