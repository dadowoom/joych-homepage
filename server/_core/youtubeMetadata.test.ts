import { describe, expect, it, vi } from "vitest";
import {
  extractYoutubeWatchPageMetadata,
  fetchYoutubeVideoMetadata,
  YoutubeMetadataLookupError,
} from "./youtubeMetadata";

const WATCH_PAGE = `
  <meta itemprop="name" content="주일예배 &amp; 말씀">
  <meta itemprop="datePublished" content="2026-07-31T10:00:00+09:00">
  <script>var player = {"videoDetails":{"title":"주일예배 말씀","author":"기쁨의교회","shortDescription":"은혜로운 말씀\\n다시 보기"},"publishDate":"2026-07-31T10:00:00+09:00"};</script>
`;

describe("YouTube metadata", () => {
  it("extracts the public title, upload date, description, and channel from a watch page", () => {
    expect(extractYoutubeWatchPageMetadata(WATCH_PAGE)).toEqual({
      title: "주일예배 & 말씀",
      description: "은혜로운 말씀\n다시 보기",
      channelTitle: "기쁨의교회",
      publishedDate: "2026-07-31",
    });
  });

  it("uses oEmbed title and channel when the watch page lacks metadata", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("/oembed?")) {
        return new Response(JSON.stringify({ title: "유튜브 제목", author_name: "기쁨의교회" }), { status: 200 });
      }
      return new Response("<html>restricted</html>", { status: 200 });
    }) as unknown as typeof fetch;

    await expect(fetchYoutubeVideoMetadata("https://youtu.be/dQw4w9WgXcQ", fetchMock)).resolves.toEqual({
      videoId: "dQw4w9WgXcQ",
      title: "유튜브 제목",
      description: null,
      publishedDate: null,
      channelTitle: "기쁨의교회",
      thumbnailUrl: "https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
    });
  });

  it("rejects a non-YouTube URL without making an outbound request", async () => {
    const fetchMock = vi.fn() as unknown as typeof fetch;
    await expect(fetchYoutubeVideoMetadata("https://example.com/video", fetchMock)).rejects.toBeInstanceOf(YoutubeMetadataLookupError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
