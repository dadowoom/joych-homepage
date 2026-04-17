/**
 * 기쁨의교회 교적부 페이지
 * - 이름 검색 → 실제 DB에서 승인된 성도 조회
 * - 카드 클릭 → faithplus.co.kr/search?user=유저ID 새 탭으로 이동
 * - faithPlusUserId가 없는 성도는 믿음PLUS 버튼 비활성화
 */

import { useState, useEffect } from "react";
import { Link, useSearch } from "wouter";
import { Search, ChevronLeft, User, Phone, Calendar, MapPin, Heart, Church, ExternalLink, Lock } from "lucide-react";
import { trpc } from "@/lib/trpc";

export default function ChurchDirectory() {
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);
  const nameFromUrl = params.get("name") ?? "";

  const [searchQuery, setSearchQuery] = useState(nameFromUrl);
  const [submittedQuery, setSubmittedQuery] = useState(nameFromUrl || "");
  const [searched, setSearched] = useState(!!nameFromUrl);

  // 성도 로그인 상태 확인
  const { data: currentMember, isLoading: authLoading } = trpc.members.me.useQuery();
  const isLoggedIn = !authLoading && currentMember !== null && currentMember !== undefined;

  // tRPC 쿼리 - submittedQuery가 있고 로그인된 경우에만 실행
  const { data: searchResult = [], isLoading } = trpc.members.searchByName.useQuery(
    { name: submittedQuery },
    { enabled: submittedQuery.length > 0 && isLoggedIn }
  );

  // URL에 name 파라미터가 있으면 자동 검색
  useEffect(() => {
    if (nameFromUrl) {
      setSubmittedQuery(nameFromUrl);
      setSearched(true);
    }
  }, [nameFromUrl]);

  // 이름 검색
  const handleSearch = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;
    setSubmittedQuery(q);
    setSearched(true);
  };

  // 성도 카드 클릭 → faithplus 랭킹 페이지로 새 탭 이동
  const handleSelectMember = (member: typeof searchResult[0]) => {
    if (member.faithPlusUserId) {
      const encodedName = encodeURIComponent(member.name);
      window.open(
        `https://faithplus.co.kr/search/?name=${encodedName}&user=${member.faithPlusUserId}`,
        "_blank"
      );
    }
  };

  // 인증 확인 중
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center" style={{ fontFamily: "'Noto Sans KR', sans-serif" }}>
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[#1B5E20] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500">확인 중...</p>
        </div>
      </div>
    );
  }

  // 비로그인 상태 → 안내 화면
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-[#FAFAF8]" style={{ fontFamily: "'Noto Sans KR', sans-serif" }}>
        {/* 상단 헤더 */}
        <header className="bg-white border-b border-gray-100 sticky top-0 z-40 shadow-sm">
          <div className="max-w-4xl mx-auto px-4 h-14 flex items-center gap-3">
            <button onClick={() => window.history.back()} className="flex items-center gap-1.5 text-[#1B5E20] hover:opacity-80 transition-opacity">
              <ChevronLeft className="w-5 h-5" />
              <span className="text-sm font-medium">뒤로 가기</span>
            </button>
            <div className="w-px h-5 bg-gray-200" />
            <h1 className="text-base font-bold text-[#1B5E20]" style={{ fontFamily: "'Noto Serif KR', serif" }}>교적부</h1>
            <span className="text-xs text-gray-400 ml-auto">기쁨의교회</span>
          </div>
        </header>
        {/* 비로그인 안내 */}
        <main className="max-w-4xl mx-auto px-4 py-20 text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-[#E8F5E9] rounded-full mb-6">
            <Lock className="w-9 h-9 text-[#1B5E20]" />
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-2" style={{ fontFamily: "'Noto Serif KR', serif" }}>
            로그인이 필요한 서비스입니다
          </h2>
          <p className="text-sm text-gray-500 mb-8 leading-relaxed">
            교적부는 기쁨의교회 성도만 이용할 수 있습니다.<br />
            성도 로그인 후 이용해 주세요.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/member/login"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-[#1B5E20] text-white text-sm font-semibold rounded-lg hover:bg-[#2E7D32] transition-colors"
            >
              성도 로그인
            </Link>
            <Link
              href="/member/register"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 border border-[#1B5E20] text-[#1B5E20] text-sm font-semibold rounded-lg hover:bg-[#F1F8E9] transition-colors"
            >
              회원가입
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAF8]" style={{ fontFamily: "'Noto Sans KR', sans-serif" }}>

      {/* ── 상단 헤더 ── */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-40 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center gap-3">
          <button onClick={() => window.history.back()} className="flex items-center gap-1.5 text-[#1B5E20] hover:opacity-80 transition-opacity">
            <ChevronLeft className="w-5 h-5" />
            <span className="text-sm font-medium">뒤로 가기</span>
          </button>
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
                placeholder="이름 입력 (예: 홍길동)"
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

        {/* ── 로딩 중 ── */}
        {isLoading && searched && (
          <div className="text-center py-16 text-gray-400">
            <div className="w-8 h-8 border-2 border-[#1B5E20] border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
            <p className="text-sm">검색 중...</p>
          </div>
        )}

        {/* ── 검색 결과 없음 ── */}
        {searched && !isLoading && searchResult.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <User className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">검색된 성도가 없습니다.</p>
            <p className="text-xs mt-1">이름을 정확히 입력해 주세요.<br />승인된 성도만 검색됩니다.</p>
          </div>
        )}

        {/* ── 성도 카드 목록 ── */}
        {searched && !isLoading && searchResult.length > 0 && (
          <div className="space-y-4">
            <p className="text-xs text-gray-400">{searchResult.length}명의 성도가 검색됐습니다</p>
            {searchResult.map((member) => (
              <button
                key={member.id}
                onClick={() => handleSelectMember(member)}
                disabled={!member.faithPlusUserId}
                className={`w-full text-left bg-white rounded-2xl border border-gray-100 shadow-sm transition-all duration-200 overflow-hidden group ${
                  member.faithPlusUserId
                    ? "hover:shadow-md hover:border-[#1B5E20]/30 cursor-pointer"
                    : "cursor-default opacity-90"
                }`}
              >
                {/* 카드 상단 컬러 바 */}
                <div className="h-1.5 bg-gradient-to-r from-[#1B5E20] to-[#4CAF50]" />

                <div className="p-5">
                  {/* 이름 + 직분 배지 + 믿음PLUS 버튼 */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-[#E8F5E9] flex items-center justify-center">
                        <User className="w-6 h-6 text-[#1B5E20]" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-bold text-gray-900">{member.name}</span>
                          {member.position && (
                            <span className="text-xs px-2 py-0.5 bg-[#1B5E20] text-white rounded-full font-medium">
                              {member.position}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-500 mt-0.5">
                          {member.gender && `${member.gender}`}
                          {member.department && ` · ${member.department}`}
                        </p>
                      </div>
                    </div>
                    {/* 믿음PLUS 신앙 데이터 보기 버튼 */}
                    {member.faithPlusUserId ? (
                      <div className="flex items-center gap-1 text-xs text-[#1B5E20] bg-[#E8F5E9] px-2.5 py-1.5 rounded-lg font-medium group-hover:bg-[#1B5E20] group-hover:text-white transition-colors">
                        <span>믿음PLUS 보기</span>
                        <ExternalLink className="w-3 h-3" />
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-xs text-gray-400 bg-gray-100 px-2.5 py-1.5 rounded-lg font-medium">
                        <span>미연동</span>
                      </div>
                    )}
                  </div>

                  {/* 기본 정보 그리드 */}
                  <div className="grid grid-cols-2 gap-3">
                    {member.district && (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <MapPin className="w-4 h-4 text-[#1B5E20] shrink-0" />
                        <span>{member.district}</span>
                      </div>
                    )}
                    {member.phone && (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Phone className="w-4 h-4 text-[#1B5E20] shrink-0" />
                        <span>{member.phone}</span>
                      </div>
                    )}
                    {member.registeredAt && (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Calendar className="w-4 h-4 text-[#1B5E20] shrink-0" />
                        <span>등록 {member.registeredAt}</span>
                      </div>
                    )}
                    {member.pastor && (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Heart className="w-4 h-4 text-[#1B5E20] shrink-0" />
                        <span>{member.pastor} 교역자</span>
                      </div>
                    )}
                  </div>

                  {/* 주소 */}
                  {member.address && (
                    <div className="mt-3 flex items-center gap-2 text-sm text-gray-500">
                      <Church className="w-4 h-4 text-gray-400 shrink-0" />
                      <span>{member.address}</span>
                    </div>
                  )}
                </div>
              </button>
            ))}
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
