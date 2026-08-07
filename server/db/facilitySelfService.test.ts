import { describe, expect, it } from "vitest";
import { getExternalReservationSelfUpdateValues } from "./facility";

describe("external facility reservation self-service update values", () => {
  it("returns an edited reservation to pending and clears all prior admin processing", () => {
    expect(getExternalReservationSelfUpdateValues({
      reservationDate: "2026-08-20",
      startTime: "13:00",
      endTime: "15:00",
      purpose: "  외부 단체 모임  ",
      department: "  협력 기관  ",
      attendees: 12,
    })).toEqual({
      reservationDate: "2026-08-20",
      startTime: "13:00",
      endTime: "15:00",
      purpose: "외부 단체 모임",
      department: "협력 기관",
      attendees: 12,
      status: "pending",
      adminComment: null,
      processedBy: null,
      processedAt: null,
    });
  });

  it("preserves existing notes when the self-service form does not submit notes", () => {
    const values = getExternalReservationSelfUpdateValues({
      reservationDate: "2026-08-20",
      startTime: "13:00",
      endTime: "15:00",
      purpose: "외부 단체 모임",
      attendees: 12,
    });

    expect(values).not.toHaveProperty("notes");
  });
});
