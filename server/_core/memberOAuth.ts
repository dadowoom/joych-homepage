import crypto from "node:crypto";
import type { Express, Request, Response } from "express";
import { SignJWT, jwtVerify } from "jose";
import { getSessionCookieOptions } from "./cookies";
import { getJwtSecretKey } from "./jwtSecret";
import {
  createMember,
  createMemberSocialAccount,
  getMemberByEmail,
  getMemberById,
  getMemberSocialAccount,
  getMemberSocialAccountByMember,
  type MemberSocialProvider,
} from "../db/member";

const MEMBER_SESSION_COOKIE = "church_member_session";
const OAUTH_STATE_COOKIE = "church_member_oauth_state";
const STATE_TTL_MS = 10 * 60 * 1000;

const providers = {
  google: {
    label: "Google",
    clientIdEnv: "GOOGLE_OAUTH_CLIENT_ID",
    clientSecretEnv: "GOOGLE_OAUTH_CLIENT_SECRET",
    authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    userInfoUrl: "https://www.googleapis.com/oauth2/v3/userinfo",
    scopes: ["openid", "email", "profile"],
    clientSecretRequired: true,
  },
  kakao: {
    label: "Kakao",
    clientIdEnv: "KAKAO_REST_API_KEY",
    clientSecretEnv: "KAKAO_CLIENT_SECRET",
    authorizeUrl: "https://kauth.kakao.com/oauth/authorize",
    tokenUrl: "https://kauth.kakao.com/oauth/token",
    userInfoUrl: "https://kapi.kakao.com/v2/user/me",
    scopes: [],
    clientSecretRequired: false,
  },
} as const;

type MemberOAuthProvider = keyof typeof providers;
type MemberOAuthMode = "login" | "register";

type NormalizedSocialProfile = {
  provider: MemberOAuthProvider;
  providerUserId: string;
  email: string | null;
  emailVerified: boolean | null;
  displayName: string | null;
  profileImageUrl: string | null;
};

type OAuthStatePayload = {
  type: "member_oauth_state";
  provider: MemberOAuthProvider;
  mode: MemberOAuthMode;
  nonce: string;
};

type ProviderConfig = (typeof providers)[MemberOAuthProvider] & {
  clientId: string;
  clientSecret?: string;
};

function isMemberOAuthProvider(provider: string): provider is MemberOAuthProvider {
  return provider === "google" || provider === "kakao";
}

function getProviderConfig(provider: MemberOAuthProvider): ProviderConfig | null {
  const base = providers[provider];
  const clientId = process.env[base.clientIdEnv]?.trim();
  const clientSecret = process.env[base.clientSecretEnv]?.trim();

  if (!clientId) return null;
  if (base.clientSecretRequired && !clientSecret) return null;

  return {
    ...base,
    clientId,
    clientSecret: clientSecret || undefined,
  };
}

export function getMemberOAuthProviderStatus() {
  return {
    google: Boolean(getProviderConfig("google")),
    kakao: Boolean(getProviderConfig("kakao")),
  };
}

function getBaseUrl(req: Request) {
  const configured = process.env.PUBLIC_URL_BASE?.trim();
  if (configured) return configured.replace(/\/+$/, "");

  const proto = req.headers["x-forwarded-proto"];
  const protocol = Array.isArray(proto) ? proto[0] : proto;
  const host = req.get("host");
  return `${protocol || req.protocol}://${host}`;
}

export function getMemberOAuthRedirectUri(req: Request, provider: MemberOAuthProvider) {
  return `${getBaseUrl(req)}/api/member-oauth/${provider}/callback`;
}

async function createOAuthState(provider: MemberOAuthProvider, mode: MemberOAuthMode) {
  const nonce = crypto.randomBytes(24).toString("base64url");
  return new SignJWT({
    type: "member_oauth_state",
    provider,
    mode,
    nonce,
  } satisfies OAuthStatePayload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(getJwtSecretKey());
}

async function verifyOAuthState(req: Request, provider: MemberOAuthProvider, state: string) {
  const cookieState = req.cookies?.[OAUTH_STATE_COOKIE];
  if (!cookieState || cookieState !== state) {
    throw new Error("OAuth state cookie mismatch");
  }

  const { payload } = await jwtVerify(state, getJwtSecretKey());
  if (
    payload.type !== "member_oauth_state" ||
    payload.provider !== provider ||
    (payload.mode !== "login" && payload.mode !== "register")
  ) {
    throw new Error("Invalid OAuth state");
  }

  return payload as OAuthStatePayload;
}

function clearOAuthStateCookie(req: Request, res: Response) {
  res.clearCookie(OAUTH_STATE_COOKIE, {
    ...getSessionCookieOptions(req),
    maxAge: -1,
  });
}

function redirectToLogin(res: Response, params: Record<string, string>) {
  const url = new URL("/member/login", "http://localhost");
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  return res.redirect(303, `${url.pathname}${url.search}`);
}

function getMode(value: unknown): MemberOAuthMode {
  return value === "register" ? "register" : "login";
}

function assertString(value: unknown, message: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(message);
  }
  return value.trim();
}

