import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from "lucide-react";
import {
  COURSE_WEEKDAY_LABELS,
  type CourseFacilityRepeatMode,
} from "@shared/courseFacilitySchedule";
import { RESERVATION_REPEAT_OPTIONS } from "@shared/reservationRecurrence";

type Props = {
  enabled: boolean;
  allowCustomDates: boolean;
  startDate: string;
  endDate: string;
  repeatMode: CourseFacilityRepeatMode;
  repeatDays: number[];
  customDates: string[];
  scheduleDates: string[];
  scheduleError: string | null;
  conflictDates: Set<string>;
  checkingConflicts?: boolean;
  onRepeatModeChange: (mode: CourseFacilityRepeatMode) => void;
  onRepeatDaysChange: (days: number[]) => void;
  onCustomDatesChange: (dates: string[]) => void;
};

const REPEAT_OPTIONS: Array<{ value: CourseFacilityRepeatMode; label: string }> = [
  ...RESERVATION_REPEAT_OPTIONS,
  { value: "custom", label: "임의 날짜 선택" },
];

export function getCourseFacilityRepeatOptions(allowCustomDates: boolean) {
  return allowCustomDates
    ? REPEAT_OPTIONS
    : REPEAT_OPTIONS.filter(option => option.value !== "custom");
}

function getDateFromKey(dateKey: string) {
  const date = dateKey ? new Date(`${dateKey}T12:00:00`) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
}

function getDefaultWeekday(dateKey: string) {
  return getDateFromKey(dateKey)?.getDay() ?? 1;
}

function getOrdinalWeekLabel(dateKey: string) {
  const day = Number(dateKey.slice(8, 10));
  if (!day) return "같은 주차";
  return `${Math.floor((day - 1) / 7) + 1}번째 주`;
}

function getMonthKey(dateKey: string) {
  return /^\d{4}-\d{2}/.test(dateKey) ? dateKey.slice(0, 7) : "";
}

function getCurrentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function addMonths(monthKey: string, amount: number) {
  const [year, month] = monthKey.split("-").map(Number);
  const date = new Date(year, month - 1 + amount, 1, 12, 0, 0);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function buildMonthCells(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  const monthIndex = month - 1;
  const firstWeekday = new Date(year, monthIndex, 1, 12, 0, 0).getDay();
  const daysInMonth = new Date(year, monthIndex + 1, 0, 12, 0, 0).getDate();

  return [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => {
      const day = index + 1;
      return {
        day,
        dateKey: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
      };
    }),
  ];
}

function getRepeatSummary(mode: CourseFacilityRepeatMode, startDate: string, endDate: string) {
  if (!startDate) return "먼저 강좌 시작일을 선택해 주세요.";

  const weekday = COURSE_WEEKDAY_LABELS[getDefaultWeekday(startDate)];
  if (mode === "none") return `${startDate} 하루만 시설을 사용합니다.`;
  if (mode === "daily") return `${startDate}부터 ${endDate || "종료일"}까지 매일 사용합니다.`;
  if (mode === "weekly") return `시작일 기준 매주 ${weekday}요일에 사용합니다.`;
  if (mode === "monthly-weekday") {
    return `시작일 기준 매월 ${getOrdinalWeekLabel(startDate)} ${weekday}요일에 사용합니다.`;
  }
  return "필요한 날짜만 달력에서 직접 선택합니다.";
}

