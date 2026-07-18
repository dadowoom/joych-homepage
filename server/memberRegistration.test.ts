import { describe, expect, it } from "vitest";
import { memberRegisterInputSchema } from "./_core/memberValidation";

const validSignupInput = {
  email: "MEMBER@Example.COM",
  password: "joyful2026",
  name: "홍길동",
  phone: "010-1234-5678",
  birthDate: "1990-01-02",
  gender: "남" as const,
  position: "집사",
};

describe("member registration validation", () => {
  it("정상 회원가입 입력은 이메일을 소문자로 정규화한다", () => {
    const result = memberRegisterInputSchema.safeParse(validSignupInput);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("member@example.com");
      expect(result.data.phone).toBe("010-1234-5678");
    }
  });

  it("하이픈이 없는 010 연락처도 저장 표준으로 정규화한다", () => {
    const result = memberRegisterInputSchema.safeParse({
      ...validSignupInput,
      phone: "01012345678",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.phone).toBe("010-1234-5678");
    }
  });

  it.each([
    "+82 10-1234-5678",
    "02-1234-5678",
    "011-1234-5678",
    "010-123-5678",
    "010123456789",
    "010-1234-5678 내선 1",
  ])("010이 아닌 연락처를 회원가입에서 차단한다: %s", (phone) => {
    expect(memberRegisterInputSchema.safeParse({
      ...validSignupInput,
      phone,
    }).success).toBe(false);
  });

  it.each(["phone", "birthDate", "gender", "position"] as const)("%s 누락은 설정과 무관하게 회원가입 전에 차단한다", (key) => {
    const input = { ...validSignupInput } as Record<string, unknown>;
    delete input[key];

    expect(memberRegisterInputSchema.safeParse(input).success).toBe(false);
  });

  it("직분 입력의 앞뒤 공백을 정리한다", () => {
    const result = memberRegisterInputSchema.safeParse({
      ...validSignupInput,
      position: "  집사  ",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.position).toBe("집사");
    }
  });

  it("공백뿐인 직분은 회원가입 전에 차단한다", () => {
    expect(memberRegisterInputSchema.safeParse({
      ...validSignupInput,
      position: "   ",
    }).success).toBe(false);
  });

  it("직분은 DB 컬럼 길이인 64자를 넘길 수 없다", () => {
    expect(memberRegisterInputSchema.safeParse({
      ...validSignupInput,
      position: "직".repeat(65),
    }).success).toBe(false);
  });

  it("비밀번호는 영문과 숫자를 모두 포함해야 한다", () => {
    expect(memberRegisterInputSchema.safeParse({
      ...validSignupInput,
      password: "joyfulchurch",
    }).success).toBe(false);

    expect(memberRegisterInputSchema.safeParse({
      ...validSignupInput,
      password: "12345678",
    }).success).toBe(false);
  });

  it("DB 컬럼 길이를 넘는 이메일은 회원가입 전에 차단한다", () => {
    const longEmail = `${"a".repeat(120)}@example.com`;

    expect(memberRegisterInputSchema.safeParse({
      ...validSignupInput,
      email: longEmail,
    }).success).toBe(false);
  });
});
