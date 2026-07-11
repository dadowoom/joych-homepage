/**
 * 기쁨의교회 홈페이지 메인 페이지
 * 디자인: Warm Modern Sacred — 따뜻한 녹색 포인트, Noto Serif KR 헤딩, 넓은 여백
 * 구성: TopBar → Header(GNB) → Hero → QuickMenu → Content(TV+News) → Vision → Affiliates → Footer
 */

import { lazy, Suspense, useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import HomeAdminDock from "@/components/HomeAdminDock";
import PwaInstallCard from "@/components/PwaInstallCard";
import { getLoginUrl } from "@/const";
import HomeAffiliates from "./home/HomeAffiliates";
import HomeFeatureCards from "./home/HomeFeatureCards";
import HomeFooter from "./home/HomeFooter";
import HomeGallery from "./home/HomeGallery";
import HomeNews from "./home/HomeNews";
import HomeQuickMenu from "./home/HomeQuickMenu";
import HomeVision from "./home/HomeVision";
import HomeWorshipPhoto from "./home/HomeWorshipPhoto";
import {
  getUsableHref,
  isExternalHref,
  type HomeFeatureCard,
  type HomeSectionConfig,
} from "./home/_helpers";

const MenuEditPanel = lazy(() => import("@/components/MenuEditPanel"));
const NoticeEditPanel = lazy(() => import("@/components/NoticeEditPanel"));
const HeroEditPanel = lazy(() => import("@/components/HeroEditPanel"));
const QuickMenuEditPanel = lazy(
  () => import("@/components/QuickMenuEditPanel")
);
const AffiliateEditPanel = lazy(
  () => import("@/components/AffiliateEditPanel")
);
const GalleryEditPanel = lazy(() => import("@/components/GalleryEditPanel"));
const HomeSectionsEditPanel = lazy(
  () => import("@/components/HomeSectionsEditPanel")
);

// 폴백(fallback) 데이터: 운영 DB가 비어 있거나 DB 오류가 난 경우에만 표시
// 예전 영상이 다시 노출되지 않도록 기본 슬라이드는 포스터 이미지만 사용한다.
const FALLBACK_HERO_SLIDES = [
  {
    videoUrl: "",
    posterUrl: "",
    yearLabel: "2026 JOYFUL",
    mainTitle: "처음 익은 열매로\n여호와를 공경하라",
    subTitle: "네 재물과 네 소산물의 처음 익은 열매로 여호와를 공경하라",
    bibleRef: "잠언 3장 9절",
    btn1Text: "새가족 등록",
    btn1Href: "/support/new-member",
    btn2Text: "예배 안내",
    btn2Href: "/worship/schedule",
  },
];
const WORSHIP_IMAGE =
  "https://d2xsxph8kpxj0f.cloudfront.net/310519663470178900/KASTcRBzh5rwhJEekrJN6E/church-worship-1_39ea085d.webp";
const VISION_IMAGE =
  "https://d2xsxph8kpxj0f.cloudfront.net/310519663470178900/KASTcRBzh5rwhJEekrJN6E/church-vision-bg_0cd6097b.webp";
const FALLBACK_QUICK_MENUS = [
  {
    icon: "fa-user-tie",
    label: "담임목사 인사",
    href: "/page/교회소개-담임목사-소개",
  },
  { icon: "fa-hands-praying", label: "선교보고서", href: "/mission" },
  { icon: "fa-newspaper", label: "주보 보기", href: "/worship/bulletin" },
  { icon: "fa-clock", label: "예배시간 안내", href: "/worship/schedule" },
  { icon: "fa-building", label: "시설사용예약", href: "/facility" },
  { icon: "fa-store", label: "조이플스토어", href: "/support/store" },
  { icon: "fa-user-plus", label: "새가족 안내", href: "/support/new-member" },
  { icon: "fa-bus", label: "차량운행 안내", href: "/support/vehicle" },
  { icon: "fa-map-marker-alt", label: "오시는 길", href: "/about/directions" },
];

const FALLBACK_AFFILIATES = [
  { icon: "fa-hands-helping", label: "기쁨의복지재단", href: null },
  { icon: "fa-building", label: "창포종합사회복지관", href: null },
  { icon: "fa-tree", label: "조이플빌리지", href: null },
  { icon: "fa-graduation-cap", label: "조이아카데미 문화강좌", href: "/education/courses" },
  {
    icon: "fa-heart",
    label: "기쁨이 있는 곳",
    href: "http://115.68.224.123:3070",
  },
];

type HeroButtonConfig = {
  label: string;
  href: string;
  color?: string;
};

type HeroButtonSource = {
  btn1Text?: string | null;
  btn1Href?: string | null;
  btn2Text?: string | null;
  btn2Href?: string | null;
  buttonsJson?: string | null;
} | null | undefined;

const DEFAULT_HERO_BUTTONS: HeroButtonConfig[] = [
  { label: "새가족 등록", href: "/support/new-member" },
  { label: "예배 안내", href: "/worship/schedule" },
];

const HERO_BUTTON_COLOR_CLASSES: Record<string, string> = {
  primary: "bg-[#1B5E20] hover:bg-[#2E7D32] text-white",
  secondary: "border-2 border-white/80 hover:bg-white/15 text-white",
  emerald: "bg-emerald-600 hover:bg-emerald-700 text-white",
  teal: "bg-teal-700 hover:bg-teal-800 text-white",
  sky: "bg-sky-600 hover:bg-sky-700 text-white",
  blue: "bg-blue-600 hover:bg-blue-700 text-white",
  indigo: "bg-indigo-600 hover:bg-indigo-700 text-white",
  purple: "bg-purple-600 hover:bg-purple-700 text-white",
  rose: "bg-rose-600 hover:bg-rose-700 text-white",
  amber: "bg-amber-500 hover:bg-amber-600 text-white",
};

function normalizeHexColor(value: string | undefined) {
  if (!value) return null;
  const trimmed = value.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) return trimmed;
  return null;
}

