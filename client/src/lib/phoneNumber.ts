import { normalizeLegacyMemberPhone } from "@shared/memberPhone";

/** 전화번호 원문을 화면 표시용 하이픈 형식으로 정리합니다. */
export function formatPhoneNumber(value: string | null | undefined) {
  const original = value?.trim() ?? "";
  if (!original) return "";

  const memberPhone = normalizeLegacyMemberPhone(original);
  if (memberPhone) return memberPhone;

  if (original.startsWith("+") || /[A-Za-z가-힣#]/.test(original)) return original;

  const digits = original.replace(/\D/g, "");
  if (digits.startsWith("02")) {
    if (digits.length === 9) return `${digits.slice(0, 2)}-${digits.slice(2, 5)}-${digits.slice(5)}`;
    if (digits.length === 10) return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11) return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  if (digits.length === 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  if (digits.length === 8) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  return original;
}
