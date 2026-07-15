import { describe, expect, it } from "vitest";

import { buildMenuParentMoveOrder } from "./db/menu";

describe("menu parent move ordering", () => {
  it("moves a row to the target end and normalizes both parents", () => {
    const result = buildMenuParentMoveOrder(
      [
        { id: 1, sortOrder: 1 },
        { id: 2, sortOrder: 2 },
        { id: 3, sortOrder: 3 },
      ],
      [
        { id: 4, sortOrder: 1 },
        { id: 5, sortOrder: 2 },
      ],
      2,
    );

    expect(result).toEqual({
      source: [
        { id: 1, sortOrder: 1 },
        { id: 3, sortOrder: 2 },
      ],
      target: [
        { id: 4, sortOrder: 1 },
        { id: 5, sortOrder: 2 },
        { id: 2, sortOrder: 3 },
      ],
    });
  });

  it("supports moving the same row back in the opposite direction", () => {
    const first = buildMenuParentMoveOrder(
      [{ id: 1, sortOrder: 1 }, { id: 2, sortOrder: 2 }],
      [{ id: 3, sortOrder: 1 }],
      2,
    );
    expect(first).not.toBeNull();

    const movedBack = buildMenuParentMoveOrder(first!.target, first!.source, 2);

    expect(movedBack).toEqual({
      source: [{ id: 3, sortOrder: 1 }],
      target: [
        { id: 1, sortOrder: 1 },
        { id: 2, sortOrder: 2 },
      ],
    });
  });

  it("moves into an empty target without changing the row id", () => {
    const result = buildMenuParentMoveOrder(
      [{ id: 41, sortOrder: 8 }],
      [],
      41,
    );

    expect(result).toEqual({
      source: [],
      target: [{ id: 41, sortOrder: 1 }],
    });
  });

  it("normalizes gaps and duplicate orders deterministically by id", () => {
    const sourceRows = [
      { id: 30, sortOrder: 50 },
      { id: 20, sortOrder: 7 },
      { id: 10, sortOrder: 7 },
    ];
    const targetRows = [
      { id: 6, sortOrder: 99 },
      { id: 5, sortOrder: 3 },
      { id: 4, sortOrder: 3 },
    ];

    const result = buildMenuParentMoveOrder(sourceRows, targetRows, 30);

    expect(result).toEqual({
      source: [
        { id: 10, sortOrder: 1 },
        { id: 20, sortOrder: 2 },
      ],
      target: [
        { id: 4, sortOrder: 1 },
        { id: 5, sortOrder: 2 },
        { id: 6, sortOrder: 3 },
        { id: 30, sortOrder: 4 },
      ],
    });
    expect([...result!.source, ...result!.target].map((row) => row.id).sort((a, b) => a - b))
      .toEqual([4, 5, 6, 10, 20, 30]);
    expect(sourceRows).toEqual([
      { id: 30, sortOrder: 50 },
      { id: 20, sortOrder: 7 },
      { id: 10, sortOrder: 7 },
    ]);
    expect(targetRows).toEqual([
      { id: 6, sortOrder: 99 },
      { id: 5, sortOrder: 3 },
      { id: 4, sortOrder: 3 },
    ]);
  });

  it("returns null when the moved row is not in the source parent", () => {
    expect(buildMenuParentMoveOrder([{ id: 1, sortOrder: 1 }], [], 999)).toBeNull();
  });
});
