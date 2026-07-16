import { CheckCircle2, Circle } from "lucide-react";
import {
  getCourseApplicationChecklistControlLabel,
  getCourseApplicationChecklistLabel,
  type CourseApplicationChecklistItem,
  type CourseApplicationChecklistValues,
} from "@shared/courseApplicationChecklist";

type Props = {
  items: readonly CourseApplicationChecklistItem[];
  values: CourseApplicationChecklistValues;
  disabled?: boolean;
  onToggle: (itemId: string, checked: boolean) => void;
};

export default function CourseApplicationChecklist({
  items,
  values,
  disabled = false,
  onToggle,
}: Props) {
  return (
    <div
      role="group"
      className="mt-2 flex flex-wrap gap-1.5"
      aria-label="강좌 신청 확인 항목"
    >
      {items.map(item => {
        const checked = values[item.id] === true;
        const label = getCourseApplicationChecklistLabel(item, checked);
        return (
          <button
            key={item.id}
            type="button"
            aria-label={getCourseApplicationChecklistControlLabel(item)}
            aria-pressed={checked}
            title={`${label} 상태를 변경합니다.`}
            disabled={disabled}
            onClick={() => onToggle(item.id, !checked)}
            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
              checked
                ? "border-green-200 bg-green-50 text-[#1B5E20] hover:bg-green-100"
                : "border-gray-200 bg-white text-gray-500 hover:bg-gray-50"
            }`}
          >
            {checked ? (
              <CheckCircle2 className="h-3.5 w-3.5" />
            ) : (
              <Circle className="h-3.5 w-3.5" />
            )}
            {label}
          </button>
        );
      })}
    </div>
  );
}
