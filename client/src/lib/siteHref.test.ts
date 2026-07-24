import { describe, expect, it } from "vitest";
import {
  isExternalSiteHref,
  normalizeSiteHref,
} from "./siteHref";

describe("siteHref", () => {
  it.each([
    "https://joych.org/about/history",
    "https://www.joych.org/about/history",
    "https://m.joych.org/about/history",
    "https://newjoych.co.kr/about/history",
    "https://www.newjoych.co.kr/about/history",
  ])("normalizes known production hosts as internal: %s", href => {
    expect(normalizeSiteHref(href)).toBe("/about/history");
    expect(isExternalSiteHref(href)).toBe(false);
  });

  it("keeps unrelated domains external", () => {
    const href = "https://example.com/about/history";
    expect(normalizeSiteHref(href)).toBe(href);
    expect(isExternalSiteHref(href)).toBe(true);
  });

  it("keeps path, query and hash while removing a known production origin", () => {
    expect(
      normalizeSiteHref(
        "https://newjoych.co.kr/worship/tv?category=sunday#latest"
      )
    ).toBe("/worship/tv?category=sunday#latest");
  });

  it.each([
    "javascript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
  ])("blocks unsafe browser link protocols: %s", href => {
    expect(normalizeSiteHref(href)).toBeNull();
    expect(isExternalSiteHref(href)).toBe(false);
  });
});
