/**
 * 라우터 통합 (AppRouter)
 * ─────────────────────────────────────────────────────────────────────────────
 * 모든 하위 라우터를 하나로 묶어 내보냅니다.
 * 이 파일만 보면 전체 API 구조를 한눈에 파악할 수 있습니다.
 *
 * API 구조:
 *   auth.*      → 로그인/로그아웃 (Manus OAuth)
 *   system.*    → 시스템 알림 (오너 알림 등)
 *   home.*      → 홈페이지 공개 데이터 (메뉴, 슬라이드, 공지 등)
 *   cms.*       → 관리자 CMS (공지, 메뉴, 시설, 예약, 블록 에디터)
 *   members.*   → 교회 성도 회원 시스템 (가입, 로그인, 교적부)
 *   youtube.*   → 예배영상 관리 (플레이리스트, 영상)
 *   mission.*   → 선교보고 공개 조회 및 작성자 기능
 */

import { router } from "../_core/trpc";
import { systemRouter } from "../_core/systemRouter";
import { authRouter } from "./auth";
import { homeRouter } from "./home";
import { cmsRouter } from "./cms/index";
import { membersRouter } from "./members";
import { youtubeRouter } from "./youtube";
import { missionRouter } from "./mission";

export const appRouter = router({
  auth: authRouter,
  system: systemRouter,
  home: homeRouter,
  cms: cmsRouter,
  members: membersRouter,
  youtube: youtubeRouter,
  mission: missionRouter,
});

/** tRPC 타입 추론에 사용 — 클라이언트에서 import해서 사용 */
export type AppRouter = typeof appRouter;
