import { describe, expect, it } from "vitest";
import { getCourseFacilityRepeatOptions } from "./CourseFacilityScheduleFields";

describe("course facility custom date option visibility", () => {
  it("shows arbitrary date selection only when explicitly allowed", () => {
    expect(getCourseFacilityRepeatOptions(true).map(option => option.value)).toContain("custom");
  });

  it("removes arbitrary date selection when permission is absent", () => {
    const options = getCourseFacilityRepeatOptions(false);

    expect(options.map(option => option.value)).not.toContain("custom");
    expect(options.map(option => option.label)).not.toContain("임의 날짜 선택");
  });
});
