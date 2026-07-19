import { afterEach, describe, expect, it, vi } from "vitest";
import { getPlayableSrc } from "./DirectVideoPlayer";

describe("getPlayableSrc", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("moves a saved newjoych legacy API URL onto the visitor's current domain", () => {
    vi.stubGlobal("window", {
      location: {
        origin: "https://www.joych.org",
        href: "https://www.joych.org/page/hebron",
      },
    });

    expect(
      getPlayableSrc("https://newjoych.co.kr/api/legacy-vod/423/12484/237.mp4"),
    ).toBe("/api/legacy-vod/423/12484/237.mp4");
  });

  it("routes the HTTP sermon source through the same-origin direct video proxy", () => {
    vi.stubGlobal("window", {
      location: {
        origin: "https://www.joych.org",
        href: "https://www.joych.org/page/shalom",
      },
    });

    expect(
      getPlayableSrc("http://sermon.joych.org/mp4/hymn/260621_hymn1.mp4"),
    ).toBe("https://www.joych.org/api/direct-video/mp4/hymn/260621_hymn1.mp4");
  });
});
