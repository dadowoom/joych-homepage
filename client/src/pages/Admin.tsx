/**
 * 기쁨의교회 CMS 관리자 대시보드
 * ─────────────────────────────────────────────────────────────────────────────
 * 관리자(admin) 권한이 있는 사용자만 접근 가능합니다.
 *
 * 탭 구성:
 *   - 기본 정보    : components/admin/SettingsTab.tsx
 *   - 시설 관리    : components/AdminFacilitiesTab.tsx
 *   - 예약 승인    : components/AdminReservationsTab.tsx
 *   - 선택지 관리  : components/AdminMemberOptionsTab.tsx
 *   - 성도 관리    : components/AdminMembersTab.tsx
 *   - 섬기는 분 관리: components/AdminStaffTab.tsx
 *   - 예배영상 관리: components/YoutubeAdminTab.tsx
 *   - 생선 간증 관리: components/AdminTestimoniesTab.tsx
 *   - 팝업 관리    : components/AdminPopupsTab.tsx
 *   - 접수 관리    : components/AdminSupportRequestsTab.tsx
 *   - 강좌 관리    : components/AdminCoursesTab.tsx
 *   - 주보 관리    : components/AdminBulletinsTab.tsx
 */

import { useState } from "react";
import { Link, useSearch, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useIsMobile } from "@/hooks/useMobile";
import AdminFacilitiesTab from "@/components/AdminFacilitiesTab";
import AdminReservationsTab from "@/components/AdminReservationsTab";
import AdminMemberOptionsTab from "@/components/AdminMemberOptionsTab";
import AdminMembersTab from "@/components/AdminMembersTab";
import AdminMissionReportsTab from "@/components/AdminMissionReportsTab";
import AdminPopupsTab from "@/components/AdminPopupsTab";
import AdminFreeBoardTab from "@/components/AdminFreeBoardTab";
import AdminStaffTab from "@/components/AdminStaffTab";
import AdminSupportRequestsTab from "@/components/AdminSupportRequestsTab";
import AdminTestimoniesTab from "@/components/AdminTestimoniesTab";
import AdminCoursesTab from "@/components/AdminCoursesTab";
import AdminBulletinsTab from "@/components/AdminBulletinsTab";
import AdminPermissionsTab from "@/components/AdminPermissionsTab";
import AdminMenuAccessTab from "@/components/AdminMenuAccessTab";
import YoutubeAdminTab from "@/components/YoutubeAdminTab";
import { SettingsTab } from "@/components/admin/SettingsTab";
import {
  canManageAdminTab,
  canManageAnyContent,
  canManageFullAdmin,
} from "@/lib/contentPermissions";

// ─── 탭 타입 ──────────────────────────────────────────────────────────────────
type Tab =
  | "settings"
  | "facilities"
  | "facilitySchedule"
  | "reservations"
  | "memberOptions"
  | "members"
  | "staff"
  | "missionReports"
  | "testimonies"
  | "freeBoard"
  | "supportRequests"
  | "courses"
  | "bulletins"
  | "youtube"
  | "popups"
  | "menuAccess"
  | "permissions";

type TabItem = {
  id: Tab;
  label: string;
  icon: string;
  description: string;
  status: string;
};

type TabGroup = {
  title: string;
  description: string;
  tabs: Tab[];
};

