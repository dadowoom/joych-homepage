/**
 * 기쁨의교회 — 커뮤니티/행정 그룹 페이지
 * 디자인: Warm Modern Sacred — 녹색 포인트, Noto Serif KR
 * 포함: ChurchNews / PrayerRequest / Offering / VehicleGuide / NewMemberGuide / JoyfulStore
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

const COMMUNITY_NAV = [
  { label: "교회 소식", href: "/community/news" },
  { label: "기도 요청", href: "/community/prayer" },
  { label: "나눔 게시판", href: "/community/joytalk" },
];

const ADMIN_NAV = [
  { label: "헌금 안내", href: "/admin/offering" },
  { label: "차량 운행", href: "/admin/vehicle" },
  { label: "새가족 안내", href: "/admin/new-member" },
  { label: "조이플스토어", href: "/admin/store" },
];

// ── 교회 소식 ─────────────────────────────────────────────────────
const NEWS_LIST = [
  { id: "1", badge: "공지", badgeColor: "bg-red-100 text-red-700", title: "교회 소식은 관리자 CMS에서 등록됩니다", date: "공지 예정", views: 0, summary: "기쁨의교회 최신 공지와 행사 안내는 관리자 CMS에 등록된 내용을 기준으로 제공됩니다." },
  { id: "2", badge: "안내", badgeColor: "bg-blue-100 text-blue-700", title: "예배 및 행사 안내 준비 중", date: "공지 예정", views: 0, summary: "예배 시간 변경, 행사 일정, 교회학교 안내 등은 확정된 공지 기준으로 업데이트됩니다." },
];

export function ChurchNews() {
  const [selected, setSelected] = useState<string | null>(null);
  const selectedNews = NEWS_LIST.find(n => n.id === selected);

  if (selectedNews) {
    return (
      <div className="min-h-screen bg-[#F7F7F5]">
        <PageHeader title="교회 소식" breadcrumb={["커뮤니티", "교회 소식"]} />
        <SubNav items={COMMUNITY_NAV} />
        <div className="max-w-4xl mx-auto px-4 py-14">
          <button onClick={() => setSelected(null)} className="flex items-center gap-2 text-[#1B5E20] text-sm font-medium mb-6 hover:underline">
            <i className="fas fa-arrow-left"></i> 목록으로
          </button>
          <div className="bg-white rounded-2xl shadow-sm p-8">
            <span className={`text-xs px-3 py-1 rounded-full font-medium ${selectedNews.badgeColor}`}>{selectedNews.badge}</span>
            <h1 className="text-2xl font-bold text-gray-800 mt-4 mb-2" style={{ fontFamily: "'Noto Serif KR', serif" }}>{selectedNews.title}</h1>
            <p className="text-gray-400 text-sm mb-8">{selectedNews.date} · 조회 {selectedNews.views}</p>
            <div className="prose prose-sm max-w-none text-gray-700 leading-8">
              <p>{selectedNews.summary}</p>
              <p className="mt-4">자세한 내용은 교회 사무실(054-270-1000)로 문의해 주시거나, 담당 부서에 직접 연락해 주시기 바랍니다.</p>
              <p className="mt-4">기쁨의교회 성도 여러분의 많은 관심과 참여를 부탁드립니다.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F7F5]">
      <PageHeader title="교회 소식" subtitle="기쁨의교회의 최신 소식을 전해드립니다" breadcrumb={["커뮤니티", "교회 소식"]} />
      <SubNav items={COMMUNITY_NAV} />
      <div className="max-w-4xl mx-auto px-4 py-14">
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="divide-y divide-gray-50">
            {NEWS_LIST.map((n) => (
              <button key={n.id} onClick={() => setSelected(n.id)}
                className="w-full text-left px-6 py-5 hover:bg-gray-50 transition-colors flex items-start gap-4">
                <span className={`flex-shrink-0 text-xs px-2.5 py-1 rounded-full font-medium mt-0.5 ${n.badgeColor}`}>{n.badge}</span>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-gray-800 text-sm mb-1 truncate">{n.title}</h3>
                  <p className="text-gray-400 text-xs">{n.date} · 조회 {n.views}</p>
                </div>
                <i className="fas fa-chevron-right text-gray-300 text-xs mt-1 flex-shrink-0"></i>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── 기도 요청 ─────────────────────────────────────────────────────
export function PrayerRequest() {
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({ name: "", content: "", category: "개인기도" });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-[#F7F7F5]">
      <PageHeader title="기도 요청" subtitle="함께 기도해 드리겠습니다" breadcrumb={["커뮤니티", "기도 요청"]} />
      <SubNav items={COMMUNITY_NAV} />
      <div className="max-w-2xl mx-auto px-4 py-14">
        {submitted ? (
          <div className="bg-white rounded-2xl p-12 shadow-sm text-center">
            <div className="w-16 h-16 rounded-full bg-[#E8F5E9] flex items-center justify-center mx-auto mb-5">
              <i className="fas fa-hands-praying text-[#1B5E20] text-2xl"></i>
            </div>
            <h2 className="text-xl font-bold text-gray-800 mb-3" style={{ fontFamily: "'Noto Serif KR', serif" }}>기도 요청이 접수되었습니다</h2>
            <p className="text-gray-500 text-sm mb-6">중보기도팀이 함께 기도하겠습니다.</p>
            <button onClick={() => setSubmitted(false)} className="bg-[#1B5E20] text-white px-8 py-3 rounded-full text-sm font-medium hover:bg-[#2E7D32] transition-colors">
              다시 작성하기
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-2xl p-8 shadow-sm">
            <div className="bg-[#E8F5E9] rounded-xl p-5 mb-8 text-sm text-[#1B5E20] leading-relaxed">
              <i className="fas fa-info-circle mr-2"></i>
              기도 요청 내용은 중보기도팀과 담임목사님께 전달됩니다. 개인 정보는 기도 목적 외에 사용되지 않습니다.
            </div>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">이름</label>
                <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="성함을 입력해 주세요" required
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B5E20]/30 focus:border-[#1B5E20]" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">기도 분류</label>
                <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B5E20]/30 focus:border-[#1B5E20]">
                  {["개인기도", "가정기도", "건강기도", "사업기도", "자녀기도", "기타"].map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">기도 내용</label>
                <textarea value={form.content} onChange={e => setForm({ ...form, content: e.target.value })}
                  placeholder="기도 제목을 자유롭게 작성해 주세요" required rows={6}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B5E20]/30 focus:border-[#1B5E20] resize-none" />
              </div>
              <button type="submit" className="w-full bg-[#1B5E20] text-white py-3.5 rounded-xl font-medium hover:bg-[#2E7D32] transition-colors">
                기도 요청 제출
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

// ── 헌금 안내 ─────────────────────────────────────────────────────
export function Offering() {
  return (
    <div className="min-h-screen bg-[#F7F7F5]">
      <PageHeader title="헌금 안내" subtitle="하나님께 드리는 감사의 예물" breadcrumb={["행정지원", "헌금 안내"]} />
      <SubNav items={ADMIN_NAV} />
      <div className="max-w-4xl mx-auto px-4 py-14">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {[
            { title: "온라인 헌금", icon: "fa-credit-card", color: "bg-[#E8F5E9]", desc: "교회가 안내한 공식 계좌로 입금 후 헌금 내용을 확인해 주세요.", items: ["공식 계좌는 주보 또는 교회 사무실을 통해 확인", "예금주: 기쁨의교회"] },
            { title: "주일 헌금", icon: "fa-church", color: "bg-blue-50", desc: "예배 시간 헌금 봉투에 이름과 헌금 종류를 기재 후 헌금함에 넣어 주세요.", items: ["헌금 봉투는 안내 데스크에서 수령", "헌금 영수증은 사무실에서 발급"] },
            { title: "십일조 헌금", icon: "fa-percent", color: "bg-amber-50", desc: "매월 정기적으로 드리는 십일조 헌금입니다.", items: ["온라인 또는 현장 헌금 모두 가능", "헌금 내역서 연말 발급 가능"] },
            { title: "특별 헌금", icon: "fa-star", color: "bg-purple-50", desc: "감사헌금, 건축헌금, 선교헌금 등 특별 목적 헌금입니다.", items: ["헌금 봉투에 목적 명시", "문의: 054-270-1000"] },
          ].map((o, i) => (
            <div key={i} className={`rounded-2xl p-7 shadow-sm ${o.color}`}>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center">
                  <i className={`fas ${o.icon} text-[#1B5E20]`}></i>
                </div>
                <h3 className="font-bold text-gray-800" style={{ fontFamily: "'Noto Serif KR', serif" }}>{o.title}</h3>
              </div>
              <p className="text-gray-600 text-sm mb-4 leading-relaxed">{o.desc}</p>
              <ul className="space-y-1.5">
                {o.items.map((item, j) => (
                  <li key={j} className="text-sm text-gray-600 flex items-start gap-2">
                    <i className="fas fa-check text-[#1B5E20] text-xs mt-1 flex-shrink-0"></i> {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="bg-[#E8F5E9] rounded-2xl p-6 text-sm text-[#1B5E20]">
          <i className="fas fa-info-circle mr-2"></i>
          헌금 영수증 발급 및 기타 문의는 교회 사무실(054-270-1000)로 연락해 주세요. 운영시간: 평일 09:00~18:00
        </div>
      </div>
    </div>
  );
}

// ── 차량 운행 ─────────────────────────────────────────────────────
const VEHICLE_ROUTES = [
  { route: "1노선", area: "주일 셔틀", time: "예배 전 운행", stops: ["세부 승차 위치는 주보 및 교회 공지 확인", "교회 도착"] },
  { route: "2노선", area: "주일 셔틀", time: "예배 전 운행", stops: ["세부 승차 위치는 안내 데스크 문의", "교회 도착"] },
  { route: "3노선", area: "특별 행사", time: "행사별 공지", stops: ["행사 일정에 따라 별도 안내", "교회 도착"] },
];

export function VehicleGuide() {
  return (
    <div className="min-h-screen bg-[#F7F7F5]">
      <PageHeader title="차량 운행 안내" subtitle="주일 예배 셔틀버스 운행 노선을 안내해 드립니다" breadcrumb={["행정지원", "차량 운행"]} />
      <SubNav items={ADMIN_NAV} />
      <div className="max-w-4xl mx-auto px-4 py-14">
        <div className="bg-[#E8F5E9] rounded-2xl p-5 mb-8 text-sm text-[#1B5E20]">
          <i className="fas fa-info-circle mr-2"></i>
          주일 3부 예배(오전 11:00) 기준 운행 일정입니다. 예배 후 귀가 차량은 예배 종료 후 30분 뒤 출발합니다.
        </div>
        <div className="space-y-5">
          {VEHICLE_ROUTES.map((r, i) => (
            <div key={i} className="bg-white rounded-2xl p-7 shadow-sm">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#1B5E20] text-white flex items-center justify-center font-bold text-sm">{r.route[0]}</div>
                  <div>
                    <h3 className="font-bold text-gray-800">{r.route}</h3>
                    <p className="text-gray-400 text-xs">{r.area}</p>
                  </div>
                </div>
                <span className="text-sm font-medium text-[#1B5E20] bg-[#E8F5E9] px-3 py-1.5 rounded-full">{r.time}</span>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex flex-col items-center pt-1">
                  {r.stops.map((_, j) => (
                    <div key={j} className="flex flex-col items-center">
                      <div className={`w-3 h-3 rounded-full ${j === r.stops.length - 1 ? "bg-[#1B5E20]" : "bg-green-300"}`}></div>
                      {j < r.stops.length - 1 && <div className="w-0.5 h-6 bg-green-200"></div>}
                    </div>
                  ))}
                </div>
                <div className="space-y-3 flex-1">
                  {r.stops.map((stop, j) => (
                    <p key={j} className={`text-sm ${j === r.stops.length - 1 ? "font-bold text-[#1B5E20]" : "text-gray-600"} leading-none pt-0.5`}>{stop}</p>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-6 bg-white rounded-2xl p-6 shadow-sm text-center">
          <p className="text-gray-600 text-sm mb-2">차량 운행 문의</p>
          <p className="font-bold text-[#1B5E20]"><i className="fas fa-phone mr-2"></i>054-270-1000</p>
        </div>
      </div>
    </div>
  );
}

// ── 새가족 안내 ──────────────────────────────────────────────────
export function NewMemberGuide() {
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", age: "", address: "", how: "" });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-[#F7F7F5]">
      <PageHeader title="새가족 안내" subtitle="기쁨의교회에 오신 것을 환영합니다" breadcrumb={["행정지원", "새가족 안내"]} />
      <SubNav items={ADMIN_NAV} />
      <div className="max-w-2xl mx-auto px-4 py-14">
        {submitted ? (
          <div className="bg-white rounded-2xl p-12 shadow-sm text-center">
            <div className="w-16 h-16 rounded-full bg-[#E8F5E9] flex items-center justify-center mx-auto mb-5">
              <i className="fas fa-heart text-[#1B5E20] text-2xl"></i>
            </div>
            <h2 className="text-xl font-bold text-gray-800 mb-3" style={{ fontFamily: "'Noto Serif KR', serif" }}>등록이 완료되었습니다!</h2>
            <p className="text-gray-500 text-sm mb-6">담당 사역자가 곧 연락드리겠습니다. 기쁨의교회 가족이 되신 것을 환영합니다!</p>
            <button onClick={() => setSubmitted(false)} className="bg-[#1B5E20] text-white px-8 py-3 rounded-full text-sm font-medium hover:bg-[#2E7D32] transition-colors">
              처음으로
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-2xl p-8 shadow-sm">
            <h2 className="text-xl font-bold text-gray-800 mb-6" style={{ fontFamily: "'Noto Serif KR', serif" }}>새가족 등록 신청</h2>
            <form onSubmit={handleSubmit} className="space-y-5">
              {[
                { label: "이름", key: "name", placeholder: "성함을 입력해 주세요", type: "text" },
                { label: "연락처", key: "phone", placeholder: "010-0000-0000", type: "tel" },
                { label: "나이", key: "age", placeholder: "나이를 입력해 주세요", type: "number" },
                { label: "거주 지역", key: "address", placeholder: "예: 포항시 북구", type: "text" },
              ].map((f) => (
                <div key={f.key}>
                  <label className="block text-sm font-medium text-gray-700 mb-2">{f.label}</label>
                  <input type={f.type} value={form[f.key as keyof typeof form]}
                    onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                    placeholder={f.placeholder} required
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B5E20]/30 focus:border-[#1B5E20]" />
                </div>
              ))}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">교회를 알게 된 경로</label>
                <select value={form.how} onChange={e => setForm({ ...form, how: e.target.value })}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B5E20]/30 focus:border-[#1B5E20]">
                  <option value="">선택해 주세요</option>
                  {["지인 소개", "인터넷 검색", "SNS", "현수막/전단지", "기타"].map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <button type="submit" className="w-full bg-[#1B5E20] text-white py-3.5 rounded-xl font-medium hover:bg-[#2E7D32] transition-colors">
                등록 신청하기
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

// ── 조이플스토어 ──────────────────────────────────────────────────
const STORE_ITEMS = [
  { id: "1", name: "기쁨의교회 머그컵", price: "12,000원", category: "생활용품", img: "https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?w=300&q=70", badge: "인기" },
  { id: "2", name: "교회 달력", price: "문의", category: "문구", img: "https://images.unsplash.com/photo-1506784983877-45594efa4cbe?w=300&q=70", badge: "안내" },
  { id: "3", name: "기쁨의교회 에코백", price: "15,000원", category: "생활용품", img: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=300&q=70", badge: "" },
  { id: "4", name: "큐티 노트 (3개월)", price: "6,000원", category: "문구", img: "https://images.unsplash.com/photo-1531346878377-a5be20888e57?w=300&q=70", badge: "" },
  { id: "5", name: "기쁨의교회 티셔츠", price: "20,000원", category: "의류", img: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=300&q=70", badge: "" },
  { id: "6", name: "성경 책갈피 세트", price: "3,000원", category: "문구", img: "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=300&q=70", badge: "인기" },
];

export function JoyfulStore() {
  const [filter, setFilter] = useState("전체");
  const categories = ["전체", "생활용품", "문구", "의류"];
  const filtered = filter === "전체" ? STORE_ITEMS : STORE_ITEMS.filter(i => i.category === filter);

  return (
    <div className="min-h-screen bg-[#F7F7F5]">
      <PageHeader title="조이플스토어" subtitle="기쁨의교회 굿즈를 만나보세요" breadcrumb={["행정지원", "조이플스토어"]} />
      <SubNav items={ADMIN_NAV} />
      <div className="max-w-5xl mx-auto px-4 py-10">
        <div className="bg-[#E8F5E9] rounded-2xl p-5 mb-8 text-sm text-[#1B5E20]">
          <i className="fas fa-info-circle mr-2"></i>
          구매는 교회 안내 데스크에서 직접 구매하시거나, 전화(054-270-1000)로 문의해 주세요.
        </div>
        <div className="flex gap-2 mb-6">
          {categories.map(c => (
            <button key={c} onClick={() => setFilter(c)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${filter === c ? "bg-[#1B5E20] text-white" : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"}`}>
              {c}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
          {filtered.map(item => (
            <div key={item.id} className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
              <div className="relative aspect-square">
                <img src={item.img} alt={item.name} className="w-full h-full object-cover" />
                {item.badge && (
                  <span className="absolute top-2 left-2 bg-[#1B5E20] text-white text-xs px-2 py-0.5 rounded-full">{item.badge}</span>
                )}
              </div>
              <div className="p-4">
                <p className="text-xs text-gray-400 mb-1">{item.category}</p>
                <h3 className="font-medium text-gray-800 text-sm mb-2">{item.name}</h3>
                <p className="font-bold text-[#1B5E20]">{item.price}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
