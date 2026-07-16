/**
 * 차량예약 사용자 화면
 * 지정된 성도 그룹만 목록/신청 화면에 접근할 수 있습니다.
 */

import { useEffect, useMemo, useState } from "react";
import { keepPreviousData } from "@tanstack/react-query";
import { Link, useLocation, useParams, useSearch } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/_core/hooks/useAuth";
import ReservationTimelinePicker from "@/components/facility/ReservationTimelinePicker";
import ReservationConflictDialog, {
  isReservationConflictMessage,
} from "@/components/facility/ReservationConflictDialog";
import { generateReservationTimePoints } from "@/lib/facilitySlotSelection";
import { hasContentPermission } from "@/lib/contentPermissions";
import {
  getBlockingVehicleConflicts,
  type VehicleAvailabilityConflict,
} from "@/lib/vehicleAvailabilityConflicts";
import { groupVehicleReservations } from "@/lib/vehicleReservationGroups";
import { sortVehiclePlateRows } from "@/lib/vehiclePlateSort";
import { shouldResetVehicleReservationTime } from "@/lib/vehicleReservationTimeSelection";
import { toast } from "sonner";
import {
  AlertCircle,
  CalendarCheck,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Loader2,
  MapPin,
  Phone,
  Users,
  Car,
} from "lucide-react";

type VehicleRow = {
  id: number;
  name: string;
  description?: string | null;
  plateNumber?: string | null;
  location?: string | null;
  driverInfo?: string | null;
  capacity: number;
  slotMinutes: number;
  minSlots: number;
  maxSlots: number;
  approvalType: "auto" | "manual";
  isReservable: boolean;
  isVisible: boolean;
  notice?: string | null;
  caution?: string | null;
  openTime: string;
  closeTime: string;
  thumbnailUrl?: string | null;
};

type ReservationByDateRow = {
  id?: number;
  startTime: string;
  endTime: string;
  status: string;
  reserverName?: string | null;
  reserverPhone?: string | null;
  purpose?: string | null;
  department?: string | null;
  passengers?: number | null;
  userName?: string | null;
  memberPosition?: string | null;
  memberPhone?: string | null;
};

type VehicleAvailabilityTimelineData = {
  selectedStartTime: string | null;
  timePoints: string[];
  selectAllOption: {
    startTime: string;
    endTime: string;
    availableVehicleCount: number;
  } | null;
  startOptions: Array<{
    startTime: string;
    defaultEndTime: string;
    availableVehicleCount: number;
  }>;
  blockedStartTimes: string[];
  pastStartTimes: string[];
  endOptions: Array<{
    endTime: string;
    availableVehicleCount: number;
  }>;
  blockedEndTimes: string[];
  occurrenceCount: number;
  conflicts?: VehicleAvailabilityConflict[];
};

type MyVehicleReservationRow = {
  id: number;
  vehicleId: number;
  vehicleName?: string | null;
  plateNumber?: string | null;
  reserverName: string;
  reserverPhone?: string | null;
  reservationDate: string;
  startTime: string;
  endTime: string;
  purpose: string;
  department?: string | null;
  passengers: number;
  status: "pending" | "approved" | "rejected" | "cancelled";
  recurrenceGroupId?: string | null;
  recurrenceLabel?: string | null;
  recurrenceSequence?: number | null;
  adminComment?: string | null;
  createdAt: Date | string;
};


const STATUS_LABELS = {
  pending: { label: "승인 대기", color: "bg-amber-100 text-amber-700", icon: <Clock className="h-3.5 w-3.5" /> },
  approved: { label: "승인 완료", color: "bg-green-100 text-green-700", icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
  rejected: { label: "거절", color: "bg-red-100 text-red-700", icon: <AlertCircle className="h-3.5 w-3.5" /> },
  cancelled: { label: "취소", color: "bg-gray-100 text-gray-500", icon: <AlertCircle className="h-3.5 w-3.5" /> },
} as const;

function getKstDateKey(date = new Date()) {
  return new Date(date.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function toMinutes(time: string) {
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + minute;
}

function formatPlateNumber(plateNumber?: string | null) {
  return (plateNumber ?? "").trim().replace(/^(\d+[가-힣])\s*(\d+)$/, "$1 $2");
}

function formatDate(dateKey: string) {
  const date = new Date(dateKey);
  return Number.isNaN(date.getTime())
    ? dateKey
    : date.toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "short" });
}

function formatDateLabel(dateKey: string) {
  const date = new Date(dateKey);
  return Number.isNaN(date.getTime())
    ? dateKey
    : date.toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "short" });
}

function isActiveReservation(row: ReservationByDateRow) {
  return row.status !== "rejected" && row.status !== "cancelled";
}

