/**
 * 기쁨의교회 교적부 페이지
 * - 이름 검색 → 성도 카드 표시 (기본 정보 + 신앙 요약)
 * - 카드 클릭 → faithplus API 신앙 데이터 상세 조회
 * - 현재는 하드코딩 데이터, 추후 교회 DB 연동 예정
 */

import { useState } from "react";
import { Link } from "wouter";
import { Search, ChevronLeft, User, Phone, Calendar, MapPin, BookOpen, Heart, Church, Award, Star, Sprout } from "lucide-react";

// ─── 하드코딩 성도 데이터 (추후 교회 DB 연동) ───────────────────────────
const MOCK_MEMBERS = [
  {
    id: 1,
    faithplusId: 370,
    name: "최충만",
    age: 40,
    gender: "남",
    district: "영덕교구",
    position: "집사",
    ministry: "아동부 교사",
    registeredAt: "2012.03.04",
    phone: "010-3821-5674",
    address: "서울시 강북구 미아동",
    profileEmoji: "👨",
  },
];

// ─── faithplus API 타입 ───────────────────────────────────────────────────
interface FaithProfile {
  displayName: string;
  churchName: string;
  totalScore: number;
  totalBibleDays: number;
  totalPrayerCount: number;
  worshipCount: number;
}

interface FaithType {
  faith_type: string;
  faith_type_code: string;
  bible_score: number;
  prayer_score: number;
  worship_score: number;
  light_score: number;
  salt_score: number;
  ai_analysis: string;
}

interface FaithGarden {
  currentStage: number;
  totalActivityPoints: number;
  totalFruits: number;
}

interface FaithData {
  profile: FaithProfile;
  rank: number;
  faithType: FaithType | null;
  garden: FaithGarden | null;
}

// ─── 신앙 정원 단계 라벨 ─────────────────────────────────────────────────
function getGardenLabel(stage: number) {
  const labels: Record<number, string> = {
    1: "씨앗", 2: "새싹", 3: "묘목", 4: "작은 나무", 5: "나무",
    6: "큰 나무", 7: "열매 맺는 나무", 8: "풍성한 나무", 9: "고목", 10: "생명의 나무",
  };
  return labels[stage] ?? `${stage}단계`;
}

