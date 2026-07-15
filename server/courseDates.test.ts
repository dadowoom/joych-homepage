import { describe, expect, it } from "vitest";
import { courseBaseSchema } from "./routers/cms/courses";
import { courseCreateSchema } from "./routers/courseManagement";

const pastCourse = {
  title: "Past course",
  startDate: "2000-01-01",
  endDate: "2000-01-01",
  applyStartDate: "2000-01-01",
  applyEndDate: "2000-01-01",
};

describe("course creation date guard", () => {
  it("rejects past dates in the main administrator course API", () => {
    expect(courseBaseSchema.safeParse(pastCourse).success).toBe(false);
  });

  it("rejects past dates in the course room manager API", () => {
    expect(courseCreateSchema.safeParse(pastCourse).success).toBe(false);
  });
});
