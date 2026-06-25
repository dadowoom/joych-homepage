/**
 * 예약 관리 라우터 (cms.reservations)
 * ─────────────────────────────────────────────────────────────────────────────
 * 담당 기능:
 *   - list: 전체 예약 목록 조회 (관리자)
 *   - get: 예약 단건 조회 (관리자)
 *   - approve: 예약 승인 (관리자)
 *   - reject: 예약 거절 (관리자)
 *   - approveGroup/rejectGroup: 반복 예약 묶음 승인/거절 (관리자)
 *
 * 접근 권한: 모두 adminProcedure (관리자만 접근 가능)
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { adminPermissionProcedure, router } from "../../_core/trpc";
import { optionalTextSchema, requiredTextSchema } from "../../_core/contentValidation";
import {
  deleteReservationById,
  deleteReservationGroup,
  getAllReservations,
  getReservationById,
  ReservationOverlapError,
  updateReservationDetails,
  updateReservationGroupDetails,
  updateReservationGroupStatus,
  updateReservationStatus,
} from "../../db";

const idSchema = z.number().int().positive();
const groupIdSchema = z.string().min(1).max(80);
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "날짜 형식이 올바르지 않습니다.");
const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "시간은 HH:MM 형식으로 입력해주세요.");
const reservationProcedure = adminPermissionProcedure("content:reservations");

function assertTimeOrder(startTime: string, endTime: string) {
  if (startTime >= endTime) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "시작 시간은 종료 시간보다 빨라야 합니다." });
  }
}

export const reservationsRouter = router({
  /**
   * 전체 예약 목록 조회 (관리자)
   * - facilityId 미입력 시 전체 시설 예약 조회
   */
  list: reservationProcedure
    .input(z.object({ facilityId: idSchema.optional() }))
    .query(({ input }) => getAllReservations(input.facilityId)),

  /** 예약 단건 조회 (관리자) */
  get: reservationProcedure
    .input(z.object({ id: idSchema }))
    .query(({ input }) => getReservationById(input.id)),

  updateTime: reservationProcedure
    .input(z.object({
      id: idSchema,
      reservationDate: dateSchema,
      startTime: timeSchema,
      endTime: timeSchema,
    }))
    .mutation(async ({ input }) => {
      assertTimeOrder(input.startTime, input.endTime);
      try {
        const updated = await updateReservationDetails(input.id, {
          reservationDate: input.reservationDate,
          startTime: input.startTime,
          endTime: input.endTime,
        });
        if (!updated) {
          throw new TRPCError({ code: "NOT_FOUND", message: "예약을 찾을 수 없습니다." });
        }
        return { success: true };
      } catch (error) {
        if (error instanceof ReservationOverlapError) {
          throw new TRPCError({ code: "CONFLICT", message: error.message });
        }
        throw error;
      }
    }),

  updateGroupTime: reservationProcedure
    .input(z.object({
      groupId: groupIdSchema,
      startTime: timeSchema,
      endTime: timeSchema,
    }))
    .mutation(async ({ input }) => {
      assertTimeOrder(input.startTime, input.endTime);
      try {
        const updated = await updateReservationGroupDetails(input.groupId, {
          startTime: input.startTime,
          endTime: input.endTime,
        });
        if (!updated) {
          throw new TRPCError({ code: "NOT_FOUND", message: "반복 예약 묶음을 찾을 수 없습니다." });
        }
        return { success: true };
      } catch (error) {
        if (error instanceof ReservationOverlapError) {
          throw new TRPCError({ code: "CONFLICT", message: error.message });
        }
        throw error;
      }
    }),

  /**
   * 예약 승인 (관리자)
   * - 승인 시 comment(승인 메모)를 남길 수 있음
   */
  approve: reservationProcedure
    .input(z.object({
      id: idSchema,
      comment: optionalTextSchema(20000),
    }))
    .mutation(({ input, ctx }) =>
      updateReservationStatus(input.id, "approved", input.comment, ctx.user.id)
    ),

  /** 반복 예약 묶음 승인 (관리자) */
  approveGroup: reservationProcedure
    .input(z.object({
      groupId: groupIdSchema,
      comment: optionalTextSchema(20000),
    }))
    .mutation(({ input, ctx }) =>
      updateReservationGroupStatus(input.groupId, "approved", input.comment, ctx.user.id)
    ),

  /**
   * 예약 거절 (관리자)
   * - 거절 시 reason(거절 사유)을 반드시 입력해야 함
   */
  reject: reservationProcedure
    .input(z.object({
      id: idSchema,
      comment: requiredTextSchema(20000, "거절 사유를 입력해주세요."),
    }))
    .mutation(({ input, ctx }) =>
      updateReservationStatus(input.id, "rejected", input.comment, ctx.user.id)
    ),

  /** 반복 예약 묶음 거절 (관리자) */
  rejectGroup: reservationProcedure
    .input(z.object({
      groupId: groupIdSchema,
      comment: requiredTextSchema(20000, "거절 사유를 입력해주세요."),
    }))
    .mutation(({ input, ctx }) =>
      updateReservationGroupStatus(input.groupId, "rejected", input.comment, ctx.user.id)
    ),

  delete: reservationProcedure
    .input(z.object({ id: idSchema }))
    .mutation(async ({ input }) => {
      const deleted = await deleteReservationById(input.id);
      if (!deleted) {
        throw new TRPCError({ code: "NOT_FOUND", message: "예약을 찾을 수 없습니다." });
      }
      return { success: true };
    }),

  deleteGroup: reservationProcedure
    .input(z.object({ groupId: groupIdSchema }))
    .mutation(async ({ input }) => {
      const deleted = await deleteReservationGroup(input.groupId);
      if (!deleted) {
        throw new TRPCError({ code: "NOT_FOUND", message: "반복 예약 묶음을 찾을 수 없습니다." });
      }
      return { success: true };
    }),
});
