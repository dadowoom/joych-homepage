import { describe, expect, it } from "vitest";
import { STATIC_PAGE_SEEDS, getStaticPageSeed } from "@shared/staticPageContent";

describe("staticPageContent registry", () => {
  it("등록된 정적 페이지 href가 중복되지 않는다", () => {
    const hrefs = STATIC_PAGE_SEEDS.map((page) => page.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it("사역/양육 페이지 기본 콘텐츠가 CMS seed에 포함되어 있다", () => {
    expect(getStaticPageSeed("/education/hesed")?.content.name).toBe("헤세드아시아포재팬");
    expect(getStaticPageSeed("/ministry/world-mission")?.content.name).toBe("세계선교부");
  });

  it("등록되지 않은 href는 조회되지 않는다", () => {
    expect(getStaticPageSeed("/admin_joych_2026")).toBeNull();
  });
});