function getContrastTextColor(hex: string) {
  const normalized = hex.slice(1);
  const red = parseInt(normalized.slice(0, 2), 16);
  const green = parseInt(normalized.slice(2, 4), 16);
  const blue = parseInt(normalized.slice(4, 6), 16);
  const brightness = (red * 299 + green * 587 + blue * 114) / 1000;
  return brightness > 160 ? "#111827" : "#FFFFFF";
}

function getHeroButtonPresentation(button: HeroButtonConfig, index: number) {
  const colorKey = button.color?.trim();
  if (!colorKey) {
    return {
      className: index === 0 ? HERO_BUTTON_COLOR_CLASSES.primary : HERO_BUTTON_COLOR_CLASSES.secondary,
      style: undefined,
    };
  }

  const presetClass = HERO_BUTTON_COLOR_CLASSES[colorKey];
  if (presetClass) {
    return { className: presetClass, style: undefined };
  }

  const customColor = normalizeHexColor(colorKey);
  if (!customColor) {
    return {
      className: index === 0 ? HERO_BUTTON_COLOR_CLASSES.primary : HERO_BUTTON_COLOR_CLASSES.secondary,
      style: undefined,
    };
  }

  return {
    className: "border border-transparent hover:brightness-110",
    style: {
      backgroundColor: customColor,
      borderColor: customColor,
      color: getContrastTextColor(customColor),
    },
  };
}

