import { describe, expect, it } from "vitest";
import {
  normalizePopupWriteData,
  popupLinkHrefSchema,
} from "./popups";

describe("normalizePopupWriteData", () => {
  it("clears optional popup button fields to null when edit form removes them", () => {
    const normalized = normalizePopupWriteData({
      title: "여름사역 팝업",
      imageUrl: null,
      linkLabel: null,
      linkHref: null,
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

  it.each([
    ["https://www.youtube.com/watch?v=dQw4w9WgXcQ", "https://www.youtube.com/watch?v=dQw4w9WgXcQ"],
    ["https://youtu.be/dQw4w9WgXcQ", "https://youtu.be/dQw4w9WgXcQ"],
    ["www.youtube.com/watch?v=dQw4w9WgXcQ", "https://www.youtube.com/watch?v=dQw4w9WgXcQ"],
    ["youtu.be/dQw4w9WgXcQ", "https://youtu.be/dQw4w9WgXcQ"],
    ["/worship/schedule", "/worship/schedule"],
  ])("accepts and normalizes popup links: %s", (input, expected) => {
    const result = popupLinkHrefSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe(expected);
    }
  });

  it.each([
    "javascript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "//evil.example/path",
  ])("rejects unsafe popup links: %s", input => {
    expect(popupLinkHrefSchema.safeParse(input).success).toBe(false);
  });

  it("uses a default button label when only a link was entered", () => {
    const normalized = normalizePopupWriteData({
      linkHref: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    });

    expect(normalized.linkLabel).toBe("바로가기");
    expect(normalized.linkHref).toBe(
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    );
  });
});
