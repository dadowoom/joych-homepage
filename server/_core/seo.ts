import type { Express, Request, Response } from "express";
import { getVisibleMenus } from "../db/menu";
import { isSafeHref } from "./contentValidation";

type RequestWithCspNonce = Request & { cspNonce?: string };

const DEFAULT_ORIGIN = "https://newjoych.co.kr";
const SITE_NAME = "기쁨의교회";
const SITE_TITLE = "기쁨의교회 | The Joyful Church";
const DEFAULT_DESCRIPTION =
  "깊이있는 성장, 위대한 교회. 기쁨의교회에 오신 것을 환영합니다.";
const DEFAULT_IMAGE = "https://newjoych.co.kr/og-image-main1.jpg";

type SeoRoute = {
  path: string;
  title: string;
  description: string;
  priority?: string;
};

const ROUTES: SeoRoute[] = [
  {
    path: "/",
    title: SITE_TITLE,
    description: DEFAULT_DESCRIPTION,
    priority: "1.0",
  },
  {
    path: "/page/교회소개-담임목사-소개",
    title: "담임목사 소개 | 기쁨의교회",
    description: "기쁨의교회 담임목사 인사와 목회 방향을 안내합니다.",
    priority: "0.8",
  },
  {
    path: "/about/history",
    title: "교회 역사 | 기쁨의교회",
    description: "기쁨의교회가 걸어온 믿음의 발자취를 소개합니다.",
    priority: "0.7",
  },
  {
    path: "/page/교회소개-3대-비전",
    title: "3대 비전 | 기쁨의교회",
    description: "기쁨의교회의 비전과 사역 방향을 확인할 수 있습니다.",
    priority: "0.7",
  },
  {
    path: "/page/교회소개-섬기는-분",
    title: "섬기는 분 | 기쁨의교회",
    description: "기쁨의교회를 섬기는 목회자와 사역자를 소개합니다.",
    priority: "0.7",
  },
  {
    path: "/page/교회소개-부교역자",
    title: "부교역자 | 기쁨의교회",
    description: "기쁨의교회 부교역자와 담당 사역을 안내합니다.",
    priority: "0.7",
  },
  {
    path: "/page/교회소개-교회백서",
    title: "교회백서 | 기쁨의교회",
    description: "기쁨의교회 사역과 운영 자료를 확인할 수 있습니다.",
    priority: "0.6",
  },
  {
    path: "/about/principle",
    title: "목회 원리 | 기쁨의교회",
    description: "기쁨의교회의 목회 원리와 사역 기준을 소개합니다.",
    priority: "0.6",
  },
  {
    path: "/about/ci",
    title: "CI 소개 | 기쁨의교회",
    description: "기쁨의교회의 상징과 정체성을 안내합니다.",
    priority: "0.6",
  },
  {
    path: "/about/shuttle",
    title: "차량 운행 안내 | 기쁨의교회",
    description: "기쁨의교회 차량 운행과 교통 안내를 확인할 수 있습니다.",
    priority: "0.7",
  },
  {
    path: "/about/directions",
    title: "오시는 길 | 기쁨의교회",
    description:
      "경북 포항시 북구 삼흥로 411, 기쁨의교회 위치와 길찾기 정보를 안내합니다.",
    priority: "0.8",
  },
  {
    path: "/worship/tv",
    title: "조이풀TV | 기쁨의교회",
    description:
      "기쁨의교회 예배 영상과 설교 영상을 조이풀TV에서 시청할 수 있습니다.",
    priority: "0.9",
  },
  {
    path: "/page/조이풀tv-주일예배",
    title: "주일예배 영상 | 기쁨의교회",
    description: "기쁨의교회 주일예배 말씀 영상을 확인할 수 있습니다.",
    priority: "0.8",
  },
  {
    path: "/worship/schedule",
    title: "예배 시간 안내 | 기쁨의교회",
    description:
      "기쁨의교회 주일예배, 수요예배, 새벽기도회 등 예배 시간을 안내합니다.",
    priority: "0.9",
  },
  {
    path: "/worship/bulletin",
    title: "주보 보기 | 기쁨의교회",
    description: "기쁨의교회 주보와 예배 안내 자료를 확인할 수 있습니다.",
    priority: "0.8",
  },
  {
    path: "/education/new-member",
    title: "새가족 교육 | 기쁨의교회",
    description: "기쁨의교회 새가족 교육과 등록 안내를 제공합니다.",
    priority: "0.7",
  },
  {
    path: "/mission",
    title: "선교보고 | 기쁨의교회",
    description: "기쁨의교회 선교 소식과 보고를 확인할 수 있습니다.",
    priority: "0.7",
  },
  {
    path: "/page/행정지원-공지사항",
    title: "공지사항 | 기쁨의교회",
    description: "기쁨의교회 주요 공지와 행사 안내를 확인할 수 있습니다.",
    priority: "0.8",
  },
  {
    path: "/page/커뮤니티-최근-행사-사진",
    title: "최근 행사 사진 | 기쁨의교회",
    description: "기쁨의교회 공동체 행사와 예배 사진을 확인할 수 있습니다.",
    priority: "0.7",
  },
  {
    path: "/community/prayer",
    title: "기도 요청 | 기쁨의교회",
    description: "기쁨의교회 공동체와 함께 기도 제목을 나눌 수 있습니다.",
    priority: "0.7",
  },
  {
    path: "/community/testimony",
    title: "생선 간증 | 기쁨의교회",
    description: "기쁨의교회 성도들이 은혜로운 간증과 댓글을 나누는 공간입니다.",
    priority: "0.7",
  },
  {
    path: "/support/new-member",
    title: "새가족 안내 | 기쁨의교회",
    description: "기쁨의교회에 처음 오신 분을 위한 새가족 안내입니다.",
    priority: "0.6",
  },
  {
    path: "/facility",
    title: "시설 예약 | 기쁨의교회",
    description: "기쁨의교회 시설 안내와 예약 신청을 진행할 수 있습니다.",
    priority: "0.7",
  },
  {
    path: "/sitemap",
    title: "사이트맵 | 기쁨의교회",
    description: "기쁨의교회 홈페이지 전체 메뉴를 한눈에 확인할 수 있습니다.",
    priority: "0.5",
  },
];

