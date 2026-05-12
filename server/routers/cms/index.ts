/**
 * CMS 라우터 통합 (cms)
 * ─────────────────────────────────────────────────────────────────────────────
 * 관리자 대시보드에서 사용하는 모든 CMS 기능을 하나로 묶어 내보냅니다.
 *
 * 하위 라우터 구성:
 *   - notices: 공지사항 관리
 *   - content: 슬라이드, 갤러리, 관련기관, 퀵메뉴, 사이트 설정
 *   - menus: 메뉴 구조 관리 (1단/2단/3단)
 *   - upload: 파일 업로드 (S3)
 *   - facilities: 시설 관리 (사진, 운영시간, 차단날짜 포함)
 *   - reservations: 예약 관리 (승인/거절)
 *   - blocks: 블록 에디터 관리
 *   - missionReports: 선교보고/작성권한 관리
 */

import { router } from "../../_core/trpc";
import { noticesRouter } from "./notices";
import { contentRouter } from "./content";
import { menusRouter } from "./menus";
import { uploadRouter } from "./upload";
import { facilitiesRouter } from "./facilities";
import { reservationsRouter } from "./reservations";
import { blocksRouter } from "./blocks";
import { missionReportsRouter } from "./missionReports";

export const cmsRouter = router({
  notices: noticesRouter,
  content: contentRouter,
  menus: menusRouter,
  upload: uploadRouter,
  facilities: facilitiesRouter,
  reservations: reservationsRouter,
  blocks: blocksRouter,
  missionReports: missionReportsRouter,
});
