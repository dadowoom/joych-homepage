import crypto from "node:crypto";
import type { Express, Request, Response } from "express";
import { SignJWT, jwtVerify } from "jose";
import { getSessionCookieOptions } from "./cookies";
import { getJwtSecretKey } from "./jwtSecret";
import { MEMBER_SESSION_COOKIE, setMemberSessionCookie } from "./memberSession";
import {
  MEMBER_REGISTER_FIELD_CONFIG_KEY,
  parseMemberRegisterFieldConfig,
} from "@shared/memberRegisterFields";
import { getSiteSetting } from "../db/content";
import { notifyMemberRegistration } from "./pushNotifications";
import {
  createMemberSocialAccount,
  createMemberWithSocialAccount,
  getMemberFieldOptions,
  getMemberByEmail,
  getMemberById,
  getMemberSocialAccount,
  getMemberSocialAccountByMember,
  type MemberSocialProvider,
} from "../db/member";

const OAUTH_STATE_COOKIE = "church_member_oauth_state";
const SOCIAL_SIGNUP_COOKIE = "church_member_social_signup";
const STATE_TTL_MS = 10 * 60 * 1000;
const SOCIAL_SIGNUP_TTL_MS = 20 * 60 * 1000;

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

type SocialSignupPayload = {
  type: "member_social_signup";
  provider: MemberOAuthProvider;
  providerUserId: string;
  email: string | null;
  emailVerified: boolean | null;
  displayName: string | null;
  profileImageUrl: string | null;
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

export function getMemberOAuthProviderScopes(provider: "google" | "kakao") {
  return [...providers[provider].scopes];
}

function getBaseUrl(req: Request) {
  const configured = process.env.PUBLIC_URL_BASE?.trim();
  if (configured) return configured.replace(/\/+$/, "");

  const proto = req.headers["x-forwarded-proto"];
  const protocol = Array.isArray(proto) ? proto[0] : proto;
  const host = req.get("host");
  return `${protocol || req.protocol}://${host}`;
}

function getHeaderFirstValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0];
  return value;
}

function getRequestOrigin(req: Request) {
  const forwardedProto = getHeaderFirstValue(req.headers["x-forwarded-proto"]);
  const forwardedHost = getHeaderFirstValue(req.headers["x-forwarded-host"]);
  const protocol = forwardedProto?.split(",")[0]?.trim() || req.protocol;
  const host = forwardedHost?.split(",")[0]?.trim() || req.get("host");
  return host ? `${protocol}://${host}` : null;
}

