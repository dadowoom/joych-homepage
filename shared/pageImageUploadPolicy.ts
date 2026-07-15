const LARGE_PAGE_IMAGE_MENU_ITEM_IDS = new Set([
  180015, // 예배 안내
  180009, // 3대 비전 9대 전략
  180002, // 셔틀버스
  120006, // 시설물 안내
]);

const LARGE_PAGE_IMAGE_MENU_SUB_ITEM_IDS = new Set([
  60006, // 위임목사 인사
  150022, // 셔틀버스 > 차량 시간표
  150003, // 시설물 안내 > 하영인관
  150004, // 시설물 안내 > 기쁨의복지관
]);

export type PageImageTargetIds = {
  menuItemId?: number | null;
  menuSubItemId?: number | null;
};

/** 메뉴명을 바꿔도 정책이 유지되도록 실제 운영 페이지의 고정 ID로 판별합니다. */
export function isLargePageImageTarget({
  menuItemId,
  menuSubItemId,
}: PageImageTargetIds) {
  return Boolean(
    (menuItemId && LARGE_PAGE_IMAGE_MENU_ITEM_IDS.has(menuItemId))
      || (menuSubItemId && LARGE_PAGE_IMAGE_MENU_SUB_ITEM_IDS.has(menuSubItemId))
  );
}
