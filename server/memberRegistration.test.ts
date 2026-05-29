import { describe, expect, it } from "vitest";
import { memberRegisterInputSchema } from "./_core/memberValidation";

const validSignupInput = {
  email: "MEMBER@Example.COM",
  password: "joyful2026",
  name: "홍길동",
  phone: "010-1234-5678",
};

describe("member registration validation", () => {
  it("정상 회원가입 입력은 이메일을 소문자로 정규화", () => {
    const result = memberRegisterInputSchema.safeParse(validSignupInput);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("member@example.com");
    }
  });

  it("회원가입 연락처는 서버에서도 필수로 검증", () => {
    const { phone: _phone, ...withoutPhone } = validSignupInput;

    expect(memberRegisterInputSchema.safeParse(withoutPhone).success).toBe(false);
  });

  it("비밀번호는 영문과 숫자를 모두 포함해야 함", () => {
    expect(memberRegisterInputSchema.safeParse({
      ...validSignupInput,
      password: "joyfulchurch",
    }).success).toBe(false);

    expect(memberRegisterInputSchema.safeParse({
      ...validSignupInput,
      password: "12345678",
    }).success).toBe(false);
  });

  it("DB 컬럼 길이를 넘는 이메일은 회원가입 전에 차단", () => {
    const longEmail = `${"a".repeat(120)}@example.com`;

    expect(memberRegisterInputSchema.safeParse({
      ...validSignupInput,
      email: longEmail,
    }).success).toBe(false);
  });
});
