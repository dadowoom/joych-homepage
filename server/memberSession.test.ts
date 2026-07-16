import type { Request, Response } from "express";
import { describe, expect, it } from "vitest";
import { jwtVerify } from "jose";
import { MEMBER_SESSION_MS } from "@shared/const";
import { getJwtSecretKey } from "./_core/jwtSecret";
import {
  isMemberSessionCurrent,
  MEMBER_SESSION_COOKIE,
  setMemberSessionCookie,
} from "./_core/memberSession";

function mockRequest() {
  return {
    headers: {},
    protocol: "http",
  } as unknown as Request;
}

describe("member session cookies", () => {
  it("sets a persistent 30-day member session cookie", async () => {
    let cookieName = "";
    let cookieValue = "";
    let cookieOptions: Record<string, unknown> = {};
    const res = {
      cookie: (name: string, value: string, options: Record<string, unknown>) => {
        cookieName = name;
        cookieValue = value;
        cookieOptions = options;
      },
    } as unknown as Response;

    await setMemberSessionCookie(mockRequest(), res, {
      id: 123,
      email: "member@example.com",
      name: "테스트 성도",
    });

    expect(cookieName).toBe(MEMBER_SESSION_COOKIE);
    expect(cookieOptions.maxAge).toBe(MEMBER_SESSION_MS);
    expect(cookieOptions.httpOnly).toBe(true);
    expect(cookieOptions.sameSite).toBe("lax");

    const { payload } = await jwtVerify(cookieValue, getJwtSecretKey());
    expect(payload).toMatchObject({
      memberId: 123,
      email: "member@example.com",
      name: "테스트 성도",
      type: "church_member",
      sessionVersion: 0,
    });
    expect(typeof payload.iat).toBe("number");
    expect(typeof payload.exp).toBe("number");
    expect((payload.exp ?? 0) * 1000 - Date.now()).toBeGreaterThan(MEMBER_SESSION_MS - 60_000);
  });

  it("supports non-persistent member session cookies when auto login is off", async () => {
    let cookieOptions: Record<string, unknown> = {};
    const res = {
      cookie: (_name: string, _value: string, options: Record<string, unknown>) => {
        cookieOptions = options;
      },
    } as unknown as Response;

    await setMemberSessionCookie(
      mockRequest(),
      res,
      {
        id: 123,
        email: "member@example.com",
        name: "?뚯뒪???깅룄",
      },
      { persistent: false },
    );

    expect(cookieOptions.maxAge).toBeUndefined();
    expect(cookieOptions.httpOnly).toBe(true);
    expect(cookieOptions.sameSite).toBe("lax");
  });

  it("비밀번호 변경으로 DB 버전이 증가하면 기존 토큰을 거절한다", () => {
    expect(isMemberSessionCurrent({ sessionVersion: 0 }, 1)).toBe(false);
    expect(isMemberSessionCurrent({}, 1)).toBe(false);
  });

  it("DB와 동일한 세션 버전으로 새로 발급된 토큰은 허용한다", () => {
    expect(isMemberSessionCurrent({ sessionVersion: 1 }, 1)).toBe(true);
  });

  it("버전이 0인 기존 회원은 claim 없는 레거시 토큰도 허용한다", () => {
    expect(isMemberSessionCurrent({}, 0)).toBe(true);
  });
});
