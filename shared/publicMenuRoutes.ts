import { isSiteHostname } from "./siteHosts";

/**
 * 공개 메뉴에서 사용하는 한글 기준 주소입니다.
 *
 * 이 주소는 이용자가 보는 주소창, 메뉴, 메인 바로가기에서 공통으로 사용합니다.
 * 이전 영문 주소는 PUBLIC_MENU_ROUTE_ALIASES에만 남겨, 기존 즐겨찾이와 검색
 * 결과가 끊기지 않도록 새 주소로 연결합니다.
 */
export const PUBLIC_MENU_PATHS = {
  pastorGreeting: "/page/교회소개-위임목사-소개-위임목사-인사",
  pastorBooks: "/page/교회소개-위임목사-소개-위임목사-저서",
  staff: "/page/교회소개-섬기는-사람들",
  shuttleTimetable: "/page/교회소개-셔틀버스-차량시간표",
  directions: "/page/교회소개-오시는-길",
  churchHistory: "/page/교회소개-교회-연혁",
  worshipSchedule: "/page/교회소개-예배-안내",
  sundaySermon: "/page/조이풀tv-주일설교",
  hebronWorship: "/page/조이풀tv-헤브론-수요예배",
  fridayWorship: "/page/조이풀tv-금요-경배의-용사들",
  praiseShalom: "/page/조이풀tv-찬양-샬롬-찬양대",
  praiseHosanna: "/page/조이풀tv-찬양-주일-2부-호산나-찬양대",
  praiseZion: "/page/조이풀tv-찬양-주일-3부-시온-찬양대",
  praiseSpecial: "/page/조이풀tv-찬양-예배특송",
  eventPhotos: "/page/커뮤니티-행사사진",
  testimony: "/page/커뮤니티-은혜의-간증",
  mission: "/page/커뮤니티-선교-소식",
  churchNews: "/page/행정지원-교회소식",
  bulletin: "/page/행정지원-주보-주보보기",
  bulletinAd: "/page/행정지원-주보-주보-광고신청",
  subtitleRequest: "/page/행정지원-자막신청",
  visitRequest: "/page/행정지원-탐방신청",
  onlineOffering: "/page/행정지원-온라인-헌금",
  donationReceipt: "/page/행정지원-기부금-영수증",
  academy: "/page/교육-신청-조이아카데미",
  discipleCourse: "/page/교육신청-제자반",
  leadershipCourse: "/page/교육신청-리더십반",
  saengseonConference: "/page/교육신청-생선컨퍼런스",
  facility: "/page/시설사용-예약-성도",
  externalFacility: "/page/시설-사용-예약-외부인",
  vehicleReservation: "/page/차량예약",
  sitemap: "/page/사이트맵",
} as const;

export function getPastorBookPath(id: string | number) {
  return `${PUBLIC_MENU_PATHS.pastorBooks}/${encodeURIComponent(String(id))}`;
}

export function getTestimonyPath(id: string | number) {
  return `${PUBLIC_MENU_PATHS.testimony}/${encodeURIComponent(String(id))}`;
}

export function getTestimonyWritePath() {
  return `${PUBLIC_MENU_PATHS.testimony}/글쓰기`;
}

export function getTestimonyEditPath(id: string | number) {
  return `${PUBLIC_MENU_PATHS.testimony}/${encodeURIComponent(String(id))}/수정`;
}

export function getMissionPath(id: string | number) {
  return `${PUBLIC_MENU_PATHS.mission}/${encodeURIComponent(String(id))}`;
}

export function getMissionWritePath() {
  return `${PUBLIC_MENU_PATHS.mission}/글쓰기`;
}

export function getMissionEditPath(id: string | number) {
  return `${PUBLIC_MENU_PATHS.mission}/${encodeURIComponent(String(id))}/수정`;
}

export function getBulletinPath(id: string | number) {
  return `${PUBLIC_MENU_PATHS.bulletin}/${encodeURIComponent(String(id))}`;
}

export function getAcademyCoursePath(slug: string) {
  return `${PUBLIC_MENU_PATHS.academy}/${encodeURIComponent(slug)}`;
}

export function getAcademyApplicationsPath() {
  return `${PUBLIC_MENU_PATHS.academy}/내-신청내역`;
}

export function getFacilityPath(id: string | number) {
  return `${PUBLIC_MENU_PATHS.facility}/${encodeURIComponent(String(id))}`;
}

export function getFacilityApplyPath(id: string | number) {
  return `${getFacilityPath(id)}/신청`;
}

export function getFacilityReservationsPath() {
  return `${PUBLIC_MENU_PATHS.facility}/내-예약`;
}

export function getExternalFacilityPath(id: string | number) {
  return `${PUBLIC_MENU_PATHS.externalFacility}/${encodeURIComponent(String(id))}`;
}

