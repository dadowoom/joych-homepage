import { describe, expect, it } from "vitest";
import { getStoragePublicUrlBase } from "./storage";

describe("storage public URL base", () => {
  it.each([
    "https://joych.org",
    "https://www.joych.org/",
    "https://m.joych.org",
    "https://newjoych.co.kr",
    "https://www.newjoych.co.kr/",
  ])("uses the primary www origin for a known site alias: %s", configured => {
    expect(getStoragePublicUrlBase(configured)).toBe(
      "https://www.joych.org"
    );
  });

  it("preserves a custom deployment URL", () => {
    expect(getStoragePublicUrlBase("https://church.example.com/base/")).toBe(
      "https://church.example.com/base"
    );
  });

  it("preserves the local development URL", () => {
    expect(getStoragePublicUrlBase("http://localhost:3000/")).toBe(
      "http://localhost:3000"
    );
  });
});
