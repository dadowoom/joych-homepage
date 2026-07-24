/**
 * SubPageLayout — 하위 페이지 공통 레이아웃
 * SiteHeader(공통 헤더) + 브레드크럼 + 좌측 사이드 메뉴 + 푸터
 * 모든 동적 페이지(/page/item/:id, /page/sub/:id)에서 사용
 *
 * ⚠️ 헤더는 SiteHeader 컴포넌트를 재사용합니다.
 *    App.tsx에서 이미 <SiteHeader />를 렌더링하므로 여기서는 중복 렌더링하지 않습니다.
 */
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { isExternalSiteHref, normalizeSiteHref } from "@/lib/siteHref";
import { ChevronDown, ChevronRight, Home } from "lucide-react";

const LOGO_URL = "https://d2xsxph8kpxj0f.cloudfront.net/310519663470178900/KASTcRBzh5rwhJEekrJN6E/church-logo_35c62cc5.jpg";
const CHURCH_ADDRESS = "경상북도 포항시 북구 삼흥로 411";

function getChurchAddress(address?: string | null) {
  const value = address?.trim();
  if (!value || value.includes("상통로 411")) {
    return CHURCH_ADDRESS;
  }
  return value;
}

type SideMenuItem = {
  id: number;
  label: string;
  href: string | null;
  isActive?: boolean;
  subItems?: SideMenuItem[];
};

function normalizeSideMenuHref(href: string | null | undefined) {
  const normalized = normalizeSiteHref(href);
  if (!normalized) return "";
  try {
    return decodeURIComponent(normalized);
  } catch {
    return normalized;
  }
}

function normalizeSideMenuLabel(label: string | null | undefined) {
  return (label ?? "").replace(/\s+/g, "");
}

interface SubPageLayoutProps {
  /** 현재 페이지 제목 (브레드크럼 마지막 항목) */
  pageTitle: string;
  /** 상위 메뉴 이름 (브레드크럼 중간 항목) */
  parentLabel?: string;
  /** 상위 메뉴 href */
  parentHref?: string;
  /** 사이드 메뉴에 표시할 같은 카테고리 항목들 */
  sideMenuItems?: SideMenuItem[];
  hideFooterSocialLinks?: boolean;
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
  const [location, setLocation] = useLocation();
  const [openSideMenuIds, setOpenSideMenuIds] = useState<Set<number>>(new Set());
  const normalizedLocation = useMemo(() => normalizeSideMenuHref(location), [location]);
  const isSubItemActive = (subItem: SideMenuItem) =>
    subItem.isActive || normalizeSideMenuHref(subItem.href) === normalizedLocation;
  const isItemActive = (item: SideMenuItem) =>
    item.isActive ||
    normalizeSideMenuHref(item.href) === normalizedLocation ||
    Boolean(item.subItems?.some(isSubItemActive));
  const activeSideMenuIds = useMemo(
    () =>
      sideMenuItems
        .filter((item) => isItemActive(item))
        .map((item) => item.id),
    [sideMenuItems, normalizedLocation]
  );
  const activeSideMenuKey = activeSideMenuIds.join(",");
  const mobileSideMenuOptions = useMemo(
    () =>
      sideMenuItems.flatMap((item) => {
        // 행정지원의 주보는 모바일 선택창에서 중간 묶음 항목을 숨기고,
        // 주보 보기와 주보 광고신청을 각각 바로 선택하게 합니다.
        if (
          normalizeSideMenuLabel(parentLabel) === "행정지원" &&
          normalizeSideMenuLabel(item.label) === "주보"
        ) {
          return (item.subItems ?? [])
            .filter((subItem) => Boolean(subItem.href))
            .map((subItem) => ({
              key: `sub-${subItem.id}`,
              label: subItem.label,
              href: subItem.href as string,
              isActive:
                subItem.isActive ||
                normalizeSideMenuHref(subItem.href) === normalizedLocation,
            }));
        }

        return [
          ...(item.href
            ? [
                {
                  key: `item-${item.id}`,
                  label: item.label,
                  href: item.href,
                  isActive:
                    item.isActive ||
                    normalizeSideMenuHref(item.href) === normalizedLocation,
                },
              ]
            : []),
          ...(item.subItems ?? [])
            .filter((subItem) => Boolean(subItem.href))
            .map((subItem) => ({
              key: `sub-${subItem.id}`,
              label: `${item.label} · ${subItem.label}`,
              href: subItem.href as string,
              isActive:
                subItem.isActive ||
                normalizeSideMenuHref(subItem.href) === normalizedLocation,
            })),
        ];
      }),
    [normalizedLocation, parentLabel, sideMenuItems]
  );
  const activeMobileSideMenuHref =
    mobileSideMenuOptions.find((option) => option.isActive)?.href ?? "";

