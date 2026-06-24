import { describe, expect, it } from "vitest";
import {
  generateReservationTimePoints,
  getReservationEndRestriction,
  getReservationSlotSelectionState,
} from "./facilitySlotSelection";

describe("facility slot selection", () => {
  const allSlots = generateReservationTimePoints("09:00", "22:00", 60);
  const bookedSlots = new Set(["10:00", "11:00", "13:00", "14:00", "15:00"]);
  const disabledSlots = new Map<string, string>();

  it("keeps the close time as an end-time point, not a start-time point", () => {
    expect(allSlots[0]).toBe("09:00");
    expect(allSlots.at(-1)).toBe("22:00");

    const state = getReservationSlotSelectionState({
      slot: "22:00",
      allSlots,
      bookedSlots,
      disabledSlots,
      startTime: "",
      endTime: "",
      slotMinutes: 60,
      maxSlots: 8,
    });

    expect(state).toMatchObject({
      action: "none",
      isDisabled: true,
    });
  });

  it("allows a booked start point to be used as the previous empty range's end time", () => {
    expect(
      getReservationEndRestriction({
        startTime: "09:00",
        endTime: "10:00",
        bookedSlots,
        disabledSlots,
        slotMinutes: 60,
        maxSlots: 8,
      })
    ).toBeNull();
    expect(
      getReservationEndRestriction({
        startTime: "12:00",
        endTime: "13:00",
        bookedSlots,
        disabledSlots,
        slotMinutes: 60,
        maxSlots: 8,
      })
    ).toBeNull();
  });

  it("still blocks a range that actually crosses a reserved interval", () => {
    expect(
      getReservationEndRestriction({
        startTime: "09:00",
        endTime: "11:00",
        bookedSlots,
        disabledSlots,
        slotMinutes: 60,
        maxSlots: 8,
      })
    ).toBe("선택 범위에 이미 예약된 시간이 있습니다.");
  });

  it("lets a valid end click win over the same time being a booked start", () => {
    const state = getReservationSlotSelectionState({
      slot: "13:00",
      allSlots,
      bookedSlots,
      disabledSlots,
      startTime: "12:00",
      endTime: "",
      slotMinutes: 60,
      maxSlots: 8,
    });

    expect(state).toMatchObject({
      action: "end",
      isDisabled: false,
      isBookedStart: false,
    });
  });
});
