import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";

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
 */
export const memberProtectedProcedure = t.procedure.use(
  t.middleware(async ({ ctx, next }) => {
    const token = ctx.req.cookies?.['church_member_session'];
    if (!token) {
      throw new TRPCError({ code: 'UNAUTHORIZED', message: '로그인이 필요합니다.' });
    }
    try {
      const { jwtVerify } = await import('jose');
      const secret = new TextEncoder().encode(process.env.JWT_SECRET ?? 'fallback-secret');
      const { payload } = await jwtVerify(token, secret);
      if (payload.type !== 'church_member' || !payload.memberId) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: '유효하지 않은 로그인 정보입니다.' });
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
