type SlotAction = "start" | "end" | "none";

export type ReservationSlotSelectionState = {
  action: SlotAction;
  isDisabled: boolean;
  disabledReason?: string;
  isBookedStart: boolean;
};

type ReservationSlotStateInput = {
  slot: string;
  allSlots: string[];
  bookedSlots: Set<string>;
  disabledSlots: Map<string, string>;
  startTime: string;
  endTime: string;
  slotMinutes: number;
  maxSlots: number;
  bookedReason?: string;
};

type EndRestrictionInput = {
  startTime: string;
  endTime: string;
  bookedSlots: Set<string>;
  disabledSlots: Map<string, string>;
  slotMinutes: number;
  maxSlots: number;
};

function toMinutes(time: string) {
  const [hour, minute] = time.split(":").map(Number);
  if ([hour, minute].some(Number.isNaN)) return null;
  return hour * 60 + minute;
}

function formatSlot(minutes: number) {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

export function generateReservationTimePoints(openTime: string, closeTime: string, unitMinutes: number) {
  const open = toMinutes(openTime);
  const close = toMinutes(closeTime);
  if (open === null || close === null || unitMinutes <= 0) return [];

  const slots: string[] = [];
  for (let current = open; current <= close; current += unitMinutes) {
    slots.push(formatSlot(current));
  }
  return slots;
}

function getStartRestriction(
  slot: string,
  allSlots: string[],
  bookedSlots: Set<string>,
  disabledSlots: Map<string, string>,
  bookedReason: string,
) {
  if (slot === allSlots[allSlots.length - 1]) return "종료 시간으로만 선택할 수 있습니다.";
  const disabledReason = disabledSlots.get(slot);
  if (disabledReason) return disabledReason;
  if (bookedSlots.has(slot)) return bookedReason;
  return null;
}

export function getReservationEndRestriction({
  startTime,
  endTime,
  bookedSlots,
  disabledSlots,
  slotMinutes,
  maxSlots,
}: EndRestrictionInput) {
  const start = toMinutes(startTime);
  const end = toMinutes(endTime);
  if (start === null || end === null) return "시간 형식이 올바르지 않습니다.";
  if (end <= start) return "종료 시간은 시작 시간 이후로 선택해 주세요.";

  const selectedSlots = (end - start) / slotMinutes;
  if (selectedSlots > maxSlots) return `최대 ${maxSlots}개 시간 단위까지만 예약할 수 있습니다.`;

  for (let current = start; current < end; current += slotMinutes) {
    const slot = formatSlot(current);
    if (bookedSlots.has(slot)) return "선택 범위에 이미 예약된 시간이 있습니다.";
    const disabledReason = disabledSlots.get(slot);
    if (disabledReason) return disabledReason;
  }
  return null;
}

export function getReservationSlotSelectionState({
  slot,
  allSlots,
  bookedSlots,
  disabledSlots,
  startTime,
  endTime,
  slotMinutes,
  maxSlots,
  bookedReason = "예약됨",
}: ReservationSlotStateInput): ReservationSlotSelectionState {
  const startRestriction = getStartRestriction(slot, allSlots, bookedSlots, disabledSlots, bookedReason);
  const isChoosingEnd = Boolean(startTime && !endTime);

  if (isChoosingEnd) {
    const endRestriction = getReservationEndRestriction({
      startTime,
      endTime: slot,
      bookedSlots,
      disabledSlots,
      slotMinutes,
      maxSlots,
    });
    if (!endRestriction) {
      return { action: "end", isDisabled: false, isBookedStart: false };
    }
    if (!startRestriction) {
      return { action: "start", isDisabled: false, isBookedStart: false };
    }
    return {
      action: "none",
      isDisabled: true,
      disabledReason: endRestriction,
      isBookedStart: bookedSlots.has(slot),
    };
  }

  return {
    action: startRestriction ? "none" : "start",
    isDisabled: Boolean(startRestriction),
    disabledReason: startRestriction ?? undefined,
    isBookedStart: bookedSlots.has(slot),
  };
}
