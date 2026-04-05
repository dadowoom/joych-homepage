/**
 * 기쁨의교회 — 선교 그룹 페이지
 * 디자인: Warm Modern Sacred — 녹색 포인트, Noto Serif KR
 * 포함: DomesticMission / OverseasMission / Volunteer
 */

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

const MISSION_NAV = [
  { label: "국내 선교", href: "/mission-work/domestic" },
  { label: "해외 선교", href: "/mission-work/overseas" },
  { label: "봉사 활동", href: "/mission-work/volunteer" },
  { label: "선교보고", href: "/mission" },
];

// ── 국내 선교 ─────────────────────────────────────────────────────
const DOMESTIC_MISSIONS = [
  { name: "농어촌 교회 지원", region: "전라남도 신안군", leader: "이사랑 집사", desc: "도서 지역 작은 교회를 방문하여 예배 지원과 생필품을 전달합니다.", schedule: "분기별 1회", img: "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=400&q=70" },
  { name: "노숙인 사역", region: "서울 영등포구", leader: "박믿음 집사", desc: "매주 토요일 영등포역 일대에서 식사와 복음을 전합니다.", schedule: "매주 토요일", img: "https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?w=400&q=70" },
  { name: "탈북민 정착 지원", region: "서울 강남구", leader: "최소망 집사", desc: "탈북민 가정의 정착을 돕고 신앙 공동체로 연결합니다.", schedule: "월 2회", img: "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=400&q=70" },
];

