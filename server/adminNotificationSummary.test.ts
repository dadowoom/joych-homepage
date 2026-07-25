import { describe, expect, it } from "vitest";
import { collapseRecurringDashboardNotificationItems } from "./_core/adminNotificationSummary";

describe("dashboard recurring reservation notifications", () => {
  it("keeps a recurring facility reservation as one detail-list item", () => {
    const items = collapseRecurringDashboardNotificationItems([
      {
        id: "reservation:11",
        groupKey: "reservationPending",
        label: "시설 예약",
        title: "본당 2026-08-01 10:00",
        meta: "홍길동",
        createdAt: new Date("2026-07-26T01:00:00.000Z"),
        recurrenceGroupId: "facility-series-1",
        recurrenceLabel: "매주 토요일",
        recurrenceCount: 4,
        recurrenceTarget: "본당",
      },
      {
        id: "reservation:12",
        groupKey: "reservationPending",
        label: "시설 예약",
        title: "본당 2026-08-08 10:00",
        meta: "홍길동",
        createdAt: new Date("2026-07-26T02:00:00.000Z"),
        recurrenceGroupId: "facility-series-1",
        recurrenceLabel: "매주 토요일",
        recurrenceCount: 4,
        recurrenceTarget: "본당",
      },
      {
        id: "reservation:13",
        groupKey: "reservationPending",
        label: "시설 예약",
        title: "교육관 2026-08-03 14:00",
        meta: "김성도",
        createdAt: new Date("2026-07-26T03:00:00.000Z"),
      },
    ]);

    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      id: "reservationPending:recurrence:facility-series-1",
      label: "반복 시설 예약",
      title: "본당 · 4건 반복 예약",
      meta: "홍길동 · 매주 토요일",
      createdAt: new Date("2026-07-26T02:00:00.000Z"),
    });
    expect(items[1]?.id).toBe("reservation:13");
  });

  it("does not merge facility and vehicle series that share an ID", () => {
    const items = collapseRecurringDashboardNotificationItems([
      {
        id: "reservation:21",
        groupKey: "reservationPending",
        label: "시설 예약",
        title: "본당 2026-08-01 10:00",
        meta: "홍길동",
        createdAt: new Date("2026-07-26T01:00:00.000Z"),
        recurrenceGroupId: "shared-series",
        recurrenceCount: 2,
        recurrenceTarget: "본당",
      },
      {
        id: "vehicleReservation:31",
        groupKey: "vehicleReservationPending",
        label: "차량 예약",
        title: "카니발 2026-08-01 10:00",
        meta: "홍길동",
        createdAt: new Date("2026-07-26T01:00:00.000Z"),
        recurrenceGroupId: "shared-series",
        recurrenceCount: 2,
        recurrenceTarget: "카니발",
      },
    ]);

    expect(items).toHaveLength(2);
    expect(items.map(item => item.label)).toEqual([
      "반복 시설 예약",
      "반복 차량 예약",
    ]);
  });
});
