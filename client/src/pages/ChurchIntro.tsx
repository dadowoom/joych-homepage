/**
 * ChurchIntro.tsx
 * 교회소개 신규 페이지: 섬기는분, 교회백서, 사역원리, CI, 셔틀버스
 */

import { Link } from "wouter";
import { ArrowLeft, ChevronRight, Bus, BookOpen, Heart, Palette } from "lucide-react";

function PageWrapper({ title, breadcrumb, children }: { title: string; breadcrumb: string[]; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white">
      <div className="bg-gradient-to-r from-[#1b4332] to-[#2d6a4f] text-white py-16">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex items-center gap-2 text-green-200 text-sm mb-3">
            {breadcrumb.map((item, i) => (
              <span key={i} className="flex items-center gap-2">
                {i > 0 && <ChevronRight className="w-3 h-3" />}
                {item}
              </span>
            ))}
          </div>
          <h1 className="text-4xl font-bold font-['Noto_Serif_KR']">{title}</h1>
        </div>
      </div>
      <div className="max-w-6xl mx-auto px-4 py-12">
        <button onClick={() => window.history.back()} className="inline-flex items-center gap-2 text-[#2d6a4f] hover:underline mb-8 text-sm">
          <ArrowLeft className="w-4 h-4" /> 뒤로 가기
        </button>
        {children}
      </div>
    </div>
  );
}

