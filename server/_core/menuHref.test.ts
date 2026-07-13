import { describe, expect, it } from "vitest";
import {
  isLegacyKoreanCmsPageHref,
  makeMenuPageHref,
  makeMenuPageSlug,
  makeUniqueMenuPageHref,
} from "./menuHref";

describe("menuHref", () => {
  it("recognises a legacy Korean CMS path but leaves standard routes alone", () => {
    expect(isLegacyKoreanCmsPageHref("/교회소개/3대-비전-9대-전략1")).toBe(true);
    expect(isLegacyKoreanCmsPageHref("/page/교회소개-3대-비전-9대-전략1")).toBe(false);
    expect(isLegacyKoreanCmsPageHref("/worship/schedule")).toBe(false);
    expect(isLegacyKoreanCmsPageHref("https://example.com/교회소개")).toBe(false);
  });

  it("builds readable CMS page paths from menu labels", () => {
    expect(makeMenuPageSlug(["교회소개", "담임목사 인사"])).toBe("교회소개-담임목사-인사");
    expect(makeMenuPageHref(["조이풀TV", "주일예배"])).toBe("/page/조이풀tv-주일예배");
  });

  it("does not expose database ids for ordinary new pages", () => {
    const href = makeUniqueMenuPageHref(["커뮤니티", "새 소식"], [
      { href: "/page/교회소개-담임목사-소개" },
      { href: "/page/커뮤니티-기존" },
    ]);
    expect(href).toBe("/page/커뮤니티-새-소식");
    expect(href).not.toMatch(/\/\d+$/);
  });

  it("keeps generated hrefs unique when labels collide", () => {
    const href = makeUniqueMenuPageHref(["커뮤니티", "새 소식"], [
      { href: "/page/커뮤니티-새-소식" },
    ]);
    expect(href).toBe("/page/커뮤니티-새-소식-page");
  });
});
