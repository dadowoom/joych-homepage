/**
 * 시설 사용 예약 — 상세 페이지 (/facility/:id)
 * 실제 DB API 연결 버전 — 달력 예약 현황, 운영 시간, 이미지 갤러리 포함
 * 개선: 날짜 클릭 시 시간대 현황 패널 표시 + 시간 슬롯 클릭으로 시작/종료 선택
 */

import { useState, useMemo } from "react";
import { Link, useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, MapPin, Clock, ChevronLeft, ChevronRight, Phone, AlertCircle, CalendarCheck, Loader2 } from "lucide-react";

const DAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

// ── 운영 시간 표시 ──────────────────────────────────────────
function HoursTable({ facilityId }: { facilityId: number }) {
  const { data: hours } = trpc.home.facilityHours.useQuery({ facilityId });
  if (!hours || hours.length === 0) return null;

  return (
    <div className="bg-white rounded-xl p-6 border border-gray-100">
      <h2 className="font-bold text-gray-900 mb-4 text-base" style={{ fontFamily: "'Noto Serif KR', serif" }}>
        운영 시간
      </h2>
      <div className="space-y-2">
        {hours.map((h: any) => (
          <div key={h.dayOfWeek} className="flex items-center justify-between text-sm">
            <span className={`font-medium w-8 ${h.dayOfWeek === 0 ? "text-red-500" : h.dayOfWeek === 6 ? "text-blue-500" : "text-gray-700"}`}>
              {DAY_LABELS[h.dayOfWeek]}
            </span>
            {h.isOpen ? (
              <span className="text-gray-600">
                {h.openTime} ~ {h.closeTime}
                {h.breakStart && h.breakEnd && (
                  <span className="text-gray-400 text-xs ml-2">(휴식 {h.breakStart}~{h.breakEnd})</span>
                )}
              </span>
            ) : (
              <span className="text-gray-400">휴무</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── 이미지 갤러리 ──────────────────────────────────────────
function ImageGallery({ facilityId, name }: { facilityId: number; name: string }) {
  const [active, setActive] = useState(0);
  const { data: images } = trpc.home.facilityImages.useQuery({ facilityId });

  if (!images || images.length === 0) {
    return (
      <div className="rounded-xl overflow-hidden aspect-video bg-gray-100 flex items-center justify-center text-gray-300">
        <CalendarCheck size={64} />
      </div>
    );
  }

  return (
    <div>
      <div className="rounded-xl overflow-hidden mb-2 aspect-video">
        <img src={images[active]?.imageUrl} alt={name} className="w-full h-full object-cover" />
      </div>
      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {images.map((img: any, i: number) => (
            <button
              key={i}
              onClick={() => setActive(i)}
              className={`w-16 h-12 rounded-lg overflow-hidden border-2 transition-colors shrink-0 ${
                active === i ? "border-[#1B5E20]" : "border-transparent"
              }`}
            >
              <img src={img.imageUrl} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── 시간대 현황 + 선택 패널 ─────────────────────────────────
function TimeSlotPanel({
  facilityId,
  selectedDate,
  startTime,
  endTime,
  onSelectTime,
}: {
  facilityId: number;
  selectedDate: string;
  startTime: string;
  endTime: string;
  onSelectTime: (start: string, end: string) => void;
}) {
  const dayOfWeek = new Date(selectedDate).getDay();

  const { data: hours } = trpc.home.facilityHours.useQuery({ facilityId });
  const { data: reservations, isLoading } = trpc.home.facilityReservationsByDate.useQuery(
    { facilityId, date: selectedDate },
    { enabled: !!selectedDate }
  );

  const todayHour = useMemo(() => {
    if (!hours) return null;
    return hours.find((h: any) => h.dayOfWeek === dayOfWeek) ?? null;
  }, [hours, dayOfWeek]);

  // 예약된 시간 슬롯 계산
  const bookedSlots = useMemo(() => {
    const set = new Set<string>();
    if (!reservations) return set;
    reservations.forEach((r: any) => {
      if (r.status === "rejected" || r.status === "cancelled") return;
      const [sh, sm] = r.startTime.split(":").map(Number);
      const [eh, em] = r.endTime.split(":").map(Number);
      let cur = sh * 60 + sm;
      const end = eh * 60 + em;
      while (cur < end) {
        const h = Math.floor(cur / 60);
        const m = cur % 60;
        set.add(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
        cur += 30;
      }
    });
    return set;
  }, [reservations]);

  // 운영 시간 내 30분 단위 슬롯 생성
  const allSlots = useMemo(() => {
    if (!todayHour || !todayHour.isOpen) return [];
    const slots: string[] = [];
    const [oh, om] = todayHour.openTime.split(":").map(Number);
    const [ch, cm] = todayHour.closeTime.split(":").map(Number);
    let cur = oh * 60 + om;
    const end = ch * 60 + cm;
    while (cur < end) {
      const h = Math.floor(cur / 60);
      const m = cur % 60;
      slots.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
      cur += 30;
    }
    return slots;
  }, [todayHour]);

  // 날짜 포맷 (예: 2026년 4월 18일 (금))
  const dateLabel = useMemo(() => {
    const d = new Date(selectedDate);
    return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 (${DAY_LABELS[d.getDay()]})`;
  }, [selectedDate]);

  // 슬롯 클릭 핸들러
  // - 아무것도 선택 안 된 상태 → 시작 시간 선택
  // - 시작 시간만 선택된 상태 → 종료 시간 선택 (시작보다 뒤여야 함)
  // - 둘 다 선택된 상태 → 초기화 후 시작 시간 재선택
  function handleSlotClick(slot: string) {
    if (bookedSlots.has(slot)) return; // 예약된 슬롯은 클릭 불가

    if (!startTime || (startTime && endTime)) {
      // 초기화 후 시작 시간 선택
      onSelectTime(slot, "");
    } else {
      // 시작 시간이 있고 종료 시간이 없는 상태
      if (slot <= startTime) {
        // 시작 시간보다 앞이면 시작 시간 재선택
        onSelectTime(slot, "");
      } else {
        // 시작~종료 사이에 예약된 슬롯이 있으면 불가
        const [sh, sm] = startTime.split(":").map(Number);
        const [eh, em] = slot.split(":").map(Number);
        let cur = sh * 60 + sm;
        const end = eh * 60 + em;
        let hasConflict = false;
        while (cur < end) {
          const h = Math.floor(cur / 60);
          const m = cur % 60;
          if (bookedSlots.has(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`)) {
            hasConflict = true;
            break;
          }
          cur += 30;
        }
        if (hasConflict) {
          // 충돌 시 해당 슬롯을 새 시작 시간으로
          onSelectTime(slot, "");
        } else {
          onSelectTime(startTime, slot);
        }
      }
    }
  }

  if (!selectedDate) return null;

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-3">
      <div className="flex items-center gap-2">
        <CalendarCheck size={16} className="text-[#1B5E20]" />
        <h3 className="font-bold text-gray-800 text-sm">{dateLabel} 예약 현황</h3>
      </div>

      {/* 휴무일 */}
      {todayHour && !todayHour.isOpen && (
        <div className="flex items-center gap-2 text-red-500 text-sm bg-red-50 rounded-lg p-3">
          <AlertCircle size={14} />
          <span>이 날은 휴무일입니다.</span>
        </div>
      )}

      {/* 운영 시간 없음 */}
      {!todayHour && (
        <div className="text-sm text-gray-400 text-center py-2">운영 시간 정보가 없습니다.</div>
      )}

      {/* 로딩 중 */}
      {isLoading && (
        <div className="flex items-center justify-center py-4">
          <Loader2 size={18} className="animate-spin text-[#1B5E20]" />
        </div>
      )}

      {/* 시간대 슬롯 선택 */}
      {!isLoading && todayHour && todayHour.isOpen && allSlots.length > 0 && (
        <>
          <p className="text-xs text-gray-500">
            운영 시간: {todayHour.openTime} ~ {todayHour.closeTime}
          </p>

          {/* 선택 안내 */}
          <p className="text-xs text-[#1B5E20] font-medium">
            {!startTime
              ? "시작 시간을 클릭하세요"
              : !endTime
              ? `${startTime} 선택됨 — 종료 시간을 클릭하세요`
              : `${startTime} ~ ${endTime} 선택됨 — 다시 클릭하면 초기화`}
          </p>

          <div className="flex flex-wrap gap-1.5">
            {allSlots.map((slot) => {
              const isBooked = bookedSlots.has(slot);
              const isStart = slot === startTime;
              const isEnd = slot === endTime;
              const isInRange = startTime && endTime && slot > startTime && slot < endTime;
              const isSelected = isStart || isEnd || isInRange;

              return (
                <button
                  key={slot}
                  disabled={isBooked}
                  onClick={() => handleSlotClick(slot)}
                  className={`text-xs px-2.5 py-1.5 rounded-md font-medium transition-colors ${
                    isBooked
                      ? "bg-red-100 text-red-400 line-through cursor-not-allowed"
                      : isStart || isEnd
                      ? "bg-[#1B5E20] text-white ring-2 ring-[#1B5E20] ring-offset-1"
                      : isInRange
                      ? "bg-[#2E7D32] text-white"
                      : "bg-green-50 text-green-700 border border-green-200 hover:bg-green-200 cursor-pointer"
                  }`}
                >
                  {slot}
                </button>
              );
            })}
          </div>

          {/* 범례 */}
          <div className="flex flex-wrap gap-3 text-xs text-gray-400 pt-1">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm bg-green-50 border border-green-200 inline-block" />
              예약 가능
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm bg-red-100 inline-block" />
              예약됨
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm bg-[#1B5E20] inline-block" />
              선택됨
            </span>
          </div>
        </>
      )}
    </div>
  );
}

// ── 예약 달력 ──────────────────────────────────────────────
function ReservationCalendar({
  facilityId,
  selectedDate,
  onSelectDate,
}: {
  facilityId: number;
  selectedDate: string;
  onSelectDate: (date: string) => void;
}) {
  const [viewYear, setViewYear] = useState(() => new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(() => new Date().getMonth());

  const { data: blockedDates } = trpc.home.facilityBlockedDates.useQuery({ facilityId });
  const { data: hours } = trpc.home.facilityHours.useQuery({ facilityId });

  const blockedSet = useMemo(() => {
    return new Set((blockedDates ?? []).map((b: any) => b.blockedDate));
  }, [blockedDates]);

  const closedDays = useMemo(() => {
    if (!hours) return new Set<number>();
    return new Set(hours.filter((h: any) => !h.isOpen).map((h: any) => h.dayOfWeek));
  }, [hours]);

  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const days: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  function toDateStr(day: number) {
    return `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5">
      <div className="flex items-center justify-between mb-4">
        <button onClick={prevMonth} className="p-1 hover:bg-gray-100 rounded-full">
          <ChevronLeft size={16} />
        </button>
        <h3 className="font-bold text-gray-800 text-sm">{viewYear}년 {viewMonth + 1}월</h3>
        <button onClick={nextMonth} className="p-1 hover:bg-gray-100 rounded-full">
          <ChevronRight size={16} />
        </button>
      </div>
      <div className="flex gap-3 text-xs text-gray-500 mb-3 justify-center">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-green-100 border border-green-300 inline-block"></span>예약가능</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-100 border border-red-300 inline-block"></span>예약불가</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-[#1B5E20] inline-block"></span>선택됨</span>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs mb-1">
        {DAY_LABELS.map((d, i) => (
          <div key={i} className={`font-medium py-1 ${i === 0 ? "text-red-400" : i === 6 ? "text-blue-400" : "text-gray-500"}`}>
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs">
        {days.map((day, i) => {
          if (!day) return <div key={i} />;
          const dateStr = toDateStr(day);
          const date = new Date(dateStr);
          const isPast = date < today;
          const isBlocked = blockedSet.has(dateStr);
          const isClosed = closedDays.has(date.getDay());
          const isSelected = selectedDate === dateStr;
          const isUnavailable = isPast || isBlocked || isClosed;

          return (
            <button
              key={i}
              disabled={isUnavailable}
              onClick={() => onSelectDate(dateStr)}
              className={`rounded-full w-8 h-8 flex items-center justify-center mx-auto font-medium transition-colors
                ${isSelected ? "bg-[#1B5E20] text-white" :
                  isUnavailable ? "text-gray-300 cursor-not-allowed" :
                  "bg-green-50 text-green-700 border border-green-200 hover:bg-green-200"}`}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── 메인 상세 페이지 ───────────────────────────────────────
export default function FacilityDetail() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const facilityId = parseInt(params.id ?? "0");
  const [selectedDate, setSelectedDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");

  const { data: facility, isLoading } = trpc.home.facility.useQuery(
    { id: facilityId },
    { enabled: !isNaN(facilityId) }
  );

  // 날짜 변경 시 시간 초기화
  function handleSelectDate(date: string) {
    setSelectedDate(date);
    setStartTime("");
    setEndTime("");
  }

  // 시간 선택 핸들러
  function handleSelectTime(start: string, end: string) {
    setStartTime(start);
    setEndTime(end);
  }

  // 예약 신청 버튼 클릭
  function handleApply() {
    if (!selectedDate) return;
    let url = `/facility/${facilityId}/apply?date=${selectedDate}`;
    if (startTime) url += `&startTime=${startTime}`;
    if (endTime) url += `&endTime=${endTime}`;
    navigate(url);
  }

  // 버튼 라벨
  const applyLabel = useMemo(() => {
    if (!selectedDate) return "날짜를 먼저 선택하세요";
    if (!startTime) return `${selectedDate} — 시간을 선택하세요`;
    if (!endTime) return `${selectedDate} ${startTime} — 종료 시간을 선택하세요`;
    return `${selectedDate} ${startTime}~${endTime} 예약 신청하기`;
  }, [selectedDate, startTime, endTime]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7F7F5]">
        <div className="text-center text-gray-400">
          <div className="w-12 h-12 border-4 border-green-200 border-t-green-600 rounded-full animate-spin mx-auto mb-4" />
          <p>시설 정보를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (!facility) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7F7F5]">
        <div className="text-center">
          <CalendarCheck size={64} className="text-gray-300 mx-auto mb-4" />
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
            {facility.isReservable ? (
              <Badge className="bg-white/20 text-white border-white/30">예약 가능</Badge>
            ) : (
              <Badge className="bg-red-500/80 text-white">예약 불가</Badge>
            )}
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
              <ImageGallery facilityId={facilityId} name={facility.name} />

              {/* 시설 기본 정보 */}
              <div className="bg-white rounded-xl p-6 border border-gray-100">
                <h2 className="font-bold text-gray-900 mb-4 text-base" style={{ fontFamily: "'Noto Serif KR', serif" }}>
                  시설 정보
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-5">
                  <div className="text-center p-3 bg-[#F1F8E9] rounded-lg">
                    <Users className="text-[#1B5E20] mx-auto mb-1" size={20} />
                    <p className="text-xs text-gray-500">수용 인원</p>
                    <p className="font-bold text-gray-800">{facility.capacity}명</p>
                  </div>
                  {facility.location && (
                    <div className="text-center p-3 bg-[#F1F8E9] rounded-lg">
                      <MapPin className="text-[#1B5E20] mx-auto mb-1" size={20} />
                      <p className="text-xs text-gray-500">위치</p>
                      <p className="font-bold text-gray-800 text-sm">{facility.location}</p>
                    </div>
                  )}
                  <div className="text-center p-3 bg-[#F1F8E9] rounded-lg">
                    <Clock className="text-[#1B5E20] mx-auto mb-1" size={20} />
                    <p className="text-xs text-gray-500">예약 단위</p>
                    <p className="font-bold text-gray-800 text-sm">{facility.slotMinutes}분 단위</p>
                  </div>
                </div>
                {facility.description && (
                  <p className="text-sm text-gray-600 leading-relaxed">{facility.description}</p>
                )}
                {facility.pricePerHour > 0 && (
                  <div className="mt-3 p-3 bg-amber-50 rounded-lg text-sm text-amber-800">
                    <strong>이용 요금:</strong> 시간당 {facility.pricePerHour.toLocaleString()}원
                  </div>
                )}
              </div>

              {/* 이용 안내 */}
              {facility.notice && (
                <div className="bg-blue-50 rounded-xl p-6 border border-blue-100">
                  <h2 className="font-bold text-gray-900 mb-3 text-base flex items-center gap-2">
                    <CalendarCheck className="text-blue-500" size={18} />
                    이용 안내
                  </h2>
                  <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{facility.notice}</p>
                </div>
              )}

              {/* 주의사항 */}
              {facility.caution && (
                <div className="bg-amber-50 rounded-xl p-6 border border-amber-100">
                  <h2 className="font-bold text-gray-900 mb-3 text-base flex items-center gap-2">
                    <AlertCircle className="text-amber-500" size={18} />
                    이용 시 주의사항
                  </h2>
                  <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{facility.caution}</p>
                </div>
              )}

              {/* 운영 시간 */}
              <HoursTable facilityId={facilityId} />
            </div>

            {/* 오른쪽: 달력 + 시간대 현황 + 예약 버튼 */}
            <div className="space-y-5">
              <ReservationCalendar
                facilityId={facilityId}
                selectedDate={selectedDate}
                onSelectDate={handleSelectDate}
              />

              {/* 날짜 선택 시 시간대 현황 + 선택 패널 표시 */}
              {selectedDate && (
                <TimeSlotPanel
                  facilityId={facilityId}
                  selectedDate={selectedDate}
                  startTime={startTime}
                  endTime={endTime}
                  onSelectTime={handleSelectTime}
                />
              )}

              {/* 예약 신청 버튼 */}
              {facility.isReservable ? (
                <Button
                  className="w-full bg-[#1B5E20] hover:bg-[#2E7D32] text-white py-6 text-base font-bold rounded-xl disabled:opacity-50"
                  disabled={!selectedDate}
                  onClick={handleApply}
                >
                  <CalendarCheck size={20} className="mr-2" />
                  {applyLabel}
                </Button>
              ) : (
                <div className="bg-gray-100 text-gray-500 rounded-xl p-5 text-center">
                  <p className="font-bold mb-1">현재 예약 불가</p>
                  <p className="text-xs">관리자에게 문의해 주세요.</p>
                </div>
              )}

              {/* 문의 */}
              <div className="bg-white rounded-xl p-5 border border-gray-100">
                <p className="font-bold text-gray-800 text-sm mb-2 flex items-center gap-2">
                  <Phone size={14} className="text-[#1B5E20]" />
                  시설 문의
                </p>
                <p className="text-sm text-gray-500">행정실: <span className="text-[#1B5E20] font-medium">02-000-0000</span></p>
                <p className="text-xs text-gray-400 mt-1">평일 09:00 ~ 18:00</p>
              </div>

              {/* 목록으로 */}
              <Link href="/facility">
                <div className="text-center text-sm text-gray-400 hover:text-[#1B5E20] transition-colors cursor-pointer py-2 flex items-center justify-center gap-1">
                  <ChevronLeft size={14} /> 시설 목록으로 돌아가기
                </div>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
