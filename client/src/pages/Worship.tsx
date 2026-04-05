/**
 * 기쁨의교회 — 예배/미디어 그룹 페이지
 * 디자인: Warm Modern Sacred — 녹색 포인트, Noto Serif KR
 * 포함: JoyfulTV / WorshipSchedule / Bulletin
 */

import { useState } from "react";
import { Link } from "wouter";

function PageHeader({ title, subtitle, breadcrumb }: { title: string; subtitle?: string; breadcrumb: string[] }) {
  return (
    <div className="bg-[#1B5E20] text-white py-16 px-4">
      <div className="max-w-5xl mx-auto">
        <nav className="text-sm text-green-200 mb-4 flex items-center gap-2">
          <Link href="/" className="hover:text-white transition-colors">홈</Link>
          {breadcrumb.map((b, i) => (
            <span key={i} className="flex items-center gap-2">
              <i className="fas fa-chevron-right text-xs text-green-400"></i>
              <span className={i === breadcrumb.length - 1 ? "text-white font-medium" : ""}>{b}</span>
            </span>
          ))}
        </nav>
        <h1 className="text-3xl md:text-4xl font-bold" style={{ fontFamily: "'Noto Serif KR', serif" }}>{title}</h1>
        {subtitle && <p className="mt-3 text-green-100 text-base">{subtitle}</p>}
      </div>
    </div>
  );
}