const TABS: TabItem[] = [
  {
    id: "settings",
    label: "기본 정보",
    icon: "fa-cog",
    description:
      "교회명, 연락처, 주소 등 홈페이지의 기본 운영 정보를 관리합니다.",
    status: "운영 기준",
  },
  {
    id: "memberOptions",
    label: "선택지 관리",
    icon: "fa-list-ul",
    description:
      "성도 등록과 사역 분류에 사용되는 공통 선택 항목을 정리합니다.",
    status: "입력 항목",
  },
  {
    id: "permissions",
    label: "관리 권한",
    icon: "fa-key",
    description: "성도 계정별 게시판, 갤러리, 접수 관리 권한을 배정합니다.",
    status: "권한 배정",
  },
  {
    id: "menuAccess",
    label: "메뉴 읽기 권한",
    icon: "fa-eye",
    description: "최하위 메뉴별로 타교인과 로그인 성도의 읽기 권한을 설정합니다.",
    status: "읽기 권한",
  },
  {
    id: "youtube",
    label: "예배영상 관리",
    icon: "fa-video",
    description: "홈페이지에 노출되는 예배 영상과 유튜브 콘텐츠를 관리합니다.",
    status: "영상 노출",
  },
  {
    id: "testimonies",
    label: "생선 간증 관리",
    icon: "fa-comments",
    description: "생명의 삶 나눔과 간증 콘텐츠의 게시 정보를 관리합니다.",
    status: "검수/게시",
  },
  {
    id: "freeBoard",
    label: "자유게시판 관리",
    icon: "fa-clipboard-list",
    description: "성도가 작성한 자유게시판 글의 공개, 숨김, 삭제 상태를 관리합니다.",
    status: "게시 관리",
  },
  {
    id: "popups",
    label: "팝업 관리",
    icon: "fa-bullhorn",
    description:
      "주요 공지, 행사 안내 등 방문자에게 먼저 보여줄 팝업을 설정합니다.",
    status: "공지 노출",
  },
  {
    id: "members",
    label: "성도 관리",
    icon: "fa-users",
    description: "성도 정보와 등록 데이터를 확인하고 관리합니다.",
    status: "성도 데이터",
  },
  {
    id: "staff",
    label: "섬기는 분 관리",
    icon: "fa-user-tie",
    description: "교역자와 섬김이 소개 정보를 관리합니다.",
    status: "사역 소개",
  },
  {
    id: "missionReports",
    label: "선교보고 관리",
    icon: "fa-globe-asia",
    description: "선교 소식과 보고 콘텐츠를 정리합니다.",
    status: "선교 소식",
  },
  {
    id: "facilities",
    label: "시설 관리",
    icon: "fa-building",
    description: "예약 가능한 공간과 시설 운영 정보를 관리합니다.",
    status: "예약 자원",
  },
  {
    id: "facilitySchedule",
    label: "시설 스케줄",
    icon: "fa-clock",
    description: "하영인관과 복지관의 공통 예약 가능 시간을 일괄 적용합니다.",
    status: "일괄 시간",
  },
  {
    id: "reservations",
    label: "예약 승인",
    icon: "fa-calendar-check",
    description: "시설 예약 요청을 확인하고 승인 흐름을 처리합니다.",
    status: "승인 처리",
  },
  {
    id: "supportRequests",
    label: "접수 관리",
    icon: "fa-inbox",
    description: "홈페이지를 통해 접수된 문의와 요청을 확인합니다.",
    status: "접수 확인",
  },
  {
    id: "bulletins",
    label: "주보 관리",
    icon: "fa-newspaper",
    description: "주보 파일을 등록하고 공개 상태를 관리합니다.",
    status: "자료 등록",
  },
  {
    id: "courses",
    label: "강좌 관리",
    icon: "fa-graduation-cap",
    description: "교육/강좌를 등록하고 성도 신청 내역을 관리합니다.",
    status: "신청 관리",
  },
];

const TAB_GROUPS: TabGroup[] = [
  {
    title: "운영 설정",
    description: "관리 기준과 입력 항목",
    tabs: ["settings", "memberOptions", "permissions", "menuAccess"],
  },
  {
    title: "콘텐츠/노출 관리",
    description: "홈페이지에 공개되는 자료",
    tabs: ["youtube", "bulletins", "testimonies", "freeBoard", "popups"],
  },
  {
    title: "성도/사역 관리",
    description: "성도, 섬김이, 선교 소식",
    tabs: ["members", "staff", "missionReports"],
  },
  {
    title: "접수/예약 관리",
    description: "시설과 요청 처리",
    tabs: ["facilities", "facilitySchedule", "reservations", "supportRequests", "courses"],
  },
];

const TABS_BY_ID = TABS.reduce(
  (acc, tab) => {
    acc[tab.id] = tab;
    return acc;
  },
  {} as Record<Tab, TabItem>
);

const VALID_TABS: Tab[] = TABS.map(tab => tab.id);

function AdminMobileBlocked() {
  return (
    <div
      className="min-h-screen flex items-center justify-center bg-gray-50 px-4"
      style={{ fontFamily: "'Noto Sans KR', sans-serif" }}
    >
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 text-center shadow-lg">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#E8F5E9] text-[#1B5E20]">
          <i className="fas fa-desktop text-xl"></i>
        </div>
        <h1
          className="text-xl font-bold text-gray-900"
          style={{ fontFamily: "'Noto Serif KR', serif" }}
        >
          PC에서 접속해주세요
        </h1>
        <p className="mt-3 text-sm leading-6 text-gray-500">
          관리자 페이지는 안정적인 운영을 위해 PC 화면에서만 사용할 수 있습니다.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex h-10 items-center justify-center rounded-lg border border-gray-200 px-4 text-sm text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-700"
        >
          홈페이지로 돌아가기
        </Link>
      </div>
    </div>
  );
}

