import { beforeEach, describe, expect, it, vi } from "vitest";

const dndMocks = vi.hoisted(() => ({
  closestCenter: vi.fn(),
  pointerWithin: vi.fn(),
}));

vi.mock("@dnd-kit/core", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@dnd-kit/core")>()),
  closestCenter: dndMocks.closestCenter,
  pointerWithin: dndMocks.pointerWithin,
}));

import { pointerThenClosestCenter } from "./MenuEditPanel";

describe("menu editor collision detection", () => {
  beforeEach(() => {
    dndMocks.closestCenter.mockReset();
    dndMocks.pointerWithin.mockReset();
  });

  it("uses the exact pointer target for left and right parent chips", () => {
    const pointerCollisions = [{ id: "menu-target:1" }];
    dndMocks.pointerWithin.mockReturnValue(pointerCollisions);

    expect(pointerThenClosestCenter({} as never)).toBe(pointerCollisions);
    expect(dndMocks.closestCenter).not.toHaveBeenCalled();
  });

  it("falls back to center detection for keyboard dragging", () => {
    const centerCollisions = [{ id: "menu:2" }];
    dndMocks.pointerWithin.mockReturnValue([]);
    dndMocks.closestCenter.mockReturnValue(centerCollisions);

    expect(pointerThenClosestCenter({} as never)).toBe(centerCollisions);
    expect(dndMocks.closestCenter).toHaveBeenCalledTimes(1);
  });
});
