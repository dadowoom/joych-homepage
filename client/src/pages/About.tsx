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
const PASTOR_CAREER = [
  { icon: "fa-graduation-cap", text: "장로회신학대학교 신학과 졸업" },
  { icon: "fa-graduation-cap", text: "장로회신학대학교 신학대학원 졸업 (M.Div)" },
  { icon: "fa-graduation-cap", text: "미국 풀러신학교 목회학박사 (D.Min)" },
  { icon: "fa-church", text: "서울 강남교회 부목사 (1998~2004)" },
  { icon: "fa-church", text: "기쁨의교회 담임목사 (2005~현재)" },
  { icon: "fa-book", text: "저서: 《기쁨으로 걷는 길》 외 3권" },
];

export function PastorGreeting() {
  return (
    <div className="min-h-screen bg-[#F7F7F5]">
      <PageHeader title="담임목사 인사말" breadcrumb={["교회소개", "담임목사 인사말"]} />
      <SubNav items={ABOUT_NAV} />

      {/* ── 목사 프로필 히어로 ── */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-4 py-12">
          <div className="flex flex-col md:flex-row gap-10 items-center md:items-start">
            {/* 사진 */}
            <div className="flex-shrink-0">
              <div className="w-56 h-72 md:w-64 md:h-80 rounded-2xl overflow-hidden shadow-xl border border-gray-100">
                <img
src="https://d2xsxph8kpxj0f.cloudfront.net/310519663470178900/KASTcRBzh5rwhJEekrJN6E/pastor-profile-new_c659c67e.jpg"
                   alt="담임목사 박진석"
                  className="w-full h-full object-cover object-top"
                />
              </div>
            </div>
            {/* 기본 정보 */}
            <div className="flex-1">
              <p className="text-[#1B5E20] text-sm font-semibold tracking-widest uppercase mb-2">Senior Pastor</p>
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-1" style={{ fontFamily: "'Noto Serif KR', serif" }}>박진석 목사</h2>
              <p className="text-gray-500 text-base mb-6">기쁨의교회 담임목사</p>
              <div className="w-12 h-0.5 bg-[#1B5E20] mb-6"></div>
              <ul className="space-y-3">
                {PASTOR_CAREER.map((item, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-gray-600">
                    <i className={`fas ${item.icon} text-[#1B5E20] w-4 mt-0.5 flex-shrink-0`}></i>
                    <span>{item.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* ── 인사말 본문 ── */}
      <div className="max-w-4xl mx-auto px-4 py-14">
        {/* 대표 말씀 */}
        <div className="relative bg-[#1B5E20] text-white rounded-2xl p-8 mb-10 overflow-hidden">
          <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2"></div>
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2"></div>
          <i className="fas fa-quote-left text-3xl text-green-300 mb-4 block"></i>
          <p className="text-xl md:text-2xl font-medium leading-relaxed relative z-10" style={{ fontFamily: "'Noto Serif KR', serif" }}>
            처음 익은 열매로 여호와를 공경하라
          </p>
          <p className="text-green-200 text-sm mt-3 relative z-10">잠언 3장 9절 — 2025년 기쁨의교회 표어 말씀</p>
        </div>

        {/* 인사말 본문 — 이미지 */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="flex flex-col md:flex-row gap-0">
            {/* 인사말 텍스트 이미지 */}
            <div className="flex-1">
              <img
                src="https://d2xsxph8kpxj0f.cloudfront.net/310519663470178900/KASTcRBzh5rwhJEekrJN6E/pastor-greeting_dbd99752.png"
                alt="담임목사 인사말"
                className="w-full h-auto block"
              />
            </div>
          </div>
          <div className="px-8 pb-6 flex flex-col items-end gap-1 border-t border-gray-100">
            <p className="font-bold text-gray-800 text-base mt-4">박진석 목사</p>
            <p className="text-[#1B5E20] text-sm">기쁨의교회 담임목사</p>
          </div>
        </div>

        {/* 하단 사역 소개 카드 */}
        <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-5">
          {[
            { icon: "fa-microphone", title: "주일 설교", desc: "매주일 오전 9시, 11시 강해 설교" },
            { icon: "fa-book-open", title: "성경 강좌", desc: "매월 첫째 주 수요일 심층 성경 강의" },
            { icon: "fa-hands-praying", title: "새벽기도", desc: "월~토 오전 5시 30분 새벽기도회" },
          ].map((item, i) => (
            <div key={i} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 flex gap-4 items-start">
              <div className="w-10 h-10 rounded-full bg-[#E8F5E9] flex items-center justify-center flex-shrink-0">
                <i className={`fas ${item.icon} text-[#1B5E20] text-sm`}></i>
              </div>
              <div>
                <p className="font-semibold text-gray-800 text-sm mb-1">{item.title}</p>
                <p className="text-gray-500 text-xs leading-relaxed">{item.desc}</p>
              </div>
            </div>
          ))}
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
