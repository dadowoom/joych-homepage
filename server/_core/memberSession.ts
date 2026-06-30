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
};

export async function createMemberSessionToken(member: MemberSessionIdentity) {
  return new SignJWT({
    memberId: member.id,
    email: member.email ?? "",
    name: member.name,
    type: "church_member",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("30d")
    .sign(getJwtSecretKey());
}

export async function setMemberSessionCookie(req: Request, res: Response, member: MemberSessionIdentity) {
  const token = await createMemberSessionToken(member);
  res.cookie(MEMBER_SESSION_COOKIE, token, {
    ...getSessionCookieOptions(req),
    maxAge: MEMBER_SESSION_MS,
  });
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

  await setMemberSessionCookie(req, res, member);
}
