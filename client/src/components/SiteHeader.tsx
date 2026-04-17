/**
 * 공통 사이트 헤더 컴포넌트
 * - 모든 페이지에서 sticky top-0으로 고정 표시
 * - 상단 유틸 바 (로그인/회원가입/SNS) + GNB 네비게이션
 * - DB에서 메뉴 데이터 불러오기 (없으면 기본 메뉴 사용)
 */

import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";

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

export default function SiteHeader() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [searchName, setSearchName] = useState("");
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [mobileExpandedId, setMobileExpandedId] = useState<number | null>(null);
  const [mobileExpandedSubId, setMobileExpandedSubId] = useState<number | null>(null);
  const [, setLocation] = useLocation();

  const { data: memberMe, refetch: refetchMemberMe } = trpc.members.me.useQuery();
  const memberLogoutMutation = trpc.members.logout.useMutation({
    onSuccess: () => { refetchMemberMe(); },
  });
  const { data: dbMenus } = trpc.home.menus.useQuery();
  const navMenus = (dbMenus && dbMenus.length > 0) ? dbMenus : null;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // 페이지 이동 시 모바일 메뉴 닫기
  const [location] = useLocation();
  useEffect(() => {
    setMobileOpen(false);
    setMobileSearchOpen(false);
  }, [location]);

  const handleSearch = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = searchName.trim();
    if (!trimmed) return;
    setMobileSearchOpen(false);
    setLocation(`/church-directory?name=${encodeURIComponent(trimmed)}`);
  };

  return (
    <>
      {/* ===== 상단 유틸 바 ===== */}
      <div className="bg-[#0F172A] text-gray-400 text-xs py-2 hidden md:block">
        <div className="container flex justify-between items-center">
          <span className="tracking-wide">깊이있는 성장, 위대한 교회</span>
          <div className="flex gap-4 items-center">
            {memberMe ? (
              <>
                <span className="text-gray-300">{memberMe.name}님</span>
                <Link href="/member/my-page" className="hover:text-white transition-colors">내 정보</Link>
                <button
                  onClick={() => memberLogoutMutation.mutate()}
                  className="hover:text-white transition-colors cursor-pointer"
                >로그아웃</button>
              </>
            ) : (
              <>
                <Link href="/member/login" className="hover:text-white transition-colors">로그인</Link>
                <Link href="/member/register" className="hover:text-white transition-colors">회원가입</Link>
              </>
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
          <Link href="/" className="flex items-center">
            <img
              src="https://d2xsxph8kpxj0f.cloudfront.net/310519663470178900/KASTcRBzh5rwhJEekrJN6E/church-logo_35c62cc5.jpg"
              alt="기쁨의교회"
              className="h-10 md:h-12 w-auto object-contain"
            />
          </Link>

          {/* 신앙 데이터 검색창 — PC */}
          <form
            onSubmit={handleSearch}
            className="hidden md:flex items-center gap-0 mx-4 flex-1 max-w-[320px]"
          >
            <div className="relative flex-1">
              <input
                type="text"
                value={searchName}
                onChange={(e) => setSearchName(e.target.value)}
                placeholder="이름으로 신앙 데이터 검색"
                className="w-full h-10 pl-4 pr-10 text-sm rounded-full border border-gray-200 bg-[#F7F7F5] text-gray-700 placeholder-gray-400 focus:outline-none focus:border-[#1B5E20] focus:ring-1 focus:ring-[#1B5E20] transition-all duration-200"
              />
              <button
                type="submit"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#1B5E20] transition-colors"
              >
                <i className="fas fa-search text-sm"></i>
              </button>
            </div>
          </form>

          {/* PC 메뉴 */}
          <nav className="hidden md:block">
            <ul className="flex">
              {(navMenus ?? NAV_ITEMS.map((item, i) => ({
                id: i + 1,
                label: item.label,
                href: (item as { href?: string }).href ?? null,
                items: item.sub.map((s, j) => ({
                  id: j + 1,
                  label: s,
                  href: (item as { subHref?: Record<string, string | undefined> }).subHref?.[s] ?? null
                }))
              }))).map((item) => (
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
                              s.href.startsWith('http://') || s.href.startsWith('https://') ? (
                                <a href={s.href} target="_blank" rel="noopener noreferrer" className={cls}>
                                  <span>{s.label}</span>
                                  {hasSubItems && <i className="fas fa-chevron-right text-[10px] text-gray-400 ml-2"></i>}
                                </a>
                              ) : (
                                <Link href={s.href} className={cls}>
                                  <span>{s.label}</span>
                                  {hasSubItems && <i className="fas fa-chevron-right text-[10px] text-gray-400 ml-2"></i>}
                                </Link>
                              )
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
                                        sub.href.startsWith('http://') || sub.href.startsWith('https://') ? (
                                          <a href={sub.href} target="_blank" rel="noopener noreferrer" className={subCls}>{sub.label}</a>
                                        ) : (
                                          <Link href={sub.href} className={subCls}>{sub.label}</Link>
                                        )
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

          {/* 모바일 오른쪽 버튼 그룹 */}
          <div className="md:hidden flex items-center gap-1">
            <button
              className="p-2 text-[#1B5E20]"
              onClick={() => { setMobileSearchOpen(!mobileSearchOpen); setMobileOpen(false); }}
              aria-label="신앙 데이터 검색"
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
          <div className="md:hidden bg-white border-t border-gray-100 shadow-lg max-h-[70vh] overflow-y-auto">
            {(navMenus ?? NAV_ITEMS.map((item, i) => ({
              id: i + 1,
              label: item.label,
              href: null,
              items: item.sub.map((s, j) => ({
                id: j + 1,
                label: s,
                href: (item as { subHref?: Record<string, string | undefined> }).subHref?.[s] ?? null,
                subItems: [],
              }))
            }))).map((menu) => (
              <div key={menu.id} className="border-b border-gray-100">
                {/* 1단 메뉴 */}
                <button
                  className="w-full flex items-center justify-between px-5 py-3 text-sm font-medium text-gray-700 hover:bg-[#F1F8E9] hover:text-[#1B5E20] text-left"
                  onClick={() => {
                    setMobileExpandedId(mobileExpandedId === menu.id ? null : menu.id);
                    setMobileExpandedSubId(null);
                  }}
                >
                  <span>{menu.label}</span>
                  {(menu.items ?? []).length > 0 && (
                    <i className={`fas fa-chevron-${mobileExpandedId === menu.id ? 'up' : 'down'} text-[10px] text-gray-400`}></i>
                  )}
                </button>
                {/* 2단 메뉴 */}
                {mobileExpandedId === menu.id && (menu.items ?? []).length > 0 && (
                  <div className="bg-gray-50">
                    {(menu.items ?? []).map((item) => {
                      const hasSubItems = (item as { subItems?: unknown[] }).subItems && (item as { subItems?: unknown[] }).subItems!.length > 0;
                      const subItems = (item as { subItems?: { id: number; label: string; href?: string | null }[] }).subItems ?? [];
                      return (
                        <div key={item.id}>
                          {hasSubItems ? (
                            // 3단 있으면 아코디언
                            <button
                              className="w-full flex items-center justify-between pl-8 pr-5 py-2.5 text-sm text-gray-600 hover:text-[#1B5E20] text-left"
                              onClick={() => setMobileExpandedSubId(mobileExpandedSubId === item.id ? null : item.id)}
                            >
                              <span>{item.label}</span>
                              <i className={`fas fa-chevron-${mobileExpandedSubId === item.id ? 'up' : 'down'} text-[10px] text-gray-400`}></i>
                            </button>
                          ) : item.href ? (
                            item.href.startsWith('http://') || item.href.startsWith('https://') ? (
                              <a href={item.href} target="_blank" rel="noopener noreferrer"
                                className="block pl-8 pr-5 py-2.5 text-sm text-gray-600 hover:text-[#1B5E20] hover:bg-[#F1F8E9]"
                                onClick={() => setMobileOpen(false)}
                              >{item.label}</a>
                            ) : (
                              <Link href={item.href}
                                className="block pl-8 pr-5 py-2.5 text-sm text-gray-600 hover:text-[#1B5E20] hover:bg-[#F1F8E9]"
                                onClick={() => setMobileOpen(false)}
                              >{item.label}</Link>
                            )
                          ) : (
                            <span className="block pl-8 pr-5 py-2.5 text-sm text-gray-400">{item.label}</span>
                          )}
                          {/* 3단 메뉴 */}
                          {hasSubItems && mobileExpandedSubId === item.id && (
                            <div className="bg-white">
                              {subItems.map((sub) => (
                                sub.href ? (
                                  sub.href.startsWith('http://') || sub.href.startsWith('https://') ? (
                                    <a key={sub.id} href={sub.href} target="_blank" rel="noopener noreferrer"
                                      className="block pl-12 pr-5 py-2 text-sm text-gray-500 hover:text-[#1B5E20] hover:bg-[#F1F8E9]"
                                      onClick={() => setMobileOpen(false)}
                                    >{sub.label}</a>
                                  ) : (
                                    <Link key={sub.id} href={sub.href}
                                      className="block pl-12 pr-5 py-2 text-sm text-gray-500 hover:text-[#1B5E20] hover:bg-[#F1F8E9]"
                                      onClick={() => setMobileOpen(false)}
                                    >{sub.label}</Link>
                                  )
                                ) : (
                                  <span key={sub.id} className="block pl-12 pr-5 py-2 text-sm text-gray-400">{sub.label}</span>
                                )
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
            <div className="border-t border-gray-200 px-5 py-3 flex gap-4">
              {memberMe ? (
                <>
                  <span className="text-sm text-gray-700 font-medium">{memberMe.name}님</span>
                  <Link href="/member/my-page" className="text-sm text-[#1B5E20] hover:underline">내 정보</Link>
                  <button onClick={() => memberLogoutMutation.mutate()} className="text-sm text-gray-500 hover:text-red-500">로그아웃</button>
                </>
              ) : (
                <>
                  <Link href="/member/login" className="text-sm text-[#1B5E20] font-medium hover:underline">로그인</Link>
                  <Link href="/member/register" className="text-sm text-gray-600 hover:underline">회원가입</Link>
                </>
              )}
            </div>
          </div>
        )}
      </header>
    </>
  );
}
