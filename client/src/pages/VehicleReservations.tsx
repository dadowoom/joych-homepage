/**
 * 차량예약 사용자 화면
 * 지정된 성도 그룹만 목록/신청 화면에 접근할 수 있습니다.
 */

import { useMemo, useState } from "react";
import { Link, useLocation, useParams, useSearch } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import ReservationTimelinePicker from "@/components/facility/ReservationTimelinePicker";
import { generateReservationTimePoints } from "@/lib/facilitySlotSelection";
import { toast } from "sonner";
import {
  AlertCircle,
  CalendarCheck,
  CheckCircle2,
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
  adminComment?: string | null;
  createdAt: Date | string;
};

const PURPOSE_OPTIONS = [
  "교회 행사",
  "부서 행사",
  "심방/탐방",
  "선교/봉사",
  "물품 운반",
  "기타",
];

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

function VehicleCard({ vehicle }: { vehicle: VehicleRow }) {
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
          {vehicle.plateNumber && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">{vehicle.plateNumber}</span>}
        </div>
        {vehicle.description && <p className="mb-4 line-clamp-2 text-sm leading-6 text-gray-500">{vehicle.description}</p>}
        <div className="mb-5 space-y-2 text-sm text-gray-600">
          {vehicle.location && <p className="flex items-center gap-2"><MapPin className="h-4 w-4 text-[#1B5E20]" /> {vehicle.location}</p>}
          <p className="flex items-center gap-2"><Users className="h-4 w-4 text-[#1B5E20]" /> 최대 {vehicle.capacity}명</p>
          <p className="flex items-center gap-2"><Clock className="h-4 w-4 text-[#1B5E20]" /> {vehicle.openTime}~{vehicle.closeTime} · {vehicle.slotMinutes}분 단위</p>
        </div>
        <Link href={`/support/vehicle/${vehicle.id}`}>
          <Button className="w-full bg-[#1B5E20] text-white hover:bg-[#2E7D32]" disabled={!vehicle.isReservable}>
            {vehicle.isReservable ? "예약 신청" : "예약 중단"}
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
  const [viewYear, setViewYear] = useState(() => new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(() => new Date().getMonth());
  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const days: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ];
  const todayKey = getKstDateKey();
  const dayLabels = ["일", "월", "화", "수", "목", "금", "토"];

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
        <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-full border border-green-300 bg-green-100" />예약가능</span>
        <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-full border border-red-300 bg-red-100" />예약불가</span>
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
  const { data: vehicles, isLoading, error } = trpc.home.vehicles.useQuery(undefined, {
    retry: false,
  });

  if (error) {
    return <AccessBlocked message={error.message} next="/support/vehicle" />;
  }

  return (
    <div className="min-h-screen bg-[#F7F7F5]">
      <VehicleHero />
      <section className="py-12">
        <div className="container">
          <div className="mb-6 flex justify-end">
            <Link href="/support/vehicle/my-reservations">
              <Button variant="outline" className="border-[#1B5E20] text-[#1B5E20] hover:bg-green-50">
                <CalendarCheck className="mr-2 h-4 w-4" /> 내 차량예약 현황
              </Button>
            </Link>
          </div>
          {isLoading ? (
            <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-[#1B5E20]" /></div>
          ) : !vehicles?.length ? (
            <div className="rounded-xl border border-dashed border-gray-200 bg-white py-14 text-center text-sm text-gray-400">
              현재 예약 가능한 차량이 없습니다.
            </div>
          ) : (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {(vehicles as VehicleRow[]).map(vehicle => <VehicleCard key={vehicle.id} vehicle={vehicle} />)}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

export function VehicleReservationDetail() {
  const params = useParams<{ id: string }>();
  const vehicleId = Number(params.id);
  const [, navigate] = useLocation();
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
    if (!memberMe) {
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
                  <img src={vehicleRow.thumbnailUrl} alt={vehicleRow.name} className="aspect-video w-full object-cover" />
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
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">{vehicleRow.plateNumber}</span>
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
                  disabled={!selectedDate || memberLoading}
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
  const initialSearchParams = useMemo(() => new URLSearchParams(searchString), [searchString]);
  const vehicleDetailHref = `/support/vehicle/${vehicleId}`;
  const [form, setForm] = useState({
    reserverName: "",
    reserverPhone: "",
    department: "",
    purpose: "",
    date: initialSearchParams.get("date") ?? "",
    startTime: initialSearchParams.get("startTime") ?? "",
    endTime: initialSearchParams.get("endTime") ?? "",
    passengers: "",
    notes: "",
    agreePrivacy: false,
  });
  const [submitted, setSubmitted] = useState(false);
  const [reservedStatus, setReservedStatus] = useState<"pending" | "approved">("pending");

  const { data: memberMe } = trpc.members.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });
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
      setSubmitted(true);
    },
    onError: (err) => toast.error(err.message || "차량 예약 신청 중 오류가 발생했습니다."),
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

  function validate() {
    if (!vehicleRow) return "차량 정보를 찾을 수 없습니다.";
    if (!memberMe) return "성도 로그인 후 신청할 수 있습니다.";
    if (!form.reserverName.trim()) return "신청자 이름을 입력해주세요.";
    if (!form.reserverPhone.trim()) return "연락처를 입력해주세요.";
    if (!form.department.trim()) return "소속 부서/단체를 입력해주세요.";
    if (!form.purpose) return "사용 목적을 선택해주세요.";
    if (!form.date) return "사용 날짜를 선택해주세요.";
    if (form.date < getKstDateKey()) return "지난 날짜는 예약할 수 없습니다.";
    if (!form.startTime || !form.endTime) return "사용 시간을 선택해주세요.";
    if (form.startTime >= form.endTime) return "종료 시간은 시작 시간보다 늦어야 합니다.";
    if (!form.passengers || Number(form.passengers) < 1) return "탑승 인원을 입력해주세요.";
    if (Number(form.passengers) > vehicleRow.capacity) return `최대 탑승 인원(${vehicleRow.capacity}명)을 초과할 수 없습니다.`;
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
      toast.error(errorMessage);
      if (errorMessage.includes("로그인")) navigate(getLoginHref(`/support/vehicle/${vehicleId}/apply${searchString ? `?${searchString}` : ""}`));
      return;
    }
    createReservation.mutate({
      vehicleId,
      reserverName: form.reserverName,
      reserverPhone: form.reserverPhone,
      reservationDate: form.date,
      startTime: form.startTime,
      endTime: form.endTime,
      purpose: form.purpose,
      department: form.department || undefined,
      passengers: Number(form.passengers),
      notes: form.notes || undefined,
    });
  }

  const applyLabel = useMemo(() => {
    if (!form.date) return "날짜를 먼저 선택하세요";
    if (!form.startTime) return `${form.date} — 시간을 선택하세요`;
    if (!form.endTime) return `${form.date} ${form.startTime} — 종료 시간을 선택하세요`;
    return `${form.date} ${form.startTime}~${form.endTime} 차량예약 신청`;
  }, [form.date, form.startTime, form.endTime]);

  if (vehicleRow && !error && !isLoading) {
    const hasQueryDate = Boolean(initialSearchParams.get("date"));
    const inputClass = "w-full rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-800 transition-colors focus:border-[#1B5E20] focus:outline-none focus:ring-1 focus:ring-[#1B5E20] disabled:bg-gray-50 disabled:text-gray-400";

    return (
      <div className="min-h-screen bg-[#F7F7F5]">
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
                <p className="mt-3 text-sm text-gray-500">담당자가 확인한 뒤 필요한 경우 연락드립니다.</p>
                <div className="mt-7 flex justify-center gap-2">
                  <Link href="/support/vehicle"><Button variant="outline">차량 목록</Button></Link>
                  <Link href="/support/vehicle/my-reservations"><Button className="bg-[#1B5E20] text-white hover:bg-[#2E7D32]">내 예약 현황</Button></Link>
                </div>
              </div>
            ) : (
              <form onSubmit={submit} noValidate>
                <div className="mb-6 flex items-center gap-4 rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
                  {vehicleRow.thumbnailUrl ? (
                    <img src={vehicleRow.thumbnailUrl} alt={vehicleRow.name} className="h-16 w-16 shrink-0 rounded-lg object-cover" />
                  ) : (
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-gray-100">
                      <Car className="h-7 w-7 text-gray-300" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    {vehicleRow.location && <p className="mb-0.5 text-xs text-gray-400">{vehicleRow.location}</p>}
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-bold text-gray-900" style={{ fontFamily: "'Noto Serif KR', serif" }}>{vehicleRow.name}</p>
                      {vehicleRow.plateNumber && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">{vehicleRow.plateNumber}</span>}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-3 text-xs text-gray-500">
                      <span className="flex items-center gap-1"><Users className="h-3 w-3" /> 최대 {vehicleRow.capacity}명</span>
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {vehicleRow.slotMinutes}분 단위</span>
                    </div>
                  </div>
                  <Link href={vehicleDetailHref} className="shrink-0 text-xs text-gray-400 transition-colors hover:text-[#1B5E20]">
                    ← 변경
                  </Link>
                </div>

                {!memberMe && (
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
                      onClick={() => navigate(getLoginHref(`/support/vehicle/${vehicleId}/apply${searchString ? `?${searchString}` : ""}`))}
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
                    <span className="mb-1 block text-xs font-medium text-gray-600">소속 부서/단체 *</span>
                    <input value={form.department} onChange={(e) => updateForm("department", e.target.value)} placeholder="예: 청년부, 찬양팀, 외부단체명" className={inputClass} />
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-gray-600">사용 목적 *</span>
                    <select value={form.purpose} onChange={(e) => updateForm("purpose", e.target.value)} className={inputClass}>
                      <option value="">선택해 주세요</option>
                      {PURPOSE_OPTIONS.map(option => <option key={option} value={option}>{option}</option>)}
                    </select>
                  </label>

                  <h2 className="border-b border-gray-100 pb-3 pt-2 text-base font-bold text-gray-900" style={{ fontFamily: "'Noto Serif KR', serif" }}>
                    사용 일정
                  </h2>

                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-gray-600">사용 날짜 *</span>
                    {hasQueryDate ? (
                      <div className="flex items-center gap-2">
                        <div className={`${inputClass} flex cursor-default items-center gap-2 bg-gray-50`}>
                          <CalendarCheck className="h-4 w-4 shrink-0 text-[#1B5E20]" />
                          <span className="font-medium text-gray-800">{form.date}</span>
                        </div>
                        <Link href={vehicleDetailHref} className="shrink-0 whitespace-nowrap text-xs text-[#1B5E20] hover:underline">
                          날짜 변경
                        </Link>
                      </div>
                    ) : (
                      <input
                        type="date"
                        value={form.date}
                        onChange={(e) => updateForm("date", e.target.value)}
                        min={getKstDateKey()}
                        className={inputClass}
                      />
                    )}
                  </label>

                  {form.date && (
                    <div>
                      <span className="mb-1 block text-xs font-medium text-gray-600">사용 시간 *</span>
                      <VehicleTimeSlotPanel
                        vehicle={vehicleRow}
                        selectedDate={form.date}
                        allSlots={allTimeSlots}
                        bookedSlots={bookedSlots}
                        disabledSlots={disabledSlots}
                        reservationRows={reservationRows}
                        startTime={form.startTime}
                        endTime={form.endTime}
                        onSelectTime={(start, end) => setForm(prev => ({ ...prev, startTime: start, endTime: end }))}
                      />
                      <p className="mt-2 text-xs text-gray-400">{vehicleRow.slotMinutes}분 단위 - 시작 시간을 클릭한 뒤 종료 시간을 클릭하세요.</p>
                    </div>
                  )}

                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-gray-600">탑승 인원 *</span>
                    <input type="number" min={1} max={vehicleRow.capacity} value={form.passengers} onChange={(e) => updateForm("passengers", e.target.value)} placeholder={`1 ~ ${vehicleRow.capacity}`} className={inputClass} />
                    <p className="mt-1 text-xs text-gray-400">최대 탑승 인원: {vehicleRow.capacity}명</p>
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-gray-600">추가 요청사항</span>
                    <textarea value={form.notes} onChange={(e) => updateForm("notes", e.target.value)} rows={4} placeholder="운행 목적, 짐/장비, 특이사항 등을 입력해 주세요. (선택)" className={inputClass} />
                  </label>

                  <label className="flex items-start gap-2 rounded-lg bg-gray-50 px-3 py-3 text-sm text-gray-600">
                    <input type="checkbox" checked={form.agreePrivacy} onChange={(e) => updateForm("agreePrivacy", e.target.checked)} className="mt-1" />
                    <span>차량예약 처리를 위해 이름, 연락처, 소속, 신청 내용을 수집·이용하는 데 동의합니다.</span>
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
    return <AccessBlocked message={error.message} next={`/support/vehicle/${vehicleId}/apply`} />;
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
}

export function MyVehicleReservations() {
  const utils = trpc.useUtils();
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
          ) : !(rows as MyVehicleReservationRow[] | undefined)?.length ? (
            <div className="rounded-xl border border-dashed border-gray-200 bg-white py-14 text-center text-sm text-gray-400">
              신청한 차량예약이 없습니다.
            </div>
          ) : (
            <div className="space-y-3">
              {(rows as MyVehicleReservationRow[]).map(row => {
                const status = STATUS_LABELS[row.status];
                const canCancel = row.status === "pending" || row.status === "approved";
                return (
                  <div key={row.id} className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                      <div>
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${status.color}`}>
                          {status.icon} {status.label}
                        </span>
                        <h3 className="mt-2 font-bold text-gray-900">
                          {row.vehicleName ?? "차량"} · {formatDate(row.reservationDate)}
                        </h3>
                        <p className="mt-1 text-sm text-gray-500">
                          {row.startTime}~{row.endTime} · {row.purpose} · {row.passengers}명
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
                        {row.status === "approved" && (
                          <a href="tel:054-270-1000">
                            <Button variant="outline" className="border-[#1B5E20] text-[#1B5E20] hover:bg-green-50">
                              <Phone className="mr-1.5 h-4 w-4" /> 문의
                            </Button>
                          </a>
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
