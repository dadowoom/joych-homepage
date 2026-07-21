import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Building2,
  CalendarCheck,
  ChevronLeft,
  ChevronRight,
  Loader2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import ReservationTimelinePicker from "@/components/facility/ReservationTimelinePicker";
import { getReservationTimeRestriction } from "@/lib/facilityReservationTime";
import { generateReservationTimePoints } from "@/lib/facilitySlotSelection";
import { trpc } from "@/lib/trpc";

type FacilityOption = {
  id: number;
  name: string;
  location?: string | null;
  slotMinutes?: number | null;
  maxSlots?: number | null;
};

type ReservationRow = {
  id?: number | null;
  startTime: string;
  endTime: string;
  status: string;
  reserverName?: string | null;
  reserverPhone?: string | null;
  purpose?: string | null;
  department?: string | null;
  userName?: string | null;
  memberPosition?: string | null;
  memberPhone?: string | null;
};

type Selection = {
  facilityId: string;
  date: string;
  startTime: string;
  endTime: string;
};

type Props = {
  open: boolean;
  facilities: FacilityOption[];
  facilityId: string;
  initialDate: string;
  initialStartTime: string;
  initialEndTime: string;
  minDate: string;
  maxDate: string;
  currentReservationId?: number | null;
  onFacilityChange: (facilityId: string) => void;
  onApply: (selection: Selection) => void;
  onClose: () => void;
};

const DAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

function parseDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  if ([year, month, day].some(Number.isNaN)) return null;
  return new Date(year, month - 1, day);
}

function buildMonthCells(monthDate: Date) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  return [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ] as Array<number | null>;
}

function isActiveReservation(row: ReservationRow) {
  return row.status !== "rejected" && row.status !== "cancelled";
}

function addReservationSlots(
  target: Set<string> | Map<string, ReservationRow>,
  reservation: ReservationRow,
  slotMinutes: number,
) {
  const [startHour, startMinute] = reservation.startTime.split(":").map(Number);
  const [endHour, endMinute] = reservation.endTime.split(":").map(Number);
  if ([startHour, startMinute, endHour, endMinute].some(Number.isNaN)) return;

  let current = startHour * 60 + startMinute;
  const end = endHour * 60 + endMinute;
  while (current < end) {
    const slot = `${String(Math.floor(current / 60)).padStart(2, "0")}:${String(current % 60).padStart(2, "0")}`;
    if (target instanceof Map) target.set(slot, reservation);
    else target.add(slot);
    current += slotMinutes;
  }
}

