/**
 * 기쁨의교회 홈페이지 메인 페이지
 * 디자인: Warm Modern Sacred — 따뜻한 녹색 포인트, Noto Serif KR 헤딩, 넓은 여백
 * 구성: TopBar → Header(GNB) → Hero → QuickMenu → Content(TV+News) → Vision → Affiliates → Footer
 */

import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import MenuEditPanel from "@/components/MenuEditPanel";
import NoticeEditPanel from "@/components/NoticeEditPanel";
import HeroEditPanel from "@/components/HeroEditPanel";
import QuickMenuEditPanel from "@/components/QuickMenuEditPanel";
import AffiliateEditPanel from "@/components/AffiliateEditPanel";

// 폴백(fallback) 데이터: DB 로딩 전 또는 DB 오류 시 표시
const FALLBACK_HERO_SLIDES = [
  {
    videoUrl: "https://d2xsxph8kpxj0f.cloudfront.net/310519663470178900/KASTcRBzh5rwhJEekrJN6E/church-video-2_9d9fb792.mp4",
    posterUrl: "https://d2xsxph8kpxj0f.cloudfront.net/310519663470178900/KASTcRBzh5rwhJEekrJN6E/hero-church-XWJBwHDycyRoBg9dY4aj5r.webp",
    yearLabel: "2026 JOYFUL",
    mainTitle: "처음 익은 열매로\n여호와를 공경하라",
    subTitle: "네 재물과 네 소산물의 처음 익은 열매로 여호와를 공경하라",
    bibleRef: "잠언 3장 9절",
    btn1Text: "새가족 등록", btn1Href: "#",
    btn2Text: "예배 안내", btn2Href: "#",
  },
  {
    videoUrl: "https://d2xsxph8kpxj0f.cloudfront.net/310519663470178900/KASTcRBzh5rwhJEekrJN6E/church-video-3_1b86687f.mp4",
    posterUrl: "https://d2xsxph8kpxj0f.cloudfront.net/310519663470178900/KASTcRBzh5rwhJEekrJN6E/hero-church-XWJBwHDycyRoBg9dY4aj5r.webp",
    yearLabel: "2026 JOYFUL",
    mainTitle: "처음 익은 열매로\n여호와를 공경하라",
    subTitle: "네 재물과 네 소산물의 처음 익은 열매로 여호와를 공경하라",
    bibleRef: "잠언 3장 9절",
    btn1Text: "새가족 등록", btn1Href: "#",
    btn2Text: "예배 안내", btn2Href: "#",
  },
];
const WORSHIP_IMAGE = "https://d2xsxph8kpxj0f.cloudfront.net/310519663470178900/KASTcRBzh5rwhJEekrJN6E/church-worship-1_39ea085d.webp";
const VISION_IMAGE = "https://d2xsxph8kpxj0f.cloudfront.net/310519663470178900/KASTcRBzh5rwhJEekrJN6E/church-vision-bg_0cd6097b.webp";

