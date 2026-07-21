import { addDaysToDateKey } from "./facilityReservationPolicy";

export const COURSE_MANAGER_FACILITY_RESERVATION_ADVANCE_DAYS = 365;

type CourseFacilityReservationInput = {
  facilityId?: number | null;
  startDate?: string | null;
  startTime?: string | null;
  endTime?: string | null;
};

function getKstNowParts(now: Date) {
  const shifted = new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString();
  return {
    dateKey: shifted.slice(0, 10),
    time: shifted.slice(11, 16),
  };
}

export function getCourseManagerFacilityReservationMaxDateKey(todayDateKey: string) {
  return addDaysToDateKey(todayDateKey, COURSE_MANAGER_FACILITY_RESERVATION_ADVANCE_DAYS)
    ?? todayDateKey;
}

/**
 * 강좌 담당자가 강좌 개설과 함께 만드는 시설예약 전용 정책입니다.
 * 시설 운영시간/차단일은 적용하지 않으며, 지난 일정·365일 범위·시간 순서만 검사합니다.
 * 실제 중복 여부는 DB 예약 잠금과 겹침 검사에서 최종 차단합니다.
 */
export function getCourseFacilityReservationRestriction(
  value: CourseFacilityReservationInput,
  now = new Date(),
) {
  if (!value.facilityId) return null;

  if (!value.startDate || !value.startTime || !value.endTime) {
    return "시설예약을 연결하려면 강좌 시작일과 시작·종료 시간을 모두 입력해주세요.";
  }
  if (value.startTime >= value.endTime) {
    return "시설예약 종료 시간은 시작 시간보다 늦어야 합니다.";
  }

  const current = getKstNowParts(now);
  if (value.startDate < current.dateKey) {
    return "지난 일정에는 강좌 시설예약을 만들 수 없습니다.";
  }

  const maxDateKey = getCourseManagerFacilityReservationMaxDateKey(current.dateKey);
  if (value.startDate > maxDateKey) {
    return `강좌 시설예약은 오늘부터 365일 이내(${maxDateKey}까지)만 가능합니다.`;
  }
  if (value.startDate === current.dateKey && value.startTime <= current.time) {
    return "이미 지난 시간에는 강좌 시설예약을 만들 수 없습니다.";
  }

  return null;
}
