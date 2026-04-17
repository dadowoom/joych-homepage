/**
 * 기쁨의교회 CMS 관리자 대시보드
 * - 관리자(admin) 권한이 있는 사용자만 접근 가능
 * - 교회 소식, 관련 기관, 사이트 설정 관리
 */

import { useState } from "react";
import { Link, useSearch, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import AdminFacilitiesTab from "@/components/AdminFacilitiesTab";
import AdminReservationsTab from "@/components/AdminReservationsTab";
import AdminMemberOptionsTab from "@/components/AdminMemberOptionsTab";
import AdminMembersTab from "@/components/AdminMembersTab";

// ─── 탭 타입 ───────────────────────────────────
type Tab = "settings" | "facilities" | "reservations" | "memberOptions" | "members";

// ─── 히어로 슬라이드 관리 탭 ─────────────────────
function HeroSlidesTab() {
  const utils = trpc.useUtils();
  const { data: slides, isLoading } = trpc.cms.heroSlides.list.useQuery();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editData, setEditData] = useState<{
    yearLabel: string;
    mainTitle: string;
    subTitle: string;
    bibleRef: string;
    btn1Text: string;
    btn1Href: string;
    btn2Text: string;
    btn2Href: string;
  }>({
    yearLabel: "", mainTitle: "", subTitle: "", bibleRef: "",
    btn1Text: "", btn1Href: "", btn2Text: "", btn2Href: "",
  });

  const updateMutation = trpc.cms.heroSlides.update.useMutation({
    onSuccess: () => {
      utils.cms.heroSlides.list.invalidate();
      utils.home.heroSlides.invalidate();
      setEditingId(null);
      toast.success("슬라이드가 수정됐습니다.");
    },
    onError: () => toast.error("수정에 실패했습니다."),
  });

  const toggleMutation = trpc.cms.heroSlides.update.useMutation({
    onSuccess: () => {
      utils.cms.heroSlides.list.invalidate();
      utils.home.heroSlides.invalidate();
      toast.success("슬라이드 표시 여부가 변경됐습니다.");
    },
  });

  if (isLoading) return <p className="text-gray-500 py-8 text-center">불러오는 중...</p>;

  return (
    <div>
      <h3 className="text-lg font-bold text-gray-800 mb-1">히어로 슬라이드 관리</h3>
      <p className="text-sm text-gray-500 mb-4">홈페이지 상단 영상 위에 표시되는 문구를 수정합니다.</p>
      <div className="space-y-4">
        {slides?.map((slide, idx) => (
          <div key={slide.id} className="border border-gray-200 rounded-lg overflow-hidden">
            {/* 슬라이드 헤더 */}
            <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
              <span className="text-sm font-semibold text-gray-700">슬라이드 {idx + 1}</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => toggleMutation.mutate({ id: slide.id, isVisible: !slide.isVisible })}
                  className={`text-xs px-3 py-1 rounded-full font-medium transition-colors ${
                    slide.isVisible
                      ? "bg-green-100 text-green-700 hover:bg-green-200"
                      : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                  }`}
                >
                  {slide.isVisible ? "표시 중" : "숨김"}
                </button>
                {editingId === slide.id ? (
                  <>
                    <button
                      onClick={() => updateMutation.mutate({ id: slide.id, ...editData })}
                      disabled={updateMutation.isPending}
                      className="text-xs px-3 py-1 bg-[#1B5E20] text-white rounded hover:bg-[#2E7D32] disabled:opacity-50"
                    >
                      저장
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="text-xs px-3 py-1 border border-gray-300 rounded hover:bg-gray-100"
                    >
                      취소
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => {
                      setEditingId(slide.id);
                      setEditData({
                        yearLabel: slide.yearLabel ?? "",
                        mainTitle: slide.mainTitle ?? "",
                        subTitle: slide.subTitle ?? "",
                        bibleRef: slide.bibleRef ?? "",
                        btn1Text: slide.btn1Text ?? "",
                        btn1Href: slide.btn1Href ?? "",
                        btn2Text: slide.btn2Text ?? "",
                        btn2Href: slide.btn2Href ?? "",
                      });
                    }}
                    className="text-xs px-3 py-1 border border-gray-300 rounded hover:bg-gray-100"
                  >
                    수정
                  </button>
                )}
              </div>
            </div>

            {/* 슬라이드 내용 */}
            <div className="p-4">
              {editingId === slide.id ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {([
                    ["yearLabel", "연도 라벨 (예: 2026 JOYFUL)"],
                    ["mainTitle", "메인 제목 (줄바꿈: \\n)"],
                    ["subTitle", "부제목"],
                    ["bibleRef", "성경 구절 출처 (예: 잠언 3장 9절)"],
                    ["btn1Text", "버튼1 텍스트"],
                    ["btn1Href", "버튼1 링크"],
                    ["btn2Text", "버튼2 텍스트"],
                    ["btn2Href", "버튼2 링크"],
                  ] as [keyof typeof editData, string][]).map(([field, label]) => (
                    <div key={field}>
                      <label className="block text-xs text-gray-500 mb-1">{label}</label>
                      <input
                        type="text"
                        value={editData[field]}
                        onChange={(e) => setEditData(prev => ({ ...prev, [field]: e.target.value }))}
                        className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                  <div><span className="text-gray-400 text-xs">연도 라벨</span><p className="text-gray-700">{slide.yearLabel || "-"}</p></div>
                  <div><span className="text-gray-400 text-xs">성경 구절 출처</span><p className="text-gray-700">{slide.bibleRef || "-"}</p></div>
                  <div className="md:col-span-2"><span className="text-gray-400 text-xs">메인 제목</span><p className="text-gray-700 whitespace-pre-line">{slide.mainTitle || "-"}</p></div>
                  <div className="md:col-span-2"><span className="text-gray-400 text-xs">부제목</span><p className="text-gray-700">{slide.subTitle || "-"}</p></div>
                  <div><span className="text-gray-400 text-xs">버튼1</span><p className="text-gray-700">{slide.btn1Text} → {slide.btn1Href}</p></div>
                  <div><span className="text-gray-400 text-xs">버튼2</span><p className="text-gray-700">{slide.btn2Text} → {slide.btn2Href}</p></div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── 교회 소식 관리 탭 ─────────────────────────
function NoticesTab() {
  const utils = trpc.useUtils();
  const { data: notices, isLoading } = trpc.cms.notices.list.useQuery();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState("공지");
  const [showNewForm, setShowNewForm] = useState(false);

  const updateMutation = trpc.cms.notices.update.useMutation({
    onSuccess: () => {
      utils.cms.notices.list.invalidate();
      utils.home.notices.invalidate();
      setEditingId(null);
      toast.success("소식이 수정됐습니다.");
    },
  });

  const deleteMutation = trpc.cms.notices.delete.useMutation({
    onSuccess: () => {
      utils.cms.notices.list.invalidate();
      utils.home.notices.invalidate();
      toast.success("소식이 삭제됐습니다.");
    },
  });

  const createMutation = trpc.cms.notices.create.useMutation({
    onSuccess: () => {
      utils.cms.notices.list.invalidate();
      utils.home.notices.invalidate();
      setNewTitle("");
      setNewCategory("공지");
      setShowNewForm(false);
      toast.success("새 소식이 등록됐습니다.");
    },
  });

  const startEdit = (n: { id: number; title: string; category: string }) => {
    setEditingId(n.id);
    setEditTitle(n.title);
    setEditCategory(n.category);
  };

  if (isLoading) return <p className="text-gray-500 py-8 text-center">불러오는 중...</p>;

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-bold text-gray-800">교회 소식 관리</h3>
        <button
          onClick={() => setShowNewForm(!showNewForm)}
          className="px-4 py-2 bg-[#1B5E20] text-white text-sm rounded hover:bg-[#2E7D32] transition-colors"
        >
          + 새 소식 등록
        </button>
      </div>

      {/* 새 소식 등록 폼 */}
      {showNewForm && (
        <div className="bg-[#F1F8E9] border border-[#A5D6A7] rounded-lg p-4 mb-4">
          <div className="flex gap-3 mb-3">
            <select
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              className="border border-gray-300 rounded px-3 py-2 text-sm"
            >
              <option value="공지">공지</option>
              <option value="행사">행사</option>
              <option value="찬양">찬양</option>
              <option value="기타">기타</option>
            </select>
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="소식 제목을 입력하세요"
              className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm"
            />
          </div>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setShowNewForm(false)}
              className="px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
            >
              취소
            </button>
            <button
              onClick={() => {
                if (!newTitle.trim()) return toast.error("제목을 입력해주세요.");
                createMutation.mutate({ title: newTitle, category: newCategory });
              }}
              disabled={createMutation.isPending}
              className="px-3 py-1.5 text-sm bg-[#1B5E20] text-white rounded hover:bg-[#2E7D32] disabled:opacity-50"
            >
              {createMutation.isPending ? "등록 중..." : "등록"}
            </button>
          </div>
        </div>
      )}

      {/* 소식 목록 */}
      <div className="divide-y divide-gray-100 border border-gray-200 rounded-lg overflow-hidden">
        {(!notices || notices.length === 0) && (
          <p className="text-gray-400 text-sm text-center py-8">등록된 소식이 없습니다.</p>
        )}
        {notices?.map((n) => (
          <div key={n.id} className="p-4 bg-white hover:bg-gray-50">
            {editingId === n.id ? (
              <div className="flex gap-2 items-center">
                <select
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value)}
                  className="border border-gray-300 rounded px-2 py-1.5 text-sm"
                >
                  <option value="공지">공지</option>
                  <option value="행사">행사</option>
                  <option value="찬양">찬양</option>
                  <option value="기타">기타</option>
                </select>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="flex-1 border border-gray-300 rounded px-3 py-1.5 text-sm"
                />
                <button
                  onClick={() => updateMutation.mutate({ id: n.id, title: editTitle, category: editCategory })}
                  disabled={updateMutation.isPending}
                  className="px-3 py-1.5 text-xs bg-[#1B5E20] text-white rounded hover:bg-[#2E7D32] disabled:opacity-50"
                >
                  저장
                </button>
                <button
                  onClick={() => setEditingId(null)}
                  className="px-3 py-1.5 text-xs border border-gray-300 rounded hover:bg-gray-100"
                >
                  취소
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <span className={`shrink-0 text-xs px-2 py-0.5 rounded font-medium ${
                  n.category === "공지" ? "bg-blue-100 text-blue-700" :
                  n.category === "행사" ? "bg-amber-100 text-amber-700" :
                  n.category === "찬양" ? "bg-green-100 text-green-700" :
                  "bg-gray-100 text-gray-700"
                }`}>{n.category}</span>
                <span className="flex-1 text-sm text-gray-800 truncate">{n.title}</span>
                <span className="text-xs text-gray-400 shrink-0">
                  {new Date(n.createdAt).toLocaleDateString("ko-KR")}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded shrink-0 ${n.isPublished ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                  {n.isPublished ? "게시중" : "숨김"}
                </span>
                <button
                  onClick={() => updateMutation.mutate({ id: n.id, isPublished: !n.isPublished })}
                  className="text-xs text-gray-500 hover:text-[#1B5E20] px-2 py-1 rounded hover:bg-gray-100"
                >
                  {n.isPublished ? "숨기기" : "게시"}
                </button>
                <button
                  onClick={() => startEdit(n)}
                  className="text-xs text-blue-600 hover:text-blue-800 px-2 py-1 rounded hover:bg-blue-50"
                >
                  수정
                </button>
                <button
                  onClick={() => {
                    if (confirm(`"${n.title}" 소식을 삭제할까요?`)) {
                      deleteMutation.mutate({ id: n.id });
                    }
                  }}
                  className="text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50"
                >
                  삭제
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── 관련 기관 관리 탭 ─────────────────────────
function AffiliatesTab() {
  const utils = trpc.useUtils();
  const { data: affiliates, isLoading } = trpc.cms.affiliates.list.useQuery();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editHref, setEditHref] = useState("");

  const updateMutation = trpc.cms.affiliates.update.useMutation({
    onSuccess: () => {
      utils.cms.affiliates.list.invalidate();
      utils.home.affiliates.invalidate();
      setEditingId(null);
      toast.success("관련 기관 정보가 수정됐습니다.");
    },
  });

  if (isLoading) return <p className="text-gray-500 py-8 text-center">불러오는 중...</p>;

  return (
    <div>
      <h3 className="text-lg font-bold text-gray-800 mb-4">관련 기관 관리</h3>
      <div className="divide-y divide-gray-100 border border-gray-200 rounded-lg overflow-hidden">
        {affiliates?.map((a) => (
          <div key={a.id} className="p-4 bg-white hover:bg-gray-50">
            {editingId === a.id ? (
              <div className="flex gap-2 items-center flex-wrap">
                <input
                  type="text"
                  value={editLabel}
                  onChange={(e) => setEditLabel(e.target.value)}
                  placeholder="기관명"
                  className="border border-gray-300 rounded px-3 py-1.5 text-sm w-40"
                />
                <input
                  type="text"
                  value={editHref}
                  onChange={(e) => setEditHref(e.target.value)}
                  placeholder="링크 URL (없으면 #)"
                  className="flex-1 border border-gray-300 rounded px-3 py-1.5 text-sm min-w-[200px]"
                />
                <button
                  onClick={() => updateMutation.mutate({ id: a.id, label: editLabel, href: editHref })}
                  disabled={updateMutation.isPending}
                  className="px-3 py-1.5 text-xs bg-[#1B5E20] text-white rounded hover:bg-[#2E7D32] disabled:opacity-50"
                >
                  저장
                </button>
                <button
                  onClick={() => setEditingId(null)}
                  className="px-3 py-1.5 text-xs border border-gray-300 rounded hover:bg-gray-100"
                >
                  취소
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <i className={`fas ${a.icon} text-[#1B5E20] w-5 text-center`}></i>
                <span className="flex-1 text-sm text-gray-800">{a.label}</span>
                <span className="text-xs text-gray-400 truncate max-w-[200px]">{a.href ?? "#"}</span>
                <span className={`text-xs px-2 py-0.5 rounded ${a.isVisible ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                  {a.isVisible ? "표시" : "숨김"}
                </span>
                <button
                  onClick={() => updateMutation.mutate({ id: a.id, isVisible: !a.isVisible })}
                  className="text-xs text-gray-500 hover:text-[#1B5E20] px-2 py-1 rounded hover:bg-gray-100"
                >
                  {a.isVisible ? "숨기기" : "표시"}
                </button>
                <button
                  onClick={() => {
                    setEditingId(a.id);
                    setEditLabel(a.label);
                    setEditHref(a.href ?? "#");
                  }}
                  className="text-xs text-blue-600 hover:text-blue-800 px-2 py-1 rounded hover:bg-blue-50"
                >
                  수정
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── 사이트 설정 탭 ────────────────────────────
function SettingsTab() {
  const utils = trpc.useUtils();
  const { data: settings, isLoading } = trpc.home.settings.useQuery();
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const updateMutation = trpc.cms.settings.update.useMutation({
    onSuccess: () => {
      utils.home.settings.invalidate();
      setEditingKey(null);
      toast.success("설정이 저장됐습니다.");
    },
  });

  const SETTING_LABELS: Record<string, string> = {
    church_name: "교회 이름",
    church_name_en: "교회 영문 이름",
    church_since: "설립 연도",
    denomination: "교단",
    address: "주소",
    tel: "전화번호",
    fax: "팩스",
    youtube_url: "유튜브 채널 URL",
    facebook_url: "페이스북 URL",
    instagram_url: "인스타그램 URL",
    vision_title: "비전 제목",
    vision_desc: "비전 설명",
  };

  if (isLoading) return <p className="text-gray-500 py-8 text-center">불러오는 중...</p>;

  return (
    <div>
      <h3 className="text-lg font-bold text-gray-800 mb-4">교회 기본 정보 설정</h3>
      <div className="divide-y divide-gray-100 border border-gray-200 rounded-lg overflow-hidden">
        {Object.entries(SETTING_LABELS).map(([key, label]) => (
          <div key={key} className="p-4 bg-white hover:bg-gray-50">
            {editingKey === key ? (
              <div>
                <label className="block text-xs text-gray-500 mb-1">{label}</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    className="flex-1 border border-gray-300 rounded px-3 py-1.5 text-sm"
                  />
                  <button
                    onClick={() => updateMutation.mutate({ key, value: editValue })}
                    disabled={updateMutation.isPending}
                    className="px-3 py-1.5 text-xs bg-[#1B5E20] text-white rounded hover:bg-[#2E7D32] disabled:opacity-50"
                  >
                    저장
                  </button>
                  <button
                    onClick={() => setEditingKey(null)}
                    className="px-3 py-1.5 text-xs border border-gray-300 rounded hover:bg-gray-100"
                  >
                    취소
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-500 w-32 shrink-0">{label}</span>
                <span className="flex-1 text-sm text-gray-800">{settings?.[key] || <span className="text-gray-400 italic">미설정</span>}</span>
                <button
                  onClick={() => {
                    setEditingKey(key);
                    setEditValue(settings?.[key] ?? "");
                  }}
                  className="text-xs text-blue-600 hover:text-blue-800 px-2 py-1 rounded hover:bg-blue-50 shrink-0"
                >
                  수정
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── 메인 관리자 페이지 ─────────────────────────
export default function AdminPage() {
  const { user, loading } = useAuth();
  const searchString = useSearch();
  const [, setLocation] = useLocation();
  const searchParams = new URLSearchParams(searchString);
  const VALID_TABS: Tab[] = ["settings", "facilities", "reservations", "memberOptions", "members"];
  const tabFromUrl = searchParams.get("tab") as Tab | null;
  const activeTab: Tab = tabFromUrl && VALID_TABS.includes(tabFromUrl) ? tabFromUrl : "settings";
  const setActiveTab = (tab: Tab) => setLocation(`/admin?tab=${tab}`);
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
  const lockRemainMin = isLocked ? Math.ceil((lockUntil! - Date.now()) / 60000) : 0;

  const adminLoginMutation = trpc.auth.adminLogin.useMutation({
    onSuccess: () => {
      // 로그인 성공 → 실패 카운트 초기화 후 메인화면으로 이동
      localStorage.removeItem("admin_fail_count");
      localStorage.removeItem("admin_lock_until");
      setFailCount(0);
      setLockUntil(null);
      window.location.href = "/";
    },
    onError: (err) => {
      const newCount = failCount + 1;
      setFailCount(newCount);
      localStorage.setItem("admin_fail_count", String(newCount));
      if (newCount >= 5) {
        const until = Date.now() + 30 * 60 * 1000; // 30분 잠금
        setLockUntil(until);
        localStorage.setItem("admin_lock_until", String(until));
        localStorage.setItem("admin_fail_count", "0");
        setFailCount(0);
        setLoginError("로그인 시도 횟수를 초과했습니다. 30분 후 다시 시도해 주세요.");
      } else {
        setLoginError(`아이디 또는 비밀번호가 올바르지 않습니다. (${newCount}/5회 실패)`);
      }
    },
  });

  // 로딩 중
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

  // 로그인 안 된 경우 → 아이디/비밀번호 폼 표시
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50" style={{ fontFamily: "'Noto Sans KR', sans-serif" }}>
        <div className="bg-white rounded-2xl shadow-lg max-w-sm w-full mx-4 p-8">
          {/* 로고 */}
          <div className="text-center mb-8">
            <div className="text-[#1B5E20] text-4xl mb-3">
              <i className="fas fa-church"></i>
            </div>
            <h1 className="text-xl font-bold text-gray-900" style={{ fontFamily: "'Noto Serif KR', serif" }}>기쁜의교회</h1>
            <p className="text-sm text-gray-500 mt-1">관리자 로그인</p>
          </div>

          {/* 로그인 폼 */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (isLocked) {
                setLoginError(`로그인이 잠겨 있습니다. ${lockRemainMin}분 후 다시 시도해 주세요.`);
                return;
              }
              setLoginError("");
              adminLoginMutation.mutate({ username: loginUsername, password: loginPassword });
            }}
            className="space-y-4"
          >
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">아이디</label>
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
              <label className="block text-sm font-medium text-gray-700 mb-1">비밀번호</label>
              <input
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="비밀번호를 입력하세요"
                required
                className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B5E20] focus:border-transparent"
              />
            </div>

            {/* 에러 메시지 */}
            {loginError && (
              <p className="text-red-500 text-sm text-center">{loginError}</p>
            )}

            {isLocked && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-center">
                <p className="text-red-600 text-sm font-medium">로그인 잠금</p>
                <p className="text-red-500 text-xs mt-1">실패 5회 초과 — {lockRemainMin}분 후 다시 시도하세요</p>
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
              ) : isLocked ? `${lockRemainMin}분 후 재시도` : "로그인"}
            </button>
          </form>

          <div className="mt-6 text-center">
            <Link href="/" className="text-sm text-gray-400 hover:text-gray-600">← 홈페이지로 돌아가기</Link>
          </div>
        </div>
      </div>
    );
  }

  // 관리자 권한 없는 경우
  if (user.role !== "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-sm mx-auto p-8">
          <div className="text-red-400 text-5xl mb-4">
            <i className="fas fa-ban"></i>
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">접근 권한 없음</h2>
          <p className="text-gray-500 text-sm mb-6">관리자 권한이 없습니다. 다도움 담당자에게 문의해주세요.</p>
          <Link href="/" className="text-sm text-gray-400 hover:text-gray-600">← 홈페이지로 돌아가기</Link>
        </div>
      </div>
    );
  }

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: "settings", label: "기본 정보", icon: "fa-cog" },
    { id: "facilities", label: "시설 관리", icon: "fa-building" },
    { id: "reservations", label: "예약 승인", icon: "fa-calendar-check" },
    { id: "memberOptions", label: "선택지 관리", icon: "fa-list-ul" },
    { id: "members", label: "성도 관리", icon: "fa-users" },
  ];

  return (
    <div className="min-h-screen bg-gray-50" style={{ fontFamily: "'Noto Sans KR', sans-serif" }}>
      {/* 헤더 */}
      <header className="bg-[#0F172A] text-white px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-[#A5D6A7] hover:text-white transition-colors">
            <i className="fas fa-arrow-left mr-2"></i>홈페이지
          </Link>
          <span className="text-gray-600">|</span>
          <span className="font-bold text-[#A5D6A7]" style={{ fontFamily: "'Noto Serif KR', serif" }}>
            기쁨의교회 관리자
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-400">{user.name ?? user.email ?? "관리자"}</span>
          <span className="text-xs bg-[#1B5E20] px-2 py-0.5 rounded">admin</span>
          <button
            onClick={() => {
              fetch("/api/trpc/auth.logout", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ "0": { json: null } }),
              }).then(() => { window.location.reload(); });
            }}
            className="text-xs text-gray-400 hover:text-red-400 transition-colors px-2 py-1 rounded hover:bg-white/10"
          >
            로그아웃
          </button>
        </div>
      </header>

      {/* 본문 */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: "'Noto Serif KR', serif" }}>
            콘텐츠 관리
          </h1>
          <p className="text-gray-500 text-sm mt-1">홈페이지에 표시되는 내용을 관리합니다.</p>
        </div>

        {/* 탭 메뉴 */}
        <div className="flex gap-1 bg-white border border-gray-200 rounded-lg p-1 mb-6 w-fit">
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
        </div>
      </div>
    </div>
  );
}
