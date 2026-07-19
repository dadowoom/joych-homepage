import { randomUUID } from "node:crypto";
import type { Express, Request, Response } from "express";
import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { ADMIN_SESSION_MS, COOKIE_NAME } from "@shared/const";
import { getMemberById, getUserByOpenId } from "../db";
import { getSessionCookieOptions } from "./cookies";
import { getJwtSecretKey } from "./jwtSecret";
import {
  isMemberSessionCurrent,
  MEMBER_SESSION_COOKIE,
  setMemberSessionCookie,
} from "./memberSession";
import { sdk } from "./sdk";

export const PRIMARY_SITE_ORIGIN = "https://www.joych.org";
export const LEGACY_MEMBER_SITE_ORIGIN = "https://newjoych.co.kr";
export const DOMAIN_BRIDGE_MARKER = "__joych_bridge";
export const DOMAIN_BRIDGE_MARKER_VALUE = "1";
export const DOMAIN_LOGOUT_MARKER = "__joych_logout";
export const DOMAIN_LOGOUT_MARKER_VALUE = "1";

const BRIDGE_TYPE = "joych_domain_session_bridge";
const BRIDGE_AUDIENCE = PRIMARY_SITE_ORIGIN;
const BRIDGE_ISSUER = LEGACY_MEMBER_SITE_ORIGIN;
const BRIDGE_TTL_SECONDS = 60;
const LOGOUT_INTENT_TYPE = "joych_domain_logout_intent";
const LOGOUT_INTENT_AUDIENCE = "joych_domain_logout";
const LOGOUT_INTENT_TTL_SECONDS = 120;
const DOMAIN_LOGOUT_INTENT_COOKIE = "joych_domain_logout_intent";
const MAX_RETURN_TO_LENGTH = 4_096;
const LEGACY_HOSTNAMES = new Set([
  "newjoych.co.kr",
  "www.newjoych.co.kr",
  "joych.org",
  "m.joych.org",
]);
const LEGACY_ORIGINS = new Map([
  ["newjoych.co.kr", "https://newjoych.co.kr"],
  ["www.newjoych.co.kr", "https://www.newjoych.co.kr"],
  ["joych.org", "https://joych.org"],
  ["m.joych.org", "https://m.joych.org"],
]);

type SessionBridgeClaims = JWTPayload & {
  type: typeof BRIDGE_TYPE;
  returnTo: string;
  sourceOrigin: string;
  memberId?: number;
  memberPersistent?: boolean;
  memberSessionVersion?: number;
  adminOpenId?: string;
};

type DomainLogoutIntentClaims = JWTPayload & {
  type: typeof LOGOUT_INTENT_TYPE;
  memberId?: number;
  adminOpenId?: string;
};

const consumedTokenIds = new Map<string, number>();

function requestHostname(req: Request) {
  // Authentication decisions must use the Host header that Nginx forwards as
  // `$host`. A client-controlled X-Forwarded-Host must never choose a bridge
  // source or destination.
  const raw = req.headers.host || "";
  return raw.trim().toLowerCase().replace(/:\d+$/, "");
}

/** Only a local path may cross the domain bridge. */
export function normalizeBridgeReturnTo(value: unknown) {
  if (typeof value !== "string") return "/";
  const trimmed = value.trim();
  if (
    !trimmed ||
    trimmed.length > MAX_RETURN_TO_LENGTH ||
    !trimmed.startsWith("/") ||
    trimmed.startsWith("//") ||
    /[\u0000-\u001f\u007f]/.test(trimmed)
  ) {
    return "/";
  }

  try {
    const parsed = new URL(trimmed, PRIMARY_SITE_ORIGIN);
    if (parsed.origin !== PRIMARY_SITE_ORIGIN) return "/";
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return "/";
  }
}

export function buildPrimaryBridgeReturnUrl(value: unknown) {
  const parsed = new URL(normalizeBridgeReturnTo(value), PRIMARY_SITE_ORIGIN);
  parsed.searchParams.set(DOMAIN_BRIDGE_MARKER, DOMAIN_BRIDGE_MARKER_VALUE);
  return parsed.toString();
}

export function buildPrimaryLogoutReturnUrl(value: unknown) {
  const parsed = new URL(normalizeBridgeReturnTo(value), PRIMARY_SITE_ORIGIN);
  parsed.searchParams.delete(DOMAIN_BRIDGE_MARKER);
  parsed.searchParams.set(DOMAIN_LOGOUT_MARKER, DOMAIN_LOGOUT_MARKER_VALUE);
  return parsed.toString();
}

function buildPrimaryLogoutCompletionUrl(value: unknown) {
  const destination = new URL(
    "/api/domain-session-bridge/logout/complete",
    PRIMARY_SITE_ORIGIN,
  );
  destination.searchParams.set("returnTo", normalizeBridgeReturnTo(value));
  return destination.toString();
}

