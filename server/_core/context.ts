import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { getAdminPermissionKeysForUser, getMemberById, getUserByOpenId, memberAdminOpenId } from "../db";
import { getJwtSecretKey } from "./jwtSecret";
import { sdk } from "./sdk";

export type TrpcUser = User & {
  contentPermissions?: string[];
  memberId?: number;
};

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: TrpcUser | null;
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
  const token = req.cookies?.church_member_session;
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

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: TrpcUser | null = null;

  try {
    const sdkUser = await sdk.authenticateRequest(opts.req);
    user = sdkUser ? await attachContentPermissions(sdkUser) : null;
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
  };
}
