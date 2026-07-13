/**
 * 기쁨의교회 선교보고 목록 페이지 — /mission
 * 디자인: Warm Modern Sacred — 녹색 포인트(#1B5E20), Noto Serif KR, 카드 레이아웃
 * 구성: PageBanner → 필터(대륙/선교사) → 보고 카드 목록(최신순)
 * 공개 데이터는 mission tRPC API에서 조회하며, 기존 카드 UI는 유지합니다.
 */

import { useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import SubPageLayout from "@/components/SubPageLayout";
import { canManageBoardContent } from "@/lib/contentPermissions";
import { findMenuAccessMatchByHref } from "@/lib/menuAccess";
import { trpc } from "@/lib/trpc";
import { CONTINENT_LABELS, type MissionContinent } from "@/lib/missionData";
import { toast } from "sonner";

// 날짜 포맷 헬퍼 (YYYY-MM-DD → YYYY년 MM월 DD일)
function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  return `${y}년 ${m}월 ${d}일`;
}

const MISSION_SIDE_MENU_ITEMS = [
  { id: 1, label: "국내 선교", href: "/mission-work/domestic" },
  { id: 2, label: "해외 선교", href: "/mission-work/overseas" },
  { id: 3, label: "봉사 활동", href: "/mission-work/volunteer" },
  { id: 4, label: "선교보고", href: "/mission", isActive: true },
];

