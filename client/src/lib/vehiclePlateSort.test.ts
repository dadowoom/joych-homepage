import { describe, expect, it } from "vitest";
import { sortVehiclePlateRows } from "./vehiclePlateSort";

describe("vehicle plate sorting", () => {
  it("sorts the current vehicle list by plate number using numeric order", () => {
    const rows = [
      { id: 3, plateNumber: "201하 7461", name: "스타리아" },
      { id: 1, plateNumber: "201하6967", name: "스타렉스" },
      { id: 2, plateNumber: "201하 6968", name: "스타리아" },
    ];

    expect(sortVehiclePlateRows(rows).map((row) => row.id)).toEqual([1, 2, 3]);
    expect(rows.map((row) => row.id)).toEqual([3, 1, 2]);
  });

  it("automatically reflects changed and newly added plate numbers", () => {
    const currentRows = [
      { id: 1, plateNumber: "201하 7461", name: "기존 차량" },
      { id: 2, plateNumber: "201하 6966", name: "번호 변경 차량" },
      { id: 3, plateNumber: "201하 7000", name: "추가 차량" },
    ];

    expect(sortVehiclePlateRows(currentRows).map((row) => row.id)).toEqual([2, 3, 1]);
  });

  it("keeps reservations for the same vehicle chronological and places missing plates last", () => {
    const rows = [
      { id: 4, vehicleId: 4, plateNumber: null, vehicleName: "미등록", startTime: "08:00" },
      { id: 2, vehicleId: 1, plateNumber: "201하 6967", vehicleName: "스타렉스", startTime: "14:00" },
      { id: 1, vehicleId: 1, plateNumber: "201하 6967", vehicleName: "스타렉스", startTime: "09:00" },
      { id: 3, vehicleId: 3, plateNumber: "201하 7461", vehicleName: "스타리아", startTime: "07:00" },
    ];

    expect(sortVehiclePlateRows(rows).map((row) => row.id)).toEqual([1, 2, 3, 4]);
  });
});
