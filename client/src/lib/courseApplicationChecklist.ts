import type { CourseApplicationChecklistField } from "@shared/courseApplicationChecklist";

type CourseApplicationChecklistItem = {
  id: number;
  feePaid: boolean;
  documentsSubmitted: boolean;
};

export function applyCourseApplicationChecklistChange<
  T extends CourseApplicationChecklistItem,
>(
  applications: T[] | undefined,
  id: number,
  field: CourseApplicationChecklistField,
  checked: boolean
) {
  if (!applications) return applications;
  return applications.map(application =>
    application.id === id
      ? ({ ...application, [field]: checked } as T)
      : application
  );
}