// ── 섬기는 분 ──
const staffList = [
  { role: "담임목사", name: "박진석", desc: "기쁨의교회를 이끄는 담임목사님입니다.", img: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&q=80" },
];

export function StaffPage() {
  return (
    <PageWrapper title="섬기는 분" breadcrumb={["교회소개", "섬기는 분"]}>
      <p className="text-gray-600 mb-10 text-lg">기쁨의교회를 섬기는 목회자와 사역자들을 소개합니다.</p>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
        {staffList.map((staff, i) => (
          <div key={i} className="text-center group">
            <div className="relative w-40 h-40 mx-auto mb-4 rounded-full overflow-hidden border-4 border-[#d8f3dc] group-hover:border-[#2d6a4f] transition-colors">
              <img src={staff.img} alt={staff.name} className="w-full h-full object-cover" />
            </div>
            <div className="inline-block bg-[#d8f3dc] text-[#1b4332] text-xs font-semibold px-3 py-1 rounded-full mb-2">{staff.role}</div>
            <h3 className="text-xl font-bold text-gray-900 mb-1 font-['Noto_Serif_KR']">{staff.name}</h3>
            <p className="text-gray-600 text-sm">{staff.desc}</p>
          </div>
        ))}
      </div>
    </PageWrapper>
  );
}

// ── 교회백서 ──
const whiteBookSections = [
  { year: "2024", title: "2024 기쁨의교회 백서", desc: "2024년 한 해 동안의 교회 사역 현황, 재정 보고, 성도 현황 등을 담은 연간 보고서입니다.", pages: 48 },
  { year: "2023", title: "2023 기쁨의교회 백서", desc: "2023년 교회 사역 전반에 대한 종합 보고서입니다.", pages: 52 },
  { year: "2022", title: "2022 기쁨의교회 백서", desc: "2022년 교회 사역 전반에 대한 종합 보고서입니다.", pages: 44 },
];

export function WhiteBookPage() {
  return (
    <PageWrapper title="교회백서" breadcrumb={["교회소개", "교회백서"]}>
      <div className="flex items-start gap-4 bg-[#d8f3dc] rounded-xl p-6 mb-10">
        <BookOpen className="w-8 h-8 text-[#2d6a4f] mt-1 flex-shrink-0" />
        <div>
          <h2 className="font-bold text-[#1b4332] mb-1">교회백서란?</h2>
          <p className="text-gray-700 text-sm leading-relaxed">
            교회백서는 기쁨의교회가 매년 발행하는 연간 보고서입니다. 한 해 동안의 사역 현황, 재정 투명성, 성도 현황 등을 성도들과 투명하게 공유합니다.
          </p>
        </div>
      </div>
      <div className="space-y-6">
        {whiteBookSections.map((book, i) => (
          <div key={i} className="border border-gray-200 rounded-xl p-6 flex items-center justify-between hover:shadow-md transition-shadow">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-[#1b4332] text-white rounded-xl flex items-center justify-center font-bold text-lg">{book.year}</div>
              <div>
                <h3 className="font-bold text-gray-900">{book.title}</h3>
                <p className="text-gray-600 text-sm mt-1">{book.desc}</p>
                <p className="text-gray-400 text-xs mt-1">총 {book.pages}페이지</p>
              </div>
            </div>
            <button className="bg-[#2d6a4f] text-white px-4 py-2 rounded-lg text-sm hover:bg-[#1b4332] transition-colors whitespace-nowrap">
              PDF 보기
            </button>
          </div>
        ))}
      </div>
    </PageWrapper>
  );
}

// ── 사역원리 ──
const principles = [
  { title: "말씀 중심", icon: "📖", desc: "모든 사역의 근거는 하나님의 말씀입니다. 성경의 가르침을 삶 속에서 실천하는 교회를 지향합니다.", verse: "\"모든 성경은 하나님의 감동으로 된 것으로 교훈과 책망과 바르게 함과 의로 교육하기에 유익하니\" (딤후 3:16)" },
  { title: "기도의 교회", icon: "🙏", desc: "기도는 교회 사역의 동력입니다. 개인 기도, 소그룹 기도, 교회 공동 기도를 통해 하나님과 깊이 교제합니다.", verse: "\"쉬지 말고 기도하라\" (살전 5:17)" },
  { title: "제자 삼는 교회", icon: "✝️", desc: "예수님의 지상 명령에 순종하여 모든 성도가 예수님의 제자가 되고, 또 다른 제자를 세우는 사역을 감당합니다.", verse: "\"그러므로 너희는 가서 모든 민족을 제자로 삼아\" (마 28:19)" },
  { title: "선교하는 교회", icon: "🌍", desc: "땅 끝까지 복음을 전하는 선교적 교회입니다. 국내외 선교사를 파송하고 지원하며 세계 선교에 헌신합니다.", verse: "\"오직 성령이 너희에게 임하시면 너희가 권능을 받고 예루살렘과 온 유대와 사마리아와 땅 끝까지 이르러 내 증인이 되리라\" (행 1:8)" },
  { title: "섬기는 교회", icon: "🤝", desc: "예수님의 섬김을 본받아 교회 안팎에서 낮은 자세로 섬기는 공동체를 이룹니다.", verse: "\"인자가 온 것은 섬김을 받으려 함이 아니라 도리어 섬기려 하고\" (마 20:28)" },
  { title: "기쁨의 공동체", icon: "😊", desc: "성령 안에서 기쁨이 넘치는 공동체입니다. 어떤 상황에서도 주 안에서 기뻐하는 교회를 지향합니다.", verse: "\"주 안에서 항상 기뻐하라 내가 다시 말하노니 기뻐하라\" (빌 4:4)" },
];

export function MinistryPrinciplePage() {
  return (
    <PageWrapper title="사역원리" breadcrumb={["교회소개", "사역원리"]}>
      <p className="text-gray-600 mb-10 text-lg leading-relaxed">기쁨의교회가 사역을 감당하는 핵심 원리들을 소개합니다. 이 원리들은 교회의 모든 사역과 프로그램의 기초가 됩니다.</p>
      <div className="grid md:grid-cols-2 gap-8">
        {principles.map((p, i) => (
          <div key={i} className="border border-gray-200 rounded-xl p-6 hover:shadow-md hover:border-[#2d6a4f] transition-all">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-3xl">{p.icon}</span>
              <h3 className="text-xl font-bold text-[#1b4332] font-['Noto_Serif_KR']">{p.title}</h3>
            </div>
            <p className="text-gray-700 text-sm leading-relaxed mb-4">{p.desc}</p>
            <blockquote className="bg-[#F1F8E9] rounded-lg px-4 py-3 text-[#2d6a4f] text-sm italic">{p.verse}</blockquote>
          </div>
        ))}
      </div>
    </PageWrapper>
  );
}

// ── CI (교회 아이덴티티) ──
export function CIPage() {
  return (
    <PageWrapper title="CI" breadcrumb={["교회소개", "CI"]}>
      <div className="flex items-start gap-4 bg-[#d8f3dc] rounded-xl p-6 mb-10">
        <Palette className="w-8 h-8 text-[#2d6a4f] mt-1 flex-shrink-0" />
        <div>
          <h2 className="font-bold text-[#1b4332] mb-1">CI(Church Identity)란?</h2>
          <p className="text-gray-700 text-sm leading-relaxed">
            기쁨의교회의 시각적 정체성을 나타내는 로고, 색상, 서체 등의 디자인 가이드라인입니다. 교회의 모든 공식 자료에 통일된 CI를 사용합니다.
          </p>
        </div>
      </div>

      {/* 로고 섹션 */}
      <section className="mb-12">
        <h2 className="text-2xl font-bold text-[#1b4332] mb-6 font-['Noto_Serif_KR']">공식 로고</h2>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            { bg: "bg-white border-2 border-gray-200", label: "기본형 (흰 배경)", textColor: "text-[#1b4332]" },
            { bg: "bg-[#1b4332]", label: "반전형 (어두운 배경)", textColor: "text-white" },
            { bg: "bg-gray-100", label: "단색형 (회색 배경)", textColor: "text-gray-700" },
          ].map((item, i) => (
            <div key={i} className={`${item.bg} rounded-xl p-8 flex flex-col items-center justify-center min-h-[160px]`}>
              <div className={`text-3xl font-bold font-['Noto_Serif_KR'] ${item.textColor} mb-2`}>기쁨의교회</div>
              <div className={`text-sm ${item.textColor} opacity-70`}>Joy Church</div>
              <p className="text-xs text-gray-400 mt-4">{item.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 색상 팔레트 */}
      <section className="mb-12">
        <h2 className="text-2xl font-bold text-[#1b4332] mb-6 font-['Noto_Serif_KR']">공식 색상</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { color: "#1b4332", name: "딥 그린", hex: "#1b4332", use: "주요 배경, 헤더" },
            { color: "#2d6a4f", name: "메인 그린", hex: "#2d6a4f", use: "포인트 컬러, 버튼" },
            { color: "#52b788", name: "라이트 그린", hex: "#52b788", use: "강조, 아이콘" },
            { color: "#d8f3dc", name: "페일 그린", hex: "#d8f3dc", use: "배경, 카드" },
          ].map((c, i) => (
            <div key={i} className="rounded-xl overflow-hidden border border-gray-200">
              <div className="h-20" style={{ backgroundColor: c.color }} />
              <div className="p-3">
                <p className="font-semibold text-gray-900 text-sm">{c.name}</p>
                <p className="text-gray-500 text-xs">{c.hex}</p>
                <p className="text-gray-400 text-xs mt-1">{c.use}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 다운로드 */}
      <section>
        <h2 className="text-2xl font-bold text-[#1b4332] mb-6 font-['Noto_Serif_KR']">CI 파일 다운로드</h2>
        <div className="grid md:grid-cols-3 gap-4">
          {["로고 AI 파일", "로고 PNG 파일", "CI 가이드라인 PDF"].map((file, i) => (
            <button key={i} className="border-2 border-[#2d6a4f] text-[#2d6a4f] rounded-xl p-4 hover:bg-[#2d6a4f] hover:text-white transition-colors text-sm font-semibold">
              ⬇️ {file}
            </button>
          ))}
        </div>
      </section>
    </PageWrapper>
  );
}

// ── 셔틀버스 ──
const busRoutes = [
  { route: "1호차", area: "주일 셔틀", stops: ["세부 승차 위치는 주보 및 교회 공지를 확인해 주세요.", "교회 도착"], driver: "교회 사무실", contact: "054-270-1000" },
  { route: "2호차", area: "주일 셔틀", stops: ["세부 승차 위치는 안내 데스크로 문의해 주세요.", "교회 도착"], driver: "교회 사무실", contact: "054-270-1000" },
  { route: "3호차", area: "특별 행사", stops: ["행사 일정에 따라 별도 안내됩니다.", "교회 도착"], driver: "교회 사무실", contact: "054-270-1000" },
];

export function ShuttleBusPage() {
  return (
    <PageWrapper title="셔틀버스" breadcrumb={["교회소개", "셔틀버스"]}>
      <div className="flex items-start gap-4 bg-[#d8f3dc] rounded-xl p-6 mb-10">
        <Bus className="w-8 h-8 text-[#2d6a4f] mt-1 flex-shrink-0" />
        <div>
          <h2 className="font-bold text-[#1b4332] mb-1">셔틀버스 운행 안내</h2>
          <ul className="text-gray-700 text-sm space-y-1">
            <li>• 운행 시간: 매주 주일 오전 (1부 예배 기준)</li>
            <li>• 탑승 신청: 교회 행정실 또는 각 차량 담당자에게 연락</li>
            <li>• 문의: 054-270-1000</li>
          </ul>
        </div>
      </div>
      <div className="grid md:grid-cols-2 gap-6">
        {busRoutes.map((bus, i) => (
          <div key={i} className="border border-gray-200 rounded-xl p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#1b4332] text-white rounded-full flex items-center justify-center font-bold text-sm">{bus.route}</div>
                <div>
                  <h3 className="font-bold text-gray-900">{bus.area}</h3>
              <p className="text-xs text-gray-500">문의: {bus.driver}</p>
                </div>
              </div>
              <a href={`tel:${bus.contact}`} className="text-[#2d6a4f] text-sm font-semibold hover:underline">{bus.contact}</a>
            </div>
            <div className="space-y-2">
              {bus.stops.map((stop, j) => (
                <div key={j} className="flex items-center gap-3 text-sm">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${j === bus.stops.length - 1 ? "bg-[#2d6a4f]" : "bg-gray-300"}`} />
                  <span className={j === bus.stops.length - 1 ? "text-[#2d6a4f] font-semibold" : "text-gray-600"}>{stop}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </PageWrapper>
  );
}