function hasReservationDetails(row: ReservationByDateRow) {
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

function getReservationPosition(row: ReservationByDateRow) {
  return row.memberPosition || row.department || "-";
}

function getReservationPhone(row: ReservationByDateRow) {
  return row.reserverPhone || row.memberPhone || "-";
}

function getReservationTimeRange(row: ReservationByDateRow) {
  return `${row.startTime}~${row.endTime}`;
}

function getLoginHref(next: string) {
  const params = new URLSearchParams({
    social: "vehicle_member_required",
    next,
  });
  return `/member/login?${params.toString()}`;
}

function AccessBlocked({ message, next }: { message: string; next: string }) {
  const isLoginMessage = message.includes("로그인") || message.includes("UNAUTHORIZED") || message.includes("unauthorized");
  return (
    <div className="min-h-screen bg-[#F7F7F5]">
      <VehicleHero />
      <section className="py-14">
        <div className="container max-w-xl">
          <div className="rounded-xl border border-gray-100 bg-white p-8 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#E8F5E9] text-[#1B5E20]">
              <Car className="h-7 w-7" />
            </div>
            <h2 className="text-xl font-bold text-gray-900" style={{ fontFamily: "'Noto Serif KR', serif" }}>
              차량예약 이용 확인이 필요합니다
            </h2>
            <p className="mt-3 text-sm leading-6 text-gray-500">
              {isLoginMessage
                ? "차량예약은 로그인한 성도 중 지정된 그룹만 이용할 수 있습니다."
                : message}
            </p>
            <div className="mt-6 flex justify-center gap-2">
              {isLoginMessage && (
                <Link href={getLoginHref(next)}>
                  <Button className="bg-[#1B5E20] text-white hover:bg-[#2E7D32]">성도 로그인</Button>
                </Link>
              )}
              <Link href="/">
                <Button variant="outline">홈으로</Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function VehicleHero() {
  return (
    <section className="bg-[#1B5E20] py-12 text-white">
      <div className="container">
        <p className="mb-2 text-sm uppercase tracking-widest text-green-200">Vehicle Reservation</p>
        <h1 className="text-3xl font-bold" style={{ fontFamily: "'Noto Serif KR', serif" }}>차량예약</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-green-100">
          교회 차량 사용 신청을 접수하고 담당자 승인 후 이용할 수 있습니다.
        </p>
        <nav className="mt-5 flex items-center gap-2 text-xs text-green-200">
          <Link href="/" className="hover:text-white">홈</Link>
          <span>/</span>
          <span className="text-white">차량예약</span>
        </nav>
      </div>
    </section>
  );
}

function VehicleCard({ vehicle, applyHref }: { vehicle: VehicleRow; applyHref: string }) {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
      {vehicle.thumbnailUrl ? (
        <img
          src={vehicle.thumbnailUrl}
          alt={vehicle.name}
          className="h-44 w-full object-cover"
          loading="lazy"
        />
      ) : (
        <div className="flex h-44 w-full items-center justify-center bg-[#E8F5E9] text-[#1B5E20]">
          <Car className="h-12 w-12" />
        </div>
      )}
      <div className="p-5">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <h3 className="text-lg font-bold text-gray-900" style={{ fontFamily: "'Noto Serif KR', serif" }}>{vehicle.name}</h3>
          {vehicle.plateNumber && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">{formatPlateNumber(vehicle.plateNumber)}</span>}
        </div>
        {vehicle.description && <p className="mb-4 line-clamp-2 text-sm leading-6 text-gray-500">{vehicle.description}</p>}
        <div className="mb-5 space-y-2 text-sm text-gray-600">
          {vehicle.location && <p className="flex items-center gap-2"><MapPin className="h-4 w-4 text-[#1B5E20]" /> {vehicle.location}</p>}
          <p className="flex items-center gap-2"><Users className="h-4 w-4 text-[#1B5E20]" /> 최대 {vehicle.capacity}명</p>
          <p className="flex items-center gap-2"><Clock className="h-4 w-4 text-[#1B5E20]" /> {vehicle.openTime}~{vehicle.closeTime} · {vehicle.slotMinutes}분 단위</p>
        </div>
        <Link href={applyHref}>
          <Button className="w-full bg-[#1B5E20] text-white hover:bg-[#2E7D32]">
            이 차량 선택
          </Button>
        </Link>
      </div>
    </div>
  );
}

function VehicleInquiryCard() {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-5">
      <p className="mb-2 flex items-center gap-2 text-sm font-bold text-gray-800">
        <Phone size={14} className="text-[#1B5E20]" />
        차량 문의
      </p>
      <p className="text-sm text-gray-500">행정실: <span className="font-medium text-[#1B5E20]">054-270-1000</span></p>
      <p className="mt-1 text-xs text-gray-400">예약 신청 후 담당자 승인 상태를 확인해 주세요.</p>
    </div>
  );
}

function VehicleReservationCalendar({
  selectedDate,
  onSelectDate,
}: {
  selectedDate: string;
  onSelectDate: (date: string) => void;
}) {
  const initialSelectedDate = /^\d{4}-\d{2}-\d{2}$/.test(selectedDate)
    ? selectedDate.split("-").map(Number)
    : null;
  const [viewYear, setViewYear] = useState(() => initialSelectedDate?.[0] ?? new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(() => (initialSelectedDate?.[1] ?? new Date().getMonth() + 1) - 1);
  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const days: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ];
  const todayKey = getKstDateKey();
  const dayLabels = ["일", "월", "화", "수", "목", "금", "토"];

  useEffect(() => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(selectedDate)) return;
    const [year, month] = selectedDate.split("-").map(Number);
    setViewYear(year);
    setViewMonth(month - 1);
  }, [selectedDate]);

  function toDateKey(day: number) {
    return `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  function prevMonth() {
    if (viewMonth === 0) {
      setViewYear((year) => year - 1);
      setViewMonth(11);
      return;
    }
    setViewMonth((month) => month - 1);
  }

  function nextMonth() {
    if (viewMonth === 11) {
      setViewYear((year) => year + 1);
      setViewMonth(0);
      return;
    }
    setViewMonth((month) => month + 1);
  }

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-5">
      <div className="mb-4 flex items-center justify-between">
        <button type="button" onClick={prevMonth} className="rounded-full p-1 hover:bg-gray-100">
          <ChevronLeft size={16} />
        </button>
        <h3 className="text-sm font-bold text-gray-800">{viewYear}년 {viewMonth + 1}월</h3>
        <button type="button" onClick={nextMonth} className="rounded-full p-1 hover:bg-gray-100">
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="mb-3 flex justify-center gap-3 text-xs text-gray-500">
        <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-full border border-green-300 bg-green-100" />선택 가능</span>
        <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-full bg-gray-200" />지난 날짜</span>
        <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-full bg-[#1B5E20]" />선택됨</span>
      </div>

      <div className="mb-1 grid grid-cols-7 gap-1 text-center text-xs">
        {dayLabels.map((day, index) => (
          <div key={day} className={`py-1 font-medium ${index === 0 ? "text-red-400" : index === 6 ? "text-blue-400" : "text-gray-500"}`}>
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs">
        {days.map((day, index) => {
          if (!day) return <div key={`empty-${index}`} />;
          const dateKey = toDateKey(day);
          const isPast = dateKey < todayKey;
          const isSelected = selectedDate === dateKey;
          return (
            <button
              key={dateKey}
              type="button"
              disabled={isPast}
              onClick={() => onSelectDate(dateKey)}
              className={`mx-auto flex h-8 w-8 items-center justify-center rounded-full font-medium transition-colors ${
                isSelected
                  ? "bg-[#1B5E20] text-white"
                  : isPast
                  ? "cursor-not-allowed text-gray-300"
                  : "border border-green-200 bg-green-50 text-green-700 hover:bg-green-200"
              }`}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function VehicleAvailabilityTimeline({
  data,
  vehicles,
  startTime,
  endTime,
  isRefreshing,
  onSelect,
}: {
  data: VehicleAvailabilityTimelineData;
  vehicles: VehicleRow[];
  startTime: string;
  endTime: string;
  isRefreshing: boolean;
  onSelect: (start: string, end: string) => void;
}) {
  const [unavailableMessage, setUnavailableMessage] = useState("");
  const [inspectedUnavailableRange, setInspectedUnavailableRange] = useState<{
    start: string;
    end: string;
    kind: "booked" | "rules";
  } | null>(null);
  const segments = data.timePoints.slice(0, -1).map((start, index) => ({
    start,
    end: data.timePoints[index + 1],
  }));
  const startOptionByTime = useMemo(
    () => new Map(data.startOptions.map((option) => [option.startTime, option])),
    [data.startOptions],
  );
  const endOptionByTime = useMemo(
    () => new Map(data.endOptions.map((option) => [option.endTime, option])),
    [data.endOptions],
  );
  const blockedStartTimes = useMemo(() => new Set(data.blockedStartTimes), [data.blockedStartTimes]);
  const blockedEndTimes = useMemo(() => new Set(data.blockedEndTimes), [data.blockedEndTimes]);
  const pastStartTimes = useMemo(() => new Set(data.pastStartTimes), [data.pastStartTimes]);
  const selectedStartMinutes = startTime ? toMinutes(startTime) : null;
  const selectedEndMinutes = endTime ? toMinutes(endTime) : null;
  const inspectedConflicts = useMemo(() => {
    if (!inspectedUnavailableRange || inspectedUnavailableRange.kind !== "booked") return [];
    return getBlockingVehicleConflicts({
      conflicts: data.conflicts ?? [],
      vehicles,
      segmentStart: inspectedUnavailableRange.start,
      segmentEnd: inspectedUnavailableRange.end,
      selectedStartTime: startTime,
    });
  }, [data.conflicts, inspectedUnavailableRange, startTime, vehicles]);

  useEffect(() => {
    setUnavailableMessage("");
    setInspectedUnavailableRange(null);
  }, [data, endTime, startTime]);

  function handleSegmentClick(start: string, end: string) {
    if (isRefreshing) {
      setInspectedUnavailableRange(null);
      setUnavailableMessage("최신 예약 가능 시간을 확인하고 있습니다. 잠시만 기다려 주세요.");
      return;
    }
    const startMinutes = toMinutes(start);
    const canExtend = Boolean(
      startTime &&
      selectedStartMinutes !== null &&
      startMinutes >= selectedStartMinutes &&
      endOptionByTime.has(end)
    );
    if (canExtend) {
      setInspectedUnavailableRange(null);
      setUnavailableMessage("");
      onSelect(startTime, end);
      return;
    }

    const startOption = startOptionByTime.get(start);
    if (startOption) {
      setInspectedUnavailableRange(null);
      setUnavailableMessage("");
      onSelect(start, startOption.defaultEndTime);
      return;
    }

    if (pastStartTimes.has(start)) {
      setInspectedUnavailableRange(null);
      setUnavailableMessage("이미 지난 시간은 선택할 수 없습니다.");
      return;
    }
    if (blockedStartTimes.has(start) || blockedEndTimes.has(end)) {
      setInspectedUnavailableRange({ start, end, kind: "booked" });
      setUnavailableMessage("차량별 최소 사용 시간, 운영 시간 또는 예약 규칙 때문에 선택할 수 없습니다.");
      return;
    }
    if (startTime && selectedStartMinutes !== null && startMinutes >= selectedStartMinutes) {
      setInspectedUnavailableRange({ start, end, kind: "rules" });
      setUnavailableMessage("선택한 시작 시간부터 이 구간까지 이용 가능한 같은 차량이 없습니다.");
      return;
    }
    setInspectedUnavailableRange({ start, end, kind: "rules" });
    setUnavailableMessage("이 시간부터 예약 가능한 차량이 없습니다.");
  }

  if (segments.length === 0) {
    return (
      <p className="rounded-lg bg-gray-50 px-3 py-4 text-center text-sm text-gray-500">
        선택 가능한 운영 시간이 없습니다.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium text-[#1B5E20]">
          {startTime && endTime
            ? `${startTime} ~ ${endTime} 선택됨 · 뒤쪽 막대로 연장하거나 안쪽 막대로 줄일 수 있습니다.`
            : "초록색 시간 막대를 누르면 가능한 최소 사용 시간이 바로 선택됩니다."}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={!data.selectAllOption || isRefreshing}
            title={data.selectAllOption
              ? `전체 시간 이용 가능 차량 ${data.selectAllOption.availableVehicleCount}대`
              : "전체 시간에 이용 가능한 동일 차량이 없거나 차량의 최대 사용시간을 초과합니다."}
            onClick={() => {
              if (!data.selectAllOption || isRefreshing) return;
              setInspectedUnavailableRange(null);
              setUnavailableMessage("");
              onSelect(data.selectAllOption.startTime, data.selectAllOption.endTime);
            }}
            className="rounded-full border border-[#1B5E20] bg-white px-2.5 py-1 text-[11px] font-bold text-[#1B5E20] transition-colors hover:bg-green-50 disabled:cursor-not-allowed disabled:border-gray-200 disabled:text-gray-300"
          >
            전체 선택
          </button>
          {(startTime || endTime) && (
            <button
              type="button"
              onClick={() => {
                setInspectedUnavailableRange(null);
                setUnavailableMessage("");
                onSelect("", "");
              }}
              className="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-medium text-gray-500 transition-colors hover:border-[#1B5E20] hover:text-[#1B5E20]"
            >
              다시 선택
            </button>
          )}
        </div>
      </div>

      <div
        className={`overflow-x-auto overscroll-x-contain pb-2 transition-opacity ${isRefreshing ? "opacity-60" : ""}`}
        aria-busy={isRefreshing}
      >
        <div className="min-w-max">
          <div className="flex overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            {segments.map(({ start, end }) => {
              const startMinutes = toMinutes(start);
              const endMinutes = toMinutes(end);
              const isSelected =
                selectedStartMinutes !== null &&
                selectedEndMinutes !== null &&
                startMinutes >= selectedStartMinutes &&
                endMinutes <= selectedEndMinutes;
              const startOption = startOptionByTime.get(start);
              const endOption = endOptionByTime.get(end);
              const canExtend = Boolean(
                startTime &&
                selectedStartMinutes !== null &&
                startMinutes >= selectedStartMinutes &&
                endOption
              );
              const isAvailable = Boolean(startOption || canExtend);
              const isBooked = !isAvailable && (blockedStartTimes.has(start) || blockedEndTimes.has(end));
              const isInspected = Boolean(
                !isAvailable &&
                inspectedUnavailableRange?.start === start &&
                inspectedUnavailableRange.end === end
              );
              const availableVehicleCount = canExtend
                ? endOption?.availableVehicleCount ?? 0
                : startOption?.availableVehicleCount ?? 0;

              return (
                <button
                  key={`${start}-${end}`}
                  type="button"
                  aria-disabled={isRefreshing}
                  aria-pressed={isInspected || isSelected}
                  title={isAvailable ? `가능 차량 ${availableVehicleCount}대` : isBooked ? "예약 내역 확인" : "예약 불가 사유 확인"}
                  onClick={() => handleSegmentClick(start, end)}
                  className={`flex h-14 min-w-[68px] flex-col items-center justify-center border-r border-gray-300 px-2 text-[11px] font-bold transition-colors last:border-r-0 ${isInspected ? "relative z-10 ring-2 ring-inset ring-amber-400" : ""} ${
                    isSelected
                      ? "bg-[#1B5E20] text-white"
                      : isAvailable
                        ? "bg-green-50 text-green-700 hover:bg-green-100"
                        : isBooked
                          ? "cursor-pointer bg-red-100 text-red-500 line-through hover:bg-red-200"
                          : "cursor-pointer bg-gray-100 text-gray-400 hover:bg-gray-200"
                  }`}
                >
                  <span>{start}~{end}</span>
                  <span className={`mt-1 text-[10px] font-medium ${isSelected ? "text-white/80" : "text-gray-400"}`}>
                    {isSelected ? "선택" : isAvailable ? `가능 ${availableVehicleCount}대` : isBooked ? "예약됨" : "불가"}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 text-xs text-gray-400">
        <span className="flex items-center gap-1"><span className="inline-block h-3 w-5 rounded bg-green-50 ring-1 ring-green-200" />예약 가능</span>
        <span className="flex items-center gap-1"><span className="inline-block h-3 w-5 rounded bg-red-100" />예약됨</span>
        <span className="flex items-center gap-1"><span className="inline-block h-3 w-5 rounded bg-gray-100 ring-1 ring-gray-200" />예약 불가</span>
        <span className="flex items-center gap-1"><span className="inline-block h-3 w-5 rounded bg-[#1B5E20]" />선택됨</span>
      </div>

      {unavailableMessage && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700" role="status">
          {inspectedUnavailableRange?.kind === "booked" && inspectedConflicts.length > 0
            ? "선택한 시간의 불가 판정에 아래 예약과 차량별 운영·최소 이용시간이 함께 반영되었습니다."
            : unavailableMessage}
        </p>
      )}

      {inspectedUnavailableRange?.kind === "booked" && inspectedConflicts.length > 0 && (
        <section
          className="rounded-xl border border-amber-200 bg-amber-50/60 p-3"
          aria-label="차량 예약 충돌 상세"
          aria-live="polite"
        >
          <p className="text-xs font-bold text-amber-900">불가 판정에 영향을 준 예약</p>
          <div className="mt-2 grid gap-2">
            {inspectedConflicts.map((conflict, index) => (
              <article
                key={`${conflict.reservationDate}-${conflict.startTime}-${conflict.endTime}-${conflict.vehicleId}-${index}`}
                className="rounded-lg border border-amber-100 bg-white p-3 text-xs text-gray-700 shadow-sm"
              >
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <p className="font-bold text-gray-900">
                    {formatDateLabel(conflict.reservationDate)} · {conflict.startTime}~{conflict.endTime}
                  </p>
                  <span className={`w-fit rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    conflict.status === "approved"
                      ? "bg-green-100 text-green-700"
                      : "bg-amber-100 text-amber-700"
                  }`}>
                    {conflict.status === "approved" ? "승인 완료" : "승인 대기"}
                  </span>
                </div>
                <dl className="mt-2 grid grid-cols-[48px_minmax(0,1fr)] gap-x-2 gap-y-1.5">
                  <dt className="text-gray-400">차량</dt>
                  <dd className="min-w-0 break-words font-medium text-gray-900">{conflict.vehicleName}</dd>
                  <dt className="text-gray-400">예약자</dt>
                  <dd className="min-w-0 break-words">
                    {conflict.reserverName}{conflict.memberPosition ? ` (${conflict.memberPosition})` : ""}
                  </dd>
                  <dt className="text-gray-400">목적</dt>
                  <dd className="min-w-0 whitespace-pre-wrap break-words">{conflict.purpose}</dd>
                </dl>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function VehicleTimeSlotPanel({
  vehicle,
  selectedDate,
  allSlots,
  bookedSlots,
  disabledSlots,
  reservationRows,
  startTime,
  endTime,
  onSelectTime,
}: {
  vehicle: VehicleRow;
  selectedDate: string;
  allSlots: string[];
  bookedSlots: Set<string>;
  disabledSlots: Map<string, string>;
  reservationRows: ReservationByDateRow[];
  startTime: string;
  endTime: string;
  onSelectTime: (start: string, end: string) => void;
}) {
  const reservationBySlot = useMemo(() => {
    const map = new Map<string, ReservationByDateRow>();
    reservationRows.forEach((reservation) => {
      if (!isActiveReservation(reservation)) return;
      let current = toMinutes(reservation.startTime);
      const end = toMinutes(reservation.endTime);
      while (current < end) {
        map.set(`${String(Math.floor(current / 60)).padStart(2, "0")}:${String(current % 60).padStart(2, "0")}`, reservation);
        current += vehicle.slotMinutes;
      }
    });
    return map;
  }, [reservationRows, vehicle.slotMinutes]);

  const visibleReservations = useMemo(
    () => reservationRows.filter((reservation) => isActiveReservation(reservation) && hasReservationDetails(reservation)),
    [reservationRows]
  );

  function renderDisabledTooltip(slot: string, disabledReason?: string) {
    const reservation = reservationBySlot.get(slot);
    if (!reservation || !hasReservationDetails(reservation)) {
      return disabledReason ?? "예약 불가";
    }
    return (
      <div className="space-y-0.5">
        <p className="font-semibold text-white">{getReservationName(reservation)} · {getReservationTimeRange(reservation)}</p>
        <p className="text-gray-200">{getReservationPosition(reservation)} · {getReservationPhone(reservation)}</p>
        {reservation.purpose && <p className="line-clamp-2 text-gray-300">{reservation.purpose}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-gray-100 bg-white p-5">
      <div className="flex items-center gap-2">
        <CalendarCheck size={16} className="text-[#1B5E20]" />
        <h3 className="text-sm font-bold text-gray-800">{formatDateLabel(selectedDate)} 예약 현황</h3>
      </div>
      <p className="text-xs text-gray-500">운영 시간: {vehicle.openTime} ~ {vehicle.closeTime}</p>

      {allSlots.length === 0 ? (
        <p className="rounded-lg bg-gray-50 px-3 py-4 text-center text-sm text-gray-500">
          해당 날짜의 운영 시간 정보가 없습니다.
        </p>
      ) : (
        <ReservationTimelinePicker
          allSlots={allSlots}
          bookedSlots={bookedSlots}
          disabledSlots={disabledSlots}
          startTime={startTime}
          endTime={endTime}
          onSelect={onSelectTime}
          slotMinutes={vehicle.slotMinutes}
          maxSlots={vehicle.maxSlots}
          showSelectAll
          selectAllLabel="전체 선택"
          renderDisabledTooltip={renderDisabledTooltip}
        />
      )}

      {visibleReservations.length > 0 && (
        <div className="mt-3 rounded-lg border border-green-100 bg-green-50/60 p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-xs font-bold text-[#1B5E20]">예약 상세</p>
            <p className="text-[10px] text-gray-400">예약 가능 그룹에게 표시</p>
          </div>
          <div className="space-y-2">
            {visibleReservations.map((reservation, index) => (
              <div
                key={reservation.id ?? `${reservation.startTime}-${reservation.endTime}-${index}`}
                className="rounded-md border border-white bg-white/90 p-2 text-xs text-gray-700 shadow-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-1">
                  <span className="font-bold text-gray-900">{getReservationTimeRange(reservation)}</span>
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-gray-500">{reservation.status}</span>
                </div>
                <div className="mt-1 grid grid-cols-[52px_1fr] gap-x-2 gap-y-1">
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
    </div>
  );
}

export function VehicleReservationList() {
  const [, navigate] = useLocation();
  const searchString = useSearch();
  const initialParams = useMemo(() => new URLSearchParams(searchString), [searchString]);
  const initialRepeatMode = initialParams.get("repeatMode");
  const [selectedDate, setSelectedDate] = useState(initialParams.get("date") ?? "");
  const [startTime, setStartTime] = useState(initialParams.get("startTime") ?? "");
  const [endTime, setEndTime] = useState(initialParams.get("endTime") ?? "");
  const [repeatMode, setRepeatMode] = useState<"none" | "daily" | "weekly" | "monthly">(
    initialRepeatMode === "daily" || initialRepeatMode === "weekly" || initialRepeatMode === "monthly"
      ? initialRepeatMode
      : "none",
  );
  const [repeatEndDate, setRepeatEndDate] = useState(initialParams.get("repeatEndDate") ?? "");

  useEffect(() => {
    const params = new URLSearchParams();
    if (selectedDate) params.set("date", selectedDate);
    if (startTime) params.set("startTime", startTime);
    if (endTime) params.set("endTime", endTime);
    if (repeatMode !== "none") {
      params.set("repeatMode", repeatMode);
      if (repeatEndDate) params.set("repeatEndDate", repeatEndDate);
    }
    const nextSearch = params.toString();
    if (nextSearch === searchString) return;
    navigate(`/support/vehicle${nextSearch ? `?${nextSearch}` : ""}`, { replace: true });
  }, [endTime, navigate, repeatEndDate, repeatMode, searchString, selectedDate, startTime]);
  const { data: vehicles, isLoading, error } = trpc.home.vehicles.useQuery(undefined, {
    retry: false,
  });
  const vehicleRows = useMemo(
    () => sortVehiclePlateRows((vehicles ?? []) as VehicleRow[]),
    [vehicles],
  );
  const todayKey = getKstDateKey();
  const nowKst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const currentKstMinutes = nowKst.getUTCHours() * 60 + nowKst.getUTCMinutes();
  const repeatScheduleReady = Boolean(
    repeatMode === "none" || (repeatEndDate && selectedDate && repeatEndDate >= selectedDate)
  );
  const timelineQuery = trpc.home.vehicleAvailabilityTimeline.useQuery(
    {
      reservationDate: selectedDate || todayKey,
      passengers: 1,
      repeatMode,
      repeatEndDate: repeatMode === "none" ? null : repeatEndDate || null,
      startTime: startTime || null,
    },
    {
      enabled: Boolean(selectedDate && repeatScheduleReady),
      retry: false,
      // 시작시간 선택으로 조회 키가 바뀌어도 시간표 DOM을 유지해 가로 스크롤이 00시로 돌아가지 않게 합니다.
      placeholderData: startTime ? keepPreviousData : undefined,
    },
  );
  const timelineData = timelineQuery.data as VehicleAvailabilityTimelineData | undefined;
  const selectedStartIsFuture = Boolean(
    selectedDate && startTime && (
      selectedDate > todayKey ||
      (selectedDate === todayKey && toMinutes(startTime) > currentKstMinutes)
    )
  );
  const scheduleComplete = Boolean(
    selectedDate &&
    startTime &&
    endTime &&
    startTime < endTime &&
    selectedStartIsFuture &&
    (repeatMode === "none" || (repeatEndDate && repeatEndDate >= selectedDate))
  );
  const availabilityQuery = trpc.home.availableVehicles.useQuery(
    {
      reservationDate: selectedDate || getKstDateKey(),
      startTime: startTime || "00:00",
      endTime: endTime || "00:00",
      passengers: 1,
      repeatMode,
      repeatEndDate: repeatMode === "none" ? null : repeatEndDate || null,
    },
    { enabled: scheduleComplete, retry: false },
  );
  const availableVehicles = useMemo(
    () => sortVehiclePlateRows((availabilityQuery.data?.vehicles ?? []) as VehicleRow[]),
    [availabilityQuery.data?.vehicles],
  );

  useEffect(() => {
    if (!shouldResetVehicleReservationTime({
      startTime,
      endTime,
      timeline: timelineData,
      repeatScheduleReady,
      isFetching: timelineQuery.isFetching,
      hasError: timelineQuery.isError,
    })) return;

    setStartTime("");
    setEndTime("");
    toast.error("변경한 일정 전체에서 기존 선택 시간을 사용할 수 없어 시간을 초기화했습니다.");
  }, [
    endTime,
    repeatScheduleReady,
    startTime,
    timelineData,
    timelineQuery.isError,
    timelineQuery.isFetching,
  ]);

  function handleSelectDate(date: string) {
    setSelectedDate(date);
    setStartTime("");
    setEndTime("");
    if (repeatEndDate && repeatEndDate < date) setRepeatEndDate("");
  }

  function getApplyHref(vehicleId: number) {
    const params = new URLSearchParams({
      date: selectedDate,
      startTime,
      endTime,
      repeatMode,
    });
    if (repeatMode !== "none" && repeatEndDate) params.set("repeatEndDate", repeatEndDate);
    return `/support/vehicle/${vehicleId}/apply?${params.toString()}`;
  }

  if (error) {
    return <AccessBlocked message={error.message} next="/support/vehicle" />;
  }

  return (
    <div className="min-h-screen bg-[#F7F7F5]">
      <VehicleHero />
      <section className="py-12">
        <div className="container max-w-5xl">
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900" style={{ fontFamily: "'Noto Serif KR', serif" }}>시간을 먼저 선택하세요</h2>
              <p className="mt-1 text-sm text-gray-500">선택한 시간 전체에 이용 가능한 차량만 보여드립니다.</p>
            </div>
            <Link href="/support/vehicle/my-reservations">
              <Button variant="outline" className="border-[#1B5E20] text-[#1B5E20] hover:bg-green-50">
                <CalendarCheck className="mr-2 h-4 w-4" /> 내 차량예약 현황
              </Button>
            </Link>
          </div>
          {isLoading ? (
            <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-[#1B5E20]" /></div>
          ) : !vehicleRows.some((vehicle) => vehicle.isReservable) ? (
            <div className="rounded-xl border border-dashed border-gray-200 bg-white py-14 text-center text-sm text-gray-400">
              현재 예약 가능한 차량이 없습니다.
            </div>
          ) : (
            <>
              <div className="grid gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
                <div>
                  <div className="mb-2 flex items-center gap-2 text-sm font-bold text-gray-800">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#1B5E20] text-xs text-white">1</span>
                    날짜 선택
                  </div>
                  <VehicleReservationCalendar selectedDate={selectedDate} onSelectDate={handleSelectDate} />
                </div>

                <div>
                  <div className="mb-2 flex items-center gap-2 text-sm font-bold text-gray-800">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#1B5E20] text-xs text-white">2</span>
                    시간 선택
                  </div>
                  <div className="space-y-5 rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="block">
                        <span className="mb-1.5 block text-xs font-medium text-gray-600">반복 일정</span>
                        <select
                          value={repeatMode}
                          onChange={(event) => {
                            const nextMode = event.target.value as typeof repeatMode;
                            setRepeatMode(nextMode);
                            if (nextMode === "none") setRepeatEndDate("");
                          }}
                          className="w-full rounded-lg border border-gray-200 bg-white px-3.5 py-3 text-sm focus:border-[#1B5E20] focus:outline-none"
                        >
                          <option value="none">반복 없음</option>
                          <option value="daily">매일</option>
                          <option value="weekly">매주</option>
                          <option value="monthly">매월 같은 주</option>
                        </select>
                      </label>
                      {repeatMode !== "none" && (
                        <label className="block">
                          <span className="mb-1.5 block text-xs font-medium text-gray-600">반복 종료일</span>
                          <input
                            type="date"
                            value={repeatEndDate}
                            min={selectedDate || getKstDateKey()}
                            onChange={(event) => {
                              setRepeatEndDate(event.target.value);
                            }}
                            className="w-full rounded-lg border border-gray-200 bg-white px-3.5 py-3 text-sm focus:border-[#1B5E20] focus:outline-none"
                          />
                        </label>
                      )}
                    </div>

                    {!selectedDate ? (
                      <p className="rounded-lg bg-gray-50 px-3 py-5 text-center text-sm text-gray-500">
                        날짜를 먼저 선택하면 시간별 차량 예약 가능 여부가 표시됩니다.
                      </p>
                    ) : !repeatScheduleReady ? (
                      <p className="rounded-lg bg-amber-50 px-3 py-4 text-center text-sm text-amber-700">
                        반복 종료일을 선택하면 모든 반복 날짜를 확인한 시간표가 표시됩니다.
                      </p>
                    ) : timelineQuery.isFetching && !timelineData ? (
                      <div className="flex justify-center rounded-lg bg-gray-50 py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-[#1B5E20]" />
                      </div>
                    ) : timelineQuery.error ? (
                      <p className="rounded-lg bg-red-50 px-3 py-4 text-center text-sm text-red-600">
                        {timelineQuery.error.message}
                      </p>
                    ) : timelineData ? (
                      <>
                        {startTime && endTime && timelineQuery.isFetching && (
                          <p className="rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700" role="status">
                            변경한 일정 전체에서 {startTime}~{endTime} 사용 가능 여부를 확인하고 있습니다.
                          </p>
                        )}
                        {(timelineData.occurrenceCount ?? 1) > 1 && (
                          <p className="text-xs text-gray-500">
                            반복 {timelineData.occurrenceCount}회 모두 가능한 시간만 선택할 수 있습니다.
                          </p>
                        )}
                        <VehicleAvailabilityTimeline
                          data={timelineData}
                          vehicles={vehicleRows}
                          startTime={startTime}
                          endTime={endTime}
                          isRefreshing={timelineQuery.isFetching}
                          onSelect={(start, end) => {
                            setStartTime(start);
                            setEndTime(end);
                          }}
                        />
                      </>
                    ) : null}

                    <div className="rounded-lg bg-[#F1F8E9] px-4 py-3 text-sm text-[#1B5E20]">
                      {!selectedDate
                        ? "날짜를 먼저 선택해 주세요."
                        : !startTime || !endTime
                          ? `${formatDateLabel(selectedDate)} · 시작과 종료 시간을 선택해 주세요.`
                          : repeatMode !== "none" && !repeatEndDate
                            ? "반복 종료일을 선택해 주세요."
                            : `${formatDateLabel(selectedDate)} · ${startTime}~${endTime}${repeatMode === "none" ? "" : " · 반복 일정"}`}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-8">
                <div className="mb-3 flex items-center gap-2 text-sm font-bold text-gray-800">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#1B5E20] text-xs text-white">3</span>
                  가능한 차량 선택
                </div>
                {!scheduleComplete ? (
                  <div className="rounded-xl border border-dashed border-gray-200 bg-white px-5 py-12 text-center text-sm text-gray-400">
                    날짜와 시간을 모두 선택하면 가능한 차량이 표시됩니다.
                  </div>
                ) : availabilityQuery.isFetching ? (
                  <div className="flex justify-center rounded-xl border border-gray-100 bg-white py-14">
                    <Loader2 className="h-7 w-7 animate-spin text-[#1B5E20]" />
                  </div>
                ) : availabilityQuery.error ? (
                  <div className="rounded-xl border border-red-100 bg-red-50 px-5 py-8 text-center text-sm text-red-600">
                    {availabilityQuery.error.message}
                  </div>
                ) : availableVehicles.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-gray-200 bg-white px-5 py-12 text-center">
                    <Car className="mx-auto mb-3 h-10 w-10 text-gray-300" />
                    <p className="font-medium text-gray-600">선택한 시간에 가능한 차량이 없습니다.</p>
                    <p className="mt-1 text-xs text-gray-400">다른 시간으로 다시 선택해 주세요.</p>
                  </div>
                ) : (
                  <>
                    <p className="mb-4 text-sm text-gray-500">
                      가능한 차량 <strong className="text-[#1B5E20]">{availableVehicles.length}대</strong>
                      {(availabilityQuery.data?.occurrenceCount ?? 1) > 1 && ` · 반복 ${availabilityQuery.data?.occurrenceCount}회 모두 가능`}
                    </p>
                    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                      {availableVehicles.map((vehicle) => (
                        <VehicleCard key={vehicle.id} vehicle={vehicle} applyHref={getApplyHref(vehicle.id)} />
                      ))}
                    </div>
                  </>
                )}
              </div>
              <div className="mt-6"><VehicleInquiryCard /></div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}

export function VehicleReservationDetail() {
  const [, navigate] = useLocation();

  useEffect(() => {
    navigate("/support/vehicle", { replace: true });
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F7F7F5]">
      <Loader2 className="h-8 w-8 animate-spin text-[#1B5E20]" />
    </div>
  );
}

function LegacyVehicleReservationDetail() {
  const params = useParams<{ id: string }>();
  const vehicleId = Number(params.id);
  const [, navigate] = useLocation();
  const { user: adminUser, loading: adminLoading } = useAuth();
  const canManageVehicleReservations = hasContentPermission(adminUser, "content:vehicles");
  const [selectedDate, setSelectedDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");

  const { data: memberMe, isLoading: memberLoading } = trpc.members.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });
  const { data: vehicle, isLoading, error } = trpc.home.vehicle.useQuery(
    { id: vehicleId },
    { enabled: !!vehicleId && !Number.isNaN(vehicleId), retry: false }
  );
  const { data: reservationsByDate } = trpc.home.vehicleReservationsByDate.useQuery(
    { vehicleId, date: selectedDate },
    { enabled: !!vehicleId && !!selectedDate, retry: false }
  );

  const vehicleRow = vehicle as VehicleRow | null | undefined;
  const unitMinutes = vehicleRow?.slotMinutes ?? 60;
  const reservationRows = useMemo(
    () => (reservationsByDate ?? []) as ReservationByDateRow[],
    [reservationsByDate]
  );
  const allTimeSlots = useMemo(() => {
    if (!vehicleRow) return [];
    return generateReservationTimePoints(vehicleRow.openTime, vehicleRow.closeTime, unitMinutes);
  }, [unitMinutes, vehicleRow]);

  const bookedSlots = useMemo(() => {
    const booked = new Set<string>();
    reservationRows.forEach(row => {
      if (!isActiveReservation(row)) return;
      let cur = toMinutes(row.startTime);
      const end = toMinutes(row.endTime);
      while (cur < end) {
        booked.add(`${String(Math.floor(cur / 60)).padStart(2, "0")}:${String(cur % 60).padStart(2, "0")}`);
        cur += unitMinutes;
      }
    });
    return booked;
  }, [reservationRows, unitMinutes]);

  const disabledSlots = useMemo(() => {
    const disabled = new Map<string, string>();
    if (!selectedDate) return disabled;
    const today = getKstDateKey();
    if (selectedDate < today) {
      allTimeSlots.forEach(slot => disabled.set(slot, "지난 날짜는 예약할 수 없습니다."));
      return disabled;
    }
    if (selectedDate === today) {
      const now = new Date(Date.now() + 9 * 60 * 60 * 1000);
      const currentMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
      allTimeSlots.forEach(slot => {
        if (toMinutes(slot) <= currentMinutes) disabled.set(slot, "이미 지난 시간입니다.");
      });
    }
    return disabled;
  }, [allTimeSlots, selectedDate]);

  function handleSelectDate(date: string) {
    setSelectedDate(date);
    setStartTime("");
    setEndTime("");
  }

  function handleApply() {
    if (!selectedDate) return;
    if (!memberMe && !canManageVehicleReservations) {
      navigate(getLoginHref(`/support/vehicle/${vehicleId}`));
      return;
    }
    const query = new URLSearchParams({ date: selectedDate });
    if (startTime) query.set("startTime", startTime);
    if (endTime) query.set("endTime", endTime);
    navigate(`/support/vehicle/${vehicleId}/apply?${query.toString()}`);
  }

  const applyLabel = useMemo(() => {
    if (!selectedDate) return "날짜를 먼저 선택하세요";
    if (!startTime) return `${selectedDate} - 시간을 선택하세요`;
    if (!endTime) return `${selectedDate} ${startTime} - 종료 시간을 선택하세요`;
    return `${selectedDate} ${startTime}~${endTime} 차량예약 신청`;
  }, [selectedDate, startTime, endTime]);

  if (error) {
    return <AccessBlocked message={error.message} next={`/support/vehicle/${vehicleId}`} />;
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F7F7F5]">
        <Loader2 className="h-8 w-8 animate-spin text-[#1B5E20]" />
      </div>
    );
  }

  if (!vehicleRow) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F7F7F5]">
        <div className="text-center">
          <AlertCircle className="mx-auto mb-3 h-12 w-12 text-gray-300" />
          <p className="mb-4 text-gray-500">차량 정보를 찾을 수 없습니다.</p>
          <Link href="/support/vehicle" className="font-medium text-[#1B5E20] hover:underline">차량 목록으로 돌아가기</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F7F5]">
      <VehicleHero />
      <section className="py-10">
        <div className="container">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
            <div className="space-y-6 lg:col-span-2">
              {vehicleRow.thumbnailUrl ? (
                <div className="overflow-hidden rounded-xl bg-gray-100">
                  <img src={vehicleRow.thumbnailUrl} alt={vehicleRow.name} className="aspect-video w-full object-cover"  loading="lazy"/>
                </div>
              ) : (
                <div className="flex aspect-video items-center justify-center rounded-xl bg-gray-100 text-gray-300">
                  <Car className="h-16 w-16" />
                </div>
              )}

              <div className="rounded-xl border border-gray-100 bg-white p-6">
                <h2 className="mb-4 text-base font-bold text-gray-900" style={{ fontFamily: "'Noto Serif KR', serif" }}>
                  차량 정보
                </h2>
                <div className="mb-5 grid grid-cols-2 gap-4 sm:grid-cols-3">
                  <div className="rounded-lg bg-[#F1F8E9] p-3 text-center">
                    <Users className="mx-auto mb-1 text-[#1B5E20]" size={20} />
                    <p className="text-xs text-gray-500">탑승 인원</p>
                    <p className="font-bold text-gray-800">{vehicleRow.capacity}명</p>
                  </div>
                  <div className="rounded-lg bg-[#F1F8E9] p-3 text-center">
                    <MapPin className="mx-auto mb-1 text-[#1B5E20]" size={20} />
                    <p className="text-xs text-gray-500">위치</p>
                    <p className="text-sm font-bold text-gray-800">{vehicleRow.location || "교회 주차장"}</p>
                  </div>
                  <div className="rounded-lg bg-[#F1F8E9] p-3 text-center">
                    <Clock className="mx-auto mb-1 text-[#1B5E20]" size={20} />
                    <p className="text-xs text-gray-500">예약 단위</p>
                    <p className="text-sm font-bold text-gray-800">{vehicleRow.slotMinutes}분 단위</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-xl font-bold text-gray-900" style={{ fontFamily: "'Noto Serif KR', serif" }}>
                    {vehicleRow.name}
                  </h3>
                  {vehicleRow.plateNumber && (
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">{formatPlateNumber(vehicleRow.plateNumber)}</span>
                  )}
                </div>
                {vehicleRow.description && <p className="mt-3 text-sm leading-6 text-gray-600">{vehicleRow.description}</p>}
                {vehicleRow.driverInfo && <p className="mt-2 text-sm text-gray-500">담당/기사: {vehicleRow.driverInfo}</p>}
              </div>

              {vehicleRow.notice && (
                <div className="rounded-xl border border-blue-100 bg-blue-50 p-6">
                  <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-gray-900">
                    <CalendarCheck className="text-blue-500" size={18} />
                    이용 안내
                  </h2>
                  <p className="whitespace-pre-line text-sm leading-6 text-gray-700">{vehicleRow.notice}</p>
                </div>
              )}

              {vehicleRow.caution && (
                <div className="rounded-xl border border-amber-100 bg-amber-50 p-6">
                  <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-gray-900">
                    <AlertCircle className="text-amber-500" size={18} />
                    이용 시 주의사항
                  </h2>
                  <p className="whitespace-pre-line text-sm leading-6 text-gray-700">{vehicleRow.caution}</p>
                </div>
              )}
            </div>

            <div className="space-y-5">
              <VehicleReservationCalendar selectedDate={selectedDate} onSelectDate={handleSelectDate} />

              {selectedDate && (
                <VehicleTimeSlotPanel
                  vehicle={vehicleRow}
                  selectedDate={selectedDate}
                  allSlots={allTimeSlots}
                  bookedSlots={bookedSlots}
                  disabledSlots={disabledSlots}
                  reservationRows={reservationRows}
                  startTime={startTime}
                  endTime={endTime}
                  onSelectTime={(start, end) => {
                    setStartTime(start);
                    setEndTime(end);
                  }}
                />
              )}

              {vehicleRow.isReservable ? (
                <Button
                  type="button"
                  disabled={!selectedDate || memberLoading || adminLoading}
                  onClick={handleApply}
                  className="w-full rounded-xl bg-[#1B5E20] py-6 text-base font-bold text-white hover:bg-[#2E7D32] disabled:opacity-50"
                >
                  <CalendarCheck className="mr-2 h-5 w-5" />
                  {applyLabel}
                </Button>
              ) : (
                <div className="rounded-xl bg-gray-100 p-5 text-center text-gray-500">
                  <p className="mb-1 font-bold">현재 예약 불가</p>
                  <p className="text-xs">관리자에게 문의해 주세요.</p>
                </div>
              )}

              <VehicleInquiryCard />

              <Link href="/support/vehicle">
                <Button type="button" variant="outline" className="w-full">
                  <ChevronLeft className="mr-1 h-4 w-4" /> 차량 목록으로
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export function VehicleReservationApply() {
  const params = useParams<{ id: string }>();
  const vehicleId = Number(params.id);
  const [, navigate] = useLocation();
  const searchString = useSearch();
  const { user: adminUser } = useAuth();
  const canManageVehicleReservations = hasContentPermission(adminUser, "content:vehicles");
  const initialSearchParams = useMemo(() => new URLSearchParams(searchString), [searchString]);
  const initialRepeatMode = initialSearchParams.get("repeatMode");
  const selectedRepeatMode: "none" | "daily" | "weekly" | "monthly" =
    initialRepeatMode === "daily" || initialRepeatMode === "weekly" || initialRepeatMode === "monthly"
      ? initialRepeatMode
      : "none";
  const scheduleSearchHref = `/support/vehicle${searchString ? `?${searchString}` : ""}`;
  const applyReturnHref = `/support/vehicle/${vehicleId}/apply${searchString ? `?${searchString}` : ""}`;
  const [form, setForm] = useState({
    reserverName: "",
    reserverPhone: "",
    purpose: "",
    date: initialSearchParams.get("date") ?? "",
    startTime: initialSearchParams.get("startTime") ?? "",
    endTime: initialSearchParams.get("endTime") ?? "",
    notes: "",
    agreePrivacy: false,
    repeatMode: selectedRepeatMode,
    repeatEndDate: initialSearchParams.get("repeatEndDate") ?? "",
  });
  const hasSelectedSchedule = Boolean(
    form.date &&
    form.startTime &&
    form.endTime &&
    (form.repeatMode === "none" || form.repeatEndDate),
  );
  const [submitted, setSubmitted] = useState(false);
  const [reservedStatus, setReservedStatus] = useState<"pending" | "approved">("pending");
  const [reservationCount, setReservationCount] = useState(1);
  const [reservationConflictMessage, setReservationConflictMessage] = useState<string | null>(null);

  const { data: memberMe } = trpc.members.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  // 로그인한 성도 정보가 늦게 도착해도 신청자 이름/연락처를 자동으로 채웁니다.
  useEffect(() => {
    if (!memberMe && !canManageVehicleReservations) return;
    setForm(prev => ({
      ...prev,
      reserverName: prev.reserverName || memberMe?.name || adminUser?.name || "",
      reserverPhone: prev.reserverPhone || memberMe?.phone || "",
    }));
  }, [adminUser?.name, canManageVehicleReservations, memberMe]);

  const { data: vehicle, isLoading, error } = trpc.home.vehicle.useQuery(
    { id: vehicleId },
    { enabled: !!vehicleId && !Number.isNaN(vehicleId), retry: false }
  );
  const { data: reservationsByDate } = trpc.home.vehicleReservationsByDate.useQuery(
    { vehicleId, date: form.date },
    { enabled: !!vehicleId && !!form.date, retry: false }
  );
  const createReservation = trpc.home.createVehicleReservation.useMutation({
    onSuccess: (data) => {
      setReservedStatus(data.status);
      setReservationCount(data.count ?? 1);
      setSubmitted(true);
    },
    onError: (err) => showReservationError(err.message || "차량 예약 신청 중 오류가 발생했습니다."),
  });

  const vehicleRow = vehicle as VehicleRow | null | undefined;
  const unitMinutes = vehicleRow?.slotMinutes ?? 60;
  const reservationRows = useMemo(
    () => (reservationsByDate ?? []) as ReservationByDateRow[],
    [reservationsByDate]
  );
  const allTimeSlots = useMemo(() => {
    if (!vehicleRow) return [];
    return generateReservationTimePoints(vehicleRow.openTime, vehicleRow.closeTime, unitMinutes);
  }, [unitMinutes, vehicleRow]);

  const bookedSlots = useMemo(() => {
    const booked = new Set<string>();
    reservationRows.forEach(row => {
      if (!isActiveReservation(row)) return;
      let cur = toMinutes(row.startTime);
      const end = toMinutes(row.endTime);
      while (cur < end) {
        booked.add(`${String(Math.floor(cur / 60)).padStart(2, "0")}:${String(cur % 60).padStart(2, "0")}`);
        cur += unitMinutes;
      }
    });
    return booked;
  }, [reservationRows, unitMinutes]);

  const disabledSlots = useMemo(() => {
    const disabled = new Map<string, string>();
    if (!form.date) return disabled;
    const today = getKstDateKey();
    if (form.date < today) {
      allTimeSlots.forEach(slot => disabled.set(slot, "지난 날짜는 예약할 수 없습니다."));
      return disabled;
    }
    if (form.date === today) {
      const now = new Date(Date.now() + 9 * 60 * 60 * 1000);
      const currentMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
      allTimeSlots.forEach(slot => {
        if (toMinutes(slot) <= currentMinutes) disabled.set(slot, "이미 지난 시간입니다.");
      });
    }
    return disabled;
  }, [allTimeSlots, form.date]);

  function updateForm(key: keyof typeof form, value: string | boolean) {
    setForm(prev => ({
      ...prev,
      [key]: value,
      ...(key === "date" ? { startTime: "", endTime: "" } : {}),
    }));
  }

  function showReservationError(message: string) {
    if (isReservationConflictMessage(message)) {
      setReservationConflictMessage(message);
      return;
    }
    toast.error(message);
  }

  function validate() {
    if (!vehicleRow) return "차량 정보를 찾을 수 없습니다.";
    if (!memberMe && !canManageVehicleReservations) return "성도 로그인 후 신청할 수 있습니다.";
    if (!form.reserverName.trim()) return "신청자 이름을 입력해주세요.";
    if (!form.reserverPhone.trim()) return "연락처를 입력해주세요.";
    if (!form.purpose.trim()) return "사용 목적을 입력해 주세요.";
    if (!form.date) return "사용 날짜를 선택해주세요.";
    if (form.date < getKstDateKey()) return "지난 날짜는 예약할 수 없습니다.";
    if (form.repeatMode !== "none") {
      if (!form.repeatEndDate) return "반복 예약의 종료일을 선택해주세요.";
      if (form.repeatEndDate < form.date) return "반복 종료일은 시작일 이후여야 합니다.";
    }
    if (!form.startTime || !form.endTime) return "사용 시간을 선택해주세요.";
    if (form.startTime >= form.endTime) return "종료 시간은 시작 시간보다 늦어야 합니다.";
    if (!form.agreePrivacy) return "개인정보 수집·이용에 동의해주세요.";
    let cur = toMinutes(form.startTime);
    const end = toMinutes(form.endTime);
    while (cur < end) {
      const slot = `${String(Math.floor(cur / 60)).padStart(2, "0")}:${String(cur % 60).padStart(2, "0")}`;
      if (bookedSlots.has(slot)) return "선택하신 시간대에 이미 예약이 있습니다. 다른 시간을 선택해 주세요.";
      if (disabledSlots.has(slot)) return disabledSlots.get(slot) ?? "선택할 수 없는 시간입니다.";
      cur += unitMinutes;
    }
    return null;
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const errorMessage = validate();
    if (errorMessage) {
      showReservationError(errorMessage);
      if (errorMessage.includes("로그인")) navigate(getLoginHref(applyReturnHref));
      return;
    }
    createReservation.mutate({
      vehicleId,
      reserverName: form.reserverName,
      reserverPhone: form.reserverPhone,
      reservationDate: form.date,
      startTime: form.startTime,
      endTime: form.endTime,
      purpose: form.purpose.trim(),
      passengers: 1,
      notes: form.notes || undefined,
      repeatMode: form.repeatMode,
      repeatEndDate: form.repeatMode === "none" ? null : form.repeatEndDate,
    });
  }

  const applyLabel = useMemo(() => {
    if (!form.date) return "날짜를 먼저 선택하세요";
    if (!form.startTime) return `${form.date} — 시간을 선택하세요`;
    if (!form.endTime) return `${form.date} ${form.startTime} — 종료 시간을 선택하세요`;
    return `${form.date} ${form.startTime}~${form.endTime} 차량예약 신청`;
  }, [form.date, form.startTime, form.endTime]);

  const conflictDialog = (
    <ReservationConflictDialog
      message={reservationConflictMessage}
      onClose={() => setReservationConflictMessage(null)}
    />
  );

  if (!hasSelectedSchedule) {
    return (
      <div className="min-h-screen bg-[#F7F7F5]">
        <VehicleHero />
        <section className="py-14">
          <div className="container max-w-xl">
            <div className="rounded-xl border border-gray-100 bg-white p-8 text-center shadow-sm">
              <Clock className="mx-auto mb-4 h-12 w-12 text-[#1B5E20]" />
              <h2 className="text-xl font-bold text-gray-900">시간을 먼저 선택해 주세요</h2>
              <p className="mt-2 text-sm text-gray-500">선택한 시간에 가능한 차량을 확인한 뒤 신청할 수 있습니다.</p>
              <Link href="/support/vehicle"><Button className="mt-6 bg-[#1B5E20] text-white hover:bg-[#2E7D32]">시간 선택으로 이동</Button></Link>
            </div>
          </div>
        </section>
      </div>
    );
  }

  if (vehicleRow && !error && !isLoading) {
    const inputClass = "w-full rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-800 transition-colors focus:border-[#1B5E20] focus:outline-none focus:ring-1 focus:ring-[#1B5E20] disabled:bg-gray-50 disabled:text-gray-400";

    return (
      <div className="min-h-screen bg-[#F7F7F5]">
        {conflictDialog}
        <VehicleHero />
        <section className="py-10">
          <div className="container max-w-3xl">
            {submitted ? (
              <div className="rounded-xl border border-gray-100 bg-white p-10 text-center shadow-sm">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#E8F5E9] text-[#1B5E20]">
                  {reservedStatus === "approved" ? <CheckCircle2 className="h-9 w-9" /> : <Clock className="h-9 w-9" />}
                </div>
                <h2 className="text-2xl font-bold text-gray-900" style={{ fontFamily: "'Noto Serif KR', serif" }}>
                  {reservedStatus === "approved" ? "차량 예약이 승인되었습니다" : "차량 예약 신청이 접수되었습니다"}
                </h2>
                <p className="mt-3 text-sm text-gray-500">
                  {reservationCount > 1 ? `${reservationCount}건의 반복 예약이 함께 접수되었습니다. ` : ""}
                  {vehicleRow.name} 예약 신청이 정상적으로 접수되었습니다. 내 차량예약 현황에서 확인할 수 있습니다.
                </p>
                <div className="mt-7 flex justify-center gap-2">
                  <Button
                    variant="outline"
                    onClick={() => navigate("/support/vehicle")}
                  >
                    추가 신청
                  </Button>
                  <Link href="/support/vehicle/my-reservations"><Button className="bg-[#1B5E20] text-white hover:bg-[#2E7D32]">내 예약 현황</Button></Link>
                </div>
              </div>
            ) : (
              <form onSubmit={submit} noValidate>
                <div className="mb-6 flex items-center gap-4 rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
                  {vehicleRow.thumbnailUrl ? (
                    <img src={vehicleRow.thumbnailUrl} alt={vehicleRow.name} className="h-16 w-16 shrink-0 rounded-lg object-cover"  loading="lazy"/>
                  ) : (
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-gray-100">
                      <Car className="h-7 w-7 text-gray-300" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    {vehicleRow.location && <p className="mb-0.5 text-xs text-gray-400">{vehicleRow.location}</p>}
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-bold text-gray-900" style={{ fontFamily: "'Noto Serif KR', serif" }}>{vehicleRow.name}</p>
                      {vehicleRow.plateNumber && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">{formatPlateNumber(vehicleRow.plateNumber)}</span>}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-3 text-xs text-gray-500">
                      <span className="flex items-center gap-1"><Users className="h-3 w-3" /> 최대 {vehicleRow.capacity}명</span>
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {vehicleRow.slotMinutes}분 단위</span>
                    </div>
                  </div>
                  <Link href={scheduleSearchHref} className="shrink-0 text-xs text-gray-400 transition-colors hover:text-[#1B5E20]">
                    차량 변경
                  </Link>
                </div>

                {!memberMe && !canManageVehicleReservations && (
                  <div className="mb-6 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
                    <AlertCircle className="h-5 w-5 shrink-0 text-amber-500" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-amber-800">성도 로그인이 필요합니다</p>
                      <p className="mt-0.5 text-xs text-amber-600">차량 예약은 권한이 있는 성도만 신청할 수 있습니다.</p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      className="shrink-0 bg-amber-500 text-white hover:bg-amber-600"
                      onClick={() => navigate(getLoginHref(applyReturnHref))}
                    >
                      로그인
                    </Button>
                  </div>
                )}

                <div className="space-y-5 rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
                  <h2 className="border-b border-gray-100 pb-3 text-base font-bold text-gray-900" style={{ fontFamily: "'Noto Serif KR', serif" }}>
                    신청자 정보
                  </h2>

                  <div className="grid gap-5 sm:grid-cols-2">
                    <label className="block">
                      <span className="mb-1 block text-xs font-medium text-gray-600">신청자 이름 *</span>
                      <input value={form.reserverName} onChange={(e) => updateForm("reserverName", e.target.value)} placeholder="이름을 입력해 주세요" className={inputClass} />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-xs font-medium text-gray-600">연락처 *</span>
                      <input type="tel" value={form.reserverPhone} onChange={(e) => updateForm("reserverPhone", e.target.value)} placeholder="010-0000-0000" className={inputClass} />
                    </label>
                  </div>

                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-gray-600">사용 목적 *</span>
                    <input
                      type="text"
                      value={form.purpose}
                      onChange={(e) => updateForm("purpose", e.target.value)}
                      placeholder="사용 목적을 직접 입력해 주세요. (예: 심방 이동, 물품 운반)"
                      className={inputClass}
                    />
                  </label>

                  <h2 className="border-b border-gray-100 pb-3 pt-2 text-base font-bold text-gray-900" style={{ fontFamily: "'Noto Serif KR', serif" }}>
                    사용 일정
                  </h2>

                  <div className="rounded-xl border border-[#C8E6C9] bg-[#F1F8E9] p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-xs font-medium text-[#2E7D32]">선택한 사용 일정</p>
                        <p className="mt-1 font-bold text-gray-900">{formatDateLabel(form.date)} · {form.startTime}~{form.endTime}</p>
                        {form.repeatMode !== "none" && (
                          <p className="mt-1 text-xs text-gray-500">
                            {form.repeatMode === "daily" ? "매일" : form.repeatMode === "weekly" ? "매주" : "매월 같은 주"} 반복 · {form.repeatEndDate}까지
                          </p>
                        )}
                      </div>
                      <Link href={scheduleSearchHref} className="shrink-0 text-xs font-semibold text-[#1B5E20] hover:underline">
                        시간·차량 다시 선택
                      </Link>
                    </div>
                  </div>

                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-gray-600">추가 요청사항</span>
                    <textarea value={form.notes} onChange={(e) => updateForm("notes", e.target.value)} rows={4} placeholder="운행 목적, 짐/장비, 특이사항 등을 입력해 주세요. (선택)" className={inputClass} />
                  </label>

                  <label className="flex items-start gap-2 rounded-lg bg-gray-50 px-3 py-3 text-sm text-gray-600">
                    <input type="checkbox" checked={form.agreePrivacy} onChange={(e) => updateForm("agreePrivacy", e.target.checked)} className="mt-1" />
                    <span>차량예약 처리를 위해 이름, 연락처, 신청 내용을 수집·이용하는 데 동의합니다.</span>
                  </label>

                  {vehicleRow.isReservable ? (
                    <Button
                      type="submit"
                      disabled={createReservation.isPending}
                      className="w-full rounded-xl bg-[#1B5E20] py-6 text-base font-bold text-white hover:bg-[#2E7D32] disabled:opacity-50"
                    >
                      {createReservation.isPending ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <CalendarCheck className="mr-2 h-5 w-5" />}
                      {applyLabel}
                    </Button>
                  ) : (
                    <div className="rounded-xl bg-gray-100 p-5 text-center text-gray-500">
                      <p className="mb-1 font-bold">현재 예약 불가</p>
                      <p className="text-xs">관리자에게 문의해 주세요.</p>
                    </div>
                  )}
                </div>
              </form>
            )}
          </div>
        </section>
      </div>
    );
  }

  if (error) {
    return <AccessBlocked message={error.message} next={applyReturnHref} />;
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F7F7F5]">
        {conflictDialog}
        <Loader2 className="h-8 w-8 animate-spin text-[#1B5E20]" />
      </div>
    );
  }

  if (!vehicleRow) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F7F7F5]">
        {conflictDialog}
        <div className="text-center">
          <AlertCircle className="mx-auto mb-3 h-12 w-12 text-gray-300" />
          <p className="mb-4 text-gray-500">차량 정보를 찾을 수 없습니다.</p>
          <Link href="/support/vehicle" className="font-medium text-[#1B5E20] hover:underline">차량 목록으로 돌아가기</Link>
        </div>
      </div>
    );
  }
}

export function MyVehicleReservations() {
  const utils = trpc.useUtils();
  const [expandedReservationGroupKey, setExpandedReservationGroupKey] = useState<string | null>(null);
  const { data: rows, isLoading, error } = trpc.home.myVehicleReservations.useQuery(undefined, {
    retry: false,
  });
  const cancelReservation = trpc.home.cancelVehicleReservation.useMutation({
    onSuccess: () => {
      utils.home.myVehicleReservations.invalidate();
      toast.success("차량 예약이 취소되었습니다.");
    },
    onError: (err) => toast.error(err.message),
  });
  const reservationGroups = useMemo(
    () => groupVehicleReservations((rows ?? []) as MyVehicleReservationRow[]),
    [rows]
  );

  if (error) {
    return <AccessBlocked message={error.message} next="/support/vehicle/my-reservations" />;
  }

  return (
    <div className="min-h-screen bg-[#F7F7F5]">
      <VehicleHero />
      <section className="py-12">
        <div className="container max-w-4xl">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900" style={{ fontFamily: "'Noto Serif KR', serif" }}>내 차량예약 현황</h2>
              <p className="mt-1 text-sm text-gray-500">신청한 차량예약의 승인 상태를 확인합니다.</p>
            </div>
            <Link href="/support/vehicle"><Button variant="outline">차량 목록</Button></Link>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-[#1B5E20]" /></div>
          ) : reservationGroups.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-200 bg-white py-14 text-center text-sm text-gray-400">
              신청한 차량예약이 없습니다.
            </div>
          ) : (
            <div className="space-y-3">
              {reservationGroups.map(group => {
                if (group.isRecurring) {
                  const isExpanded = expandedReservationGroupKey === group.key;
                  const statusCounts = group.reservations.reduce<Record<MyVehicleReservationRow["status"], number>>((counts, row) => {
                    counts[row.status] += 1;
                    return counts;
                  }, { pending: 0, approved: 0, rejected: 0, cancelled: 0 });
                  const vehicleLabels = Array.from(new Set(group.reservations.map(row =>
                    `${row.vehicleName ?? "차량"}${row.plateNumber ? ` · ${formatPlateNumber(row.plateNumber)}` : ""}`
                  )));
                  const purposes = Array.from(new Set(group.reservations.map(row => row.purpose)));

                  return (
                    <div key={group.key} className="overflow-hidden rounded-xl border border-blue-100 bg-white shadow-sm">
                      <button
                        type="button"
                        className="flex w-full flex-col gap-3 p-4 text-left transition-colors hover:bg-blue-50/40 md:flex-row md:items-center md:justify-between"
                        aria-expanded={isExpanded}
                        onClick={() => setExpandedReservationGroupKey(isExpanded ? null : group.key)}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="inline-flex rounded-full bg-blue-100 px-2.5 py-1 text-xs font-bold text-blue-700">
                              반복 {group.count}회
                            </span>
                            {(Object.keys(statusCounts) as MyVehicleReservationRow["status"][]).map(statusKey => {
                              const count = statusCounts[statusKey];
                              if (count === 0) return null;
                              const statusInfo = STATUS_LABELS[statusKey];
                              return (
                                <span key={statusKey} className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium ${statusInfo.color}`}>
                                  {statusInfo.label} {count}
                                </span>
                              );
                            })}
                          </div>
                          <h3 className="mt-2 font-bold text-gray-900">
                            차량 반복예약 · 차량 {vehicleLabels.length}대
                          </h3>
                          <p className="mt-1 text-sm text-gray-600">
                            {formatDate(group.startDate)} ~ {formatDate(group.endDate)}
                          </p>
                          <p className="mt-1 text-xs text-gray-500">
                            {purposes.length === 1 ? purposes[0] : "회차별 목적이 다릅니다."}
                          </p>
                          {group.recurrenceLabel && (
                            <p className="mt-1 text-xs font-medium text-blue-700">{group.recurrenceLabel}</p>
                          )}
                        </div>
                        <span className="inline-flex shrink-0 items-center text-xs font-bold text-blue-700">
                          {isExpanded ? "회차 접기" : "전체 회차 보기"}
                          <ChevronDown className={`ml-1 h-4 w-4 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                        </span>
                      </button>

                      {isExpanded && (
                        <div className="border-t border-blue-100 bg-blue-50/40 p-3">
                          <p className="mb-2 text-xs text-blue-800">
                            각 회차의 날짜·시간·차량·상태입니다. 취소는 해당 회차에만 적용됩니다.
                          </p>
                          <div className="space-y-2">
                            {group.reservations.map((row, index) => {
                              const status = STATUS_LABELS[row.status];
                              const canCancel = row.status === "pending" || row.status === "approved";
                              return (
                                <div key={row.id} className="rounded-lg border border-blue-100 bg-white p-3">
                                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                    <div className="min-w-0">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <span className="text-xs font-bold text-blue-700">{index + 1}회차</span>
                                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium ${status.color}`}>
                                          {status.icon} {status.label}
                                        </span>
                                      </div>
                                      <p className="mt-1 font-bold text-gray-900">
                                        {row.vehicleName ?? "차량"}{row.plateNumber ? ` · ${formatPlateNumber(row.plateNumber)}` : ""}
                                      </p>
                                      <p className="mt-0.5 text-sm text-gray-600">
                                        {formatDate(row.reservationDate)} · {row.startTime}~{row.endTime}
                                      </p>
                                      <p className="mt-0.5 text-xs text-gray-500">{row.purpose}</p>
                                      {row.adminComment && <p className="mt-1 text-xs text-red-600">관리자 메모: {row.adminComment}</p>}
                                    </div>
                                    {canCancel && (
                                      <Button
                                        variant="outline"
                                        className="shrink-0 border-red-200 text-red-600 hover:bg-red-50"
                                        disabled={cancelReservation.isPending}
                                        onClick={() => {
                                          if (!confirm(`${index + 1}회차 차량 예약만 취소하시겠습니까?`)) return;
                                          cancelReservation.mutate({ id: row.id });
                                        }}
                                      >
                                        이 회차 취소
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                }

                const row = group.first;
                const status = STATUS_LABELS[row.status];
                const canCancel = row.status === "pending" || row.status === "approved";
                return (
                    <div key={row.id} className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
                      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div>
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${status.color}`}>
                          {status.icon} {status.label}
                        </span>
                        <h3 className="mt-2 font-bold text-gray-900">
                          {row.vehicleName ?? "차량"}{row.plateNumber ? ` · ${formatPlateNumber(row.plateNumber)}` : ""}
                        </h3>
                        <p className="mt-1 text-sm text-gray-500">
                          {formatDate(row.reservationDate)} · {row.startTime}~{row.endTime} · {row.purpose}
                        </p>
                        {row.adminComment && <p className="mt-1 text-xs text-red-600">관리자 메모: {row.adminComment}</p>}
                      </div>
                      <div className="flex shrink-0 gap-2">
                        {canCancel && (
                          <Button
                            variant="outline"
                            className="border-red-200 text-red-600 hover:bg-red-50"
                            disabled={cancelReservation.isPending}
                            onClick={() => {
                              if (!confirm("차량 예약을 취소하시겠습니까?")) return;
                              cancelReservation.mutate({ id: row.id });
                            }}
                          >
                            예약 취소
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
