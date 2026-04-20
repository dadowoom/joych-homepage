/**
 * 라우터 진입점 (하위 호환성 유지용)
 * ─────────────────────────────────────────────────────────────────────────────
 * 이 파일은 server/_core/index.ts에서 "../routers"로 import할 때 사용됩니다.
 * 실제 라우터 구현은 server/routers/ 폴더를 참고하세요:
 *
 *   routers/auth.ts       → 로그인/로그아웃
 *   routers/home.ts       → 홈페이지 공개 데이터
 *   routers/cms/          → 관리자 CMS (공지, 메뉴, 시설, 예약, 블록 에디터)
 *   routers/members.ts    → 교회 성도 회원 시스템
 *   routers/youtube.ts    → 예배영상 관리
 *   routers/index.ts      → 전체 통합
 */

export { appRouter } from "./routers/index";
export type { AppRouter } from "./routers/index";