const NAV_ITEMS = [
  {
    label: "교회소개",
    sub: ["담임목사 소개", "예배안내", "섬기는 분", "교회백서", "사역원리", "CI", "시설물 안내", "오시는 길", "셔틀버스"],
    subHref: {
      "담임목사 소개": "/about/pastor",
      "예배안내": "/worship/schedule",
      "섬기는 분": "/about/staff",
      "교회백서": "/about/whitebook",
      "사역원리": "/about/principle",
      "CI": "/about/ci",
      "시설물 안내": "/facility",
      "오시는 길": "/about/directions",
      "셔틀버스": "/about/shuttle",
    }
  },
  {
    label: "조이풀TV",
    sub: ["실시간 예배영상", "주일예배", "헤브론 수요예배", "쉐키나 금요기도회", "새벽 글로리아 성서학당", "박진석 목사 시리즈설교", "하영인 새벽기도회 설교", "특별예배", "특집", "간증", "찬양"],
    subHref: {
      "실시간 예배영상": "/worship/tv",
      "주일예배": "/worship/tv/sunday",
      "헤브론 수요예배": "/worship/tv/hebron",
      "쉐키나 금요기도회": "/worship/tv/shekhinah",
      "새벽 글로리아 성서학당": "/worship/tv/gloria",
      "박진석 목사 시리즈설교": "/worship/tv/pastor-series",
      "하영인 새벽기도회 설교": "/worship/tv/hayoungin",
      "특별예배": "/worship/tv/special",
      "특집": "/worship/tv/feature",
      "간증": "/worship/tv/testimony",
      "찬양": "/worship/tv/praise",
    }
  },
  {
    label: "양육/훈련",
    sub: ["헤세드아시아포재팬", "제자훈련", "장로훈련", "일대일 양육", "선생님학교", "생선 컨퍼런스", "세계선교", "전도", "기도사역", "복지사역", "비전대학교", "조이랩"],
    subHref: {
      "헤세드아시아포재팬": "/education/hesed",
      "제자훈련": "/education/disciple2",
      "장로훈련": "/education/elder",
      "일대일 양육": "/education/one-on-one",
      "선생님학교": "/education/sunseumschool",
      "생선 컨퍼런스": "/education/saengseon",
      "세계선교": "/ministry/world-mission",
      "전도": "/ministry/evangelism",
      "기도사역": "/ministry/prayer",
      "복지사역": "/ministry/welfare",
      "비전대학교": "/ministry/vision-univ",
      "조이랩": "/ministry/joylab",
    }
  },
  {
    label: "교회학교",
    sub: ["영아부", "유아부", "유치부", "초등부", "중고등부", "청년부", "AWANA"],
    subHref: {
      "영아부": "/school/infant",
      "유아부": "/school/infant",
      "유치부": "/school/kinder",
      "초등부": "/school/elementary",
      "중고등부": "/school/youth",
      "청년부": "/school/young-adult",
      "AWANA": "/school/awana",
    }
  },
  {
    label: "선교보고",
    sub: ["선교보고 목록"],
    subHref: {
      "선교보고 목록": "/mission",
    }
  },
  {
    label: "커뮤니티",
    sub: ["순모임", "자치기관", "동호회", "사진", "기쁨톡", "HOT NEWS", "공지사항"],
    subHref: {
      "순모임": "/community/soon",
      "자치기관": "/community/organization",
      "동호회": "/community/club",
      "사진": "/community/photo",
      "기쁨톡": "/community/joytalk",
      "HOT NEWS": "/community/news",
      "공지사항": "/community/news",
    }
  },
  {
    label: "행정지원",
    sub: ["주보", "자막 신청", "온라인사무국", "탐방신청", "조이풀빌리지", "기부금 영수증"],
    subHref: {
      "주보": "/worship/bulletin",
      "자막 신청": "/admin/subtitle",
      "온라인사무국": "/admin/office",
      "탐방신청": "/admin/tour",
      "조이풀빌리지": "/admin/store",
      "기부금 영수증": "/admin/donation",
    }
  },
];

const FALLBACK_QUICK_MENUS = [
  { icon: "fa-user-tie", label: "담임목사 인사", href: "/about/pastor" },
  { icon: "fa-hands-praying", label: "선교보고서", href: "/mission" },
  { icon: "fa-newspaper", label: "주보 보기", href: "/worship/bulletin" },
  { icon: "fa-clock", label: "예배시간 안내", href: "/worship/schedule" },
  { icon: "fa-building", label: "시설사용예약", href: "/facility" },
  { icon: "fa-store", label: "조이플스토어", href: "/admin/store" },
  { icon: "fa-user-plus", label: "새가족 안내", href: "/admin/new-member" },
  { icon: "fa-bus", label: "차량운행 안내", href: "/admin/vehicle" },
  { icon: "fa-map-marker-alt", label: "오시는 길", href: "/about/directions" },
];

const SERMONS = [
  { badge: "주일예배", title: "처음 익은 열매로 여호와를 공경하라", date: "2026.03.29" },
  { badge: "수요예배", title: "믿음으로 나아가는 삶", date: "2026.03.26" },
  { badge: "새벽기도", title: "하나님의 은혜가 넘치는 곳", date: "2026.03.25" },
];

const BADGE_COLORS: Record<string, string> = {
  "공지": "bg-blue-100 text-blue-700",
  "행사": "bg-amber-100 text-amber-700",
  "찬양": "bg-green-100 text-green-700",
};

const FALLBACK_AFFILIATES = [
  { icon: "fa-hands-helping", label: "기쁨의복지재단", href: "#" },
  { icon: "fa-building", label: "창포종합사회복지관", href: "#" },
  { icon: "fa-tree", label: "조이플빌리지", href: "#" },
  { icon: "fa-graduation-cap", label: "조이아카데미 문화강좌", href: "#" },
  { icon: "fa-heart", label: "기쁨이 있는 곳", href: "https://gippeum-arc-oawnrvau.manus.space/" },
];