const FALLBACK_FEATURE_CARDS: HomeFeatureCard[] = [
  {
    badge: "Saengseong Conference",
    title: "생생간증",
    description: "교회 구성원들이 나누는 실제 신앙 간증과 영감의 메시지를 소개합니다.",
    buttonText: "자세히 보기",
    imageUrl: "https://d2xsxph8kpxj0f.cloudfront.net/310519663470178900/KASTcRBzh5rwhJEekrJN6E/church-worship-praise_d34c61eb.webp",
    href: "/community/testimony",
  },
  {
    badge: "MISSION REPORT",
    title: "선교보고",
    description: "전도와 구제를 위한 선교 활동 현황을 주보와 함께 확인할 수 있습니다.",
    buttonText: "자세히 보기",
    imageUrl: "https://d2xsxph8kpxj0f.cloudfront.net/310519663470178900/KASTcRBzh5rwhJEekrJN6E/church-worship-sunday_f599f896.jpg",
    href: "/mission",
  },
  {
    badge: "PLAY GROUND",
    title: "플레이그라운드",
    description: "청소년을 위한 다양한 문화·게임 프로그램을 안내합니다.",
    buttonText: "자세히 보기",
    imageUrl: "https://d2xsxph8kpxj0f.cloudfront.net/310519663470178900/KASTcRBzh5rwhJEekrJN6E/church-exterior-3_82fdf499.jpg",
    href: "/playground",
  },
];

const FALLBACK_CHURCH_INTRO_SECTION: HomeSectionConfig = {
  eyebrow: "OUR VISION",
  title: "믿음은 사랑입니다",
  description:
    "우리는 예수 그리스도의 사랑 안에서 한마음으로 예배하고, 성장을 통해 서로를 세우며, 이웃에게 사랑을 실천합니다.",
  buttonText: "교회 소개 보기",
  buttonHref: "/about/vision",
  backgroundImage: VISION_IMAGE,
};

const FALLBACK_WORSHIP_SECTION: HomeSectionConfig = {
  eyebrow: "WORSHIP",
  title: "함께 드리는 예배",
  subtitle: "매주 토요일 저녁",
  description: "모든 성도님들이 함께 참여할 수 있는 예배를 준비합니다.",
  buttonText: "예배 시간표 보기",
  buttonHref: "/worship/schedule",
  backgroundImage: WORSHIP_IMAGE,
};

function normalizeText(value: string | null | undefined, fallback: string) {
  const text = value?.trim();
  return text ? text : fallback;
}

function parseJsonArray<T>(raw: string | null | undefined, fallback: T[]): T[] {
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return fallback;
    return parsed as T[];
  } catch {
    return fallback;
  }
}

function parseJsonObject<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return fallback;
    return parsed as T;
  } catch {
    return fallback;
  }
}

function sanitizeHeroButtons(value: unknown): HeroButtonConfig[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item): HeroButtonConfig | null => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return null;
      const record = item as Record<string, unknown>;
      const label = typeof record.label === "string" ? record.label.trim() : "";
      const href = typeof record.href === "string" ? record.href.trim() : "";
      const color = typeof record.color === "string" ? record.color : undefined;
      return label && href ? { label, href, color } : null;
    })
    .filter((button): button is HeroButtonConfig => Boolean(button))
    .slice(0, 4);
}

function parseHeroButtonsJson(raw: string | null | undefined) {
  if (typeof raw !== "string") return null;
  try {
    return sanitizeHeroButtons(JSON.parse(raw));
  } catch {
    return null;
  }
}

function getLegacyHeroButtons(slide: HeroButtonSource): HeroButtonConfig[] {
  const button1 = {
    label: normalizeText(slide?.btn1Text, DEFAULT_HERO_BUTTONS[0].label),
    href: normalizeText(slide?.btn1Href, DEFAULT_HERO_BUTTONS[0].href),
    color: undefined,
  };
  const button2 = {
    label: normalizeText(slide?.btn2Text, DEFAULT_HERO_BUTTONS[1].label),
    href: normalizeText(slide?.btn2Href, DEFAULT_HERO_BUTTONS[1].href),
    color: undefined,
  };
  return [button1, button2].filter((button) => button.label && button.href);
}