function SubNav({ items }: { items: { label: string; href: string }[] }) {
  return (
    <div className="bg-white border-b border-gray-200 sticky top-0 z-40">
      <div className="max-w-5xl mx-auto px-4 flex overflow-x-auto">
        {items.map((item, i) => (
          <Link key={i} href={item.href}
            className="flex-shrink-0 px-5 py-4 text-sm font-medium text-gray-600 hover:text-[#1B5E20] border-b-2 border-transparent hover:border-[#1B5E20] transition-all whitespace-nowrap">
            {item.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

const WORSHIP_NAV = [
  { label: "실시간 예배", href: "/worship/live" },
  { label: "설교 영상", href: "/worship/sermon" },
  { label: "찬양 영상", href: "/worship/praise" },
  { label: "예배시간 안내", href: "/worship/schedule" },
  { label: "주보 보기", href: "/worship/bulletin" },
];

// ── 조이풀TV (설교 영상) ─────────────────────────────────────────
const SERMON_VIDEOS = [
  { id: "1", badge: "주일예배", title: "처음 익은 열매로 여호와를 공경하라", preacher: "홍길동 목사", date: "2026.03.29", duration: "52분", thumb: "https://images.unsplash.com/photo-1504052434569-70ad5836ab65?w=400&q=70" },
  { id: "2", badge: "수요예배", title: "믿음으로 나아가는 삶", preacher: "홍길동 목사", date: "2026.03.26", duration: "38분", thumb: "https://images.unsplash.com/photo-1529070538774-1843cb3265df?w=400&q=70" },
  { id: "3", badge: "새벽기도", title: "하나님의 은혜가 넘치는 곳", preacher: "홍길동 목사", date: "2026.03.25", duration: "25분", thumb: "https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=400&q=70" },
  { id: "4", badge: "주일예배", title: "감사하는 삶의 능력", preacher: "홍길동 목사", date: "2026.03.22", duration: "48분", thumb: "https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=400&q=70" },
  { id: "5", badge: "특별집회", title: "부흥의 불꽃이 타오르다", preacher: "이요한 목사 (특강)", date: "2026.03.18", duration: "65분", thumb: "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=400&q=70" },
  { id: "6", badge: "주일예배", title: "새 힘을 얻는 자의 비결", preacher: "홍길동 목사", date: "2026.03.15", duration: "50분", thumb: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&q=70" },
];

const BADGE_COLORS: Record<string, string> = {
  "주일예배": "bg-green-100 text-green-700",
  "수요예배": "bg-blue-100 text-blue-700",
  "새벽기도": "bg-amber-100 text-amber-700",
  "특별집회": "bg-purple-100 text-purple-700",
};

export function JoyfulTV() {
  const [filter, setFilter] = useState("전체");
  const filters = ["전체", "주일예배", "수요예배", "새벽기도", "특별집회"];
  const filtered = filter === "전체" ? SERMON_VIDEOS : SERMON_VIDEOS.filter(v => v.badge === filter);

  return (
    <div className="min-h-screen bg-[#F7F7F5]">
      <PageHeader title="조이풀TV" subtitle="기쁨의교회 예배와 설교 영상을 만나보세요" breadcrumb={["조이풀TV", "설교 영상"]} />
      <SubNav items={WORSHIP_NAV} />
      <div className="max-w-5xl mx-auto px-4 py-10">
        {/* 최신 영상 (큰 카드) */}
        <div className="bg-white rounded-2xl overflow-hidden shadow-sm mb-10">
          <div className="relative aspect-video bg-gray-900">
            <img src={SERMON_VIDEOS[0].thumb} alt="최신 설교" className="w-full h-full object-cover opacity-80" />
            <div className="absolute inset-0 flex items-center justify-center">
              <button className="w-20 h-20 rounded-full bg-white/90 hover:bg-white transition-colors flex items-center justify-center shadow-xl">
                <i className="fas fa-play text-[#1B5E20] text-2xl ml-1"></i>
              </button>
            </div>
            <span className={`absolute top-4 left-4 text-xs px-3 py-1.5 rounded-full font-medium ${BADGE_COLORS[SERMON_VIDEOS[0].badge]}`}>
              {SERMON_VIDEOS[0].badge}
            </span>
          </div>
          <div className="p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-2" style={{ fontFamily: "'Noto Serif KR', serif" }}>{SERMON_VIDEOS[0].title}</h2>
            <p className="text-gray-500 text-sm">{SERMON_VIDEOS[0].preacher} · {SERMON_VIDEOS[0].date} · {SERMON_VIDEOS[0].duration}</p>
          </div>
        </div>

        {/* 필터 */}
        <div className="flex gap-2 flex-wrap mb-6">
          {filters.map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${filter === f ? "bg-[#1B5E20] text-white" : "bg-white text-gray-600 hover:bg-gray-50 border border-gray-200"}`}>
              {f}
            </button>
          ))}
        </div>

        {/* 영상 목록 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map(v => (
            <div key={v.id} className="bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow group cursor-pointer">
              <div className="relative aspect-video bg-gray-100">
                <img src={v.thumb} alt={v.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                  <i className="fas fa-play text-white text-2xl opacity-0 group-hover:opacity-100 transition-opacity"></i>
                </div>
                <span className={`absolute top-2 left-2 text-xs px-2 py-1 rounded-full font-medium ${BADGE_COLORS[v.badge] || "bg-gray-100 text-gray-700"}`}>{v.badge}</span>
                <span className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-0.5 rounded">{v.duration}</span>
              </div>
              <div className="p-4">
                <h3 className="font-bold text-gray-800 text-sm leading-snug mb-1.5 line-clamp-2" style={{ fontFamily: "'Noto Serif KR', serif" }}>{v.title}</h3>
                <p className="text-gray-400 text-xs">{v.preacher} · {v.date}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── 예배시간 안내 ─────────────────────────────────────────────────
const WORSHIP_TIMES = [
  {
    name: "주일예배",
    icon: "fa-sun",
    color: "border-[#1B5E20] bg-[#E8F5E9]",
    iconColor: "text-[#1B5E20]",
    times: [
      { label: "1부 예배", time: "오전 7:30", note: "본당" },
      { label: "2부 예배", time: "오전 9:00", note: "본당" },
      { label: "3부 예배", time: "오전 11:00", note: "본당 (주요 예배)" },
      { label: "4부 예배", time: "오후 1:30", note: "본당" },
      { label: "온라인 예배", time: "오전 11:00", note: "유튜브 실시간 방송" },
    ],
  },
  {
    name: "수요예배",
    icon: "fa-church",
    color: "border-blue-400 bg-blue-50",
    iconColor: "text-blue-600",
    times: [
      { label: "수요예배", time: "오전 11:00", note: "본당" },
      { label: "수요예배", time: "오후 7:30", note: "본당" },
    ],
  },
  {
    name: "새벽기도회",
    icon: "fa-moon",
    color: "border-amber-400 bg-amber-50",
    iconColor: "text-amber-600",
    times: [
      { label: "새벽기도", time: "오전 5:30", note: "월~토 / 본당" },
    ],
  },
  {
    name: "금요기도회",
    icon: "fa-fire",
    color: "border-rose-400 bg-rose-50",
    iconColor: "text-rose-600",
    times: [
      { label: "금요기도회", time: "오후 8:00", note: "본당" },
    ],
  },
];

export function WorshipSchedule() {
  return (
    <div className="min-h-screen bg-[#F7F7F5]">
      <PageHeader title="예배시간 안내" subtitle="기쁨의교회 예배 일정을 확인하세요" breadcrumb={["조이풀TV", "예배시간 안내"]} />
      <SubNav items={WORSHIP_NAV} />
      <div className="max-w-5xl mx-auto px-4 py-14">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {WORSHIP_TIMES.map((wt, i) => (
            <div key={i} className={`bg-white rounded-2xl border-l-4 p-7 shadow-sm ${wt.color}`}>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center">
                  <i className={`fas ${wt.icon} ${wt.iconColor}`}></i>
                </div>
                <h3 className="text-lg font-bold text-gray-800" style={{ fontFamily: "'Noto Serif KR', serif" }}>{wt.name}</h3>
              </div>
              <div className="space-y-3">
                {wt.times.map((t, j) => (
                  <div key={j} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                    <span className="text-sm text-gray-600">{t.label}</span>
                    <div className="text-right">
                      <span className="font-bold text-gray-800 text-base">{t.time}</span>
                      <p className="text-xs text-gray-400 mt-0.5">{t.note}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-8 bg-[#E8F5E9] rounded-2xl p-6 text-sm text-[#1B5E20]">
          <i className="fas fa-info-circle mr-2"></i>
          예배 시간은 교회 사정에 따라 변경될 수 있습니다. 변경 사항은 주보 및 교회 공지를 통해 안내드립니다.
        </div>
      </div>
    </div>
  );
}

// ── 주보 보기 ─────────────────────────────────────────────────────
const BULLETINS = [
  { date: "2026.03.29", title: "2026년 3월 29일 주보", week: "제13주", size: "2.4MB" },
  { date: "2026.03.22", title: "2026년 3월 22일 주보", week: "제12주", size: "2.1MB" },
  { date: "2026.03.15", title: "2026년 3월 15일 주보", week: "제11주", size: "2.3MB" },
  { date: "2026.03.08", title: "2026년 3월 8일 주보", week: "제10주", size: "2.2MB" },
  { date: "2026.03.01", title: "2026년 3월 1일 주보 (삼일절)", week: "제9주", size: "2.5MB" },
  { date: "2026.02.22", title: "2026년 2월 22일 주보", week: "제8주", size: "2.0MB" },
];

export function Bulletin() {
  return (
    <div className="min-h-screen bg-[#F7F7F5]">
      <PageHeader title="주보 보기" subtitle="매주 주보를 PDF로 다운로드하실 수 있습니다" breadcrumb={["조이풀TV", "주보 보기"]} />
      <SubNav items={WORSHIP_NAV} />
      <div className="max-w-4xl mx-auto px-4 py-14">
        {/* 최신 주보 미리보기 */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden mb-8">
          <div className="bg-[#1B5E20] px-6 py-4 flex items-center justify-between">
            <div>
              <span className="text-green-200 text-xs font-medium">최신 주보</span>
              <h2 className="text-white font-bold mt-0.5" style={{ fontFamily: "'Noto Serif KR', serif" }}>{BULLETINS[0].title}</h2>
            </div>
            <button className="bg-white text-[#1B5E20] text-sm font-medium px-5 py-2 rounded-full hover:bg-green-50 transition-colors flex items-center gap-2">
              <i className="fas fa-download text-xs"></i> 다운로드
            </button>
          </div>
          <div className="h-64 bg-gray-100 flex items-center justify-center">
            <div className="text-center">
              <i className="fas fa-file-pdf text-5xl text-gray-300 mb-3"></i>
              <p className="text-gray-400 text-sm">주보 미리보기</p>
              <p className="text-gray-300 text-xs mt-1">(PDF 뷰어 연결 예정)</p>
            </div>
          </div>
        </div>

        {/* 주보 목록 */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="font-bold text-gray-800">주보 목록</h3>
          </div>
          <div className="divide-y divide-gray-50">
            {BULLETINS.map((b, i) => (
              <div key={i} className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-[#E8F5E9] flex items-center justify-center">
                    <i className="fas fa-file-pdf text-[#1B5E20] text-sm"></i>
                  </div>
                  <div>
                    <p className="font-medium text-gray-800 text-sm">{b.title}</p>
                    <p className="text-gray-400 text-xs mt-0.5">{b.week} · {b.size}</p>
                  </div>
                </div>
                <button className="text-[#1B5E20] hover:text-[#2E7D32] transition-colors text-sm flex items-center gap-1.5 font-medium">
                  <i className="fas fa-download text-xs"></i> 다운로드
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
