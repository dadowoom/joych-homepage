import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { ADMIN_SESSION_MS, COOKIE_NAME } from "@shared/const";
import { getAdminPermissionKeysForUser, getMemberById, getUserByOpenId, memberAdminOpenId } from "../db";
import { getSessionCookieOptions } from "./cookies";
import { getJwtSecretKey } from "./jwtSecret";
import {
  MEMBER_SESSION_COOKIE,
  refreshMemberSessionCookieIfNeeded,
  SESSION_REFRESH_THRESHOLD_MS,
} from "./memberSession";
import { sdk } from "./sdk";

export type TrpcUser = User & {
  contentPermissions?: string[];
  memberId?: number;
};

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: TrpcUser | null;
  memberId: number | null;
  memberName: string | null;
};

async function attachContentPermissions(user: User): Promise<TrpcUser> {
  if (user.role === "admin") {
    return { ...user, contentPermissions: [] };
  }
  const contentPermissions = await getAdminPermissionKeysForUser(user.id);
  return { ...user, contentPermissions };
}

async function authenticateMemberContentManager(
  req: CreateExpressContextOptions["req"],
): Promise<TrpcUser | null> {
  const token = req.cookies?.[MEMBER_SESSION_COOKIE];
  if (!token) return null;

  try {
    const { jwtVerify } = await import("jose");
    const { payload } = await jwtVerify(token, getJwtSecretKey());
    if (payload.type !== "church_member" || !payload.memberId) return null;

    const memberId = Number(payload.memberId);
    if (!Number.isInteger(memberId)) return null;

    const member = await getMemberById(memberId);
    if (!member || member.status !== "approved") return null;

    const linkedUser = await getUserByOpenId(memberAdminOpenId(member.id));
    if (!linkedUser) return null;

    const contentPermissions = await getAdminPermissionKeysForUser(linkedUser.id);
    if (contentPermissions.length === 0) return null;

    return { ...linkedUser, contentPermissions, memberId: member.id };
  } catch {
    return null;
  }
}

async function authenticateApprovedMember(
  req: CreateExpressContextOptions["req"],
  res: CreateExpressContextOptions["res"],
): Promise<{ memberId: number; memberName: string } | null> {
  const token = req.cookies?.[MEMBER_SESSION_COOKIE];
  if (!token) return null;

  try {
    const { jwtVerify } = await import("jose");
    const { payload } = await jwtVerify(token, getJwtSecretKey());
    if (payload.type !== "church_member" || !payload.memberId) return null;

    const memberId = Number(payload.memberId);
    if (!Number.isInteger(memberId)) return null;

    const member = await getMemberById(memberId);
    if (!member || member.status !== "approved") return null;

    await refreshMemberSessionCookieIfNeeded(req, res, payload, {
      id: member.id,
      email: member.email,
      name: member.name,
    });

    return { memberId: member.id, memberName: member.name };
  } catch {
    return null;
  }
}

async function refreshAdminSessionCookieIfNeeded(
  req: CreateExpressContextOptions["req"],
  res: CreateExpressContextOptions["res"],
  user: TrpcUser,
) {
  if (user.role !== "admin") return;

  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return;

  try {
    const { jwtVerify } = await import("jose");
    const { payload } = await jwtVerify(token, getJwtSecretKey());
    if (payload.openId !== user.openId || typeof payload.exp !== "number") return;

    const remainingMs = (payload.exp - Math.floor(Date.now() / 1000)) * 1000;
    if (remainingMs >= SESSION_REFRESH_THRESHOLD_MS) return;

    const sessionToken = await sdk.signSession(
      {
        openId: user.openId,
        appId: typeof payload.appId === "string" && payload.appId ? payload.appId : "admin",
        name: typeof payload.name === "string" && payload.name ? payload.name : user.name ?? "관리자",
      },
      { expiresInMs: ADMIN_SESSION_MS },
    );

    res.cookie(COOKIE_NAME, sessionToken, {
      ...getSessionCookieOptions(req),
      maxAge: ADMIN_SESSION_MS,
    });
  } catch {
    // Authentication already succeeded through the normal SDK path; skip renewal only.
  }
}

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: TrpcUser | null = null;
  const memberSession = await authenticateApprovedMember(opts.req, opts.res);

  try {
    const sdkUser = await sdk.authenticateRequest(opts.req);
    user = sdkUser ? await attachContentPermissions(sdkUser) : null;
    if (user) {
      await refreshAdminSessionCookieIfNeeded(opts.req, opts.res, user);
    }
  } catch (error) {
    // Authentication is optional for public procedures.
    user = null;
  }

  if (!user) {
    user = await authenticateMemberContentManager(opts.req);
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
    memberId: memberSession?.memberId ?? user?.memberId ?? null,
    memberName: memberSession?.memberName ?? null,
  };
}
