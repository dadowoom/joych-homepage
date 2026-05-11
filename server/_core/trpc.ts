import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";
import { getMemberById } from "../db/member";
import { getJwtSecretKey } from "./jwtSecret";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure.use(requireUser);

export const adminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user || ctx.user.role !== 'admin') {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);

/**
 * memberProtectedProcedure
 * 성도 로그인(church_member_session 쿠키) 기반 보호 프로시저.
 * Manus OAuth와 완전히 독립적으로 동작합니다.
 * ctx.memberId: number (church_members.id)
 * ctx.memberName: string
 *
 * [보안] status === 'approved' 인 성도만 접근 허용
 * pending / rejected / withdrawn / inactive 성도는 FORBIDDEN 오류 반환
 */
export const memberProtectedProcedure = t.procedure.use(
  t.middleware(async ({ ctx, next }) => {
    const token = ctx.req.cookies?.['church_member_session'];
    if (!token) {
      throw new TRPCError({ code: 'UNAUTHORIZED', message: '로그인이 필요합니다.' });
    }
    try {
      const { jwtVerify } = await import('jose');
      const secret = getJwtSecretKey();
      const { payload } = await jwtVerify(token, secret);
      if (payload.type !== 'church_member' || !payload.memberId) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: '유효하지 않은 로그인 정보입니다.' });
      }

      // ── 성도 상태 검증: approved 성도만 접근 허용 ────────────────────────
      const member = await getMemberById(payload.memberId as number);
      if (!member) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: '존재하지 않는 성도 계정입니다.' });
      }
      if (member.status !== 'approved') {
        const statusMsg: Record<string, string> = {
          pending: '아직 승인 대기 중입니다. 관리자 승인 후 이용 가능합니다.',
          rejected: '가입이 거절된 계정입니다. 담당자에게 문의해 주세요.',
          withdrawn: '탈퇴한 계정입니다.',
          inactive: '비활성화된 계정입니다. 담당자에게 문의해 주세요.',
        };
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: statusMsg[member.status] ?? '이용 권한이 없습니다.',
        });
      }

      return next({
        ctx: {
          ...ctx,
          memberId: payload.memberId as number,
          memberName: payload.name as string,
        },
      });
    } catch (e) {
      if (e instanceof TRPCError) throw e;
      throw new TRPCError({ code: 'UNAUTHORIZED', message: '로그인이 만료되었습니다. 다시 로그인해 주세요.' });
    }
  }),
);