// ─── 메인 관리자 페이지 ───────────────────────────────────────────────────────
export default function AdminPage() {
  const { user, loading } = useAuth();
  const isMobile = useIsMobile();
  const searchString = useSearch();
  const [, setLocation] = useLocation();

  const searchParams = new URLSearchParams(searchString);
  const tabFromUrl = searchParams.get("tab") as Tab | null;
  const requestedTab: Tab | null =
    tabFromUrl && VALID_TABS.includes(tabFromUrl) ? tabFromUrl : null;
  const setActiveTab = (tab: Tab) =>
    setLocation(`/admin_joych_2026?tab=${tab}`);

  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [failCount, setFailCount] = useState(() => {
    const saved = localStorage.getItem("admin_fail_count");
    return saved ? parseInt(saved, 10) : 0;
  });
  const [collapsedMenuGroups, setCollapsedMenuGroups] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(TAB_GROUPS.map((group) => [group.title, true])),
  );
  const toggleMenuGroup = (title: string) => {
    setCollapsedMenuGroups(prev => ({
      ...prev,
      [title]: !prev[title],
    }));
  };

  const adminLoginMutation = trpc.auth.adminLogin.useMutation({
    onSuccess: () => {
      localStorage.removeItem("admin_fail_count");
      localStorage.removeItem("admin_lock_until");
      setFailCount(0);
      // 쿠키가 브라우저에 저장된 후 홈으로 이동 (즉시 이동하면 세션 인식 실패)
      setTimeout(() => {
        window.location.href = "/";
      }, 300);
    },
    onError: error => {
      const isRateLimited =
        error.message.includes("잠시 제한") ||
        error.message.includes("시도가 너무 많");
      if (isRateLimited) {
        setLoginError(error.message);
        return;
      }

      const newCount = failCount + 1;
      setFailCount(newCount);
      localStorage.setItem("admin_fail_count", String(newCount));
      setLoginError(
        `아이디 또는 비밀번호가 올바르지 않습니다. (${Math.min(newCount, 9)}/10회 실패)`
      );
    },
  });

  if (isMobile) {
    return <AdminMobileBlocked />;
  }

  // ── 로딩 중 ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[#1B5E20] border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-gray-500 text-sm">로딩 중...</p>
        </div>
      </div>
    );
  }

  // ── 로그인 안 된 경우 → ID/PW 폼 표시 ─────────────────────────────────────
  if (!user) {
    return (
      <div
        className="min-h-screen flex items-center justify-center bg-gray-50"
        style={{ fontFamily: "'Noto Sans KR', sans-serif" }}
      >
        <div className="bg-white rounded-2xl shadow-lg max-w-sm w-full mx-4 p-8">
          {/* 로고 */}
          <div className="text-center mb-8">
            <div className="text-[#1B5E20] text-4xl mb-3">
              <i className="fas fa-church"></i>
            </div>
            <h1
              className="text-xl font-bold text-gray-900"
              style={{ fontFamily: "'Noto Serif KR', serif" }}
            >
              기쁨의교회
            </h1>
            <p className="text-sm text-gray-500 mt-1">관리자 로그인</p>
          </div>

          {/* 로그인 폼 */}
          <form
            onSubmit={e => {
              e.preventDefault();
              setLoginError("");
              adminLoginMutation.mutate({
                username: loginUsername,
                password: loginPassword,
              });
            }}
            className="space-y-4"
          >
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                아이디
              </label>
              <input
                type="text"
                value={loginUsername}
                onChange={e => setLoginUsername(e.target.value)}
                placeholder="아이디를 입력하세요"
                required
                className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B5E20] focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                비밀번호
              </label>
              <input
                type="password"
                value={loginPassword}
                onChange={e => setLoginPassword(e.target.value)}
                placeholder="비밀번호를 입력하세요"
                required
                className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B5E20] focus:border-transparent"
              />
            </div>

            {loginError && (
              <p className="text-red-500 text-sm text-center">{loginError}</p>
            )}

            <button
              type="submit"
              disabled={adminLoginMutation.isPending}
              className="w-full py-3 bg-[#1B5E20] text-white rounded-lg font-medium hover:bg-[#2E7D32] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {adminLoginMutation.isPending ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  로그인 중...
                </span>
              ) : (
                "로그인"
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <Link
              href="/"
              className="text-sm text-gray-400 hover:text-gray-600"
            >
              ← 홈페이지로 돌아가기
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── 관리자 권한 없는 경우 ──────────────────────────────────────────────────
  if (!canManageAnyContent(user)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-sm mx-auto p-8">
          <div className="text-red-400 text-5xl mb-4">
            <i className="fas fa-ban"></i>
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">
            접근 권한 없음
          </h2>
          <p className="text-gray-500 text-sm mb-6">
            관리자 권한이 없습니다. 담당자에게 문의해주세요.
          </p>
          <Link href="/" className="text-sm text-gray-400 hover:text-gray-600">
            ← 홈페이지로 돌아가기
          </Link>
        </div>
      </div>
    );
  }

  const permittedTabs = VALID_TABS.filter((tab) =>
    tab === "facilitySchedule"
      ? canManageAdminTab(user, "facilities")
      : canManageAdminTab(user, tab)
  );
  if (permittedTabs.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md mx-auto rounded-2xl bg-white p-8 shadow-sm">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#E8F5E9] text-[#1B5E20]">
            <i className="fas fa-key text-xl"></i>
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">
            페이지별 관리 권한만 있습니다
          </h2>
          <p className="text-gray-500 text-sm leading-6 mb-6">
            이 계정은 특정 게시판이나 갤러리 화면에서 직접 글쓰기, 사진 업로드, 수정 버튼을 사용할 수 있습니다.
            홈페이지 메뉴에서 담당 화면으로 이동해주세요.
          </p>
          <Link href="/" className="text-sm text-gray-400 hover:text-gray-600">
            ← 홈페이지로 돌아가기
          </Link>
        </div>
      </div>
    );
  }

  const activeTab: Tab =
    requestedTab && permittedTabs.includes(requestedTab)
      ? requestedTab
      : (permittedTabs[0] ?? "youtube");
  const visibleTabGroups = TAB_GROUPS.map((group) => ({
    ...group,
    tabs: group.tabs.filter((tab) => permittedTabs.includes(tab)),
  })).filter((group) => group.tabs.length > 0);
  const activeTabInfo = TABS_BY_ID[activeTab];
  const activeGroup = TAB_GROUPS.find(group => group.tabs.includes(activeTab));

  return (
    <div
      className="min-h-screen bg-gray-50"
      style={{ fontFamily: "'Noto Sans KR', sans-serif" }}
    >
      {/* 헤더 */}
      <header className="bg-[#0F172A] text-white px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/"
              className="text-[#A5D6A7] hover:text-white transition-colors"
            >
              <i className="fas fa-arrow-left mr-2"></i>홈페이지
            </Link>
            <span className="text-gray-600">|</span>
            <span
              className="font-bold text-[#A5D6A7]"
              style={{ fontFamily: "'Noto Serif KR', serif" }}
            >
              기쁨의교회 관리자
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-gray-400">
              {user.name ?? user.email ?? "관리자"}
            </span>
            <span className="text-xs bg-[#1B5E20] px-2 py-0.5 rounded">
              {canManageFullAdmin(user) ? "admin" : "manager"}
            </span>
            <button
              onClick={() => {
                fetch("/api/trpc/auth.logout", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  credentials: "include",
                  body: JSON.stringify({ "0": { json: null } }),
                }).then(() => {
                  window.location.reload();
                });
              }}
              className="text-xs text-gray-400 hover:text-red-400 transition-colors px-2 py-1 rounded hover:bg-white/10"
            >
              로그아웃
            </button>
          </div>
        </div>
      </header>

      {/* 본문 */}
      <div className="max-w-7xl mx-auto px-4 py-6 sm:py-8">
        <div className="mb-6">
          <h1
            className="text-2xl font-bold text-gray-900"
            style={{ fontFamily: "'Noto Serif KR', serif" }}
          >
            콘텐츠 관리
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            홈페이지에 표시되는 내용을 관리합니다.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)] lg:items-start">
          {/* 업무 그룹 내비게이션 */}
          <aside className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm lg:sticky lg:top-6 lg:flex lg:max-h-[calc(100vh-3rem)] lg:flex-col lg:overflow-hidden">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-[#0F172A]">업무 메뉴</h2>
                <p className="text-xs text-gray-500">
                  자주 쓰는 흐름대로 묶었습니다.
                </p>
              </div>
              <span className="rounded-full bg-[#E8F5E9] px-2.5 py-1 text-xs font-semibold text-[#1B5E20]">
                {permittedTabs.length}개
              </span>
            </div>

            <nav className="flex gap-3 overflow-x-auto pb-1 lg:block lg:min-h-0 lg:flex-1 lg:space-y-5 lg:overflow-x-hidden lg:overflow-y-auto lg:pb-0 lg:pr-1">
              {visibleTabGroups.map(group => {
                const isCollapsed = collapsedMenuGroups[group.title] ?? false;
                const hasActiveTab = group.tabs.includes(activeTab);

                return (
                  <section
                    key={group.title}
                    className={`min-w-[240px] rounded-lg border p-3 lg:min-w-0 ${
                      hasActiveTab
                        ? "border-[#A5D6A7] bg-[#F1F8F2]"
                        : "border-gray-100 bg-gray-50/70"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => toggleMenuGroup(group.title)}
                      aria-expanded={!isCollapsed}
                      className="mb-2 flex w-full items-start justify-between gap-3 rounded-md text-left"
                    >
                      <span>
                        <span className="block text-xs font-bold text-gray-800">
                          {group.title}
                        </span>
                        <span className="block text-[11px] leading-4 text-gray-500">
                          {group.description}
                        </span>
                      </span>
                      <span className="mt-0.5 flex shrink-0 items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-[#1B5E20] shadow-sm">
                        {group.tabs.length}개
                        <i className={`fas fa-chevron-${isCollapsed ? "down" : "up"} text-[10px] text-gray-400`}></i>
                      </span>
                    </button>
                    {!isCollapsed && (
                      <div className="space-y-1">
                        {group.tabs.map(tabId => {
                          const tab = TABS_BY_ID[tabId];
                          const isActive = activeTab === tab.id;

                          return (
                            <button
                              key={tab.id}
                              onClick={() => setActiveTab(tab.id)}
                              className={`flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm transition-colors ${
                                isActive
                                  ? "bg-[#1B5E20] text-white shadow-sm"
                                  : "text-gray-700 hover:bg-white hover:text-[#1B5E20]"
                              }`}
                            >
                              <span
                                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${
                                  isActive
                                    ? "bg-white/15 text-[#A5D6A7]"
                                    : "bg-white text-[#1B5E20]"
                                }`}
                              >
                                <i className={`fas ${tab.icon} text-xs`}></i>
                              </span>
                              <span className="min-w-0">
                                <span className="block font-semibold leading-5">
                                  {tab.label}
                                </span>
                                <span
                                  className={`block truncate text-xs ${
                                    isActive ? "text-[#D7F0D8]" : "text-gray-500"
                                  }`}
                                >
                                  {tab.status}
                                </span>
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </section>
                );
              })}
            </nav>
          </aside>

          <main className="min-w-0 space-y-5">
            {/* 선택 탭 요약 */}
            <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[#E8F5E9] text-[#1B5E20]">
                    <i className={`fas ${activeTabInfo.icon}`}></i>
                  </div>
                  <div>
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-[#0F172A] px-2.5 py-1 text-xs font-semibold text-white">
                        {activeGroup?.title ?? "관리 메뉴"}
                      </span>
                      <span className="rounded-full border border-[#A5D6A7] bg-[#F1F8F2] px-2.5 py-1 text-xs font-semibold text-[#1B5E20]">
                        {activeTabInfo.status}
                      </span>
                    </div>
                    <h2
                      className="text-xl font-bold text-gray-900"
                      style={{ fontFamily: "'Noto Serif KR', serif" }}
                    >
                      {activeTabInfo.label}
                    </h2>
                    <p className="mt-1 max-w-2xl text-sm leading-6 text-gray-600">
                      {activeTabInfo.description}
                    </p>
                  </div>
                </div>
                <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600 sm:min-w-[150px]">
                  <span className="block text-xs font-semibold text-gray-400">
                    현재 화면
                  </span>
                  <span className="mt-1 block font-bold text-[#0F172A]">
                    활성화됨
                  </span>
                </div>
              </div>
            </section>

            {/* 탭 콘텐츠 */}
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
              {activeTab === "settings" && <SettingsTab />}
              {activeTab === "facilities" && <AdminFacilitiesTab />}
              {activeTab === "facilitySchedule" && <AdminFacilitiesTab mode="buildingSchedule" />}
              {activeTab === "reservations" && <AdminReservationsTab />}
              {activeTab === "memberOptions" && <AdminMemberOptionsTab />}
              {activeTab === "permissions" && <AdminPermissionsTab />}
              {activeTab === "menuAccess" && <AdminMenuAccessTab />}
              {activeTab === "members" && <AdminMembersTab />}
              {activeTab === "staff" && <AdminStaffTab />}
              {activeTab === "missionReports" && <AdminMissionReportsTab />}
              {activeTab === "testimonies" && <AdminTestimoniesTab />}
              {activeTab === "freeBoard" && <AdminFreeBoardTab />}
              {activeTab === "supportRequests" && <AdminSupportRequestsTab />}
              {activeTab === "courses" && <AdminCoursesTab />}
              {activeTab === "bulletins" && <AdminBulletinsTab />}
              {activeTab === "youtube" && <YoutubeAdminTab />}
              {activeTab === "popups" && <AdminPopupsTab />}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