export function getCanonicalMemberOAuthStartUrl(
  req: Request,
  provider: MemberOAuthProvider,
  mode: MemberOAuthMode
) {
  const configured = process.env.PUBLIC_URL_BASE?.trim();
  if (!configured) return null;

  const requestOrigin = getRequestOrigin(req);
  if (!requestOrigin) return null;

  try {
    const canonicalOrigin = new URL(configured).origin;
    const currentOrigin = new URL(requestOrigin).origin;
    if (canonicalOrigin === currentOrigin) return null;

    const startUrl = new URL(`/api/member-oauth/${provider}/start`, canonicalOrigin);
    startUrl.searchParams.set("mode", mode);
    return startUrl.toString();
  } catch {
    return null;
  }
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

async function createSocialSignupState(profile: NormalizedSocialProfile) {
  return new SignJWT({
    type: "member_social_signup",
    provider: profile.provider,
    providerUserId: profile.providerUserId,
    email: profile.email,
    emailVerified: profile.emailVerified,
    displayName: profile.displayName,
    profileImageUrl: profile.profileImageUrl,
  } satisfies SocialSignupPayload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("20m")
    .sign(getJwtSecretKey());
}

async function verifySocialSignupState(req: Request) {
  const token = req.cookies?.[SOCIAL_SIGNUP_COOKIE];
  if (!token) {
    throw new Error("Social signup state missing");
  }

  const { payload } = await jwtVerify(token, getJwtSecretKey());
  const provider = String(payload.provider);
  if (
    payload.type !== "member_social_signup" ||
    !isMemberOAuthProvider(provider) ||
    typeof payload.providerUserId !== "string" ||
    !payload.providerUserId
  ) {
    throw new Error("Invalid social signup state");
  }

  return {
    type: "member_social_signup",
    provider,
    providerUserId: payload.providerUserId,
    email: typeof payload.email === "string" ? payload.email : null,
    emailVerified: typeof payload.emailVerified === "boolean" ? payload.emailVerified : null,
    displayName: typeof payload.displayName === "string" ? payload.displayName : null,
    profileImageUrl: typeof payload.profileImageUrl === "string" ? payload.profileImageUrl : null,
  } satisfies SocialSignupPayload;
}

function clearOAuthStateCookie(req: Request, res: Response) {
  res.clearCookie(OAUTH_STATE_COOKIE, {
    ...getSessionCookieOptions(req),
  });
}

function clearSocialSignupCookie(req: Request, res: Response) {
  res.clearCookie(SOCIAL_SIGNUP_COOKIE, {
    ...getSessionCookieOptions(req),
  });
}

async function setSocialSignupCookie(
  req: Request,
  res: Response,
  profile: NormalizedSocialProfile
) {
  const token = await createSocialSignupState(profile);
  res.cookie(SOCIAL_SIGNUP_COOKIE, token, {
    ...getSessionCookieOptions(req),
    maxAge: SOCIAL_SIGNUP_TTL_MS,
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

function sanitizeText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

function sanitizeOptionalEmail(value: unknown) {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  if (!email) return null;
  if (email.length > 128 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("invalid_email");
  }
  return email;
}

function sanitizeBirthDate(value: unknown) {
  const birthDate = sanitizeText(value, 16);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) {
    throw new Error("invalid_birth_date");
  }
  return birthDate;
}

async function postForm<T>(url: string, params: URLSearchParams): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded;charset=utf-8" },
    body: params,
  });

  const data = await response.json().catch(() => null);
  if (!response.ok || !data) {
    throw new Error(buildOAuthRequestError("OAuth token request failed", response.status, data));
  }
  return data as T;
}

async function getJson<T>(url: string, accessToken: string): Promise<T> {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const data = await response.json().catch(() => null);
  if (!response.ok || !data) {
    throw new Error(buildOAuthRequestError("OAuth user info request failed", response.status, data));
  }
  return data as T;
}

function buildOAuthRequestError(message: string, status: number, data: unknown) {
  const payload = data as Record<string, unknown> | null;
  const providerError =
    typeof payload?.error === "string"
      ? payload.error
      : typeof payload?.code === "string"
        ? payload.code
        : null;
  const providerDescription =
    typeof payload?.error_description === "string"
      ? payload.error_description
      : typeof payload?.msg === "string"
        ? payload.msg
        : null;
  return [
    message,
    `status=${status}`,
    providerError ? `error=${providerError}` : null,
    providerDescription ? `description=${providerDescription.slice(0, 180)}` : null,
  ].filter(Boolean).join(" ");
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
  const emailVerified =
    typeof kakaoAccount.is_email_verified === "boolean"
      ? kakaoAccount.is_email_verified
      : typeof kakaoAccount.is_email_valid === "boolean"
        ? kakaoAccount.is_email_valid
        : null;
  const providerUserId =
    typeof data.id === "number" || typeof data.id === "string"
      ? String(data.id)
      : "";

  return {
    provider: "kakao",
    providerUserId: assertString(providerUserId, "Kakao profile id missing"),
    email: typeof kakaoAccount.email === "string" ? kakaoAccount.email.trim().toLowerCase() : null,
    emailVerified,
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

function getBlockedMemberStatus(status: string) {
  if (status === "pending" || status === "rejected" || status === "withdrawn") {
    return status;
  }
  return "forbidden";
}

export function canUseProfileEmailForMemberAutoLink(profile: Pick<NormalizedSocialProfile, "email" | "emailVerified">) {
  return Boolean(profile.email && profile.emailVerified === true);
}

export function canAutoLinkSocialEmailToMember(
  profile: Pick<NormalizedSocialProfile, "email" | "emailVerified">,
  mode: MemberOAuthMode
) {
  return mode === "login" && canUseProfileEmailForMemberAutoLink(profile);
}

export function canIssueMemberOAuthSession(mode: MemberOAuthMode, memberStatus: string) {
  return mode === "login" && memberStatus === "approved";
}

async function resolveExistingMemberForProfile(
  profile: NormalizedSocialProfile,
  mode: MemberOAuthMode
) {
  const existingSocialAccount = await getMemberSocialAccount(
    profile.provider as MemberSocialProvider,
    profile.providerUserId
  );
  if (existingSocialAccount) {
    const member = await getMemberById(existingSocialAccount.memberId);
    return { member, created: false, status: member ? "ok" as const : "error" as const };
  }

  if (profile.email && profile.email.length > 128) {
    return { member: null, created: false, status: "social_email_too_long" as const };
  }

  const existingMember = canUseProfileEmailForMemberAutoLink(profile)
    ? await getMemberByEmail(profile.email as string)
    : null;

  if (mode === "register") {
    if (existingMember) {
      return { member: existingMember, created: false, status: "email_already_registered" as const };
    }
    return { member: null, created: false, status: "needs_signup_details" as const };
  }

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

  return { member: null, created: false, status: "needs_signup_details" as const };
}

export async function createMemberFromSocialSignup(
  profile: SocialSignupPayload,
  input: {
    name: string;
    phone: string;
    birthDate: string;
    position: string;
    email: string | null;
  }
) {
  const email = profile.email || input.email;
  if (email) {
    const existingMember = await getMemberByEmail(email);
    if (existingMember) {
      return { member: null, status: "email_conflict" as const };
    }
  }

  const existingSocialAccount = await getMemberSocialAccount(
    profile.provider as MemberSocialProvider,
    profile.providerUserId
  );
  if (existingSocialAccount) {
    const member = await getMemberById(existingSocialAccount.memberId);
    return { member, status: member ? "ok" as const : "error" as const };
  }

  const memberId = await createMemberWithSocialAccount({
    email,
    passwordHash: null,
    name: input.name,
    phone: input.phone,
    birthDate: input.birthDate,
    position: input.position || undefined,
    joinPath: `${providers[profile.provider].label} 간편가입`,
  }, {
    provider: profile.provider as MemberSocialProvider,
    providerUserId: profile.providerUserId,
    email,
    displayName: profile.displayName,
    profileImageUrl: profile.profileImageUrl,
  });

  void notifyMemberRegistration({
    memberId,
    name: input.name,
    position: input.position || null,
  });

  const member = await getMemberById(memberId);
  return { member, status: member ? "ok" as const : "error" as const };
}

export function registerMemberOAuthRoutes(app: Express) {
  app.get("/api/member-oauth/signup-context", async (req, res) => {
    try {
      const signup = await verifySocialSignupState(req);
      return res.json({
        provider: signup.provider,
        providerLabel: providers[signup.provider].label,
        email: signup.email,
        displayName: signup.displayName,
      });
    } catch {
      return res.status(401).json({ message: "간편가입 정보가 만료되었습니다. 다시 시도해주세요." });
    }
  });

  app.post("/api/member-oauth/complete-signup", async (req, res) => {
    try {
      const signup = await verifySocialSignupState(req);
      res.clearCookie(MEMBER_SESSION_COOKIE, {
        ...getSessionCookieOptions(req),
      });
      const name = sanitizeText(req.body?.name, 64);
      const phone = sanitizeText(req.body?.phone, 32);
      const birthDate = sanitizeBirthDate(req.body?.birthDate);
      const email = signup.email || sanitizeOptionalEmail(req.body?.email);
      const fieldConfigRow = await getSiteSetting(MEMBER_REGISTER_FIELD_CONFIG_KEY);
      const fieldConfig = parseMemberRegisterFieldConfig(fieldConfigRow?.settingValue);
      const position = fieldConfig.position.visible
        ? sanitizeText(req.body?.position, 64)
        : "";

      if (!name || !phone) {
        return res.status(400).json({ message: "이름, 연락처, 생년월일을 모두 입력해주세요." });
      }
      if (fieldConfig.position.visible && fieldConfig.position.required && !position) {
        return res.status(400).json({ message: "직분 항목을 입력해주세요." });
      }
      if (position) {
        const positionOptions = await getMemberFieldOptions("position");
        if (!positionOptions.some((option) => option.label === position)) {
          return res.status(400).json({ message: "현재 사용할 수 없는 직분입니다. 목록에서 다시 선택해주세요." });
        }
      }

      const result = await createMemberFromSocialSignup(signup, {
        name,
        phone,
        birthDate,
        position,
        email,
      });

      if (result.status === "email_conflict") {
        return res.status(409).json({ message: "이미 사용 중인 이메일입니다." });
      }
      if (!result.member || result.status === "error") {
        return res.status(500).json({ message: "간편가입 처리 중 문제가 발생했습니다." });
      }

      clearSocialSignupCookie(req, res);
      return res.json({ ok: true });
    } catch (error) {
      const message =
        error instanceof Error && error.message === "invalid_email"
          ? "올바른 이메일 형식을 입력해주세요."
          : error instanceof Error && error.message === "invalid_birth_date"
            ? "생년월일을 YYYY-MM-DD 형식으로 입력해주세요."
            : "간편가입 정보가 만료되었습니다. 다시 시도해주세요.";
      return res.status(400).json({ message });
    }
  });

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
    if (mode === "register") {
      res.clearCookie(MEMBER_SESSION_COOKIE, {
        ...getSessionCookieOptions(req),
      });
    }

    const canonicalStartUrl = getCanonicalMemberOAuthStartUrl(req, providerParam, mode);
    if (canonicalStartUrl) {
      return res.redirect(302, canonicalStartUrl);
    }

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
      const oauthState = await verifyOAuthState(req, providerParam, state);
      clearOAuthStateCookie(req, res);
      if (oauthState.mode === "register") {
        res.clearCookie(MEMBER_SESSION_COOKIE, {
          ...getSessionCookieOptions(req),
        });
      }

      const redirectUri = getMemberOAuthRedirectUri(req, providerParam);
      const accessToken = await exchangeAuthorizationCode(providerParam, config, code, redirectUri);
      const profile = await fetchSocialProfile(providerParam, config, accessToken);
      const result = await resolveExistingMemberForProfile(profile, oauthState.mode);

      if (result.status === "needs_signup_details") {
        await setSocialSignupCookie(req, res, profile);
        return res.redirect(303, `/member/social-complete?provider=${providerParam}`);
      }

      if (!result.member || result.status !== "ok") {
        return redirectToLogin(res, {
          social: result.status,
          provider: providerParam,
        });
      }

      if (!canIssueMemberOAuthSession(oauthState.mode, result.member.status)) {
        res.clearCookie(MEMBER_SESSION_COOKIE, {
          ...getSessionCookieOptions(req),
        });
        return redirectToLogin(res, {
          social:
            oauthState.mode === "register" && result.member.status === "approved"
              ? "already_registered"
              : result.created
                ? "registered"
                : getBlockedMemberStatus(result.member.status),
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
