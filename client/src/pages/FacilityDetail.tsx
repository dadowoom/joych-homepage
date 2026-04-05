/**
 * 시설 사용 예약 — 상세 페이지 (/facility/:id)
 * 규칙: 컴포넌트 역할 분리, 타입 안전, 나중에 API 훅으로 교체 가능한 구조
 */

import { useState } from "react";
import { Link, useParams } from "wouter";
import { MOCK_FACILITIES, CATEGORY_LABELS } from "@/lib/facilityData";

// ── 예약 현황 달력 (더미 데이터) ──────────────────────────
const BOOKED_DATES = ["2026-04-08", "2026-04-12", "2026-04-15", "2026-04-19", "2026-04-22"];

function ReservationCalendar() {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const monthLabel = `${year}년 ${month + 1}월`;
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  function toDateStr(day: number) {
    return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-gray-800 text-sm">{monthLabel} 예약 현황</h3>
        <div className="flex gap-3 text-xs text-gray-500">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-100 border border-red-300 inline-block"></span>예약됨</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-green-100 border border-green-300 inline-block"></span>예약가능</span>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs mb-1">
        {["일", "월", "화", "수", "목", "금", "토"].map((d) => (
          <div key={d} className="text-gray-400 font-medium py-1">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs">
        {days.map((day, i) => {
          if (!day) return <div key={i} />;
          const dateStr = toDateStr(day);
          const isBooked = BOOKED_DATES.includes(dateStr);
          const isPast = new Date(dateStr) < new Date(today.toDateString());
          return (
            <div
              key={i}
              className={`rounded-full w-8 h-8 flex items-center justify-center mx-auto font-medium
                ${isPast ? "text-gray-300" : isBooked ? "bg-red-100 text-red-500 border border-red-200" : "bg-green-50 text-green-700 border border-green-200"}`}
            >
              {day}
            </div>
          );
        })}
      </div>
      <p className="text-xs text-gray-400 mt-3 text-center">
        * 실제 예약 현황은 신청 후 담당자 확인을 통해 안내됩니다.
      </p>
    </div>
  );
}

// ── 이미지 갤러리 ──────────────────────────────────────────
function ImageGallery({ images, name }: { images: string[]; name: string }) {
  const [active, setActive] = useState(0);
  return (
    <div>
      <div className="rounded-xl overflow-hidden mb-2 aspect-video">
        <img src={images[active]} alt={name} className="w-full h-full object-cover" />
      </div>
      {images.length > 1 && (
        <div className="flex gap-2">
          {images.map((img, i) => (
            <button
              key={i}
              onClick={() => setActive(i)}
              className={`w-16 h-12 rounded-lg overflow-hidden border-2 transition-colors ${
                active === i ? "border-[#1B5E20]" : "border-transparent"
              }`}
            >
              <img src={img} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── 메인 상세 페이지 ───────────────────────────────────────
export default function FacilityDetail() {
  const params = useParams<{ id: string }>();
  const facility = MOCK_FACILITIES.find((f) => f.id === params.id);

  if (!facility) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7F7F5]">
        <div className="text-center">
          <i className="fas fa-building text-5xl text-gray-300 mb-4 block"></i>
          <p className="text-gray-500 mb-4">시설 정보를 찾을 수 없습니다.</p>
          <Link href="/facility" className="text-[#1B5E20] font-medium hover:underline">
            시설 목록으로 돌아가기
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F7F5]">
      {/* 상단 배너 */}
      <section className="bg-[#1B5E20] py-10">
        <div className="container text-white">
          <nav className="flex items-center gap-2 text-xs text-green-200 mb-3">
            <Link href="/" className="hover:text-white transition-colors">홈</Link>
            <i className="fas fa-chevron-right text-[10px]"></i>
            <Link href="/facility" className="hover:text-white transition-colors">시설 사용 예약</Link>
            <i className="fas fa-chevron-right text-[10px]"></i>
            <span className="text-white">{facility.name}</span>
          </nav>
          <div className="flex items-center gap-3">
            <span className="bg-white/20 text-white text-xs px-3 py-1 rounded-full">
              {CATEGORY_LABELS[facility.category]}
            </span>
            <h1 className="text-2xl md:text-3xl font-bold" style={{ fontFamily: "'Noto Serif KR', serif" }}>
              {facility.name}
            </h1>
          </div>
        </div>
      </section>

      {/* 본문 */}
      <section className="py-10">
        <div className="container">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

            {/* 왼쪽: 이미지 + 상세 정보 */}
            <div className="lg:col-span-2 space-y-6">
              <ImageGallery images={facility.galleryImages} name={facility.name} />

              {/* 시설 정보 카드 */}
              <div className="bg-white rounded-xl p-6 border border-gray-100">
                <h2 className="font-bold text-gray-900 mb-4 text-base" style={{ fontFamily: "'Noto Serif KR', serif" }}>
                  시설 정보
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-5">
                  <div className="text-center p-3 bg-[#F1F8E9] rounded-lg">
                    <i className="fas fa-users text-[#1B5E20] text-xl mb-1 block"></i>
                    <p className="text-xs text-gray-500">수용 인원</p>
                    <p className="font-bold text-gray-800">{facility.capacity.toLocaleString()}명</p>
                  </div>
                  <div className="text-center p-3 bg-[#F1F8E9] rounded-lg">
                    <i className="fas fa-map-marker-alt text-[#1B5E20] text-xl mb-1 block"></i>
                    <p className="text-xs text-gray-500">위치</p>
                    <p className="font-bold text-gray-800">{facility.floor}</p>
                  </div>
                  <div className="text-center p-3 bg-[#F1F8E9] rounded-lg col-span-2 sm:col-span-1">
                    <i className="fas fa-clock text-[#1B5E20] text-xl mb-1 block"></i>
                    <p className="text-xs text-gray-500">사용 가능 시간</p>
                    <p className="font-bold text-gray-800 text-sm">{facility.availableHours}</p>
                  </div>
                </div>
                <p className="text-sm text-gray-600 leading-relaxed">{facility.longDescription}</p>
              </div>

              {/* 구비 장비 */}
              <div className="bg-white rounded-xl p-6 border border-gray-100">
                <h2 className="font-bold text-gray-900 mb-4 text-base" style={{ fontFamily: "'Noto Serif KR', serif" }}>
                  구비 장비
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {facility.equipment.map((eq, i) => (
                    <div key={i} className="flex items-center gap-2.5 p-3 bg-[#F7F7F5] rounded-lg">
                      <div className="w-8 h-8 rounded-full bg-[#E8F5E9] flex items-center justify-center text-[#1B5E20] text-sm shrink-0">
                        <i className={`fas ${eq.icon}`}></i>
                      </div>
                      <span className="text-sm text-gray-700">{eq.name}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 이용 규정 */}
              <div className="bg-amber-50 rounded-xl p-6 border border-amber-100">
                <h2 className="font-bold text-gray-900 mb-3 text-base flex items-center gap-2">
                  <i className="fas fa-exclamation-circle text-amber-500"></i>
                  이용 시 주의사항
                </h2>
                <ul className="space-y-2">
                  {facility.notice.map((n, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                      <span className="text-amber-500 mt-0.5 shrink-0">•</span>
                      {n}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* 오른쪽: 달력 + 예약 버튼 */}
            <div className="space-y-5">
              <ReservationCalendar />

              {/* 예약 신청 버튼 */}
              <Link href={`/facility/${facility.id}/apply`}>
                <div className="bg-[#1B5E20] text-white rounded-xl p-5 text-center cursor-pointer hover:bg-[#2E7D32] transition-colors">
                  <i className="fas fa-calendar-plus text-2xl mb-2 block"></i>
                  <p className="font-bold text-base mb-1">예약 신청하기</p>
                  <p className="text-green-200 text-xs">신청 후 담당자 확인을 통해 안내드립니다</p>
                </div>
              </Link>

              {/* 문의 */}
              <div className="bg-white rounded-xl p-5 border border-gray-100">
                <p className="font-bold text-gray-800 text-sm mb-2">
                  <i className="fas fa-phone-alt text-[#1B5E20] mr-2"></i>시설 문의
                </p>
                <p className="text-sm text-gray-500">행정실: <span className="text-[#1B5E20] font-medium">02-000-0000</span></p>
                <p className="text-xs text-gray-400 mt-1">평일 09:00 ~ 18:00</p>
              </div>

              {/* 목록으로 */}
              <Link href="/facility">
                <div className="text-center text-sm text-gray-400 hover:text-[#1B5E20] transition-colors cursor-pointer py-2">
                  <i className="fas fa-arrow-left mr-1"></i> 시설 목록으로 돌아가기
                </div>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