const FALLBACK_GALLERY = [
  { imageUrl: "https://d2xsxph8kpxj0f.cloudfront.net/310519663470178900/KASTcRBzh5rwhJEekrJN6E/church-exterior-3_82fdf499.jpg", caption: "기쁨의교회 야경", gridSpan: "col-span-2 row-span-2" },
  { imageUrl: "https://d2xsxph8kpxj0f.cloudfront.net/310519663470178900/KASTcRBzh5rwhJEekrJN6E/church-worship-praise_d34c61eb.webp", caption: "찬양 집회", gridSpan: "col-span-1 row-span-1" },
  { imageUrl: "https://d2xsxph8kpxj0f.cloudfront.net/310519663470178900/KASTcRBzh5rwhJEekrJN6E/church-worship-sunday_f599f896.jpg", caption: "주일예배", gridSpan: "col-span-1 row-span-1" },
  { imageUrl: "https://d2xsxph8kpxj0f.cloudfront.net/310519663470178900/KASTcRBzh5rwhJEekrJN6E/church-exterior-1_eb2be3e7.webp", caption: "교회 전경 (야경)", gridSpan: "col-span-1 row-span-1" },
  { imageUrl: "https://d2xsxph8kpxj0f.cloudfront.net/310519663470178900/KASTcRBzh5rwhJEekrJN6E/church-exterior-2_b3093207.jpg", caption: "교회 전경 (주간)", gridSpan: "col-span-1 row-span-1" },
];

// 스크롤 애니메이션 훅
function useFadeIn() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setVisible(true); obs.disconnect(); }
    }, { threshold: 0.1 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return { ref, visible };
}

