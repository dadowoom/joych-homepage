/**
 * 시설 사용 예약 — 목록 페이지 (/facility)
 * 규칙: 컴포넌트 역할 분리, 타입 안전, 나중에 API 훅으로 교체 가능한 구조
 */

import { useState } from "react";
import { Link } from "wouter";
import { MOCK_FACILITIES, CATEGORY_LABELS, type Facility } from "@/lib/facilityData";

// ── 상단 배너 ──────────────────────────────────────────────
function FacilityHero() {
  return (
    <section className="relative bg-[#1B5E20] py-16 overflow-hidden">
      <div
        className="absolute inset-0 opacity-20 bg-cover bg-center"
        style={{ backgroundImage: "url('https://images.unsplash.com/photo-1438032005730-c779502df39b?w=1200&q=60')" }}
      />
      <div className="container relative z-10 text-white">
        <p className="text-sm tracking-widest text-green-200 mb-2 uppercase">Facility Reservation</p>
        <h1 className="text-3xl md:text-4xl font-bold mb-3" style={{ fontFamily: "'Noto Serif KR', serif" }}>
          시설 사용 예약
        </h1>
        <p className="text-green-100 text-sm md:text-base max-w-xl">
          기쁨의교회의 다양한 공간을 예약하여 사용하실 수 있습니다.
          원하시는 시설을 선택하고 예약 신청서를 작성해 주세요.
        </p>
        {/* 빵 부스러기 네비게이션 */}
        <nav className="mt-5 flex items-center gap-2 text-xs text-green-200">
          <Link href="/" className="hover:text-white transition-colors">홈</Link>
          <i className="fas fa-chevron-right text-[10px]"></i>
          <span className="text-white">시설 사용 예약</span>
        </nav>
      </div>
    </section>
  );
}

