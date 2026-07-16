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

export const MEMBER_APPROVAL_PERMISSION_KEY = "content:memberApprovals";

export const SUPPORT_REQUEST_ADMIN_PERMISSION_KEYS = [
  SUPPORT_REQUEST_ROOT_PERMISSION_KEY,
  ...Object.values(SUPPORT_REQUEST_PERMISSION_KEYS),
];

export const STATIC_ADMIN_PERMISSIONS: AdminPermissionDefinition[] = [
  { key: "content:youtube", label: "예배영상 관리", group: "콘텐츠/노출 관리", tab: "youtube", description: "영상 등록, 수정, 노출/숨김을 관리합니다." },
  { key: "content:bulletins", label: "주보 관리", group: "콘텐츠/노출 관리", tab: "bulletins", description: "주보 파일 등록, 수정, 공개/숨김을 관리합니다." },
  { key: "content:testimonies", label: "생명 간증 관리", group: "콘텐츠/노출 관리", tab: "testimonies", description: "간증 글과 댓글의 공개/숨김/삭제 상태를 관리합니다." },
  { key: "content:history", label: "교회연혁 관리", group: "콘텐츠/노출 관리", tab: "history", description: "교회연혁 등록, 수정, 노출/숨김을 관리합니다." },
  { key: "content:pastorBooks", label: "담임목사 저서 관리", group: "콘텐츠/노출 관리", tab: "pastorBooks", description: "담임목사 저서 등록, 본문 편집, 대표 이미지를 관리합니다." },
  { key: "content:gallery", label: "갤러리/사진 관리", group: "콘텐츠/노출 관리", description: "갤러리 사진과 앨범의 등록, 수정, 노출/숨김을 관리합니다." },
  { key: "content:notices", label: "공지사항 관리", group: "콘텐츠/노출 관리", description: "공지사항 작성, 수정, 게시/숨김을 관리합니다." },
  { key: SUPPORT_REQUEST_PERMISSION_KEYS.bulletinAds, label: "주보 광고신청 관리", group: "접수/예약 관리", tab: "supportRequests", description: "주보 광고 신청 접수 확인 및 처리를 관리합니다." },
  { key: SUPPORT_REQUEST_PERMISSION_KEYS.subtitles, label: "자막 신청 관리", group: "접수/예약 관리", tab: "supportRequests", description: "예배 자막 신청 접수 확인 및 처리를 관리합니다." },
  { key: SUPPORT_REQUEST_PERMISSION_KEYS.visits, label: "탐방신청 관리", group: "접수/예약 관리", tab: "supportRequests", description: "교회 탐방 신청 접수 확인 및 처리를 관리합니다." },
  { key: "content:courses", label: "강좌 관리", group: "접수/예약 관리", tab: "courses", description: "강좌 등록, 수정, 수강 신청을 관리합니다." },
  { key: "content:reservations", label: "예약 승인/예외 예약", group: "접수/예약 관리", tab: "reservations", description: "시설예약 승인, 예외 예약, 예약 시간 수정을 관리합니다." },
  { key: "content:facilities", label: "시설 관리", group: "접수/예약 관리", tab: "facilities", description: "시설 정보, 운영 시간, 외부인 공개를 관리합니다." },
  { key: "content:vehicles", label: "차량예약 관리", group: "차량예약", tab: "vehicles", description: "개별 성도에게 차량예약 이용, 신청, 승인/관리 권한을 부여합니다." },
  { key: "content:missionReports", label: "선교보고 관리", group: "성도/사역 관리", tab: "missionReports", description: "선교보고 작성, 수정, 공개/숨김을 관리합니다." },
  { key: MEMBER_APPROVAL_PERMISSION_KEY, label: "회원가입 승인 관리", group: "성도/사역 관리", tab: "members", description: "전체 성도 교적부 조회·수정, 신규 가입 승인/거절, 탈퇴 보관을 관리합니다." },
  { key: "content:pushBroadcast", label: "푸시 발송 관리", group: "성도/사역 관리", tab: "pushBroadcast", description: "전체 성도 또는 직분/구역/부서/개별 성도에게 푸시 알림을 발송합니다." },
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
