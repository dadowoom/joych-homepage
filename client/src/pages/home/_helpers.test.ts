import { describe, expect, it } from "vitest";
import { getUsableHref, isExternalHref } from "./_helpers";

describe("home link helpers", () => {
  it.each([
    "https://joych.org/about/history",
    "https://www.joych.org/about/history",
    "https://m.joych.org/about/history",
    "https://newjoych.co.kr/about/history",
    "https://www.newjoych.co.kr/about/history",
  ])("normalizes a DB-saved internal absolute URL: %s", href => {
    expect(getUsableHref(href, "/")).toBe("/about/history");
    expect(isExternalHref(href)).toBe(false);
  });

  it("keeps an external URL and marks it external", () => {
    const href = "https://example.com/news";
    expect(getUsableHref(href, "/")).toBe(href);
    expect(isExternalHref(href)).toBe(true);
  });

  it("uses a normalized fallback for an empty or placeholder URL", () => {
    expect(
      getUsableHref("#", "https://newjoych.co.kr/worship/schedule")
    ).toBe("/worship/schedule");
  });
});