function formatDateLabel(dateKey: string) {
  const date = parseDateKey(dateKey);
  if (!date) return dateKey;
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일 (${DAY_LABELS[date.getDay()]})`;
}

function getReservationDisplayName(row: ReservationRow) {
  return row.reserverName || row.userName || "예약자";
}

function getReservationDisplayMeta(row: ReservationRow) {
  const position = row.memberPosition || row.department || "소속 미입력";
  const phone = row.reserverPhone || row.memberPhone || "연락처 미입력";
  return `${position} · ${phone}`;
}

function getFullDayTimePoints(slotMinutes: number) {
  const points = generateReservationTimePoints("00:00", "23:59", slotMinutes);
  if (points[points.length - 1] !== "23:59") points.push("23:59");
  return points;
}

export default function CourseFacilityReservationPickerDialog({
  open,
  facilities,
  facilityId,
  initialDate,
  initialStartTime,
  initialEndTime,
  minDate,
  maxDate,
  currentReservationId,
  onFacilityChange,
  onApply,
  onClose,
}: Props) {
  const [date, setDate] = useState(initialDate || minDate);
  const [startTime, setStartTime] = useState(initialStartTime);
  const [endTime, setEndTime] = useState(initialEndTime);
  const [month, setMonth] = useState(() => parseDateKey(initialDate || minDate) ?? new Date());

  useEffect(() => {
    if (!open) return;
    const nextDate = initialDate || minDate;
    setDate(nextDate);
    setStartTime(initialStartTime);
    setEndTime(initialEndTime);
    setMonth(parseDateKey(nextDate) ?? new Date());
  }, [initialDate, initialEndTime, initialStartTime, minDate, open]);

  const selectedFacility = useMemo(
    () => facilities.find(facility => facility.id === Number(facilityId)) ?? null,
    [facilities, facilityId],
  );
  const selectedFacilityId = selectedFacility?.id ?? 0;
  const slotMinutes = Math.max(1, Number(selectedFacility?.slotMinutes) || 60);
  const maxSlots = Math.max(1, Number(selectedFacility?.maxSlots) || 24);

  const { data: reservations = [], isLoading } = trpc.home.facilityReservationsByDate.useQuery(
    { facilityId: selectedFacilityId, date },
    { enabled: open && selectedFacilityId > 0 && Boolean(date) },
  );

  const reservationRows = useMemo(() => reservations as ReservationRow[], [reservations]);
  const allSlots = useMemo(
    () => selectedFacility && date ? getFullDayTimePoints(slotMinutes) : [],
    [date, selectedFacility, slotMinutes],
  );
  const bookedSlots = useMemo(() => {
    const result = new Set<string>();
    reservationRows.forEach(row => {
      if (!isActiveReservation(row)) return;
      if (currentReservationId && row.id === currentReservationId) return;
      addReservationSlots(result, row, slotMinutes);
    });
    return result;
  }, [currentReservationId, reservationRows, slotMinutes]);
  const reservationBySlot = useMemo(() => {
    const result = new Map<string, ReservationRow>();
    reservationRows.forEach(row => {
      if (!isActiveReservation(row)) return;
      if (currentReservationId && row.id === currentReservationId) return;
      addReservationSlots(result, row, slotMinutes);
    });
    return result;
  }, [currentReservationId, reservationRows, slotMinutes]);
  const disabledSlots = useMemo(() => {
    const result = new Map<string, string>();
    allSlots.forEach(slot => {
      const restriction = getReservationTimeRestriction(date, slot, { enforceLeadTime: false });
      if (restriction) result.set(slot, restriction);
    });
    return result;
  }, [allSlots, date]);
  const monthDays = useMemo(() => buildMonthCells(month), [month]);

  if (!open) return null;

  function selectDate(dateKey: string) {
    setDate(dateKey);
    setStartTime("");
    setEndTime("");
  }

  function applySelection() {
    if (!facilityId) {
      toast.error("시설을 먼저 선택해주세요.");
      return;
    }
    if (!date) {
      toast.error("시설예약 날짜를 선택해주세요.");
      return;
    }
    if (!startTime || !endTime) {
      toast.error("시설예약 시간을 선택해주세요.");
      return;
    }
    onApply({ facilityId, date, startTime, endTime });
  }

  function renderTooltip(slot: string, disabledReason?: string) {
    const reservation = reservationBySlot.get(slot);
    if (!reservation) return disabledReason ?? "예약 불가";
    return (
      <div className="space-y-0.5">
        <p className="font-semibold text-white">
          {getReservationDisplayName(reservation)} · {reservation.startTime}~{reservation.endTime}
        </p>
        <p className="text-gray-200">{getReservationDisplayMeta(reservation)}</p>
        {reservation.purpose && <p className="line-clamp-2 text-gray-300">{reservation.purpose}</p>}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/45 p-3">
      <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-gray-100 bg-white px-5 py-4">
          <div>
            <h4 className="text-base font-bold text-gray-900">강좌 시설예약 선택</h4>
            <p className="mt-0.5 text-xs text-gray-500">시설·날짜·시간을 선택하면 강좌 일정에 자동 반영됩니다.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700" aria-label="닫기">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid gap-4 p-5 lg:grid-cols-[320px_1fr]">
          <div className="space-y-4">
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
              <label className="mb-2 flex items-center gap-1.5 text-xs font-bold text-gray-700">
                <Building2 className="h-4 w-4 text-[#1B5E20]" /> 예약할 시설
              </label>
              <select
                value={facilityId}
                onChange={event => {
                  onFacilityChange(event.target.value);
                  setStartTime("");
                  setEndTime("");
                }}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-[#1B5E20] focus:outline-none"
              >
                <option value="">시설 선택 안 함</option>
                {facilities.map(facility => (
                  <option key={facility.id} value={facility.id}>
                    {facility.name}{facility.location ? ` · ${facility.location}` : ""}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-[11px] leading-relaxed text-green-700">
                강좌 담당자 전용: 오늘부터 365일 이내 · 24시간 선택 · 자동승인 · 기존 예약과 중복 불가
              </p>
            </div>

            <div className="rounded-xl border border-gray-100 bg-white p-4">
              <div className="mb-3 flex items-center justify-between">
                <button type="button" onClick={() => setMonth(previous => new Date(previous.getFullYear(), previous.getMonth() - 1, 1))} className="rounded-full p-1.5 text-gray-500 hover:bg-gray-100" aria-label="이전 달">
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <p className="text-sm font-bold text-gray-900">{month.getFullYear()}년 {month.getMonth() + 1}월</p>
                <button type="button" onClick={() => setMonth(previous => new Date(previous.getFullYear(), previous.getMonth() + 1, 1))} className="rounded-full p-1.5 text-gray-500 hover:bg-gray-100" aria-label="다음 달">
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
              <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[11px] font-medium">
                {DAY_LABELS.map((day, index) => <div key={day} className={index === 0 ? "text-red-400" : index === 6 ? "text-blue-400" : "text-gray-500"}>{day}</div>)}
              </div>
              <div className="grid grid-cols-7 gap-1 text-center text-xs">
                {monthDays.map((day, index) => {
                  if (!day) return <div key={`empty-${index}`} className="h-8" />;
                  const dateKey = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                  const unavailable = dateKey < minDate || dateKey > maxDate;
                  const selected = date === dateKey;
                  return (
                    <button
                      key={dateKey}
                      type="button"
                      disabled={unavailable}
                      onClick={() => selectDate(dateKey)}
                      className={`mx-auto flex h-8 w-8 items-center justify-center rounded-full font-medium transition-colors ${selected ? "bg-[#1B5E20] text-white" : unavailable ? "cursor-not-allowed text-gray-300" : "border border-green-200 bg-green-50 text-green-700 hover:bg-green-100"}`}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
              <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-gray-400">
                <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-full border border-green-200 bg-green-50" />예약 가능</span>
                <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-full bg-gray-200" />선택 불가</span>
                <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-full bg-[#1B5E20]" />선택됨</span>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-xl border border-green-100 bg-green-50/60 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="flex items-center gap-1.5 text-sm font-bold text-[#1B5E20]"><CalendarCheck className="h-4 w-4" />{date ? formatDateLabel(date) : "날짜를 선택해주세요"}</p>
                  <p className="mt-1 text-xs text-gray-500">{selectedFacility ? `${selectedFacility.name}${selectedFacility.location ? ` · ${selectedFacility.location}` : ""}` : "먼저 시설을 선택하면 예약 시간표가 표시됩니다."}</p>
                </div>
                {startTime && endTime && <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-[#1B5E20] shadow-sm">{startTime}~{endTime} 선택</span>}
              </div>
            </div>

            {!selectedFacility ? (
              <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-12 text-center text-sm text-gray-400">시설을 선택하면 달력과 시간표로 예약 가능 시간을 확인할 수 있습니다.</div>
            ) : !date ? (
              <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-12 text-center text-sm text-gray-400">왼쪽 달력에서 예약 날짜를 선택해주세요.</div>
            ) : (
              <div className="rounded-xl border border-gray-100 bg-white p-4">
                <div className="mb-3 flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2 text-xs text-green-700">
                  <AlertCircle className="h-4 w-4 shrink-0" /> 시설 운영시간과 관계없이 24시간 중 선택할 수 있으며, 이미 예약된 시간은 선택할 수 없습니다.
                </div>
                {isLoading ? (
                  <div className="flex items-center justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-[#1B5E20]" /></div>
                ) : (
                  <ReservationTimelinePicker
                    allSlots={allSlots}
                    bookedSlots={bookedSlots}
                    disabledSlots={disabledSlots}
                    startTime={startTime}
                    endTime={endTime}
                    onSelect={(start, end) => { setStartTime(start); setEndTime(end); }}
                    slotMinutes={slotMinutes}
                    maxSlots={maxSlots}
                    renderDisabledTooltip={renderTooltip}
                  />
                )}
                <div className="mt-4 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-[11px] leading-relaxed text-gray-500">적용을 누르면 아래 강좌 시작일·종료일·시작 시간·종료 시간이 자동으로 채워집니다.</div>
              </div>
            )}
          </div>
        </div>

        <div className="sticky bottom-0 flex flex-col-reverse gap-2 border-t border-gray-100 bg-white px-5 py-4 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50">닫기</button>
          <button type="button" onClick={applySelection} className="rounded-lg bg-[#1B5E20] px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-[#2E7D32]">선택한 시설예약 적용</button>
        </div>
      </div>
    </div>
  );
}
