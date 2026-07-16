export const COURSE_APPLICATION_CHECKLIST_FIELDS = [
  "feePaid",
  "documentsSubmitted",
] as const;

export type CourseApplicationChecklistField =
  (typeof COURSE_APPLICATION_CHECKLIST_FIELDS)[number];

export type CourseApplicationChecklistItem = {
  id: string;
  label: string;
};

export type CourseApplicationChecklistValues = Record<string, boolean>;

export const MAX_COURSE_APPLICATION_CHECKLIST_ITEMS = 12;

export const DEFAULT_COURSE_APPLICATION_CHECKLIST_ITEMS: CourseApplicationChecklistItem[] = [
  { id: "feePaid", label: "회비 납부" },
  { id: "documentsSubmitted", label: "서류 제출" },
];

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
  field: CourseApplicationChecklistField | CourseApplicationChecklistItem,
  checked: boolean
) {
  if (typeof field === "string") {
    const labels = COURSE_APPLICATION_CHECKLIST_LABELS[field];
    return checked ? labels.checked : labels.unchecked;
  }
  if (checked) return field.label;
  if (field.id === "feePaid" && field.label === "회비 납부") return "회비 미확인";
  if (field.id === "documentsSubmitted" && field.label === "서류 제출") return "서류 미확인";
  const baseLabel = field.label.replace(/\s+(납부|제출|수령|확인|완료)$/, "");
  return `${baseLabel || field.label} 미확인`;
}

export function getCourseApplicationChecklistControlLabel(item: CourseApplicationChecklistItem) {
  return item.label.endsWith("여부") ? item.label : `${item.label} 여부`;
}

export function getCourseApplicationChecklistCsvValue(
  item: CourseApplicationChecklistItem,
  checked: boolean,
) {
  if (!checked) return "미확인";
  if (item.id === "feePaid" && item.label === "회비 납부") return "납부";
  if (item.id === "documentsSubmitted" && item.label === "서류 제출") return "제출";
  return "완료";
}

export function isLegacyCourseApplicationChecklistField(
  value: string,
): value is CourseApplicationChecklistField {
  return (COURSE_APPLICATION_CHECKLIST_FIELDS as readonly string[]).includes(value);
}

export function buildCourseApplicationChecklistValues({
  feePaid,
  documentsSubmitted,
  storedValues = {},
}: {
  feePaid: boolean;
  documentsSubmitted: boolean;
  storedValues?: CourseApplicationChecklistValues;
}): CourseApplicationChecklistValues {
  return {
    feePaid: Boolean(feePaid),
    documentsSubmitted: Boolean(documentsSubmitted),
    ...storedValues,
  };
}
