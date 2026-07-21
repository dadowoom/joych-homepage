import { useMemo, useState } from "react";
import { AlertCircle, CalendarDays, CheckCircle2, Loader2, Plus, X } from "lucide-react";
import {
  COURSE_WEEKDAY_LABELS,
  type CourseFacilityRepeatMode,
} from "@shared/courseFacilitySchedule";

type Props = {
  enabled: boolean;
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
  { value: "none", label: "반복 없음" },
  { value: "weekly", label: "매주 반복" },
  { value: "monthly-weekday", label: "매월 같은 주" },
  { value: "custom", label: "날짜 직접 선택" },
];

function getDefaultWeekday(dateKey: string) {
  const date = dateKey ? new Date(`${dateKey}T12:00:00`) : null;
  return date && !Number.isNaN(date.getTime()) ? date.getDay() : 1;
}

function getOrdinalWeekLabel(dateKey: string) {
  const day = Number(dateKey.slice(8, 10));
  if (!day) return "같은 주차";
  return `${Math.floor((day - 1) / 7) + 1}번째 주`;
}

export default function CourseFacilityScheduleFields(props: Props) {
  const [customDate, setCustomDate] = useState("");
  const conflictCount = useMemo(
    () => props.scheduleDates.filter(date => props.conflictDates.has(date)).length,
    [props.conflictDates, props.scheduleDates],
  );

  if (!props.enabled) return null;

  const changeMode = (mode: CourseFacilityRepeatMode) => {
    props.onRepeatModeChange(mode);
    if ((mode === "weekly" || mode === "monthly-weekday") && props.repeatDays.length === 0) {
      props.onRepeatDaysChange([getDefaultWeekday(props.startDate)]);
    }
  };

  const toggleWeekday = (weekday: number) => {
    props.onRepeatDaysChange(
      props.repeatDays.includes(weekday)
        ? props.repeatDays.filter(day => day !== weekday)
        : [...props.repeatDays, weekday].sort((a, b) => a - b),
    );
  };

  const addCustomDate = () => {
    if (!customDate) return;
    props.onCustomDatesChange(Array.from(new Set([...props.customDates, customDate])).sort());
    setCustomDate("");
  };

  return (
    <div className="mt-4 rounded-xl border border-green-100 bg-white p-3 sm:p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="flex items-center gap-1.5 text-sm font-bold text-gray-800">
            <CalendarDays className="h-4 w-4 text-[#1B5E20]" />
            시설 사용 반복 일정
          </p>
          <p className="mt-1 text-[11px] leading-5 text-gray-500">
            강좌가 실제로 시설을 사용하는 날짜만 선택하세요. 선택된 모든 회차는 자동 승인되며 기존 예약과 겹칠 수 없습니다.
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
          반복 방식
          <select
            value={props.repeatMode}
            onChange={event => changeMode(event.target.value as CourseFacilityRepeatMode)}
            className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-[#1B5E20] focus:outline-none"
          >
            {REPEAT_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>

        {(props.repeatMode === "weekly" || props.repeatMode === "monthly-weekday") && (
          <div>
            <p className="text-xs font-medium text-gray-600">
              반복 요일
              {props.repeatMode === "monthly-weekday" && props.startDate && (
                <span className="ml-1 font-normal text-green-700">({getOrdinalWeekLabel(props.startDate)} 기준)</span>
              )}
            </p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {COURSE_WEEKDAY_LABELS.map((label, weekday) => {
                const selected = props.repeatDays.includes(weekday);
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => toggleWeekday(weekday)}
                    className={`h-9 min-w-9 rounded-lg border px-2 text-xs font-bold transition-colors ${
                      selected
                        ? "border-[#1B5E20] bg-[#1B5E20] text-white"
                        : "border-gray-200 bg-white text-gray-500 hover:border-green-300"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {props.repeatMode === "custom" && (
          <div>
            <p className="text-xs font-medium text-gray-600">시설을 사용할 날짜 추가</p>
            <div className="mt-1 flex gap-2">
              <input
                type="date"
                min={props.startDate || undefined}
                max={props.endDate || undefined}
                value={customDate}
                onChange={event => setCustomDate(event.target.value)}
                className="min-w-0 flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#1B5E20] focus:outline-none"
              />
              <button
                type="button"
                onClick={addCustomDate}
                className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-[#1B5E20] px-3 py-2 text-xs font-bold text-white"
              >
                <Plus className="h-3.5 w-3.5" /> 추가
              </button>
            </div>
            {props.customDates.length > 0 && (
              <div className="mt-2 flex max-h-24 flex-wrap gap-1.5 overflow-y-auto">
                {props.customDates.map(date => (
                  <span key={date} className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-1 text-[11px] text-green-800">
                    {date}
                    <button type="button" aria-label={`${date} 삭제`} onClick={() => props.onCustomDatesChange(props.customDates.filter(item => item !== date))}>
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

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
