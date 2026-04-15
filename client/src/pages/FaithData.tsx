/**
 * 신앙 데이터 검색 페이지
 * URL: /faith-data?name=이름
 * faithplus.co.kr API 연동하여 성도 신앙 데이터 표시
 */
import { useState, useEffect } from "react";
import { Link } from "wouter";

// ─── API 타입 정의 ───────────────────────────────────────────────
interface SearchUser {
  userId: number;
  displayName: string;
  churchName: string;
  gender: string;
  age: number;
  profilePhoto: string | null;
  totalScore: number;
  totalBibleDays: number;
  totalPrayerCount: number;
  worshipCount: number;
  lightOfWorldCount: number;
  totalPrayerSec: number;
  monthlyBibleDays: number;
  monthlyPrayerCount: number;
  monthlyWorshipCount: number;
  monthlyLightOfWorldCount: number;
}

interface FaithType {
  faith_type: string;
  faith_type_code: string;
  bible_score: number;
  prayer_score: number;
  worship_score: number;
  light_score: number;
  salt_score: number;
  ai_analysis: string | null;
  ai_advice: string | null;
  recommended_verse: string | null;
  year_month: string;
}

interface ProfileData {
  profile: {
    userId: number;
    displayName: string;
    churchName: string;
    gender: string;
    age: number;
    profilePhoto: string | null;
    totalScore: number;
    totalBibleDays: number;
    totalPrayerCount: number;
    worshipCount: number;
    lightOfWorldCount: number;
    totalPrayerSec: number;
    monthlyBibleDays: number;
    monthlyPrayerCount: number;
    monthlyWorshipCount: number;
    monthlyLightOfWorldCount: number;
    monthlyPrayerSec: number;
  };
  rank: number | null;
  faithType: FaithType | string | null;
  faithHistory: { date: string; type: string; description: string }[];
  recentActivities: { date: string; type: string; description: string; points: number }[];
  bibleProgress: { booksRead: number; chaptersRead: number };
  evangelism: { contactCount: number };
  garden: { currentStage: number; totalActivityPoints: number; totalFruits: number };
}

const FAITH_TYPE_LABEL: Record<string, string> = {
  prayer: "기도형",
  bible: "말씀형",
  worship: "예배형",
  evangelism: "전도형",
  balanced: "균형형",
};

const ACTIVITY_TYPE_LABEL: Record<string, string> = {
  bible: "성경읽기",
  prayer: "기도",
  worship: "예배",
  light: "세상의 빛",
  evangelism: "전도",
};

