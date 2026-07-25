import { describe, expect, it } from "vitest";
import { isUpcomingReservationOccurrence } from "../shared/reservationSchedule";

describe("recurring reservation future occurrence guard", () => {
  const now = new Date("2026-07-26T02:30:00.000Z"); // KST 2026-07-26 11:30

  it("keeps completed and in-progress occurrences out of a bulk time edit", () => {
    expect(
      isUpcomingReservationOccurrence(
        { reservationDate: "2026-07-25", startTime: "18:00" },
        now,
      ),
    ).toBe(false);
    expect(
      isUpcomingReservationOccurrence(
        { reservationDate: "2026-07-26", startTime: "11:30" },
        now,
      ),
    ).toBe(false);
  });

  it("keeps later occurrences today and on future dates eligible for a bulk edit", () => {
    expect(
      isUpcomingReservationOccurrence(
        { reservationDate: "2026-07-26", startTime: "11:31" },
        now,
      ),
    ).toBe(true);
    expect(
      isUpcomingReservationOccurrence(
        { reservationDate: "2026-07-27", startTime: "09:00" },
        now,
      ),
    ).toBe(true);
  });
});
