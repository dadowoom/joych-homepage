import { describe, expect, it } from "vitest";
import { formatPhoneNumber } from "./phoneNumber";
import {
  formatMemberPhoneInput,
  normalizeLegacyMemberPhone,
  normalizeMemberPhone,
} from "@shared/memberPhone";

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

  it("converts an exact legacy +82 mobile number but keeps nonstandard values unchanged", () => {
    expect(formatPhoneNumber("+82 10-1234-5678")).toBe("010-1234-5678");
    expect(formatPhoneNumber("02-1234-5678 내선 1")).toBe("02-1234-5678 내선 1");
  });

  it("returns an empty string for a missing value", () => {
    expect(formatPhoneNumber(null)).toBe("");
    expect(formatPhoneNumber("   ")).toBe("");
  });
});

describe("member phone normalization", () => {
  it.each([
    ["01012345678", "010-1234-5678"],
    ["010-1234-5678", "010-1234-5678"],
    ["(010) 1234 5678", "010-1234-5678"],
  ])("normalizes a domestic 010 number: %s", (input, expected) => {
    expect(normalizeMemberPhone(input)).toBe(expected);
  });

  it.each([
    "+82 10-1234-5678",
    "02-1234-5678",
    "011-1234-5678",
    "010-123-5678",
    "010-1234-5678 내선 1",
  ])("rejects a non-010 signup value: %s", (input) => {
    expect(normalizeMemberPhone(input)).toBeNull();
  });

  it("only converts an unambiguous legacy international 010 number", () => {
    expect(normalizeLegacyMemberPhone("+821012345678")).toBe("010-1234-5678");
    expect(normalizeLegacyMemberPhone("+82 (0)10-1234-5678")).toBeNull();
    expect(normalizeLegacyMemberPhone("+82 54-123-4567")).toBeNull();
  });

  it("formats digits while typing", () => {
    expect(formatMemberPhoneInput("01012345678")).toBe("010-1234-5678");
    const tooLong = formatMemberPhoneInput("010-1234-567890");
    expect(tooLong).toBe("010-1234-567890");
    expect(normalizeMemberPhone(tooLong)).toBeNull();
  });
});
