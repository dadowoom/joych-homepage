import { describe, expect, it } from "vitest";
import {
  COURSE_APPLICATION_CHECKLIST_DEFAULTS,
  DEFAULT_COURSE_APPLICATION_CHECKLIST_ITEMS,
  getCourseApplicationChecklistCsvValue,
  getCourseApplicationChecklistLabel,
} from "@shared/courseApplicationChecklist";
import {
  applyCourseApplicationChecklistChange,
  escapeCourseApplicationCsvCell,
  getCourseApplicationChecklistValue,
} from "./courseApplicationChecklist";

describe("course application checklist", () => {
  const applications = [
    {
      id: 1,
      feePaid: false,
      documentsSubmitted: false,
      checklistValues: { feePaid: false, documentsSubmitted: false, check_orientation: false },
      name: "첫 번째",
    },
    {
      id: 2,
      feePaid: true,
      documentsSubmitted: false,
      checklistValues: { feePaid: true, documentsSubmitted: false, check_orientation: true },
      name: "두 번째",
    },
  ];

  it("changes only the requested applicant and dynamic item", () => {
    const updated = applyCourseApplicationChecklistChange(
      applications,
      1,
      "check_orientation",
      true,
    );

    expect(updated?.[0].checklistValues).toMatchObject({
      feePaid: false,
      documentsSubmitted: false,
      check_orientation: true,
    });
    expect(updated?.[1]).toBe(applications[1]);
    expect(applications[0].checklistValues.check_orientation).toBe(false);
  });

  it("keeps legacy boolean fields in sync", () => {
    const updated = applyCourseApplicationChecklistChange(
      applications,
      2,
      "feePaid",
      false,
    );

    expect(updated?.[1]).toMatchObject({
      feePaid: false,
      documentsSubmitted: false,
      checklistValues: { feePaid: false, documentsSubmitted: false },
    });
  });

  it("reads legacy values when a checklistValues map is missing", () => {
    expect(getCourseApplicationChecklistValue({
      id: 3,
      feePaid: true,
      documentsSubmitted: false,
    }, "feePaid")).toBe(true);
  });

  it("uses clear labels for default and custom items", () => {
    expect(getCourseApplicationChecklistLabel("feePaid", true)).toBe("회비 납부");
    expect(getCourseApplicationChecklistLabel("feePaid", false)).toBe("회비 미확인");
    expect(getCourseApplicationChecklistLabel({ id: "check_orientation", label: "오리엔테이션 참석" }, true)).toBe("오리엔테이션 참석");
    expect(getCourseApplicationChecklistLabel({ id: "check_orientation", label: "오리엔테이션 참석" }, false)).toBe("오리엔테이션 참석 미확인");
  });

  it("provides stable defaults and CSV values", () => {
    expect(COURSE_APPLICATION_CHECKLIST_DEFAULTS).toEqual({
      feePaid: false,
      documentsSubmitted: false,
    });
    expect(DEFAULT_COURSE_APPLICATION_CHECKLIST_ITEMS.map(item => item.id)).toEqual([
      "feePaid",
      "documentsSubmitted",
    ]);
    expect(getCourseApplicationChecklistCsvValue(DEFAULT_COURSE_APPLICATION_CHECKLIST_ITEMS[0], true)).toBe("납부");
    expect(getCourseApplicationChecklistCsvValue({ id: "check_orientation", label: "오리엔테이션 참석" }, true)).toBe("완료");
    expect(getCourseApplicationChecklistCsvValue({ id: "check_orientation", label: "오리엔테이션 참석" }, false)).toBe("미확인");
    expect(getCourseApplicationChecklistCsvValue({ id: "feePaid", label: "교재 수령" }, true)).toBe("완료");
  });

  it("neutralizes spreadsheet formulas in exported applicant values", () => {
    expect(escapeCourseApplicationCsvCell("=HYPERLINK(\"https://example.com\")")).toBe(
      "\"'=HYPERLINK(\"\"https://example.com\"\")\"",
    );
    expect(escapeCourseApplicationCsvCell("+821012345678")).toBe("'+821012345678");
  });
});
