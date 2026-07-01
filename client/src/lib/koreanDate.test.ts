import { describe, expect, it } from "vitest";
import {
  formatKoreanDateKey,
  formatKoreanDateTime,
  formatKoreanDateTimeText,
  formatKoreanNumericDateKey,
  getDateKeyDayOfWeek,
  parseDateKey,
} from "./koreanDate";

describe("korean date helpers", () => {
  it("formats date keys without relying on the local browser timezone", () => {
    expect(parseDateKey("2026-07-02")).toEqual({
      year: 2026,
      month: 7,
      day: 2,
      dayOfWeek: 4,
    });
    expect(getDateKeyDayOfWeek("2026-07-02")).toBe(4);
    expect(formatKoreanDateKey("2026-07-02")).toBe("2026년 7월 2일 (목)");
    expect(formatKoreanNumericDateKey("2026-07-02")).toBe("2026. 07. 02.");
  });

  it("rejects impossible date keys", () => {
    expect(parseDateKey("2026-02-29")).toBeNull();
    expect(getDateKeyDayOfWeek("2026-02-29")).toBe(-1);
    expect(formatKoreanDateKey("2026-02-29")).toBe("2026-02-29");
  });

  it("formats timestamps in Korea time", () => {
    expect(formatKoreanDateTime(new Date("2026-07-01T06:02:38.000Z"))).toContain("오후 03:02");
  });

  it("formats database timestamp text without adding another timezone offset", () => {
    expect(formatKoreanDateTimeText("2026-07-01 15:30:00")).toBe("7월 1일 오후 03:30");
    expect(formatKoreanDateTimeText("2026-07-01T00:30:00")).toBe("7월 1일 오전 12:30");
  });
});
