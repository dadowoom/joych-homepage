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
      `<link rel="canonical" href="${new URL(
        "/page/교회소개-오시는길",
        "https://dadowoomtest.co.kr"
      ).toString()}" />`
    );
    expect(html).toContain(
      '<meta name="keywords" content="기쁨의교회, 포항기쁨의교회, 포항 교회, 삼흥로 411, The Joyful Church" />'
    );
    expect(html).toContain('type="application/ld+json"');
  });

  it("추가 공개 경로에도 페이지별 제목과 구조화 데이터를 적용한다", () => {
    const html = injectSeoMeta(baseHtml, mockRequest("/worship/tv/hebron"));

    expect(html).toContain("<title>헤브론 수요예배 | 기쁨의교회</title>");
    expect(html).toContain('"name":"헤브론 수요예배 | 기쁨의교회"');
  });

  it("위임목사 저서 목록에 전용 검색 제목을 적용한다", () => {
    const html = injectSeoMeta(baseHtml, mockRequest("/about/pastor/books"));

    expect(html).toContain("<title>위임목사 저서 | 기쁨의교회</title>");
  });

  it("비공개 성격의 페이지에는 noindex를 적용한다", () => {
    const html = injectSeoMeta(baseHtml, mockRequest("/member/login"));

    expect(html).toContain(
      '<meta name="robots" content="noindex, nofollow" />'
    );
  });

  it("기존 OAuth 기준 주소가 남아 있어도 SEO 주소는 www.joych.org를 사용한다", () => {
    withPublicUrlBase("https://newjoych.co.kr", () => {
      const html = injectSeoMeta(baseHtml, {
        path: "/about/directions",
        originalUrl: "/about/directions",
        protocol: "https",
        headers: { host: "newjoych.co.kr" },
      } as unknown as Request);

      expect(html).toContain(
        `<link rel="canonical" href="${new URL(
          "/page/교회소개-오시는길",
          "https://www.joych.org"
        ).toString()}" />`
      );
      expect(html).toContain(
        `<meta property="og:url" content="${new URL(
          "/page/교회소개-오시는길",
          "https://www.joych.org"
        ).toString()}" />`
      );
    });
  });

  it("기존 newjoych 도메인은 서버에서 강제 이동시키지 않는다", () => {
    withPublicUrlBase("https://newjoych.co.kr", () => {
      const req = {
        originalUrl: "/about/directions?from=www",
        url: "/about/directions?from=www",
        headers: { host: "www.newjoych.co.kr" },
      } as unknown as Request;
      const redirect = vi.fn();
      const setHeader = vi.fn();
      const res = { redirect, setHeader } as unknown as Response;
      const next = vi.fn() as unknown as NextFunction;

      canonicalHostRedirect(req, res, next);

      expect(redirect).not.toHaveBeenCalled();
      expect(setHeader).toHaveBeenCalledWith(
        "X-Robots-Tag",
        "noindex, follow"
      );
      expect(next).toHaveBeenCalledOnce();
    });
  });

  it.each(["joych.org", "m.joych.org"])(
    "%s 요청은 경로와 쿼리를 유지해 www 대표 주소로 301 정리한다",
    host => {
      const req = {
        originalUrl: "/worship/tv?from=alias",
        url: "/worship/tv?from=alias",
        headers: { host },
      } as unknown as Request;
      const redirect = vi.fn();
      const res = { redirect } as unknown as Response;
      const next = vi.fn() as unknown as NextFunction;

      canonicalHostRedirect(req, res, next);

      expect(redirect).toHaveBeenCalledWith(
        301,
        "https://www.joych.org/worship/tv?from=alias"
      );
      expect(next).not.toHaveBeenCalled();
    }
  );

  it("대표 www 주소는 다시 이동시키지 않는다", () => {
    const req = {
      originalUrl: "/worship/tv",
      url: "/worship/tv",
      headers: { host: "www.joych.org" },
    } as unknown as Request;
    const redirect = vi.fn();
    const res = { redirect } as unknown as Response;
    const next = vi.fn() as unknown as NextFunction;

    canonicalHostRedirect(req, res, next);

    expect(redirect).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledOnce();
  });

  it("기존 Newjoych HTML은 서비스는 유지하면서 검색 노출을 막는다", () => {
    const html = injectSeoMeta(baseHtml, {
      path: "/about/directions",
      originalUrl: "/about/directions",
      protocol: "https",
      headers: { host: "newjoych.co.kr" },
    } as unknown as Request);

    expect(html).toContain('<meta name="robots" content="noindex, follow" />');
    expect(html).toContain(
      `<link rel="canonical" href="${new URL(
        "/page/교회소개-오시는길",
        "https://www.joych.org"
      ).toString()}" />`
    );
  });

  it("존재하지 않는 일반 경로는 검색엔진이 정상 페이지로 오인하지 않게 한다", () => {
    const html = injectSeoMeta(baseHtml, mockRequest("/not-a-real-page"));

    expect(html).toContain('<meta name="robots" content="noindex, follow" />');
  });

  it("사용자 정의 도메인의 기존 www 정리 동작은 유지한다", () => {
    withPublicUrlBase("https://church.example.com", () => {
      const req = {
        originalUrl: "/about/history?from=www",
        url: "/about/history?from=www",
        headers: { host: "www.church.example.com" },
      } as unknown as Request;
      const redirect = vi.fn();
      const setHeader = vi.fn();
      const res = { redirect, setHeader } as unknown as Response;
      const next = vi.fn() as unknown as NextFunction;

      canonicalHostRedirect(req, res, next);

      expect(redirect).toHaveBeenCalledWith(
        301,
        "https://church.example.com/about/history?from=www"
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
      const setHeader = vi.fn();
      const res = { redirect, setHeader } as unknown as Response;
      const next = vi.fn() as unknown as NextFunction;

      canonicalHostRedirect(req, res, next);

      expect(redirect).not.toHaveBeenCalled();
      expect(setHeader).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledOnce();
    });
  });
});
