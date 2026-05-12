import { describe, expect, it } from "vitest";
import {
  FALLBACK_NAV_ITEMS,
  getInternalPagePaths,
  toFallbackMenuTree,
} from "@shared/siteNavigation";

function getFallbackHrefs() {
  return FALLBACK_NAV_ITEMS.flatMap(item =>
    item.sub
      .map(label => item.subHref[label])
      .filter((href): href is string => Boolean(href))
  );
}

describe("siteNavigation registry", () => {
  it("기본 헤더 메뉴는 숫자 기반 CMS 레거시 URL을 사용하지 않는다", () => {
    for (const href of getFallbackHrefs()) {
      expect(href).not.toContain("/page/item/");
      expect(href).not.toContain("/page/sub/");
    }
  });

  it("기본 헤더 메뉴의 내부 경로는 관리자 기존 페이지 목록에 포함된다", () => {
    const internalPaths = new Set(getInternalPagePaths());

    for (const href of getFallbackHrefs()) {
      if (href.startsWith("/")) {
        expect(internalPaths.has(href)).toBe(true);
      }
    }
  });

  it("공유 기본 메뉴 트리는 헤더 렌더링에 필요한 구조를 가진다", () => {
    const tree = toFallbackMenuTree();

    expect(tree.length).toBe(FALLBACK_NAV_ITEMS.length);
    expect(tree[0].label).toBe("교회소개");
    expect(tree.every(menu => Array.isArray(menu.items))).toBe(true);
  });
});
