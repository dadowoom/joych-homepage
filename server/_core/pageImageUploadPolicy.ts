import { isLargePageImageTarget } from "@shared/pageImageUploadPolicy";
import { getMenuItemById, getMenuSubItemById } from "../db/menu";

export type PageImageUploadTarget = {
  menuItemId?: number;
  menuSubItemId?: number;
};

/** 서버 DB에 존재하는 실제 메뉴인지 확인한 뒤 10MB 허용 대상을 판별합니다. */
export async function isLargePageImageUploadTarget(target: PageImageUploadTarget) {
  if (target.menuSubItemId) {
    const subItem = await getMenuSubItemById(target.menuSubItemId);
    return Boolean(subItem && isLargePageImageTarget({ menuSubItemId: subItem.id }));
  }

  if (target.menuItemId) {
    const item = await getMenuItemById(target.menuItemId);
    return Boolean(item && isLargePageImageTarget({ menuItemId: item.id }));
  }

  return false;
}
