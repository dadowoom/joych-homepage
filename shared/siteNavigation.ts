export type InternalPageOption = {
  label: string;
  path: string;
};

export type InternalPageGroup = {
  group: string;
  pages: InternalPageOption[];
};

export type FallbackNavItem = {
  label: string;
  sub: string[];
  subHref: Record<string, string>;
};

export const INTERNAL_PAGES: InternalPageGroup[] = [
  {
    group: "교회소개",
    pages: [
      { label: "담임목사 인사", path: "/about/pastor" },
      { label: "교회 역사", path: "/about/history" },
      { label: "교회 비전", path: "/about/vision" },
      { label: "섬기는 분", path: "/about/staff" },
      { label: "교회백서", path: "/about/whitebook" },
      { label: "사역원리", path: "/about/principle" },
      { label: "CI", path: "/about/ci" },
      { label: "셔틀버스", path: "/about/shuttle" },
      { label: "오시는 길", path: "/about/directions" },
    ],
  },
  {
    group: "조이풀TV",
    pages: [
      { label: "조이풀TV 메인", path: "/worship/tv" },
      { label: "주일예배", path: "/worship/tv/sunday" },
      { label: "헤브론 수요예배", path: "/worship/tv/hebron" },
      { label: "쉐키나 금요기도회", path: "/worship/tv/shekhinah" },
      { label: "새벽 글로리아 성서학당", path: "/worship/tv/gloria" },
      { label: "박진석 목사 시리즈설교", path: "/worship/tv/pastor-series" },
      { label: "하영인 새벽기도회 설교", path: "/worship/tv/hayoungin" },
      { label: "특별예배", path: "/worship/tv/special" },
      { label: "특집", path: "/worship/tv/feature" },
      { label: "간증", path: "/worship/tv/testimony" },
      { label: "찬양", path: "/worship/tv/praise" },
      { label: "예배 안내", path: "/worship/schedule" },
      { label: "주보", path: "/worship/bulletin" },
    ],
  },
  {
    group: "양육/훈련",
    pages: [
      { label: "새가족 교육", path: "/education/new-member" },
      { label: "제자훈련 기본", path: "/education/disciple" },
      { label: "성경공부", path: "/education/bible" },
      { label: "헤세드아시아포재팬", path: "/education/hesed" },
      { label: "제자훈련", path: "/education/disciple2" },
      { label: "순장 훈련", path: "/education/elder" },
      { label: "일대일 양육", path: "/education/one-on-one" },
      { label: "순세움학교", path: "/education/sunseumschool" },
      { label: "생선 컨퍼런스", path: "/education/saengseon" },
      { label: "세계선교", path: "/ministry/world-mission" },
      { label: "전도", path: "/ministry/evangelism" },
      { label: "기도사역", path: "/ministry/prayer" },
      { label: "복지사역", path: "/ministry/welfare" },
      { label: "비전대학교", path: "/ministry/vision-univ" },
      { label: "조이랩", path: "/ministry/joylab" },
    ],
  },
  {
    group: "교회학교",
    pages: [
      { label: "영아/유아부", path: "/school/infant" },
      { label: "유치부", path: "/school/kinder" },
      { label: "초등부", path: "/school/elementary" },
      { label: "중고등부", path: "/school/youth" },
      { label: "AWANA", path: "/school/awana" },
      { label: "청년부", path: "/school/young-adult" },
    ],
  },
  { group: "선교보고", pages: [{ label: "선교보고 목록", path: "/mission" }] },
  {
    group: "커뮤니티",
    pages: [
      { label: "교회 소식", path: "/community/news" },
      { label: "기도 요청", path: "/community/prayer" },
      { label: "순모임", path: "/community/soon" },
      { label: "자치기관", path: "/community/organization" },
      { label: "동호회", path: "/community/club" },
      { label: "사진", path: "/community/photo" },
      { label: "기쁨톡", path: "/community/joytalk" },
    ],
  },
  {
    group: "행정지원",
    pages: [
      { label: "헌금 안내", path: "/admin/offering" },
      { label: "차량 운행", path: "/admin/vehicle" },
      { label: "새가족 안내", path: "/admin/new-member" },
      { label: "주보", path: "/worship/bulletin" },
      { label: "자막 신청", path: "/admin/subtitle" },
      { label: "온라인사무국", path: "/admin/office" },
      { label: "탐방신청", path: "/admin/tour" },
      { label: "조이플스토어", path: "/admin/store" },
      { label: "기부금 영수증", path: "/admin/donation" },
      { label: "시설 예약", path: "/facility" },
    ],
  },
];

