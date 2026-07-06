import { describe, expect, it } from "vitest";
import { normalizePopupWriteData } from "./popups";

describe("normalizePopupWriteData", () => {
  it("clears optional popup button fields to null when edit form removes them", () => {
    const normalized = normalizePopupWriteData({
      title: "여름사역 팝업",
      imageUrl: undefined,
      linkLabel: undefined,
      linkHref: undefined,
      audience: "all" as const,
      isActive: true,
      isDismissible: true,
      dismissPeriodHours: 24,
      priority: 10,
      sizePercent: 100,
      startAt: null,
      endAt: null,
    });

    expect(normalized.imageUrl).toBeNull();
    expect(normalized.linkLabel).toBeNull();
    expect(normalized.linkHref).toBeNull();
  });

  it("does not null out unrelated toggle-only updates", () => {
    const normalized = normalizePopupWriteData({
      isActive: false,
    });

    expect(normalized.isActive).toBe(false);
    expect("imageUrl" in normalized).toBe(false);
    expect("linkLabel" in normalized).toBe(false);
    expect("linkHref" in normalized).toBe(false);
  });
});