const ROUTE_MAP = new Map(ROUTES.map(route => [route.path, route]));

const EXTRA_SITEMAP_ROUTES: SeoRoute[] = [
  ...ROUTES,
  {
    path: "/worship/tv/hebron",
    title: "헤브론 수요예배 | 기쁨의교회",
    description: DEFAULT_DESCRIPTION,
    priority: "0.7",
  },
  {
    path: "/worship/tv/shekhinah",
    title: "쉐키나 금요기도회 | 기쁨의교회",
    description: DEFAULT_DESCRIPTION,
    priority: "0.7",
  },
  {
    path: "/worship/tv/gloria",
    title: "새벽 글로리아 성서학당 | 기쁨의교회",
    description: DEFAULT_DESCRIPTION,
    priority: "0.7",
  },
  {
    path: "/worship/tv/pastor-series",
    title: "목사 시리즈설교 | 기쁨의교회",
    description: DEFAULT_DESCRIPTION,
    priority: "0.7",
  },
  {
    path: "/worship/tv/hayoungin",
    title: "새벽기도회 설교 | 기쁨의교회",
    description: DEFAULT_DESCRIPTION,
    priority: "0.7",
  },
  {
    path: "/worship/tv/special",
    title: "특별예배 | 기쁨의교회",
    description: DEFAULT_DESCRIPTION,
    priority: "0.7",
  },
  {
    path: "/worship/tv/feature",
    title: "특집 | 기쁨의교회",
    description: DEFAULT_DESCRIPTION,
    priority: "0.7",
  },
  {
    path: "/worship/tv/testimony",
    title: "간증 | 기쁨의교회",
    description: DEFAULT_DESCRIPTION,
    priority: "0.7",
  },
  {
    path: "/worship/tv/praise",
    title: "찬양 | 기쁨의교회",
    description: DEFAULT_DESCRIPTION,
    priority: "0.7",
  },
  {
    path: "/education/disciple",
    title: "제자훈련 | 기쁨의교회",
    description: DEFAULT_DESCRIPTION,
    priority: "0.7",
  },
  {
    path: "/education/bible",
    title: "성경공부 | 기쁨의교회",
    description: DEFAULT_DESCRIPTION,
    priority: "0.7",
  },
  {
    path: "/education/hesed",
    title: "헤세드 아시아 | 기쁨의교회",
    description: DEFAULT_DESCRIPTION,
    priority: "0.7",
  },
  {
    path: "/education/disciple2",
    title: "제자훈련 | 기쁨의교회",
    description: DEFAULT_DESCRIPTION,
    priority: "0.7",
  },
  {
    path: "/education/elder",
    title: "장로훈련 | 기쁨의교회",
    description: DEFAULT_DESCRIPTION,
    priority: "0.7",
  },
  {
    path: "/education/one-on-one",
    title: "일대일 양육 | 기쁨의교회",
    description: DEFAULT_DESCRIPTION,
    priority: "0.7",
  },
  {
    path: "/education/sunseumschool",
    title: "선섬스쿨 | 기쁨의교회",
    description: DEFAULT_DESCRIPTION,
    priority: "0.7",
  },
  {
    path: "/education/saengseon",
    title: "생선 컨퍼런스 | 기쁨의교회",
    description: DEFAULT_DESCRIPTION,
    priority: "0.7",
  },
  {
    path: "/ministry/world-mission",
    title: "해외 선교 | 기쁨의교회",
    description: DEFAULT_DESCRIPTION,
    priority: "0.7",
  },
  {
    path: "/ministry/evangelism",
    title: "전도 사역 | 기쁨의교회",
    description: DEFAULT_DESCRIPTION,
    priority: "0.7",
  },
  {
    path: "/ministry/prayer",
    title: "기도 사역 | 기쁨의교회",
    description: DEFAULT_DESCRIPTION,
    priority: "0.7",
  },
  {
    path: "/ministry/welfare",
    title: "복지 사역 | 기쁨의교회",
    description: DEFAULT_DESCRIPTION,
    priority: "0.7",
  },
  {
    path: "/ministry/vision-univ",
    title: "비전대학 | 기쁨의교회",
    description: DEFAULT_DESCRIPTION,
    priority: "0.7",
  },
  {
    path: "/ministry/joylab",
    title: "조이랩 | 기쁨의교회",
    description: DEFAULT_DESCRIPTION,
    priority: "0.7",
  },
  {
    path: "/school/infant",
    title: "영아부 | 기쁨의교회",
    description: DEFAULT_DESCRIPTION,
    priority: "0.6",
  },
  {
    path: "/school/kinder",
    title: "유치부 | 기쁨의교회",
    description: DEFAULT_DESCRIPTION,
    priority: "0.6",
  },
  {
    path: "/school/elementary",
    title: "초등부 | 기쁨의교회",
    description: DEFAULT_DESCRIPTION,
    priority: "0.6",
  },
  {
    path: "/school/youth",
    title: "청소년부 | 기쁨의교회",
    description: DEFAULT_DESCRIPTION,
    priority: "0.6",
  },
  {
    path: "/school/awana",
    title: "AWANA | 기쁨의교회",
    description: DEFAULT_DESCRIPTION,
    priority: "0.6",
  },
  {
    path: "/school/young-adult",
    title: "청년부 | 기쁨의교회",
    description: DEFAULT_DESCRIPTION,
    priority: "0.6",
  },
  {
    path: "/mission-work/domestic",
    title: "국내 선교 | 기쁨의교회",
    description: DEFAULT_DESCRIPTION,
    priority: "0.7",
  },
  {
    path: "/mission-work/overseas",
    title: "해외 선교 | 기쁨의교회",
    description: DEFAULT_DESCRIPTION,
    priority: "0.7",
  },
  {
    path: "/mission-work/volunteer",
    title: "봉사 활동 | 기쁨의교회",
    description: DEFAULT_DESCRIPTION,
    priority: "0.7",
  },
  {
    path: "/community/soon",
    title: "순 모임 | 기쁨의교회",
    description: DEFAULT_DESCRIPTION,
    priority: "0.7",
  },
  {
    path: "/community/organization",
    title: "공동체 조직 | 기쁨의교회",
    description: DEFAULT_DESCRIPTION,
    priority: "0.7",
  },
  {
    path: "/community/club",
    title: "동호회 | 기쁨의교회",
    description: DEFAULT_DESCRIPTION,
    priority: "0.7",
  },
  {
    path: "/community/joytalk",
    title: "조이톡 | 기쁨의교회",
    description: DEFAULT_DESCRIPTION,
    priority: "0.7",
  },
  {
    path: "/support/offering",
    title: "헌금 안내 | 기쁨의교회",
    description: DEFAULT_DESCRIPTION,
    priority: "0.6",
  },
  {
    path: "/support/vehicle",
    title: "차량 운행 | 기쁨의교회",
    description: DEFAULT_DESCRIPTION,
    priority: "0.6",
  },
  {
    path: "/support/store",
    title: "조이플스토어 | 기쁨의교회",
    description: DEFAULT_DESCRIPTION,
    priority: "0.5",
  },
  {
    path: "/support/bulletin-ad",
    title: "주보 광고신청 | 기쁨의교회",
    description: "기쁨의교회 성도가 주보 광고와 부서 안내 게재를 신청할 수 있습니다.",
    priority: "0.5",
  },
  {
    path: "/support/subtitle",
    title: "자막 요청 | 기쁨의교회",
    description: DEFAULT_DESCRIPTION,
    priority: "0.5",
  },
  {
    path: "/support/office",
    title: "온라인 사무실 | 기쁨의교회",
    description: DEFAULT_DESCRIPTION,
    priority: "0.5",
  },
  {
    path: "/support/tour",
    title: "방문 신청 | 기쁨의교회",
    description: DEFAULT_DESCRIPTION,
    priority: "0.5",
  },
  {
    path: "/support/donation",
    title: "기부금 영수증 | 기쁨의교회",
    description: DEFAULT_DESCRIPTION,
    priority: "0.5",
  },
];

function stripTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function getConfiguredOrigin() {
  const value =
    process.env.PUBLIC_URL_BASE ||
    process.env.PUBLIC_SITE_URL ||
    process.env.SITE_URL ||
    "";

  if (!value) return "";

  try {
    return stripTrailingSlash(new URL(value).origin);
  } catch {
    return "";
  }
}

export function getPublicOrigin(req?: Request) {
  const configured = getConfiguredOrigin();
  if (configured) return configured;
  if (!req) return DEFAULT_ORIGIN;

  const forwardedHost = req.headers["x-forwarded-host"];
  const host = Array.isArray(forwardedHost)
    ? forwardedHost[0]
    : forwardedHost?.split(",")[0]?.trim() || req.headers.host;
  if (!host) return DEFAULT_ORIGIN;

  const forwardedProto = req.headers["x-forwarded-proto"];
  const proto = Array.isArray(forwardedProto)
    ? forwardedProto[0]
    : forwardedProto?.split(",")[0]?.trim() || req.protocol || "https";

  return stripTrailingSlash(`${proto}://${host}`);
}

function decodePath(pathname: string) {
  try {
    return decodeURIComponent(pathname);
  } catch {
    return pathname;
  }
}

function normalizePath(pathname: string) {
  const decoded = decodePath(pathname || "/");
  const clean = decoded.split("?")[0] || "/";
  if (clean.length <= 1) return "/";
  return clean.replace(/\/+$/, "");
}

