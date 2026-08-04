export type AdminNotificationSummaryItem = {
  id: string;
  groupKey: string;
  label: string;
  title: string;
  meta: string;
  createdAt: Date;
  recurrenceGroupId?: string | null;
  recurrenceLabel?: string | null;
  recurrenceCount?: number | null;
  recurrenceTarget?: string | null;
};

const RECURRING_RESERVATION_GROUP_KEYS = new Set([
  "reservationPending",
  "vehicleReservationPending",
]);

function isNewer(left: Date, right: Date) {
  return left.getTime() > right.getTime();
}

/**
 * Keep dashboard alert totals based on individual pending reservations, while
 * displaying each recurring facility or vehicle reservation as one list row.
 */
export function collapseRecurringDashboardNotificationItems<
  T extends AdminNotificationSummaryItem,
>(items: T[]): T[] {
  const result: T[] = [];
  const recurringItems = new Map<string, T>();

  for (const item of items) {
    const recurrenceGroupId = item.recurrenceGroupId?.trim();
    if (
      !recurrenceGroupId ||
      !RECURRING_RESERVATION_GROUP_KEYS.has(item.groupKey)
    ) {
      result.push(item);
      continue;
    }

    const recurringKey = `${item.groupKey}:${recurrenceGroupId}`;
    const existing = recurringItems.get(recurringKey);
    if (existing && !isNewer(item.createdAt, existing.createdAt)) {
      continue;
    }

    const occurrenceCount = Math.max(1, Number(item.recurrenceCount ?? 1));
    const target = item.recurrenceTarget?.trim() || item.title;
    const recurrenceLabel = item.recurrenceLabel?.trim() || "반복 일정";
    const isVehicle = item.groupKey === "vehicleReservationPending";
    const summary = {
      ...item,
      id: `${item.groupKey}:recurrence:${recurrenceGroupId}`,
      label: isVehicle ? "반복 차량 예약" : "반복 시설 예약",
      title: `${target} · ${occurrenceCount}건 반복 예약`,
      meta: [item.meta, recurrenceLabel].filter(Boolean).join(" · "),
    } as T;

    if (existing) {
      const resultIndex = result.indexOf(existing);
      if (resultIndex >= 0) result[resultIndex] = summary;
    } else {
      result.push(summary);
    }
    recurringItems.set(recurringKey, summary);
  }

  return result;
}

/**
 * Collapse recurring reservations before applying the dashboard detail-list
 * limit so one series cannot push unrelated notifications out of the list.
 */
export function selectLatestDashboardNotificationItems<
  T extends AdminNotificationSummaryItem,
>(items: T[], limit: number): T[] {
  return collapseRecurringDashboardNotificationItems(items)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, Math.max(0, limit));
}