function normalizeMenuHref(href: string | null | undefined) {
  const trimmed = href?.trim() ?? "";
  if (!trimmed) return "";

  try {
    const decoded = decodeURIComponent(trimmed);
    if (!/^https?:\/\//i.test(decoded)) return decoded;

    const url = new URL(decoded);
    if (url.hostname === "newjoych.co.kr" || url.hostname === "www.newjoych.co.kr") {
      return `${url.pathname}${url.search}${url.hash}`;
    }

    return decoded;
  } catch {
    return trimmed;
  }
}

export default function MissionList() {
  const [selectedContinent, setSelectedContinent] = useState<MissionContinent | "all">("all");
  const [selectedMissionary, setSelectedMissionary] = useState<number | "all">("all");
  const [selectedStatus, setSelectedStatus] = useState<"all" | "pending" | "published" | "rejected" | "draft">("all");
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const canManage = canManageBoardContent(user, "content:missionReports");
  const { data: allMenus } = trpc.home.menus.useQuery();

  const publicReportsQuery = trpc.mission.reports.useQuery(undefined, { enabled: !canManage });
  const adminReportsQuery = trpc.cms.missionReports.reports.useQuery(undefined, { enabled: canManage });
  const utils = trpc.useUtils();
  const deleteReport = trpc.cms.missionReports.deleteReport.useMutation({
    onSuccess: async () => {
      toast.success("선교보고가 삭제되었습니다.");
      await Promise.all([
        utils.cms.missionReports.reports.invalidate(),
        utils.mission.reports.invalidate(),
      ]);
    },
    onError: (error) => toast.error(error.message || "선교보고 삭제에 실패했습니다."),
  });
  const reviewReport = trpc.cms.missionReports.reviewReport.useMutation({
    onSuccess: async (_, variables) => {
      const statusLabel = variables.status === "published" ? "공개" : variables.status === "rejected" ? "반려" : "숨김";
      toast.success(`선교보고를 ${statusLabel} 처리했습니다.`);
      await Promise.all([
        utils.cms.missionReports.reports.invalidate(),
        utils.mission.reports.invalidate(),
      ]);
    },
    onError: (error) => toast.error(error.message || "선교보고 상태 변경에 실패했습니다."),
  });
  const reports = canManage ? (adminReportsQuery.data ?? []) : (publicReportsQuery.data ?? []);
  const isLoading = canManage ? adminReportsQuery.isLoading : publicReportsQuery.isLoading;
  const { data: missionaries = [] } = trpc.mission.missionaries.useQuery();
  const { data: me } = trpc.members.me.useQuery(undefined, { retry: false });
  const { data: authorGrants = [] } = trpc.mission.myAuthorGrants.useQuery(undefined, {
    enabled: Boolean(me),
    retry: false,
  });
  const canWriteMissionReport = canManage || authorGrants.length > 0;
  const menuMatch = useMemo(() => findMenuAccessMatchByHref(allMenus, "/mission"), [allMenus]);
  const sideMenuItems = useMemo(() => {
    if (!menuMatch) return MISSION_SIDE_MENU_ITEMS;

    const activeHref = normalizeMenuHref(menuMatch.node.href);
    return (menuMatch.topMenu.items ?? []).map((item) => ({
      id: item.id,
      label: item.label,
      href: item.href ?? null,
      isActive: normalizeMenuHref(item.href) === activeHref,
      subItems: (item.subItems ?? []).map((subItem) => ({
        id: subItem.id,
        label: subItem.label,
        href: subItem.href ?? null,
        isActive: normalizeMenuHref(subItem.href) === activeHref,
      })),
    }));
  }, [menuMatch]);
  const parentLabel = menuMatch?.topMenu.label ?? "사역/선교";
  const pageTitle = menuMatch?.node.label ?? "선교보고";

  // 필터 적용
  const filtered = reports.filter((r) => {
    const continentOk = selectedContinent === "all" || r.missionary.continent === selectedContinent;
    const missionaryOk = selectedMissionary === "all" || r.missionaryId === selectedMissionary;
    const statusOk = !canManage || selectedStatus === "all" || r.status === selectedStatus;
    return continentOk && missionaryOk && statusOk;
  });

  const reportStatusCounts = useMemo(() => ({
    all: reports.length,
    pending: reports.filter((report) => report.status === "pending").length,
    published: reports.filter((report) => report.status === "published").length,
    rejected: reports.filter((report) => report.status === "rejected").length,
    draft: reports.filter((report) => report.status === "draft").length,
  }), [reports]);

  const statusFilters: Array<{ value: "all" | "pending" | "published" | "rejected" | "draft"; label: string }> = [
    { value: "all", label: "전체" },
    { value: "pending", label: "승인 대기" },
    { value: "published", label: "공개" },
    { value: "rejected", label: "반려" },
    { value: "draft", label: "숨김" },
  ];

  const activeMissionaries = useMemo(() => {
    const map = new Map<number, (typeof missionaries)[number]>();
    missionaries.forEach((missionary) => map.set(missionary.id, missionary));
    reports.forEach((report) => map.set(report.missionary.id, report.missionary));
    return Array.from(map.values());
  }, [missionaries, reports]);

  const continents: Array<{ value: MissionContinent | "all"; label: string }> = [
    { value: "all", label: "전체 지역" },
    ...Object.entries(CONTINENT_LABELS).map(([k, v]) => ({ value: k as MissionContinent, label: v })),
  ];

  return (
    <SubPageLayout
      pageTitle={pageTitle}
      parentLabel={parentLabel}
      sideMenuItems={sideMenuItems}
    >
      <div className="space-y-6">
        <section className="rounded-2xl border border-gray-200 bg-white p-5 md:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-3">
              <div>
                <p className="text-sm font-medium text-[#1B5E20]">선교 현장 소식</p>
                <p className="mt-2 text-sm leading-6 text-gray-500">
                  기쁨의교회가 파송하고 후원하는 선교사님들의 현장 이야기와 기도 제목을 함께 나눕니다.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-xl bg-[#F7F7F5] px-4 py-3">
                  <p className="text-xs text-gray-400">선교 협력</p>
                  <p className="mt-1 text-2xl font-bold text-[#1B5E20]">{activeMissionaries.length}</p>
                </div>
                <div className="rounded-xl bg-[#F7F7F5] px-4 py-3">
                  <p className="text-xs text-gray-400">사역 지역</p>
                  <p className="mt-1 text-2xl font-bold text-[#1B5E20]">{new Set(activeMissionaries.map((m) => m.region.split(" ")[0])).size}</p>
                </div>
                <div className="rounded-xl bg-[#F7F7F5] px-4 py-3">
                  <p className="text-xs text-gray-400">총 선교보고</p>
                  <p className="mt-1 text-2xl font-bold text-[#1B5E20]">{reports.length}</p>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {canWriteMissionReport && (
                <Link href="/mission/write" className="inline-flex h-10 items-center justify-center gap-1.5 rounded-full bg-[#1B5E20] px-4 text-sm font-medium text-white transition-colors hover:bg-[#2E7D32]">
                  <i className="fas fa-pen text-[10px]"></i>
                  {canManage ? "선교보고서 작성" : "선교보고 작성"}
                </Link>
              )}
            </div>
          </div>
        </section>

        {canManage && (
          <section className="rounded-2xl border border-[#C8E6C9] bg-[#F7FCF7] p-5 md:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm font-bold text-[#1B5E20]">선교보고 검토함</p>
                <p className="mt-1 text-sm text-gray-500">승인 대기 글을 먼저 확인하고, 각 카드에서 바로 공개하거나 반려할 수 있습니다.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {statusFilters.map((filter) => (
                  <button
                    key={filter.value}
                    type="button"
                    onClick={() => setSelectedStatus(filter.value)}
                    className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                      selectedStatus === filter.value
                        ? "border-[#1B5E20] bg-[#1B5E20] text-white"
                        : "border-[#B7DDBA] bg-white text-[#1B5E20] hover:bg-[#E8F5E9]"
                    }`}
                  >
                    {filter.label} {reportStatusCounts[filter.value]}건
                  </button>
                ))}
              </div>
            </div>
          </section>
        )}

        <section className="rounded-2xl border border-gray-200 bg-white p-5 md:p-6">
          <p className="text-xs text-gray-400 font-medium mb-4 uppercase tracking-wider">선교 협력</p>
          <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
            <button
              onClick={() => setSelectedMissionary("all")}
              className={`flex-shrink-0 flex flex-col items-center gap-2 px-4 py-2 rounded-xl transition-all ${
                selectedMissionary === "all"
                  ? "bg-[#1B5E20] text-white"
                  : "bg-gray-50 text-gray-600 hover:bg-[#E8F5E9]"
              }`}
            >
              <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center">
                <i className="fas fa-globe text-gray-500"></i>
              </div>
              <span className="text-xs font-medium whitespace-nowrap">전체</span>
            </button>
            {activeMissionaries.map((m) => (
              <button
                key={m.id}
                onClick={() => setSelectedMissionary(m.id)}
                className={`flex-shrink-0 flex flex-col items-center gap-2 px-4 py-2 rounded-xl transition-all ${
                  selectedMissionary === m.id
                    ? "bg-[#1B5E20] text-white"
                    : "bg-gray-50 text-gray-600 hover:bg-[#E8F5E9]"
                }`}
              >
                <img
                  src={m.profileImage ?? "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&q=80"}
                  alt={m.name}
                  className="w-12 h-12 rounded-full object-cover border-2 border-white"
                 loading="lazy"/>
                <span className="text-xs font-medium whitespace-nowrap">{m.name.replace(" 선교사", "")}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-5 md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap gap-2">
              {continents.map((c) => (
                <button
                  key={c.value}
                  onClick={() => setSelectedContinent(c.value)}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all border ${
                    selectedContinent === c.value
                      ? "bg-[#1B5E20] text-white border-[#1B5E20]"
                      : "bg-white text-gray-600 border-gray-200 hover:border-[#1B5E20] hover:text-[#1B5E20]"
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
            <p className="text-sm text-gray-500">
              총 <span className="font-semibold text-[#1B5E20]">{filtered.length}</span>건의 선교보고
            </p>
          </div>
        </section>

        <section>
          {isLoading ? (
            <div className="text-center py-24 text-gray-400">
              <i className="fas fa-spinner fa-spin text-4xl mb-4 block"></i>
              <p>선교보고를 불러오는 중입니다.</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-24 text-gray-400">
              <i className="fas fa-search text-4xl mb-4 block"></i>
              <p>{reports.length === 0 ? "등록된 선교보고가 없습니다." : "해당 조건의 선교보고가 없습니다."}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {filtered.map((report) => (
                <Link key={report.id} href={`/mission/${report.id}`}>
                  <article className={`bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300 cursor-pointer group ${canManage && report.status !== "published" ? "opacity-75 ring-1 ring-gray-200" : ""}`}>
                    <div className="relative h-52 overflow-hidden">
                      <img
                        src={report.thumbnailUrl ?? report.images[0] ?? "https://images.unsplash.com/photo-1555636222-cae831e670b3?w=600&q=80"}
                        alt={report.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                       loading="lazy"/>
                      <span className="absolute top-3 left-3 bg-[#1B5E20]/90 text-white text-xs px-2.5 py-1 rounded-full">
                        {CONTINENT_LABELS[report.missionary.continent]}
                      </span>
                      {canManage && report.status !== "published" && (
                        <span className="absolute top-3 right-3 rounded-full bg-gray-900/80 px-2.5 py-1 text-[11px] font-semibold text-white">
                          {report.status === "draft" ? "숨김" : report.status === "pending" ? "검토 대기" : "반려"}
                        </span>
                      )}
                      {canManage && (
                        <div className="absolute bottom-3 right-3 flex flex-wrap justify-end gap-2 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100">
                          {report.status !== "published" && (
                            <button
                              type="button"
                              disabled={reviewReport.isPending}
                              onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                reviewReport.mutate({ id: report.id, status: "published" });
                              }}
                              className="rounded-full bg-[#1B5E20] px-3 py-1.5 text-xs font-semibold text-white shadow hover:bg-[#2E7D32] disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              공개
                            </button>
                          )}
                          {report.status === "pending" && (
                            <button
                              type="button"
                              disabled={reviewReport.isPending}
                              onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                if (!window.confirm(`\"${report.title}\" 선교보고를 반려할까요?`)) return;
                                reviewReport.mutate({ id: report.id, status: "rejected" });
                              }}
                              className="rounded-full bg-white/95 px-3 py-1.5 text-xs font-semibold text-red-600 shadow hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              반려
                            </button>
                          )}
                          {report.status === "published" && (
                            <button
                              type="button"
                              disabled={reviewReport.isPending}
                              onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                reviewReport.mutate({ id: report.id, status: "draft" });
                              }}
                              className="rounded-full bg-white/95 px-3 py-1.5 text-xs font-semibold text-gray-700 shadow hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              숨김
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              navigate(`/mission/edit/${report.id}`);
                            }}
                            className="rounded-full bg-white/95 px-3 py-1.5 text-xs font-semibold text-[#1B5E20] shadow hover:bg-white"
                          >
                            수정
                          </button>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              if (!window.confirm(`"${report.title}" 선교보고를 삭제할까요?`)) return;
                              deleteReport.mutate({ id: report.id });
                            }}
                            className="rounded-full bg-white/95 px-3 py-1.5 text-xs font-semibold text-red-600 shadow hover:bg-white"
                          >
                            삭제
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="p-5">
                      <div className="flex items-center gap-3 mb-3">
                        <img
                          src={report.missionary.profileImage ?? "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&q=80"}
                          alt={report.missionary.name}
                          className="w-9 h-9 rounded-full object-cover border-2 border-[#E8F5E9]"
                         loading="lazy"/>
                        <div>
                          <p className="text-sm font-semibold text-gray-800">{report.missionary.name}</p>
                          <p className="text-xs text-gray-400">{report.missionary.region}</p>
                        </div>
                        <span className="ml-auto text-xs text-gray-400">{formatDate(report.reportDate)}</span>
                      </div>
                      <h2
                        className="text-base font-bold text-gray-800 mb-2 leading-snug group-hover:text-[#1B5E20] transition-colors line-clamp-2"
                        style={{ fontFamily: "'Noto Serif KR', serif" }}
                      >
                        {report.title}
                      </h2>
                      <p className="text-sm text-gray-500 leading-relaxed line-clamp-2">{report.summary}</p>
                      <div className="mt-4 pt-4 border-t border-gray-100 flex items-center gap-1.5 text-xs text-[#1B5E20]">
                        <i className="fas fa-hands-praying"></i>
                        <span>기도제목 {report.prayerTopics.length}개</span>
                        <span className="ml-auto text-gray-400 group-hover:text-[#1B5E20] transition-colors">
                          자세히 보기 →
                        </span>
                      </div>
                    </div>
                  </article>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="bg-[#1B5E20] rounded-2xl px-6 py-5 text-white">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-xl font-bold" style={{ fontFamily: "'Noto Serif KR', serif" }}>
                선교사님들을 위해 기도해 주세요
              </h3>
              <p className="text-green-200 text-sm mt-1">여러분의 기도가 세계 선교의 힘이 됩니다.</p>
            </div>
            <div className="flex items-center gap-2 text-sm text-green-100">
              <i className="fas fa-hands-praying"></i>
              함께 중보하기
            </div>
          </div>
        </section>
      </div>
    </SubPageLayout>
  );
}
