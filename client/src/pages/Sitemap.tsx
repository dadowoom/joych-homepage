/**
 * 사이트맵 페이지 (/sitemap)
 * DB에서 전체 메뉴 구조를 읽어 1단/2단/3단 메뉴를 한눈에 볼 수 있게 표시
 * 각 항목은 클릭 가능한 링크로 연결
 */
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import SubPageLayout from "@/components/SubPageLayout";
import { isExternalSiteHref } from "@/lib/siteHref";
import { ChevronRight } from "lucide-react";

export default function Sitemap() {
  const { data: menus, isLoading } = trpc.home.menus.useQuery();

  return (
    <SubPageLayout pageTitle="사이트맵" hideFooterSocialLinks>
      {isLoading ? (
        <div className="flex items-center justify-center py-24 text-gray-400">
          불러오는 중...
        </div>
      ) : (
        <div className="space-y-10">
          <p className="text-sm text-gray-500 mb-8">
            기쁨의교회 홈페이지의 전체 메뉴 구조입니다. 원하시는 메뉴를 클릭하시면 해당 페이지로 이동합니다.
          </p>

          {/* 1단 메뉴 그리드 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {(menus ?? []).map((topMenu) => (
              <div key={topMenu.id} className="border border-gray-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                {/* 1단 메뉴 헤더 */}
                <div className="bg-[#1B5E20] px-4 py-3">
                  {topMenu.href ? (
                    isExternalSiteHref(topMenu.href) ? (
                      <a
                        href={topMenu.href}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="text-white font-bold text-sm hover:text-[#A5D6A7] transition-colors"
                      >
                        {topMenu.label}
                      </a>
                    ) : (
                      <Link href={topMenu.href} className="text-white font-bold text-sm hover:text-[#A5D6A7] transition-colors">
                        {topMenu.label}
                      </Link>
                    )
                  ) : (
                    <span className="text-white font-bold text-sm">{topMenu.label}</span>
                  )}
                </div>

                {/* 2단/3단 메뉴 목록 */}
                <ul className="divide-y divide-gray-50 bg-white">
                  {(topMenu.items ?? []).length === 0 ? (
                    <li className="px-4 py-3 text-xs text-gray-400">하위 메뉴 없음</li>
                  ) : (
                    (topMenu.items ?? []).map((midMenu) => {
                      const subItems = (midMenu as {
                        subItems?: { id: number; label: string; href?: string | null }[];
                      }).subItems ?? [];

                      return (
                        <li key={midMenu.id}>
                          {/* 2단 메뉴 */}
                          <div className="flex items-center gap-1 px-4 py-2.5 hover:bg-[#F1F8E9] transition-colors group">
                            <ChevronRight className="w-3 h-3 text-[#1B5E20] shrink-0" />
                            {midMenu.href ? (
                              isExternalSiteHref(midMenu.href) ? (
                                <a
                                  href={midMenu.href}
                                  target="_blank"
                                  rel="noreferrer noopener"
                                  className="text-sm text-gray-700 group-hover:text-[#1B5E20] font-medium transition-colors"
                                >
                                  {midMenu.label}
                                </a>
                              ) : (
                                <Link
                                  href={midMenu.href}
                                  className="text-sm text-gray-700 group-hover:text-[#1B5E20] font-medium transition-colors"
                                >
                                  {midMenu.label}
                                </Link>
                              )
                            ) : (
                              <span className="text-sm text-gray-500">{midMenu.label}</span>
                            )}
                          </div>

                          {/* 3단 메뉴 (있을 경우) */}
                          {subItems.length > 0 && (
                            <ul className="bg-gray-50 border-t border-gray-100">
                              {subItems.map((sub) => (
                                <li key={sub.id} className="flex items-center gap-1 pl-8 pr-4 py-2 hover:bg-[#F1F8E9] transition-colors group">
                                  <span className="w-1.5 h-1.5 rounded-full bg-gray-300 shrink-0 group-hover:bg-[#1B5E20] transition-colors"></span>
                                  {sub.href ? (
                                    isExternalSiteHref(sub.href) ? (
                                      <a
                                        href={sub.href}
                                        target="_blank"
                                        rel="noreferrer noopener"
                                        className="text-xs text-gray-600 group-hover:text-[#1B5E20] transition-colors"
                                      >
                                        {sub.label}
                                      </a>
                                    ) : (
                                      <Link
                                        href={sub.href}
                                        className="text-xs text-gray-600 group-hover:text-[#1B5E20] transition-colors"
                                      >
                                        {sub.label}
                                      </Link>
                                    )
                                  ) : (
                                    <span className="text-xs text-gray-400">{sub.label}</span>
                                  )}
                                </li>
                              ))}
                            </ul>
                          )}
                        </li>
                      );
                    })
                  )}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
    </SubPageLayout>
  );
}
