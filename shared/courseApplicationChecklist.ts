export const COURSE_APPLICATION_CHECKLIST_FIELDS = [
  "feePaid",
  "documentsSubmitted",
] as const;

export type CourseApplicationChecklistField =
  (typeof COURSE_APPLICATION_CHECKLIST_FIELDS)[number];

export const COURSE_APPLICATION_CHECKLIST_DEFAULTS = {
  feePaid: false,
  documentsSubmitted: false,
} as const;

export const COURSE_APPLICATION_CHECKLIST_LABELS = {
  feePaid: {
    control: "회비 납부 여부",
    checked: "회비 납부",
    unchecked: "회비 미확인",
  },
  documentsSubmitted: {
    control: "서류 제출 여부",
    checked: "서류 제출",
    unchecked: "서류 미확인",
  },
} as const satisfies Record<
  CourseApplicationChecklistField,
  { control: string; checked: string; unchecked: string }
>;

export function getCourseApplicationChecklistLabel(
  field: CourseApplicationChecklistField,
  checked: boolean
) {
  const labels = COURSE_APPLICATION_CHECKLIST_LABELS[field];
  return checked ? labels.checked : labels.unchecked;
}
