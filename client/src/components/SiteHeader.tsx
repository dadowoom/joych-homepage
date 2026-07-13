/**
 * 공통 사이트 헤더 컴포넌트
 * - 모든 페이지에서 sticky top-0으로 고정 표시
 * - 상단 유틸 바 (로그인/회원가입/SNS) + GNB 네비게이션
 * - DB에서 메뉴 데이터 불러오기 (없으면 기본 메뉴 사용)
 */

import { useState, useEffect } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { trpc } from "@/lib/trpc";
import { isExternalSiteHref, normalizeSiteHref } from "@/lib/siteHref";
import { toFallbackMenuTree } from "@shared/siteNavigation";
import { useLanguage, translateSiteText } from "@/contexts/LanguageContext";

function getUsableHref(href?: string | null) {
  return normalizeSiteHref(href);
}

function normalizeMenuLabel(label: string) {
  return label.replace(/\s+/g, "");
}

function decodeMenuHref(href?: string | null) {
  try {
    return decodeURIComponent(href ?? "");
  } catch {
    return href ?? "";
  }
}

function normalizeMenuHref(href?: string | null) {
  return decodeMenuHref(href).replace(/[\s-]+/g, "");
}

function getSpecialMenuHref(label?: string | null, href?: string | null) {
  const normalized = normalizeMenuLabel(label ?? "");
  const normalizedHref = normalizeMenuHref(href);
  if (normalized === "주보보기") return "/worship/bulletin";
  if (normalized === "주보광고신청") return "/support/bulletin-ad";
  if (normalized === "자막신청") return "/support/subtitle";
  if (normalized === "탐방신청") return "/support/tour";
  if (normalized === "외부인" && normalizedHref.includes("시설사용예약외부인"))
    return "/facility/external";
  return null;
}

function isContainerOnlySecondLevelItem(item: unknown) {
  const data = item as Record<string, unknown>;
  const label =
    typeof data.label === "string" ? normalizeMenuLabel(data.label) : "";
  return label === "자료실";
}

function isRepresentativeLinkSecondLevelItem(item: unknown) {
  const data = item as Record<string, unknown>;
  const label =
    typeof data.label === "string" ? normalizeMenuLabel(data.label) : "";
  return label === "주보";
}

function getRepresentativeSubItemHref(item: unknown) {
  const data = item as {
    subItems?: Array<{ label?: string | null; href?: string | null }>;
  };
  const subItems = data.subItems ?? [];
  const bulletinView = subItems.find(
    sub => normalizeMenuLabel(sub.label ?? "") === "주보보기"
  );
  return (
    getSpecialMenuHref(bulletinView?.label, bulletinView?.href) ??
    getUsableHref(bulletinView?.href) ??
    getUsableHref(subItems.find(sub => getUsableHref(sub.href))?.href)
  );
}

function hasOwnSecondLevelContent(item: unknown) {
  if (isContainerOnlySecondLevelItem(item)) return false;

  const data = item as Record<string, unknown>;
  const pageType = typeof data.pageType === "string" ? data.pageType : "image";
  if (pageType === "image") {
    return (
      typeof data.pageImageUrl === "string" &&
      data.pageImageUrl.trim().length > 0
    );
  }
  return true;
}

function getSecondLevelHref(item: unknown, hasSubItems: boolean) {
  const specialHref = getSpecialMenuHref(
    (item as { label?: string | null }).label,
    (item as { href?: string | null }).href
  );
  if (specialHref) return specialHref;

  if (hasSubItems) {
    if (isContainerOnlySecondLevelItem(item)) return null;
    if (isRepresentativeLinkSecondLevelItem(item)) {
      return (
        getRepresentativeSubItemHref(item) ??
        getUsableHref((item as { href?: string | null }).href)
      );
    }
    if (!hasOwnSecondLevelContent(item)) return null;
  }

  return getUsableHref((item as { href?: string | null }).href);
}

function getThirdLevelHref(item: {
  label?: string | null;
  href?: string | null;
}) {
  return getSpecialMenuHref(item.label, item.href) ?? getUsableHref(item.href);
}

type HeaderMenuChild = {
  id: number;
  label: string;
  href?: string | null;
  pageType?: string | null;
  pageImageUrl?: string | null;
  subItems?: HeaderMenuChild[];
};

