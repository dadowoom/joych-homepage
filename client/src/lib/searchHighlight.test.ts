import { describe, expect, it } from "vitest";
import { splitSearchHighlightParts } from "./searchHighlight";

describe("search result text highlighting", () => {
  it("highlights every Korean occurrence", () => {
    expect(splitSearchHighlightParts("연일복지관과 연일 노선", "연일")).toEqual([
      { text: "연일", isMatch: true },
      { text: "복지관과 ", isMatch: false },
      { text: "연일", isMatch: true },
      { text: " 노선", isMatch: false },
    ]);
  });

  it("matches English without changing the original case", () => {
    expect(splitSearchHighlightParts("Grace and GRACE", "grace")).toEqual([
      { text: "Grace", isMatch: true },
      { text: " and ", isMatch: false },
      { text: "GRACE", isMatch: true },
    ]);
  });

  it("treats regular-expression characters as literal text", () => {
    expect(splitSearchHighlightParts("과정 a+b[1] 신청", "a+b[1]")).toEqual([
      { text: "과정 ", isMatch: false },
      { text: "a+b[1]", isMatch: true },
      { text: " 신청", isMatch: false },
    ]);
  });

  it("matches phrases even when whitespace is repeated", () => {
    expect(splitSearchHighlightParts("연일   복지관 시간표", "연일  복지관")).toEqual([
      { text: "연일   복지관", isMatch: true },
      { text: " 시간표", isMatch: false },
    ]);
  });

  it("keeps HTML-looking input as plain text parts", () => {
    expect(splitSearchHighlightParts('<img src=x onerror="alert(1)">', "onerror")).toEqual([
      { text: '<img src=x ', isMatch: false },
      { text: "onerror", isMatch: true },
      { text: '="alert(1)">', isMatch: false },
    ]);
  });

  it("returns unmarked text for an empty or missing keyword", () => {
    expect(splitSearchHighlightParts("검색 결과", "  ")).toEqual([
      { text: "검색 결과", isMatch: false },
    ]);
    expect(splitSearchHighlightParts("검색 결과", "없는말")).toEqual([
      { text: "검색 결과", isMatch: false },
    ]);
  });
});
