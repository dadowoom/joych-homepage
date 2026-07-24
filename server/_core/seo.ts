import type { Express, NextFunction, Request, Response } from "express";
import {
  PRIMARY_SITE_ORIGIN,
  isSiteHostname,
} from "../../shared/siteHosts";
import { getVisibleMenus } from "../db/menu";
import {
  listPublishedBulletinSeoRows,
  listPublishedMissionReportSeoRows,
  listPublishedTestimonySeoRows,
  listVisiblePastorBookSeoRows,
} from "../db/seo";
import { isSafeHref } from "./contentValidation";

type RequestWithCspNonce = Request & { cspNonce?: string };

const DEFAULT_ORIGIN = PRIMARY_SITE_ORIGIN;
const SITE_NAME = "기쁨의교회";
const SITE_TITLE = "기쁨의교회 | The Joyful Church";
const DEFAULT_DESCRIPTION =
  "경상북도 포항시 북구 삼흥로 411에 위치한 기쁨의교회 공식 홈페이지입니다.";
const DEFAULT_IMAGE_PATH = "/og-image-main1.jpg";
const SITE_KEYWORDS =
  "기쁨의교회, 포항기쁨의교회, 포항 교회, 삼흥로 411, The Joyful Church";
const CHURCH_TELEPHONE = "054-270-1000";
const CHURCH_ADDRESS = {
  region: "경상북도",
  locality: "포항시 북구",
  street: "삼흥로 411",
  full: "경상북도 포항시 북구 삼흥로 411",
};
const CHURCH_COORDS = { lat: 36.095458253774, lng: 129.37385741342 };

type SeoRoute = {
  path: string;
  title: string;
  description: string;
  priority?: string;
  lastModified?: Date | string | null;
};

const ROUTES: SeoRoute[] = [
  {
    path: "/",
    title: SITE_TITLE,
    description: DEFAULT_DESCRIPTION,
    priority: "1.0",
  },
  {
    path: "/about/pastor",
    title: "담임목사 소개 | 기쁨의교회",
    description: "기쁨의교회 담임목사 인사와 목회 방향을 안내합니다.",
    priority: "0.8",
  },
  {
    path: "/about/pastor/books",
    title: "위임목사 저서 | 기쁨의교회",
    description: "기쁨의교회 위임목사 저서를 소개합니다.",
    priority: "0.7",
  },
  {
    path: "/about/history",
    title: "교회 역사 | 기쁨의교회",
    description: "기쁨의교회가 걸어온 믿음의 발자취를 소개합니다.",
    priority: "0.7",
  },
  {
    path: "/about/vision",
    title: "3대 비전 | 기쁨의교회",
    description: "기쁨의교회의 비전과 사역 방향을 확인할 수 있습니다.",
    priority: "0.7",
  },
  {
    path: "/about/staff",
    title: "섬기는 분 | 기쁨의교회",
    description: "기쁨의교회를 섬기는 목회자와 사역자를 소개합니다.",
    priority: "0.7",
  },
  {
    path: "/about/staff/associate",
    title: "부교역자 | 기쁨의교회",
    description: "기쁨의교회 부교역자와 담당 사역을 안내합니다.",
    priority: "0.7",
  },
  {
    path: "/about/whitebook",
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
    path: "/worship/tv/sunday",
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
    path: "/community/news",
    title: "공지사항 | 기쁨의교회",
    description: "기쁨의교회 주요 공지와 행사 안내를 확인할 수 있습니다.",
    priority: "0.8",
  },
  {
    path: "/community/photo",
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

const ROUTE_MAP = new Map(
  EXTRA_SITEMAP_ROUTES.map(route => [normalizePath(route.path), route])
);

const LEGACY_PWA_HOSTNAMES = new Set([
  "newjoych.co.kr",
  "www.newjoych.co.kr",
]);

const CANONICAL_PATH_ALIASES = new Map<string, string>([
  ["/about/pastor", "/page/교회소개-담임목사-소개-담임목사인사"],
  ["/about/history", "/page/교회소개-교회-연혁"],
  ["/about/vision", "/page/교회소개-3대-비전-9대-전략"],
  ["/about/staff", "/page/교회소개-섬기는-분"],
  ["/about/directions", "/page/교회소개-오시는길"],
  ["/worship/tv/sunday", "/page/조이풀tv-주일예배"],
  ["/worship/tv/shekhinah", "/page/조이풀tv-금요-경배와-용사들"],
  ["/worship/tv/hayoungin", "/page/조이풀tv-하영인"],
  ["/worship/tv/testimony", "/page/조이풀tv-생선-간증"],
  ["/community/news", "/page/행정지원-공지사항"],
  ["/community/photo", "/page/커뮤니티-최근-행사-사진"],
  ["/page/행정지원-주보-주보보기", "/worship/bulletin"],
  ["/page/행정지원-주보보기", "/worship/bulletin"],
  ["/page/커뮤니티-선교소식", "/mission"],
  ["/page/커뮤니티-선교-소식", "/mission"],
  ["/page/사역선교-선교소식", "/mission"],
  ["/page/사역선교-선교-소식", "/mission"],
  ["/page/선교-선교소식", "/mission"],
  ["/page/선교-선교-소식", "/mission"],
  ["/page/커뮤니티-생선간증", "/community/testimony"],
  ["/page/커뮤니티-생선-간증", "/community/testimony"],
  ["/page/커뮤니티-은혜의간증", "/community/testimony"],
  ["/page/커뮤니티-은혜의-간증", "/community/testimony"],
  ["/page/교회소개-담임목사-저서", "/about/pastor/books"],
  [
    "/page/교회소개-담임목사-소개-담임목사저서",
    "/about/pastor/books",
  ],
  [
    "/page/교회소개-담임목사-소개-담임목사-저서",
    "/about/pastor/books",
  ],
  ["/page/교회소개-담임목사소개-담임목사저서", "/about/pastor/books"],
  [
    "/page/교회소개-담임목사소개-담임목사-저서",
    "/about/pastor/books",
  ],
]);

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

function getFirstHeaderValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0]?.split(",")[0]?.trim() || "";
  return value?.split(",")[0]?.trim() || "";
}

