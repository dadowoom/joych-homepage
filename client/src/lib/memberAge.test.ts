import { describe, expect, it } from "vitest";
import { formatBirthDateWithFullAge, getFullAge } from "./memberAge";

describe("member age helpers", () => {
  it("calculates full age before and after the birthday", () => {
    expect(getFullAge("1990-08-04", new Date(2026, 7, 4))).toBe(36);
    expect(getFullAge("1990-08-05", new Date(2026, 7, 4))).toBe(35);
  });

  it("does not calculate an age for invalid or future birth dates", () => {
    expect(getFullAge("2026-02-29", new Date(2026, 7, 4))).toBeNull();
    expect(getFullAge("2027-01-01", new Date(2026, 7, 4))).toBeNull();
  });

  it("formats a birth date with the Korean full-age label", () => {
    expect(formatBirthDateWithFullAge("1990-08-04", new Date(2026, 7, 4)))
      .toBe("1990-08-04 (만 36세)");
  });
});
