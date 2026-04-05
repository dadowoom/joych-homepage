/**
 * 기쁨의교회 선교보고 목록 페이지 — /mission
 * 디자인: Warm Modern Sacred — 녹색 포인트(#1B5E20), Noto Serif KR, 카드 레이아웃
 * 구성: PageBanner → 필터(대륙/선교사) → 보고 카드 목록(최신순)
 * 규칙: 더미 데이터는 missionData.ts에서만 관리, 나중에 API 호출로 교체
 */

import { useState } from "react";
import { Link } from "wouter";
import { MOCK_REPORTS, MISSIONARIES, CONTINENT_LABELS, type MissionContinent } from "@/lib/missionData";

// 날짜 포맷 헬퍼 (YYYY-MM-DD → YYYY년 MM월 DD일)
function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  return `${y}년 ${m}월 ${d}일`;
}

export default function MissionList() {
  const [selectedContinent, setSelectedContinent] = useState<MissionContinent | "all">("all");
  const [selectedMissionary, setSelectedMissionary] = useState<string>("all");

  // 필터 적용
  const filtered = MOCK_REPORTS.filter((r) => {
    const continentOk = selectedContinent === "all" || r.missionary.continent === selectedContinent;
    const missionaryOk = selectedMissionary === "all" || r.missionaryId === selectedMissionary;
    return continentOk && missionaryOk;
  });

  const continents: Array<{ value: MissionContinent | "all"; label: string }> = [
    { value: "all", label: "전체 지역" },
    ...Object.entries(CONTINENT_LABELS).map(([k, v]) => ({ value: k as MissionContinent, label: v })),
  ];

  return (
    <div className="min-h-screen bg-[#F7F7F5]">
      {/* ── 상단 헤더 (홈으로 돌아가기) ── */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-[#1B5E20] hover:opacity-80 transition-opacity">
            <i className="fas fa-chevron-left text-sm"></i>
            <span className="font-medium text-sm">기쁨의교회 홈</span>
          </Link>
          <span className="text-gray-400 text-sm">사역/선교 &gt; 선교보고</span>
        </div>
      </header>

      {/* ── 페이지 배너 ── */}
      <section
        className="relative py-20 bg-cover bg-center overflow-hidden"
        style={{ backgroundImage: "url('https://images.unsplash.com/photo-1504052434569-70ad5836ab65?w=1400&q=80')" }}
      >
        <div className="absolute inset-0 bg-[#1B5E20]/75"></div>
        <div className="relative z-10 max-w-6xl mx-auto px-4 text-white">
          <p className="text-sm font-medium tracking-widest text-green-200 mb-3 uppercase">Mission Report</p>
          <h1 className="text-4xl md:text-5xl font-bold mb-4" style={{ fontFamily: "'Noto Serif KR', serif" }}>
            선교보고
          </h1>
          <p className="text-green-100 text-lg max-w-xl leading-relaxed">
            기쁨의교회가 파송하고 후원하는 선교사님들의<br />
            현장 이야기를 함께 나눕니다.
          </p>
          {/* 통계 */}
          <div className="flex gap-8 mt-8">
            <div>
              <p className="text-3xl font-bold">{MISSIONARIES.length}</p>
              <p className="text-green-200 text-sm mt-1">파송 선교사</p>
            </div>
            <div className="w-px bg-green-400/40"></div>
            <div>
              <p className="text-3xl font-bold">{new Set(MISSIONARIES.map(m => m.region.split(" ")[0])).size}</p>
              <p className="text-green-200 text-sm mt-1">사역 국가</p>
            </div>
            <div className="w-px bg-green-400/40"></div>
            <div>
              <p className="text-3xl font-bold">{MOCK_REPORTS.length}</p>
              <p className="text-green-200 text-sm mt-1">총 선교보고</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── 선교사 프로필 띠 ── */}
      <section className="bg-white border-b border-gray-200 py-6">
        <div className="max-w-6xl mx-auto px-4">
          <p className="text-xs text-gray-400 font-medium mb-4 uppercase tracking-wider">파송 선교사</p>
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
            {MISSIONARIES.map((m) => (
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
                  src={m.profileImage}
                  alt={m.name}
                  className="w-12 h-12 rounded-full object-cover border-2 border-white"
                />
                <span className="text-xs font-medium whitespace-nowrap">{m.name.replace(" 선교사", "")}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ── 대륙 필터 + 결과 수 ── */}
      <section className="max-w-6xl mx-auto px-4 py-6">
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

      {/* ── 선교보고 카드 목록 ── */}
      <section className="max-w-6xl mx-auto px-4 pb-20">
        {filtered.length === 0 ? (
          <div className="text-center py-24 text-gray-400">
            <i className="fas fa-search text-4xl mb-4 block"></i>
            <p>해당 조건의 선교보고가 없습니다.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((report) => (
              <Link key={report.id} href={`/mission/${report.id}`}>
                <article className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300 cursor-pointer group">
                  {/* 썸네일 */}
                  <div className="relative h-52 overflow-hidden">
                    <img
                      src={report.thumbnail}
                      alt={report.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    {/* 대륙 뱃지 */}
                    <span className="absolute top-3 left-3 bg-[#1B5E20]/90 text-white text-xs px-2.5 py-1 rounded-full">
                      {CONTINENT_LABELS[report.missionary.continent]}
                    </span>
                  </div>
                  {/* 내용 */}
                  <div className="p-5">
                    {/* 선교사 정보 */}
                    <div className="flex items-center gap-3 mb-3">
                      <img
                        src={report.missionary.profileImage}
                        alt={report.missionary.name}
                        className="w-9 h-9 rounded-full object-cover border-2 border-[#E8F5E9]"
                      />
                      <div>
                        <p className="text-sm font-semibold text-gray-800">{report.missionary.name}</p>
                        <p className="text-xs text-gray-400">{report.missionary.region}</p>
                      </div>
                      <span className="ml-auto text-xs text-gray-400">{formatDate(report.date)}</span>
                    </div>
                    {/* 제목 */}
                    <h2
                      className="text-base font-bold text-gray-800 mb-2 leading-snug group-hover:text-[#1B5E20] transition-colors line-clamp-2"
                      style={{ fontFamily: "'Noto Serif KR', serif" }}
                    >
                      {report.title}
                    </h2>
                    {/* 미리보기 */}
                    <p className="text-sm text-gray-500 leading-relaxed line-clamp-2">{report.summary}</p>
                    {/* 기도제목 수 */}
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

      {/* ── 하단 CTA ── */}
      <section className="bg-[#1B5E20] py-12 text-center text-white">
        <i className="fas fa-hands-praying text-3xl text-green-300 mb-4 block"></i>
        <h3 className="text-xl font-bold mb-2" style={{ fontFamily: "'Noto Serif KR', serif" }}>
          선교사님들을 위해 기도해 주세요
        </h3>
        <p className="text-green-200 text-sm">여러분의 기도가 세계 선교의 힘이 됩니다.</p>
      </section>
    </div>
  );
}
