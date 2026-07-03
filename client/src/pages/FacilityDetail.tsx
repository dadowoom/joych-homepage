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
import ReservationTimelinePicker from "@/components/facility/ReservationTimelinePicker";
import { hasContentPermission } from "@/lib/contentPermissions";
import { Users, MapPin, Clock, ChevronLeft, ChevronRight, Phone, AlertCircle, CalendarCheck, Loader2 } from "lucide-react";
import {
  getExternalReservationMaxDateKey,
  getExternalReservationWindow,
  getExternalReservationWindowMessage,
  getFacilityReservationMaxMonths,
  getKstDateKey,
  getReservationMaxDateKey,
  getReservationTimeRestriction,
  hasReservableStartTime,
} from "@/lib/facilityReservationTime";
import { formatKoreanDateKey, getDateKeyDayOfWeek } from "@/lib/koreanDate";
import {
  generateReservationTimePoints,
} from "@/lib/facilitySlotSelection";

const DAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];
const FACILITY_CONTACT_DEFAULT_TEXT_KEY = "facility_contact_default_text";
const FACILITY_MEMBER_RULES_TITLE_KEY = "facility_member_rules_title";
const FACILITY_MEMBER_RULES_TEXT_KEY = "facility_member_rules_text";
const DEFAULT_FACILITY_CONTACT_TEXT = "기쁨의교회 사무국 054-270-1002";
const DEFAULT_MEMBER_FACILITY_RULES_TITLE = "교인 시설사용 주의사항";

type FacilityBuilding = "hayoungin" | "welfare";
type FacilityAudience = "member" | "external";

function normalizeFacilityBuilding(building: string | null | undefined): FacilityBuilding {
  return building === "hayoungin" ? "hayoungin" : "welfare";
}

function getFacilityListHref(building: FacilityBuilding, audience: FacilityAudience = "member") {
  return audience === "external" ? `/facility/external?building=${building}` : `/facility?building=${building}`;
}

function getFacilityApplyHref(facilityId: number, audience: FacilityAudience) {
  return audience === "external" ? `/facility/external/${facilityId}/apply` : `/facility/${facilityId}/apply`;
}