  useEffect(() => {
    if (!activeSideMenuKey) return;
    const activeIds = activeSideMenuKey.split(",").map((id) => Number(id));
    setOpenSideMenuIds((previous) => {
      const next = new Set(previous);
      let changed = false;
      activeIds.forEach((id) => {
        if (!next.has(id)) {
          next.add(id);
          changed = true;
        }
      });
      return changed ? next : previous;
    });
  }, [activeSideMenuKey]);

  const toggleSideMenu = (itemId: number) => {
    setOpenSideMenuIds((previous) => {
      const next = new Set(previous);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

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
                  isExternalSiteHref(parentHref) ? (
                    <a
                      href={parentHref}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="hover:text-[#1B5E20] transition-colors"
                    >
                      {parentLabel}
                    </a>
                  ) : (
                    <Link href={parentHref} className="hover:text-[#1B5E20] transition-colors">{parentLabel}</Link>
                  )
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
                  {sideMenuItems.map((item) => {
                    const hasSubItems = Boolean(item.subItems?.length);
                    const isOpen = openSideMenuIds.has(item.id);
                    const activeItem = isItemActive(item);

                    return (
                      <li key={item.id}>
                        {hasSubItems && item.href ? (
                          <div
                            className={`flex items-stretch border-b border-gray-100 last:border-0 transition-colors ${
                              activeItem
                                ? "bg-[#F1F8E9] text-[#1B5E20] font-semibold"
                                : "text-gray-600 hover:bg-[#F1F8E9] hover:text-[#1B5E20]"
                            }`}
                          >
                            {isExternalSiteHref(item.href) ? (
                              <a
                                href={item.href}
                                target="_blank"
                                rel="noreferrer noopener"
                                className="flex min-w-0 flex-1 items-center px-4 py-3 text-sm"
                              >
                                <span className="truncate">{item.label}</span>
                              </a>
                            ) : (
                              <Link
                                href={item.href}
                                className="flex min-w-0 flex-1 items-center px-4 py-3 text-sm"
                              >
                                <span className="truncate">{item.label}</span>
                              </Link>
                            )}
                            <button
                              type="button"
                              aria-expanded={isOpen}
                              onClick={() => toggleSideMenu(item.id)}
                              className="flex w-10 shrink-0 items-center justify-center text-gray-400 hover:text-[#1B5E20]"
                              aria-label={`${item.label} 하위 메뉴 열기`}
                            >
                              {isOpen ? (
                                <ChevronDown className="w-3.5 h-3.5 shrink-0" />
                              ) : (
                                <ChevronRight className="w-3.5 h-3.5 shrink-0" />
                              )}
                            </button>
                          </div>
                        ) : hasSubItems ? (
                          <button
                            type="button"
                            aria-expanded={isOpen}
                            onClick={() => toggleSideMenu(item.id)}
                            className={`flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm border-b border-gray-100 last:border-0 transition-colors ${
                              activeItem
                                ? "bg-[#F1F8E9] text-[#1B5E20] font-semibold"
                                : "text-gray-600 hover:bg-[#F1F8E9] hover:text-[#1B5E20]"
                            }`}
                          >
                            <span>{item.label}</span>
                            {isOpen ? (
                              <ChevronDown className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                            ) : (
                              <ChevronRight className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                            )}
                          </button>
                        ) : item.href ? (
                          isExternalSiteHref(item.href) ? (
                            <a
                              href={item.href}
                              target="_blank"
                              rel="noreferrer noopener"
                              className={`block px-4 py-3 text-sm border-b border-gray-100 last:border-0 transition-colors ${
                                activeItem
                                  ? "bg-[#F1F8E9] text-[#1B5E20] font-semibold"
                                  : "text-gray-600 hover:bg-[#F1F8E9] hover:text-[#1B5E20]"
                              }`}
                            >
                              {item.label}
                            </a>
                          ) : (
                            <Link
                              href={item.href}
                              className={`block px-4 py-3 text-sm border-b border-gray-100 last:border-0 transition-colors ${
                                activeItem
                                  ? "bg-[#F1F8E9] text-[#1B5E20] font-semibold"
                                  : "text-gray-600 hover:bg-[#F1F8E9] hover:text-[#1B5E20]"
                              }`}
                            >
                              {item.label}
                            </Link>
                          )
                        ) : (
                          <span
                            className={`block px-4 py-3 text-sm border-b border-gray-100 last:border-0 ${
                              activeItem
                                ? "bg-[#F1F8E9] text-[#1B5E20] font-semibold"
                                : "text-gray-400"
                            }`}
                          >
                            {item.label}
                          </span>
                        )}
                        {hasSubItems && isOpen && (
                          <ul className="bg-white border-t border-gray-100">
                            {item.subItems?.map((subItem) => {
                              const activeSubItem = isSubItemActive(subItem);
                              return (
                                <li key={subItem.id}>
                                  {subItem.href ? (
                                    isExternalSiteHref(subItem.href) ? (
                                      <a
                                        href={subItem.href}
                                        target="_blank"
                                        rel="noreferrer noopener"
                                        className={`block py-2.5 pl-7 pr-4 text-xs border-b border-gray-100 last:border-0 transition-colors ${
                                          activeSubItem
                                            ? "bg-[#F1F8E9] text-[#1B5E20] font-semibold"
                                            : "text-gray-500 hover:bg-[#F1F8E9] hover:text-[#1B5E20]"
                                        }`}
                                      >
                                        {subItem.label}
                                      </a>
                                    ) : (
                                      <Link
                                        href={subItem.href}
                                        className={`block py-2.5 pl-7 pr-4 text-xs border-b border-gray-100 last:border-0 transition-colors ${
                                          activeSubItem
                                            ? "bg-[#F1F8E9] text-[#1B5E20] font-semibold"
                                            : "text-gray-500 hover:bg-[#F1F8E9] hover:text-[#1B5E20]"
                                        }`}
                                      >
                                        {subItem.label}
                                      </Link>
                                    )
                                  ) : (
                                    <span
                                      className={`block py-2.5 pl-7 pr-4 text-xs border-b border-gray-100 last:border-0 ${
                                        activeSubItem
                                          ? "bg-[#F1F8E9] text-[#1B5E20] font-semibold"
                                          : "text-gray-400"
                                      }`}
                                    >
                                      {subItem.label}
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
              {mobileSideMenuOptions.length > 0 && (
                <label className="mb-5 block md:hidden">
                  <span className="mb-2 block text-xs font-semibold text-[#1B5E20]">
                    {parentLabel ? `${parentLabel} 메뉴` : "페이지 메뉴"}
                  </span>
                  <select
                    aria-label={parentLabel ? `${parentLabel} 메뉴` : "페이지 메뉴"}
                    value={activeMobileSideMenuHref}
                    onChange={(event) => {
                      const href = event.target.value;
                      if (!href) return;
                      if (isExternalSiteHref(href)) {
                        window.open(href, "_blank", "noopener,noreferrer");
                        return;
                      }
                      setLocation(href);
                    }}
                    className="h-11 w-full rounded-md border border-[#1B5E20] bg-white px-3 text-sm font-medium text-gray-700 outline-none focus:ring-2 focus:ring-[#1B5E20]/20"
                  >
                    <option value="" disabled>
                      이동할 메뉴를 선택하세요
                    </option>
                    {mobileSideMenuOptions.map((option) => (
                      <option key={option.key} value={option.href}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {children}
            </main>

          </div>
        </div>
      </div>

      {/* ===== 푸터 ===== */}
      <footer className="bg-[#0F172A] text-gray-400 py-6 mt-auto">
        <div className="container">
          <div className="grid grid-cols-1 items-center gap-5 md:grid-cols-2">
            <div>
              <div className="inline-flex rounded-md bg-white px-3 py-2">
                <img
                  src={LOGO_URL}
                  alt="기쁨의교회"
                  className="h-8 w-auto object-contain"
                 loading="lazy"/>
              </div>
              <p className="mt-2 text-xs text-gray-600">since 1946 대한예수교장로회</p>
            </div>
            <div className="space-y-1.5 text-sm">
              <p className="flex items-center gap-2">
                <i className="fas fa-map-marker-alt text-[#4CAF50] w-4"></i>
                {getChurchAddress(dbSettings?.address)}
              </p>
              <p className="flex items-center gap-2">
                <i className="fas fa-phone text-[#4CAF50] w-4"></i>
                TEL : {dbSettings?.tel ?? "054) 270-1000"} &nbsp;|&nbsp; FAX : {dbSettings?.fax ?? "054) 270-1005"}
              </p>
              <p className="text-xs text-gray-500 mt-3">
                Copyright &copy; {new Date().getFullYear()} 기쁨의교회 All rights reserved.
              </p>
              <a
                href="/privacy-policy"
                className="inline-flex text-xs text-gray-400 underline underline-offset-4 transition-colors hover:text-white"
              >
                개인정보처리방침
              </a>
            </div>
          </div>
        </div>
      </footer>

    </div>
  );
}
