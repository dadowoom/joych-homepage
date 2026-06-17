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
import { adminPermissionProcedure, router } from "../../_core/trpc";
import { optionalTextSchema, requiredTextSchema } from "../../_core/contentValidation";
import {
  getAllReservations,
  getReservationById,
  updateReservationGroupStatus,
  updateReservationStatus,
} from "../../db";

const idSchema = z.number().int().positive();
const groupIdSchema = z.string().min(1).max(80);
const reservationProcedure = adminPermissionProcedure("content:reservations");

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
});
