import { describe, expect, it } from "vitest";
import { getInitialStaffCategory } from "./ChurchIntro";

describe("getInitialStaffCategory", () => {
  it("opens the category requested by an internal search result", () => {
    expect(getInitialStaffCategory("/about/staff", "?category=elder")).toBe("elder");
  });

  it("keeps the dedicated associate route as its fallback", () => {
    expect(getInitialStaffCategory("/about/staff/associate", "")).toBe("associate");
  });
});