export const FALLBACK_NAV_ITEMS: FallbackNavItem[] = [
  {
    label: "교회소개",
    sub: [
      "담임목사 소개",
      "예배안내",
      "섬기는 분",
      "교회백서",
      "사역원리",
      "CI",
      "시설물 안내",
      "오시는 길",
      "셔틀버스",
    ],
    subHref: {
      "담임목사 소개": "/about/pastor",
      예배안내: "/worship/schedule",
      "섬기는 분": "/about/staff",
      교회백서: "/about/whitebook",
      사역원리: "/about/principle",
      CI: "/about/ci",
      "시설물 안내": "/facility",
      "오시는 길": "/about/directions",
      셔틀버스: "/about/shuttle",
    },
  },
  {
    label: "조이풀TV",
    sub: [
      "실시간 예배영상",
      "주일예배",
      "헤브론 수요예배",
      "쉐키나 금요기도회",
      "새벽 글로리아 성서학당",
      "박진석 목사 시리즈설교",
      "하영인 새벽기도회 설교",
      "특별예배",
      "특집",
      "간증",
      "찬양",
    ],
    subHref: {
      "실시간 예배영상": "/worship/tv",
      주일예배: "/worship/tv/sunday",
      "헤브론 수요예배": "/worship/tv/hebron",
      "쉐키나 금요기도회": "/worship/tv/shekhinah",
      "새벽 글로리아 성서학당": "/worship/tv/gloria",
      "박진석 목사 시리즈설교": "/worship/tv/pastor-series",
      "하영인 새벽기도회 설교": "/worship/tv/hayoungin",
      특별예배: "/worship/tv/special",
      특집: "/worship/tv/feature",
      간증: "/worship/tv/testimony",
      찬양: "/worship/tv/praise",
    },
  },
  {
    label: "양육/훈련",
    sub: [
      "헤세드아시아포재팬",
      "제자훈련",
      "장로훈련",
      "일대일 양육",
      "선생님학교",
      "생선 컨퍼런스",
      "세계선교",
      "전도",
      "기도사역",
      "복지사역",
      "비전대학교",
      "조이랩",
    ],
    subHref: {
      헤세드아시아포재팬: "/education/hesed",
      제자훈련: "/education/disciple2",
      장로훈련: "/education/elder",
      "일대일 양육": "/education/one-on-one",
      선생님학교: "/education/sunseumschool",
      "생선 컨퍼런스": "/education/saengseon",
      세계선교: "/ministry/world-mission",
      전도: "/ministry/evangelism",
      기도사역: "/ministry/prayer",
      복지사역: "/ministry/welfare",
      비전대학교: "/ministry/vision-univ",
      조이랩: "/ministry/joylab",
    },
  },
  {
    label: "교회학교",
    sub: [
      "영아부",
      "유아부",
      "유치부",
      "초등부",
      "중고등부",
      "청년부",
      "AWANA",
    ],
    subHref: {
      영아부: "/school/infant",
      유아부: "/school/infant",
      유치부: "/school/kinder",
      초등부: "/school/elementary",
      중고등부: "/school/youth",
      청년부: "/school/young-adult",
      AWANA: "/school/awana",
    },
  },
  {
    label: "선교보고",
    sub: ["선교보고 목록"],
    subHref: {
      "선교보고 목록": "/mission",
    },
  },
  {
    label: "커뮤니티",
    sub: [
      "순모임",
      "자치기관",
      "동호회",
      "사진",
      "기쁨톡",
      "HOT NEWS",
      "공지사항",
    ],
    subHref: {
      순모임: "/community/soon",
      자치기관: "/community/organization",
      동호회: "/community/club",
      사진: "/community/photo",
      기쁨톡: "/community/joytalk",
      "HOT NEWS": "/community/news",
      공지사항: "/community/news",
    },
  },
  {
    label: "행정지원",
    sub: [
      "주보",
      "자막 신청",
      "온라인사무국",
      "탐방신청",
      "조이풀빌리지",
      "기부금 영수증",
    ],
    subHref: {
      주보: "/worship/bulletin",
      "자막 신청": "/admin/subtitle",
      온라인사무국: "/admin/office",
      탐방신청: "/admin/tour",
      조이풀빌리지: "/admin/store",
      "기부금 영수증": "/admin/donation",
    },
  },
];

export function toFallbackMenuTree() {
  return FALLBACK_NAV_ITEMS.map((item, index) => ({
    id: index + 1,
    label: item.label,
    href: null,
    items: item.sub.map((label, subIndex) => ({
      id: subIndex + 1,
      label,
      href: item.subHref[label] ?? null,
      subItems: [],
    })),
  }));
}

export function getInternalPagePaths() {
  return INTERNAL_PAGES.flatMap(group => group.pages.map(page => page.path));
}