// ── 이용 안내 요약 배너 ────────────────────────────────────
function FacilityGuide() {
  const steps = [
    { icon: "fa-search", title: "시설 선택", desc: "원하는 공간을 선택하세요" },
    { icon: "fa-calendar-check", title: "날짜 확인", desc: "예약 가능 일정을 확인하세요" },
    { icon: "fa-file-alt", title: "신청서 작성", desc: "신청 정보를 입력하세요" },
    { icon: "fa-phone", title: "담당자 확인", desc: "승인 후 연락을 드립니다" },
  ];
  return (
    <section className="bg-[#F1F8E9] border-b border-green-100 py-6">
      <div className="container">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {steps.map((s, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#1B5E20] text-white flex items-center justify-center shrink-0 text-sm">
                <i className={`fas ${s.icon}`}></i>
              </div>
              <div>
                <p className="text-xs font-bold text-gray-800">{s.title}</p>
                <p className="text-xs text-gray-500">{s.desc}</p>
              </div>
              {i < steps.length - 1 && (
                <i className="fas fa-arrow-right text-green-300 text-xs ml-auto hidden md:block"></i>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── 카테고리 필터 탭 ───────────────────────────────────────
type CategoryFilter = "all" | Facility["category"];

function CategoryTabs({
  active,
  onChange,
}: {
  active: CategoryFilter;
  onChange: (c: CategoryFilter) => void;
}) {
  const tabs: { value: CategoryFilter; label: string }[] = [
    { value: "all", label: "전체" },
    { value: "worship", label: "예배공간" },
    { value: "education", label: "교육공간" },
    { value: "fellowship", label: "친교공간" },
    { value: "other", label: "기타" },
  ];
  return (
    <div className="flex gap-2 flex-wrap">
      {tabs.map((t) => (
        <button
          key={t.value}
          onClick={() => onChange(t.value)}
          className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors border ${
            active === t.value
              ? "bg-[#1B5E20] text-white border-[#1B5E20]"
              : "bg-white text-gray-600 border-gray-200 hover:border-[#1B5E20] hover:text-[#1B5E20]"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ── 시설 카드 ──────────────────────────────────────────────
function FacilityCard({ facility }: { facility: Facility }) {
  return (
    <Link href={`/facility/${facility.id}`}>
      <div className="bg-white rounded-xl overflow-hidden shadow-sm border border-gray-100 hover:shadow-md hover:-translate-y-1 transition-all duration-200 cursor-pointer group">
        {/* 이미지 */}
        <div className="relative h-48 overflow-hidden">
          <img
            src={facility.imageUrl}
            alt={facility.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
          <div className="absolute top-3 left-3">
            <span className="bg-[#1B5E20] text-white text-xs px-2.5 py-1 rounded-full font-medium">
              {CATEGORY_LABELS[facility.category]}
            </span>
          </div>
          <div className="absolute top-3 right-3">
            <span className="bg-white/90 text-gray-700 text-xs px-2.5 py-1 rounded-full font-medium">
              <i className="fas fa-users mr-1 text-[#1B5E20]"></i>
              최대 {facility.capacity.toLocaleString()}명
            </span>
          </div>
        </div>
        {/* 정보 */}
        <div className="p-5">
          <div className="flex items-start justify-between gap-2 mb-2">
            <h3 className="font-bold text-gray-900 text-base" style={{ fontFamily: "'Noto Serif KR', serif" }}>
              {facility.name}
            </h3>
            <span className="text-xs text-gray-400 shrink-0 mt-0.5">
              <i className="fas fa-map-marker-alt mr-1"></i>{facility.floor}
            </span>
          </div>
          <p className="text-sm text-gray-500 leading-relaxed line-clamp-2 mb-4">
            {facility.description}
          </p>
          {/* 장비 태그 (최대 3개) */}
          <div className="flex gap-1.5 flex-wrap mb-4">
            {facility.equipment.slice(0, 3).map((eq, i) => (
              <span key={i} className="text-xs bg-[#F1F8E9] text-[#1B5E20] px-2 py-0.5 rounded">
                <i className={`fas ${eq.icon} mr-1`}></i>{eq.name}
              </span>
            ))}
            {facility.equipment.length > 3 && (
              <span className="text-xs text-gray-400">+{facility.equipment.length - 3}개</span>
            )}
          </div>
          {/* 예약 버튼 */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">
              <i className="fas fa-clock mr-1"></i>{facility.availableHours}
            </span>
            <span className="text-xs font-semibold text-[#1B5E20] group-hover:underline">
              자세히 보기 <i className="fas fa-arrow-right ml-1"></i>
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

// ── 메인 페이지 컴포넌트 ───────────────────────────────────
export default function FacilityList() {
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>("all");

  const filtered = MOCK_FACILITIES.filter(
    (f) => f.isActive && (activeCategory === "all" || f.category === activeCategory)
  );

  return (
    <div className="min-h-screen bg-[#F7F7F5]">
      <FacilityHero />
      <FacilityGuide />

      {/* 목록 본문 */}
      <section className="py-12">
        <div className="container">
          {/* 필터 + 건수 */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
            <CategoryTabs active={activeCategory} onChange={setActiveCategory} />
            <p className="text-sm text-gray-500">
              총 <span className="font-bold text-[#1B5E20]">{filtered.length}</span>개의 시설
            </p>
          </div>

          {/* 카드 그리드 */}
          {filtered.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filtered.map((f) => (
                <FacilityCard key={f.id} facility={f} />
              ))}
            </div>
          ) : (
            <div className="text-center py-20 text-gray-400">
              <i className="fas fa-building text-4xl mb-3 block"></i>
              <p>해당 카테고리의 시설이 없습니다.</p>
            </div>
          )}

          {/* 문의 안내 */}
          <div className="mt-12 bg-white rounded-xl p-6 border border-gray-100 flex flex-col sm:flex-row items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-[#E8F5E9] flex items-center justify-center text-[#1B5E20] text-xl shrink-0">
              <i className="fas fa-phone-alt"></i>
            </div>
            <div className="text-center sm:text-left">
              <p className="font-bold text-gray-800 mb-0.5">시설 사용 문의</p>
              <p className="text-sm text-gray-500">
                시설 사용에 관한 문의는 교회 행정실로 연락해 주세요.
                <span className="ml-2 text-[#1B5E20] font-medium">02-000-0000</span>
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
