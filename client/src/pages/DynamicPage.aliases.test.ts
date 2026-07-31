import React from "react";
import { beforeAll, describe, expect, it } from "vitest";

let getCodeBackedPageAlias: typeof import("./DynamicPage").getCodeBackedPageAlias;

describe("dynamic page code-backed aliases", () => {
  beforeAll(async () => {
    globalThis.React = React;
    ({ getCodeBackedPageAlias } = await import("./DynamicPage"));
  });

  it.each([
    "/page/교회소개-예배-안내",
    "/page/%EA%B5%90%ED%9A%8C%EC%86%8C%EA%B0%9C-%EC%98%88%EB%B0%B0-%EC%95%88%EB%82%B4",
  ])("keeps the canonical Korean worship guide %s", (href) => {
    expect(getCodeBackedPageAlias(href)).toBeNull();
  });

  it("redirects the old Korean worship guide spelling to the canonical Korean URL", () => {
    expect(getCodeBackedPageAlias("/page/교회소개-예배안내"))
      .toBe("/page/교회소개-예배-안내");
  });
});
