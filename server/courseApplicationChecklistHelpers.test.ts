import { describe, expect, it } from "vitest";
import {
  DEFAULT_COURSE_APPLICATION_CHECKLIST_ITEMS,
  MAX_COURSE_APPLICATION_CHECKLIST_ITEMS,
  buildCourseApplicationChecklistValues,
  getCourseApplicationChecklistCsvValue,
  getCourseApplicationChecklistLabel,
  isLegacyCourseApplicationChecklistField,
} from "@shared/courseApplicationChecklist";

describe("configurable course application checklist helpers", () => {
  it("keeps the two legacy checks as the initial configuration", () => {
    expect(DEFAULT_COURSE_APPLICATION_CHECKLIST_ITEMS.map(item => item.id)).toEqual([
      "feePaid",
      "documentsSubmitted",
    ]);
    expect(MAX_COURSE_APPLICATION_CHECKLIST_ITEMS).toBeGreaterThanOrEqual(2);
  });

  it("merges stored custom values while preserving legacy compatibility", () => {
    expect(
      buildCourseApplicationChecklistValues({
        feePaid: true,
        documentsSubmitted: false,
        storedValues: {
          check_interview: true,
          documentsSubmitted: true,
        },
      }),
    ).toEqual({
      feePaid: true,
      documentsSubmitted: true,
      check_interview: true,
    });
  });

  it("distinguishes protected legacy keys from configurable custom keys", () => {
    expect(isLegacyCourseApplicationChecklistField("feePaid")).toBe(true);
    expect(isLegacyCourseApplicationChecklistField("documentsSubmitted")).toBe(true);
    expect(isLegacyCourseApplicationChecklistField("check_interview")).toBe(false);
  });

  it("provides checked and unchecked text for a custom checklist item", () => {
    const item = { id: "check_interview", label: "Interview" };

    expect(getCourseApplicationChecklistLabel(item, true)).toBe("Interview");
    expect(getCourseApplicationChecklistLabel(item, false)).not.toBe("Interview");
    expect(getCourseApplicationChecklistCsvValue(item, true)).not.toBe(
      getCourseApplicationChecklistCsvValue(item, false),
    );
  });
});
