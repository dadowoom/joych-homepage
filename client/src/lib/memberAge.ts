import { parseDateKey } from "./koreanDate";

function getKoreaDateParts(referenceDate: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(referenceDate);
  const part = (type: "year" | "month" | "day") => (
    Number(parts.find((item) => item.type === type)?.value)
  );

  return { year: part("year"), month: part("month"), day: part("day") };
}

/**
 * 생년월일(YYYY-MM-DD)을 기준으로 기준일의 만 나이를 계산합니다.
 * 날짜만 비교하므로 브라우저 시간대에 따라 생일이 하루 달라지지 않습니다.
 */
export function getFullAge(
  birthDate: string | null | undefined,
  referenceDate = new Date(),
) {
  if (!birthDate || Number.isNaN(referenceDate.getTime())) return null;

  const birth = parseDateKey(birthDate);
  if (!birth) return null;

  const { year, month, day } = getKoreaDateParts(referenceDate);
  const birthdayHasPassed = month > birth.month || (month === birth.month && day >= birth.day);
  const age = year - birth.year - (birthdayHasPassed ? 0 : 1);

  return age >= 0 ? age : null;
}

export function formatBirthDateWithFullAge(
  birthDate: string | null | undefined,
  referenceDate = new Date(),
) {
  if (!birthDate) return "";

  const age = getFullAge(birthDate, referenceDate);
  return age === null ? birthDate : `${birthDate} (만 ${age}세)`;
}