export function DomesticMission() {
  return (
    <div className="min-h-screen bg-[#F7F7F5]">
      <PageHeader title="국내 선교" subtitle="우리 이웃에게 복음을 전합니다" breadcrumb={["사역/선교", "국내 선교"]} />
      <SubNav items={MISSION_NAV} />
      <div className="max-w-5xl mx-auto px-4 py-14">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {DOMESTIC_MISSIONS.map((m, i) => (
            <div key={i} className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
              <div className="h-44 overflow-hidden">
                <img src={m.img} alt={m.name} className="w-full h-full object-cover hover:scale-105 transition-transform duration-300" />
              </div>
              <div className="p-6">
                <h3 className="font-bold text-gray-800 text-base mb-2" style={{ fontFamily: "'Noto Serif KR', serif" }}>{m.name}</h3>
                <p className="text-gray-500 text-sm leading-relaxed mb-4">{m.desc}</p>
                <div className="space-y-1.5 text-xs text-gray-500">
                  <div className="flex items-center gap-2"><i className="fas fa-map-marker-alt text-[#1B5E20] w-3"></i>{m.region}</div>
                  <div className="flex items-center gap-2"><i className="fas fa-user text-[#1B5E20] w-3"></i>담당: {m.leader}</div>
                  <div className="flex items-center gap-2"><i className="fas fa-calendar text-[#1B5E20] w-3"></i>{m.schedule}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-8 bg-[#1B5E20] rounded-2xl p-8 text-center text-white">
          <h3 className="text-lg font-bold mb-2" style={{ fontFamily: "'Noto Serif KR', serif" }}>국내 선교에 함께하세요</h3>
          <p className="text-green-100 text-sm mb-5">선교팀 참여 문의: 02-000-0004 (선교부)</p>
          <Link href="/community/prayer" className="inline-block bg-white text-[#1B5E20] font-bold px-8 py-3 rounded-full hover:bg-green-50 transition-colors text-sm">
            기도로 함께하기
          </Link>
        </div>
      </div>
    </div>
  );
}

// ── 해외 선교 ─────────────────────────────────────────────────────
const OVERSEAS_MISSIONS = [
  { country: "캄보디아", flag: "🇰🇭", missionary: "김선교 선교사", since: "2010", ministry: "교육 선교 / 학교 운영", img: "https://images.unsplash.com/photo-1528360983277-13d401cdc186?w=400&q=70" },
  { country: "케냐", flag: "🇰🇪", missionary: "이복음 선교사", since: "2013", ministry: "의료 선교 / 진료소 운영", img: "https://images.unsplash.com/photo-1489392191049-fc10c97e64b6?w=400&q=70" },
  { country: "인도", flag: "🇮🇳", missionary: "박은혜 선교사", since: "2015", ministry: "빈민 사역 / 고아원 지원", img: "https://images.unsplash.com/photo-1524492412937-b28074a5d7da?w=400&q=70" },
  { country: "몽골", flag: "🇲🇳", missionary: "최믿음 선교사", since: "2018", ministry: "교회 개척 / 신학교 지원", img: "https://images.unsplash.com/photo-1509316785289-025f5b846b35?w=400&q=70" },
  { country: "필리핀", flag: "🇵🇭", missionary: "정소망 선교사", since: "2020", ministry: "청소년 사역 / 직업훈련", img: "https://images.unsplash.com/photo-1518509562904-e7ef99cdcc86?w=400&q=70" },
];

export function OverseasMission() {
  return (
    <div className="min-h-screen bg-[#F7F7F5]">
      <PageHeader title="해외 선교" subtitle="땅 끝까지 복음을 전합니다" breadcrumb={["사역/선교", "해외 선교"]} />
      <SubNav items={MISSION_NAV} />
      <div className="max-w-5xl mx-auto px-4 py-14">
        {/* 통계 */}
        <div className="grid grid-cols-3 gap-4 mb-10">
          {[
            { label: "파송 선교사", value: "12명", icon: "fa-user-tie" },
            { label: "사역 국가", value: "10개국", icon: "fa-globe-asia" },
            { label: "파송 연도", value: "2003년~", icon: "fa-calendar" },
          ].map((s, i) => (
            <div key={i} className="bg-white rounded-2xl p-6 shadow-sm text-center">
              <i className={`fas ${s.icon} text-[#1B5E20] text-2xl mb-3`}></i>
              <p className="text-2xl font-bold text-gray-800 mb-1" style={{ fontFamily: "'Noto Serif KR', serif" }}>{s.value}</p>
              <p className="text-gray-500 text-xs">{s.label}</p>
            </div>
          ))}
        </div>

        {/* 선교사 목록 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {OVERSEAS_MISSIONS.map((m, i) => (
            <div key={i} className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
              <div className="h-40 overflow-hidden relative">
                <img src={m.img} alt={m.country} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                <div className="absolute bottom-3 left-4 text-white">
                  <span className="text-2xl mr-2">{m.flag}</span>
                  <span className="font-bold text-lg">{m.country}</span>
                </div>
              </div>
              <div className="p-5">
                <h3 className="font-bold text-gray-800 mb-1">{m.missionary}</h3>
                <p className="text-[#1B5E20] text-xs font-medium mb-3">{m.ministry}</p>
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <i className="fas fa-calendar"></i>
                  <span>{m.since}년 파송</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 text-center">
          <Link href="/mission" className="inline-flex items-center gap-2 bg-[#1B5E20] text-white px-8 py-3 rounded-full font-medium hover:bg-[#2E7D32] transition-colors text-sm">
            <i className="fas fa-file-alt"></i> 선교보고 보기
          </Link>
        </div>
      </div>
    </div>
  );
}

// ── 봉사 활동 ─────────────────────────────────────────────────────
const VOLUNTEER_LIST = [
  { title: "주차 봉사팀", icon: "fa-car", schedule: "매주 주일 오전 9:00~오후 2:00", contact: "교통부 (02-000-0002)", desc: "주일 예배 시 교회 주차장 안내 및 교통 정리를 담당합니다.", members: 24 },
  { title: "안내 봉사팀", icon: "fa-hands-helping", schedule: "매주 주일 오전 9:30~오후 1:30", contact: "행정부 (02-000-0000)", desc: "예배당 입구에서 성도들을 안내하고 새가족을 환영합니다.", members: 18 },
  { title: "방송 봉사팀", icon: "fa-video", schedule: "매주 주일 오전 8:00~오후 1:00", contact: "방송부 (02-000-0005)", desc: "예배 영상 촬영, 음향, 조명을 담당합니다.", members: 12 },
  { title: "식당 봉사팀", icon: "fa-utensils", schedule: "매주 주일 오전 10:00~오후 2:00", contact: "친교부 (02-000-0006)", desc: "예배 후 성도들을 위한 식사를 준비하고 제공합니다.", members: 30 },
  { title: "청소 봉사팀", icon: "fa-broom", schedule: "매주 토요일 오전 9:00~11:00", contact: "관리부 (02-000-0007)", desc: "교회 시설 청소 및 환경 관리를 담당합니다.", members: 20 },
  { title: "어린이 돌봄팀", icon: "fa-baby", schedule: "매주 주일 오전 10:30~오후 1:00", contact: "교육부 (02-000-0001)", desc: "예배 시간 동안 영아 및 유아를 돌봅니다.", members: 15 },
];

export function Volunteer() {
  return (
    <div className="min-h-screen bg-[#F7F7F5]">
      <PageHeader title="봉사 활동" subtitle="섬김으로 하나 되는 기쁨의교회" breadcrumb={["사역/선교", "봉사 활동"]} />
      <SubNav items={MISSION_NAV} />
      <div className="max-w-5xl mx-auto px-4 py-14">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {VOLUNTEER_LIST.map((v, i) => (
            <div key={i} className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-[#E8F5E9] flex items-center justify-center flex-shrink-0">
                  <i className={`fas ${v.icon} text-[#1B5E20] text-lg`}></i>
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-bold text-gray-800" style={{ fontFamily: "'Noto Serif KR', serif" }}>{v.title}</h3>
                    <span className="text-xs text-gray-400">{v.members}명</span>
                  </div>
                  <p className="text-gray-500 text-sm leading-relaxed mb-3">{v.desc}</p>
                  <div className="space-y-1 text-xs text-gray-500">
                    <div className="flex items-center gap-2"><i className="fas fa-clock text-[#1B5E20] w-3"></i>{v.schedule}</div>
                    <div className="flex items-center gap-2"><i className="fas fa-phone text-[#1B5E20] w-3"></i>{v.contact}</div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-8 bg-[#1B5E20] rounded-2xl p-8 text-center text-white">
          <h3 className="text-lg font-bold mb-2" style={{ fontFamily: "'Noto Serif KR', serif" }}>봉사팀에 참여하고 싶으신가요?</h3>
          <p className="text-green-100 text-sm mb-5">각 봉사팀 담당자에게 직접 연락하시거나 교회 사무실로 문의해 주세요.</p>
          <a href="tel:02-000-0000" className="inline-block bg-white text-[#1B5E20] font-bold px-8 py-3 rounded-full hover:bg-green-50 transition-colors text-sm">
            <i className="fas fa-phone mr-2"></i>02-000-0000
          </a>
        </div>
      </div>
    </div>
  );
}