function titleFromPageSlug(pathname: string) {
  const slug = pathname.replace(/^\/page\//, "").trim();
  if (!slug) return null;
  return slug.replace(/-/g, " ");
}

function buildFallbackSeo(pathname: string): SeoRoute {
  const pageTitle = pathname.startsWith("/page/")
    ? titleFromPageSlug(pathname)
    : null;

  const title = pageTitle ? `${pageTitle} | ${SITE_NAME}` : SITE_TITLE;
  return {
    path: pathname,
    title,
    description: pageTitle
      ? `${SITE_NAME} ${pageTitle} 페이지입니다.`
      : DEFAULT_DESCRIPTION,
    priority: "0.5",
  };
}

function getSeoRoute(pathname: string) {
  const normalized = normalizePath(pathname);
  return ROUTE_MAP.get(normalized) ?? buildFallbackSeo(normalized);
}

function isPrivatePath(pathname: string) {
  return (
    pathname === "/admin" ||
    pathname.startsWith("/admin_joych_2026") ||
    pathname.startsWith("/member/") ||
    pathname.startsWith("/facility/my-reservations") ||
    pathname.startsWith("/mission/write") ||
    pathname.startsWith("/mission/edit/")
  );
}

function buildUrl(pathname: string, origin: string) {
  return new URL(pathname, `${origin}/`).toString();
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeXml(value: string) {
  return escapeHtml(value).replace(/'/g, "&apos;");
}

function buildStructuredData(canonicalUrl: string) {
  return JSON.stringify([
    {
      "@context": "https://schema.org",
      "@type": "Church",
      name: SITE_NAME,
      alternateName: "The Joyful Church",
      url: canonicalUrl,
      image: DEFAULT_IMAGE,
      telephone: "054-270-1000",
      address: {
        "@type": "PostalAddress",
        addressCountry: "KR",
        addressRegion: "경상북도",
        addressLocality: "포항시 북구",
        streetAddress: "삼흥로 411",
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: SITE_NAME,
      url: getConfiguredOrigin() || DEFAULT_ORIGIN,
      inLanguage: "ko-KR",
    },
  ]);
}

function safeJsonForScript(value: string) {
  return value
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

function upsertTag(html: string, pattern: RegExp, tag: string) {
  if (pattern.test(html)) return html.replace(pattern, tag);
  return html.replace("</head>", `    ${tag}\n  </head>`);
}

export function injectSeoMeta(html: string, req: Request) {
  const requestPath =
    typeof req.originalUrl === "string"
      ? req.originalUrl.split("?")[0] || "/"
      : req.path || "/";
  const path = normalizePath(requestPath);
  const seo = getSeoRoute(path);
  const origin = getPublicOrigin(req);
  const canonicalUrl = buildUrl(path, origin);
  const robots = isPrivatePath(path) ? "noindex, nofollow" : "index, follow";

  let output = html;
  output = upsertTag(
    output,
    /<title>[\s\S]*?<\/title>/i,
    `<title>${escapeHtml(seo.title)}</title>`
  );
  output = upsertTag(
    output,
    /<meta\s+name="description"[^>]*>/i,
    `<meta name="description" content="${escapeHtml(seo.description)}" />`
  );
  output = upsertTag(
    output,
    /<meta\s+name="robots"[^>]*>/i,
    `<meta name="robots" content="${robots}" />`
  );
  output = upsertTag(
    output,
    /<meta\s+property="og:type"[^>]*>/i,
    `<meta property="og:type" content="website" />`
  );
  output = upsertTag(
    output,
    /<meta\s+property="og:title"[^>]*>/i,
    `<meta property="og:title" content="${escapeHtml(seo.title)}" />`
  );
  output = upsertTag(
    output,
    /<meta\s+property="og:description"[^>]*>/i,
    `<meta property="og:description" content="${escapeHtml(seo.description)}" />`
  );
  output = upsertTag(
    output,
    /<meta\s+property="og:image"[^>]*>/i,
    `<meta property="og:image" content="${DEFAULT_IMAGE}" />`
  );
  output = upsertTag(
    output,
    /<meta\s+property="og:url"[^>]*>/i,
    `<meta property="og:url" content="${escapeHtml(canonicalUrl)}" />`
  );
  output = upsertTag(
    output,
    /<meta\s+property="og:site_name"[^>]*>/i,
    `<meta property="og:site_name" content="${SITE_NAME}" />`
  );
  output = upsertTag(
    output,
    /<meta\s+name="twitter:card"[^>]*>/i,
    `<meta name="twitter:card" content="summary_large_image" />`
  );
  output = upsertTag(
    output,
    /<meta\s+name="twitter:title"[^>]*>/i,
    `<meta name="twitter:title" content="${escapeHtml(seo.title)}" />`
  );
  output = upsertTag(
    output,
    /<meta\s+name="twitter:description"[^>]*>/i,
    `<meta name="twitter:description" content="${escapeHtml(seo.description)}" />`
  );
  output = upsertTag(
    output,
    /<meta\s+name="twitter:image"[^>]*>/i,
    `<meta name="twitter:image" content="${DEFAULT_IMAGE}" />`
  );
  output = upsertTag(
    output,
    /<link\s+rel="canonical"[^>]*>/i,
    `<link rel="canonical" href="${escapeHtml(canonicalUrl)}" />`
  );

  output = output.replace(
    /<script\s+type="application\/ld\+json"\s+data-seo="true">[\s\S]*?<\/script>\n?/i,
    ""
  );
  const nonce = (req as RequestWithCspNonce).cspNonce;
  const nonceAttr = nonce ? ` nonce="${escapeHtml(nonce)}"` : "";
  return output.replace(
    "</head>",
    `    <script type="application/ld+json" data-seo="true"${nonceAttr}>${safeJsonForScript(buildStructuredData(canonicalUrl))}</script>\n  </head>`
  );
}

function shouldIncludeSitemapPath(pathname: string) {
  return (
    pathname.startsWith("/") &&
    !isPrivatePath(pathname) &&
    pathname !== "/404" &&
    !pathname.startsWith("/api/") &&
    !pathname.includes(":")
  );
}

function collectMenuRoutes(
  menus: Awaited<ReturnType<typeof getVisibleMenus>>
): SeoRoute[] {
  const routes: SeoRoute[] = [];

  for (const menu of menus) {
    if (
      menu.href &&
      isSafeHref(menu.href) &&
      shouldIncludeSitemapPath(menu.href)
    ) {
      routes.push({
        path: menu.href,
        title: `${menu.label} | ${SITE_NAME}`,
        description: `${SITE_NAME} ${menu.label} 페이지입니다.`,
        priority: "0.8",
      });
    }

    for (const item of menu.items ?? []) {
      if (
        item.href &&
        isSafeHref(item.href) &&
        shouldIncludeSitemapPath(item.href)
      ) {
        routes.push({
          path: item.href,
          title: `${item.label} | ${SITE_NAME}`,
          description: `${SITE_NAME} ${item.label} 페이지입니다.`,
          priority: "0.7",
        });
      }

      for (const subItem of item.subItems ?? []) {
        if (
          subItem.href &&
          isSafeHref(subItem.href) &&
          shouldIncludeSitemapPath(subItem.href)
        ) {
          routes.push({
            path: subItem.href,
            title: `${subItem.label} | ${SITE_NAME}`,
            description: `${SITE_NAME} ${subItem.label} 페이지입니다.`,
            priority: "0.6",
          });
        }
      }
    }
  }

  return routes;
}

async function buildSitemapXml(req: Request) {
  const origin = getPublicOrigin(req);
  const routeMap = new Map<string, SeoRoute>();

  for (const route of EXTRA_SITEMAP_ROUTES) {
    if (shouldIncludeSitemapPath(route.path))
      routeMap.set(normalizePath(route.path), route);
  }

  try {
    const menuRoutes = collectMenuRoutes(await getVisibleMenus());
    for (const route of menuRoutes) {
      routeMap.set(normalizePath(route.path), route);
    }
  } catch {
    // DB가 잠시 불안정해도 정적 핵심 경로는 유지합니다.
  }

  const today = new Date().toISOString().slice(0, 10);
  const urls = Array.from(routeMap.values())
    .sort((a, b) => a.path.localeCompare(b.path, "ko"))
    .map(route => {
      const loc = escapeXml(buildUrl(normalizePath(route.path), origin));
      const priority = route.priority ?? "0.5";
      return [
        "  <url>",
        `    <loc>${loc}</loc>`,
        `    <lastmod>${today}</lastmod>`,
        "    <changefreq>weekly</changefreq>",
        `    <priority>${priority}</priority>`,
        "  </url>",
      ].join("\n");
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

function buildRobotsTxt(req: Request) {
  const origin = getPublicOrigin(req);
  return [
    "User-agent: *",
    "Allow: /",
    "Disallow: /api/",
    "Disallow: /admin_joych_2026",
    "Disallow: /member/",
    "Disallow: /facility/my-reservations",
    "",
    `Sitemap: ${buildUrl("/sitemap.xml", origin)}`,
    "",
  ].join("\n");
}

export function registerSeoUtilityRoutes(app: Express) {
  app.get("/robots.txt", (req: Request, res: Response) => {
    res
      .status(200)
      .type("text/plain")
      .setHeader("Cache-Control", "public, max-age=300");
    res.send(buildRobotsTxt(req));
  });

  app.get("/sitemap.xml", async (req: Request, res: Response) => {
    const xml = await buildSitemapXml(req);
    res
      .status(200)
      .type("application/xml")
      .setHeader("Cache-Control", "public, max-age=300");
    res.send(xml);
  });
}
