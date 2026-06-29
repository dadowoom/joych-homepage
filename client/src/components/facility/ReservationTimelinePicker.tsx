import type { ReactNode } from "react";
import {
  getReservationEndRestriction,
  getReservationSlotSelectionState,
} from "@/lib/facilitySlotSelection";

type ReservationTimelinePickerProps = {
  allSlots: string[];
  bookedSlots: Set<string>;
  disabledSlots?: Map<string, string>;
  startTime: string;
  endTime: string;
  onSelect: (start: string, end: string) => void;
  slotMinutes?: number;
  maxSlots?: number;
  bookedReason?: string;
  renderDisabledTooltip?: (slot: string, disabledReason?: string) => ReactNode;
};

function toMinutes(time: string) {
  const [hour, minute] = time.split(":").map(Number);
  if ([hour, minute].some(Number.isNaN)) return null;
  return hour * 60 + minute;
}

function formatSegmentLabel(start: string, end: string) {
  return `${start}~${end}`;
}

export default function ReservationTimelinePicker({
  allSlots,
  bookedSlots,
  disabledSlots = new Map<string, string>(),
  startTime,
  endTime,
  onSelect,
  slotMinutes = 60,
  maxSlots = 8,
  bookedReason = "예약됨",
  renderDisabledTooltip,
}: ReservationTimelinePickerProps) {
  const segments = allSlots.slice(0, -1).map((slot, index) => ({
    start: slot,
    end: allSlots[index + 1],
  }));

  function getSegmentRestriction(start: string, end: string) {
    const startState = getReservationSlotSelectionState({
      slot: start,
      allSlots,
      bookedSlots,
      disabledSlots,
      startTime: "",
      endTime: "",
      slotMinutes,
      maxSlots,
      bookedReason,
    });
    if (startState.isDisabled) return startState.disabledReason ?? bookedReason;

    return getReservationEndRestriction({
      startTime: start,
      endTime: end,
      bookedSlots,
      disabledSlots,
      slotMinutes,
      maxSlots,
    });
  }

  function canExtendSelectionTo(end: string) {
    if (!startTime) return false;
    const startMinutes = toMinutes(startTime);
    const endMinutes = toMinutes(end);
    if (startMinutes === null || endMinutes === null || endMinutes <= startMinutes) return false;

    return !getReservationEndRestriction({
      startTime,
      endTime: end,
      bookedSlots,
      disabledSlots,
      slotMinutes,
      maxSlots,
    });
  }

  function handleSegmentClick(start: string, end: string) {
    const segmentRestriction = getSegmentRestriction(start, end);
    if (segmentRestriction) return;

    const startMinutes = toMinutes(start);
    const selectedStartMinutes = toMinutes(startTime);

    // 이미 선택된 시작 시간이 있고 클릭한 구간이 이어질 수 있으면 종료 시간을 확장/축소합니다.
    if (
      startTime &&
      selectedStartMinutes !== null &&
      startMinutes !== null &&
      startMinutes >= selectedStartMinutes &&
      canExtendSelectionTo(end)
    ) {
      onSelect(startTime, end);
      return;
    }

    // 새 구간을 누르면 기본으로 한 칸을 바로 선택합니다.
    onSelect(start, end);
  }

  const guideText = !startTime
    ? `원하는 시간 막대를 누르세요. 한 칸은 ${slotMinutes}분입니다.`
    : endTime
    ? `${startTime} ~ ${endTime} 선택됨`
    : `${startTime} 선택됨 - 종료 구간을 선택하세요`;

  if (segments.length === 0) {
    return (
      <p className="rounded-lg bg-gray-50 px-3 py-3 text-center text-sm text-gray-500">
        선택 가능한 시간이 없습니다.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium text-[#1B5E20]">{guideText}</p>
        {(startTime || endTime) && (
          <button
            type="button"
            onClick={() => onSelect("", "")}
            className="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-medium text-gray-500 transition-colors hover:border-[#1B5E20] hover:text-[#1B5E20]"
          >
            다시 선택
          </button>
        )}
      </div>

      <div className="overflow-x-auto pb-2">
        <div className="min-w-max">
          <div className="flex overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            {segments.map(({ start, end }) => {
              const disabledReason = getSegmentRestriction(start, end) ?? undefined;
              const isDisabled = Boolean(disabledReason);
              const startMinutes = toMinutes(start);
              const endMinutes = toMinutes(end);
              const selectedStartMinutes = toMinutes(startTime);
              const selectedEndMinutes = toMinutes(endTime);
              const isSelected =
                selectedStartMinutes !== null &&
                selectedEndMinutes !== null &&
                startMinutes !== null &&
                endMinutes !== null &&
                startMinutes >= selectedStartMinutes &&
                endMinutes <= selectedEndMinutes;
              const isBooked = bookedSlots.has(start);
              const tooltip = renderDisabledTooltip
                ? renderDisabledTooltip(start, disabledReason)
                : disabledReason ?? "예약 불가";

              return (
                <div key={`${start}-${end}`} className="group relative">
                  <button
                    type="button"
                    disabled={isDisabled}
                    title={isDisabled && !renderDisabledTooltip && typeof disabledReason === "string" ? disabledReason : undefined}
                    onClick={() => handleSegmentClick(start, end)}
                    className={`flex h-14 min-w-[68px] flex-col items-center justify-center border-r border-gray-300 px-2 text-[11px] font-bold transition-colors last:border-r-0 disabled:pointer-events-none ${
                      isDisabled
                        ? isBooked
                          ? "cursor-not-allowed bg-red-100 text-red-500 line-through"
                          : "cursor-not-allowed bg-gray-100 text-gray-400"
                        : isSelected
                        ? "bg-[#1B5E20] text-white"
                        : "bg-green-50 text-green-700 hover:bg-green-100"
                    }`}
                  >
                    <span>{formatSegmentLabel(start, end)}</span>
                    <span className={`mt-1 text-[10px] font-medium ${isSelected ? "text-white/80" : "text-gray-400"}`}>
                      {isDisabled ? "불가" : "가능"}
                    </span>
                  </button>

                  {isDisabled && (
                    <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-56 -translate-x-1/2 rounded-lg bg-gray-900 px-3 py-2 text-left text-[10px] text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
                      {tooltip}
                      <div className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 text-xs text-gray-400">
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-5 rounded bg-green-50 ring-1 ring-green-200" />
          예약 가능
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-5 rounded bg-red-100" />
          예약됨
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-5 rounded bg-[#1B5E20]" />
          선택됨
        </span>
      </div>
    </div>
  );
}
