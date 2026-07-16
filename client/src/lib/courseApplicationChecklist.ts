import {
  buildCourseApplicationChecklistValues,
  isLegacyCourseApplicationChecklistField,
  type CourseApplicationChecklistValues,
} from "@shared/courseApplicationChecklist";

type CourseApplicationChecklistApplication = {
  id: number;
  feePaid: boolean;
  documentsSubmitted: boolean;
  checklistValues?: CourseApplicationChecklistValues;
};

export function escapeCourseApplicationCsvCell(value: unknown) {
  const text = String(value ?? "").replace(/\r?\n/g, " ").trim();
  const spreadsheetSafeText = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return /[",\n]/.test(spreadsheetSafeText)
    ? `"${spreadsheetSafeText.replace(/"/g, '""')}"`
    : spreadsheetSafeText;
}

export function getCourseApplicationChecklistValues(
  application: CourseApplicationChecklistApplication,
) {
  return buildCourseApplicationChecklistValues({
    feePaid: application.feePaid,
    documentsSubmitted: application.documentsSubmitted,
    storedValues: application.checklistValues,
  });
}

export function getCourseApplicationChecklistValue(
  application: CourseApplicationChecklistApplication,
  itemId: string,
) {
  return getCourseApplicationChecklistValues(application)[itemId] === true;
}

export function applyCourseApplicationChecklistChange<
  T extends CourseApplicationChecklistApplication,
>(
  applications: T[] | undefined,
  id: number,
  itemId: string,
  checked: boolean,
) {
  if (!applications) return applications;
  return applications.map(application => {
    if (application.id !== id) return application;
    const updated = {
      ...application,
      checklistValues: {
        ...getCourseApplicationChecklistValues(application),
        [itemId]: checked,
      },
    };
    if (isLegacyCourseApplicationChecklistField(itemId)) {
      updated[itemId] = checked;
    }
    return updated as T;
  });
}
