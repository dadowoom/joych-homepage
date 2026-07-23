import { describe, expect, it } from "vitest";
import { getChurchPhotoUpstreamUrl } from "./churchPhoto";

describe("getChurchPhotoUpstreamUrl", () => {
  it("maps a valid photo path to the fixed HTTP church photo server", () => {
    expect(
      getChurchPhotoUpstreamUrl("photo/2026/0621/11.jpg")?.toString(),
    ).toBe("http://photo.joych.org/photo/2026/0621/11.jpg");
  });

  it("supports the image formats allowed by the editor", () => {
    for (const extension of ["jpg", "jpeg", "png", "gif", "webp"]) {
      expect(
        getChurchPhotoUpstreamUrl(`photo/2026/0621/image.${extension}`),
      ).not.toBeNull();
    }
  });

  it.each([
    "",
    "other/2026/0621/11.jpg",
    "photo/../secret.jpg",
    "photo/%2e%2e/secret.jpg",
    "photo/2026/0621/11.svg",
    "photo/2026/0621/11.jpg?target=http://example.com",
    "photo/2026/0621/11.jpg%00.png",
  ])("rejects unsafe or unsupported path %s", path => {
    expect(getChurchPhotoUpstreamUrl(path)).toBeNull();
  });
});
