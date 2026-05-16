import type { Request } from "express";
import { describe, expect, it, afterEach } from "vitest";
import {
  getCanonicalMemberOAuthStartUrl,
  getMemberOAuthProviderStatus,
  getMemberOAuthRedirectUri,
  normalizeGoogleProfile,
  normalizeKakaoProfile,
} from "./_core/memberOAuth";

function mockRequest(
  host = "localhost:3000",
  headers: Record<string, string> = {},
  protocol = "http"
) {
  return {
    headers,
    protocol,
    get: (name: string) => (name.toLowerCase() === "host" ? host : undefined),
  } as unknown as Request;
}

describe("member OAuth helpers", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("PUBLIC_URL_BASE를 기준으로 provider별 콜백 주소를 생성", () => {
    process.env.PUBLIC_URL_BASE = "https://dadowoomtest.co.kr/";
    expect(getMemberOAuthRedirectUri(mockRequest(), "google")).toBe(
      "https://dadowoomtest.co.kr/api/member-oauth/google/callback"
    );
    expect(getMemberOAuthRedirectUri(mockRequest(), "kakao")).toBe(
      "https://dadowoomtest.co.kr/api/member-oauth/kakao/callback"
    );
  });

  it("PUBLIC_URL_BASE와 다른 주소에서 간편로그인을 시작하면 공식 도메인으로 정규화", () => {
    process.env.PUBLIC_URL_BASE = "https://dadowoomtest.co.kr/";

    expect(getCanonicalMemberOAuthStartUrl(mockRequest("115.68.224.123:4000"), "kakao", "login")).toBe(
      "https://dadowoomtest.co.kr/api/member-oauth/kakao/start?mode=login"
    );
    expect(
      getCanonicalMemberOAuthStartUrl(
        mockRequest("dadowoomtest.co.kr", { "x-forwarded-proto": "https" }),
        "google",
        "register"
      )
    ).toBeNull();
  });

  it("구글은 client id와 secret이 모두 있어야 활성화", () => {
    delete process.env.GOOGLE_OAUTH_CLIENT_ID;
    delete process.env.GOOGLE_OAUTH_CLIENT_SECRET;
    process.env.KAKAO_REST_API_KEY = "kakao-key";

    expect(getMemberOAuthProviderStatus()).toEqual({ google: false, kakao: true });

    process.env.GOOGLE_OAUTH_CLIENT_ID = "google-client-id";
    expect(getMemberOAuthProviderStatus().google).toBe(false);

    process.env.GOOGLE_OAUTH_CLIENT_SECRET = "google-secret";
    expect(getMemberOAuthProviderStatus().google).toBe(true);
  });

  it("구글 프로필을 성도 소셜 프로필로 정규화", () => {
    expect(normalizeGoogleProfile({
      sub: "google-user-id",
      email: "USER@Example.COM",
      email_verified: true,
      name: "홍길동",
      picture: "https://example.com/profile.png",
    })).toEqual({
      provider: "google",
      providerUserId: "google-user-id",
      email: "user@example.com",
      emailVerified: true,
      displayName: "홍길동",
      profileImageUrl: "https://example.com/profile.png",
    });
  });

  it("카카오 이메일이 없는 계정은 별도 안내 상태로 처리할 수 있게 null로 정규화", () => {
    expect(normalizeKakaoProfile({
      id: 12345,
      kakao_account: {
        profile: { nickname: "기쁨성도" },
      },
    })).toMatchObject({
      provider: "kakao",
      providerUserId: "12345",
      email: null,
      emailVerified: null,
      displayName: "기쁨성도",
    });
  });
});
