/**
 * 시설 사용 예약 — 상세 페이지 (/facility/:id)
 * 실제 DB API 연결 버전 — 달력 예약 현황, 운영 시간, 이미지 갤러리 포함
 * 개선: 날짜 클릭 시 시간대 현황 패널 표시 + 시간 슬롯 클릭으로 시작/종료 선택
 */

import { useState, useMemo } from "react";
import { Link, useParams, useLocation, useSearch } from "wouter";
import { trpc } from "@/lib/trpc";
import type { Facility, FacilityHour, FacilityImage, FacilityBlockedDate } from "../../../drizzle/schema";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, MapPin, Clock, ChevronLeft, ChevronRight, Phone, AlertCircle, CalendarCheck, Loader2 } from "lucide-react";
import { getReservationTimeRestriction, hasReservableStartTime } from "@/lib/facilityReservationTime";
import { hasFacilityReservationRuleOverride } from "@shared/facilityReservationEligibility";

const DAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

type FacilityBuilding = "hayoungin" | "welfare";

function normalizeFacilityBuilding(building: string | null | undefined): FacilityBuilding {
  return building === "hayoungin" ? "hayoungin" : "welfare";
}

function getFacilityListHref(building: FacilityBuilding) {
  return `/facility?building=${building}`;
}

function formatDayRanges(days: number[]) {
  const sortedDays = days
    .filter(day => day >= 0 && day < DAY_LABELS.length)
    .filter((day, index, validDays) => validDays.indexOf(day) === index)
    .sort((a, b) => a - b);

  const ranges: string[] = [];
  let start: number | null = null;
  let previous: number | null = null;

  for (const day of sortedDays) {
    if (start === null || previous === null || day !== previous + 1) {
      if (start !== null && previous !== null) {
        ranges.push(start === previous ? DAY_LABELS[start] : `${DAY_LABELS[start]}~${DAY_LABELS[previous]}`);
      }
      start = day;
    }
    previous = day;
  }

  if (start !== null && previous !== null) {
    ranges.push(start === previous ? DAY_LABELS[start] : `${DAY_LABELS[start]}~${DAY_LABELS[previous]}`);
  }

  return ranges.join(", ");
}

function formatOperatingHoursSummary(hours: FacilityHour[] | undefined) {
  if (!hours || hours.length === 0) return "운영시간 정보는 시설 안내를 확인해 주세요.";

  const openGroups = new Map<string, number[]>();
  const closedDays: number[] = [];

  [...hours]
    .sort((a, b) => a.dayOfWeek - b.dayOfWeek)
    .forEach(hour => {
      if (!hour.isOpen || !hour.openTime || !hour.closeTime) {
        closedDays.push(hour.dayOfWeek);
        return;
      }

      const breakLabel = hour.breakStart && hour.breakEnd ? ` (휴게 ${hour.breakStart}~${hour.breakEnd})` : "";
      const timeLabel = `${hour.openTime} ~ ${hour.closeTime}${breakLabel}`;
      openGroups.set(timeLabel, [...(openGroups.get(timeLabel) ?? []), hour.dayOfWeek]);
    });

  const summaries = Array.from(openGroups.entries()).map(([timeLabel, days]) => `${formatDayRanges(days)} ${timeLabel}`);
  if (closedDays.length > 0) {
    summaries.push(`${formatDayRanges(closedDays)} 휴무`);
  }

  return summaries.length > 0 ? summaries.join(" / ") : "운영시간 정보는 시설 안내를 확인해 주세요.";
}

function generateReservationStartSlots(openTime: string, closeTime: string, slotMinutes: number) {
  const [openHour, openMinute] = openTime.split(":").map(Number);
  const [closeHour, closeMinute] = closeTime.split(":").map(Number);
  if ([openHour, openMinute, closeHour, closeMinute].some(Number.isNaN) || slotMinutes <= 0) return [];

  const slots: string[] = [];
  let current = openHour * 60 + openMinute;
  const close = closeHour * 60 + closeMinute;
  while (current < close) {
    slots.push(`${String(Math.floor(current / 60)).padStart(2, "0")}:${String(current % 60).padStart(2, "0")}`);
    current += slotMinutes;
  }

  return slots;
}