function FadeIn({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  const { ref, visible } = useFadeIn();
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(28px)",
        transition: `opacity 0.6s ease ${delay}ms, transform 0.6s ease ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

export default function Home() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeNav, setActiveNav] = useState<number | null>(null);
  // 신앙 데이터 검색
  const [searchName, setSearchName] = useState("");
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

  const [, setLocation] = useLocation();

  const handleSearch = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = searchName.trim();
    if (!trimmed) return;
    setMobileSearchOpen(false);
    setLocation(`/church-directory?name=${encodeURIComponent(trimmed)}`);
  };
  const [heroIndex, setHeroIndex] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);

  // DB에서 데이터 불러오기
  const { data: dbHeroSlides } = trpc.home.heroSlides.useQuery();
  const { data: dbQuickMenus } = trpc.home.quickMenus.useQuery();
  const { data: dbNotices } = trpc.home.notices.useQuery();
  const { data: dbAffiliates } = trpc.home.affiliates.useQuery();
  const { data: dbGallery } = trpc.home.gallery.useQuery();
  const { data: dbSettings } = trpc.home.settings.useQuery();
  const { data: dbMenus, refetch: refetchMenus } = trpc.home.menus.useQuery();

  // DB 데이터 또는 폴백 데이터 사용
  const heroSlides = (dbHeroSlides && dbHeroSlides.length > 0) ? dbHeroSlides : FALLBACK_HERO_SLIDES;
  const quickMenus = (dbQuickMenus && dbQuickMenus.length > 0) ? dbQuickMenus : FALLBACK_QUICK_MENUS;
  const affiliates = (dbAffiliates && dbAffiliates.length > 0) ? dbAffiliates : FALLBACK_AFFILIATES;
  const gallery = (dbGallery && dbGallery.length > 0) ? dbGallery : FALLBACK_GALLERY;
  const navMenus = (dbMenus && dbMenus.length > 0) ? dbMenus : null;

  // 관리자 여부 확인 (편집 모드용)
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  // 슬라이드 패널 상태
  const [menuPanelOpen, setMenuPanelOpen] = useState(false);
  const [noticePanelOpen, setNoticePanelOpen] = useState(false);
  const [heroPanelOpen, setHeroPanelOpen] = useState(false);
  const [quickMenuPanelOpen, setQuickMenuPanelOpen] = useState(false);
  const [affiliatePanelOpen, setAffiliatePanelOpen] = useState(false);
  const utils = trpc.useUtils();

  // 로그아웃 mutation
  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      window.location.reload();
    },
  });

  // 영상이 끝나면 다음 슬라이드로 전환
  const handleVideoEnded = () => {
    setHeroIndex((prev) => (prev + 1) % heroSlides.length);
  };

  // 슬라이드 변경 시 영상 재생
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.load();
      videoRef.current.play().catch(() => {});
    }
  }, [heroIndex]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="min-h-screen bg-[#FAFAF8]" style={{ fontFamily: "'Noto Sans KR', sans-serif" }}>

      {/* ===== 관리자 편집 바 (isAdmin일 때만 표시) ===== */}
      {isAdmin && (
        <div className="bg-[#1B5E20] text-white text-xs py-2 px-4 flex items-center justify-between sticky top-0 z-[100]">
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
            <a
              href="/admin"
              className="bg-white/20 hover:bg-white/30 text-white text-xs px-3 py-1 rounded transition-colors"
            >
              관리자 대시보드
            </a>
            <button
              onClick={() => logoutMutation.mutate()}
              disabled={logoutMutation.isPending}
              className="bg-red-500/70 hover:bg-red-500 text-white text-xs px-3 py-1 rounded transition-colors disabled:opacity-60"
            >
              {logoutMutation.isPending ? '로그아웃 중...' : '로그아웃'}
            </button>
          </div>
        </div>
      )}

      {/* 메뉴 편집 슬라이드 패널 */}
      <MenuEditPanel
        open={menuPanelOpen}
        onClose={() => {
          setMenuPanelOpen(false);
          utils.home.menus.invalidate();
        }}
      />

      {/* 교회 소식 편집 슬라이드 패널 */}
      <NoticeEditPanel
        open={noticePanelOpen}
        onClose={() => {
          setNoticePanelOpen(false);
          utils.home.notices.invalidate();
        }}
      />

      {/* 히어로 슬라이드 편집 패널 */}
      <HeroEditPanel
        open={heroPanelOpen}
        onClose={() => {
          setHeroPanelOpen(false);
          utils.home.heroSlides.invalidate();
        }}
      />

      {/* 퀵메뉴 편집 패널 */}
      <QuickMenuEditPanel
        open={quickMenuPanelOpen}
        onClose={() => {
          setQuickMenuPanelOpen(false);
          utils.home.quickMenus.invalidate();
        }}
      />

      {/* 관련 기관 편집 패널 */}
      <AffiliateEditPanel
        open={affiliatePanelOpen}
        onClose={() => {
          setAffiliatePanelOpen(false);
          utils.home.affiliates.invalidate();
        }}
      />

      {/* ===== 상단 유틸 바 ===== */}
      <div className="bg-[#0F172A] text-gray-400 text-xs py-2 hidden md:block">
        <div className="container flex justify-between items-center">
          <span className="tracking-wide">깊이있는 성장, 위대한 교회</span>
          <div className="flex gap-4 items-center">
            {isAdmin ? (
              <Link href="/admin" className="hover:text-white transition-colors text-[#A5D6A7] font-medium">관리자 페이지</Link>
            ) : (
              <a href={getLoginUrl()} className="hover:text-white transition-colors">관리자 로그인</a>
            )}
            <div className="flex gap-3 ml-2">
              <a href="#" className="hover:text-white transition-colors"><i className="fab fa-youtube"></i></a>
              <a href="#" className="hover:text-white transition-colors"><i className="fab fa-facebook-f"></i></a>
              <a href="#" className="hover:text-white transition-colors"><i className="fab fa-instagram"></i></a>
            </div>
          </div>
        </div>
      </div>

      {/* ===== 헤더 & GNB ===== */}
      <header
        className={`sticky top-0 z-[150] bg-white transition-shadow duration-300 ${scrolled ? "shadow-lg" : "shadow-sm"}`}
      >
        <div className="container flex items-center justify-between h-16 md:h-[72px]">
          {/* 로고 */}
          <a href="#" className="flex items-center">
            <img
              src="https://d2xsxph8kpxj0f.cloudfront.net/310519663470178900/KASTcRBzh5rwhJEekrJN6E/church-logo_35c62cc5.jpg"
              alt="기쁨의교회"
              className="h-10 md:h-12 w-auto object-contain"
            />
          </a>

          {/* 신앙 데이터 검색창 — PC */}
          <form
            onSubmit={handleSearch}
            className="hidden md:flex items-center gap-0 mx-4 flex-1 max-w-[320px]"
          >
            <div className="relative w-full">
              <input
                type="text"
                value={searchName}
                onChange={(e) => setSearchName(e.target.value)}
                placeholder="이름으로 신앙 데이터 검색"
                className="w-full h-9 pl-4 pr-10 text-sm rounded-full border-2 border-[#1B5E20]/30 bg-[#F1F8E9] text-gray-700 placeholder-gray-400 focus:outline-none focus:border-[#1B5E20] focus:bg-white transition-all duration-200"
              />
              <button
                type="submit"
                className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center text-[#1B5E20] hover:text-[#2E7D32] transition-colors"
              >
                <i className="fas fa-search text-sm"></i>
              </button>
            </div>
          </form>

          {/* PC 메뉴 */}
          <nav className="hidden md:block">
            <ul className="flex">
              {(navMenus ?? NAV_ITEMS.map((item, i) => ({ id: i + 1, label: item.label, href: (item as { href?: string }).href ?? null, items: item.sub.map((s, j) => ({ id: j + 1, label: s, href: (item as { subHref?: Record<string, string | undefined> }).subHref?.[s] ?? null })) }))).map((item, i) => (
                <li
                  key={item.id}
                  className="relative group"
                >
                  <div className="flex items-center h-[72px] px-4 relative">
                    <a
                      href={item.href ?? '#'}
                      className="text-sm font-medium text-gray-700 hover:text-[#1B5E20] transition-colors"
                    >
                      {item.label}
                    </a>
                    <span className="absolute bottom-0 left-0 right-0 h-[3px] bg-[#1B5E20] scale-x-0 group-hover:scale-x-100 transition-transform duration-200 origin-left"></span>
                  </div>
                  {(item.items ?? []).length > 0 && (
                    <ul className="absolute top-[72px] left-0 bg-white border-t-2 border-[#1B5E20] shadow-xl min-w-[150px] z-[200] py-1 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150">
                      {(item.items ?? []).map((s, j) => {
                        const cls = "block px-5 py-2.5 text-sm text-gray-600 hover:bg-[#F1F8E9] hover:text-[#1B5E20] transition-colors border-b border-gray-50 last:border-0 whitespace-nowrap";
                        return (
                          <li key={j}>
                            {s.href ? (
                              <Link href={s.href} className={cls}>{s.label}</Link>
                            ) : (
                              <a href="#" className={cls}>{s.label}</a>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          </nav>

          {/* 모바일 오른쪽 버튼 그룹 */}
          <div className="md:hidden flex items-center gap-1">
            {/* 검색 아이콘 버튼 */}
            <button
              className="p-2 text-[#1B5E20]"
              onClick={() => { setMobileSearchOpen(!mobileSearchOpen); setMobileOpen(false); }}
              aria-label="신앙 데이터 검색"
            >
              <i className={`fas ${mobileSearchOpen ? "fa-times" : "fa-search"} text-lg`}></i>
            </button>
            {/* 햄버거 버튼 */}
            <button
              className="p-2 text-gray-700"
              onClick={() => { setMobileOpen(!mobileOpen); setMobileSearchOpen(false); }}
            >
              <i className={`fas ${mobileOpen ? "fa-times" : "fa-bars"} text-xl`}></i>
            </button>
          </div>
        </div>

        {/* 모바일 검색창 패널 */}
        {mobileSearchOpen && (
          <div className="md:hidden bg-[#F1F8E9] border-t border-[#1B5E20]/20 px-4 py-3">
            <form onSubmit={handleSearch} className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={searchName}
                  onChange={(e) => setSearchName(e.target.value)}
                  placeholder="이름으로 신앙 데이터 검색"
                  autoFocus
                  className="w-full h-11 pl-4 pr-4 text-base rounded-full border-2 border-[#1B5E20]/40 bg-white text-gray-700 placeholder-gray-400 focus:outline-none focus:border-[#1B5E20] transition-all duration-200"
                />
              </div>
              <button
                type="submit"
                className="h-11 px-5 rounded-full bg-[#1B5E20] text-white text-sm font-medium hover:bg-[#2E7D32] transition-colors shrink-0"
              >
                검색
              </button>
            </form>
            <p className="text-xs text-gray-400 mt-2 pl-1">성도 이름을 입력하면 신앙 데이터 페이지로 이동합니다.</p>
          </div>
        )}

        {/* 모바일 메뉴 */}
        {mobileOpen && (
          <div className="md:hidden bg-white border-t border-gray-100 shadow-lg">
            {NAV_ITEMS.map((item, i) => (
              <a key={i} href="#" className="block px-5 py-3 text-sm text-gray-700 border-b border-gray-50 hover:bg-[#F1F8E9] hover:text-[#1B5E20]">
                {item.label}
              </a>
            ))}
          </div>
        )}
      </header>

      {/* ===== 히어로 섹션 ===== */}
      <section className="relative h-screen min-h-[600px] flex items-center overflow-hidden">
        {/* 배경 영상 슬라이드 */}
        <video
          ref={videoRef}
          key={heroIndex}
          className="absolute inset-0 w-full h-full object-cover"
          src={heroSlides[heroIndex]?.videoUrl ?? ""}
          autoPlay
          muted
          playsInline
          poster={heroSlides[heroIndex]?.posterUrl ?? ""}
          onEnded={handleVideoEnded}
        />
        {/* 영상 위 오버레이 — 글씨 가독성 확보 */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-black/10" />

        {/* 콘텐츠 */}
        <div className="container relative z-10">
          <div className="max-w-xl text-white">
            <p
              className="text-xs md:text-sm tracking-[0.3em] text-[#A5D6A7] mb-3 md:mb-4 font-medium"
              style={{ animation: "fadeUp 0.8s ease 0.2s both" }}
            >
              {heroSlides[heroIndex]?.yearLabel ?? "2026 JOYFUL"}
            </p>
            <h1
              className="text-2xl md:text-5xl lg:text-6xl font-bold leading-tight mb-3 md:mb-5"
              style={{ fontFamily: "'Noto Serif KR', serif", animation: "fadeUp 0.8s ease 0.4s both" }}
            >
              {(heroSlides[heroIndex]?.mainTitle ?? "처음 익은 열매로\n여호와를 공경하라").split("\n").map((line, i) => (
                <span key={i}>{line}{i === 0 && <br />}</span>
              ))}
            </h1>
            <p
              className="text-white/75 text-sm md:text-base leading-relaxed mb-6 md:mb-8"
              style={{ animation: "fadeUp 0.8s ease 0.6s both" }}
            >
              {heroSlides[heroIndex]?.subTitle ?? ""}<br />
              <span className="text-[#A5D6A7] text-xs md:text-sm">— {heroSlides[heroIndex]?.bibleRef ?? ""}</span>
            </p>
            <div style={{ animation: "fadeUp 0.8s ease 0.8s both" }} className="flex gap-2 md:gap-3 flex-wrap">
              <a href={heroSlides[heroIndex]?.btn1Href ?? "#"} className="px-5 md:px-7 py-2.5 md:py-3 bg-[#1B5E20] hover:bg-[#2E7D32] text-white text-xs md:text-sm font-medium rounded transition-colors">
                {heroSlides[heroIndex]?.btn1Text ?? "새가족 등록"}
              </a>
              <a href={heroSlides[heroIndex]?.btn2Href ?? "#"} className="px-5 md:px-7 py-2.5 md:py-3 border-2 border-white/80 hover:bg-white/15 text-white text-xs md:text-sm font-medium rounded transition-colors">
                {heroSlides[heroIndex]?.btn2Text ?? "예배 안내"}
              </a>
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
          <div className="w-px h-10 bg-gradient-to-b from-white/60 to-transparent" style={{ animation: "scrollPulse 2s ease-in-out infinite" }} />
        </div>
      </section>

      {/* ===== 퀵 메뉴 ===== */}
      <section className="bg-white shadow-md relative z-10">
        <div className="container">
          <ul className="grid grid-cols-3 md:grid-cols-9">
            {quickMenus.map((item, i) => {
              const inner = (
                <>
                  <div className="w-12 h-12 rounded-full bg-[#E8F5E9] flex items-center justify-center text-[#1B5E20] text-lg group-hover:bg-[#1B5E20] group-hover:text-white transition-colors">
                    <i className={`fas ${item.icon}`}></i>
                  </div>
                  <span className="text-xs text-gray-600 text-center leading-tight">{item.label}</span>
                </>
              );
              const cls = "flex flex-col items-center gap-2.5 py-5 px-2 border-r border-gray-100 last:border-0 hover:bg-[#F1F8E9] transition-colors group";
              return (
                <li key={i}>
                  {(item as { href?: string }).href ? (
                    <Link href={(item as { href?: string }).href!} className={cls}>{inner}</Link>
                  ) : (
                    <a href="#" className={cls}>{inner}</a>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* ===== 예배/설교 & 교회 소식 ===== */}
      <section className="py-16 bg-[#F7F7F5]">
        <div className="container">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

            {/* 조이풀 TV */}
            <FadeIn>
              <div className="bg-white rounded-xl shadow-sm p-6">
                <div className="flex justify-between items-center mb-5 pb-3 border-b-2 border-[#1B5E20]">
                  <h2 className="text-lg font-bold text-gray-900" style={{ fontFamily: "'Noto Serif KR', serif" }}>조이풀 TV</h2>
                  <a href="#" className="text-xs text-gray-400 hover:text-[#1B5E20] flex items-center gap-1 transition-colors">
                    전체보기 <i className="fas fa-arrow-right text-[10px]"></i>
                  </a>
                </div>
                {/* 유튜브 임베드 - 최신 설교 영상 */}
                <div className="relative mb-4 rounded-lg overflow-hidden bg-gray-900">
                  <div className="aspect-video">
                    <iframe
                      className="w-full h-full"
                      src="https://www.youtube.com/embed/WmFzWf5uEzI?rel=0"
                      title="조이풀TV 최신 설교 영상"
                      frameBorder="0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                  <div className="absolute top-3 left-3 bg-red-600 text-white text-xs px-2 py-1 rounded flex items-center gap-1">
                    <i className="fab fa-youtube"></i> 최신 설교
                  </div>
                </div>
                {/* 설교 목록 */}
                <div className="divide-y divide-gray-50">
                  {SERMONS.map((s, i) => (
                    <a key={i} href="#" className="flex items-center gap-3 py-3 hover:text-[#1B5E20] transition-colors group">
                      <span className="shrink-0 bg-[#E8F5E9] text-[#1B5E20] text-xs px-2 py-0.5 rounded font-medium">{s.badge}</span>
                      <span className="flex-1 text-sm text-gray-700 truncate group-hover:text-[#1B5E20]">{s.title}</span>
                      <span className="shrink-0 text-xs text-gray-400">{s.date}</span>
                    </a>
                  ))}
                </div>
              </div>
            </FadeIn>

            {/* 교회 소식 */}
            <FadeIn delay={100}>
              <div className="bg-white rounded-xl shadow-sm p-6">
                <div className="flex justify-between items-center mb-5 pb-3 border-b-2 border-[#1B5E20]">
                  <h2 className="text-lg font-bold text-gray-900" style={{ fontFamily: "'Noto Serif KR', serif" }}>교회 소식</h2>
                  <a href="#" className="text-xs text-gray-400 hover:text-[#1B5E20] flex items-center gap-1 transition-colors">
                    전체보기 <i className="fas fa-arrow-right text-[10px]"></i>
                  </a>
                </div>
                <div className="divide-y divide-gray-50">
                  {(dbNotices && dbNotices.length > 0 ? dbNotices : []).map((n, i) => (
                    <a key={i} href="#" className="flex items-center gap-3 py-3 hover:text-[#1B5E20] transition-colors group">
                      {n.thumbnailUrl && (
                        <div
                          className="w-16 h-12 rounded-md bg-cover bg-center shrink-0"
                          style={{ backgroundImage: `url(${n.thumbnailUrl})` }}
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${BADGE_COLORS[n.category] ?? "bg-gray-100 text-gray-700"} inline-block mb-1`}>{n.category}</span>
                        <p className="text-sm text-gray-700 truncate group-hover:text-[#1B5E20]">{n.title}</p>
                        <span className="text-xs text-gray-400">{new Date(n.createdAt).toLocaleDateString("ko-KR")}</span>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            </FadeIn>

          </div>
        </div>
      </section>

      {/* ===== 교회 비전 섹션 ===== */}
      <section
        className="py-20 relative overflow-hidden"
        style={{ backgroundImage: `url(${VISION_IMAGE})`, backgroundSize: "cover", backgroundPosition: "center" }}
      >
        <div className="absolute inset-0 bg-[#0F172A]/80" />
        <div className="container relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <FadeIn>
              <div className="text-white">
                <p className="text-xs tracking-[0.3em] text-[#A5D6A7] mb-3 font-medium">OUR VISION</p>
                <h2 className="text-3xl md:text-4xl font-bold leading-tight mb-5" style={{ fontFamily: "'Noto Serif KR', serif" }}>
                  깊이있는 성장,<br />위대한 교회
                </h2>
                <p className="text-white/70 leading-relaxed mb-8 text-sm md:text-base">
                  기쁨의교회는 복음의 능력으로 한 사람 한 사람을 세우고, 지역 사회와 열방을 섬기는 교회입니다. 말씀과 기도, 예배와 교제를 통해 그리스도의 몸을 이루어 가고 있습니다.
                </p>
                <a href="#" className="inline-block px-7 py-3 bg-[#1B5E20] hover:bg-[#2E7D32] text-white text-sm font-medium rounded transition-colors">
                  교회 소개 보기
                </a>
              </div>
            </FadeIn>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { icon: "fa-bible", title: "말씀 중심", desc: "하나님의 말씀을 삶의 기준으로 삼고 깊이 있게 배웁니다." },
                { icon: "fa-heart", title: "기도의 교회", desc: "새벽기도와 중보기도를 통해 하나님과 깊이 교제합니다." },
                { icon: "fa-globe-asia", title: "선교하는 교회", desc: "국내외 선교를 통해 복음을 땅끝까지 전합니다." },
              ].map((v, i) => (
                <FadeIn key={i} delay={i * 100}>
                  <div className="bg-white/10 border border-white/15 rounded-xl p-6 text-center hover:bg-white/15 transition-colors">
                    <div className="text-[#A5D6A7] text-3xl mb-3"><i className={`fas ${v.icon}`}></i></div>
                    <h3 className="text-white font-semibold mb-2 text-sm">{v.title}</h3>
                    <p className="text-white/60 text-xs leading-relaxed">{v.desc}</p>
                  </div>
                </FadeIn>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ===== 예배 사진 섹션 ===== */}
      <section className="py-16 bg-white">
        <div className="container">
          <FadeIn>
            <div className="text-center mb-10">
              <p className="text-xs tracking-[0.3em] text-[#1B5E20] mb-2 font-medium">WORSHIP</p>
              <h2 className="text-2xl md:text-3xl font-bold text-gray-900" style={{ fontFamily: "'Noto Serif KR', serif" }}>함께 드리는 예배</h2>
            </div>
          </FadeIn>
          <FadeIn delay={100}>
            <div
              className="w-full h-64 md:h-96 rounded-2xl bg-cover bg-center overflow-hidden relative"
              style={{ backgroundImage: `url(${WORSHIP_IMAGE})` }}
            >
              <div className="absolute inset-0 bg-black/30 flex items-end p-8">
                <div className="text-white">
                  <p className="text-sm text-white/80 mb-1">매주 일요일 오전 11시</p>
                  <h3 className="text-xl md:text-2xl font-bold" style={{ fontFamily: "'Noto Serif KR', serif" }}>주일 예배에 오세요</h3>
                </div>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ===== 갤러리 ===== */}
      <section className="py-16 bg-white">
        <div className="container">
          <FadeIn>
            <div className="flex items-end justify-between mb-10">
              <div>
                <p className="text-xs tracking-[0.25em] text-[#1B5E20] font-semibold mb-2 uppercase">Photo Gallery</p>
                <h2 className="text-2xl md:text-3xl font-bold text-gray-900" style={{ fontFamily: "'Noto Serif KR', serif" }}>교회 갤러리</h2>
              </div>
              <a href="#" className="text-sm text-gray-400 hover:text-[#1B5E20] flex items-center gap-1 transition-colors">
                전체보기 <i className="fas fa-arrow-right text-[10px]"></i>
              </a>
            </div>
          </FadeIn>

          {/* 매거진 그리드 */}
          <div className="grid grid-cols-2 md:grid-cols-4 auto-rows-[180px] md:auto-rows-[220px] gap-3">
            {gallery.map((item, i) => (
              <FadeIn key={i} delay={i * 60} className={item.gridSpan ?? "col-span-1 row-span-1"}>
                <div className="group relative w-full h-full overflow-hidden rounded-xl cursor-pointer">
                  <img
                    src={item.imageUrl}
                    alt={item.caption ?? ""}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  {/* 호버 오버레이 */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/35 transition-all duration-300 flex items-end p-4">
                    <span className="text-white text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-300 translate-y-2 group-hover:translate-y-0">
                      {item.caption}
                    </span>
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ===== 관련 기관 ===== */}
      <section className="py-14 bg-[#F7F7F5]">
        <div className="container">
          <FadeIn>
            <h2 className="text-center text-2xl font-bold text-gray-900 mb-10" style={{ fontFamily: "'Noto Serif KR', serif" }}>관련 기관</h2>
          </FadeIn>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {affiliates.map((a, i) => (
              <FadeIn key={i} delay={i * 80}>
                <a
                  href={a.href ?? "#"}
                  target={a.href && a.href !== "#" ? "_blank" : undefined}
                  rel={a.href && a.href !== "#" ? "noopener noreferrer" : undefined}
                  className="flex flex-col items-center gap-3 py-8 px-4 bg-white border border-gray-100 rounded-xl text-center hover:border-[#1B5E20] hover:text-[#1B5E20] hover:-translate-y-1 transition-all duration-200 shadow-sm"
                >
                  <div className="text-[#1B5E20] text-3xl"><i className={`fas ${a.icon}`}></i></div>
                  <span className="text-sm text-gray-600 font-medium">{a.label}</span>
                </a>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ===== 푸터 ===== */}
      <footer className="bg-[#0F172A] text-gray-400 py-12">
        <div className="container">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
            {/* 로고 */}
            <div>
              <img
                src="https://d2xsxph8kpxj0f.cloudfront.net/310519663470178900/KASTcRBzh5rwhJEekrJN6E/church-logo_35c62cc5.jpg"
                alt="기쁨의교회"
                className="h-10 w-auto object-contain mb-2 brightness-0 invert"
              />
              <p className="text-xs text-gray-600">since 1946 대한예수교장로회</p>
            </div>
            {/* 연락처 */}
            <div className="space-y-2 text-sm">
              <p className="flex items-center gap-2">
                <i className="fas fa-map-marker-alt text-[#4CAF50] w-4"></i>
                {dbSettings?.address ?? "경북 포항시 북구 상통로 411"}
              </p>
              <p className="flex items-center gap-2">
                <i className="fas fa-phone text-[#4CAF50] w-4"></i>
                TEL : {dbSettings?.tel ?? "054) 270-1000"} &nbsp;|&nbsp; FAX : {dbSettings?.fax ?? "054) 270-1005"}
              </p>
              <p className="text-xs text-gray-600 mt-3">
                Copyright &copy; {new Date().getFullYear()} 기쁨의교회 All rights reserved.
              </p>
            </div>
            {/* SNS */}
            <div className="flex gap-3 md:justify-end">
              {[
                { icon: "fab fa-youtube", href: "#" },
                { icon: "fab fa-facebook-f", href: "#" },
                { icon: "fab fa-instagram", href: "#" },
              ].map((s, i) => (
                <a
                  key={i}
                  href={s.href}
                  className="w-9 h-9 rounded-full border border-gray-700 flex items-center justify-center text-gray-400 hover:bg-[#1B5E20] hover:border-[#1B5E20] hover:text-white transition-colors text-sm"
                >
                  <i className={s.icon}></i>
                </a>
              ))}
            </div>
          </div>
        </div>
      </footer>

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
