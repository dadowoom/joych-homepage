/**
 * DB 함수 통합 내보내기 (server/db/index.ts)
 * ─────────────────────────────────────────────────────────────────────────────
 * 이 파일은 server/db/ 폴더의 모든 DB 함수를 한 곳에서 내보냅니다.
 * 기존 server/db.ts를 이 파일로 교체하면 기존 import 경로가 그대로 동작합니다.
 *
 * 파일 구조:
 *   connection.ts  - DB 연결 공통 모듈 (getDb)
 *   user.ts        - 사용자 DB 함수
 *   notice.ts      - 공지사항 DB 함수
 *   content.ts     - 슬라이드/갤러리/관련기관/퀵메뉴/설정 DB 함수
 *   menu.ts        - 메뉴 DB 함수
 *   facility.ts    - 시설 예약 DB 함수
 *   member.ts      - 교회 회원(교적부) DB 함수
 *   blocks.ts      - 블록 에디터 DB 함수
 *   youtube.ts     - 예배영상/플레이리스트 DB 함수
 *   mission.ts     - 선교보고/작성권한 DB 함수
 */

export * from "./connection";
export * from "./user";
export * from "./notice";
export * from "./content";
export * from "./menu";
export * from "./facility";
export * from "./member";
export * from "./blocks";
export * from "./youtube";
export * from "./mission";
