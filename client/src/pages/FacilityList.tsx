/**
 * 시설 사용 예약 — 목록 페이지 (/facility)
 * 실제 DB API 연결 버전
 */

import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import type { Facility, FacilityImage } from "../../../drizzle/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, Clock, MapPin, CalendarCheck, Phone } from "lucide-react";

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
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── 시설 카드 ──────────────────────────────────────────────
function FacilityCard({ facility }: { facility: Facility }) {
  const { data: images } = trpc.home.facilityImages.useQuery({ facilityId: facility.id });
  const thumbnail = images?.find((img: FacilityImage) => img.isThumbnail) ?? images?.[0];

  return (
    <div className="bg-white rounded-xl overflow-hidden shadow-sm border border-gray-100 hover:shadow-md hover:-translate-y-1 transition-all duration-200 group">
      {/* 이미지 */}
      <div className="relative h-48 overflow-hidden bg-gray-100">
        {thumbnail ? (
          <img
            src={thumbnail.imageUrl}
            alt={facility.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300">
            <CalendarCheck size={48} />
          </div>
        )}
        <div className="absolute top-3 right-3">
          {facility.isReservable ? (
            <Badge className="bg-green-600 text-white text-xs">예약 가능</Badge>
          ) : (
            <Badge className="bg-gray-500 text-white text-xs">예약 불가</Badge>
          )}
        </div>
      </div>

      {/* 정보 */}
      <div className="p-5">
        <h3 className="font-bold text-gray-900 text-base mb-2" style={{ fontFamily: "'Noto Serif KR', serif" }}>
          {facility.name}
        </h3>
        {facility.description && (
          <p className="text-sm text-gray-500 leading-relaxed line-clamp-2 mb-4">{facility.description}</p>
        )}

        <div className="space-y-1.5 mb-4">
          {facility.location && (
            <div className="flex items-center gap-2 text-xs text-gray-600">
              <MapPin size={12} className="text-green-600 shrink-0" />
              <span>{facility.location}</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-xs text-gray-600">
            <Users size={12} className="text-green-600 shrink-0" />
            <span>최대 {facility.capacity}명</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-600">
            <Clock size={12} className="text-green-600 shrink-0" />
            <span>{facility.slotMinutes}분 단위 · 최소 {facility.minSlots}시간 ~ 최대 {facility.maxSlots}시간</span>
          </div>
          {facility.pricePerHour > 0 && (
            <div className="flex items-center gap-2 text-xs text-gray-600">
              <span className="text-green-600 font-bold text-xs">₩</span>
              <span>시간당 {facility.pricePerHour.toLocaleString()}원</span>
            </div>
          )}
        </div>

        <Link href={`/facility/${facility.id}`}>
          <Button
            className="w-full bg-[#1B5E20] hover:bg-[#2E7D32] text-white"
            disabled={!facility.isReservable}
          >
            {facility.isReservable ? "자세히 보기 / 예약하기" : "예약 불가"}
          </Button>
        </Link>
      </div>
    </div>
  );
}

// ── 메인 페이지 컴포넌트 ───────────────────────────────────
export default function FacilityList() {
  const { data: facilities, isLoading } = trpc.home.facilities.useQuery();

  return (
    <div className="min-h-screen bg-[#F7F7F5]">
      <FacilityHero />
      <FacilityGuide />

      <section className="py-12">
        <div className="container">
          {/* 내 예약 현황 링크 */}
          <div className="flex justify-end mb-6">
            <Link href="/facility/my-reservations">
              <Button variant="outline" className="border-[#1B5E20] text-[#1B5E20] hover:bg-green-50">
                <CalendarCheck size={16} className="mr-2" />
                내 예약 현황
              </Button>
            </Link>
          </div>

          {/* 카드 그리드 */}
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-64 bg-gray-100 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : !facilities || facilities.length === 0 ? (
            <div className="text-center py-20 text-gray-400">
              <CalendarCheck size={48} className="mx-auto mb-4 opacity-30" />
              <p className="text-lg">등록된 시설이 없습니다.</p>
              <p className="text-sm mt-2">관리자에게 문의해 주세요.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {facilities.map((f: Facility) => (
                <FacilityCard key={f.id} facility={f} />
              ))}
            </div>
          )}

          {/* 문의 안내 */}
          <div className="mt-12 bg-white rounded-xl p-6 border border-gray-100 flex flex-col sm:flex-row items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-[#E8F5E9] flex items-center justify-center text-[#1B5E20] shrink-0">
              <Phone size={20} />
            </div>
            <div className="text-center sm:text-left">
              <p className="font-bold text-gray-800 mb-0.5">시설 사용 문의</p>
              <p className="text-sm text-gray-500">
                시설 사용에 관한 문의는 교회 행정실로 연락해 주세요.
                <span className="ml-2 text-[#1B5E20] font-medium">054-270-1000</span>
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
