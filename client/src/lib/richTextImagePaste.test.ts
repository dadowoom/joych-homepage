import { describe, expect, it } from "vitest";
import { extractPlainTextPastedImageUrls } from "./richTextImagePaste";

describe("extractPlainTextPastedImageUrls", () => {
  it("extracts multiple image URLs in their pasted order", () => {
    const html = [
      '<img src="https://photo.joych.org/photo/2026/0628/2.jpg"><br>',
      '<img src="https://photo.joych.org/photo/2026/0628/3.jpg"><br>',
      '<img src="https://photo.joych.org/photo/2026/0628/2.jpg"><br>',
    ].join("\n");

    expect(extractPlainTextPastedImageUrls(html)).toEqual([
      "https://photo.joych.org/photo/2026/0628/2.jpg",
      "https://photo.joych.org/photo/2026/0628/3.jpg",
      "https://photo.joych.org/photo/2026/0628/2.jpg",
    ]);
  });

  it("accepts malformed empty paragraph noise from legacy Excel lists", () => {
    const html = '<img src="https://photo.joych.org/photo/2026/0628/2.jpg"><p/>.</p/><br>';

    expect(extractPlainTextPastedImageUrls(html)).toEqual([
      "https://photo.joych.org/photo/2026/0628/2.jpg",
    ]);
  });

  it("accepts entity-escaped image markup", () => {
    const html = '&lt;img src=&quot;https://photo.joych.org/photo/2026/0628/2.jpg&quot;&gt;';

    expect(extractPlainTextPastedImageUrls(html)).toEqual([
      "https://photo.joych.org/photo/2026/0628/2.jpg",
    ]);
  });

  it("drops script blocks and image event attributes by returning URLs only", () => {
    const html =
      '<img src="https://photo.joych.org/photo/2026/0628/2.jpg" onerror="alert(1)" onclick="alert(2)">' +
      "<script>alert(3)</script><br>";

    expect(extractPlainTextPastedImageUrls(html)).toEqual([
      "https://photo.joych.org/photo/2026/0628/2.jpg",
    ]);
  });

  it("leaves ordinary text, bare URLs, and image examples as normal text", () => {
    expect(extractPlainTextPastedImageUrls("일반 공지 내용입니다.")).toBeNull();
    expect(extractPlainTextPastedImageUrls("https://photo.joych.org/photo/2026/0628/2.jpg")).toBeNull();
    expect(
      extractPlainTextPastedImageUrls('예시: <img src="https://example.com/a.jpg"> 입니다'),
    ).toBeNull();
    expect(extractPlainTextPastedImageUrls("<p>안내 문구입니다.</p>")).toBeNull();
  });

  it.each([
    "javascript:alert(1)",
    "data:image/png;base64,AAAA",
    "file:///C:/secret.jpg",
    "//photo.joych.org/photo/2026/0628/2.jpg",
  ])("rejects unsafe or non-absolute image source %s", (src) => {
    expect(extractPlainTextPastedImageUrls(`<img src="${src}"><br>`)).toBeNull();
  });

  it("rejects the whole paste when safe and unsafe images are mixed", () => {
    expect(
      extractPlainTextPastedImageUrls(
        '<img src="https://photo.joych.org/photo/2026/0628/2.jpg"><br>' +
          '<img src="javascript:alert(1)"><br>',
      ),
    ).toBeNull();
  });

  it("rejects excessively large pasted HTML", () => {
    const oversized =
      '<img src="https://photo.joych.org/photo/2026/0628/2.jpg"><br>' + " ".repeat(50_000);

    expect(extractPlainTextPastedImageUrls(oversized)).toBeNull();
  });
});
