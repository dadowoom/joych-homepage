import { afterEach, describe, expect, it, vi } from "vitest";

import { clampDockPosition } from "./HomeAdminDock";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("clampDockPosition", () => {
  it("moves a stored dock position back inside the current viewport", () => {
    vi.stubGlobal("window", {
      innerWidth: 1280,
      innerHeight: 720,
    });

    const element = {
      offsetWidth: 200,
      offsetHeight: 80,
    } as HTMLElement;

    expect(clampDockPosition({ x: 2400, y: 1600 }, element)).toEqual({
      x: 1068,
      y: 628,
    });
  });

  it("keeps an already visible position unchanged", () => {
    vi.stubGlobal("window", {
      innerWidth: 1280,
      innerHeight: 720,
    });

    expect(clampDockPosition({ x: 900, y: 500 })).toEqual({
      x: 900,
      y: 500,
    });
  });
});