async function postForm<T>(url: string, params: URLSearchParams): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded;charset=utf-8" },
    body: params,
  });

  const data = await response.json().catch(() => null);
  if (!response.ok || !data) {
    throw new Error("OAuth token request failed");
  }
  return data as T;
}

async function getJson<T>(url: string, accessToken: string): Promise<T> {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const data = await response.json().catch(() => null);
  if (!response.ok || !data) {
    throw new Error("OAuth user info request failed");
  }
  return data as T;
}

type OAuthTokenResponse = {
  access_token?: string;
  token_type?: string;
};

async function exchangeAuthorizationCode(
  provider: MemberOAuthProvider,
  config: ProviderConfig,
  code: string,
  redirectUri: string
) {
  const params = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: config.clientId,
    redirect_uri: redirectUri,
    code,
  });

  if (config.clientSecret) {
    params.set("client_secret", config.clientSecret);
  }

  const token = await postForm<OAuthTokenResponse>(config.tokenUrl, params);
  return assertString(token.access_token, `${provider} access token missing`);
}

export function normalizeGoogleProfile(profile: unknown): NormalizedSocialProfile {
  const data = profile as Record<string, unknown>;
  const providerUserId = assertString(data.sub, "Google profile sub missing");
  const email = typeof data.email === "string" ? data.email.trim().toLowerCase() : null;
  const emailVerified = typeof data.email_verified === "boolean" ? data.email_verified : null;

  return {
    provider: "google",
    providerUserId,
    email,
    emailVerified,
    displayName: typeof data.name === "string" ? data.name : null,
    profileImageUrl: typeof data.picture === "string" ? data.picture : null,
  };
}

export function normalizeKakaoProfile(profile: unknown): NormalizedSocialProfile {
  const data = profile as Record<string, unknown>;
  const kakaoAccount = (data.kakao_account ?? {}) as Record<string, unknown>;
  const accountProfile = (kakaoAccount.profile ?? {}) as Record<string, unknown>;
  const properties = (data.properties ?? {}) as Record<string, unknown>;
  const providerUserId =
    typeof data.id === "number" || typeof data.id === "string"
      ? String(data.id)
      : "";

  return {
    provider: "kakao",
    providerUserId: assertString(providerUserId, "Kakao profile id missing"),
    email: typeof kakaoAccount.email === "string" ? kakaoAccount.email.trim().toLowerCase() : null,
    emailVerified:
      typeof kakaoAccount.is_email_verified === "boolean"
        ? kakaoAccount.is_email_verified
        : null,
    displayName:
      typeof accountProfile.nickname === "string"
        ? accountProfile.nickname
        : typeof properties.nickname === "string"
          ? properties.nickname
          : null,
    profileImageUrl:
      typeof accountProfile.profile_image_url === "string"
        ? accountProfile.profile_image_url
        : typeof properties.profile_image === "string"
          ? properties.profile_image
          : null,
  };
}

async function fetchSocialProfile(
  provider: MemberOAuthProvider,
  config: ProviderConfig,
  accessToken: string
) {
  const rawProfile = await getJson<unknown>(config.userInfoUrl, accessToken);
  return provider === "google"
    ? normalizeGoogleProfile(rawProfile)
    : normalizeKakaoProfile(rawProfile);
}

