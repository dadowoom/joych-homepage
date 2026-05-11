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
import crypto from "node:crypto";
import { TRPCError } from "@trpc/server";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { getSessionCookieOptions } from "../_core/cookies";
import { publicProcedure, router } from "../_core/trpc";
import { sdk } from "../_core/sdk";
import { ENV } from "../_core/env";
import * as db from "../db";
import { checkRateLimit, recordFailure, resetFailures, getClientIp } from "../_core/rateLimiter";

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

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
   *
   * 자격증명은 환경변수(ADMIN_USERNAME, ADMIN_PASSWORD, ADMIN_OPEN_ID)에서 로드됩니다.
   * 외부 서버 이전 시 반드시 해당 환경변수를 설정해야 합니다.
   */
   adminLogin: publicProcedure
    .input(z.object({
      username: z.string().trim().min(1, "아이디를 입력해주세요."),
      password: z.string().min(1, "비밀번호를 입력해주세요."),
    }))
    .mutation(async ({ input, ctx }) => {
      // ── Rate Limit: IP 및 계정 기준 실패 횟수 제한 ───────────────────────
      const clientIp = getClientIp(ctx.req);
      const ipKey = `ip:${clientIp}`;
      const accountKey = `account:${input.username}`;
      try {
        checkRateLimit(ipKey);
        checkRateLimit(accountKey);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "로그인 시도가 너무 많습니다.";
        throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: msg });
      }
      // ── 관리자 자격증명 검증 (환경변수에서 로드) ──────────────────────────
      const ADMIN_USERNAME = ENV.adminUsername;
      const ADMIN_PASSWORD = ENV.adminPassword;
      const ADMIN_OPEN_ID = ENV.adminOpenId;
      if (!ADMIN_USERNAME || !ADMIN_PASSWORD || !ADMIN_OPEN_ID) {
        throw new TRPCError({
          code: "SERVICE_UNAVAILABLE",
          message: "관리자 로그인이 설정되지 않았습니다. 서버 환경변수를 확인해주세요.",
        });
      }
      if (!safeEqual(input.username, ADMIN_USERNAME) || !safeEqual(input.password, ADMIN_PASSWORD)) {
        recordFailure(ipKey);
        recordFailure(accountKey);
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "아이디 또는 비밀번호가 올바르지 않습니다.",
        });
      }
      // 로그인 성공 시 실패 기록 초기화
      resetFailures(ipKey);
      resetFailures(accountKey);

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
