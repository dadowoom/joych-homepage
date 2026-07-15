import { describe, expect, it } from "vitest";
import { formatPhoneNumber } from "./phoneNumber";

describe("formatPhoneNumber", () => {
  it.each([
    ["01012345678", "010-1234-5678"],
    ["010-1234-5678", "010-1234-5678"],
    [" 010 1234 5678 ", "010-1234-5678"],
    ["0212345678", "02-1234-5678"],
    ["021234567", "02-123-4567"],
    ["0541234567", "054-123-4567"],
    ["05412345678", "054-1234-5678"],
    ["15881234", "1588-1234"],
  ])("formats %s as %s", (input, expected) => {
    expect(formatPhoneNumber(input)).toBe(expected);
  });

  it("keeps international and nonstandard values unchanged", () => {
    expect(formatPhoneNumber("+82 10-1234-5678")).toBe("+82 10-1234-5678");
    expect(formatPhoneNumber("02-1234-5678 내선 1")).toBe("02-1234-5678 내선 1");
  });

  it("returns an empty string for a missing value", () => {
    expect(formatPhoneNumber(null)).toBe("");
    expect(formatPhoneNumber("   ")).toBe("");
  });
});
