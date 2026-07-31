import { describe, expect, it } from "vitest";
import {
  getCanonicalPublicMenuHref,
  getCanonicalPublicMenuPath,
  PUBLIC_MENU_PATHS,
} from "./publicMenuRoutes";

describe("public menu Korean canonical routes", () => {
  it.each([
    ["조이풀TV", "헤브론 수요예배", "/worship/tv/hebron", PUBLIC_MENU_PATHS.hebronWorship],
    ["커뮤니티", "은혜의 간증", "https://newjoych.co.kr/community/testimony", PUBLIC_MENU_PATHS.testimony],
    ["커뮤니티", "선교 소식", "https://newjoych.co.kr/mission", PUBLIC_MENU_PATHS.mission],
    ["행정지원", "기부금 영수증", "https://joychdonate.dimode.co.kr/support/donation_01.asp", PUBLIC_MENU_PATHS.donationReceipt],
    ["강좌", "조이아카데미", "/education/courses", PUBLIC_MENU_PATHS.academy],
    [undefined, "시설 사용 예약", "https://newjoych.co.kr/facility", PUBLIC_MENU_PATHS.facility],
    [undefined, "사이트맵", "https://newjoych.co.kr/sitemap", PUBLIC_MENU_PATHS.sitemap],
  ])("maps %s > %s", (parentLabel, label, href, expected) => {
    expect(getCanonicalPublicMenuHref(label, href, parentLabel)).toBe(expected);
  });

  it("keeps legacy English addresses compatible", () => {
    expect(getCanonicalPublicMenuPath("/about/pastor/books")).toBe(PUBLIC_MENU_PATHS.pastorBooks);
    expect(getCanonicalPublicMenuPath("/worship/schedule")).toBe(PUBLIC_MENU_PATHS.worshipSchedule);
    expect(getCanonicalPublicMenuPath("/facility/external")).toBe(PUBLIC_MENU_PATHS.externalFacility);
  });
});