function pruneConsumedTokens(nowSeconds: number) {
  consumedTokenIds.forEach((expiresAt, tokenId) => {
    if (expiresAt <= nowSeconds) consumedTokenIds.delete(tokenId);
  });
}

function consumeTokenId(tokenId: string, expiresAt: number) {
  const nowSeconds = Math.floor(Date.now() / 1000);
  pruneConsumedTokens(nowSeconds);
  if (consumedTokenIds.has(tokenId)) {
    throw new Error("Domain session bridge token was already used");
  }
  consumedTokenIds.set(tokenId, expiresAt);
}

export async function createSessionBridgeToken(input: {
  returnTo: string;
  sourceOrigin: string;
  memberId?: number;
  memberPersistent?: boolean;
  memberSessionVersion?: number;
  adminOpenId?: string;
}) {
  return new SignJWT({
    type: BRIDGE_TYPE,
    returnTo: normalizeBridgeReturnTo(input.returnTo),
    sourceOrigin: input.sourceOrigin,
    memberId: input.memberId,
    memberPersistent: input.memberPersistent,
    memberSessionVersion: input.memberSessionVersion,
    adminOpenId: input.adminOpenId,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer(BRIDGE_ISSUER)
    .setAudience(BRIDGE_AUDIENCE)
    .setJti(randomUUID())
    .setIssuedAt()
    .setExpirationTime(`${BRIDGE_TTL_SECONDS}s`)
    .sign(getJwtSecretKey());
}

export async function verifySessionBridgeToken(token: string) {
  const { payload } = await jwtVerify(token, getJwtSecretKey(), {
    algorithms: ["HS256"],
    issuer: BRIDGE_ISSUER,
    audience: BRIDGE_AUDIENCE,
  });

  if (
    payload.type !== BRIDGE_TYPE ||
    typeof payload.returnTo !== "string" ||
    typeof payload.sourceOrigin !== "string" ||
    !Array.from(LEGACY_ORIGINS.values()).includes(payload.sourceOrigin) ||
    typeof payload.jti !== "string" ||
    typeof payload.exp !== "number"
  ) {
    throw new Error("Invalid domain session bridge token");
  }

  return payload as SessionBridgeClaims;
}

export function consumeSessionBridgeToken(claims: SessionBridgeClaims) {
  consumeTokenId(claims.jti!, claims.exp!);
}

export function assertSessionBridgeRequestOrigin(
  claims: SessionBridgeClaims,
  originHeader: unknown,
) {
  const requestOrigin = typeof originHeader === "string"
    ? originHeader.trim().toLowerCase()
    : "";
  if (!requestOrigin || requestOrigin !== claims.sourceOrigin.toLowerCase()) {
    throw new Error("Domain session bridge origin mismatch");
  }
}

export async function verifyAndConsumeSessionBridgeToken(token: string) {
  const claims = await verifySessionBridgeToken(token);
  consumeSessionBridgeToken(claims);
  return claims;
}

export function resetConsumedSessionBridgeTokensForTests() {
  consumedTokenIds.clear();
}

function getDomainLogoutIntentCookieOptions(req: Request) {
  return {
    ...getSessionCookieOptions(req),
    path: "/api/domain-session-bridge/logout",
  };
}

export async function createDomainLogoutIntent(
  req: Request,
  res: Response,
  input: { memberId?: number | null; adminOpenId?: string | null },
) {
  const memberId = Number.isInteger(input.memberId) && Number(input.memberId) > 0
    ? Number(input.memberId)
    : undefined;
  const adminOpenId = typeof input.adminOpenId === "string" && input.adminOpenId
    ? input.adminOpenId
    : undefined;
  if (!memberId && !adminOpenId) return null;

  const token = await new SignJWT({
    type: LOGOUT_INTENT_TYPE,
    memberId,
    adminOpenId,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer(PRIMARY_SITE_ORIGIN)
    .setAudience(LOGOUT_INTENT_AUDIENCE)
    .setJti(randomUUID())
    .setIssuedAt()
    .setExpirationTime(`${LOGOUT_INTENT_TTL_SECONDS}s`)
    .sign(getJwtSecretKey());

  res.cookie(DOMAIN_LOGOUT_INTENT_COOKIE, token, {
    ...getDomainLogoutIntentCookieOptions(req),
    maxAge: LOGOUT_INTENT_TTL_SECONDS * 1_000,
  });
  return token;
}

export async function verifyDomainLogoutIntent(token: string) {
  const { payload } = await jwtVerify(token, getJwtSecretKey(), {
    algorithms: ["HS256"],
    issuer: PRIMARY_SITE_ORIGIN,
    audience: LOGOUT_INTENT_AUDIENCE,
  });
  if (
    payload.type !== LOGOUT_INTENT_TYPE ||
    typeof payload.jti !== "string" ||
    (!Number.isInteger(payload.memberId) &&
      !(typeof payload.adminOpenId === "string" && payload.adminOpenId))
  ) {
    throw new Error("Invalid domain logout intent");
  }
  return payload as DomainLogoutIntentClaims;
}

export function domainLogoutIntentMatchesSession(
  claims: DomainLogoutIntentClaims,
  input: {
    hasLocalIntent: boolean;
    memberId?: number | null;
    adminOpenId?: string | null;
  },
) {
  return input.hasLocalIntent || Boolean(
    (claims.memberId && input.memberId === claims.memberId) ||
    (claims.adminOpenId && input.adminOpenId === claims.adminOpenId),
  );
}

function readRawLogoutIntent(req: Request) {
  const token = req.query.intent;
  if (typeof token !== "string" || !token || token.length > 8_192) {
    throw new Error("Missing domain logout intent");
  }
  return token;
}

async function inspectDomainLogoutAuthorization(req: Request, token: string) {
  const claims = await verifyDomainLogoutIntent(token);
  const hasLocalIntent = req.cookies?.[DOMAIN_LOGOUT_INTENT_COOKIE] === token;
  const [memberSession, adminSession] = await Promise.all([
    claims.memberId ? readApprovedMemberSession(req) : Promise.resolve(null),
    claims.adminOpenId ? readAdminSession(req) : Promise.resolve(null),
  ]);
  const authorized = domainLogoutIntentMatchesSession(claims, {
    hasLocalIntent,
    memberId: memberSession?.memberId,
    adminOpenId: adminSession?.openId,
  });
  return { claims, authorized };
}

function clearAuthorizedDomainSessions(
  req: Request,
  res: Response,
  claims: DomainLogoutIntentClaims,
) {
  const cookieOptions = getSessionCookieOptions(req);
  if (claims.memberId) res.clearCookie(MEMBER_SESSION_COOKIE, cookieOptions);
  if (claims.adminOpenId) res.clearCookie(COOKIE_NAME, cookieOptions);
  res.clearCookie(
    DOMAIN_LOGOUT_INTENT_COOKIE,
    getDomainLogoutIntentCookieOptions(req),
  );
}

async function readApprovedMemberSession(req: Request) {
  const token = req.cookies?.[MEMBER_SESSION_COOKIE];
  if (typeof token !== "string" || !token) return null;

  try {
    const { payload } = await jwtVerify(token, getJwtSecretKey(), {
      algorithms: ["HS256"],
    });
    if (payload.type !== "church_member") return null;
    const memberId = Number(payload.memberId);
    if (!Number.isInteger(memberId) || memberId <= 0) return null;
    const member = await getMemberById(memberId);
    if (!member || member.status !== "approved") return null;
    if (!isMemberSessionCurrent(payload, member.sessionVersion)) return null;
    return {
      memberId: member.id,
      persistent: payload.persistent !== false,
      sessionVersion: member.sessionVersion,
    };
  } catch {
    return null;
  }
}

async function readAdminSession(req: Request) {
  const token = req.cookies?.[COOKIE_NAME];
  if (typeof token !== "string" || !token) return null;

  const session = await sdk.verifySession(token);
  if (!session) return null;
  const user = await getUserByOpenId(session.openId);
  if (!user || user.role !== "admin") return null;
  return { openId: user.openId };
}

function setNoStoreHeaders(res: Response) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
}

function renderAutoPostPage(res: Response, token: string) {
  const nonce = String(res.locals.cspNonce || "");
  setNoStoreHeaders(res);
  res.setHeader(
    "Content-Security-Policy",
    `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline'; form-action ${PRIMARY_SITE_ORIGIN}; base-uri 'none'; frame-ancestors 'none'`,
  );
  res.status(200).type("html").send(`<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>로그인 연결 중</title></head>
<body><form id="bridge" method="post" action="${PRIMARY_SITE_ORIGIN}/api/domain-session-bridge/complete">
<input type="hidden" name="token" value="${token}"><noscript><button type="submit">계속</button></noscript></form>
<script nonce="${nonce}">document.getElementById("bridge").submit();</script></body></html>`);
}

export function registerDomainSessionBridgeRoutes(app: Express) {
  app.get("/api/domain-session-bridge/logout", async (req, res) => {
    const returnTo = normalizeBridgeReturnTo(req.query.returnTo);
    const hostname = requestHostname(req);
    setNoStoreHeaders(res);

    if (!LEGACY_HOSTNAMES.has(hostname)) {
      return res.status(404).type("text/plain").send("Not found");
    }

    try {
      const token = readRawLogoutIntent(req);
      const { claims, authorized } = await inspectDomainLogoutAuthorization(req, token);
      // A primary-domain logout may have no legacy cookie at all. In that case
      // forward the valid signed intent without clearing unrelated legacy users;
      // the primary completion still requires its host-only intent cookie.
      if (authorized) clearAuthorizedDomainSessions(req, res, claims);
      const completion = new URL(buildPrimaryLogoutCompletionUrl(returnTo));
      completion.searchParams.set("intent", token);
      return res.redirect(303, completion.toString());
    } catch (error) {
      console.warn("[DomainSessionBridge] Legacy logout was rejected:", String(error));
      return res.status(403).type("text/plain").send("Forbidden");
    }
  });

  app.get("/api/domain-session-bridge/logout/complete", async (req, res) => {
    setNoStoreHeaders(res);
    if (requestHostname(req) !== new URL(PRIMARY_SITE_ORIGIN).hostname) {
      return res.status(404).type("text/plain").send("Not found");
    }

    try {
      const token = readRawLogoutIntent(req);
      const { claims, authorized } = await inspectDomainLogoutAuthorization(req, token);
      if (authorized) clearAuthorizedDomainSessions(req, res, claims);
      return res.redirect(303, buildPrimaryLogoutReturnUrl(req.query.returnTo));
    } catch (error) {
      console.warn("[DomainSessionBridge] Primary logout was rejected:", String(error));
      return res.status(403).type("text/plain").send("Forbidden");
    }
  });

  app.get("/api/domain-session-bridge/start", async (req, res, next) => {
    try {
      const returnTo = normalizeBridgeReturnTo(req.query.returnTo);
      const hostname = requestHostname(req);
      const sourceOrigin = LEGACY_ORIGINS.get(hostname);
      setNoStoreHeaders(res);

      if (!LEGACY_HOSTNAMES.has(hostname) || !sourceOrigin) {
        return res.redirect(303, buildPrimaryBridgeReturnUrl(returnTo));
      }

      const [memberSession, adminSession] = await Promise.all([
        readApprovedMemberSession(req),
        readAdminSession(req),
      ]);

      if (!memberSession && !adminSession) {
        return res.redirect(303, buildPrimaryBridgeReturnUrl(returnTo));
      }

      const token = await createSessionBridgeToken({
        returnTo,
        sourceOrigin,
        memberId: memberSession?.memberId,
        memberPersistent: memberSession?.persistent,
        memberSessionVersion: memberSession?.sessionVersion,
        adminOpenId: adminSession?.openId,
      });
      return renderAutoPostPage(res, token);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/domain-session-bridge/complete", async (req, res) => {
    setNoStoreHeaders(res);
    let returnTo = "/";

    try {
      if (requestHostname(req) !== new URL(PRIMARY_SITE_ORIGIN).hostname) {
        return res.status(404).type("text/plain").send("Not found");
      }

      const rawToken = req.body?.token;
      if (typeof rawToken !== "string" || !rawToken || rawToken.length > 8_192) {
        throw new Error("Missing domain session bridge token");
      }

      const claims = await verifySessionBridgeToken(rawToken);
      returnTo = normalizeBridgeReturnTo(claims.returnTo);

      assertSessionBridgeRequestOrigin(claims, req.headers.origin);

      // Consume only after the browser's source origin has been authenticated.
      // A forged request therefore cannot burn or reuse a legitimate token.
      consumeSessionBridgeToken(claims);

      if (typeof claims.memberId === "number" && Number.isInteger(claims.memberId)) {
        const member = await getMemberById(claims.memberId);
        if (
          member &&
          member.status === "approved" &&
          Number.isInteger(member.sessionVersion) &&
          member.sessionVersion === claims.memberSessionVersion
        ) {
          await setMemberSessionCookie(req, res, {
            id: member.id,
            email: member.email,
            name: member.name,
            sessionVersion: member.sessionVersion,
          }, {
            persistent: claims.memberPersistent !== false,
          });
        }
      }

      if (typeof claims.adminOpenId === "string" && claims.adminOpenId) {
        const admin = await getUserByOpenId(claims.adminOpenId);
        if (admin?.role === "admin") {
          const sessionToken = await sdk.signSession({
            openId: admin.openId,
            appId: "admin",
            name: admin.name || "관리자",
          }, { expiresInMs: ADMIN_SESSION_MS });
          res.cookie(COOKIE_NAME, sessionToken, {
            ...getSessionCookieOptions(req),
            maxAge: ADMIN_SESSION_MS,
          });
        }
      }
    } catch (error) {
      console.warn("[DomainSessionBridge] Session transfer was rejected:", String(error));
      return res.status(403).type("text/plain").send("Forbidden");
    }

    return res.redirect(303, buildPrimaryBridgeReturnUrl(returnTo));
  });
}
