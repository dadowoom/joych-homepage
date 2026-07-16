import { describe, expect, it } from "vitest";
import {
  normalizeReservationRepeatType,
  RESERVATION_REPEAT_OPTIONS,
} from "@shared/reservationRecurrence";

describe("reservation recurrence options", () => {
  it("keeps facility and vehicle repeat labels on one canonical option list", () => {
    expect(RESERVATION_REPEAT_OPTIONS).toEqual([
      { value: "none", label: "반복 없음" },
      { value: "daily", label: "매일" },
      { value: "weekly", label: "매주" },
      { value: "monthly-weekday", label: "매월 같은 주" },
    ]);
  });

  it("maps the legacy vehicle monthly value to the facility monthly-weekday rule", () => {
    expect(normalizeReservationRepeatType("monthly")).toBe("monthly-weekday");
    expect(normalizeReservationRepeatType("monthly-weekday")).toBe("monthly-weekday");
  });
});
