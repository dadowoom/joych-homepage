import { describe, expect, it } from "vitest";
import { getAcademyCoursePath, PUBLIC_MENU_PATHS } from "@shared/publicMenuRoutes";
import {
  findCourseRoomBySlug,
  getCanonicalCourseHref,
  isCourseMenuItemWithinTopMenu,
  isCourseTopMenuLabel,
} from "./courseRoutes";

const currentCourseMenu = [
  {
    id: 60006,
    label: "교육·신청",
    items: [
      { id: 180016, label: "조이아카데미", href: PUBLIC_MENU_PATHS.academy },
      { id: 180037, label: "제자반", href: PUBLIC_MENU_PATHS.discipleCourse },
      { id: 180038, label: "리더십반", href: PUBLIC_MENU_PATHS.leadershipCourse },
      { id: 180039, label: "생선컨퍼런스", href: PUBLIC_MENU_PATHS.saengseonConference },
    ],
  },
];

describe("course menu routes", () => {
  it.each(["강좌", "교육·신청", "교육 · 신청"])("recognizes the course top menu %s", (label) => {
    expect(isCourseTopMenuLabel(label)).toBe(true);
  });

  it.each([
    ["조이아카데미", PUBLIC_MENU_PATHS.academy],
    ["제자반", PUBLIC_MENU_PATHS.discipleCourse],
    ["리더십반", PUBLIC_MENU_PATHS.leadershipCourse],
    ["생선컨퍼런스", PUBLIC_MENU_PATHS.saengseonConference],
  ])("keeps the requested Korean URL for %s", (label, expectedHref) => {
    expect(getCanonicalCourseHref(label, `/page/강좌-${label}`)).toBe(expectedHref);
  });

  it("keeps future custom course rooms under the academy route", () => {
    expect(getCanonicalCourseHref("새가족반", "/page/강좌-새가족반"))
      .toBe(getAcademyCoursePath("새가족반"));
  });

  it("recognizes current course menu items as course pages", () => {
    expect(isCourseMenuItemWithinTopMenu(currentCourseMenu, PUBLIC_MENU_PATHS.discipleCourse)).toBe(true);
    expect(isCourseMenuItemWithinTopMenu(currentCourseMenu, "/page/강좌-제자반")).toBe(true);
    expect(findCourseRoomBySlug(currentCourseMenu, "제자반")).toEqual({
      label: "제자반",
      href: PUBLIC_MENU_PATHS.discipleCourse,
    });
  });

  it("does not classify an unrelated image page as a course page", () => {
    expect(isCourseMenuItemWithinTopMenu(currentCourseMenu, "/page/교회소개-교회-연혁")).toBe(false);
  });
});
