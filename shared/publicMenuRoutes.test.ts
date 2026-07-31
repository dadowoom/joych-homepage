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

  it.each([
    ["/page/교회소개-담임목사-소개-담임목사인사", PUBLIC_MENU_PATHS.pastorGreeting],
    ["/page/교회소개-담임목사-소개-담임목사저서", PUBLIC_MENU_PATHS.pastorBooks],
    ["/page/교회소개-섬기는-분", PUBLIC_MENU_PATHS.staff],
    ["/page/교회소개-셔틀버스-테스트1", PUBLIC_MENU_PATHS.shuttleTimetable],
    ["/page/교회소개-오시는길", PUBLIC_MENU_PATHS.directions],
    ["/page/조이풀tv-주일예배", PUBLIC_MENU_PATHS.sundaySermon],
    ["/page/조이풀tv-금요-경배와-용사들", PUBLIC_MENU_PATHS.fridayWorship],
    ["/page/조이풀tv-찬양-샬롬-성가대", PUBLIC_MENU_PATHS.praiseShalom],
    ["/page/조이풀tv-찬양-호산나-찬양대", PUBLIC_MENU_PATHS.praiseHosanna],
    ["/page/조이풀tv-찬양-시온-찬양대", PUBLIC_MENU_PATHS.praiseZion],
    ["/page/조이풀tv-찬양-특송", PUBLIC_MENU_PATHS.praiseSpecial],
    ["/page/커뮤니티-최근-행사-사진", PUBLIC_MENU_PATHS.eventPhotos],
    ["/page/행정지원-공지사항", PUBLIC_MENU_PATHS.churchNews],
    ["/page/행정지원-주보-광고신청", PUBLIC_MENU_PATHS.bulletinAd],
    ["/page/행정지원-온라인헌금", PUBLIC_MENU_PATHS.onlineOffering],
    ["/page/강좌-제자반", PUBLIC_MENU_PATHS.discipleCourse],
    ["/page/강좌-리더십반", PUBLIC_MENU_PATHS.leadershipCourse],
    ["/page/강좌-생선컨퍼런스", PUBLIC_MENU_PATHS.saengseonConference],
    ["/page/시설-사용-예약", PUBLIC_MENU_PATHS.facility],
  ])("maps an old menu address %s to %s", (oldPath, expectedPath) => {
    expect(getCanonicalPublicMenuPath(oldPath)).toBe(expectedPath);
  });

  it.each([
    ["/page/교회소개-셔틀버스-차량-시간표", PUBLIC_MENU_PATHS.shuttleTimetable],
    ["/page/조이풀tv-찬양-주일-1부-샬롬-찬양대", PUBLIC_MENU_PATHS.praiseShalom],
    ["/page/커뮤니티-행사-사진", PUBLIC_MENU_PATHS.eventPhotos],
    ["/page/행정지원-교회-소식", PUBLIC_MENU_PATHS.churchNews],
    ["/page/교육-신청-제자반", PUBLIC_MENU_PATHS.discipleCourse],
    ["/page/교육-신청-리더십반", PUBLIC_MENU_PATHS.leadershipCourse],
    ["/page/교육-신청-생선컨퍼런스", PUBLIC_MENU_PATHS.saengseonConference],
    ["/page/시설-사용-예약-성도", PUBLIC_MENU_PATHS.facility],
    ["/support/vehicle", PUBLIC_MENU_PATHS.vehicleReservation],
  ])("moves the previous canonical address %s to the requested address", (oldPath, expectedPath) => {
    expect(getCanonicalPublicMenuPath(oldPath)).toBe(expectedPath);
  });
});
