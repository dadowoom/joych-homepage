export const SUPPORT_BOARD_INTRO_DEFAULTS = {
  bulletinAds: "주보에 실릴 광고, 부서 안내, 행사 안내 요청을 접수합니다. 연락처와 첨부파일은 관리자만 확인합니다.",
  subtitles: "예배 자막, 광고, 찬양 가사 요청을 접수합니다. 첨부파일은 관리자만 확인합니다.",
  visits: "교회 방문, 기관 탐방, 사역 운영 사례 견학 요청을 접수합니다. 연락처와 이메일은 관리자만 확인합니다.",
} as const;

export type SupportBoardIntroKind = keyof typeof SUPPORT_BOARD_INTRO_DEFAULTS;

export const SUPPORT_BOARD_INTRO_SETTING_KEYS: Record<SupportBoardIntroKind, string> = {
  bulletinAds: "support_board_intro_bulletin_ads",
  subtitles: "support_board_intro_subtitles",
  visits: "support_board_intro_visits",
};