async function setMemberSessionCookie(req: Request, res: Response, member: {
  id: number;
  email: string | null;
  name: string;
}) {
  const token = await new SignJWT({
    memberId: member.id,
    email: member.email ?? "",
    name: member.name,
    type: "church_member",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("24h")
    .sign(getJwtSecretKey());

  res.cookie(MEMBER_SESSION_COOKIE, token, {
    ...getSessionCookieOptions(req),
  });
}

function getBlockedMemberStatus(status: string) {
  if (status === "pending" || status === "rejected" || status === "withdrawn") {
    return status;
  }
  return "forbidden";
}

async function resolveMemberForProfile(profile: NormalizedSocialProfile) {
  if (profile.email && profile.emailVerified === false) {
    return { member: null, created: false, status: "social_email_unverified" as const };
  }
  if (profile.email && profile.email.length > 128) {
    return { member: null, created: false, status: "social_email_too_long" as const };
  }

  const existingSocialAccount = await getMemberSocialAccount(
    profile.provider as MemberSocialProvider,
    profile.providerUserId
  );
  if (existingSocialAccount) {
    const member = await getMemberById(existingSocialAccount.memberId);
    return { member, created: false, status: member ? "ok" as const : "error" as const };
  }

  const existingMember = profile.email ? await getMemberByEmail(profile.email) : null;
  if (existingMember) {
    const existingProviderAccount = await getMemberSocialAccountByMember(
      profile.provider as MemberSocialProvider,
      existingMember.id
    );
    if (
      existingProviderAccount &&
      existingProviderAccount.providerUserId !== profile.providerUserId
    ) {
      return { member: null, created: false, status: "social_account_conflict" as const };
    }

    if (!existingProviderAccount) {
      await createMemberSocialAccount({
        memberId: existingMember.id,
        provider: profile.provider as MemberSocialProvider,
        providerUserId: profile.providerUserId,
        email: profile.email,
        displayName: profile.displayName,
        profileImageUrl: profile.profileImageUrl,
      });
    }
    return { member: existingMember, created: false, status: "ok" as const };
  }

  const memberId = await createMember({
    email: profile.email,
    passwordHash: null,
    name: profile.displayName || `${providers[profile.provider].label} 사용자`,
    joinPath: `${providers[profile.provider].label} 간편가입`,
  });
  await createMemberSocialAccount({
    memberId,
    provider: profile.provider as MemberSocialProvider,
    providerUserId: profile.providerUserId,
    email: profile.email,
    displayName: profile.displayName,
    profileImageUrl: profile.profileImageUrl,
  });

  const member = await getMemberById(memberId);
  return { member, created: true, status: member ? "ok" as const : "error" as const };
}

export function registerMemberOAuthRoutes(app: Express) {
  app.get("/api/member-oauth/:provider/start", async (req, res) => {
    const providerParam = req.params.provider;
    if (!isMemberOAuthProvider(providerParam)) {
      return redirectToLogin(res, { social: "error" });
    }

    const config = getProviderConfig(providerParam);
    if (!config) {
      return redirectToLogin(res, {
        social: "not_configured",
        provider: providerParam,
      });
    }

    const mode = getMode(req.query.mode);
    const state = await createOAuthState(providerParam, mode);
    res.cookie(OAUTH_STATE_COOKIE, state, {
      ...getSessionCookieOptions(req),
      maxAge: STATE_TTL_MS,
    });

    const authUrl = new URL(config.authorizeUrl);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("client_id", config.clientId);
    authUrl.searchParams.set("redirect_uri", getMemberOAuthRedirectUri(req, providerParam));
    if (config.scopes.length > 0) {
      authUrl.searchParams.set("scope", config.scopes.join(" "));
    }
    authUrl.searchParams.set("state", state);

    return res.redirect(authUrl.toString());
  });

  app.get("/api/member-oauth/:provider/callback", async (req, res) => {
    const providerParam = req.params.provider;
    if (!isMemberOAuthProvider(providerParam)) {
      return redirectToLogin(res, { social: "error" });
    }

    if (typeof req.query.error === "string") {
      clearOAuthStateCookie(req, res);
      return redirectToLogin(res, { social: "social_cancelled", provider: providerParam });
    }

    const config = getProviderConfig(providerParam);
    if (!config) {
      clearOAuthStateCookie(req, res);
      return redirectToLogin(res, { social: "not_configured", provider: providerParam });
    }

    try {
      const state = assertString(req.query.state, "OAuth state missing");
      const code = assertString(req.query.code, "OAuth code missing");
      await verifyOAuthState(req, providerParam, state);
      clearOAuthStateCookie(req, res);

      const redirectUri = getMemberOAuthRedirectUri(req, providerParam);
      const accessToken = await exchangeAuthorizationCode(providerParam, config, code, redirectUri);
      const profile = await fetchSocialProfile(providerParam, config, accessToken);
      const result = await resolveMemberForProfile(profile);

      if (!result.member || result.status !== "ok") {
        return redirectToLogin(res, {
          social: result.status,
          provider: providerParam,
        });
      }

      if (result.member.status !== "approved") {
        res.clearCookie(MEMBER_SESSION_COOKIE, {
          ...getSessionCookieOptions(req),
          maxAge: -1,
        });
        return redirectToLogin(res, {
          social: result.created ? "registered" : getBlockedMemberStatus(result.member.status),
          provider: providerParam,
        });
      }

      await setMemberSessionCookie(req, res, result.member);
      return res.redirect(303, "/");
    } catch (error) {
      clearOAuthStateCookie(req, res);
      console.error("[member-oauth] callback failed", error);
      return redirectToLogin(res, { social: "error", provider: providerParam });
    }
  });
}
