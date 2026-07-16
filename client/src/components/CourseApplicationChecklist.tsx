import { CheckCircle2, Circle } from "lucide-react";
import {
  COURSE_APPLICATION_CHECKLIST_FIELDS,
  COURSE_APPLICATION_CHECKLIST_LABELS,
  getCourseApplicationChecklistLabel,
  type CourseApplicationChecklistField,
} from "@shared/courseApplicationChecklist";

type Props = {
  feePaid: boolean;
  documentsSubmitted: boolean;
  disabled?: boolean;
  onToggle: (field: CourseApplicationChecklistField, checked: boolean) => void;
};

export default function CourseApplicationChecklist({
  feePaid,
  documentsSubmitted,
  disabled = false,
  onToggle,
}: Props) {
  const values: Record<CourseApplicationChecklistField, boolean> = {
    feePaid,
    documentsSubmitted,
  };

  return (
    <div
      role="group"
      className="mt-2 flex flex-wrap gap-1.5"
      aria-label="강좌 신청 확인 항목"
    >
      {COURSE_APPLICATION_CHECKLIST_FIELDS.map(field => {
        const checked = values[field];
        const label = getCourseApplicationChecklistLabel(field, checked);
        return (
          <button
            key={field}
            type="button"
            aria-label={COURSE_APPLICATION_CHECKLIST_LABELS[field].control}
            aria-pressed={checked}
            title={`${label} 상태를 변경합니다.`}
            disabled={disabled}
            onClick={() => onToggle(field, !checked)}
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