function formatSeconds(sec: number): string {
  if (!sec) return "0분";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h}시간 ${m}분`;
  return `${m}분`;
}

// ─── 메인 컴포넌트 ───────────────────────────────────────────────
export default function FaithData() {
  const params = new URLSearchParams(window.location.search);
  const initialName = params.get("name") ?? "";

  const [searchInput, setSearchInput] = useState(initialName);
  const [query, setQuery] = useState(initialName);
  const [users, setUsers] = useState<SearchUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<ProfileData | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  // URL의 name 파라미터로 자동 검색
  useEffect(() => {
    if (query.trim()) {
      doSearch(query.trim());
    }
  }, [query]);

  async function doSearch(name: string) {
    setLoading(true);
    setError(null);
    setSelectedUser(null);
    setUsers([]);
    try {
      const res = await fetch(`https://faithplus.co.kr/api/search?name=${encodeURIComponent(name)}`);
      if (!res.ok) {
        if (res.status === 400) {
          setError("검색어를 2글자 이상 입력해 주세요.");
        } else {
          setError("검색 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
        }
        return;
      }
      const data = await res.json();
      setUsers(data.users ?? []);
      if ((data.users ?? []).length === 0) {
        setError("검색 결과가 없습니다.");
      }
    } catch {
      setError("서버에 연결할 수 없습니다. 네트워크를 확인해 주세요.");
    } finally {
      setLoading(false);
    }
  }

  async function loadProfile(userId: number) {
    setProfileLoading(true);
    setSelectedUser(null);
    try {
      const res = await fetch(`https://faithplus.co.kr/api/search/profile/${userId}`);
      if (!res.ok) throw new Error("프로필 로딩 실패");
      const data: ProfileData = await res.json();
      setSelectedUser(data);
    } catch {
      alert("프로필을 불러오는 데 실패했습니다.");
    } finally {
      setProfileLoading(false);
    }
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = searchInput.trim();
    if (!trimmed) return;
    // URL 업데이트
    window.history.replaceState(null, "", `/faith-data?name=${encodeURIComponent(trimmed)}`);
    setQuery(trimmed);
  }

  // 성경 읽기 진행률 (66권 기준)
  const biblePercent = selectedUser
    ? Math.min(100, Math.round((selectedUser.bibleProgress.booksRead / 66) * 100))
    : 0;

  return (
    <div className="min-h-screen bg-[#FAFAF8]" style={{ fontFamily: "'Noto Sans KR', sans-serif" }}>

      {/* ─── 상단 헤더 ─── */}
      <header className="bg-white shadow-sm sticky top-0 z-40">
        <div className="container flex items-center gap-3 h-14 md:h-16">
          <Link href="/" className="flex flex-col leading-tight shrink-0">
            <span className="text-lg md:text-xl font-bold text-[#1B5E20] tracking-tight" style={{ fontFamily: "'Noto Serif KR', serif" }}>기쁨의교회</span>
            <span className="text-[9px] text-gray-400 tracking-widest uppercase hidden md:block">The Joyful Church</span>
          </Link>
          <span className="text-gray-300 mx-1">/</span>
          <span className="text-sm text-gray-500 font-medium">신앙 데이터 검색</span>
        </div>
      </header>

      {/* ─── 검색 섹션 ─── */}
      <section className="bg-gradient-to-b from-[#1B5E20] to-[#2E7D32] py-10 md:py-14">
        <div className="container max-w-2xl text-center">
          <div className="mb-2">
            <i className="fas fa-seedling text-[#A5D6A7] text-3xl"></i>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-2" style={{ fontFamily: "'Noto Serif KR', serif" }}>
            신앙 데이터 검색
          </h1>
          <p className="text-[#A5D6A7] text-sm mb-6">성도 이름을 입력하면 신앙 활동 데이터를 확인할 수 있습니다.</p>
          <form onSubmit={handleSearchSubmit} className="flex gap-2 max-w-md mx-auto">
            <div className="relative flex-1">
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="이름을 입력하세요 (2글자 이상)"
                className="w-full h-12 pl-5 pr-4 text-base rounded-full border-2 border-white/30 bg-white/10 text-white placeholder-white/50 focus:outline-none focus:border-white focus:bg-white/20 transition-all duration-200"
              />
            </div>
            <button
              type="submit"
              className="h-12 px-6 rounded-full bg-white text-[#1B5E20] font-semibold text-sm hover:bg-[#F1F8E9] transition-colors shrink-0"
            >
              검색
            </button>
          </form>
        </div>
      </section>

      {/* ─── 결과 영역 ─── */}
      <div className="container max-w-4xl py-8">

        {/* 로딩 */}
        {loading && (
          <div className="flex flex-col items-center py-16 text-gray-400">
            <i className="fas fa-circle-notch fa-spin text-3xl text-[#1B5E20] mb-3"></i>
            <p className="text-sm">검색 중입니다...</p>
          </div>
        )}

        {/* 오류 */}
        {!loading && error && (
          <div className="flex flex-col items-center py-16 text-gray-400">
            <i className="fas fa-search text-4xl text-gray-300 mb-3"></i>
            <p className="text-sm">{error}</p>
          </div>
        )}

        {/* 검색 결과 목록 */}
        {!loading && !error && users.length > 0 && !selectedUser && !profileLoading && (
          <div>
            <p className="text-sm text-gray-500 mb-4">
              <span className="font-semibold text-[#1B5E20]">{query}</span> 검색 결과 {users.length}명
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {users.map((user) => (
                <button
                  key={user.userId}
                  onClick={() => loadProfile(user.userId)}
                  className="bg-white rounded-xl border border-gray-100 p-4 text-left hover:border-[#1B5E20]/40 hover:shadow-md transition-all duration-200 group"
                >
                  <div className="flex items-center gap-3">
                    {/* 아바타 */}
                    <div className="w-11 h-11 rounded-full bg-[#E8F5E9] flex items-center justify-center shrink-0 group-hover:bg-[#C8E6C9] transition-colors">
                      {user.profilePhoto ? (
                        <img src={user.profilePhoto} alt={user.displayName} className="w-11 h-11 rounded-full object-cover" />
                      ) : (
                        <i className="fas fa-user text-[#1B5E20] text-lg"></i>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-800 truncate">{user.displayName}</p>
                      <p className="text-xs text-gray-400 truncate">{user.churchName || "교회 미등록"}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-[#1B5E20]">{user.totalScore.toLocaleString()}</p>
                      <p className="text-[10px] text-gray-400">활동점수</p>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                    <div className="bg-[#F1F8E9] rounded-lg py-1.5">
                      <p className="text-xs font-semibold text-[#1B5E20]">{user.totalBibleDays}</p>
                      <p className="text-[10px] text-gray-400">성경읽기</p>
                    </div>
                    <div className="bg-[#F1F8E9] rounded-lg py-1.5">
                      <p className="text-xs font-semibold text-[#1B5E20]">{user.totalPrayerCount}</p>
                      <p className="text-[10px] text-gray-400">기도횟수</p>
                    </div>
                    <div className="bg-[#F1F8E9] rounded-lg py-1.5">
                      <p className="text-xs font-semibold text-[#1B5E20]">{user.worshipCount}</p>
                      <p className="text-[10px] text-gray-400">예배횟수</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 프로필 로딩 */}
        {profileLoading && (
          <div className="flex flex-col items-center py-16 text-gray-400">
            <i className="fas fa-circle-notch fa-spin text-3xl text-[#1B5E20] mb-3"></i>
            <p className="text-sm">신앙 데이터를 불러오는 중...</p>
          </div>
        )}

        {/* 상세 프로필 */}
        {selectedUser && !profileLoading && (
          <div>
            {/* 뒤로 가기 */}
            <button
              onClick={() => setSelectedUser(null)}
              className="flex items-center gap-2 text-sm text-[#1B5E20] hover:text-[#2E7D32] mb-5 transition-colors"
            >
              <i className="fas fa-arrow-left"></i>
              검색 결과로 돌아가기
            </button>

            {/* 프로필 헤더 카드 */}
            <div className="bg-gradient-to-r from-[#1B5E20] to-[#2E7D32] rounded-2xl p-6 text-white mb-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                  {selectedUser.profile.profilePhoto ? (
                    <img src={selectedUser.profile.profilePhoto} alt={selectedUser.profile.displayName} className="w-16 h-16 rounded-full object-cover" />
                  ) : (
                    <i className="fas fa-user text-white text-2xl"></i>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-xl font-bold">{selectedUser.profile.displayName}</h2>
                  <p className="text-[#A5D6A7] text-sm">{selectedUser.profile.churchName || "교회 미등록"}</p>
                  {selectedUser.faithType && (() => {
                    const ft = selectedUser.faithType;
                    const label = typeof ft === 'object' && ft !== null
                      ? (FAITH_TYPE_LABEL[ft.faith_type_code] ?? ft.faith_type)
                      : (FAITH_TYPE_LABEL[ft as string] ?? ft as string);
                    return (
                      <span className="inline-block mt-1 px-2 py-0.5 bg-white/20 rounded-full text-xs">
                        {label}
                      </span>
                    );
                  })()}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-2xl font-bold">{selectedUser.profile.totalScore.toLocaleString()}</p>
                  <p className="text-[#A5D6A7] text-xs">총 활동점수</p>
                  {selectedUser.rank && (
                    <p className="text-yellow-300 text-sm font-semibold mt-0.5">#{selectedUser.rank} 랭킹</p>
                  )}
                </div>
              </div>
            </div>

            {/* 통계 그리드 */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              {[
                { icon: "fa-book-open", label: "성경읽기", value: `${selectedUser.profile.totalBibleDays}일`, sub: `이번달 ${selectedUser.profile.monthlyBibleDays}일` },
                { icon: "fa-hands-praying", label: "기도횟수", value: `${selectedUser.profile.totalPrayerCount}회`, sub: `이번달 ${selectedUser.profile.monthlyPrayerCount}회` },
                { icon: "fa-church", label: "예배참석", value: `${selectedUser.profile.worshipCount}회`, sub: `이번달 ${selectedUser.profile.monthlyWorshipCount}회` },
                { icon: "fa-sun", label: "세상의 빛", value: `${selectedUser.profile.lightOfWorldCount}회`, sub: `이번달 ${selectedUser.profile.monthlyLightOfWorldCount}회` },
              ].map((item) => (
                <div key={item.label} className="bg-white rounded-xl border border-gray-100 p-4 text-center">
                  <i className={`fas ${item.icon} text-[#1B5E20] text-xl mb-2`}></i>
                  <p className="text-lg font-bold text-gray-800">{item.value}</p>
                  <p className="text-xs text-gray-500 font-medium mb-0.5">{item.label}</p>
                  <p className="text-[10px] text-gray-400">{item.sub}</p>
                </div>
              ))}
            </div>

            {/* 성경읽기 진행률 */}
            <div className="bg-white rounded-xl border border-gray-100 p-5 mb-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-700 flex items-center gap-2">
                  <i className="fas fa-book text-[#1B5E20]"></i>
                  성경읽기 진행률
                </h3>
                <span className="text-sm font-bold text-[#1B5E20]">{biblePercent}%</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-3 mb-2">
                <div
                  className="bg-gradient-to-r from-[#1B5E20] to-[#4CAF50] h-3 rounded-full transition-all duration-700"
                  style={{ width: `${biblePercent}%` }}
                />
              </div>
              <p className="text-xs text-gray-400">
                {selectedUser.bibleProgress.booksRead}권 / 66권 완독 &nbsp;·&nbsp; {selectedUser.bibleProgress.chaptersRead}장 읽음
              </p>
            </div>

            {/* 기도 시간 + 신앙 정원 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
              <div className="bg-white rounded-xl border border-gray-100 p-5">
                <h3 className="font-semibold text-gray-700 flex items-center gap-2 mb-3">
                  <i className="fas fa-clock text-[#1B5E20]"></i>
                  기도 시간
                </h3>
                <p className="text-2xl font-bold text-[#1B5E20]">{formatSeconds(selectedUser.profile.totalPrayerSec)}</p>
                <p className="text-xs text-gray-400 mt-1">이번달 {formatSeconds(selectedUser.profile.monthlyPrayerSec)}</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-100 p-5">
                <h3 className="font-semibold text-gray-700 flex items-center gap-2 mb-3">
                  <i className="fas fa-seedling text-[#1B5E20]"></i>
                  신앙 정원
                </h3>
                <p className="text-2xl font-bold text-[#1B5E20]">Lv.{selectedUser.garden.currentStage}</p>
                <p className="text-xs text-gray-400 mt-1">
                  활동 포인트 {selectedUser.garden.totalActivityPoints.toLocaleString()} &nbsp;·&nbsp; 열매 {selectedUser.garden.totalFruits}개
                </p>
              </div>
            </div>

            {/* 최근 활동 기록 */}
            {selectedUser.recentActivities.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-100 p-5">
                <h3 className="font-semibold text-gray-700 flex items-center gap-2 mb-4">
                  <i className="fas fa-history text-[#1B5E20]"></i>
                  최근 활동 기록
                </h3>
                <div className="space-y-3">
                  {selectedUser.recentActivities.slice(0, 10).map((act, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-[#E8F5E9] flex items-center justify-center shrink-0">
                        <i className={`fas ${
                          act.type === "bible" ? "fa-book-open" :
                          act.type === "prayer" ? "fa-hands-praying" :
                          act.type === "worship" ? "fa-church" :
                          act.type === "light" ? "fa-sun" : "fa-star"
                        } text-[#1B5E20] text-xs`}></i>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-700 truncate">{act.description || (ACTIVITY_TYPE_LABEL[act.type] ?? act.type)}</p>
                        <p className="text-xs text-gray-400">{act.date}</p>
                      </div>
                      {act.points > 0 && (
                        <span className="text-xs font-semibold text-[#1B5E20] shrink-0">+{act.points}pt</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 활동 기록이 없을 때 */}
            {selectedUser.recentActivities.length === 0 && (
              <div className="bg-white rounded-xl border border-gray-100 p-8 text-center text-gray-400">
                <i className="fas fa-leaf text-3xl text-gray-200 mb-2"></i>
                <p className="text-sm">아직 활동 기록이 없습니다.</p>
              </div>
            )}
          </div>
        )}

        {/* 초기 상태 (검색어 없음) */}
        {!loading && !error && users.length === 0 && !query && !selectedUser && (
          <div className="flex flex-col items-center py-16 text-gray-400">
            <i className="fas fa-search text-4xl text-gray-200 mb-3"></i>
            <p className="text-sm">이름을 검색하면 신앙 데이터를 확인할 수 있습니다.</p>
          </div>
        )}
      </div>

      {/* ─── 푸터 ─── */}
      <footer className="border-t border-gray-100 py-6 mt-8">
        <div className="container text-center text-xs text-gray-400">
          <p>신앙 데이터는 <strong>믿음PLUS</strong> 앱과 연동됩니다.</p>
          <Link href="/" className="text-[#1B5E20] hover:underline mt-1 inline-block">← 기쁨의교회 홈으로</Link>
        </div>
      </footer>
    </div>
  );
}