export default function CourseFacilityScheduleFields(props: Props) {
  const repeatOptions = getCourseFacilityRepeatOptions(props.allowCustomDates);
  const [visibleMonth, setVisibleMonth] = useState(() => getMonthKey(props.startDate) || getCurrentMonthKey());
  const conflictCount = useMemo(
    () => props.scheduleDates.filter(date => props.conflictDates.has(date)).length,
    [props.conflictDates, props.scheduleDates],
  );
  const monthCells = useMemo(() => buildMonthCells(visibleMonth), [visibleMonth]);
  const startMonth = getMonthKey(props.startDate);
  const endMonth = getMonthKey(props.endDate);

  useEffect(() => {
    if (!startMonth) return;
    setVisibleMonth(current => {
      if (current < startMonth) return startMonth;
      if (endMonth && current > endMonth) return endMonth;
      return current;
    });
  }, [endMonth, startMonth]);

  if (!props.enabled || (!props.allowCustomDates && props.repeatMode === "custom")) return null;

  const changeMode = (mode: CourseFacilityRepeatMode) => {
    props.onRepeatModeChange(mode);
    if (mode === "weekly" || mode === "monthly-weekday") {
      props.onRepeatDaysChange([getDefaultWeekday(props.startDate)]);
    } else {
      props.onRepeatDaysChange([]);
    }
    if (mode === "custom" && startMonth) setVisibleMonth(startMonth);
  };

  const toggleCustomDate = (dateKey: string) => {
    if (!props.startDate || !props.endDate || dateKey < props.startDate || dateKey > props.endDate) return;
    props.onCustomDatesChange(
      props.customDates.includes(dateKey)
        ? props.customDates.filter(item => item !== dateKey)
        : Array.from(new Set([...props.customDates, dateKey])).sort(),
    );
  };

  const [visibleYear, visibleMonthNumber] = visibleMonth.split("-").map(Number);
  const canMovePrevious = !startMonth || addMonths(visibleMonth, -1) >= startMonth;
  const canMoveNext = !endMonth || addMonths(visibleMonth, 1) <= endMonth;

  return (
    <div className="mt-4 rounded-xl border border-green-100 bg-white p-3 sm:p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="flex items-center gap-1.5 text-sm font-bold text-gray-800">
            <CalendarDays className="h-4 w-4 text-[#1B5E20]" />
            시설 사용 일정
          </p>
          <p className="mt-1 text-[11px] leading-5 text-gray-500">
            {props.allowCustomDates
              ? "시설예약과 같은 반복 방식을 사용합니다. 불규칙한 일정은 임의 날짜 선택으로 필요한 날만 고르세요."
              : "시설예약과 같은 반복 방식을 사용합니다."}
          </p>
        </div>
        {props.checkingConflicts && (
          <span className="inline-flex items-center gap-1 text-[11px] text-gray-400">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> 중복 확인 중
          </span>
        )}
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-[220px_1fr]">
        <label className="text-xs font-medium text-gray-600">
          반복 예약
          <select
            value={props.repeatMode}
            onChange={event => changeMode(event.target.value as CourseFacilityRepeatMode)}
            className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-[#1B5E20] focus:outline-none"
          >
            {repeatOptions.map(option => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>

        {props.repeatMode !== "custom" && (
          <div className="rounded-lg border border-green-100 bg-green-50 px-3 py-2.5">
            <p className="text-xs font-bold text-green-800">
              {repeatOptions.find(option => option.value === props.repeatMode)?.label}
            </p>
            <p className="mt-1 text-[11px] leading-5 text-green-700">
              {getRepeatSummary(props.repeatMode, props.startDate, props.endDate)}
            </p>
          </div>
        )}
      </div>

      {props.allowCustomDates && props.repeatMode === "custom" && (
        <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-3 sm:p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-sm font-bold text-gray-800">임의 날짜 선택</p>
              <p className="mt-1 text-[11px] leading-5 text-gray-500">
                첫째 주 월·수·금, 둘째 주 화·목처럼 사용할 날짜를 달력에서 차례로 누르세요.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-green-100 px-2.5 py-1 text-[11px] font-bold text-green-800">
                {props.customDates.length}일 선택
              </span>
              {props.customDates.length > 0 && (
                <button
                  type="button"
                  onClick={() => props.onCustomDatesChange([])}
                  className="rounded-md border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-medium text-gray-500 hover:border-red-200 hover:text-red-600"
                >
                  선택 초기화
                </button>
              )}
            </div>
          </div>

          {!props.startDate || !props.endDate ? (
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-xs text-amber-700">
              강좌 시작일과 종료일을 먼저 선택하면 해당 기간의 달력이 열립니다.
            </div>
          ) : (
            <div className="mt-3 max-w-xl rounded-xl border border-gray-200 bg-white p-3 shadow-sm sm:p-4">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  aria-label="이전 달"
                  disabled={!canMovePrevious}
                  onClick={() => setVisibleMonth(current => addMonths(current, -1))}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 text-gray-600 hover:border-green-300 hover:text-green-700 disabled:cursor-not-allowed disabled:opacity-30"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <p className="text-sm font-bold text-gray-800">{visibleYear}년 {visibleMonthNumber}월</p>
                <button
                  type="button"
                  aria-label="다음 달"
                  disabled={!canMoveNext}
                  onClick={() => setVisibleMonth(current => addMonths(current, 1))}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 text-gray-600 hover:border-green-300 hover:text-green-700 disabled:cursor-not-allowed disabled:opacity-30"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-3 grid grid-cols-7 text-center text-[11px] font-bold text-gray-400">
                {COURSE_WEEKDAY_LABELS.map((label, index) => (
                  <span key={label} className={index === 0 ? "text-red-400" : index === 6 ? "text-blue-400" : ""}>{label}</span>
                ))}
              </div>
              <div className="mt-1 grid grid-cols-7 gap-1">
                {monthCells.map((cell, index) => {
                  if (!cell) return <span key={`empty-${index}`} className="aspect-square" />;

                  const outsideRange = cell.dateKey < props.startDate || cell.dateKey > props.endDate;
                  const selected = props.customDates.includes(cell.dateKey);
                  const conflict = selected && props.conflictDates.has(cell.dateKey);
                  return (
                    <button
                      key={cell.dateKey}
                      type="button"
                      disabled={outsideRange}
                      aria-pressed={selected}
                      aria-label={`${cell.dateKey}${selected ? " 선택됨" : ""}`}
                      onClick={() => toggleCustomDate(cell.dateKey)}
                      className={`aspect-square min-h-9 rounded-lg border text-xs font-bold transition-colors ${
                        conflict
                          ? "border-red-500 bg-red-500 text-white"
                          : selected
                            ? "border-[#1B5E20] bg-[#1B5E20] text-white shadow-sm"
                            : outsideRange
                              ? "cursor-not-allowed border-transparent bg-gray-50 text-gray-300"
                              : "border-gray-100 bg-white text-gray-600 hover:border-green-400 hover:bg-green-50 hover:text-green-800"
                      }`}
                    >
                      {cell.day}
                    </button>
                  );
                })}
              </div>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-gray-500">
                <span className="inline-flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-sm bg-[#1B5E20]" />선택한 날짜</span>
                <span className="inline-flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-sm bg-red-500" />중복 예약</span>
                <span className="inline-flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-sm border border-gray-200 bg-white" />선택 가능</span>
                <span className="inline-flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-sm bg-gray-100" />강좌 기간 밖</span>
              </div>
            </div>
          )}
        </div>
      )}

      {props.scheduleError ? (
        <div className="mt-3 flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {props.scheduleError}
        </div>
      ) : props.scheduleDates.length > 0 ? (
        <div className="mt-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-bold text-gray-700">생성될 시설예약 총 {props.scheduleDates.length}회</span>
            <span className={conflictCount > 0 ? "font-bold text-red-600" : "text-green-700"}>
              {conflictCount > 0 ? `중복 ${conflictCount}회 · 저장 불가` : "현재 중복 없음"}
            </span>
          </div>
          <div className="grid max-h-44 grid-cols-1 gap-1.5 overflow-y-auto rounded-lg bg-gray-50 p-2 sm:grid-cols-2 lg:grid-cols-3">
            {props.scheduleDates.map((date, index) => {
              const conflict = props.conflictDates.has(date);
              return (
                <div key={date} className={`flex items-center justify-between rounded-md border px-2.5 py-2 text-[11px] ${conflict ? "border-red-200 bg-red-50 text-red-600" : "border-green-100 bg-white text-gray-600"}`}>
                  <span><strong className="mr-1">{index + 1}회</strong>{date}</span>
                  <span className="inline-flex items-center gap-1 font-bold">
                    {conflict ? <AlertCircle className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />}
                    {conflict ? "중복 예약" : "예약 가능"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
