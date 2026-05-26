import { describe, expect, it } from "vitest";
import type { Request } from "express";
import { injectSeoMeta } from "./_core/seo";

const baseHtml = `<!doctype html>
<html lang="ko">
  <head>
    <title>기쁨의교회 | The Joyful Church</title>
    <meta name="description" content="기본 설명" />
    <meta name="robots" content="index, follow" />
    <meta property="og:title" content="기본 제목" />
    <meta property="og:description" content="기본 설명" />
    <meta property="og:url" content="https://dadowoomtest.co.kr/" />
    <meta name="twitter:title" content="기본 제목" />
    <meta name="twitter:description" content="기본 설명" />
    <link rel="canonical" href="https://dadowoomtest.co.kr/" />
  </head>
  <body><div id="root"></div></body>
</html>`;

function mockRequest(path: string): Request {
  return {
    path,
    originalUrl: path,
    protocol: "https",
    headers: { host: "dadowoomtest.co.kr" },
  } as unknown as Request;
}

describe("SEO meta injection", () => {
  it("주요 공개 페이지에 경로별 메타태그를 주입한다", () => {
    const html = injectSeoMeta(baseHtml, mockRequest("/about/directions"));

    expect(html).toContain("<title>오시는 길 | 기쁨의교회</title>");
    expect(html).toContain("기쁨의교회 위치와 길찾기 정보를 안내합니다.");
    expect(html).toContain(
      '<link rel="canonical" href="https://dadowoomtest.co.kr/about/directions" />'
    );
    expect(html).toContain('type="application/ld+json"');
  });

  it("비공개 성격의 페이지에는 noindex를 적용한다", () => {
    const html = injectSeoMeta(baseHtml, mockRequest("/member/login"));

    expect(html).toContain(
      '<meta name="robots" content="noindex, nofollow" />'
    );
  });
});
