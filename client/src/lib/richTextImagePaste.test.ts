import { describe, expect, it } from "vitest";
import {
  extractImageSourceInputUrls,
  extractPlainTextPastedImageUrls,
  normalizeRichTextImageSources,
} from "./richTextImagePaste";

const proxy = (path: string) => `/api/church-photo${path}`;

describe("extractImageSourceInputUrls", () => {
  it("routes a legacy HTTP church photo through the same-origin proxy", () => {
    expect(
      extractImageSourceInputUrls("http://photo.joych.org/photo/2026/0621/11.jpg"),
    ).toEqual([proxy("/photo/2026/0621/11.jpg")]);
  });

  it("routes an HTTPS church photo through the same-origin proxy", () => {
    expect(
      extractImageSourceInputUrls("https://photo.joych.org/photo/2026/0621/11.jpg"),
    ).toEqual([proxy("/photo/2026/0621/11.jpg")]);
  });

  it("extracts multiple bare URLs in their pasted order", () => {
    expect(
      extractImageSourceInputUrls([
        "https://photo.joych.org/photo/2026/0621/11.jpg",
        "https://photo.joych.org/photo/2026/0621/12.jpg",
        "https://photo.joych.org/photo/2026/0621/13.jpg",
      ].join("\n")),
    ).toEqual([
      proxy("/photo/2026/0621/11.jpg"),
      proxy("/photo/2026/0621/12.jpg"),
      proxy("/photo/2026/0621/13.jpg"),
    ]);
  });

  it("accepts uppercase, unquoted IMG tags and mixed URL input", () => {
    expect(
      extractImageSourceInputUrls(
        "<IMG SRC=http://photo.joych.org/photo/2026/0621/11.jpg><BR>\n" +
          "https://photo.joych.org/photo/2026/0621/12.jpg",
      ),
    ).toEqual([
      proxy("/photo/2026/0621/11.jpg"),
      proxy("/photo/2026/0621/12.jpg"),
    ]);
  });

  it("accepts legacy Excel paragraph noise", () => {
    expect(
      extractImageSourceInputUrls(
        '<img src="https://photo.joych.org/photo/2026/0621/11.jpg"><p/>.</p/><br>',
      ),
    ).toEqual([proxy("/photo/2026/0621/11.jpg")]);
  });

  it.each([
    "http://example.com/image.jpg",
    "javascript:alert(1)",
    "data:image/png;base64,AAAA",
    "file:///C:/secret.jpg",
    "https://user:secret@example.com/image.jpg",
  ])("rejects unsupported image source %s", source => {
    expect(extractImageSourceInputUrls(source)).toBeNull();
  });

  it("rejects more than 200 images", () => {
    const input = Array.from(
      { length: 201 },
      (_, index) => `https://photo.joych.org/photo/2026/0621/${index}.jpg`,
    ).join("\n");
    expect(extractImageSourceInputUrls(input)).toBeNull();
  });
});

describe("normalizeRichTextImageSources", () => {
  it("proxies church photo IMG sources while preserving unrelated HTML", () => {
    expect(
      normalizeRichTextImageSources(
        '<P>photo</P><IMG SRC=http://photo.joych.org/photo/2026/0621/11.jpg>',
      ),
    ).toBe(
      '<P>photo</P><IMG SRC="/api/church-photo/photo/2026/0621/11.jpg">',
    );
  });

  it("does not modify an already proxied image source", () => {
    const html = '<img src="/api/church-photo/photo/2026/0621/11.jpg">';
    expect(normalizeRichTextImageSources(html)).toBe(html);
  });
});

describe("extractPlainTextPastedImageUrls", () => {
  it("extracts multiple image URLs in their pasted order without deduping", () => {
    const html = [
      '<img src="https://photo.joych.org/photo/2026/0628/2.jpg"><br>',
      '<img src="https://photo.joych.org/photo/2026/0628/3.jpg"><br>',
      '<img src="https://photo.joych.org/photo/2026/0628/2.jpg"><br>',
    ].join("\n");

    expect(extractPlainTextPastedImageUrls(html)).toEqual([
      proxy("/photo/2026/0628/2.jpg"),
      proxy("/photo/2026/0628/3.jpg"),
      proxy("/photo/2026/0628/2.jpg"),
    ]);
  });

  it("accepts malformed empty paragraph noise from legacy Excel lists", () => {
    const html =
      '<img src="https://photo.joych.org/photo/2026/0628/2.jpg"><p/>.</p/><br>';
    expect(extractPlainTextPastedImageUrls(html)).toEqual([
      proxy("/photo/2026/0628/2.jpg"),
    ]);
  });

  it("accepts entity-escaped image markup", () => {
    const html =
      '&lt;img src=&quot;https://photo.joych.org/photo/2026/0628/2.jpg&quot;&gt;';
    expect(extractPlainTextPastedImageUrls(html)).toEqual([
      proxy("/photo/2026/0628/2.jpg"),
    ]);
  });

  it("drops script blocks and image event attributes by returning URLs only", () => {
    const html =
      '<img src="https://photo.joych.org/photo/2026/0628/2.jpg" onerror="alert(1)">' +
      "<script>alert(2)</script><br>";
    expect(extractPlainTextPastedImageUrls(html)).toEqual([
      proxy("/photo/2026/0628/2.jpg"),
    ]);
  });

  it("leaves ordinary text, bare URLs, and image examples as normal text", () => {
    expect(extractPlainTextPastedImageUrls("ordinary content")).toBeNull();
    expect(
      extractPlainTextPastedImageUrls(
        "https://photo.joych.org/photo/2026/0628/2.jpg",
      ),
    ).toBeNull();
    expect(
      extractPlainTextPastedImageUrls(
        'example: <img src="https://example.com/a.jpg"> only',
      ),
    ).toBeNull();
  });

  it.each([
    "javascript:alert(1)",
    "data:image/png;base64,AAAA",
    "file:///C:/secret.jpg",
    "//photo.joych.org/photo/2026/0628/2.jpg",
  ])("rejects unsafe or non-absolute image source %s", src => {
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
      '<img src="https://photo.joych.org/photo/2026/0628/2.jpg"><br>' +
      " ".repeat(50_000);
    expect(extractPlainTextPastedImageUrls(oversized)).toBeNull();
  });
});
