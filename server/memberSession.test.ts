import type { Request, Response } from "express";
import { describe, expect, it } from "vitest";
import { jwtVerify } from "jose";
import { MEMBER_SESSION_MS } from "@shared/const";
import { getJwtSecretKey } from "./_core/jwtSecret";
import { MEMBER_SESSION_COOKIE, setMemberSessionCookie } from "./_core/memberSession";

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
    });
    expect(typeof payload.exp).toBe("number");
    expect((payload.exp ?? 0) * 1000 - Date.now()).toBeGreaterThan(MEMBER_SESSION_MS - 60_000);
  });
});
