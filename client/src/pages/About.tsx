/**
 * 기쁨의교회 — 교회소개 그룹 페이지
 * 디자인: Warm Modern Sacred — 녹색 포인트, Noto Serif KR, 넓은 여백
 * 포함: PastorGreeting / ChurchHistory / ChurchVision / Location
 */

import { Link } from "wouter";

// ── 공통 레이아웃 컴포넌트 ──────────────────────────────────────
function PageHeader({ title, subtitle, breadcrumb }: { title: string; subtitle?: string; breadcrumb: string[] }) {
  return (
    <div className="bg-[#1B5E20] text-white py-16 px-4">
      <div className="max-w-5xl mx-auto">
        <nav className="text-sm text-green-200 mb-4 flex items-center gap-2">
          <Link href="/" className="hover:text-white transition-colors">홈</Link>
          {breadcrumb.map((b, i) => (
            <span key={i} className="flex items-center gap-2">
              <i className="fas fa-chevron-right text-xs text-green-400"></i>
              <span className={i === breadcrumb.length - 1 ? "text-white font-medium" : "hover:text-white"}>{b}</span>
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

const ABOUT_NAV = [
  { label: "담임목사 인사말", href: "/about/pastor" },
  { label: "교회 역사", href: "/about/history" },
  { label: "교회 비전", href: "/about/vision" },
  { label: "오시는 길", href: "/about/location" },
];

// ── 담임목사 인사말 ──────────────────────────────────────────────
export function PastorGreeting() {
  return (
    <div className="min-h-screen bg-[#F7F7F5]">
      <PageHeader title="담임목사 인사말" breadcrumb={["교회소개", "담임목사 인사말"]} />
      <SubNav items={ABOUT_NAV} />
      <div className="max-w-5xl mx-auto px-4 py-14">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 items-start">
          {/* 프로필 */}
          <div className="md:col-span-1 flex flex-col items-center text-center">
            <div className="w-48 h-48 rounded-full overflow-hidden border-4 border-[#E8F5E9] shadow-lg mb-5">
              <img src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&q=80" alt="담임목사" className="w-full h-full object-cover" />
            </div>
            <h2 className="text-xl font-bold text-gray-800" style={{ fontFamily: "'Noto Serif KR', serif" }}>홍길동 목사</h2>
            <p className="text-[#1B5E20] text-sm font-medium mt-1">기쁨의교회 담임목사</p>
            <div className="mt-5 w-full bg-white rounded-xl p-5 shadow-sm text-left space-y-2 text-sm text-gray-600">
              <div className="flex gap-3"><i className="fas fa-graduation-cap text-[#1B5E20] w-4 mt-0.5"></i><span>장로회신학대학교 신학과 졸업</span></div>
              <div className="flex gap-3"><i className="fas fa-graduation-cap text-[#1B5E20] w-4 mt-0.5"></i><span>장로회신학대학교 신학대학원 졸업 (M.Div)</span></div>
              <div className="flex gap-3"><i className="fas fa-church text-[#1B5E20] w-4 mt-0.5"></i><span>기쁨의교회 담임목사 (2005~현재)</span></div>
            </div>
          </div>
          {/* 인사말 본문 */}
          <div className="md:col-span-2">
            <div className="bg-[#E8F5E9] border-l-4 border-[#1B5E20] rounded-r-xl p-6 mb-8">
              <p className="text-[#1B5E20] font-medium text-base leading-relaxed" style={{ fontFamily: "'Noto Serif KR', serif" }}>
                "처음 익은 열매로 여호와를 공경하라" — 잠언 3장 9절
              </p>
            </div>
            <div className="bg-white rounded-2xl p-8 shadow-sm space-y-5 text-gray-700 leading-8 text-[15px]">
              <p>기쁨의교회 홈페이지를 방문해 주신 여러분을 진심으로 환영합니다.</p>
              <p>우리 기쁨의교회는 1985년 창립 이래 40여 년간 하나님의 은혜 가운데 성장해 왔습니다. 말씀 위에 굳게 서서, 기도로 하나 되고, 이웃을 섬기는 교회로 이 땅에서 빛과 소금의 역할을 감당하고자 합니다.</p>
              <p>우리 교회는 "깊이 있는 성장, 위대한 교회"라는 비전 아래, 성도 한 사람 한 사람이 하나님 앞에서 온전히 세워지고, 가정과 사회 속에서 그리스도의 향기를 발하는 삶을 살아가도록 돕고 있습니다.</p>
              <p>새가족으로 오시는 분들, 믿음의 여정을 함께하고 싶으신 분들 모두를 따뜻하게 맞이합니다. 기쁨의교회가 여러분의 영적 가정이 되기를 소망합니다.</p>
              <p className="text-right font-medium text-gray-800 pt-4" style={{ fontFamily: "'Noto Serif KR', serif" }}>기쁨의교회 담임목사 홍길동</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── 교회 역사 ────────────────────────────────────────────────────
const HISTORY_ITEMS = [
  { year: "1985", title: "기쁨의교회 창립", desc: "서울 강남구 소재 작은 예배당에서 30여 명의 성도와 함께 창립 예배를 드리다." },
  { year: "1990", title: "교육관 건축", desc: "교육관 신축 완공으로 어린이·청소년 사역의 기반을 마련하다." },
  { year: "1995", title: "창립 10주년 기념", desc: "성도 500명 돌파 및 창립 10주년 감사 예배를 드리다. 해외 선교 파송 시작." },
  { year: "2000", title: "본당 이전 및 증축", desc: "현재 위치로 본당을 이전하고 1,000석 규모의 예배당을 완공하다." },
  { year: "2005", title: "2대 담임목사 취임", desc: "홍길동 목사가 2대 담임목사로 취임하다. 지역 사회 복지 사역 확대." },
  { year: "2010", title: "기쁨의복지재단 설립", desc: "지역 사회 섬김을 위한 기쁨의복지재단을 설립하고 복지관 운영을 시작하다." },
  { year: "2015", title: "창립 30주년", desc: "성도 3,000명 돌파 및 창립 30주년 기념 감사 예배. 10개국 선교사 파송." },
  { year: "2020", title: "온라인 예배 시작", desc: "코로나19 상황 속에서도 온라인 예배를 통해 성도들과 함께하다. 조이풀TV 채널 개설." },
  { year: "2025", title: "창립 40주년", desc: "창립 40주년을 맞이하여 감사 예배와 함께 새로운 비전을 선포하다." },
];

export function ChurchHistory() {
  return (
    <div className="min-h-screen bg-[#F7F7F5]">
      <PageHeader title="교회 역사" subtitle="하나님의 은혜로 걸어온 40년의 발자취" breadcrumb={["교회소개", "교회 역사"]} />
      <SubNav items={ABOUT_NAV} />
      <div className="max-w-4xl mx-auto px-4 py-14">
        <div className="relative">
          {/* 타임라인 세로선 */}
          <div className="absolute left-[28px] md:left-1/2 top-0 bottom-0 w-0.5 bg-[#C8E6C9] -translate-x-1/2"></div>
          <div className="space-y-10">
            {HISTORY_ITEMS.map((item, i) => (
              <div key={i} className={`relative flex items-start gap-6 ${i % 2 === 0 ? "md:flex-row" : "md:flex-row-reverse"}`}>
                {/* 연도 원 */}
                <div className="flex-shrink-0 w-14 h-14 rounded-full bg-[#1B5E20] text-white flex flex-col items-center justify-center shadow-lg z-10 relative md:absolute md:left-1/2 md:-translate-x-1/2">
                  <span className="text-xs font-bold leading-tight">{item.year}</span>
                </div>
                {/* 내용 카드 */}
                <div className={`ml-20 md:ml-0 md:w-[45%] bg-white rounded-2xl p-6 shadow-sm ${i % 2 === 0 ? "md:mr-auto md:pr-10" : "md:ml-auto md:pl-10"}`}>
                  <h3 className="font-bold text-gray-800 text-base mb-2" style={{ fontFamily: "'Noto Serif KR', serif" }}>{item.title}</h3>
                  <p className="text-gray-600 text-sm leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── 교회 비전 ────────────────────────────────────────────────────
const VISION_ITEMS = [
  { icon: "fa-bible", title: "말씀 중심의 교회", desc: "하나님의 말씀이 삶의 기준이 되는 교회. 강해 설교와 성경 교육을 통해 성도들이 말씀 위에 굳게 서도록 돕습니다.", color: "bg-green-50 border-green-200" },
  { icon: "fa-hands-praying", title: "기도의 교회", desc: "새벽기도, 수요기도회, 중보기도팀을 통해 교회와 세상을 위해 쉬지 않고 기도하는 교회입니다.", color: "bg-blue-50 border-blue-200" },
  { icon: "fa-globe-asia", title: "선교하는 교회", desc: "국내외 선교사를 파송하고 지원하며, 땅 끝까지 복음을 전하는 사명을 감당합니다.", color: "bg-amber-50 border-amber-200" },
  { icon: "fa-heart", title: "섬기는 교회", desc: "지역 사회와 이웃을 섬기는 교회. 복지재단과 사회복지관 운영을 통해 그리스도의 사랑을 실천합니다.", color: "bg-rose-50 border-rose-200" },
  { icon: "fa-seedling", title: "다음 세대를 세우는 교회", desc: "어린이부터 청년까지 다음 세대가 믿음 안에서 건강하게 성장할 수 있도록 투자하고 훈련합니다.", color: "bg-purple-50 border-purple-200" },
  { icon: "fa-users", title: "공동체 교회", desc: "소그룹 중심의 목장 공동체를 통해 성도들이 서로 돌보고 격려하며 함께 성장하는 교회입니다.", color: "bg-teal-50 border-teal-200" },
];

export function ChurchVision() {
  return (
    <div className="min-h-screen bg-[#F7F7F5]">
      <PageHeader title="교회 비전" subtitle="깊이 있는 성장, 위대한 교회" breadcrumb={["교회소개", "교회 비전"]} />
      <SubNav items={ABOUT_NAV} />
      <div className="max-w-5xl mx-auto px-4 py-14">
        {/* 핵심 비전 */}
        <div className="text-center mb-14">
          <div className="inline-block bg-[#E8F5E9] rounded-2xl px-10 py-8">
            <p className="text-[#1B5E20] text-sm font-medium tracking-widest mb-3">2026 교회 주제</p>
            <h2 className="text-2xl md:text-3xl font-bold text-gray-800" style={{ fontFamily: "'Noto Serif KR', serif" }}>
              처음 익은 열매로 여호와를 공경하라
            </h2>
            <p className="text-gray-500 text-sm mt-3">잠언 3장 9절</p>
          </div>
        </div>
        {/* 비전 카드 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {VISION_ITEMS.map((item, i) => (
            <div key={i} className={`rounded-2xl border p-7 ${item.color}`}>
              <div className="w-12 h-12 rounded-full bg-white shadow-sm flex items-center justify-center mb-5">
                <i className={`fas ${item.icon} text-[#1B5E20] text-lg`}></i>
              </div>
              <h3 className="font-bold text-gray-800 text-base mb-3" style={{ fontFamily: "'Noto Serif KR', serif" }}>{item.title}</h3>
              <p className="text-gray-600 text-sm leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── 오시는 길 ────────────────────────────────────────────────────
export function Location() {
  return (
    <div className="min-h-screen bg-[#F7F7F5]">
      <PageHeader title="오시는 길" subtitle="기쁨의교회로 오시는 방법을 안내해 드립니다" breadcrumb={["교회소개", "오시는 길"]} />
      <SubNav items={ABOUT_NAV} />
      <div className="max-w-5xl mx-auto px-4 py-14">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* 지도 영역 */}
          <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
            <div className="h-72 bg-gradient-to-br from-green-100 to-green-200 flex items-center justify-center">
              <div className="text-center">
                <i className="fas fa-map-marker-alt text-5xl text-[#1B5E20] mb-3"></i>
                <p className="text-[#1B5E20] font-medium text-sm">지도가 여기에 표시됩니다</p>
                <p className="text-gray-500 text-xs mt-1">(DB 연결 후 구글 지도 삽입 예정)</p>
              </div>
            </div>
            <div className="p-6">
              <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                <i className="fas fa-map-marker-alt text-[#1B5E20]"></i> 주소
              </h3>
              <p className="text-gray-600 text-sm">서울특별시 강남구 기쁨로 123 기쁨의교회</p>
              <p className="text-gray-400 text-xs mt-1">(우편번호: 06000)</p>
            </div>
          </div>
          {/* 교통 안내 */}
          <div className="space-y-5">
            {[
              { icon: "fa-subway", title: "지하철 이용", color: "bg-blue-50 border-blue-200", items: ["2호선 강남역 3번 출구 도보 10분", "9호선 신논현역 5번 출구 도보 5분"] },
              { icon: "fa-bus", title: "버스 이용", color: "bg-green-50 border-green-200", items: ["간선버스: 140, 144, 146번 — 기쁨의교회 정류장 하차", "지선버스: 3412, 4412번 — 기쁨의교회 정류장 하차"] },
              { icon: "fa-car", title: "자가용 이용", color: "bg-amber-50 border-amber-200", items: ["강남대로 → 기쁨로 우회전 → 교회 주차장 진입", "주차 가능 대수: 300대 (지하 3층)"] },
              { icon: "fa-phone", title: "문의", color: "bg-gray-50 border-gray-200", items: ["전화: 02-000-0000", "이메일: info@joych.org", "운영시간: 평일 09:00~18:00"] },
            ].map((section, i) => (
              <div key={i} className={`rounded-2xl border p-6 ${section.color}`}>
                <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                  <i className={`fas ${section.icon} text-[#1B5E20]`}></i> {section.title}
                </h3>
                <ul className="space-y-1.5">
                  {section.items.map((item, j) => (
                    <li key={j} className="text-gray-600 text-sm flex items-start gap-2">
                      <i className="fas fa-check text-[#1B5E20] text-xs mt-1 flex-shrink-0"></i> {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
