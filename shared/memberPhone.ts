export const MEMBER_PHONE_ERROR_MESSAGE =
  "연락처는 010으로 시작하는 휴대전화번호 11자리로 입력해주세요.";

const DOMESTIC_MEMBER_PHONE_RE = /^010\d{8}$/;
const DOMESTIC_INPUT_CHARS_RE = /^[0-9()\-\s]+$/;
const LEGACY_INTERNATIONAL_CHARS_RE = /^\+82[0-9()\-\s]+$/;

function formatDomesticMemberPhone(digits: string) {
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}

/**
 * 신규 가입/수정 입력을 저장 표준인 010-0000-0000으로 정리합니다.
 * +82, 일반전화, 구형 휴대전화 번호와 문자가 섞인 값은 받지 않습니다.
 */
export function normalizeMemberPhone(value: string | null | undefined) {
  const original = value?.trim() ?? "";
  if (!original || !DOMESTIC_INPUT_CHARS_RE.test(original)) return null;

  const digits = original.replace(/\D/g, "");
  if (!DOMESTIC_MEMBER_PHONE_RE.test(digits)) return null;
  return formatDomesticMemberPhone(digits);
}

/**
 * 기존 DB에 남은 정확한 +82 10 번호만 국내 010 표기로 환산합니다.
 * 불명확한 +82 (0)10, 일반전화, 문자/내선 포함 값은 임의 변환하지 않습니다.
 */
export function normalizeLegacyMemberPhone(value: string | null | undefined) {
  const domestic = normalizeMemberPhone(value);
  if (domestic) return domestic;

  const original = value?.trim() ?? "";
  if (!original || !LEGACY_INTERNATIONAL_CHARS_RE.test(original)) return null;

  const digits = original.replace(/\D/g, "");
  if (!/^8210\d{8}$/.test(digits)) return null;
  return formatDomesticMemberPhone(`0${digits.slice(2)}`);
}

/** 입력 중 숫자만 유지하고 010-0000-0000 모양으로 자동 정리합니다. */
export function formatMemberPhoneInput(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 32);
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}