export function getExternalFacilityApplyPath(id: string | number) {
  return `${getExternalFacilityPath(id)}/신청`;
}

/**
 * 기준 한글 주소 -> 이전 주소(영문 및 과거 한글 변형) 목록입니다.
 * 메뉴 DB에는 이전 주소가 저장된 상태여도 조회와 권한 검사가 계속 가능해야 합니다.
 */
export const PUBLIC_MENU_ROUTE_ALIASES: Record<string, readonly string[]> = {
  [PUBLIC_MENU_PATHS.pastorGreeting]: [
    "/about/pastor",
    "/page/교회소개-담임목사-소개-담임목사인사",
  ],
  [PUBLIC_MENU_PATHS.pastorBooks]: [
    "/about/pastor/books",
    "/page/교회소개-담임목사-저서",
    "/page/교회소개-담임목사-소개-담임목사저서",
    "/page/교회소개-담임목사-소개-담임목사-저서",
    "/page/교회소개-담임목사소개-담임목사저서",
    "/page/교회소개-담임목사소개-담임목사-저서",
  ],
  [PUBLIC_MENU_PATHS.staff]: [
    "/about/staff",
    "/page/교회소개-섬기는-분",
  ],
  [PUBLIC_MENU_PATHS.shuttleTimetable]: [
    "/page/교회소개-셔틀버스-테스트1",
    "/page/교회소개-셔틀버스-차량-시간표",
  ],
  [PUBLIC_MENU_PATHS.directions]: [
    "/about/directions",
    "/page/교회소개-오시는길",
  ],
  [PUBLIC_MENU_PATHS.churchHistory]: [
    "/about/history",
    "/page/교회소개-교회역사",
    "/page/교회소개-교회-역사",
    "/page/교회소개-교회연혁",
  ],
  [PUBLIC_MENU_PATHS.worshipSchedule]: [
    "/worship/schedule",
    "/worship/schedule-beta",
    "/page/교회소개-예배안내",
  ],
  [PUBLIC_MENU_PATHS.sundaySermon]: [
    "/worship/tv/sunday",
    "/page/조이풀tv-주일예배",
  ],
  [PUBLIC_MENU_PATHS.hebronWorship]: ["/worship/tv/hebron"],
  [PUBLIC_MENU_PATHS.fridayWorship]: [
    "/worship/tv/shekhinah",
    "/page/조이풀tv-금요-경배와-용사들",
  ],
  [PUBLIC_MENU_PATHS.praiseShalom]: [
    "/page/조이풀tv-찬양-주일-1부-샬롬-찬양대",
    "/page/조이풀tv-찬양-샬롬-성가대",
  ],
  [PUBLIC_MENU_PATHS.praiseHosanna]: [
    "/page/조이풀tv-찬양-호산나-찬양대",
  ],
  [PUBLIC_MENU_PATHS.praiseZion]: [
    "/page/조이풀tv-찬양-시온-찬양대",
  ],
  [PUBLIC_MENU_PATHS.praiseSpecial]: [
    "/page/조이풀tv-찬양-특송",
  ],
  [PUBLIC_MENU_PATHS.eventPhotos]: [
    "/community/photo",
    "/page/커뮤니티-최근-행사-사진",
    "/page/커뮤니티-행사-사진",
  ],
  [PUBLIC_MENU_PATHS.testimony]: [
    "/community/testimony",
    "/page/커뮤니티-생선간증",
    "/page/커뮤니티-생선-간증",
    "/page/커뮤니티-은혜의간증",
  ],
  [PUBLIC_MENU_PATHS.mission]: [
    "/mission",
    "/page/커뮤니티-선교소식",
    "/page/사역선교-선교소식",
    "/page/사역선교-선교-소식",
    "/page/선교-선교소식",
    "/page/선교-선교-소식",
  ],
  [PUBLIC_MENU_PATHS.churchNews]: [
    "/community/news",
    "/page/행정지원-공지사항",
    "/page/행정지원-교회-소식",
  ],
  [PUBLIC_MENU_PATHS.bulletin]: [
    "/worship/bulletin",
    "/page/행정지원-주보보기",
  ],
  [PUBLIC_MENU_PATHS.bulletinAd]: [
    "/support/bulletin-ad",
    "/page/행정지원-주보-광고신청",
    "/page/행정지원-주보-주보-광고신청",
    "/page/행정지원-주보-주보광고신청",
    "/page/행정지원-주보광고신청",
    "/page/행정지원-주보광고",
  ],
  [PUBLIC_MENU_PATHS.subtitleRequest]: [
    "/support/subtitle",
    "/page/행정지원-자막",
  ],
  [PUBLIC_MENU_PATHS.visitRequest]: [
    "/support/tour",
    "/page/행정지원-탐방",
  ],
  [PUBLIC_MENU_PATHS.onlineOffering]: [
    "/page/행정지원-온라인헌금",
  ],
  [PUBLIC_MENU_PATHS.donationReceipt]: [
    "/support/donation",
    "https://joychdonate.dimode.co.kr/support/donation_01.asp",
  ],
  [PUBLIC_MENU_PATHS.academy]: ["/education/courses"],
  [PUBLIC_MENU_PATHS.discipleCourse]: ["/page/강좌-제자반", "/page/교육-신청-제자반"],
  [PUBLIC_MENU_PATHS.leadershipCourse]: ["/page/강좌-리더십반", "/page/교육-신청-리더십반"],
  [PUBLIC_MENU_PATHS.saengseonConference]: ["/page/강좌-생선컨퍼런스", "/page/교육-신청-생선컨퍼런스"],
  [PUBLIC_MENU_PATHS.facility]: [
    "/facility",
    "/page/시설-사용-예약",
    "/page/시설-사용-예약-성도",
    "/page/시설사용예약",
    "/page/시설사용-예약",
  ],
  [PUBLIC_MENU_PATHS.externalFacility]: ["/facility/external"],
  [PUBLIC_MENU_PATHS.vehicleReservation]: ["/support/vehicle", "/admin/vehicle"],
  [PUBLIC_MENU_PATHS.sitemap]: ["/sitemap"],
};

