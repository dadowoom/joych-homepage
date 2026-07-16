import { describe, expect, it } from "vitest";
import {
  COURSE_APPLICATION_CHECKLIST_DEFAULTS,
  getCourseApplicationChecklistLabel,
} from "@shared/courseApplicationChecklist";
import { applyCourseApplicationChecklistChange } from "./courseApplicationChecklist";

describe("course application checklist", () => {
  const applications = [
    { id: 1, feePaid: false, documentsSubmitted: false, name: "첫 번째" },
    { id: 2, feePaid: true, documentsSubmitted: false, name: "두 번째" },
  ];

  it("changes only the requested applicant and field", () => {
    const updated = applyCourseApplicationChecklistChange(
      applications,
      1,
      "feePaid",
      true
    );

    expect(updated).toEqual([
      { id: 1, feePaid: true, documentsSubmitted: false, name: "첫 번째" },
      applications[1],
    ]);
    expect(applications[0].feePaid).toBe(false);
  });

  it("can roll a completed state back to unchecked without changing the other check", () => {
    const updated = applyCourseApplicationChecklistChange(
      applications,
      2,
      "feePaid",
      false
    );

    expect(updated?.[1]).toMatchObject({
      feePaid: false,
      documentsSubmitted: false,
    });
  });

  it("uses clear labels for checked and unchecked states", () => {
    expect(getCourseApplicationChecklistLabel("feePaid", true)).toBe(
      "회비 납부"
    );
    expect(getCourseApplicationChecklistLabel("feePaid", false)).toBe(
      "회비 미확인"
    );
    expect(getCourseApplicationChecklistLabel("documentsSubmitted", true)).toBe(
      "서류 제출"
    );
    expect(
      getCourseApplicationChecklistLabel("documentsSubmitted", false)
    ).toBe("서류 미확인");
  });

  it("starts every new application cycle with unchecked states", () => {
    expect(COURSE_APPLICATION_CHECKLIST_DEFAULTS).toEqual({
      feePaid: false,
      documentsSubmitted: false,
    });
  });
});
