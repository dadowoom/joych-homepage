import { describe, expect, it } from "vitest";
import { isSafeAssetUrl, safeAssetUrlSchema } from "./contentValidation";

describe("church photo proxy asset validation", () => {
  it.each(["jpg", "jpeg", "png", "gif", "webp"])(
    "allows a safe same-origin church photo %s path",
    extension => {
      const path = `/api/church-photo/photo/2026/0621/image.${extension}`;
      expect(isSafeAssetUrl(path)).toBe(true);
      expect(safeAssetUrlSchema.safeParse(path).success).toBe(true);
    },
  );

  it("allows encoded non-ASCII path segments", () => {
    const path =
      "/api/church-photo/photo/2026/%EC%84%B1%EC%B0%AC%EC%8B%9D/1.jpg";
    expect(isSafeAssetUrl(path)).toBe(true);
  });

  it.each([
    "/api/church-photo/photo/2026/0621/1.jpg?download=1",
    "/api/church-photo/photo/2026/0621/1.jpg#preview",
    "/api/church-photo/photo/2026\\0621\\1.jpg",
    "/api/church-photo/photo/2026/../secret.jpg",
    "/api/church-photo/photo/2026/%2e%2e/secret.jpg",
    "/api/church-photo/photo/2026/%5csecret/1.jpg",
    "/api/church-photo/photo/2026/0621/1.svg",
    "/api/church-photo/other/2026/0621/1.jpg",
    "/api/church-photo/photo//0621/1.jpg",
    "/api/church-photo/photo/1.jpg",
  ])("rejects unsafe church photo proxy path %s", path => {
    expect(isSafeAssetUrl(path)).toBe(false);
    expect(safeAssetUrlSchema.safeParse(path).success).toBe(false);
  });
});
