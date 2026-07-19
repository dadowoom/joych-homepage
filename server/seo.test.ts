import { describe, expect, it, vi } from "vitest";
import type { NextFunction, Request, Response } from "express";
import { canonicalHostRedirect, injectSeoMeta } from "./_core/seo";

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

function withPublicUrlBase(value: string, callback: () => void) {
  const previous = process.env.PUBLIC_URL_BASE;
  process.env.PUBLIC_URL_BASE = value;
  try {
    callback();
  } finally {
    if (previous === undefined) delete process.env.PUBLIC_URL_BASE;
    else process.env.PUBLIC_URL_BASE = previous;
  }
}

describe("SEO meta injection", () => {
  it("주요 공개 페이지에 경로별 메타태그를 주입한다", () => {
    const html = injectSeoMeta(baseHtml, mockRequest("/about/directions"));

    expect(html).toContain("<title>오시는 길 | 기쁨의교회</title>");
    expect(html).toContain("기쁨의교회 위치와 길찾기 정보를 안내합니다.");
    expect(html).toContain(
      '<link rel="canonical" href="https://dadowoomtest.co.kr/about/directions" />'
    );
    expect(html).toContain(
      '<meta name="keywords" content="기쁨의교회, 포항기쁨의교회, 포항 교회, 삼흥로 411, The Joyful Church" />'
    );
    expect(html).toContain('type="application/ld+json"');
  });

  it("비공개 성격의 페이지에는 noindex를 적용한다", () => {
    const html = injectSeoMeta(baseHtml, mockRequest("/member/login"));

    expect(html).toContain(
      '<meta name="robots" content="noindex, nofollow" />'
    );
  });

  it("www 공개 도메인은 대표 도메인으로 301 정리한다", () => {
    withPublicUrlBase("https://newjoych.co.kr", () => {
      const req = {
        originalUrl: "/about/directions?from=www",
        url: "/about/directions?from=www",
        headers: { host: "www.newjoych.co.kr" },
      } as unknown as Request;
      const redirect = vi.fn();
      const res = { redirect } as unknown as Response;
      const next = vi.fn() as unknown as NextFunction;

      canonicalHostRedirect(req, res, next);

      expect(redirect).toHaveBeenCalledWith(
        301,
        "https://newjoych.co.kr/about/directions?from=www"
      );
      expect(next).not.toHaveBeenCalled();
    });
  });

  it("joych.org 전환 시 www 주소를 대표 주소로 301 정리한다", () => {
    withPublicUrlBase("https://joych.org", () => {
      const req = {
        originalUrl: "/worship/tv?from=www",
        url: "/worship/tv?from=www",
        headers: { host: "www.joych.org" },
      } as unknown as Request;
      const redirect = vi.fn();
      const res = { redirect } as unknown as Response;
      const next = vi.fn() as unknown as NextFunction;

      canonicalHostRedirect(req, res, next);

      expect(redirect).toHaveBeenCalledWith(
        301,
        "https://joych.org/worship/tv?from=www"
      );
      expect(next).not.toHaveBeenCalled();
    });
  });

  it.each([
    "/sw.js",
    "/manifest.webmanifest",
    "/pwa-icon-192.png",
    "/pwa-icon-512.png",
    "/api/trpc/home.getVapidPublicKey",
  ])("Newjoych의 기존 PWA 연결 경로 %s는 Joych로 리다이렉트하지 않는다", (pathname) => {
    withPublicUrlBase("https://www.joych.org", () => {
      const req = {
        originalUrl: pathname,
        url: pathname,
        headers: { host: "newjoych.co.kr" },
      } as unknown as Request;
      const redirect = vi.fn();
      const res = { redirect } as unknown as Response;
      const next = vi.fn() as unknown as NextFunction;

      canonicalHostRedirect(req, res, next);

      expect(redirect).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledOnce();
    });
  });
});