// ─── 점수 바 컴포넌트 ────────────────────────────────────────────────────
function ScoreBar({ label, score, color }: { label: string; score: number; color: string }) {
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-gray-600">{label}</span>
        <span className="font-semibold text-gray-800">{score}점</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${color}`}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}

export default function ChurchDirectory() {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResult, setSearchResult] = useState<typeof MOCK_MEMBERS>([]);
  const [searched, setSearched] = useState(false);
  const [selectedMember, setSelectedMember] = useState<typeof MOCK_MEMBERS[0] | null>(null);
  const [faithData, setFaithData] = useState<FaithData | null>(null);
  const [faithLoading, setFaithLoading] = useState(false);
  const [faithError, setFaithError] = useState<string | null>(null);

  // 이름 검색
  const handleSearch = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;
    const results = MOCK_MEMBERS.filter((m) => m.name.includes(q));
    setSearchResult(results);
    setSearched(true);
    setSelectedMember(null);
    setFaithData(null);
  };

  // 성도 카드 클릭 → 신앙 데이터 조회
  const handleSelectMember = async (member: typeof MOCK_MEMBERS[0]) => {
    setSelectedMember(member);
    setFaithData(null);
    setFaithError(null);
    setFaithLoading(true);
    try {
      const res = await fetch(`https://faithplus.co.kr/api/search/profile/${member.faithplusId}`);
      if (!res.ok) throw new Error("데이터를 불러오지 못했습니다.");
      const data: FaithData = await res.json();
      setFaithData(data);
    } catch (err) {
      setFaithError("신앙 데이터를 불러오는 중 오류가 발생했습니다.");
    } finally {
      setFaithLoading(false);
    }
  };

  // AI 분석 파싱
  const parseAiAnalysis = (raw: string | null | undefined) => {
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
  };

  return (
    <div className="min-h-screen bg-[#FAFAF8]" style={{ fontFamily: "'Noto Sans KR', sans-serif" }}>

      {/* ── 상단 헤더 ── */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-40 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link href="/" className="flex items-center gap-1.5 text-[#1B5E20] hover:opacity-80 transition-opacity">
            <ChevronLeft className="w-5 h-5" />
            <span className="text-sm font-medium">홈으로</span>
          </Link>
          <div className="w-px h-5 bg-gray-200" />
          <h1 className="text-base font-bold text-[#1B5E20]" style={{ fontFamily: "'Noto Serif KR', serif" }}>
            교적부
          </h1>
          <span className="text-xs text-gray-400 ml-auto">기쁨의교회</span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">

        {/* ── 검색창 ── */}
        <div className="mb-8">
          <p className="text-sm text-gray-500 mb-3">성도 이름으로 검색하세요</p>
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="이름 입력 (예: 최충만)"
                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B5E20]/30 focus:border-[#1B5E20] bg-white"
              />
            </div>
            <button
              type="submit"
              className="px-5 py-3 bg-[#1B5E20] text-white text-sm font-medium rounded-xl hover:bg-[#155016] transition-colors"
            >
              검색
            </button>
          </form>
        </div>

        {/* ── 검색 결과 없음 ── */}
        {searched && searchResult.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <User className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">검색된 성도가 없습니다.</p>
            <p className="text-xs mt-1">이름을 정확히 입력해 주세요.</p>
          </div>
        )}

        {/* ── 성도 카드 목록 ── */}
        {!selectedMember && searchResult.length > 0 && (
          <div className="space-y-4">
            <p className="text-xs text-gray-400">{searchResult.length}명의 성도가 검색됐습니다</p>
            {searchResult.map((member) => (
              <button
                key={member.id}
                onClick={() => handleSelectMember(member)}
                className="w-full text-left bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-[#1B5E20]/30 transition-all duration-200 overflow-hidden"
              >
                {/* 카드 상단 컬러 바 */}
                <div className="h-1.5 bg-gradient-to-r from-[#1B5E20] to-[#4CAF50]" />

                <div className="p-5">
                  {/* 이름 + 직분 배지 */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-[#E8F5E9] flex items-center justify-center text-2xl">
                        {member.profileEmoji}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-bold text-gray-900">{member.name}</span>
                          <span className="text-xs px-2 py-0.5 bg-[#1B5E20] text-white rounded-full font-medium">
                            {member.position}
                          </span>
                        </div>
                        <p className="text-sm text-gray-500 mt-0.5">{member.age}세 · {member.gender}</p>
                      </div>
                    </div>
                    <span className="text-xs text-[#1B5E20] bg-[#E8F5E9] px-2 py-1 rounded-lg font-medium">
                      신앙 데이터 보기 →
                    </span>
                  </div>

                  {/* 기본 정보 그리드 */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <MapPin className="w-4 h-4 text-[#1B5E20] shrink-0" />
                      <span>{member.district}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Heart className="w-4 h-4 text-[#1B5E20] shrink-0" />
                      <span>{member.ministry}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Calendar className="w-4 h-4 text-[#1B5E20] shrink-0" />
                      <span>등록 {member.registeredAt}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Phone className="w-4 h-4 text-[#1B5E20] shrink-0" />
                      <span>{member.phone}</span>
                    </div>
                  </div>

                  {/* 주소 */}
                  <div className="mt-3 flex items-center gap-2 text-sm text-gray-500">
                    <Church className="w-4 h-4 text-gray-400 shrink-0" />
                    <span>{member.address}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* ── 성도 상세 + 신앙 데이터 ── */}
        {selectedMember && (
          <div>
            {/* 뒤로가기 */}
            <button
              onClick={() => { setSelectedMember(null); setFaithData(null); }}
              className="flex items-center gap-1 text-sm text-[#1B5E20] mb-5 hover:opacity-70 transition-opacity"
            >
              <ChevronLeft className="w-4 h-4" />
              검색 결과로 돌아가기
            </button>

            {/* 성도 기본 정보 카드 */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-5">
              <div className="h-1.5 bg-gradient-to-r from-[#1B5E20] to-[#4CAF50]" />
              <div className="p-6">
                <div className="flex items-center gap-4 mb-5">
                  <div className="w-16 h-16 rounded-full bg-[#E8F5E9] flex items-center justify-center text-3xl">
                    {selectedMember.profileEmoji}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h2 className="text-xl font-bold text-gray-900">{selectedMember.name}</h2>
                      <span className="text-xs px-2 py-0.5 bg-[#1B5E20] text-white rounded-full font-medium">
                        {selectedMember.position}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500">{selectedMember.age}세 · {selectedMember.gender} · {selectedMember.district}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 rounded-xl p-3">
                    <p className="text-xs text-gray-400 mb-1">봉사 부서</p>
                    <p className="text-sm font-semibold text-gray-800">{selectedMember.ministry}</p>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-3">
                    <p className="text-xs text-gray-400 mb-1">등록일</p>
                    <p className="text-sm font-semibold text-gray-800">{selectedMember.registeredAt}</p>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-3">
                    <p className="text-xs text-gray-400 mb-1">연락처</p>
                    <p className="text-sm font-semibold text-gray-800">{selectedMember.phone}</p>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-3">
                    <p className="text-xs text-gray-400 mb-1">주소</p>
                    <p className="text-sm font-semibold text-gray-800 truncate">{selectedMember.address}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* 신앙 데이터 섹션 */}
            <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
              <Star className="w-4 h-4 text-[#1B5E20]" />
              믿음PLUS 신앙 데이터
            </h3>

            {faithLoading && (
              <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
                <div className="w-8 h-8 border-2 border-[#1B5E20] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-sm text-gray-400">신앙 데이터 불러오는 중...</p>
              </div>
            )}

            {faithError && (
              <div className="bg-red-50 rounded-2xl border border-red-100 p-6 text-center text-sm text-red-500">
                {faithError}
              </div>
            )}

            {faithData && (
              <div className="space-y-4">
                {/* 핵심 지표 카드 */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: "총 활동점수", value: faithData.profile.totalScore, unit: "점", icon: <Award className="w-5 h-5" />, color: "text-[#1B5E20]", bg: "bg-[#E8F5E9]" },
                    { label: "전체 랭킹", value: faithData.rank, unit: "위", icon: <Star className="w-5 h-5" />, color: "text-amber-600", bg: "bg-amber-50" },
                    { label: "성경읽기", value: faithData.profile.totalBibleDays, unit: "일", icon: <BookOpen className="w-5 h-5" />, color: "text-blue-600", bg: "bg-blue-50" },
                    { label: "기도횟수", value: faithData.profile.totalPrayerCount, unit: "회", icon: <Heart className="w-5 h-5" />, color: "text-purple-600", bg: "bg-purple-50" },
                  ].map((item) => (
                    <div key={item.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
                      <div className={`w-10 h-10 ${item.bg} ${item.color} rounded-full flex items-center justify-center mx-auto mb-2`}>
                        {item.icon}
                      </div>
                      <p className="text-2xl font-bold text-gray-900">{item.value}<span className="text-sm font-normal text-gray-400 ml-0.5">{item.unit}</span></p>
                      <p className="text-xs text-gray-400 mt-0.5">{item.label}</p>
                    </div>
                  ))}
                </div>

                {/* 신앙유형 + 활동 점수 */}
                {faithData.faithType && (
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-sm font-bold text-gray-800">이번 달 신앙유형</h4>
                      <span className="text-xs px-3 py-1 bg-[#1B5E20] text-white rounded-full font-medium">
                        {faithData.faithType.faith_type}
                      </span>
                    </div>
                    <div className="space-y-3">
                      <ScoreBar label="성경읽기" score={faithData.faithType.bible_score} color="bg-blue-400" />
                      <ScoreBar label="기도" score={faithData.faithType.prayer_score} color="bg-purple-400" />
                      <ScoreBar label="예배참석" score={faithData.faithType.worship_score} color="bg-[#4CAF50]" />
                      <ScoreBar label="세상의 빛" score={faithData.faithType.light_score} color="bg-amber-400" />
                      <ScoreBar label="마음의 소금" score={faithData.faithType.salt_score} color="bg-rose-400" />
                    </div>
                  </div>
                )}

                {/* AI 신앙 분석 */}
                {faithData.faithType?.ai_analysis && (() => {
                  const ai = parseAiAnalysis(faithData.faithType?.ai_analysis);
                  if (!ai) return null;
                  return (
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                      <h4 className="text-sm font-bold text-gray-800 mb-4">AI 신앙 분석</h4>
                      <div className="space-y-3">
                        {ai.summary && (
                          <div className="bg-[#E8F5E9] rounded-xl p-3">
                            <p className="text-xs font-semibold text-[#1B5E20] mb-1">종합 요약</p>
                            <p className="text-sm text-gray-700 leading-relaxed">{ai.summary}</p>
                          </div>
                        )}
                        {ai.strength && (
                          <div className="bg-blue-50 rounded-xl p-3">
                            <p className="text-xs font-semibold text-blue-600 mb-1">강점</p>
                            <p className="text-sm text-gray-700 leading-relaxed">{ai.strength}</p>
                          </div>
                        )}
                        {ai.growth_point && (
                          <div className="bg-amber-50 rounded-xl p-3">
                            <p className="text-xs font-semibold text-amber-600 mb-1">성장 포인트</p>
                            <p className="text-sm text-gray-700 leading-relaxed">{ai.growth_point}</p>
                          </div>
                        )}
                        {ai.verse && (
                          <div className="bg-purple-50 rounded-xl p-3 border-l-4 border-purple-300">
                            <p className="text-xs font-semibold text-purple-600 mb-1">추천 말씀</p>
                            <p className="text-sm text-gray-700 italic leading-relaxed">"{ai.verse}"</p>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* 신앙 정원 */}
                {faithData.garden && (
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                    <h4 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
                      <Sprout className="w-4 h-4 text-[#1B5E20]" />
                      신앙 정원
                    </h4>
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div className="bg-[#E8F5E9] rounded-xl p-3">
                        <p className="text-xl font-bold text-[#1B5E20]">{faithData.garden.currentStage}단계</p>
                        <p className="text-xs text-gray-500 mt-0.5">{getGardenLabel(faithData.garden.currentStage)}</p>
                      </div>
                      <div className="bg-gray-50 rounded-xl p-3">
                        <p className="text-xl font-bold text-gray-800">{faithData.garden.totalActivityPoints}</p>
                        <p className="text-xs text-gray-500 mt-0.5">활동 포인트</p>
                      </div>
                      <div className="bg-amber-50 rounded-xl p-3">
                        <p className="text-xl font-bold text-amber-600">{faithData.garden.totalFruits}</p>
                        <p className="text-xs text-gray-500 mt-0.5">열매 수</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── 초기 안내 화면 ── */}
        {!searched && (
          <div className="text-center py-16">
            <div className="w-20 h-20 bg-[#E8F5E9] rounded-full flex items-center justify-center mx-auto mb-4">
              <Search className="w-9 h-9 text-[#1B5E20]" />
            </div>
            <h2 className="text-lg font-bold text-gray-700 mb-2" style={{ fontFamily: "'Noto Serif KR', serif" }}>
              성도 이름을 검색하세요
            </h2>
            <p className="text-sm text-gray-400 leading-relaxed">
              이름을 입력하면 성도의 기본 정보와<br />
              믿음PLUS 신앙 데이터를 확인할 수 있습니다.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
