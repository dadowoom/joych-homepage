import { TRPCError } from "@trpc/server";
import type { TrpcContext } from "./_core/context";
import { hasCourseRoomManagementAccess } from "./db";
import {
  parseCourseFacilityCustomDates,
  parseCourseFacilityRepeatDays,
} from "../shared/courseFacilitySchedule";

export const DEFAULT_COURSE_PAGE_HREF = "/education/courses";

type CourseFacilityScheduleValue = {
  pageHref?: string | null;
  facilityId?: number | null;
  facilityRepeatMode?: string | null;
  facilityRepeatDays?: number[] | string | null;
  facilityCustomDates?: string[] | string | null;
  startDate?: string | null;
  endDate?: string | null;
  startTime?: string | null;
  endTime?: string | null;
};

type CourseScheduleAccessContext = Pick<TrpcContext, "user" | "memberId">;

function normalizePageHref(pageHref?: string | null) {
  return pageHref?.trim() || DEFAULT_COURSE_PAGE_HREF;
}

function isCustomSchedule(value?: CourseFacilityScheduleValue | null) {
  return value?.facilityRepeatMode === "custom";
}

function getScheduleSignature(value: CourseFacilityScheduleValue) {
  return JSON.stringify({
    pageHref: normalizePageHref(value.pageHref),
    facilityId: value.facilityId ?? null,
    facilityRepeatMode: value.facilityRepeatMode ?? "none",
    facilityRepeatDays: parseCourseFacilityRepeatDays(value.facilityRepeatDays).slice().sort((a, b) => a - b),
    facilityCustomDates: parseCourseFacilityCustomDates(value.facilityCustomDates).slice().sort(),
    startDate: value.startDate ?? null,
    endDate: value.endDate ?? null,
    startTime: value.startTime ?? null,
    endTime: value.endTime ?? null,
  });
}

export async function canUseCourseCustomSchedule(
  ctx: CourseScheduleAccessContext,
  pageHref?: string | null,
) {
  if (ctx.user?.role === "admin") return true;
  if (!ctx.memberId) return false;
  return hasCourseRoomManagementAccess(ctx.memberId, normalizePageHref(pageHref));
}

export async function assertCourseCustomScheduleAccess(
  ctx: CourseScheduleAccessContext,
  nextCourse: CourseFacilityScheduleValue,
  currentCourse?: CourseFacilityScheduleValue | null,
) {
  const usesCustomSchedule = isCustomSchedule(nextCourse) || isCustomSchedule(currentCourse);
  if (!usesCustomSchedule) return;

  if (await canUseCourseCustomSchedule(ctx, nextCourse.pageHref)) return;

  const keepsExistingSchedule = Boolean(
    currentCourse
      && isCustomSchedule(currentCourse)
      && isCustomSchedule(nextCourse)
      && getScheduleSignature(currentCourse) === getScheduleSignature(nextCourse),
  );
  if (keepsExistingSchedule) return;

  throw new TRPCError({
    code: "FORBIDDEN",
    message: "임의 날짜 선택은 관리자 또는 해당 강좌방 담당자만 사용할 수 있습니다.",
  });
}
