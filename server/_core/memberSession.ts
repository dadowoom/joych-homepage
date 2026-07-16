import type { Request, Response } from "express";
import type { JWTPayload } from "jose";
import { SignJWT } from "jose";
import { MEMBER_SESSION_MS } from "@shared/const";
import { getSessionCookieOptions } from "./cookies";
import { getJwtSecretKey } from "./jwtSecret";

export const MEMBER_SESSION_COOKIE = "church_member_session";
export const SESSION_REFRESH_THRESHOLD_MS = 1000 * 60 * 60 * 24 * 7;

export type MemberSessionIdentity = {
  id: number;
  email: string | null;
  name: string;
  sessionVersion?: number;
};

export type MemberSessionOptions = {
  persistent?: boolean;
};

export async function createMemberSessionToken(
  member: MemberSessionIdentity,
  options: MemberSessionOptions = {},
) {
  return new SignJWT({
    memberId: member.id,
    email: member.email ?? "",
    name: member.name,
    type: "church_member",
    persistent: options.persistent !== false,
    sessionVersion: member.sessionVersion ?? 0,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(getJwtSecretKey());
}

/**
 * 토큰과 DB의 세션 버전이 같은지 확인합니다.
 * 기존 토큰에 버전 claim이 없으면 0으로 보아 마이그레이션 전 세션을 유지합니다.
 */
export function isMemberSessionCurrent(
  payload: JWTPayload,
  memberSessionVersion: number | null | undefined,
) {
  const currentVersion = memberSessionVersion ?? 0;
  if (!Number.isInteger(currentVersion) || currentVersion < 0) return false;
  if (payload.sessionVersion === undefined) return currentVersion === 0;
  if (!Number.isInteger(payload.sessionVersion) || (payload.sessionVersion as number) < 0) return false;
  return payload.sessionVersion === currentVersion;
}

export async function setMemberSessionCookie(
  req: Request,
  res: Response,
  member: MemberSessionIdentity,
  options: MemberSessionOptions = {},
) {
  const persistent = options.persistent !== false;
  const token = await createMemberSessionToken(member, { persistent });
  const cookieOptions = {
    ...getSessionCookieOptions(req),
  } as ReturnType<typeof getSessionCookieOptions> & { maxAge?: number };

  if (persistent) {
    cookieOptions.maxAge = MEMBER_SESSION_MS;
  }

  res.cookie(MEMBER_SESSION_COOKIE, token, cookieOptions);
}

export async function refreshMemberSessionCookieIfNeeded(
  req: Request,
  res: Response,
  payload: JWTPayload,
  member: MemberSessionIdentity,
) {
  if (typeof payload.exp !== "number") return;

  const remainingMs = (payload.exp - Math.floor(Date.now() / 1000)) * 1000;
  if (remainingMs >= SESSION_REFRESH_THRESHOLD_MS) return;

  await setMemberSessionCookie(req, res, member, {
    persistent: payload.persistent !== false,
  });
}