function decodePath(path: string) {
  try {
    return decodeURIComponent(path);
  } catch {
    return path;
  }
}

export function normalizePublicMenuHref(href: string | null | undefined) {
  const trimmed = (href ?? "").trim();
  if (!trimmed) return "";

  if (!/^https?:\/\//i.test(trimmed)) return decodePath(trimmed);

  try {
    const url = new URL(trimmed);
    if (isSiteHostname(url.hostname)) {
      return decodePath(`${url.pathname}${url.search}${url.hash}`);
    }
  } catch {
    return decodePath(trimmed);
  }

  return decodePath(trimmed);
}

export function getCanonicalPublicMenuPath(href: string | null | undefined) {
  const normalized = normalizePublicMenuHref(href);
  if (!normalized) return null;

  for (const [canonical, aliases] of Object.entries(PUBLIC_MENU_ROUTE_ALIASES)) {
    if (normalized === canonical || aliases.some(alias => normalizePublicMenuHref(alias) === normalized)) {
      return canonical;
    }
  }
  return normalized;
}

export function getPublicMenuHrefCandidates(href: string | null | undefined) {
  const normalized = normalizePublicMenuHref(href);
  const canonical = getCanonicalPublicMenuPath(normalized);
  if (!canonical) return [];

  const aliases = PUBLIC_MENU_ROUTE_ALIASES[canonical] ?? [];
  return Array.from(new Set([canonical, normalized, ...aliases.map(normalizePublicMenuHref)].filter(Boolean)));
}

function normalizeMenuLabel(label: string | null | undefined) {
  return (label ?? "").replace(/\s+/g, "").trim();
}

/** 메뉴 이름으로 영문으로 남아 있는 공개 메뉴 주소를 한글 기준 주소로 바꿉니다. */
export function getCanonicalPublicMenuHref(
  label: string | null | undefined,
  href: string | null | undefined,
  parentLabel?: string | null,
) {
  const normalizedLabel = normalizeMenuLabel(label);
  const normalizedParentLabel = normalizeMenuLabel(parentLabel);

  if (normalizedParentLabel === "교회소개" && normalizedLabel === "예배안내") {
    return PUBLIC_MENU_PATHS.worshipSchedule;
  }
  if (normalizedParentLabel === "조이풀TV" && normalizedLabel === "헤브론수요예배") {
    return PUBLIC_MENU_PATHS.hebronWorship;
  }
  if (normalizedParentLabel === "커뮤니티" && normalizedLabel === "은혜의간증") {
    return PUBLIC_MENU_PATHS.testimony;
  }
  if (normalizedParentLabel === "커뮤니티" && normalizedLabel === "선교소식") {
    return PUBLIC_MENU_PATHS.mission;
  }
  if (normalizedParentLabel === "행정지원" && normalizedLabel === "기부금영수증") {
    return PUBLIC_MENU_PATHS.donationReceipt;
  }
  if (normalizedParentLabel === "교육·신청" && normalizedLabel === "조이아카데미") {
    return PUBLIC_MENU_PATHS.academy;
  }
  if (
    normalizedLabel === "시설사용예약" ||
    (normalizedParentLabel === "시설사용예약" && normalizedLabel === "성도")
  ) {
    return PUBLIC_MENU_PATHS.facility;
  }
  if (normalizedLabel === "사이트맵") {
    return PUBLIC_MENU_PATHS.sitemap;
  }

  return getCanonicalPublicMenuPath(href);
}