function getEffectiveHeroButtons(
  slide: HeroButtonSource,
  commonButtons: HeroButtonConfig[],
) {
  const customButtons = parseHeroButtonsJson(slide?.buttonsJson);
  if (customButtons !== null) return customButtons;
  if (commonButtons.length > 0) return commonButtons;
  return getLegacyHeroButtons(slide);
}

function sanitizeHomeFeatureCards(raw: string | null | undefined): HomeFeatureCard[] {
  const parsed = parseJsonArray<Partial<HomeFeatureCard>>(raw, FALLBACK_FEATURE_CARDS);
  return parsed.slice(0, 3).map((item, index) => {
    const fallback = FALLBACK_FEATURE_CARDS[index];
    return {
      badge: normalizeText(item.badge, fallback.badge),
      title: normalizeText(item.title, fallback.title),
      description: normalizeText(item.description, fallback.description),
      buttonText: normalizeText(item.buttonText, fallback.buttonText),
      imageUrl: normalizeText(item.imageUrl, fallback.imageUrl),
      href: normalizeText(item.href, fallback.href),
    };
  });
}

function sanitizeHomeSectionConfig(raw: string | null | undefined, fallback: HomeSectionConfig): HomeSectionConfig {
  const parsed = parseJsonObject<Partial<HomeSectionConfig>>(raw, fallback);
  return {
    eyebrow: normalizeText(parsed.eyebrow, fallback.eyebrow),
    title: normalizeText(parsed.title, fallback.title),
    description: normalizeText(parsed.description, fallback.description),
    buttonText: normalizeText(parsed.buttonText, fallback.buttonText ?? ""),
    buttonHref: normalizeText(parsed.buttonHref, fallback.buttonHref ?? ""),
    backgroundImage: normalizeText(parsed.backgroundImage, fallback.backgroundImage ?? ""),
    subtitle: normalizeText(parsed.subtitle, fallback.subtitle ?? ""),
  };
}

