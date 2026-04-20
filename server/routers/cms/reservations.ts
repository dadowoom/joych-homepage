/**
 * 예약 관리 라우터 (cms.reservations)
 * ─────────────────────────────────────────────────────────────────────────────
 * 담당 기능:
 *   - list: 전체 예약 목록 조회 (관리자)
 *   - get: 예약 단건 조회 (관리자)
 *   - approve: 예약 승인 (관리자)
 *   - reject: 예약 거절 (관리자)
 *
 * 접근 권한: 모두 adminProcedure (관리자만 접근 가능)
 */

import { z } from "zod";
import { adminProcedure, router } from "../../_core/trpc";
import {
  getAllReservations,
  getReservationById,
  updateReservationStatus,
} from "../../db";

export const reservationsRouter = router({
  /**
   * 전체 예약 목록 조회 (관리자)
   * - facilityId 미입력 시 전체 시설 예약 조회
   */
  list: adminProcedure
    .input(z.object({ facilityId: z.number().optional() }))
    .query(({ input }) => getAllReservations(input.facilityId)),

  /** 예약 단건 조회 (관리자) */
  get: adminProcedure
    .input(z.object({ id: z.number() }))
    .query(({ input }) => getReservationById(input.id)),

  /**
   * 예약 승인 (관리자)
   * - 승인 시 comment(승인 메모)를 남길 수 있음
   */
  approve: adminProcedure
    .input(z.object({
      id: z.number(),
      comment: z.string().optional(),
    }))
    .mutation(({ input, ctx }) =>
      updateReservationStatus(input.id, "approved", input.comment, ctx.user.id)
    ),

  /**
   * 예약 거절 (관리자)
   * - 거절 시 reason(거절 사유)을 반드시 입력해야 함
   */
  reject: adminProcedure
    .input(z.object({
      id: z.number(),
      comment: z.string().min(1, "거절 사유를 입력해주세요."),
    }))
    .mutation(({ input, ctx }) =>
      updateReservationStatus(input.id, "rejected", input.comment, ctx.user.id)
    ),
});
