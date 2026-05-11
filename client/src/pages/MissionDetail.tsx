/**
 * 기쁨의교회 선교보고 상세 페이지 — /mission/:id
 * 디자인: Warm Modern Sacred — 녹색 포인트, Noto Serif KR, 넓은 여백
 * 구성: 헤더 → 히어로 이미지 → 선교사 프로필 → 본문 → 사진 갤러리 → 기도제목 → 이전/다음
 */

import { useParams, Link } from "wouter";
import { useState } from "react";
import { MOCK_REPORTS, CONTINENT_LABELS } from "@/lib/missionData";

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  return `${y}년 ${m}월 ${d}일`;
}

export default function MissionDetail() {
  const { id } = useParams<{ id: string }>();
  const [lightboxImg, setLightboxImg] = useState<string | null>(null);

  const report = MOCK_REPORTS.find((r) => r.id === id);
  const currentIndex = MOCK_REPORTS.findIndex((r) => r.id === id);
  const prevReport = currentIndex > 0 ? MOCK_REPORTS[currentIndex - 1] : null;
  const nextReport = currentIndex < MOCK_REPORTS.length - 1 ? MOCK_REPORTS[currentIndex + 1] : null;

  if (!report) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F7F7F5]">
        <i className="fas fa-exclamation-circle text-5xl text-gray-300 mb-4"></i>
        <p className="text-gray-500 mb-6">선교보고를 찾을 수 없습니다.</p>
        <Link href="/mission" className="bg-[#1B5E20] text-white px-6 py-2.5 rounded-full text-sm font-medium hover:bg-[#2E7D32] transition-colors">
          목록으로 돌아가기
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F7F5]">
      {/* ── 상단 헤더 ── */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/mission" className="flex items-center gap-2 text-[#1B5E20] hover:opacity-80 transition-opacity">
            <i className="fas fa-chevron-left text-sm"></i>
            <span className="font-medium text-sm">선교보고 목록</span>
          </Link>
          <span className="text-gray-400 text-sm hidden md:block">
            {report.missionary.region} · {formatDate(report.date)}
          </span>
        </div>
      </header>

      {/* ── 히어로 이미지 ── */}
      <div className="relative h-72 md:h-96 overflow-hidden">
        <img
          src={report.thumbnail}
          alt={report.title}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent"></div>
        {/* 대륙 뱃지 */}
        <span className="absolute top-6 left-6 bg-[#1B5E20]/90 text-white text-xs px-3 py-1.5 rounded-full">
          {CONTINENT_LABELS[report.missionary.continent]}
        </span>
        {/* 제목 */}
        <div className="absolute bottom-0 left-0 right-0 p-6 md:p-10">
          <h1
            className="text-2xl md:text-3xl font-bold text-white leading-snug max-w-2xl"
            style={{ fontFamily: "'Noto Serif KR', serif" }}
          >
            {report.title}
          </h1>
          <p className="text-gray-300 text-sm mt-2">{formatDate(report.date)}</p>
        </div>
      </div>

      {/* ── 본문 영역 ── */}
      <div className="max-w-4xl mx-auto px-4 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* 왼쪽: 선교사 프로필 카드 (사이드바) */}
          <aside className="lg:col-span-1">
            <div className="bg-white rounded-2xl p-6 shadow-sm sticky top-24">
              <img
                src={report.missionary.profileImage}
                alt={report.missionary.name}
                className="w-20 h-20 rounded-full object-cover border-4 border-[#E8F5E9] mx-auto mb-4"
              />
              <h2 className="text-center font-bold text-gray-800 text-lg" style={{ fontFamily: "'Noto Serif KR', serif" }}>
                {report.missionary.name}
              </h2>
              <p className="text-center text-sm text-[#1B5E20] font-medium mt-1">{report.missionary.region}</p>
              <div className="mt-5 space-y-3 text-sm text-gray-600">
                <div className="flex items-start gap-3">
                  <i className="fas fa-building text-[#1B5E20] mt-0.5 w-4 flex-shrink-0"></i>
                  <span>{report.missionary.organization}</span>
                </div>
                <div className="flex items-start gap-3">
                  <i className="fas fa-calendar text-[#1B5E20] mt-0.5 w-4 flex-shrink-0"></i>
                  <span>{report.missionary.sentYear}년 시작</span>
                </div>
                <div className="flex items-start gap-3">
                  <i className="fas fa-globe text-[#1B5E20] mt-0.5 w-4 flex-shrink-0"></i>
                  <span>{CONTINENT_LABELS[report.missionary.continent]}</span>
                </div>
              </div>
              {/* 해당 선교사 다른 보고 */}
              <div className="mt-6 pt-5 border-t border-gray-100">
                <p className="text-xs text-gray-400 font-medium mb-3 uppercase tracking-wider">다른 선교보고</p>
                {MOCK_REPORTS.filter(r => r.missionaryId === report.missionaryId && r.id !== report.id)
                  .slice(0, 2)
                  .map(r => (
                    <Link key={r.id} href={`/mission/${r.id}`} className="block mb-2 text-sm text-gray-600 hover:text-[#1B5E20] transition-colors leading-snug">
                      <i className="fas fa-file-alt text-xs mr-1.5 text-gray-300"></i>
                      {r.title.length > 28 ? r.title.slice(0, 28) + "…" : r.title}
                    </Link>
                  ))}
              </div>
            </div>
          </aside>

          {/* 오른쪽: 본문 */}
          <main className="lg:col-span-2 space-y-8">
            {/* 요약 */}
            <div className="bg-[#E8F5E9] rounded-xl p-5">
              <p className="text-[#1B5E20] text-sm font-medium leading-relaxed">{report.summary}</p>
            </div>

            {/* 본문 */}
            <div className="bg-white rounded-2xl p-7 shadow-sm">
              <h3 className="text-lg font-bold text-gray-800 mb-5 flex items-center gap-2" style={{ fontFamily: "'Noto Serif KR', serif" }}>
                <i className="fas fa-pen-nib text-[#1B5E20] text-base"></i>
                선교보고 원문
              </h3>
              <div className="prose prose-sm max-w-none text-gray-700 leading-8">
                {report.content.split("\n").map((line, i) =>
                  line === "" ? <br key={i} /> : <p key={i} className="mb-3">{line}</p>
                )}
              </div>
            </div>

            {/* 사진 갤러리 */}
            {report.images.length > 0 && (
              <div className="bg-white rounded-2xl p-7 shadow-sm">
                <h3 className="text-lg font-bold text-gray-800 mb-5 flex items-center gap-2" style={{ fontFamily: "'Noto Serif KR', serif" }}>
                  <i className="fas fa-images text-[#1B5E20] text-base"></i>
                  현장 사진
                </h3>
                <div className={`grid gap-3 ${report.images.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
                  {report.images.map((img, i) => (
                    <button
                      key={i}
                      onClick={() => setLightboxImg(img)}
                      className="relative overflow-hidden rounded-xl aspect-video group"
                    >
                      <img
                        src={img}
                        alt={`현장 사진 ${i + 1}`}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                        <i className="fas fa-expand text-white opacity-0 group-hover:opacity-100 transition-opacity text-xl"></i>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 기도 제목 */}
            <div className="bg-white rounded-2xl p-7 shadow-sm">
              <h3 className="text-lg font-bold text-gray-800 mb-5 flex items-center gap-2" style={{ fontFamily: "'Noto Serif KR', serif" }}>
                <i className="fas fa-hands-praying text-[#1B5E20] text-base"></i>
                기도 제목
              </h3>
              <ul className="space-y-3">
                {report.prayerTopics.map((topic, i) => (
                  <li key={i} className="flex items-start gap-3 text-gray-700 text-sm leading-relaxed">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#E8F5E9] text-[#1B5E20] text-xs font-bold flex items-center justify-center mt-0.5">
                      {i + 1}
                    </span>
                    {topic}
                  </li>
                ))}
              </ul>
            </div>

            {/* 이전/다음 보고 */}
            <div className="grid grid-cols-2 gap-4">
              {nextReport ? (
                <Link href={`/mission/${nextReport.id}`} className="bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow group">
                  <p className="text-xs text-gray-400 mb-1.5 flex items-center gap-1">
                    <i className="fas fa-chevron-left text-xs"></i> 이전 보고
                  </p>
                  <p className="text-sm font-medium text-gray-700 group-hover:text-[#1B5E20] transition-colors line-clamp-2 leading-snug">
                    {nextReport.title}
                  </p>
                </Link>
              ) : <div></div>}
              {prevReport ? (
                <Link href={`/mission/${prevReport.id}`} className="bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow group text-right">
                  <p className="text-xs text-gray-400 mb-1.5 flex items-center justify-end gap-1">
                    다음 보고 <i className="fas fa-chevron-right text-xs"></i>
                  </p>
                  <p className="text-sm font-medium text-gray-700 group-hover:text-[#1B5E20] transition-colors line-clamp-2 leading-snug">
                    {prevReport.title}
                  </p>
                </Link>
              ) : <div></div>}
            </div>

            {/* 목록으로 */}
            <div className="text-center pt-4">
              <Link href="/mission" className="inline-flex items-center gap-2 bg-[#1B5E20] text-white px-8 py-3 rounded-full font-medium hover:bg-[#2E7D32] transition-colors">
                <i className="fas fa-list text-sm"></i>
                선교보고 목록으로
              </Link>
            </div>
          </main>
        </div>
      </div>

      {/* ── 라이트박스 (사진 확대) ── */}
      {lightboxImg && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setLightboxImg(null)}
        >
          <button
            className="absolute top-5 right-5 text-white text-2xl hover:text-gray-300 transition-colors"
            onClick={() => setLightboxImg(null)}
          >
            <i className="fas fa-times"></i>
          </button>
          <img
            src={lightboxImg}
            alt="확대 사진"
            className="max-w-full max-h-[90vh] object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
