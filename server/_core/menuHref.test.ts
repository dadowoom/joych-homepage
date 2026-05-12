import { describe, expect, it } from "vitest";
import { makeMenuPageHref, makeMenuPageSlug, makeUniqueMenuPageHref } from "./menuHref";

describe("menuHref", () => {
  it("builds readable CMS page paths from menu labels", () => {
    expect(makeMenuPageSlug(["교회소개", "담임목사 인사"])).toBe("교회소개-담임목사-인사");
    expect(makeMenuPageHref(["조이풀TV", "주일예배"])).toBe("/page/조이풀tv-주일예배");
  });

  it("does not expose database ids for ordinary new pages", () => {
    const href = makeUniqueMenuPageHref(["커뮤니티", "새 소식"], [
      { href: "/about/pastor" },
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
