/**
 * 기쁨의교회 홈페이지 메인 페이지
 * 디자인: Warm Modern Sacred — 따뜻한 녹색 포인트, Noto Serif KR 헤딩, 넓은 여백
 * 구성: TopBar → Header(GNB) → Hero → QuickMenu → Content(TV+News) → Vision → Affiliates → Footer
 */

import { useState, useEffect, useRef } from "react";

const HERO_IMAGE = "https://d2xsxph8kpxj0f.cloudfront.net/310519663470178900/KASTcRBzh5rwhJEekrJN6E/hero-church-XWJBwHDycyRoBg9dY4aj5r.webp";
const HERO_VIDEO = "https://d2xsxph8kpxj0f.cloudfront.net/310519663470178900/KASTcRBzh5rwhJEekrJN6E/hero-video_024001ab.mp4";
const WORSHIP_IMAGE = "https://d2xsxph8kpxj0f.cloudfront.net/310519663470178900/KASTcRBzh5rwhJEekrJN6E/hero-worship-T2iXn7ztKCKRDJ4xwAbyC9.webp";
const VISION_IMAGE = "https://d2xsxph8kpxj0f.cloudfront.net/310519663470178900/KASTcRBzh5rwhJEekrJN6E/vision-bg-XcGUzFoKsWgmCYbAZZCnsA.webp";

const NAV_ITEMS = [
  { label: "교회소개", sub: ["담임목사 인사말", "교회 역사", "교회 비전", "오시는 길"] },
  { label: "조이풀TV", sub: ["실시간 예배", "설교 영상", "찬양 영상"] },
  { label: "양육/훈련", sub: ["새가족 교육", "제자훈련", "성경공부"] },
  { label: "사역/선교", sub: ["국내 선교", "해외 선교", "봉사 활동"] },
  { label: "교회학교", sub: ["유아부", "유치부", "초등부", "중고등부"] },
  { label: "커뮤니티", sub: ["교회 소식", "기도 요청", "나눔 게시판"] },
  { label: "행정지원", sub: ["주보 보기", "헌금 안내", "차량 운행"] },
];

const QUICK_MENUS = [
  { icon: "fa-user-tie", label: "담임목사 인사" },
  { icon: "fa-hands-praying", label: "손보고서" },
  { icon: "fa-newspaper", label: "주보 보기" },
  { icon: "fa-clock", label: "예배시간 안내" },
  { icon: "fa-store", label: "조이플스토어" },
  { icon: "fa-user-plus", label: "새가족 안내" },
  { icon: "fa-bus", label: "차량운행 안내" },
  { icon: "fa-map-marker-alt", label: "오시는 길" },
];

const SERMONS = [
  { badge: "주일예배", title: "처음 익은 열매로 여호와를 공경하라", date: "2026.03.29" },
  { badge: "수요예배", title: "믿음으로 나아가는 삶", date: "2026.03.26" },
  { badge: "새벽기도", title: "하나님의 은혜가 넘치는 곳", date: "2026.03.25" },
];

const NEWS = [
  { badge: "공지", badgeColor: "bg-blue-100 text-blue-700", title: "3월 18일 장학금 수여식 안내", date: "2026.03.18", img: "https://images.unsplash.com/photo-1504052434569-70ad5836ab65?w=120&q=70" },
  { badge: "행사", badgeColor: "bg-amber-100 text-amber-700", title: "2026년 3월 12일~16일 히브리서 특별 강좌", date: "2026.03.12", img: "https://images.unsplash.com/photo-1529070538774-1843cb3265df?w=120&q=70" },
  { badge: "행사", badgeColor: "bg-amber-100 text-amber-700", title: "2026년 3월 4일~6일 전교인 수련회", date: "2026.03.04", img: "https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=120&q=70" },
  { badge: "행사", badgeColor: "bg-amber-100 text-amber-700", title: "2026 리더십 성장 컨퍼런스", date: "2026.02.20", img: "https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=120&q=70" },
  { badge: "찬양", badgeColor: "bg-green-100 text-green-700", title: "제5회 24시간 찬양기도회", date: "2026.01.24", img: "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=120&q=70" },
];