function FacilityInquiryCard({ facilityId }: { facilityId: number }) {
  const { data: hours } = trpc.home.facilityHours.useQuery({ facilityId });
  const hoursSummary = useMemo(() => formatOperatingHoursSummary(hours), [hours]);

  return (
    <div className="bg-white rounded-xl p-5 border border-gray-100">
      <p className="font-bold text-gray-800 text-sm mb-2 flex items-center gap-2">
        <Phone size={14} className="text-[#1B5E20]" />
        시설 문의
      </p>
      <p className="text-sm text-gray-500">행정실: <span className="text-[#1B5E20] font-medium">054-270-1000</span></p>
      <p className="text-xs text-gray-400 mt-1">운영시간: {hoursSummary}</p>
    </div>
  );
}


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
        {hours.map((h: FacilityHour) => (
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
          {images.map((img: FacilityImage, i: number) => (
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
  facility,
  selectedDate,
  startTime,
  endTime,
  onSelectTime,
  hasReservationOverride,
}: {
  facilityId: number;
  facility: Facility | null | undefined;
  selectedDate: string;
  startTime: string;
  endTime: string;
  onSelectTime: (start: string, end: string) => void;
  hasReservationOverride: boolean;
}) {
  const dayOfWeek = new Date(selectedDate).getDay();
  const slotMinutes = facility?.slotMinutes ?? 60;
  const maxSlots = facility?.maxSlots ?? 8;

  const { data: hours } = trpc.home.facilityHours.useQuery({ facilityId });
  const { data: reservations, isLoading } = trpc.home.facilityReservationsByDate.useQuery(
    { facilityId, date: selectedDate },
    { enabled: !!selectedDate }
  );

  const todayHour = useMemo(() => {
    if (!hours) return null;
    return hours.find((h: FacilityHour) => h.dayOfWeek === dayOfWeek) ?? null;
  }, [hours, dayOfWeek]);

  // 예약된 시간 슬롯 계산 (slotMinutes 단위)
  const bookedSlots = useMemo(() => {
    const set = new Set<string>();
    if (!reservations) return set;
    reservations.forEach((r) => {
      if (r.status === "rejected" || r.status === "cancelled") return;
      const [sh, sm] = r.startTime.split(":").map(Number);
      const [eh, em] = r.endTime.split(":").map(Number);
      let cur = sh * 60 + sm;
      const end = eh * 60 + em;
      while (cur < end) {
        const h = Math.floor(cur / 60);
        const m = cur % 60;
        set.add(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
        cur += slotMinutes;
      }
    });
    return set;
  }, [reservations, slotMinutes]);

  // Generate selectable start slots within operating hours.
  const allSlots = useMemo(() => {
    if (!hasReservationOverride && (!todayHour || !todayHour.isOpen)) return [];
    const openTime = hasReservationOverride
      ? (todayHour?.openTime ?? facility?.openTime)
      : todayHour?.openTime;
    const closeTime = hasReservationOverride
      ? (todayHour?.closeTime ?? facility?.closeTime)
      : todayHour?.closeTime;
    if (!openTime || !closeTime) return [];
    return generateReservationStartSlots(openTime, closeTime, slotMinutes);
  }, [todayHour, slotMinutes, hasReservationOverride, facility?.openTime, facility?.closeTime]);

  const disabledSlots = useMemo(() => {
    const disabled = new Map<string, string>();
    if (!selectedDate) return disabled;
    allSlots.forEach((slot) => {
      const restriction = getReservationTimeRestriction(selectedDate, slot, {
        enforceLeadTime: !hasReservationOverride,
      });
      if (restriction) disabled.set(slot, restriction);
    });
    return disabled;
  }, [allSlots, selectedDate, hasReservationOverride]);

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
    if ((!hasReservationOverride && bookedSlots.has(slot)) || disabledSlots.has(slot)) return;

    // 종료 시간(closeTime) 슬롯은 시작 시간으로 선택 불가
    const lastSlot = allSlots[allSlots.length - 1];
    
    if (!startTime || (startTime && endTime)) {
      // 마지막 슬롯(종료 시간)은 시작 시간으로 선택 불가
      if (slot === lastSlot) return;
      onSelectTime(slot, "");
    } else {
      // 시작 시간이 있고 종료 시간이 없는 상태
      if (slot <= startTime) {
        if (slot === lastSlot) return;
        onSelectTime(slot, "");
      } else {
        // maxSlots 초과 여부 확인
        const [sh, sm] = startTime.split(":").map(Number);
        const [eh, em] = slot.split(":").map(Number);
        const diffMinutes = (eh * 60 + em) - (sh * 60 + sm);
        const selectedSlots = diffMinutes / slotMinutes;
        if (selectedSlots > maxSlots) {
          // 최대 예약 시간 초과 시 해당 슬롯을 새 시작 시간으로
          if (slot !== lastSlot) onSelectTime(slot, "");
          return;
        }
        // 시작~종료 사이에 예약된 슬롯이 있으면 불가
        let cur = sh * 60 + sm;
        const end = eh * 60 + em;
        let hasConflict = false;
        while (cur < end) {
          const h = Math.floor(cur / 60);
          const m = cur % 60;
          const slotKey = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
          if ((!hasReservationOverride && bookedSlots.has(slotKey)) || disabledSlots.has(slotKey)) {
            hasConflict = true;
            break;
          }
          cur += slotMinutes;
        }
        if (hasConflict) {
          if (slot !== lastSlot) onSelectTime(slot, "");
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
      {todayHour && !todayHour.isOpen && !hasReservationOverride && (
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
      {!isLoading && (hasReservationOverride || (todayHour && todayHour.isOpen)) && allSlots.length > 0 && (
        <>
          <p className="text-xs text-gray-500">
            운영 시간: {todayHour?.openTime ?? facility?.openTime} ~ {todayHour?.closeTime ?? facility?.closeTime}
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
              const isBooked = !hasReservationOverride && bookedSlots.has(slot);
              const disabledReason = disabledSlots.get(slot);
              const isDisabled = isBooked || Boolean(disabledReason);
              const isStart = slot === startTime;
              const isEnd = slot === endTime;
              const isInRange = startTime && endTime && slot > startTime && slot < endTime;
              const isSelected = isStart || isEnd || isInRange;

              return (
                <div key={slot} className="relative group">
                  <button
                    disabled={isDisabled}
                    onClick={() => handleSlotClick(slot)}
                    className={`text-xs px-2.5 py-1.5 rounded-md font-medium transition-colors ${
                      isDisabled
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
                  {isDisabled && (
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 bg-gray-800 text-white text-[10px] rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                      {disabledReason ?? "예약 불가"}
                      <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-800" />
                    </div>
                  )}
                </div>
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
  slotMinutes,
  onSelectDate,
  hasReservationOverride,
}: {
  facilityId: number;
  selectedDate: string;
  slotMinutes?: number | null;
  onSelectDate: (date: string) => void;
  hasReservationOverride: boolean;
}) {
  const [viewYear, setViewYear] = useState(() => new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(() => new Date().getMonth());

  const { data: blockedDates } = trpc.home.facilityBlockedDates.useQuery({ facilityId });
  const { data: hours } = trpc.home.facilityHours.useQuery({ facilityId });

  const blockedSet = useMemo(() => {
    return new Set((blockedDates ?? []).map((b: FacilityBlockedDate) => b.blockedDate));
  }, [blockedDates]);

  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const days: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const normalizedSlotMinutes = Math.max(1, Number(slotMinutes) || 60);

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
          const dayHour = hours?.find((h: FacilityHour) => h.dayOfWeek === date.getDay());
          const hoursLoaded = Boolean(hours);
          const isClosed = hoursLoaded ? !dayHour?.isOpen : false;
          const startSlots =
            hoursLoaded && dayHour?.isOpen && dayHour.openTime && dayHour.closeTime
              ? generateReservationStartSlots(dayHour.openTime, dayHour.closeTime, normalizedSlotMinutes)
              : [];
          const hasAvailableStartTime = hoursLoaded
            ? startSlots.length > 0 && hasReservableStartTime(dateStr, startSlots, {
                enforceLeadTime: !hasReservationOverride,
              })
            : true;
          const isSelected = selectedDate === dateStr;
          const isUnavailable = isPast || (!hasReservationOverride && (isBlocked || isClosed || !hasAvailableStartTime));

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
  const searchString = useSearch();
  const facilityId = parseInt(params.id ?? "0");
  const [selectedDate, setSelectedDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");

  const { data: facility, isLoading } = trpc.home.facility.useQuery(
    { id: facilityId },
    { enabled: !isNaN(facilityId) }
  );
  const { data: memberMe, isLoading: memberLoading } = trpc.members.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });
  const isApprovedMember = Boolean(memberMe);
  const hasReservationOverride = hasFacilityReservationRuleOverride(memberMe ?? {});
  const activeBuilding = useMemo(() => {
    const requestedBuilding = new URLSearchParams(searchString).get("building");
    return normalizeFacilityBuilding(requestedBuilding ?? facility?.building);
  }, [facility?.building, searchString]);
  const facilityListHref = getFacilityListHref(activeBuilding);

  function goToMemberLogin() {
    const nextPath = `/facility/${facilityId}${searchString ? `?${searchString}` : ""}`;
    const loginParams = new URLSearchParams({
      social: "facility_member_required",
      next: nextPath,
    });
    navigate(`/member/login?${loginParams.toString()}`);
  }

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
    if (!isApprovedMember) {
      goToMemberLogin();
      return;
    }
    const params = new URLSearchParams({
      date: selectedDate,
      building: activeBuilding,
    });
    if (startTime) params.set("startTime", startTime);
    if (endTime) params.set("endTime", endTime);
    navigate(`/facility/${facilityId}/apply?${params.toString()}`);
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
          <Link href={facilityListHref} className="text-[#1B5E20] font-medium hover:underline">
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
            <Link href={facilityListHref} className="hover:text-white transition-colors">시설 사용 예약</Link>
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
                slotMinutes={facility?.slotMinutes ?? 60}
                onSelectDate={handleSelectDate}
                hasReservationOverride={hasReservationOverride}
              />

              {/* 날짜 선택 시 시간대 현황 + 선택 패널 표시 */}
              {selectedDate && (
                <TimeSlotPanel
                  facilityId={facilityId}
                  facility={facility}
                  selectedDate={selectedDate}
                  startTime={startTime}
                  endTime={endTime}
                  onSelectTime={handleSelectTime}
                  hasReservationOverride={hasReservationOverride}
                />
              )}

              {/* 예약 신청 버튼 */}
              {facility.isReservable ? (
                <Button
                  className="w-full bg-[#1B5E20] hover:bg-[#2E7D32] text-white py-6 text-base font-bold rounded-xl disabled:opacity-50"
                  disabled={!selectedDate || memberLoading}
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
              <FacilityInquiryCard facilityId={facilityId} />

              {/* 목록으로 */}
              <button onClick={() => window.history.back()} className="w-full text-center text-sm text-gray-400 hover:text-[#1B5E20] transition-colors cursor-pointer py-2 flex items-center justify-center gap-1">
                <ChevronLeft size={14} /> 뒤로 가기
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
