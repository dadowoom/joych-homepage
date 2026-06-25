export type AdminPermissionDefinition = {
  key: string;
  label: string;
  group: string;
  description?: string;
  tab?: string;
};

export const SUPPORT_REQUEST_ROOT_PERMISSION_KEY = "content:supportRequests";

export const SUPPORT_REQUEST_PERMISSION_KEYS = {
  bulletinAds: "content:supportRequests:bulletinAds",
  subtitles: "content:supportRequests:subtitles",
  visits: "content:supportRequests:visits",
  prayers: "content:supportRequests:prayers",
  newMembers: "content:supportRequests:newMembers",
} as const;

export type SupportRequestPermissionKind = keyof typeof SUPPORT_REQUEST_PERMISSION_KEYS;

export const SUPPORT_REQUEST_ADMIN_PERMISSION_KEYS = [
  SUPPORT_REQUEST_ROOT_PERMISSION_KEY,
  ...Object.values(SUPPORT_REQUEST_PERMISSION_KEYS),
];

export const STATIC_ADMIN_PERMISSIONS: AdminPermissionDefinition[] = [
  { key: "content:youtube", label: "예배영상 관리", group: "콘텐츠/노출 관리", tab: "youtube" },
  { key: "content:bulletins", label: "주보 관리", group: "콘텐츠/노출 관리", tab: "bulletins" },
  { key: "content:testimonies", label: "생명 간증 관리", group: "콘텐츠/노출 관리", tab: "testimonies" },
  { key: "content:freeBoard", label: "자유게시판 관리", group: "콘텐츠/노출 관리", tab: "freeBoard" },
  { key: "content:popups", label: "팝업 관리", group: "콘텐츠/노출 관리", tab: "popups" },
  { key: "content:history", label: "교회연혁 관리", group: "콘텐츠/노출 관리", tab: "history" },
  { key: "content:gallery", label: "갤러리/사진 관리", group: "콘텐츠/노출 관리" },
  { key: "content:notices", label: "공지사항 관리", group: "콘텐츠/노출 관리" },
  { key: SUPPORT_REQUEST_ROOT_PERMISSION_KEY, label: "접수 관리 전체", group: "접수/예약 관리", tab: "supportRequests" },
  { key: SUPPORT_REQUEST_PERMISSION_KEYS.bulletinAds, label: "주보 광고신청 관리", group: "접수/예약 관리", tab: "supportRequests" },
  { key: SUPPORT_REQUEST_PERMISSION_KEYS.subtitles, label: "자막 신청 관리", group: "접수/예약 관리", tab: "supportRequests" },
  { key: SUPPORT_REQUEST_PERMISSION_KEYS.visits, label: "탐방신청 관리", group: "접수/예약 관리", tab: "supportRequests" },
  { key: SUPPORT_REQUEST_PERMISSION_KEYS.prayers, label: "기도 요청 관리", group: "접수/예약 관리", tab: "supportRequests" },
  { key: SUPPORT_REQUEST_PERMISSION_KEYS.newMembers, label: "새가족 문의 관리", group: "접수/예약 관리", tab: "supportRequests" },
  { key: "content:courses", label: "강좌 관리", group: "접수/예약 관리", tab: "courses" },
  { key: "content:reservations", label: "예약 승인/예외 예약", group: "접수/예약 관리", tab: "reservations", description: "시설예약 승인, 예외 예약, 예약 시간 수정을 관리합니다." },
  { key: "content:facilities", label: "시설 관리", group: "접수/예약 관리", tab: "facilities" },
  { key: "content:vehicles", label: "차량예약 관리", group: "차량예약", tab: "vehicles", description: "개별 성도에게 차량예약 이용, 신청, 승인/관리 권한을 부여합니다." },
  { key: "content:missionReports", label: "선교보고 관리", group: "성도/사역 관리", tab: "missionReports" },
];

export const ADMIN_TAB_PERMISSION_KEYS: Record<string, string> = STATIC_ADMIN_PERMISSIONS
  .filter((permission) => permission.tab)
  .reduce<Record<string, string>>((keys, permission) => {
    keys[permission.tab!] ??= permission.key;
    return keys;
  }, {});

export const ADMIN_TAB_PERMISSION_KEY_GROUPS: Record<string, string[]> = STATIC_ADMIN_PERMISSIONS
  .filter((permission) => permission.tab)
  .reduce<Record<string, string[]>>((groups, permission) => {
    const tab = permission.tab!;
    groups[tab] = [...(groups[tab] ?? []), permission.key];
    return groups;
  }, {});
