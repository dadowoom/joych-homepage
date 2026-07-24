import { describe, expect, it } from "vitest";
import { getCanonicalPublicMenuHref } from "./db/menu";

describe("예배 안내 공개 메뉴 주소", () => {
  it("교회소개 아래 예배 안내는 저장된 이전 주소와 관계없이 공식 페이지로 연결한다", () => {
    expect(
      getCanonicalPublicMenuHref(
        "예배 안내",
        "/page/교회소개-3대-비전",
        "교회소개"
      )
    ).toBe("/worship/schedule");
  });

  it("다른 상위 메뉴의 같은 이름은 임의로 변경하지 않는다", () => {
    expect(
      getCanonicalPublicMenuHref(
        "예배 안내",
        "/page/행정지원-예배-안내",
        "행정지원"
      )
    ).toBe("/page/행정지원-예배-안내");
  });

  it("기존 예배 안내 주소도 공식 페이지로 연결한다", () => {
    expect(
      getCanonicalPublicMenuHref(
        "예배 안내",
        "/page/교회소개-예배-안내"
      )
    ).toBe("/worship/schedule");
  });
});
