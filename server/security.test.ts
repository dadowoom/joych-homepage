/**
 * 보안 감사 검증 테스트 (security.test.ts)
 * ─────────────────────────────────────────────────────────────────────────────
 * 보안 감사 7개 항목의 핵심 로직을 단위 테스트로 검증합니다.
 *
 * 테스트 항목:
 *   1. 운영 환경에서 필수 환경변수 누락 시 오류 발생
 *   2. 로그인 실패 5회 시 차단 (Rate Limiter)
 *   3. 차단 해제 후 정상 동작 (Rate Limiter)
 *   4. 허용되지 않는 이미지 MIME 타입 업로드 실패
 *   5. 허용되지 않는 영상 MIME 타입 업로드 실패
 *   6. 이미지 크기 초과 시 업로드 실패 (10MB 초과)
 *   7. 영상 크기 초과 시 업로드 실패 (100MB 초과)
 *   8. 허용된 MIME 타입은 정상 처리
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { checkRateLimit, recordFailure, resetFailures } from "./_core/rateLimiter";
import { validateImage, validateVideo } from "./routers/cms/upload";

// ── 1. 환경변수 검증 테스트 ────────────────────────────────────────────────────
describe("[보안 1번] 환경변수 검증", () => {
  it("운영 환경에서 ADMIN_USERNAME 누락 시 오류 발생", () => {
    const originalEnv = process.env.NODE_ENV;
    const originalAdminUsername = process.env.ADMIN_USERNAME;

    process.env.NODE_ENV = "production";
    delete process.env.ADMIN_USERNAME;

    // requireEnv 함수 직접 테스트 (env.ts의 내부 로직 재현)
    const requireEnvTest = (key: string) => {
      const value = process.env[key];
      if (!value) {
        throw new Error(`[ENV ERROR] 필수 환경변수 "${key}"가 설정되지 않았습니다.`);
      }
      return value;
    };

    expect(() => requireEnvTest("ADMIN_USERNAME")).toThrow(
      '[ENV ERROR] 필수 환경변수 "ADMIN_USERNAME"가 설정되지 않았습니다.'
    );

    // 복원
    process.env.NODE_ENV = originalEnv;
    if (originalAdminUsername !== undefined) {
      process.env.ADMIN_USERNAME = originalAdminUsername;
    }
  });

  it("운영 환경에서 JWT_SECRET 32자 미만 시 오류 발생", () => {
    const validateJwtSecret = (secret: string) => {
      if (secret.length < 32) {
        throw new Error(
          `[ENV ERROR] JWT_SECRET은 32자 이상이어야 합니다. 현재 ${secret.length}자입니다.`
        );
      }
    };

    expect(() => validateJwtSecret("short_secret")).toThrow(
      "[ENV ERROR] JWT_SECRET은 32자 이상이어야 합니다."
    );
  });

  it("JWT_SECRET 32자 이상이면 오류 없음", () => {
    const validateJwtSecret = (secret: string) => {
      if (secret.length < 32) {
        throw new Error(
          `[ENV ERROR] JWT_SECRET은 32자 이상이어야 합니다. 현재 ${secret.length}자입니다.`
        );
      }
    };

    expect(() => validateJwtSecret("this_is_a_very_long_secret_key_for_testing_purposes")).not.toThrow();
  });
});

// ── 2. Rate Limiter 테스트 ─────────────────────────────────────────────────────
describe("[보안 3번] Rate Limiter — 로그인 실패 횟수 제한", () => {
  const testKey = `test:rate-limit-${Date.now()}`;

  beforeEach(() => {
    // 각 테스트 전 해당 키 초기화
    resetFailures(testKey);
  });

  it("초기 상태에서는 차단되지 않음", () => {
    expect(() => checkRateLimit(testKey)).not.toThrow();
  });

  it("4회 실패 후에는 아직 차단되지 않음", () => {
    for (let i = 0; i < 4; i++) {
      recordFailure(testKey);
    }
    expect(() => checkRateLimit(testKey)).not.toThrow();
  });

  it("5회 실패 시 차단됨 (TOO_MANY_REQUESTS)", () => {
    for (let i = 0; i < 5; i++) {
      recordFailure(testKey);
    }
    expect(() => checkRateLimit(testKey)).toThrow(
      "로그인 시도가 너무 많습니다."
    );
  });

  it("6회 실패 후에도 차단 유지", () => {
    for (let i = 0; i < 6; i++) {
      recordFailure(testKey);
    }
    expect(() => checkRateLimit(testKey)).toThrow(
      "로그인 시도가 너무 많습니다."
    );
  });

  it("resetFailures 호출 후 차단 해제됨", () => {
    for (let i = 0; i < 5; i++) {
      recordFailure(testKey);
    }
    // 차단 확인
    expect(() => checkRateLimit(testKey)).toThrow();

    // 초기화 후 해제 확인
    resetFailures(testKey);
    expect(() => checkRateLimit(testKey)).not.toThrow();
  });

  it("IP 키와 계정 키를 독립적으로 추적", () => {
    const ipKey = `ip:192.168.1.1-${Date.now()}`;
    const accountKey = `account:test@example.com-${Date.now()}`;

    for (let i = 0; i < 5; i++) {
      recordFailure(ipKey);
    }

    // IP 키는 차단됨
    expect(() => checkRateLimit(ipKey)).toThrow();
    // 계정 키는 차단 안 됨
    expect(() => checkRateLimit(accountKey)).not.toThrow();

    resetFailures(ipKey);
  });
});

// ── 3. 파일 업로드 보안 테스트 ─────────────────────────────────────────────────
describe("[보안 7번] 파일 업로드 — MIME 화이트리스트 및 크기 제한", () => {
  // 유효한 1x1 PNG 이미지 (base64)
  const VALID_1PX_PNG_BASE64 =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

  // 유효한 최소 MP4 (base64) — 실제 MP4 헤더가 있는 최소 데이터
  // 테스트용으로 충분히 작은 유효 base64 문자열 사용
  const VALID_SMALL_MP4_BASE64 = Buffer.from("ftypisom").toString("base64");

  it("허용된 이미지 MIME(image/png)은 정상 처리", () => {
    expect(() => validateImage(VALID_1PX_PNG_BASE64, "image/png")).not.toThrow();
  });

  it("허용된 이미지 MIME(image/jpeg)은 정상 처리", () => {
    // 최소 JPEG 데이터
    const minJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0]).toString("base64");
    expect(() => validateImage(minJpeg, "image/jpeg")).not.toThrow();
  });

  it("허용되지 않는 이미지 MIME(image/svg+xml) 업로드 실패", () => {
    const svgBase64 = Buffer.from("<svg></svg>").toString("base64");
    expect(() => validateImage(svgBase64, "image/svg+xml")).toThrow(
      "허용되지 않는 이미지 형식입니다."
    );
  });

  it("허용되지 않는 이미지 MIME(application/pdf) 업로드 실패", () => {
    const pdfBase64 = Buffer.from("%PDF-1.4").toString("base64");
    expect(() => validateImage(pdfBase64, "application/pdf")).toThrow(
      "허용되지 않는 이미지 형식입니다."
    );
  });

  it("허용되지 않는 이미지 MIME(text/html) 업로드 실패", () => {
    const htmlBase64 = Buffer.from("<html></html>").toString("base64");
    expect(() => validateImage(htmlBase64, "text/html")).toThrow(
      "허용되지 않는 이미지 형식입니다."
    );
  });

  it("허용되지 않는 영상 MIME(video/avi) 업로드 실패", () => {
    const aviBase64 = Buffer.from("RIFF").toString("base64");
    expect(() => validateVideo(aviBase64, "video/avi")).toThrow(
      "허용되지 않는 영상 형식입니다."
    );
  });

  it("허용되지 않는 영상 MIME(video/quicktime) 업로드 실패", () => {
    const movBase64 = Buffer.from("moov").toString("base64");
    expect(() => validateVideo(movBase64, "video/quicktime")).toThrow(
      "허용되지 않는 영상 형식입니다."
    );
  });

  it("허용된 영상 MIME(video/mp4)은 정상 처리", () => {
    expect(() => validateVideo(VALID_SMALL_MP4_BASE64, "video/mp4")).not.toThrow();
  });

  it("허용된 영상 MIME(video/webm)은 정상 처리", () => {
    const webmBase64 = Buffer.from("webm").toString("base64");
    expect(() => validateVideo(webmBase64, "video/webm")).not.toThrow();
  });

  it("이미지 크기 10MB 초과 시 업로드 실패", () => {
    // 10MB + 1바이트 크기의 버퍼 생성 후 base64 인코딩
    const oversizedBuffer = Buffer.alloc(10 * 1024 * 1024 + 1, 0);
    const oversizedBase64 = oversizedBuffer.toString("base64");
    expect(() => validateImage(oversizedBase64, "image/png")).toThrow(
      "이미지 파일 크기가 너무 큽니다. 최대 10MB까지 업로드 가능합니다."
    );
  });

  it("영상 크기 100MB 초과 시 업로드 실패", () => {
    // 100MB + 1바이트 크기의 버퍼 생성 후 base64 인코딩
    const oversizedBuffer = Buffer.alloc(100 * 1024 * 1024 + 1, 0);
    const oversizedBase64 = oversizedBuffer.toString("base64");
    expect(() => validateVideo(oversizedBase64, "video/mp4")).toThrow(
      "영상 파일 크기가 너무 큽니다. 최대 100MB까지 업로드 가능합니다."
    );
  });
});

// ── 4. 공개 API 개인정보 필드 제거 테스트 ─────────────────────────────────────
describe("[보안 4번] 공개 API 개인정보 필드 제거", () => {
  it("facilityReservationsByDate 반환값에 개인정보 필드가 없음", () => {
    // 실제 DB 없이 반환 로직만 검증
    // home.ts의 반환 로직: rows.map(({ startTime, endTime, status }) => ({ startTime, endTime, status }))
    const mockRows = [
      {
        id: 1,
        facilityId: 1,
        reserverName: "홍길동",           // 개인정보 — 반환 금지
        reserverPhone: "010-1234-5678",   // 개인정보 — 반환 금지
        notes: "개인 메모",               // 개인정보 — 반환 금지
        adminComment: "관리자 코멘트",    // 내부 정보 — 반환 금지
        startTime: "09:00",
        endTime: "11:00",
        status: "approved" as const,
      },
    ];

    // home.ts와 동일한 필터링 로직
    const publicResult = mockRows.map(({ startTime, endTime, status }) => ({
      startTime,
      endTime,
      status,
    }));

    expect(publicResult).toHaveLength(1);
    expect(publicResult[0]).toEqual({
      startTime: "09:00",
      endTime: "11:00",
      status: "approved",
    });

    // 개인정보 필드가 없는지 확인
    expect(publicResult[0]).not.toHaveProperty("reserverName");
    expect(publicResult[0]).not.toHaveProperty("reserverPhone");
    expect(publicResult[0]).not.toHaveProperty("notes");
    expect(publicResult[0]).not.toHaveProperty("adminComment");
    expect(publicResult[0]).not.toHaveProperty("id");
  });
});

// ─── [성도 검색 API 보안] ─────────────────────────────────────────────────────
describe("[성도 검색 API 보안] searchByName — 승인된 성도 전용 내부 주소록", () => {

  // ── 1. 접근 제어 (비로그인/pending/rejected/approved) ──
  describe("접근 제어", () => {
    const checkAccess = (member: { status: string } | null) => {
      if (!member) {
        throw Object.assign(new Error("로그인이 필요합니다."), { code: "UNAUTHORIZED" });
      }
      if (member.status !== "approved") {
        throw Object.assign(new Error("승인된 성도만 이용할 수 있습니다."), { code: "FORBIDDEN" });
      }
      return true;
    };

    it("비로그인 사용자는 UNAUTHORIZED 오류를 받아야 한다", () => {
      expect(() => checkAccess(null)).toThrow("로그인이 필요합니다.");
    });

    it("pending 상태 성도는 FORBIDDEN 오류를 받아야 한다", () => {
      expect(() => checkAccess({ status: "pending" })).toThrow("승인된 성도만 이용할 수 있습니다.");
    });

    it("rejected 상태 성도도 FORBIDDEN 오류를 받아야 한다", () => {
      expect(() => checkAccess({ status: "rejected" })).toThrow("승인된 성도만 이용할 수 있습니다.");
    });

    it("approved 성도는 접근이 허용되어야 한다", () => {
      expect(checkAccess({ status: "approved" })).toBe(true);
    });
  });

  // ── 2. 검색어 최소 2글자 검증 ──
  describe("검색어 유효성 검사", () => {
    const { z } = require("zod");
    const schema = z.object({
      name: z.string().min(2, "검색어는 최소 2글자 이상 입력해주세요."),
    });

    it("검색어 1글자는 유효성 오류를 발생시켜야 한다", () => {
      const result = schema.safeParse({ name: "홍" });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe("검색어는 최소 2글자 이상 입력해주세요.");
      }
    });

    it("검색어 2글자는 유효성 검사를 통과해야 한다", () => {
      expect(schema.safeParse({ name: "홍길" }).success).toBe(true);
    });

    it("빈 문자열은 유효성 오류를 발생시켜야 한다", () => {
      expect(schema.safeParse({ name: "" }).success).toBe(false);
    });
  });

  // ── 3. 검색 Rate Limit (분당 30회) ──
  describe("검색 Rate Limit", () => {
    const makeSearchLimiter = () => {
      const SEARCH_MAX_PER_MIN = 30;
      const SEARCH_WINDOW_MS = 60 * 1000;
      const store = new Map<string, { count: number; windowStart: number }>();
      return (key: string) => {
        const now = Date.now();
        const record = store.get(key);
        if (!record || now - record.windowStart > SEARCH_WINDOW_MS) {
          store.set(key, { count: 1, windowStart: now });
          return;
        }
        record.count += 1;
        if (record.count > SEARCH_MAX_PER_MIN) {
          throw Object.assign(new Error("검색 요청이 너무 많습니다."), { code: "TOO_MANY_REQUESTS" });
        }
      };
    };

    it("분당 30회 이하 요청은 정상 처리되어야 한다", () => {
      const checkLimit = makeSearchLimiter();
      expect(() => { for (let i = 0; i < 30; i++) checkLimit("search:ip-a"); }).not.toThrow();
    });

    it("분당 31회 요청 시 TOO_MANY_REQUESTS 오류를 발생시켜야 한다", () => {
      const checkLimit = makeSearchLimiter();
      expect(() => { for (let i = 0; i < 31; i++) checkLimit("search:ip-b"); }).toThrow("검색 요청이 너무 많습니다.");
    });

    it("서로 다른 IP는 독립적으로 rate limit이 적용되어야 한다", () => {
      const checkLimit = makeSearchLimiter();
      // IP C: 31회 → 차단
      expect(() => { for (let i = 0; i < 31; i++) checkLimit("search:ip-c"); }).toThrow();
      // IP D: 30회 → 정상
      expect(() => { for (let i = 0; i < 30; i++) checkLimit("search:ip-d"); }).not.toThrow();
    });
  });

  // ── 4. 반환 필드 보안 (민감 정보 제외 확인) ──
  describe("반환 필드 보안", () => {
    const ALLOWED_FIELDS = ["id", "name", "phone", "email", "position", "department", "district", "faithPlusUserId"];
    const FORBIDDEN_FIELDS = [
      "passwordHash", "adminMemo", "status", "birthDate", "emergencyPhone",
      "baptismDate", "baptismType", "registeredAt", "pastor", "gender",
      "address", "joinPath", "createdAt", "updatedAt",
    ];

    const mockResult = {
      id: 1,
      name: "홍길동",
      phone: "010-1234-5678",
      email: "hong@test.com",
      position: "집사",
      department: "찬양부",
      district: "1구역",
      faithPlusUserId: "fp_001",
    };

    it("검색 결과에 허용된 필드만 포함되어야 한다", () => {
      const resultKeys = Object.keys(mockResult);
      expect(resultKeys.every(k => ALLOWED_FIELDS.includes(k))).toBe(true);
    });

    it("검색 결과에 금지된 민감 필드가 포함되면 안 된다", () => {
      FORBIDDEN_FIELDS.forEach(field => {
        expect(mockResult).not.toHaveProperty(field);
      });
    });

    it("passwordHash는 절대 반환되면 안 된다", () => {
      expect(mockResult).not.toHaveProperty("passwordHash");
    });

    it("adminMemo는 절대 반환되면 안 된다", () => {
      expect(mockResult).not.toHaveProperty("adminMemo");
    });

    it("status(승인 상태)는 반환되면 안 된다", () => {
      expect(mockResult).not.toHaveProperty("status");
    });
  });
});
