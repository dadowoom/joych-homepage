export type AdminPermissionDefinition = {
  key: string;
  label: string;
  group: string;
  description?: string;
  tab?: string;
};

export const STATIC_ADMIN_PERMISSIONS: AdminPermissionDefinition[] = [
  { key: "content:youtube", label: "예배영상 관리", group: "콘텐츠/노출 관리", tab: "youtube" },
  { key: "content:bulletins", label: "주보 관리", group: "콘텐츠/노출 관리", tab: "bulletins" },
  { key: "content:testimonies", label: "생명 간증 관리", group: "콘텐츠/노출 관리", tab: "testimonies" },
  { key: "content:freeBoard", label: "자유게시판 관리", group: "콘텐츠/노출 관리", tab: "freeBoard" },
  { key: "content:popups", label: "팝업 관리", group: "콘텐츠/노출 관리", tab: "popups" },
  { key: "content:gallery", label: "갤러리/사진 관리", group: "콘텐츠/노출 관리" },
  { key: "content:notices", label: "공지사항 관리", group: "콘텐츠/노출 관리" },
  { key: "content:supportRequests", label: "접수 관리", group: "접수/예약 관리", tab: "supportRequests" },
  { key: "content:courses", label: "강좌 관리", group: "접수/예약 관리", tab: "courses" },
  { key: "content:reservations", label: "예약 승인", group: "접수/예약 관리", tab: "reservations" },
  { key: "content:facilities", label: "시설 관리", group: "접수/예약 관리", tab: "facilities" },
  { key: "content:missionReports", label: "선교보고 관리", group: "성도/사역 관리", tab: "missionReports" },
];

export const ADMIN_TAB_PERMISSION_KEYS: Record<string, string> = Object.fromEntries(
  STATIC_ADMIN_PERMISSIONS
    .filter((permission) => permission.tab)
    .map((permission) => [permission.tab!, permission.key]),
);