function useFacilityHoursForAudience(facilityId: number, audience: FacilityAudience) {
  const memberHoursQuery = trpc.home.facilityHours.useQuery(
    { facilityId },
    { enabled: audience === "member" && !!facilityId }
  );
  const externalHoursQuery = trpc.home.externalFacilityHours.useQuery(
    { facilityId },
    { enabled: audience === "external" && !!facilityId }
  );

  return audience === "external" ? externalHoursQuery : memberHoursQuery;
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

type ReservationByDateRow = {
  id?: number;
  reservationType?: "member" | "external" | "course" | string | null;
  startTime: string;
  endTime: string;
  status: string;
  reserverName?: string | null;
  reserverPhone?: string | null;
  purpose?: string | null;
  department?: string | null;
  attendees?: number | null;
  userName?: string | null;
  memberPosition?: string | null;
  memberPhone?: string | null;
};

function isActiveReservation(row: ReservationByDateRow) {
  return row.status !== "rejected" && row.status !== "cancelled";
}

function hasAdminReservationDetails(row: ReservationByDateRow) {
  return Boolean(
    row.reserverName ||
    row.userName ||
    row.reserverPhone ||
    row.memberPhone ||
    row.memberPosition ||
    row.department ||
    row.purpose
  );
}

function getReservationName(row: ReservationByDateRow) {
  return row.reserverName || row.userName || "이름 없음";
}

function getReservationTypeLabel(row: ReservationByDateRow) {
  if (row.reservationType === "external") return "외부인";
  if (row.reservationType === "course") return "강좌";
  return "성도";
}

function getReservationTypeBadgeClass(row: ReservationByDateRow) {
  if (row.reservationType === "external") return "bg-amber-100 text-amber-700";
  if (row.reservationType === "course") return "bg-blue-100 text-blue-700";
  return "bg-green-100 text-green-700";
}

function getReservationPosition(row: ReservationByDateRow) {
  if (row.reservationType === "external") return row.department || "외부인";
  if (row.reservationType === "course") return row.department || "강좌";
  return row.memberPosition || row.department || "-";
}

function getReservationPhone(row: ReservationByDateRow) {
  return row.reserverPhone || row.memberPhone || "-";
}

function getReservationTimeRange(row: ReservationByDateRow) {
  return `${row.startTime}~${row.endTime}`;
}

function getReservationStatusLabel(status: string) {
  if (status === "approved") return "승인";
  if (status === "pending") return "대기";
  if (status === "rejected") return "거절";
  if (status === "cancelled") return "취소";
  return status;
}

function FacilityInquiryCard({ contactText }: { contactText: string }) {
  return (
    <div className="bg-white rounded-xl p-5 border border-gray-100">
      <p className="font-bold text-gray-800 text-sm mb-2 flex items-center gap-2">
        <Phone size={14} className="text-[#1B5E20]" />
        시설 문의
      </p>
      <p className="whitespace-pre-line text-sm leading-6 text-gray-600">{contactText}</p>
    </div>
  );
}


// ── 운영 시간 표시 ──────────────────────────────────────────
function HoursTable({ facilityId, audience }: { facilityId: number; audience: FacilityAudience }) {
  const { data: hours } = useFacilityHoursForAudience(facilityId, audience);
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
        <img src={images[active]?.imageUrl} alt={name} className="w-full h-full object-cover"  loading="lazy"/>
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
              <img src={img.imageUrl} alt="" className="w-full h-full object-cover"  loading="lazy"/>
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
  audience,
}: {
  facilityId: number;
  facility: Facility | null | undefined;
  selectedDate: string;
  startTime: string;
  endTime: string;
  onSelectTime: (start: string, end: string) => void;
  hasReservationOverride: boolean;
  audience: FacilityAudience;
}) {
  const dayOfWeek = getDateKeyDayOfWeek(selectedDate);
  const slotMinutes = facility?.slotMinutes ?? 60;

  const { data: hours } = useFacilityHoursForAudience(facilityId, audience);
  const { data: reservations, isLoading } = trpc.home.facilityReservationsByDate.useQuery(
    { facilityId, date: selectedDate },
    { enabled: !!selectedDate }
  );
  const reservationRows = useMemo(
    () => (reservations ?? []) as ReservationByDateRow[],
    [reservations]
  );

  const todayHour = useMemo(() => {
    if (!hours) return null;
    return hours.find((h: FacilityHour) => h.dayOfWeek === dayOfWeek) ?? null;
  }, [hours, dayOfWeek]);

  // 예약된 시간 슬롯 계산 (slotMinutes 단위)
  const bookedSlots = useMemo(() => {
    const set = new Set<string>();
    reservationRows.forEach((r) => {
      if (!isActiveReservation(r)) return;
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
  }, [reservationRows, slotMinutes]);

  const reservationBySlot = useMemo(() => {
    const map = new Map<string, ReservationByDateRow>();
    reservationRows.forEach((r) => {
      if (!isActiveReservation(r)) return;
      const [sh, sm] = r.startTime.split(":").map(Number);
      const [eh, em] = r.endTime.split(":").map(Number);
      let cur = sh * 60 + sm;
      const end = eh * 60 + em;
      while (cur < end) {
        const h = Math.floor(cur / 60);
        const m = cur % 60;
        map.set(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`, r);
        cur += slotMinutes;
      }
    });
    return map;
  }, [reservationRows, slotMinutes]);

  const adminReservations = useMemo(
    () => reservationRows.filter((r) => isActiveReservation(r) && hasAdminReservationDetails(r)),
    [reservationRows]
  );

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
    return generateReservationTimePoints(openTime, closeTime, slotMinutes);
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
    return formatKoreanDateKey(selectedDate);
  }, [selectedDate]);

  function renderDisabledTooltip(slot: string, disabledReason?: string) {
    const bookedReservation = reservationBySlot.get(slot);
    if (!bookedReservation || !hasAdminReservationDetails(bookedReservation)) {
      return disabledReason ?? "예약 불가";
    }

    return (
      <div className="space-y-0.5">
        <p className="font-semibold text-white">
          {getReservationTypeLabel(bookedReservation)} · {getReservationName(bookedReservation)} · {getReservationTimeRange(bookedReservation)}
        </p>
        <p className="text-gray-200">
          {getReservationPosition(bookedReservation)} · {getReservationPhone(bookedReservation)}
        </p>
        {bookedReservation.purpose && (
          <p className="line-clamp-2 text-gray-300">{bookedReservation.purpose}</p>
        )}
      </div>
    );
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

          <ReservationTimelinePicker
            allSlots={allSlots}
            bookedSlots={bookedSlots}
            disabledSlots={disabledSlots}
            startTime={startTime}
            endTime={endTime}
            onSelect={onSelectTime}
            slotMinutes={slotMinutes}
            maxSlots={Math.max(1, allSlots.length - 1)}
            showSelectAll={hasReservationOverride}
            renderDisabledTooltip={renderDisabledTooltip}
          />

          {adminReservations.length > 0 && (
            <div className="mt-3 rounded-lg border border-green-100 bg-green-50/60 p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-xs font-bold text-[#1B5E20]">관리자용 예약 상세</p>
                <p className="text-[10px] text-gray-400">관리자에게만 표시</p>
              </div>
              <div className="space-y-2">
                {adminReservations.map((reservation, index) => (
                  <div
                    key={reservation.id ?? `${reservation.startTime}-${reservation.endTime}-${index}`}
                    className="rounded-md border border-white bg-white/90 p-2 text-xs text-gray-700 shadow-sm"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-1">
                      <span className="font-bold text-gray-900">
                        {getReservationTimeRange(reservation)}
                      </span>
                      <span className="flex flex-wrap items-center gap-1">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${getReservationTypeBadgeClass(reservation)}`}>
                          {getReservationTypeLabel(reservation)}
                        </span>
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-gray-500">
                          {getReservationStatusLabel(reservation.status)}
                        </span>
                      </span>
                    </div>
                    <div className="mt-1 grid grid-cols-[52px_1fr] gap-x-2 gap-y-1">
                      <span className="text-gray-400">구분</span>
                      <span>{getReservationTypeLabel(reservation)}</span>
                      <span className="text-gray-400">이름</span>
                      <span className="font-medium text-gray-900">{getReservationName(reservation)}</span>
                      <span className="text-gray-400">직분/부서</span>
                      <span>{getReservationPosition(reservation)}</span>
                      <span className="text-gray-400">전화번호</span>
                      <span>{getReservationPhone(reservation)}</span>
                      {reservation.purpose && (
                        <>
                          <span className="text-gray-400">목적</span>
                          <span className="line-clamp-2">{reservation.purpose}</span>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
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
  reservationMaxDateKey,
  reservationLimitMessage,
  onSelectDate,
  hasReservationOverride,
  audience,
}: {
  facilityId: number;
  selectedDate: string;
  slotMinutes?: number | null;
  reservationMaxDateKey: string;
  reservationLimitMessage: string | null;
  onSelectDate: (date: string) => void;
  hasReservationOverride: boolean;
  audience: FacilityAudience;
}) {
  const [viewYear, setViewYear] = useState(() => new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(() => new Date().getMonth());

  const { data: blockedDates } = trpc.home.facilityBlockedDates.useQuery({ facilityId });
  const { data: hours } = useFacilityHoursForAudience(facilityId, audience);

  const blockedSet = useMemo(() => {
    return new Set((blockedDates ?? []).map((b: FacilityBlockedDate) => b.blockedDate));
  }, [blockedDates]);

  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const days: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const todayDateKey = getKstDateKey();
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

  const nextMonthIndex = viewMonth === 11 ? 0 : viewMonth + 1;
  const nextMonthYear = viewMonth === 11 ? viewYear + 1 : viewYear;
  const nextMonthFirstDateKey = `${nextMonthYear}-${String(nextMonthIndex + 1).padStart(2, "0")}-01`;
  const isNextMonthUnavailable = !hasReservationOverride && nextMonthFirstDateKey > reservationMaxDateKey;

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5">
      <div className="flex items-center justify-between mb-4">
        <button onClick={prevMonth} className="p-1 hover:bg-gray-100 rounded-full">
          <ChevronLeft size={16} />
        </button>
        <h3 className="font-bold text-gray-800 text-sm">{viewYear}년 {viewMonth + 1}월</h3>
        <button
          onClick={nextMonth}
          disabled={isNextMonthUnavailable}
          className="p-1 hover:bg-gray-100 rounded-full disabled:cursor-not-allowed disabled:opacity-30"
        >
          <ChevronRight size={16} />
        </button>
      </div>
      <div className="flex gap-3 text-xs text-gray-500 mb-3 justify-center">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-green-100 border border-green-300 inline-block"></span>예약가능</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-100 border border-red-300 inline-block"></span>예약불가</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-[#1B5E20] inline-block"></span>선택됨</span>
      </div>
      {!hasReservationOverride && reservationLimitMessage && (
        <p className="mb-3 rounded-lg bg-gray-50 px-3 py-2 text-center text-[11px] text-gray-500">
          {reservationLimitMessage}
        </p>
      )}
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
          const isPast = dateStr < todayDateKey;
          const isAfterReservationWindow = !hasReservationOverride && dateStr > reservationMaxDateKey;
          const isBlocked = blockedSet.has(dateStr);
          const dayHour = hours?.find((h: FacilityHour) => h.dayOfWeek === getDateKeyDayOfWeek(dateStr));
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
          const isUnavailable = isPast || (!hasReservationOverride && (isAfterReservationWindow || isBlocked || isClosed || !hasAvailableStartTime));

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
function FacilityDetail({ audience = "member" }: { audience?: FacilityAudience }) {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const searchString = useSearch();
  const facilityId = parseInt(params.id ?? "0");
  const [selectedDate, setSelectedDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const isExternal = audience === "external";

  const memberFacilityQuery = trpc.home.facility.useQuery(
    { id: facilityId },
    { enabled: !isNaN(facilityId) && !isExternal }
  );
  const externalFacilityQuery = trpc.home.externalFacility.useQuery(
    { id: facilityId },
    { enabled: !isNaN(facilityId) && isExternal }
  );
  const facility = isExternal ? externalFacilityQuery.data : memberFacilityQuery.data;
  const isLoading = isExternal ? externalFacilityQuery.isLoading : memberFacilityQuery.isLoading;
  const { data: memberMe, isLoading: memberLoading } = trpc.members.me.useQuery(undefined, {
    enabled: !isExternal,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const { data: authMe } = trpc.auth.me.useQuery(undefined, {
    enabled: !isExternal,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const { data: reservationSettings } = trpc.home.settings.useQuery();
  const isApprovedMember = isExternal || Boolean(memberMe);
  const hasReservationOverride =
    !isExternal &&
    (hasContentPermission(authMe, "content:reservations") ||
      hasContentPermission(authMe, "content:facilities"));
  const reservationMaxMonths = getFacilityReservationMaxMonths(reservationSettings);
  const externalReservationWindow = isExternal
    ? getExternalReservationWindow(reservationSettings, facility)
    : null;
  const reservationMaxDateKey = isExternal
    ? getExternalReservationMaxDateKey(reservationSettings, facility)
    : getReservationMaxDateKey(reservationSettings);
  const reservationLimitMessage = isExternal
    ? externalReservationWindow
      ? getExternalReservationWindowMessage(externalReservationWindow)
      : null
    : `예약은 최대 ${reservationMaxMonths}개월 후(${reservationMaxDateKey})까지만 가능합니다.`;
  const activeBuilding = useMemo(() => {
    const requestedBuilding = new URLSearchParams(searchString).get("building");
    return normalizeFacilityBuilding(requestedBuilding ?? facility?.building);
  }, [facility?.building, searchString]);
  const facilityListHref = getFacilityListHref(activeBuilding, audience);
  const facilityNoticeText = useMemo(() => {
    const memberNotice = facility?.notice?.trim() ?? "";
    const externalNotice = facility?.externalNotice?.trim() ?? "";
    return isExternal ? (externalNotice || memberNotice) : memberNotice;
  }, [facility?.externalNotice, facility?.notice, isExternal]);
  const facilityContactText =
    facility?.contactText?.trim() ||
    reservationSettings?.[FACILITY_CONTACT_DEFAULT_TEXT_KEY]?.trim() ||
    DEFAULT_FACILITY_CONTACT_TEXT;
  const memberFacilityRuleLines = useMemo(
    () => (reservationSettings?.[FACILITY_MEMBER_RULES_TEXT_KEY] ?? "")
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean),
    [reservationSettings],
  );
  const memberRulesTitle =
    reservationSettings?.[FACILITY_MEMBER_RULES_TITLE_KEY]?.trim() ||
    DEFAULT_MEMBER_FACILITY_RULES_TITLE;

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
    if (!isExternal && !isApprovedMember) {
      goToMemberLogin();
      return;
    }
    const params = new URLSearchParams({
      date: selectedDate,
      building: activeBuilding,
    });
    if (startTime) params.set("startTime", startTime);
    if (endTime) params.set("endTime", endTime);
    navigate(`${getFacilityApplyHref(facilityId, audience)}?${params.toString()}`);
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

              {/* 시설 안내 */}
              {facilityNoticeText && (
                <div className="rounded-xl border border-teal-100 bg-teal-50 p-4 text-sm leading-6 text-teal-900">
                  <div className="mb-1 flex items-center gap-2 font-bold">
                    <AlertCircle className="h-4 w-4 text-teal-600" />
                    시설 안내
                  </div>
                  <p className="whitespace-pre-line text-teal-800">{facilityNoticeText}</p>
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

              {!isExternal && memberFacilityRuleLines.length > 0 && (
                <div className="bg-amber-50 rounded-xl p-6 border border-amber-100">
                  <h2 className="font-bold text-gray-900 mb-3 text-base flex items-center gap-2">
                    <AlertCircle className="text-amber-500" size={18} />
                    {memberRulesTitle}
                  </h2>
                  <ol className="list-decimal space-y-1.5 pl-5 text-sm leading-6 text-amber-900">
                    {memberFacilityRuleLines.map((line, index) => (
                      <li key={`${index}-${line}`}>{line}</li>
                    ))}
                  </ol>
                </div>
              )}

              {/* 문의 */}
              <FacilityInquiryCard contactText={facilityContactText} />
            </div>

            {/* 오른쪽: 달력 + 시간대 현황 + 예약 버튼 */}
            <div className="space-y-5">
              <ReservationCalendar
                facilityId={facilityId}
                selectedDate={selectedDate}
                slotMinutes={facility?.slotMinutes ?? 60}
                reservationMaxDateKey={reservationMaxDateKey}
                reservationLimitMessage={reservationLimitMessage}
                onSelectDate={handleSelectDate}
                hasReservationOverride={hasReservationOverride}
                audience={audience}
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
                  audience={audience}
                />
              )}

              {/* 운영 시간 */}
              <HoursTable facilityId={facilityId} audience={audience} />

              {/* 예약 신청 버튼 */}
              {facility.isReservable ? (
                <Button
                  className="w-full bg-[#1B5E20] hover:bg-[#2E7D32] text-white py-6 text-base font-bold rounded-xl disabled:opacity-50"
                  disabled={!selectedDate || (!isExternal && memberLoading)}
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

export function ExternalFacilityDetail() {
  return <FacilityDetail audience="external" />;
}

function MemberFacilityDetail() {
  return <FacilityDetail audience="member" />;
}

export default MemberFacilityDetail;