function getRequestHost(req: Request) {
  return (
    getFirstHeaderValue(req.headers["x-forwarded-host"]) ||
    getFirstHeaderValue(req.headers.host)
  );
}

function isLegacyPwaRequest(req: Request) {
  const hostname = getRequestHost(req).toLowerCase().split(":")[0];
  return LEGACY_PWA_HOSTNAMES.has(hostname);
}

function isHtmlDocumentRequest(req: Request) {
  const method = (req.method ?? "GET").toUpperCase();
  if (method !== "GET" && method !== "HEAD") return false;

  const requestUrl = req.originalUrl || req.url || "/";
  const pathname = requestUrl.split("?")[0] || "/";
  if (pathname.startsWith("/api/") || /\.[a-z0-9]{1,12}$/i.test(pathname)) {
    return false;
  }

  const accept = req.headers.accept;
  return (
    !accept ||
    accept.includes("text/html") ||
    accept.includes("application/xhtml+xml") ||
    accept.includes("*/*")
  );
}

export function canonicalHostRedirect(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const host = getRequestHost(req).toLowerCase();
  const currentHostname = host.split(":")[0];

  if (currentHostname === "joych.org" || currentHostname === "m.joych.org") {
    const destination = new URL(
      req.originalUrl || req.url || "/",
      PRIMARY_SITE_ORIGIN
    );
    return res.redirect(301, destination.toString());
  }

  // newjoych.co.kr is intentionally kept alive for existing installed PWAs.
  // Its browser navigation is handled by the client-side domain gate so that
  // service workers, push endpoints and standalone mode keep working.
  if (isSiteHostname(currentHostname)) {
    if (
      LEGACY_PWA_HOSTNAMES.has(currentHostname) &&
      isHtmlDocumentRequest(req)
    ) {
      res.setHeader("X-Robots-Tag", "noindex, follow");
    }
    return next();
  }

  const configured = getConfiguredOrigin();
  if (!configured) return next();

  let canonical: URL;
  try {
    canonical = new URL(configured);
  } catch {
    return next();
  }

  const canonicalHostname = canonical.hostname.toLowerCase();
  if (
    isSiteHostname(canonicalHostname) ||
    currentHostname !== `www.${canonicalHostname}`
  ) {
    return next();
  }

  const destination = new URL(
    req.originalUrl || req.url || "/",
    canonical.origin
  );
  return res.redirect(301, destination.toString());
}

