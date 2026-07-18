import { z } from "zod";
import { MEMBER_PHONE_ERROR_MESSAGE, normalizeMemberPhone } from "@shared/memberPhone";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const requiredText = (max: number, message: string) =>
  z.string().trim().min(1, message).max(max, `${max}자 이하로 입력해주세요.`);

export const optionalText = (max: number) =>
  z.string().trim().max(max, `${max}자 이하로 입력해주세요.`).optional();

export const optionalMemberPhone = z.string()
  .trim()
  .max(32, "연락처는 32자 이하로 입력해주세요.")
  .refine(
    (value) => value === "" || normalizeMemberPhone(value) !== null,
    MEMBER_PHONE_ERROR_MESSAGE,
  )
  .transform((value) => value === "" ? value : normalizeMemberPhone(value)!)
  .optional();

export const requiredMemberPhone = z.string()
  .trim()
  .min(1, "연락처를 입력해주세요.")
  .max(32, "연락처는 32자 이하로 입력해주세요.")
  .refine(
    (value) => normalizeMemberPhone(value) !== null,
    MEMBER_PHONE_ERROR_MESSAGE,
  )
  .transform((value) => normalizeMemberPhone(value)!);

export const optionalDate = z.string().regex(DATE_RE, "날짜 형식은 YYYY-MM-DD여야 합니다.").optional();

export const requiredBirthDate = z.string()
  .trim()
  .min(1, "생년월일을 입력해주세요.")
  .regex(DATE_RE, "생년월일은 YYYY-MM-DD 형식이어야 합니다.");

export const memberEmailSchema = z.string()
  .trim()
  .email("올바른 이메일 형식을 입력해주세요.")
  .max(128, "이메일은 128자 이하로 입력해주세요.")
  .transform(email => email.toLowerCase());

export const memberPasswordSchema = z.string()
  .min(8, "비밀번호는 8자 이상이어야 합니다.")
  .max(128, "비밀번호는 128자 이하로 입력해주세요.")
  .refine(
    password => /[A-Za-z]/.test(password) && /\d/.test(password),
    "비밀번호는 영문과 숫자를 모두 포함해야 합니다."
  );

export const memberRegisterInputSchema = z.object({
  email: memberEmailSchema,
  password: memberPasswordSchema,
  name: requiredText(64, "이름을 입력해주세요."),
  phone: requiredMemberPhone,
  birthDate: requiredBirthDate,
  gender: z.enum(["남", "여"]),
  address: optionalText(255),
  emergencyPhone: optionalText(32),
  joinPath: optionalText(64),
  position: requiredText(64, "직분을 선택해주세요."),
  department: optionalText(64),
  district: optionalText(64),
  faithPlusUserId: optionalText(128),
});

export type MemberRegisterInput = z.infer<typeof memberRegisterInputSchema>;
