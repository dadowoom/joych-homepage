import { beforeEach, describe, expect, it, vi } from "vitest";

const menuMocks = vi.hoisted(() => ({
  getMenuItemById: vi.fn(),
  getMenuSubItemById: vi.fn(),
}));

vi.mock("./db/menu", () => menuMocks);

import { isLargePageImageUploadTarget } from "./_core/pageImageUploadPolicy";

describe("page image upload size policy", () => {
  beforeEach(() => {
    menuMocks.getMenuItemById.mockReset();
    menuMocks.getMenuSubItemById.mockReset();
  });

  it.each([
    [180015, "예배 안내"],
    [180009, "3대 비전 9대 전략"],
    [180002, "셔틀버스"],
    [120006, "시설물 안내"],
  ])("지정된 2단 메뉴 %s(%s)는 이름을 바꿔도 10MB 대상이다", async (id) => {
    menuMocks.getMenuItemById.mockResolvedValue({ id, label: "변경된 이름" });

    await expect(isLargePageImageUploadTarget({ menuItemId: id })).resolves.toBe(true);
  });

  it.each([
    [60006, "위임목사 인사"],
    [150022, "셔틀버스 차량 시간표"],
    [150003, "시설물 안내 하영인관"],
    [150004, "시설물 안내 기쁨의복지관"],
  ])("지정된 3단 메뉴 %s(%s)는 이름을 바꿔도 10MB 대상이다", async (id) => {
    menuMocks.getMenuSubItemById.mockResolvedValue({
      id,
      menuItemId: 120006,
      label: "변경된 이름",
    });

    await expect(isLargePageImageUploadTarget({ menuSubItemId: id })).resolves.toBe(true);
  });

  it("같은 이름이어도 요청 범위 밖의 메뉴는 기존 1MB 정책을 유지한다", async () => {
    menuMocks.getMenuItemById.mockResolvedValue({ id: 99, label: "예배 안내" });

    await expect(isLargePageImageUploadTarget({ menuItemId: 99 })).resolves.toBe(false);
  });
});
