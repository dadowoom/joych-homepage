import { describe, expect, it } from "vitest";
import { orderStaffRowsByTarget } from "./db/staff";

const rows = Array.from({ length: 10 }, (_, index) => ({
  id: index + 1,
  sortOrder: index + 1,
}));

describe("staff sort ordering", () => {
  it("places the edited member at the requested position and shifts the rest back", () => {
    const ordered = orderStaffRowsByTarget(rows, 10, 2);

    expect(ordered.map((row) => row.id)).toEqual([1, 10, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it("moves a member down and closes the previous gap", () => {
    const ordered = orderStaffRowsByTarget(rows, 2, 10);

    expect(ordered.map((row) => row.id)).toEqual([1, 3, 4, 5, 6, 7, 8, 9, 10, 2]);
  });

  it("uses the next available position when no valid order is supplied", () => {
    const ordered = orderStaffRowsByTarget(rows, 4, 0);

    expect(ordered.map((row) => row.id)).toEqual([1, 2, 3, 5, 6, 7, 8, 9, 10, 4]);
  });
});
