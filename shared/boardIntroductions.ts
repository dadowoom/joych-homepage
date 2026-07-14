export const TESTIMONY_BOARD_DESCRIPTION_SETTING_KEY = "testimony_board_description";
export const MISSION_REPORT_BOARD_DESCRIPTION_SETTING_KEY = "mission_report_board_description";

export const TESTIMONY_BOARD_DESCRIPTION_DEFAULT =
  "생선제자훈련 수료자들이 받은 은혜와 공동체 안에서의 변화를 함께 나누는 공간입니다.";

export const MISSION_REPORT_BOARD_DESCRIPTION_DEFAULT =
  "기쁨의교회가 파송하고 후원하는 선교사님들의 현장 이야기와 기도 제목을 함께 나눕니다.";

export function getDynamicBoardDescriptionSettingKey(source: {
  menuItemId?: number;
  menuSubItemId?: number;
}) {
  if (source.menuSubItemId) {
    return `dynamic_board_description_sub_${source.menuSubItemId}`;
  }
  if (source.menuItemId) {
    return `dynamic_board_description_item_${source.menuItemId}`;
  }
  return "dynamic_board_description_unknown";
}