const AFFILIATES = [
  { icon: "fa-hands-helping", label: "기름의복지재단" },
  { icon: "fa-building", label: "창포종합사회복지관" },
  { icon: "fa-tree", label: "조이플빌리지" },
  { icon: "fa-graduation-cap", label: "조이아카데미 문화강좌" },
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

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="min-h-screen bg-[#FAFAF8]" style={{ fontFamily: "'Noto Sans KR', sans-serif" }}>

      {/* ===== 상단 유틸 바 ===== */}
      <div className="bg-[#0F172A] text-gray-400 text-xs py-2 hidden md:block">
        <div className="container flex justify-between items-center">
          <span className="tracking-wide">깊이있는 성장, 위대한 교회</span>
          <div className="flex gap-4 items-center">
            <a href="#" className="hover:text-white transition-colors">로그인</a>
            <a href="#" className="hover:text-white transition-colors">회원가입</a>
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
        className={`sticky top-0 z-50 bg-white transition-shadow duration-300 ${scrolled ? "shadow-lg" : "shadow-sm"}`}
      >
        <div className="container flex items-center justify-between h-16 md:h-[72px]">
          {/* 로고 */}
          <a href="#" className="flex flex-col leading-tight">
            <span className="text-xl md:text-2xl font-bold text-[#1B5E20] tracking-tight" style={{ fontFamily: "'Noto Serif KR', serif" }}>기쁨의교회</span>
            <span className="text-[10px] text-gray-400 tracking-widest uppercase">The Joyful Church</span>
          </a>

          {/* PC 메뉴 */}
          <nav className="hidden md:block">
            <ul className="flex">
              {NAV_ITEMS.map((item, i) => (
                <li
                  key={i}
                  className="relative group"
                  onMouseEnter={() => setActiveNav(i)}
                  onMouseLeave={() => setActiveNav(null)}
                >
                  <a
                    href="#"
                    className="flex items-center h-[72px] px-4 text-sm font-medium text-gray-700 hover:text-[#1B5E20] transition-colors relative"
                  >
                    {item.label}
                    <span className="absolute bottom-0 left-0 right-0 h-[3px] bg-[#1B5E20] scale-x-0 group-hover:scale-x-100 transition-transform duration-200 origin-left"></span>
                  </a>
                  {activeNav === i && (
                    <ul className="absolute top-[72px] left-0 bg-white border-t-2 border-[#1B5E20] shadow-xl min-w-[150px] z-50 py-1">
                      {item.sub.map((s, j) => (
                        <li key={j}>
                          <a href="#" className="block px-5 py-2.5 text-sm text-gray-600 hover:bg-[#F1F8E9] hover:text-[#1B5E20] transition-colors border-b border-gray-50 last:border-0">
                            {s}
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          </nav>

          {/* 모바일 햄버거 */}
          <button
            className="md:hidden p-2 text-gray-700"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            <i className={`fas ${mobileOpen ? "fa-times" : "fa-bars"} text-xl`}></i>
          </button>
        </div>

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
        {/* 배경 영상 */}
        <video
          className="absolute inset-0 w-full h-full object-cover"
          src={HERO_VIDEO}
          autoPlay
          muted
          loop
          playsInline
          poster={HERO_IMAGE}
        />
        {/* 영상 위 오버레이 — 글씨 가독성 확보 */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-black/10" />

        {/* 콘텐츠 */}
        <div className="container relative z-10">
          <div className="max-w-xl text-white">
            <p
              className="text-sm tracking-[0.3em] text-[#A5D6A7] mb-4 font-medium"
              style={{ animation: "fadeUp 0.8s ease 0.2s both" }}
            >
              2026 JOYFUL
            </p>
            <h1
              className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight mb-5"
              style={{ fontFamily: "'Noto Serif KR', serif", animation: "fadeUp 0.8s ease 0.4s both" }}
            >
              처음 익은 열매로<br />여호와를 공경하라
            </h1>
            <p
              className="text-white/75 text-base leading-relaxed mb-8"
              style={{ animation: "fadeUp 0.8s ease 0.6s both" }}
            >
              네 재물과 네 소산물의 처음 익은 열매로 여호와를 공경하라<br />
              <span className="text-[#A5D6A7] text-sm">— 잠언 3장 9절</span>
            </p>
            <div style={{ animation: "fadeUp 0.8s ease 0.8s both" }} className="flex gap-3 flex-wrap">
              <a href="#" className="px-7 py-3 bg-[#1B5E20] hover:bg-[#2E7D32] text-white text-sm font-medium rounded transition-colors">
                새가족 등록
              </a>
              <a href="#" className="px-7 py-3 border-2 border-white/80 hover:bg-white/15 text-white text-sm font-medium rounded transition-colors">
                예배 안내
              </a>
            </div>
          </div>
        </div>

        {/* 스크롤 인디케이터 */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-1">
          <span className="text-white/50 text-xs tracking-widest">SCROLL</span>
          <div className="w-px h-10 bg-gradient-to-b from-white/60 to-transparent" style={{ animation: "scrollPulse 2s ease-in-out infinite" }} />
        </div>
      </section>

      {/* ===== 퀵 메뉴 ===== */}
      <section className="bg-white shadow-md relative z-10">
        <div className="container">
          <ul className="grid grid-cols-4 md:grid-cols-8">
            {QUICK_MENUS.map((item, i) => (
              <li key={i}>
                <a
                  href="#"
                  className="flex flex-col items-center gap-2.5 py-5 px-2 border-r border-gray-100 last:border-0 hover:bg-[#F1F8E9] transition-colors group"
                >
                  <div className="w-12 h-12 rounded-full bg-[#E8F5E9] flex items-center justify-center text-[#1B5E20] text-lg group-hover:bg-[#1B5E20] group-hover:text-white transition-colors">
                    <i className={`fas ${item.icon}`}></i>
                  </div>
                  <span className="text-xs text-gray-600 text-center leading-tight">{item.label}</span>
                </a>
              </li>
            ))}
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
                {/* 유튜브 임베드 */}
                <div className="relative mb-4 rounded-lg overflow-hidden bg-gray-900">
                  <div className="aspect-video flex items-center justify-center bg-gray-800">
                    <div className="text-center text-white/60">
                      <i className="fab fa-youtube text-5xl text-red-500 mb-3 block"></i>
                      <p className="text-sm">실시간 예배 영상</p>
                      <p className="text-xs mt-1 text-white/40">유튜브 채널 ID 연결 후 활성화됩니다</p>
                    </div>
                  </div>
                  <div className="absolute top-3 left-3 bg-red-600 text-white text-xs px-2 py-1 rounded flex items-center gap-1">
                    <i className="fab fa-youtube"></i> 실시간 예배
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
                  {NEWS.map((n, i) => (
                    <a key={i} href="#" className="flex items-center gap-3 py-3 hover:text-[#1B5E20] transition-colors group">
                      <div
                        className="w-16 h-12 rounded-md bg-cover bg-center shrink-0"
                        style={{ backgroundImage: `url(${n.img})` }}
                      />
                      <div className="flex-1 min-w-0">
                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${n.badgeColor} inline-block mb-1`}>{n.badge}</span>
                        <p className="text-sm text-gray-700 truncate group-hover:text-[#1B5E20]">{n.title}</p>
                        <span className="text-xs text-gray-400">{n.date}</span>
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

      {/* ===== 관련 기관 ===== */}
      <section className="py-14 bg-[#F7F7F5]">
        <div className="container">
          <FadeIn>
            <h2 className="text-center text-2xl font-bold text-gray-900 mb-10" style={{ fontFamily: "'Noto Serif KR', serif" }}>관련 기관</h2>
          </FadeIn>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {AFFILIATES.map((a, i) => (
              <FadeIn key={i} delay={i * 80}>
                <a
                  href="#"
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
              <div className="text-white text-xl font-bold mb-1" style={{ fontFamily: "'Noto Serif KR', serif" }}>기쁨의교회</div>
              <div className="text-gray-500 text-xs tracking-widest mb-2">THE JOYFUL CHURCH</div>
              <p className="text-xs text-gray-600">since 1946 대한예수교장로회</p>
            </div>
            {/* 연락처 */}
            <div className="space-y-2 text-sm">
              <p className="flex items-center gap-2">
                <i className="fas fa-map-marker-alt text-[#4CAF50] w-4"></i>
                경북 포항시 북구 상통로 411
              </p>
              <p className="flex items-center gap-2">
                <i className="fas fa-phone text-[#4CAF50] w-4"></i>
                TEL : 054) 270-1000 &nbsp;|&nbsp; FAX : 054) 270-1005
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