function getMobileSecondLevelItems(menu: { items?: HeaderMenuChild[] }) {
  return (menu.items ?? []).flatMap(item => {
    // 주보는 데스크톱에서는 묶음 메뉴로 유지하되, 모바일에서는
    // 주보 보기/광고신청을 바로 누를 수 있도록 2차 메뉴로 펼칩니다.
    if (isRepresentativeLinkSecondLevelItem(item)) {
      return item.subItems ?? [];
    }
    return [item];
  });
}

const fallbackMenus = toFallbackMenuTree();

async function invalidateMemberSessionBoundQueries(
  utils: ReturnType<typeof trpc.useUtils>
) {
  await Promise.all([
    utils.members.me.invalidate(),
    utils.home.menus.invalidate(),
    utils.home.menuItem.invalidate(),
    utils.home.menuSubItem.invalidate(),
    utils.home.menuItemByHref.invalidate(),
    utils.home.menuSubItemByHref.invalidate(),
    utils.home.menuAccessByHref.invalidate(),
    utils.home.menuAccessById.invalidate(),
    utils.home.bulletins.invalidate(),
  ]);
}

export default function SiteHeader() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [searchName, setSearchName] = useState("");
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [desktopOpenId, setDesktopOpenId] = useState<number | null>(null);
  const [desktopOpenSubId, setDesktopOpenSubId] = useState<number | null>(null);
  const [mobileExpandedId, setMobileExpandedId] = useState<number | null>(null);
  const [mobileExpandedSubId, setMobileExpandedSubId] = useState<number | null>(
    null
  );
  const [location, setLocation] = useLocation();
  const searchString = useSearch();
  const { language, toggleLanguage, t } = useLanguage();
  const utils = trpc.useUtils();

  const { data: memberMe } = trpc.members.me.useQuery();
  const memberLogoutMutation = trpc.members.logout.useMutation({
    onSuccess: async () => {
      utils.members.me.setData(undefined, null);
      await invalidateMemberSessionBoundQueries(utils);
    },
  });
  const { data: dbMenus, isLoading: menusLoading } = trpc.home.menus.useQuery(
    undefined,
    {
      staleTime: 0,
      refetchOnMount: "always",
      refetchOnWindowFocus: true,
    }
  );
  const { data: dbSettings } = trpc.home.settings.useQuery();
  const displayMenus = Array.isArray(dbMenus)
    ? dbMenus
    : menusLoading
      ? []
      : fallbackMenus;
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
  socialLinks.length = 0;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // 페이지 이동 시 모바일 메뉴 닫기
  useEffect(() => {
    setDesktopOpenId(null);
    setDesktopOpenSubId(null);
    setMobileOpen(false);
    setMobileSearchOpen(false);
  }, [location]);

  useEffect(() => {
    if (location !== "/search") return;

    const nextKeyword = new URLSearchParams(searchString).get("q") ?? "";
    setSearchName(nextKeyword);
  }, [location, searchString]);

  const handleSearch = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = searchName.trim();
    if (!trimmed) return;
    setMobileSearchOpen(false);
    setLocation(`/search?q=${encodeURIComponent(trimmed)}`);
  };

  const closeDesktopMenus = () => {
    setDesktopOpenId(null);
    setDesktopOpenSubId(null);
  };

  return (
    <>
      {/* ===== 상단 유틸 바 ===== */}
      <div className="bg-[#0F172A] text-gray-400 text-xs py-2 hidden md:block">
        <div className="container flex justify-between items-center">
          <span className="tracking-wide">
            {t("깊이있는 성장, 위대한 교회")}
          </span>
          <div className="flex gap-4 items-center">
            {memberMe ? (
              <>
                <span className="text-gray-300">{memberMe.name}님</span>
                <Link
                  href="/member/my-page"
                  className="hover:text-white transition-colors"
                >
                  {t("내 정보")}
                </Link>
                <button
                  onClick={() => memberLogoutMutation.mutate()}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  {t("로그아웃")}
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/member/login"
                  className="hover:text-white transition-colors"
                >
                  {t("로그인")}
                </Link>
                <Link
                  href="/member/register"
                  className="hover:text-white transition-colors"
                >
                  {t("회원가입")}
                </Link>
              </>
            )}
            <button
              type="button"
              onClick={toggleLanguage}
              className="rounded-full border border-gray-600 px-2.5 py-1 text-[11px] font-semibold text-gray-300 hover:border-white hover:text-white transition-colors"
              aria-label="언어 변경"
            >
              {language === "ja" ? "KO" : "日本語"}
            </button>
            <div className="flex gap-3 ml-2">
              {socialLinks.map(s =>
                s.href ? (
                  <a
                    key={s.label}
                    href={s.href}
                    aria-label={t(s.label)}
                    className="hover:text-white transition-colors"
                  >
                    <i className={s.icon}></i>
                  </a>
                ) : (
                  <span
                    key={s.label}
                    aria-label={`${t(s.label)} 링크 미등록`}
                    className="text-gray-600"
                  >
                    <i className={s.icon}></i>
                  </span>
                )
              )}
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

          {/* 통합 검색창 — PC */}
          <form
            onSubmit={handleSearch}
            className="hidden md:flex items-center gap-0 mx-4 flex-1 max-w-[320px]"
          >
            <div className="relative flex-1">
              <input
                type="text"
                value={searchName}
                onChange={e => setSearchName(e.target.value)}
                placeholder="통합 검색"
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
              {displayMenus.map(item => {
                const parentHref = getUsableHref(item.href);
                const parentClassName =
                  "text-sm font-medium text-gray-700 hover:text-[#1B5E20] transition-colors";
                return (
                  <li
                    key={item.id}
                    className="relative"
                    onMouseEnter={() => {
                      setDesktopOpenId(item.id);
                      setDesktopOpenSubId(null);
                    }}
                    onMouseLeave={() => {
                      if (desktopOpenId === item.id) {
                        closeDesktopMenus();
                      }
                    }}
                  >
                    <div className="flex items-center h-[72px] px-4 relative">
                      {parentHref ? (
                        isExternalSiteHref(parentHref) ? (
                          <a
                            href={parentHref}
                            target="_blank"
                            rel="noreferrer noopener"
                            className={parentClassName}
                            onClick={closeDesktopMenus}
                          >
                            {translateSiteText(item.label, language)}
                          </a>
                        ) : (
                          <Link
                            href={parentHref}
                            className={parentClassName}
                            onClick={closeDesktopMenus}
                          >
                            {translateSiteText(item.label, language)}
                          </Link>
                        )
                      ) : (
                        <span className={parentClassName}>
                          {translateSiteText(item.label, language)}
                        </span>
                      )}
                      <span
                        className={`absolute bottom-0 left-0 right-0 h-[3px] bg-[#1B5E20] transition-transform duration-200 origin-left ${
                          desktopOpenId === item.id
                            ? "scale-x-100"
                            : "scale-x-0"
                        }`}
                      ></span>
                    </div>
                    {(item.items ?? []).length > 0 &&
                      desktopOpenId === item.id && (
                        <ul className="absolute top-[72px] left-0 bg-white border-t-2 border-[#1B5E20] shadow-xl min-w-[160px] z-[200] py-1 opacity-100 visible transition-all duration-150">
                          {(item.items ?? []).map((s, j) => {
                            const hasSubItems =
                              (
                                s as {
                                  subItems?: {
                                    id: number;
                                    label: string;
                                    href?: string | null;
                                  }[];
                                }
                              ).subItems &&
                              (
                                s as {
                                  subItems?: {
                                    id: number;
                                    label: string;
                                    href?: string | null;
                                  }[];
                                }
                              ).subItems!.length > 0;
                            const subItems =
                              (
                                s as {
                                  subItems?: {
                                    id: number;
                                    label: string;
                                    href?: string | null;
                                  }[];
                                }
                              ).subItems ?? [];
                            const secondLevelHref = getSecondLevelHref(
                              s,
                              Boolean(hasSubItems)
                            );
                            const cls =
                              "flex items-center justify-between px-5 py-2.5 text-sm text-gray-600 hover:bg-[#F1F8E9] hover:text-[#1B5E20] transition-colors border-b border-gray-50 last:border-0 whitespace-nowrap";
                            return (
                              <li
                                key={j}
                                className="relative"
                                onMouseEnter={() => {
                                  if (hasSubItems) setDesktopOpenSubId(s.id);
                                }}
                                onMouseLeave={() => {
                                  if (desktopOpenSubId === s.id) {
                                    setDesktopOpenSubId(null);
                                  }
                                }}
                              >
                                {secondLevelHref ? (
                                  isExternalSiteHref(secondLevelHref) ? (
                                    <a
                                      href={secondLevelHref}
                                      target="_blank"
                                      rel="noreferrer noopener"
                                      className={cls}
                                      onClick={closeDesktopMenus}
                                    >
                                      <span>
                                        {translateSiteText(s.label, language)}
                                      </span>
                                      {hasSubItems && (
                                        <i className="fas fa-chevron-right text-[10px] text-gray-400 ml-2"></i>
                                      )}
                                    </a>
                                  ) : (
                                    <Link
                                      href={secondLevelHref}
                                      className={cls}
                                      onClick={closeDesktopMenus}
                                    >
                                      <span>
                                        {translateSiteText(s.label, language)}
                                      </span>
                                      {hasSubItems && (
                                        <i className="fas fa-chevron-right text-[10px] text-gray-400 ml-2"></i>
                                      )}
                                    </Link>
                                  )
                                ) : (
                                  <span className={`${cls} cursor-default`}>
                                    <span>
                                      {translateSiteText(s.label, language)}
                                    </span>
                                    {hasSubItems && (
                                      <i className="fas fa-chevron-right text-[10px] text-gray-400 ml-2"></i>
                                    )}
                                  </span>
                                )}
                                {hasSubItems && desktopOpenSubId === s.id && (
                                  <ul className="absolute left-full top-0 bg-white border-l-2 border-[#1B5E20] shadow-xl min-w-[150px] z-[300] py-1 opacity-100 visible transition-all duration-150">
                                    {subItems.map((sub, k) => {
                                      const thirdLevelHref =
                                        getThirdLevelHref(sub);
                                      const subCls =
                                        "block px-5 py-2.5 text-sm text-gray-600 hover:bg-[#F1F8E9] hover:text-[#1B5E20] transition-colors border-b border-gray-50 last:border-0 whitespace-nowrap";
                                      return (
                                        <li key={k}>
                                          {thirdLevelHref ? (
                                            isExternalSiteHref(
                                              thirdLevelHref
                                            ) ? (
                                              <a
                                                href={thirdLevelHref}
                                                target="_blank"
                                                rel="noreferrer noopener"
                                                className={subCls}
                                                onClick={closeDesktopMenus}
                                              >
                                                {translateSiteText(
                                                  sub.label,
                                                  language
                                                )}
                                              </a>
                                            ) : (
                                              <Link
                                                href={thirdLevelHref}
                                                className={subCls}
                                                onClick={closeDesktopMenus}
                                              >
                                                {translateSiteText(
                                                  sub.label,
                                                  language
                                                )}
                                              </Link>
                                            )
                                          ) : (
                                            <span
                                              className={`${subCls} cursor-default`}
                                            >
                                              {translateSiteText(
                                                sub.label,
                                                language
                                              )}
                                            </span>
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
                );
              })}
            </ul>
          </nav>

          {/* 모바일 오른쪽 버튼 그룹 */}
          <div className="md:hidden flex items-center gap-1">
            <button
              type="button"
              onClick={toggleLanguage}
              className="p-2 text-xs font-bold text-gray-600"
              aria-label="언어 변경"
            >
              {language === "ja" ? "KO" : "JA"}
            </button>
            <button
              className="p-2 text-[#1B5E20]"
              onClick={() => {
                setMobileSearchOpen(!mobileSearchOpen);
                setMobileOpen(false);
              }}
              aria-label="통합 검색"
            >
              <i
                className={`fas ${mobileSearchOpen ? "fa-times" : "fa-search"} text-lg`}
              ></i>
            </button>
            <button
              className="p-2 text-gray-700"
              onClick={() => {
                setMobileOpen(!mobileOpen);
                setMobileSearchOpen(false);
              }}
            >
              <i
                className={`fas ${mobileOpen ? "fa-times" : "fa-bars"} text-xl`}
              ></i>
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
                  onChange={e => setSearchName(e.target.value)}
                  placeholder="통합 검색"
                  autoFocus
                  className="w-full h-11 pl-4 pr-4 text-base rounded-full border-2 border-[#1B5E20]/40 bg-white text-gray-700 placeholder-gray-400 focus:outline-none focus:border-[#1B5E20] transition-all duration-200"
                />
              </div>
              <button
                type="submit"
                className="h-11 px-5 rounded-full bg-[#1B5E20] text-white text-sm font-medium hover:bg-[#2E7D32] transition-colors shrink-0"
              >
                {t("검색")}
              </button>
            </form>
            <p className="text-xs text-gray-400 mt-2 pl-1">
              설교/영상과 게시물을 한 번에 검색합니다.
            </p>
          </div>
        )}

        {/* 모바일 메뉴 */}
        {mobileOpen && (
          <div className="md:hidden bg-white border-t border-gray-100 shadow-lg max-h-[70vh] overflow-y-auto">
            {displayMenus.map(menu => {
              const parentHref = getUsableHref(menu.href);
              const hasChildren = (menu.items ?? []).length > 0;

              return (
                <div key={menu.id} className="border-b border-gray-100">
                  {/* 1단 메뉴 */}
                  {!hasChildren && parentHref ? (
                    isExternalSiteHref(parentHref) ? (
                      <a
                        href={parentHref}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="flex w-full items-center justify-between px-5 py-3 text-left text-sm font-medium text-gray-700 hover:bg-[#F1F8E9] hover:text-[#1B5E20]"
                        onClick={() => setMobileOpen(false)}
                      >
                        <span>{translateSiteText(menu.label, language)}</span>
                        <i className="fas fa-arrow-right text-[10px] text-gray-400"></i>
                      </a>
                    ) : (
                      <Link
                        href={parentHref}
                        className="flex w-full items-center justify-between px-5 py-3 text-left text-sm font-medium text-gray-700 hover:bg-[#F1F8E9] hover:text-[#1B5E20]"
                        onClick={() => setMobileOpen(false)}
                      >
                        <span>{translateSiteText(menu.label, language)}</span>
                        <i className="fas fa-arrow-right text-[10px] text-gray-400"></i>
                      </Link>
                    )
                  ) : (
                    <button
                      className="w-full flex items-center justify-between px-5 py-3 text-sm font-medium text-gray-700 hover:bg-[#F1F8E9] hover:text-[#1B5E20] text-left"
                      onClick={() => {
                        setMobileExpandedId(
                          mobileExpandedId === menu.id ? null : menu.id
                        );
                        setMobileExpandedSubId(null);
                      }}
                    >
                      <span>{translateSiteText(menu.label, language)}</span>
                      {hasChildren && (
                        <i
                          className={`fas fa-chevron-${mobileExpandedId === menu.id ? "up" : "down"} text-[10px] text-gray-400`}
                        ></i>
                      )}
                    </button>
                  )}
                  {/* 2단 메뉴 */}
                  {mobileExpandedId === menu.id &&
                    (menu.items ?? []).length > 0 && (
                      <div className="bg-gray-50">
                        {getMobileSecondLevelItems(menu).map(item => {
                          const hasSubItems =
                            (item as { subItems?: unknown[] }).subItems &&
                            (item as { subItems?: unknown[] }).subItems!
                              .length > 0;
                          const subItems =
                            (
                              item as {
                                subItems?: {
                                  id: number;
                                  label: string;
                                  href?: string | null;
                                }[];
                              }
                            ).subItems ?? [];
                          const secondLevelHref = getSecondLevelHref(
                            item,
                            Boolean(hasSubItems)
                          );
                          return (
                            <div key={item.id}>
                              {hasSubItems ? (
                                <div className="flex items-center">
                                  <button
                                    type="button"
                                    className="w-full flex items-center justify-between flex-1 pl-8 pr-3 py-2.5 text-sm text-gray-600 hover:text-[#1B5E20] hover:bg-[#F1F8E9] text-left"
                                    onClick={() =>
                                      setMobileExpandedSubId(
                                        mobileExpandedSubId === item.id
                                          ? null
                                          : item.id
                                      )
                                    }
                                    aria-label={`${translateSiteText(item.label, language)} 하위 메뉴 열기`}
                                  >
                                    <span>
                                      {translateSiteText(item.label, language)}
                                    </span>
                                    <i
                                      className={`fas fa-chevron-${mobileExpandedSubId === item.id ? "up" : "down"} text-[10px] text-gray-400`}
                                    ></i>
                                  </button>
                                  {secondLevelHref ? (
                                    isExternalSiteHref(secondLevelHref) ? (
                                      <a
                                        href={secondLevelHref}
                                        target="_blank"
                                        rel="noreferrer noopener"
                                        className="px-3 py-2.5 text-gray-400 hover:text-[#1B5E20] hover:bg-[#F1F8E9]"
                                        onClick={() => setMobileOpen(false)}
                                        aria-label={`${translateSiteText(item.label, language)} 이동`}
                                      >
                                        <i className="fas fa-external-link-alt text-[12px]"></i>
                                      </a>
                                    ) : (
                                      <Link
                                        href={secondLevelHref}
                                        className="px-3 py-2.5 text-gray-400 hover:text-[#1B5E20] hover:bg-[#F1F8E9]"
                                        onClick={() => setMobileOpen(false)}
                                        aria-label={`${translateSiteText(item.label, language)} 이동`}
                                      >
                                        <i className="fas fa-arrow-right text-[12px]"></i>
                                      </Link>
                                    )
                                  ) : null}
                                </div>
                              ) : secondLevelHref ? (
                                isExternalSiteHref(secondLevelHref) ? (
                                  <a
                                    href={secondLevelHref}
                                    target="_blank"
                                    rel="noreferrer noopener"
                                    className="block pl-8 pr-5 py-2.5 text-sm text-gray-600 hover:text-[#1B5E20] hover:bg-[#F1F8E9]"
                                    onClick={() => setMobileOpen(false)}
                                  >
                                    {translateSiteText(item.label, language)}
                                  </a>
                                ) : (
                                  <Link
                                    href={secondLevelHref}
                                    className="block pl-8 pr-5 py-2.5 text-sm text-gray-600 hover:text-[#1B5E20] hover:bg-[#F1F8E9]"
                                    onClick={() => setMobileOpen(false)}
                                  >
                                    {translateSiteText(item.label, language)}
                                  </Link>
                                )
                              ) : (
                                <span className="block pl-8 pr-5 py-2.5 text-sm text-gray-400">
                                  {translateSiteText(item.label, language)}
                                </span>
                              )}
                              {/* 3단 메뉴 */}
                              {hasSubItems &&
                                mobileExpandedSubId === item.id && (
                                  <div className="bg-white">
                                    {subItems.map(sub => {
                                      const thirdLevelHref =
                                        getThirdLevelHref(sub);
                                      return thirdLevelHref ? (
                                        isExternalSiteHref(thirdLevelHref) ? (
                                          <a
                                            key={sub.id}
                                            href={thirdLevelHref}
                                            target="_blank"
                                            rel="noreferrer noopener"
                                            className="block pl-12 pr-5 py-2 text-sm text-gray-500 hover:text-[#1B5E20] hover:bg-[#F1F8E9]"
                                            onClick={() => setMobileOpen(false)}
                                          >
                                            {translateSiteText(
                                              sub.label,
                                              language
                                            )}
                                          </a>
                                        ) : (
                                          <Link
                                            key={sub.id}
                                            href={thirdLevelHref}
                                            className="block pl-12 pr-5 py-2 text-sm text-gray-500 hover:text-[#1B5E20] hover:bg-[#F1F8E9]"
                                            onClick={() => setMobileOpen(false)}
                                          >
                                            {translateSiteText(
                                              sub.label,
                                              language
                                            )}
                                          </Link>
                                        )
                                      ) : (
                                        <span
                                          key={sub.id}
                                          className="block pl-12 pr-5 py-2 text-sm text-gray-400"
                                        >
                                          {translateSiteText(
                                            sub.label,
                                            language
                                          )}
                                        </span>
                                      );
                                    })}
                                  </div>
                                )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                </div>
              );
            })}
            <div className="border-t border-gray-200 px-5 py-3 flex gap-4">
              {memberMe ? (
                <>
                  <span className="text-sm text-gray-700 font-medium">
                    {memberMe.name}님
                  </span>
                  <Link
                    href="/member/my-page"
                    className="text-sm text-[#1B5E20] hover:underline"
                  >
                    {t("내 정보")}
                  </Link>
                  <button
                    onClick={() => memberLogoutMutation.mutate()}
                    className="text-sm text-gray-500 hover:text-red-500"
                  >
                    {t("로그아웃")}
                  </button>
                </>
              ) : (
                <>
                  <Link
                    href="/member/login"
                    className="text-sm text-[#1B5E20] font-medium hover:underline"
                  >
                    {t("로그인")}
                  </Link>
                  <Link
                    href="/member/register"
                    className="text-sm text-gray-600 hover:underline"
                  >
                    {t("회원가입")}
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </header>
    </>
  );
}