export default function Home() {
  // 헤더는 SiteHeader 컴포넌트로 분리됨 (App.tsx에서 공통 적용)};
  const [heroIndex, setHeroIndex] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);

  // DB에서 데이터 불러오기
  const {
    data: dbHeroSlides,
    isFetched: heroSlidesFetched,
    isError: heroSlidesError,
  } = trpc.home.heroSlides.useQuery(undefined, {
    refetchOnWindowFocus: true,
  });
  const {
    data: dbQuickMenus,
    isFetched: quickMenusFetched,
    isError: quickMenusError,
  } = trpc.home.quickMenus.useQuery();
  const { data: dbNotices } = trpc.home.notices.useQuery();
  const {
    data: dbAffiliates,
    isFetched: affiliatesFetched,
    isError: affiliatesError,
  } = trpc.home.affiliates.useQuery();
  const { data: dbGallery } = trpc.home.homeGallery.useQuery();
  const { data: dbSettings } = trpc.home.settings.useQuery();

  // DB 데이터 또는 폴백 데이터 사용.
  // 로딩 중에는 폴백을 먼저 보여주지 않는다. 새로고침 순간에 예전 기본 메뉴가 깜박이는 것을 막기 위함이다.
  const shouldUseHeroFallback =
    (heroSlidesFetched || heroSlidesError) &&
    (!dbHeroSlides || dbHeroSlides.length === 0);
  const shouldUseQuickMenuFallback =
    (quickMenusFetched || quickMenusError) &&
    (!dbQuickMenus || dbQuickMenus.length === 0);
  const shouldUseAffiliatesFallback =
    (affiliatesFetched || affiliatesError) &&
    (!dbAffiliates || dbAffiliates.length === 0);
  const heroSlides =
    dbHeroSlides && dbHeroSlides.length > 0
      ? dbHeroSlides
      : shouldUseHeroFallback
        ? FALLBACK_HERO_SLIDES
        : [];
  const currentHeroSlide = heroSlides[heroIndex] ?? heroSlides[0] ?? null;
  const currentHeroVideoUrl = currentHeroSlide?.videoUrl?.trim() ?? "";
  const currentHeroPosterUrl = currentHeroSlide?.posterUrl?.trim() ?? "";
  const isFallbackHeroSlide =
    currentHeroSlide != null && !("id" in currentHeroSlide);
  const visibleHeroPosterUrl =
    currentHeroPosterUrl ||
    (isFallbackHeroSlide ? FALLBACK_HERO_SLIDES[0]?.posterUrl || "" : "");
  const commonHeroButtons = parseHeroButtonsJson(dbSettings?.home_hero_common_buttons) ?? [];
  const currentHeroButtons = getEffectiveHeroButtons(currentHeroSlide, commonHeroButtons);
  const currentHeroKey = currentHeroSlide
    ? `${"id" in currentHeroSlide ? currentHeroSlide.id : "fallback"}-${heroIndex}-${currentHeroVideoUrl}`
    : "hero-loading";
  const quickMenus =
    dbQuickMenus && dbQuickMenus.length > 0
      ? dbQuickMenus
      : shouldUseQuickMenuFallback
        ? FALLBACK_QUICK_MENUS
        : [];
  const affiliates =
    dbAffiliates && dbAffiliates.length > 0
      ? dbAffiliates
      : shouldUseAffiliatesFallback
        ? FALLBACK_AFFILIATES
        : [];
  const gallery = dbGallery ?? [];
  const homeFeatureCards = sanitizeHomeFeatureCards(
    dbSettings?.home_feature_cards
  );
  const churchIntroSection = sanitizeHomeSectionConfig(
    dbSettings?.home_church_intro_section,
    FALLBACK_CHURCH_INTRO_SECTION
  );
  const worshipSection = sanitizeHomeSectionConfig(
    dbSettings?.home_worship_section,
    FALLBACK_WORSHIP_SECTION
  );
  const socialLinks = [
    {
      icon: "fab fa-youtube",
      label: "유튜브",
      href: dbSettings?.youtube_url || "/worship/tv",
    },
    {
      icon: "fab fa-facebook-f",
      label: "페이스북",
      href: dbSettings?.facebook_url || null,
    },
    {
      icon: "fab fa-instagram",
      label: "인스타그램",
      href: dbSettings?.instagram_url || null,
    },
  ];

  // 관리자 여부 확인 (편집 모드용)
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  // 성도 로그인 상태는 SiteHeader에서 관리됨

  // 슬라이드 패널 상태
  const [menuPanelOpen, setMenuPanelOpen] = useState(false);
  const [noticePanelOpen, setNoticePanelOpen] = useState(false);
  const [heroPanelOpen, setHeroPanelOpen] = useState(false);
  const [quickMenuPanelOpen, setQuickMenuPanelOpen] = useState(false);
  const [affiliatePanelOpen, setAffiliatePanelOpen] = useState(false);
  const [galleryPanelOpen, setGalleryPanelOpen] = useState(false);
  const [homeSectionsPanelOpen, setHomeSectionsPanelOpen] = useState(false);
  const [adminToolsOpen, setAdminToolsOpen] = useState(false);
  const utils = trpc.useUtils();

  // 로그아웃 mutation
  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      window.location.reload();
    },
  });
  const { data: notificationSummary } = trpc.cms.notifications.summary.useQuery(undefined, {
    enabled: isAdmin,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
  const notificationCount = notificationSummary?.totalCount ?? 0;

  // 영상이 끝나면 다음 슬라이드로 전환
  const handleVideoEnded = () => {
    if (heroSlides.length <= 1) return;
    setHeroIndex(prev => (prev + 1) % heroSlides.length);
  };

  // 슬라이드 데이터 또는 영상 URL이 바뀌면 기존 미디어 버퍼를 비우고 새 영상을 재생합니다.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.load();
    if (currentHeroVideoUrl) {
      video.play().catch(() => {});
    }
  }, [currentHeroVideoUrl, visibleHeroPosterUrl]);

  useEffect(() => {
    if (heroSlides.length === 0 || heroIndex < heroSlides.length) return;
    setHeroIndex(0);
  }, [heroIndex, heroSlides.length]);

  // scrolled 상태는 SiteHeader에서 관리됨

  return (
    <div
      className="min-h-screen bg-[#FAFAF8]"
      style={{ fontFamily: "'Noto Sans KR', sans-serif" }}
    >
      {/* ===== 관리자 편집 바 (isAdmin일 때만 표시) ===== */}
      {isAdmin && (
        <>
          <HomeAdminDock
            loggingOut={logoutMutation.isPending}
            notificationCount={notificationCount}
            open={adminToolsOpen}
            onClose={() => setAdminToolsOpen(false)}
            onLogout={() => logoutMutation.mutate()}
            onOpenAffiliates={() => {
              setAdminToolsOpen(false);
              setAffiliatePanelOpen(true);
            }}
            onOpenHero={() => {
              setAdminToolsOpen(false);
              setHeroPanelOpen(true);
            }}
            onOpenHomeSections={() => {
              setAdminToolsOpen(false);
              setHomeSectionsPanelOpen(true);
            }}
            onOpenMenu={() => {
              setAdminToolsOpen(false);
              setMenuPanelOpen(true);
            }}
            onOpenQuickMenu={() => {
              setAdminToolsOpen(false);
              setQuickMenuPanelOpen(true);
            }}
            onToggle={() => {
              const hasOpenPanel =
                menuPanelOpen ||
                noticePanelOpen ||
                heroPanelOpen ||
                quickMenuPanelOpen ||
                affiliatePanelOpen ||
                galleryPanelOpen ||
                homeSectionsPanelOpen;

              if (hasOpenPanel) {
                setMenuPanelOpen(false);
                setNoticePanelOpen(false);
                setHeroPanelOpen(false);
                setQuickMenuPanelOpen(false);
                setAffiliatePanelOpen(false);
                setGalleryPanelOpen(false);
                setHomeSectionsPanelOpen(false);
                setAdminToolsOpen(true);
                return;
              }

              setAdminToolsOpen(prev => !prev);
            }}
          />
        <div className="hidden bg-[#1B5E20] text-white text-xs py-2 px-4 flex items-center justify-between sticky top-0 z-[100]">
          <span className="font-semibold tracking-wide">✏️ 편집 모드</span>
          <div className="flex gap-2">
            <button
              onClick={() => setMenuPanelOpen(true)}
              className="bg-white/20 hover:bg-white/30 text-white text-xs px-3 py-1 rounded transition-colors"
            >
              메뉴 편집
            </button>
            <button
              onClick={() => setNoticePanelOpen(true)}
              className="bg-white/20 hover:bg-white/30 text-white text-xs px-3 py-1 rounded transition-colors"
            >
              교회 소식 편집
            </button>
            <button
              onClick={() => setHeroPanelOpen(true)}
              className="bg-white/20 hover:bg-white/30 text-white text-xs px-3 py-1 rounded transition-colors"
            >
              슬라이드 편집
            </button>
            <button
              onClick={() => setQuickMenuPanelOpen(true)}
              className="bg-white/20 hover:bg-white/30 text-white text-xs px-3 py-1 rounded transition-colors"
            >
              퀵메뉴 편집
            </button>
            <button
              onClick={() => setAffiliatePanelOpen(true)}
              className="bg-white/20 hover:bg-white/30 text-white text-xs px-3 py-1 rounded transition-colors"
            >
              관련기관 편집
            </button>
            <button
              onClick={() => setGalleryPanelOpen(true)}
              className="bg-white/20 hover:bg-white/30 text-white text-xs px-3 py-1 rounded transition-colors"
            >
              갤러리 편집
            </button>
            <button
              onClick={() => setHomeSectionsPanelOpen(true)}
              className="bg-white/20 hover:bg-white/30 text-white text-xs px-3 py-1 rounded transition-colors"
            >
              홈섹션 편집
            </button>
            <a
              href="/admin_joych_2026"
              className="bg-white/20 hover:bg-white/30 text-white text-xs px-3 py-1 rounded transition-colors"
            >
              관리자 대시보드
            </a>
            <button
              onClick={() => logoutMutation.mutate()}
              disabled={logoutMutation.isPending}
              className="bg-red-500/70 hover:bg-red-500 text-white text-xs px-3 py-1 rounded transition-colors disabled:opacity-60"
            >
              {logoutMutation.isPending ? "로그아웃 중..." : "로그아웃"}
            </button>
          </div>
        </div>
        </>
      )}

      {isAdmin && (
        <Suspense fallback={null}>
          {menuPanelOpen && (
            <MenuEditPanel
              open={menuPanelOpen}
              onClose={() => {
                setMenuPanelOpen(false);
                utils.home.menus.invalidate();
              }}
            />
          )}
          {noticePanelOpen && (
            <NoticeEditPanel
              open={noticePanelOpen}
              onClose={() => {
                setNoticePanelOpen(false);
                utils.home.notices.invalidate();
              }}
            />
          )}
          {heroPanelOpen && (
            <HeroEditPanel
              open={heroPanelOpen}
              onClose={() => {
                setHeroPanelOpen(false);
                utils.home.heroSlides.invalidate();
              }}
            />
          )}
          {quickMenuPanelOpen && (
            <QuickMenuEditPanel
              open={quickMenuPanelOpen}
              onClose={() => {
                setQuickMenuPanelOpen(false);
                utils.home.quickMenus.invalidate();
              }}
            />
          )}
          {affiliatePanelOpen && (
            <AffiliateEditPanel
              open={affiliatePanelOpen}
              onClose={() => {
                setAffiliatePanelOpen(false);
                utils.home.affiliates.invalidate();
              }}
            />
          )}
          {galleryPanelOpen && (
            <GalleryEditPanel
              open={galleryPanelOpen}
              onClose={() => {
                setGalleryPanelOpen(false);
                utils.home.homeGallery.invalidate();
              }}
            />
          )}
          {homeSectionsPanelOpen && (
            <HomeSectionsEditPanel
              open={homeSectionsPanelOpen}
              onClose={() => {
                setHomeSectionsPanelOpen(false);
                utils.home.settings.invalidate();
              }}
            />
          )}
        </Suspense>
      )}

      {/* ===== 히어로 섹션 ===== */}
      <section className="relative h-screen min-h-[600px] flex items-center overflow-hidden">
        {/* 배경 영상 슬라이드 */}
        {visibleHeroPosterUrl && (
          <img
            src={visibleHeroPosterUrl}
            alt=""
            aria-hidden="true"
            fetchPriority="high"
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}
        {currentHeroVideoUrl && (
          <video
            ref={videoRef}
            key={currentHeroKey}
            className="absolute inset-0 w-full h-full object-cover"
            src={currentHeroVideoUrl}
            autoPlay
            muted
            playsInline
            preload="metadata"
            poster={visibleHeroPosterUrl}
            onEnded={handleVideoEnded}
          />
        )}
        {/* 영상 위 오버레이 — 글씨 가독성 확보 */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-black/10" />

        {/* 콘텐츠 */}
        <div className="container relative z-10">
          <div className="max-w-xl text-white">
            <p
              className="text-xs md:text-sm tracking-[0.3em] text-[#A5D6A7] mb-3 md:mb-4 font-medium"
              style={{ animation: "fadeUp 0.8s ease 0.2s both" }}
            >
              {currentHeroSlide?.yearLabel ?? "2026 JOYFUL"}
            </p>
            <h1
              className="text-2xl md:text-5xl lg:text-6xl font-bold leading-tight mb-3 md:mb-5"
              style={{
                fontFamily: "'Noto Serif KR', serif",
                animation: "fadeUp 0.8s ease 0.4s both",
              }}
            >
              {(
                currentHeroSlide?.mainTitle ??
                "처음 익은 열매로\n여호와를 공경하라"
              )
                .split("\n")
                .map((line, i) => (
                  <span key={i}>
                    {line}
                    {i === 0 && <br />}
                  </span>
                ))}
            </h1>
            <p
              className="text-white/75 text-sm md:text-base leading-relaxed mb-6 md:mb-8"
              style={{ animation: "fadeUp 0.8s ease 0.6s both" }}
            >
              {currentHeroSlide?.subTitle ?? ""}
              <br />
              <span className="text-[#A5D6A7] text-xs md:text-sm">
                — {currentHeroSlide?.bibleRef ?? ""}
              </span>
            </p>
            <div
              style={{ animation: "fadeUp 0.8s ease 0.8s both" }}
              className="flex gap-2 md:gap-3 flex-wrap"
            >
              {currentHeroButtons.map((button, index) => {
                const { className, style } = getHeroButtonPresentation(button, index);
                const href = getUsableHref(
                  button.href,
                  DEFAULT_HERO_BUTTONS[index]?.href ?? "#"
                );
                const openInNewTab = isExternalHref(href);

                return (
                  <a
                    key={`${button.label}-${button.href}-${index}`}
                    href={href}
                    target={openInNewTab ? "_blank" : undefined}
                    rel={openInNewTab ? "noreferrer noopener" : undefined}
                    className={`px-5 md:px-7 py-2.5 md:py-3 text-xs md:text-sm font-medium rounded transition-colors ${className}`}
                    style={style}
                  >
                    {button.label}
                  </a>
                );
              })}
            </div>
          </div>
        </div>

        {/* 슬라이드 인디케이터 (하단 점) - SCROLL 위에 배치 */}
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-10 flex gap-2">
          {heroSlides.map((_, i) => (
            <button
              key={i}
              onClick={() => setHeroIndex(i)}
              className={`w-2 h-2 rounded-full transition-all duration-300 ${
                i === heroIndex ? "bg-white w-6" : "bg-white/40"
              }`}
            />
          ))}
        </div>

        {/* 스크롤 인디케이터 */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex-col items-center gap-1 hidden md:flex">
          <span className="text-white/50 text-xs tracking-widest">SCROLL</span>
          <div
            className="w-px h-10 bg-gradient-to-b from-white/60 to-transparent"
            style={{ animation: "scrollPulse 2s ease-in-out infinite" }}
          />
        </div>
      </section>

      <HomeFeatureCards homeFeatureCards={homeFeatureCards} />

      <HomeQuickMenu quickMenus={quickMenus} />

      <HomeNews dbNotices={dbNotices && dbNotices.length > 0 ? dbNotices : []} />

      <HomeVision churchIntroSection={churchIntroSection} />


      <HomeWorshipPhoto worshipSection={worshipSection} />

      <HomeGallery gallery={gallery} />

      <HomeAffiliates affiliates={affiliates} />

      <PwaInstallCard />

      {/* ===== 푸터 ===== */}
      <HomeFooter
        address={dbSettings?.address}
        tel={dbSettings?.tel}
        fax={dbSettings?.fax}
        socialLinks={socialLinks}
      />

      {/* ===== 애니메이션 스타일 ===== */}
      <style>{`
        @keyframes heroZoom {
          from { transform: scale(1); }
          to   { transform: scale(1.06); }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes scrollPulse {
          0%, 100% { opacity: 0.4; transform: scaleY(0.6); }
          50%       { opacity: 1;   transform: scaleY(1); }
        }
      `}</style>
    </div>
  );
}
