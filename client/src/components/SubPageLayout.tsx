/**
 * SubPageLayout — 하위 페이지 공통 레이아웃
 * 홈과 동일한 헤더(로고+GNB+검색창) + 브레드크럼 + 좌측 사이드 메뉴 + 푸터
 * 모든 동적 페이지(/page/item/:id, /page/sub/:id)에서 사용
 */
import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { ChevronRight, Home } from "lucide-react";

const LOGO_URL = "https://d2xsxph8kpxj0f.cloudfront.net/310519663470178900/KASTcRBzh5rwhJEekrJN6E/church-logo_35c62cc5.jpg";

interface SubPageLayoutProps {
  /** 현재 페이지 제목 (브레드크럼 마지막 항목) */
  pageTitle: string;
  /** 상위 메뉴 이름 (브레드크럼 중간 항목) */
  parentLabel?: string;
  /** 상위 메뉴 href */
  parentHref?: string;
  /** 사이드 메뉴에 표시할 같은 카테고리 항목들 */
  sideMenuItems?: { id: number; label: string; href: string | null; isActive?: boolean }[];
  /** 페이지 본문 */
  children: React.ReactNode;
}

export default function SubPageLayout({
  pageTitle,
  parentLabel,
  parentHref,
  sideMenuItems = [],
  children,
}: SubPageLayoutProps) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchName, setSearchName] = useState("");
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [, setLocation] = useLocation();

  const { data: dbMenus } = trpc.home.menus.useQuery();
  const { data: dbSettings } = trpc.home.settings.useQuery();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const handleSearch = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = searchName.trim();
    if (!trimmed) return;
    setMobileSearchOpen(false);
    setLocation(`/church-directory?name=${encodeURIComponent(trimmed)}`);
  };

  return (
    <div className="min-h-screen bg-[#FAFAF8] flex flex-col" style={{ fontFamily: "'Noto Sans KR', sans-serif" }}>

      {/* ===== 상단 유틸 바 ===== */}
      <div className="bg-[#0F172A] text-gray-400 text-xs py-2 hidden md:block">
        <div className="container flex justify-between items-center">
          <span className="tracking-wide">깊이있는 성장, 위대한 교회</span>
          <div className="flex gap-4 items-center">
            {isAdmin ? (
              <Link href="/admin" className="hover:text-white transition-colors text-[#A5D6A7] font-medium">관리자 페이지</Link>
            ) : (
              <a href="/admin" className="hover:text-white transition-colors">관리자 로그인</a>
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
      <header className={`sticky top-0 z-[150] bg-white transition-shadow duration-300 ${scrolled ? "shadow-lg" : "shadow-sm"}`}>
        <div className="container flex items-center justify-between h-16 md:h-[72px]">
          {/* 로고 — 클릭 시 홈으로 */}
          <Link href="/" className="flex items-center shrink-0">
            <img
              src={LOGO_URL}
              alt="기쁨의교회"
              className="h-10 md:h-12 w-auto object-contain"
            />
          </Link>

          {/* 검색창 — PC */}
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
              {(dbMenus ?? []).map((item) => (
                <li key={item.id} className="relative group">
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
                    <ul className="absolute top-[72px] left-0 bg-white border-t-2 border-[#1B5E20] shadow-xl min-w-[160px] z-[200] py-1 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150">
                      {(item.items ?? []).map((s, j) => {
                        const hasSubItems = (s as { subItems?: { id: number; label: string; href?: string | null }[] }).subItems && (s as { subItems?: { id: number; label: string; href?: string | null }[] }).subItems!.length > 0;
                        const subItems = (s as { subItems?: { id: number; label: string; href?: string | null }[] }).subItems ?? [];
                        const cls = "flex items-center justify-between px-5 py-2.5 text-sm text-gray-600 hover:bg-[#F1F8E9] hover:text-[#1B5E20] transition-colors border-b border-gray-50 last:border-0 whitespace-nowrap";
                        return (
                          <li key={j} className="relative group/sub">
                            {s.href ? (
                              <Link href={s.href} className={cls}>
                                <span>{s.label}</span>
                                {hasSubItems && <i className="fas fa-chevron-right text-[10px] text-gray-400 ml-2"></i>}
                              </Link>
                            ) : (
                              <a href="#" className={cls}>
                                <span>{s.label}</span>
                                {hasSubItems && <i className="fas fa-chevron-right text-[10px] text-gray-400 ml-2"></i>}
                              </a>
                            )}
                            {hasSubItems && (
                              <ul className="absolute left-full top-0 bg-white border-l-2 border-[#1B5E20] shadow-xl min-w-[150px] z-[300] py-1 opacity-0 invisible group-hover/sub:opacity-100 group-hover/sub:visible transition-all duration-150">
                                {subItems.map((sub, k) => {
                                  const subCls = "block px-5 py-2.5 text-sm text-gray-600 hover:bg-[#F1F8E9] hover:text-[#1B5E20] transition-colors border-b border-gray-50 last:border-0 whitespace-nowrap";
                                  return (
                                    <li key={k}>
                                      {sub.href ? (
                                        <Link href={sub.href} className={subCls}>{sub.label}</Link>
                                      ) : (
                                        <a href="#" className={subCls}>{sub.label}</a>
                                      )}
                                    </li>
                                  );
                                })}
                              </ul>
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

          {/* 모바일 버튼 */}
          <div className="md:hidden flex items-center gap-1">
            <button
              className="p-2 text-[#1B5E20]"
              onClick={() => { setMobileSearchOpen(!mobileSearchOpen); setMobileOpen(false); }}
            >
              <i className={`fas ${mobileSearchOpen ? "fa-times" : "fa-search"} text-lg`}></i>
            </button>
            <button
              className="p-2 text-gray-700"
              onClick={() => { setMobileOpen(!mobileOpen); setMobileSearchOpen(false); }}
            >
              <i className={`fas ${mobileOpen ? "fa-times" : "fa-bars"} text-xl`}></i>
            </button>
          </div>
        </div>

        {/* 모바일 검색창 */}
        {mobileSearchOpen && (
          <div className="md:hidden px-4 py-3 border-t border-gray-100 bg-white">
            <form onSubmit={handleSearch} className="flex gap-2">
              <input
                type="text"
                value={searchName}
                onChange={(e) => setSearchName(e.target.value)}
                placeholder="이름으로 신앙 데이터 검색"
                className="flex-1 h-9 px-4 text-sm rounded-full border-2 border-[#1B5E20]/30 bg-[#F1F8E9] focus:outline-none focus:border-[#1B5E20]"
                autoFocus
              />
              <button type="submit" className="px-4 py-1 bg-[#1B5E20] text-white text-sm rounded-full">검색</button>
            </form>
          </div>
        )}

        {/* 모바일 메뉴 */}
        {mobileOpen && (
          <div className="md:hidden bg-white border-t border-gray-100 shadow-lg max-h-[70vh] overflow-y-auto">
            {(dbMenus ?? []).map((item) => (
              <div key={item.id}>
                <a href={item.href ?? '#'} className="block px-5 py-3 text-sm font-medium text-gray-800 border-b border-gray-50 bg-gray-50">
                  {item.label}
                </a>
                {(item.items ?? []).map((s, j) => (
                  <div key={j}>
                    {s.href ? (
                      <Link href={s.href} className="block px-8 py-2.5 text-sm text-gray-600 border-b border-gray-50 hover:bg-[#F1F8E9] hover:text-[#1B5E20]">
                        {s.label}
                      </Link>
                    ) : (
                      <a href="#" className="block px-8 py-2.5 text-sm text-gray-600 border-b border-gray-50">
                        {s.label}
                      </a>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </header>

      {/* ===== 브레드크럼 ===== */}
      <div className="bg-white border-b border-gray-100">
        <div className="container py-3">
          <nav className="flex items-center gap-1.5 text-sm text-gray-500">
            <Link href="/" className="flex items-center gap-1 hover:text-[#1B5E20] transition-colors">
              <Home className="w-3.5 h-3.5" />
              <span>홈</span>
            </Link>
            {parentLabel && (
              <>
                <ChevronRight className="w-3.5 h-3.5 text-gray-300" />
                {parentHref ? (
                  <Link href={parentHref} className="hover:text-[#1B5E20] transition-colors">{parentLabel}</Link>
                ) : (
                  <span>{parentLabel}</span>
                )}
              </>
            )}
            <ChevronRight className="w-3.5 h-3.5 text-gray-300" />
            <span className="text-[#1B5E20] font-medium">{pageTitle}</span>
          </nav>
        </div>
      </div>

      {/* ===== 본문 영역 ===== */}
      <div className="flex-1">
        <div className="container py-8 md:py-12">
          <div className="flex gap-8">

            {/* 좌측 사이드 메뉴 (같은 카테고리 항목들) */}
            {sideMenuItems.length > 0 && (
              <aside className="hidden md:block w-52 shrink-0">
                {parentLabel && (
                  <div className="bg-[#1B5E20] text-white text-sm font-bold px-4 py-3 rounded-t-lg">
                    {parentLabel}
                  </div>
                )}
                <ul className="border border-gray-200 rounded-b-lg overflow-hidden">
                  {sideMenuItems.map((item, i) => (
                    <li key={item.id}>
                      {item.href ? (
                        <Link
                          href={item.href}
                          className={`block px-4 py-3 text-sm border-b border-gray-100 last:border-0 transition-colors ${
                            item.isActive
                              ? "bg-[#F1F8E9] text-[#1B5E20] font-semibold border-l-4 border-l-[#1B5E20]"
                              : "text-gray-600 hover:bg-[#F1F8E9] hover:text-[#1B5E20]"
                          }`}
                        >
                          {item.label}
                        </Link>
                      ) : (
                        <span className="block px-4 py-3 text-sm text-gray-400 border-b border-gray-100 last:border-0">
                          {item.label}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </aside>
            )}

            {/* 메인 콘텐츠 */}
            <main className="flex-1 min-w-0">
              {/* 페이지 제목 */}
              <h1
                className="text-2xl md:text-3xl font-bold text-gray-900 mb-6 pb-4 border-b-2 border-[#1B5E20]"
                style={{ fontFamily: "'Noto Serif KR', serif" }}
              >
                {pageTitle}
              </h1>
              {children}
            </main>

          </div>
        </div>
      </div>

      {/* ===== 푸터 ===== */}
      <footer className="bg-[#0F172A] text-gray-400 py-12 mt-auto">
        <div className="container">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
            <div>
              <img
                src={LOGO_URL}
                alt="기쁨의교회"
                className="h-10 w-auto object-contain mb-2 brightness-0 invert"
              />
              <p className="text-xs text-gray-600">since 1946 대한예수교장로회</p>
            </div>
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

    </div>
  );
}
