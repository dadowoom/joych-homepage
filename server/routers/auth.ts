/**
 * 인증 라우터 (auth)
 * ─────────────────────────────────────────────────────────────────────────────
 * 담당 기능:
 *   - me: 현재 로그인한 사용자 정보 조회
 *   - logout: 로그아웃 (세션 쿠키 삭제)
 *   - adminLogin: 관리자 전용 ID/PW 로그인
 *
 * 주의: 성도(교인) 로그인은 members 라우터(members.ts)에서 별도 관리합니다.
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { getSessionCookieOptions } from "../_core/cookies";
import { publicProcedure, router } from "../_core/trpc";
import { sdk } from "../_core/sdk";
import * as db from "../db";

export const authRouter = router({
  /**
   * 현재 로그인한 사용자 정보 반환
   * 로그인하지 않은 경우 null 반환
   */
  me: publicProcedure.query((opts) => opts.ctx.user),

  /**
   * 로그아웃
   * 세션 쿠키를 삭제하여 로그아웃 처리
   */
  logout: publicProcedure.mutation(({ ctx }) => {
    const cookieOptions = getSessionCookieOptions(ctx.req);
    ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
    return { success: true } as const;
  }),

  /**
   * 관리자 전용 ID/PW 로그인
   * Manus OAuth와 별개로 동작하는 자체 관리자 인증 방식
   * 인증 성공 시 세션 쿠키를 발급하고 사용자 정보를 반환
   */
  adminLogin: publicProcedure
    .input(z.object({ username: z.string(), password: z.string() }))
    .mutation(async ({ input, ctx }) => {
      // ── 관리자 자격증명 검증 ──────────────────────────────────────────────
      const ADMIN_USERNAME = "joyfulchurch";
      const ADMIN_PASSWORD = "joyfulchurch1!";
      const ADMIN_OPEN_ID = "admin_joyfulchurch";

      if (input.username !== ADMIN_USERNAME || input.password !== ADMIN_PASSWORD) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "아이디 또는 비밀번호가 올바르지 않습니다.",
        });
      }

      // ── 관리자 계정이 DB에 없으면 최초 1회 생성 ─────────────────────────
      let user = await db.getUserByOpenId(ADMIN_OPEN_ID);
      if (!user) {
        await db.upsertUser({
          openId: ADMIN_OPEN_ID,
          name: "기쁨의교회 관리자",
          email: null,
          loginMethod: "password",
          lastSignedIn: new Date(),
        });
        await db.setUserRole(ADMIN_OPEN_ID, "admin");
        user = await db.getUserByOpenId(ADMIN_OPEN_ID);
      }

      // ── 마지막 로그인 시간 갱신 ──────────────────────────────────────────
      await db.upsertUser({ openId: ADMIN_OPEN_ID, lastSignedIn: new Date() });

      // ── 세션 토큰 발급 및 쿠키 설정 ─────────────────────────────────────
      const sessionToken = await sdk.signSession(
        { openId: ADMIN_OPEN_ID, appId: "admin", name: "관리자" },
        { expiresInMs: ONE_YEAR_MS }
      );
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.cookie(COOKIE_NAME, sessionToken, {
        ...cookieOptions,
        maxAge: ONE_YEAR_MS,
      });

      return { success: true, user };
    }),
});
