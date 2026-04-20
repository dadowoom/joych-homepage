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
 *   - 예배영상 관리: components/YoutubeAdminTab.tsx
 */

import { useState } from "react";
import { Link, useSearch, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import AdminFacilitiesTab from "@/components/AdminFacilitiesTab";
import AdminReservationsTab from "@/components/AdminReservationsTab";
import AdminMemberOptionsTab from "@/components/AdminMemberOptionsTab";
import AdminMembersTab from "@/components/AdminMembersTab";
import YoutubeAdminTab from "@/components/YoutubeAdminTab";
import { SettingsTab } from "@/components/admin/SettingsTab";

// ─── 탭 타입 ──────────────────────────────────────────────────────────────────
type Tab =
  | "settings"
  | "facilities"
  | "reservations"
  | "memberOptions"
  | "members"
  | "youtube";

// ─── 메인 관리자 페이지 ───────────────────────────────────────────────────────
export default function AdminPage() {
  const { user, loading } = useAuth();
  const searchString = useSearch();
  const [, setLocation] = useLocation();

  const searchParams = new URLSearchParams(searchString);
  const VALID_TABS: Tab[] = [
    "settings",
    "facilities",
    "reservations",
    "memberOptions",
    "members",
    "youtube",
  ];
  const tabFromUrl = searchParams.get("tab") as Tab | null;
  const activeTab: Tab =
    tabFromUrl && VALID_TABS.includes(tabFromUrl) ? tabFromUrl : "settings";
  const setActiveTab = (tab: Tab) =>
    setLocation(`/admin_joych_2026?tab=${tab}`);

  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [failCount, setFailCount] = useState(() => {
    const saved = localStorage.getItem("admin_fail_count");
    return saved ? parseInt(saved, 10) : 0;
  });
  const [lockUntil, setLockUntil] = useState<number | null>(() => {
    const saved = localStorage.getItem("admin_lock_until");
    return saved ? parseInt(saved, 10) : null;
  });

  const isLocked = lockUntil !== null && Date.now() < lockUntil;
  const lockRemainMin = isLocked
    ? Math.ceil((lockUntil! - Date.now()) / 60000)
    : 0;

  const adminLoginMutation = trpc.auth.adminLogin.useMutation({
    onSuccess: () => {
      localStorage.removeItem("admin_fail_count");
      localStorage.removeItem("admin_lock_until");
      setFailCount(0);
      setLockUntil(null);
      window.location.href = "/";
    },
    onError: () => {
      const newCount = failCount + 1;
      setFailCount(newCount);
      localStorage.setItem("admin_fail_count", String(newCount));
      if (newCount >= 5) {
        const until = Date.now() + 30 * 60 * 1000;
        setLockUntil(until);
        localStorage.setItem("admin_lock_until", String(until));
        localStorage.setItem("admin_fail_count", "0");
        setFailCount(0);
        setLoginError(
          "로그인 시도 횟수를 초과했습니다. 30분 후 다시 시도해 주세요."
        );
      } else {
        setLoginError(
          `아이디 또는 비밀번호가 올바르지 않습니다. (${newCount}/5회 실패)`
        );
      }
    },
  });

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
            onSubmit={(e) => {
              e.preventDefault();
              if (isLocked) {
                setLoginError(
                  `로그인이 잠겨 있습니다. ${lockRemainMin}분 후 다시 시도해 주세요.`
                );
                return;
              }
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
                onChange={(e) => setLoginUsername(e.target.value)}
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
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="비밀번호를 입력하세요"
                required
                className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B5E20] focus:border-transparent"
              />
            </div>

            {loginError && (
              <p className="text-red-500 text-sm text-center">{loginError}</p>
            )}

            {isLocked && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-center">
                <p className="text-red-600 text-sm font-medium">로그인 잠금</p>
                <p className="text-red-500 text-xs mt-1">
                  실패 5회 초과 — {lockRemainMin}분 후 다시 시도하세요
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={adminLoginMutation.isPending || isLocked}
              className="w-full py-3 bg-[#1B5E20] text-white rounded-lg font-medium hover:bg-[#2E7D32] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {adminLoginMutation.isPending ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  로그인 중...
                </span>
              ) : isLocked ? (
                `${lockRemainMin}분 후 재시도`
              ) : (
                "로그인"
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <Link href="/" className="text-sm text-gray-400 hover:text-gray-600">
              ← 홈페이지로 돌아가기
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── 관리자 권한 없는 경우 ──────────────────────────────────────────────────
  if (user.role !== "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-sm mx-auto p-8">
          <div className="text-red-400 text-5xl mb-4">
            <i className="fas fa-ban"></i>
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">접근 권한 없음</h2>
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

  // ── 탭 목록 ────────────────────────────────────────────────────────────────
  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: "settings", label: "기본 정보", icon: "fa-cog" },
    { id: "facilities", label: "시설 관리", icon: "fa-building" },
    { id: "reservations", label: "예약 승인", icon: "fa-calendar-check" },
    { id: "memberOptions", label: "선택지 관리", icon: "fa-list-ul" },
    { id: "members", label: "성도 관리", icon: "fa-users" },
    { id: "youtube", label: "예배영상 관리", icon: "fa-video" },
  ];

  return (
    <div
      className="min-h-screen bg-gray-50"
      style={{ fontFamily: "'Noto Sans KR', sans-serif" }}
    >
      {/* 헤더 */}
      <header className="bg-[#0F172A] text-white px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-[#A5D6A7] hover:text-white transition-colors">
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
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-400">
            {user.name ?? user.email ?? "관리자"}
          </span>
          <span className="text-xs bg-[#1B5E20] px-2 py-0.5 rounded">admin</span>
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
      </header>

      {/* 본문 */}
      <div className="max-w-6xl mx-auto px-4 py-8">
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

        {/* 탭 메뉴 */}
        <div className="flex gap-1 bg-white border border-gray-200 rounded-lg p-1 mb-6 w-fit flex-wrap">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? "bg-[#1B5E20] text-white"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              <i className={`fas ${tab.icon} text-xs`}></i>
              {tab.label}
            </button>
          ))}
        </div>

        {/* 탭 콘텐츠 */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          {activeTab === "settings" && <SettingsTab />}
          {activeTab === "facilities" && <AdminFacilitiesTab />}
          {activeTab === "reservations" && <AdminReservationsTab />}
          {activeTab === "memberOptions" && <AdminMemberOptionsTab />}
          {activeTab === "members" && <AdminMembersTab />}
          {activeTab === "youtube" && <YoutubeAdminTab />}
        </div>
      </div>
    </div>
  );
}
