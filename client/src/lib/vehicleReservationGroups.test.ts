import { describe, expect, it } from "vitest";
import { groupVehicleReservations } from "./vehicleReservationGroups";

const base = {
  startTime: "09:00",
  endTime: "10:00",
  createdAt: "2026-07-15T01:00:00.000Z",
};

describe("groupVehicleReservations", () => {
  it("groups only rows sharing the same recurrence group id", () => {
    const groups = groupVehicleReservations([
      { ...base, id: 1, reservationDate: "2026-07-20", recurrenceGroupId: "repeat-a", recurrenceSequence: 1 },
      { ...base, id: 2, reservationDate: "2026-07-27", recurrenceGroupId: "repeat-a", recurrenceSequence: 2 },
      { ...base, id: 3, reservationDate: "2026-07-20", recurrenceGroupId: null },
    ]);

    expect(groups).toHaveLength(2);
    expect(groups.find((group) => group.groupId === "repeat-a")).toMatchObject({
      isRecurring: true,
      count: 2,
      startDate: "2026-07-20",
      endDate: "2026-07-27",
    });
    expect(groups.find((group) => group.key === "single:3")).toMatchObject({
      isRecurring: false,
      count: 1,
    });
  });

  it("sorts every occurrence chronologically and keeps all occurrence data", () => {
    const groups = groupVehicleReservations([
      { ...base, id: 12, reservationDate: "2026-08-08", recurrenceGroupId: "repeat-b", recurrenceSequence: 3, vehicleId: 2, status: "approved" },
      { ...base, id: 10, reservationDate: "2026-07-25", recurrenceGroupId: "repeat-b", recurrenceSequence: 1, vehicleId: 1, status: "pending" },
      { ...base, id: 11, reservationDate: "2026-08-01", recurrenceGroupId: "repeat-b", recurrenceSequence: 2, vehicleId: 3, status: "cancelled" },
    ]);

    expect(groups[0]?.reservations.map((row) => ({ id: row.id, vehicleId: row.vehicleId, status: row.status }))).toEqual([
      { id: 10, vehicleId: 1, status: "pending" },
      { id: 11, vehicleId: 3, status: "cancelled" },
      { id: 12, vehicleId: 2, status: "approved" },
    ]);
  });

  it("does not collapse a single row carrying a recurrence id into another booking", () => {
    const [group] = groupVehicleReservations([
      { ...base, id: 21, reservationDate: "2026-07-30", recurrenceGroupId: "remaining-one", recurrenceLabel: "매주 반복" },
    ]);

    expect(group).toMatchObject({
      key: "group:remaining-one",
      isRecurring: true,
      count: 1,
      recurrenceLabel: "매주 반복",
    });
  });
});
