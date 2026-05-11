/**
 * SubPageLayout — 하위 페이지 공통 레이아웃
 * SiteHeader(공통 헤더) + 브레드크럼 + 좌측 사이드 메뉴 + 푸터
 * 모든 동적 페이지(/page/item/:id, /page/sub/:id)에서 사용
 *
 * ⚠️ 헤더는 SiteHeader 컴포넌트를 재사용합니다.
 *    App.tsx에서 이미 <SiteHeader />를 렌더링하므로 여기서는 중복 렌더링하지 않습니다.
 */
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
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
  const { data: dbSettings } = trpc.home.settings.useQuery();
  const socialLinks = [
    { icon: "fab fa-youtube", label: "유튜브", href: dbSettings?.youtube_url || "/worship/tv" },
    { icon: "fab fa-facebook-f", label: "페이스북", href: dbSettings?.facebook_url || null },
    { icon: "fab fa-instagram", label: "인스타그램", href: dbSettings?.instagram_url || null },
  ];

  return (
    <div className="min-h-screen bg-[#FAFAF8] flex flex-col" style={{ fontFamily: "'Noto Sans KR', sans-serif" }}>

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
                  {sideMenuItems.map((item) => (
                    <li key={item.id}>
                      {item.href ? (
                        <Link
                          href={item.href}
                          className={`block px-4 py-3 text-sm border-b border-gray-100 last:border-0 transition-colors ${
                            item.isActive
                              ? "bg-[#F1F8E9] text-[#1B5E20] font-semibold"
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
              {socialLinks.map((s, i) => (
                s.href ? (
                  <a
                    key={i}
                    href={s.href}
                    target={s.href.startsWith("http") ? "_blank" : undefined}
                    rel={s.href.startsWith("http") ? "noopener noreferrer" : undefined}
                    aria-label={s.label}
                    className="w-9 h-9 rounded-full border border-gray-700 flex items-center justify-center text-gray-400 hover:bg-[#1B5E20] hover:border-[#1B5E20] hover:text-white transition-colors text-sm"
                  >
                    <i className={s.icon}></i>
                  </a>
                ) : (
                  <span
                    key={i}
                    aria-label={`${s.label} 링크 미등록`}
                    className="w-9 h-9 rounded-full border border-gray-700 flex items-center justify-center text-gray-500 transition-colors text-sm"
                  >
                    <i className={s.icon}></i>
                  </span>
                )
              ))}
            </div>
          </div>
        </div>
      </footer>

    </div>
  );
}
