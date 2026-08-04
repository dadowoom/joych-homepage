import { describe, expect, it } from "vitest";
import {
  getNextSlideOffset,
  paginateVideoList,
  resolveActiveYoutubeVideo,
  shouldFetchFocusedYoutubeVideo,
} from "./YoutubeListPage";

describe("paginateVideoList", () => {
  const videos = Array.from({ length: 63 }, (_, index) => ({ id: index + 1 }));

  it("선택한 20개 페이지에 속한 영상만 반환한다", () => {
    const result = paginateVideoList(videos, 20, 2);

    expect(result.totalPages).toBe(4);
    expect(result.activePage).toBe(2);
    expect(result.pageStart).toBe(20);
    expect(result.pageVideos.map(video => video.id)).toEqual(
      Array.from({ length: 20 }, (_, index) => index + 21)
    );
  });

  it.each([
    [50, 2, 13, 51],
    [100, 1, 63, 1],
  ])(
    "%i개 보기에서도 한 페이지 분량만 반환한다",
    (pageSize, page, expectedCount, firstId) => {
      const result = paginateVideoList(videos, pageSize, page);

      expect(result.pageVideos).toHaveLength(expectedCount);
      expect(result.pageVideos[0]?.id).toBe(firstId);
    }
  );

  it("범위를 벗어난 페이지는 마지막 페이지로 보정한다", () => {
    const result = paginateVideoList(videos, 20, 99);

    expect(result.activePage).toBe(4);
    expect(result.pageVideos.map(video => video.id)).toEqual([61, 62, 63]);
  });

  it("썸네일 슬라이드는 현재 페이지의 마지막 카드 뒤로 넘어가지 않는다", () => {
    expect(getNextSlideOffset(15, 20, 4)).toBe(16);
    expect(getNextSlideOffset(16, 20, 4)).toBe(16);
    expect(getNextSlideOffset(0, 3, 4)).toBe(0);
  });

  it("선택 ID는 갱신된 서버 응답 객체에서 다시 찾아 최신 정보를 표시한다", () => {
    const staleVideo = { id: 2, title: "수정 전 제목" };
    const updatedPageVideos = [{ id: 2, title: "수정 후 제목" }];

    expect(resolveActiveYoutubeVideo(staleVideo.id, updatedPageVideos, null)).toBe(
      updatedPageVideos[0],
    );
  });

  it("현재 페이지 밖의 선택 영상은 서버가 별도로 반환한 focusedVideo를 사용한다", () => {
    const focusedVideo = { id: 42, title: "직접 연 영상" };

    expect(resolveActiveYoutubeVideo(42, [{ id: 1, title: "첫 영상" }], focusedVideo)).toBe(
      focusedVideo,
    );
    expect(resolveActiveYoutubeVideo(99, [{ id: 1, title: "첫 영상" }], focusedVideo)).toBeNull();
  });

  it("같은 페이지 카드 선택은 단일 영상 추가 조회도 요청하지 않는다", () => {
    const pageVideos = [{ id: 1 }, { id: 2 }, { id: 3 }];

    expect(shouldFetchFocusedYoutubeVideo(2, pageVideos)).toBe(false);
    expect(shouldFetchFocusedYoutubeVideo(42, pageVideos)).toBe(true);
    expect(shouldFetchFocusedYoutubeVideo(null, pageVideos)).toBe(false);
  });
});