export function getPublicOrigin(req?: Request) {
  const configured = getConfiguredOrigin();
  if (configured) {
    try {
      if (isSiteHostname(new URL(configured).hostname)) {
        return PRIMARY_SITE_ORIGIN;
      }
    } catch {
      // getConfiguredOrigin already validates the URL; keep a safe fallback.
    }
    return configured;
  }
  if (!req) return DEFAULT_ORIGIN;

  const host = getRequestHost(req);
  if (!host) return DEFAULT_ORIGIN;

  const hostname = host.split(":")[0].toLowerCase();
  if (isSiteHostname(hostname)) return PRIMARY_SITE_ORIGIN;

  const proto =
    getFirstHeaderValue(req.headers["x-forwarded-proto"]) ||
    req.protocol ||
    "https";

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
    title:
      /^\/worship\/bulletin\/\d+$/.test(pathname)
        ? `주보 상세 | ${SITE_NAME}`
        : /^\/mission\/\d+$/.test(pathname)
          ? `선교보고 | ${SITE_NAME}`
          : /^\/community\/testimony\/\d+$/.test(pathname)
            ? `생선 간증 | ${SITE_NAME}`
            : /^\/about\/pastor\/books\/\d+$/.test(pathname)
              ? `담임목사 저서 | ${SITE_NAME}`
              : title,
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

function isIndexablePublicPath(pathname: string) {
  const normalized = normalizePath(pathname);
  return (
    ROUTE_MAP.has(normalized) ||
    /^\/page\/[^/]+$/.test(normalized) ||
    /^\/worship\/bulletin\/\d+$/.test(normalized) ||
    /^\/mission\/\d+$/.test(normalized) ||
    /^\/community\/testimony\/\d+$/.test(normalized) ||
    /^\/about\/pastor\/books\/\d+$/.test(normalized) ||
    /^\/education\/courses\/[^/]+$/.test(normalized)
  );
}

function getCanonicalPath(pathname: string) {
  const normalized = normalizePath(pathname);
  return CANONICAL_PATH_ALIASES.get(normalized) ?? normalized;
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

function buildStructuredData(canonicalUrl: string, seo: SeoRoute) {
  const publicOrigin = new URL(canonicalUrl).origin;
  const defaultImage = buildUrl(DEFAULT_IMAGE_PATH, publicOrigin);
  const churchId = `${publicOrigin}/#church`;
  return JSON.stringify([
    {
      "@context": "https://schema.org",
      "@type": "Church",
      "@id": churchId,
      name: SITE_NAME,
      alternateName: "The Joyful Church",
      url: publicOrigin,
      image: defaultImage,
      telephone: CHURCH_TELEPHONE,
      description: DEFAULT_DESCRIPTION,
      address: {
        "@type": "PostalAddress",
        addressCountry: "KR",
        addressRegion: CHURCH_ADDRESS.region,
        addressLocality: CHURCH_ADDRESS.locality,
        streetAddress: CHURCH_ADDRESS.street,
      },
      geo: {
        "@type": "GeoCoordinates",
        latitude: CHURCH_COORDS.lat,
        longitude: CHURCH_COORDS.lng,
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: SITE_NAME,
      url: publicOrigin,
      inLanguage: "ko-KR",
      publisher: {
        "@id": churchId,
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: seo.title,
      description: seo.description,
      url: canonicalUrl,
      inLanguage: "ko-KR",
      isPartOf: {
        "@type": "WebSite",
        name: SITE_NAME,
        url: publicOrigin,
      },
      about: {
        "@id": churchId,
      },
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
  const canonicalUrl = buildUrl(getCanonicalPath(path), origin);
  const defaultImage = buildUrl(DEFAULT_IMAGE_PATH, origin);
  const robots = isPrivatePath(path)
    ? "noindex, nofollow"
    : isLegacyPwaRequest(req) || !isIndexablePublicPath(path)
      ? "noindex, follow"
      : "index, follow";

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
    /<meta\s+name="keywords"[^>]*>/i,
    `<meta name="keywords" content="${escapeHtml(SITE_KEYWORDS)}" />`
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
    `<meta property="og:image" content="${escapeHtml(defaultImage)}" />`
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
    `<meta name="twitter:image" content="${escapeHtml(defaultImage)}" />`
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
    `    <script type="application/ld+json" data-seo="true"${nonceAttr}>${safeJsonForScript(buildStructuredData(canonicalUrl, seo))}</script>\n  </head>`
  );
}

function shouldIncludeSitemapPath(pathname: string) {
  return (
    pathname.startsWith("/") &&
    !isPrivatePath(pathname) &&
    pathname !== "/404" &&
    !pathname.startsWith("/api/") &&
    !pathname.includes(":") &&
    !decodePath(pathname).includes("테스트")
  );
}

function toInternalSitePath(href: string) {
  const trimmed = href.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) {
    return normalizePath(trimmed);
  }

  try {
    const url = new URL(trimmed);
    return isSiteHostname(url.hostname) ? normalizePath(url.pathname) : null;
  } catch {
    return null;
  }
}

function collectMenuRoutes(
  menus: Awaited<ReturnType<typeof getVisibleMenus>>
): SeoRoute[] {
  const routes: SeoRoute[] = [];

  for (const menu of menus) {
    const menuPath = menu.href ? toInternalSitePath(menu.href) : null;
    if (
      menuPath &&
      isSafeHref(menuPath) &&
      shouldIncludeSitemapPath(menuPath)
    ) {
      routes.push({
        path: menuPath,
        title: `${menu.label} | ${SITE_NAME}`,
        description: `${SITE_NAME} ${menu.label} 페이지입니다.`,
        priority: "0.8",
      });
    }

    for (const item of menu.items ?? []) {
      const itemPath = item.href ? toInternalSitePath(item.href) : null;
      if (
        itemPath &&
        isSafeHref(itemPath) &&
        shouldIncludeSitemapPath(itemPath)
      ) {
        routes.push({
          path: itemPath,
          title: `${item.label} | ${SITE_NAME}`,
          description: `${SITE_NAME} ${item.label} 페이지입니다.`,
          priority: "0.7",
        });
      }

      for (const subItem of item.subItems ?? []) {
        const subItemPath = subItem.href
          ? toInternalSitePath(subItem.href)
          : null;
        if (
          subItemPath &&
          isSafeHref(subItemPath) &&
          shouldIncludeSitemapPath(subItemPath)
        ) {
          routes.push({
            path: subItemPath,
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

const DETAIL_SECTIONS = {
  bulletin: {
    basePath: "/worship/bulletin",
    menuPaths: [
      "/worship/bulletin",
      "/page/행정지원-주보-주보보기",
      "/page/행정지원-주보보기",
    ],
  },
  mission: {
    basePath: "/mission",
    menuPaths: [
      "/mission",
      "/page/커뮤니티-선교소식",
      "/page/커뮤니티-선교-소식",
      "/page/사역선교-선교소식",
      "/page/사역선교-선교-소식",
      "/page/선교-선교소식",
      "/page/선교-선교-소식",
    ],
  },
  testimony: {
    basePath: "/community/testimony",
    menuPaths: [
      "/community/testimony",
      "/page/커뮤니티-생선간증",
      "/page/커뮤니티-생선-간증",
      "/page/커뮤니티-은혜의간증",
      "/page/커뮤니티-은혜의-간증",
    ],
  },
  pastorBooks: {
    basePath: "/about/pastor/books",
    menuPaths: [
      "/about/pastor/books",
      "/page/교회소개-담임목사-저서",
      "/page/교회소개-담임목사-소개-담임목사저서",
      "/page/교회소개-담임목사-소개-담임목사-저서",
      "/page/교회소개-담임목사소개-담임목사저서",
      "/page/교회소개-담임목사소개-담임목사-저서",
    ],
  },
} as const;

type DetailSectionKey = keyof typeof DETAIL_SECTIONS;

function collectVisibleMenuPaths(
  menus: Awaited<ReturnType<typeof getVisibleMenus>>
) {
  const paths = new Set<string>();
  const addHref = (href: string | null | undefined) => {
    if (!href) return;
    const pathname = toInternalSitePath(href);
    if (pathname) paths.add(pathname);
  };

  for (const menu of menus) {
    addHref(menu.href);
    for (const item of menu.items ?? []) {
      addHref(item.href);
      for (const subItem of item.subItems ?? []) addHref(subItem.href);
    }
  }
  return paths;
}

function resolvePublicDetailSections(
  menus: Awaited<ReturnType<typeof getVisibleMenus>>
) {
  const publicMenuPaths = collectVisibleMenuPaths(menus);
  const sections = new Set<DetailSectionKey>();

  for (const [key, section] of Object.entries(DETAIL_SECTIONS) as Array<
    [DetailSectionKey, (typeof DETAIL_SECTIONS)[DetailSectionKey]]
  >) {
    if (
      section.menuPaths.some(path =>
        publicMenuPaths.has(normalizePath(path))
      )
    ) {
      sections.add(key);
    }
  }
  return sections;
}

async function collectPublicDetailRoutes(
  publicSections: ReadonlySet<DetailSectionKey>
): Promise<SeoRoute[]> {
  const tasks: Array<{
    key: DetailSectionKey;
    load: () => Promise<SeoRoute[]>;
  }> = [];

  if (publicSections.has("bulletin")) {
    tasks.push({
      key: "bulletin",
      load: async () =>
        (await listPublishedBulletinSeoRows()).map(bulletin => ({
          path: `/worship/bulletin/${bulletin.id}`,
          title: `${bulletin.title} | 기쁨의교회 주보`,
          description: `${bulletin.bulletinDate} 기쁨의교회 주보입니다.`,
          priority: "0.6",
          lastModified: bulletin.updatedAt,
        })),
    });
  }

  if (publicSections.has("mission")) {
    tasks.push({
      key: "mission",
      load: async () =>
        (await listPublishedMissionReportSeoRows()).map(report => ({
          path: `/mission/${report.id}`,
          title: `${report.title} | 기쁨의교회 선교보고`,
          description: "기쁨의교회 선교보고입니다.",
          priority: "0.6",
          lastModified: report.updatedAt,
        })),
    });
  }

  if (publicSections.has("testimony")) {
    tasks.push({
      key: "testimony",
      load: async () =>
        (await listPublishedTestimonySeoRows()).map(post => ({
          path: `/community/testimony/${post.id}`,
          title: `${post.title} | 기쁨의교회 생선 간증`,
          description: "기쁨의교회 생선 간증입니다.",
          priority: "0.6",
          lastModified: post.updatedAt,
        })),
    });
  }

  if (publicSections.has("pastorBooks")) {
    tasks.push({
      key: "pastorBooks",
      load: async () =>
        (await listVisiblePastorBookSeoRows()).map(book => ({
          path: `/about/pastor/books/${book.id}`,
          title: `${book.title} | 기쁨의교회 담임목사 저서`,
          description: "기쁨의교회 담임목사 저서입니다.",
          priority: "0.5",
          lastModified: book.updatedAt,
        })),
    });
  }

  const results = await Promise.allSettled(tasks.map(task => task.load()));
  const routes: SeoRoute[] = [];
  results.forEach((result, index) => {
    if (result.status === "fulfilled") {
      routes.push(...result.value);
      return;
    }
    console.warn(
      `[SEO] ${tasks[index]?.key ?? "unknown"} 상세 사이트맵 조회 실패:`,
      result.reason
    );
  });
  return routes;
}

function formatSitemapLastModified(value: Date | string | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

async function buildSitemapXml(req: Request) {
  const origin = getPublicOrigin(req);
  const routeMap = new Map<string, SeoRoute>();
  let publicDetailSections = new Set<DetailSectionKey>();
  let menuVisibilityResolved = false;

  for (const route of EXTRA_SITEMAP_ROUTES) {
    if (shouldIncludeSitemapPath(route.path))
      routeMap.set(normalizePath(route.path), route);
  }

  try {
    const visibleMenus = await getVisibleMenus("guest");
    if (visibleMenus.length > 0) {
      const menuRoutes = collectMenuRoutes(visibleMenus);
      for (const route of menuRoutes) {
        routeMap.set(normalizePath(route.path), route);
      }
      publicDetailSections = resolvePublicDetailSections(visibleMenus);
      menuVisibilityResolved = true;
    } else {
      console.warn(
        "[SEO] 공개 메뉴가 비어 있어 상세 사이트맵 생성을 건너뜁니다."
      );
    }
  } catch (error) {
    console.warn("[SEO] 공개 메뉴 사이트맵 조회 실패:", error);
    // DB가 잠시 불안정해도 정적 핵심 경로는 유지합니다.
  }

  for (const [key, section] of Object.entries(DETAIL_SECTIONS) as Array<
    [DetailSectionKey, (typeof DETAIL_SECTIONS)[DetailSectionKey]]
  >) {
    if (menuVisibilityResolved && !publicDetailSections.has(key)) {
      routeMap.delete(normalizePath(section.basePath));
    }
    for (const menuPath of section.menuPaths) {
      if (normalizePath(menuPath) !== normalizePath(section.basePath)) {
        routeMap.delete(normalizePath(menuPath));
      }
    }
  }

  for (const route of await collectPublicDetailRoutes(publicDetailSections)) {
    routeMap.set(normalizePath(route.path), route);
  }

  CANONICAL_PATH_ALIASES.forEach((canonical, alias) => {
    if (routeMap.has(canonical)) routeMap.delete(alias);
  });

  const urls = Array.from(routeMap.values())
    .sort((a, b) => a.path.localeCompare(b.path, "ko"))
    .map(route => {
      const loc = escapeXml(buildUrl(normalizePath(route.path), origin));
      const priority = route.priority ?? "0.5";
      const lastModified = formatSitemapLastModified(route.lastModified);
      return [
        "  <url>",
        `    <loc>${loc}</loc>`,
        ...(lastModified
          ? [`    <lastmod>${escapeXml(lastModified)}</lastmod>`]
          : []),
        "    <changefreq>weekly</changefreq>",
        `    <priority>${priority}</priority>`,
        "  </url>",
      ].join("\n");
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

const SITEMAP_CACHE_TTL_MS = 5 * 60 * 1000;
const sitemapCache = new Map<
  string,
  { xml: string; expiresAt: number }
>();
const sitemapBuilds = new Map<string, Promise<string>>();

async function getCachedSitemapXml(req: Request) {
  const cacheKey = getPublicOrigin(req);
  const cached = sitemapCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.xml;

  const existingBuild = sitemapBuilds.get(cacheKey);
  if (existingBuild) return existingBuild;

  const build = buildSitemapXml(req)
    .then(xml => {
      sitemapCache.set(cacheKey, {
        xml,
        expiresAt: Date.now() + SITEMAP_CACHE_TTL_MS,
      });
      return xml;
    })
    .finally(() => {
      sitemapBuilds.delete(cacheKey);
    });
  sitemapBuilds.set(cacheKey, build);
  return build;
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
    const xml = await getCachedSitemapXml(req);
    res
      .status(200)
      .type("application/xml")
      .setHeader("Cache-Control", "public, max-age=300");
    res.send(xml);
  });
}
