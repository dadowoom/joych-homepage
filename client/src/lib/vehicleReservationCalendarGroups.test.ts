import { describe, expect, it } from "vitest";

import { resolveVehicleReservationCalendarGroup } from "./vehicleReservationCalendarGroups";

describe("resolveVehicleReservationCalendarGroup", () => {
  it.each(["교역자", "교육부교역자", "부교역자", "담임목사", "교육 전도사", "강도사"])(
    "%s 직분은 교역자로 표시한다",
    position => {
      expect(resolveVehicleReservationCalendarGroup(position).label).toBe("교역자");
    },
  );

  it.each(["집사", "안수집사", "장로", "권사", "성도", "청년", "협력사역자", "선교사", "관리자", ""])(
    "%s 직분은 관리자로 표시한다",
    position => {
      expect(resolveVehicleReservationCalendarGroup(position).label).toBe("관리자");
    },
  );

  it("직분이 없는 예약도 관리자로 표시한다", () => {
    expect(resolveVehicleReservationCalendarGroup(null).label).toBe("관리자");
  });

  it("교역자와 관리자의 달력 색상을 서로 다르게 제공한다", () => {
    const clergy = resolveVehicleReservationCalendarGroup("교역자");
    const administrator = resolveVehicleReservationCalendarGroup("집사");

    expect(clergy.badgeClassName).not.toBe(administrator.badgeClassName);
    expect(clergy.swatchClassName).not.toBe(administrator.swatchClassName);
  });
});
