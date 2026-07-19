import { describe, expect, it } from "vitest";
import { getClientIp } from "./_core/rateLimiter";

describe("getClientIp", () => {
  it("Express가 검증한 req.ip를 임의의 전달 헤더보다 우선한다", () => {
    expect(getClientIp({
      ip: "203.0.113.10",
      headers: { "x-forwarded-for": "198.51.100.99" },
    })).toBe("203.0.113.10");
  });

  it("req.ip가 없는 테스트 환경에서는 첫 전달 주소를 사용한다", () => {
    expect(getClientIp({
      headers: { "x-forwarded-for": "198.51.100.10, 127.0.0.1" },
    })).toBe("198.51.100.10");
  });
});
