import { describe, expect, it } from "vitest";
import { getNextSlideOffset, paginateVideoList } from "./YoutubeListPage";

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
});
