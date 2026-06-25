/**
 * 차량 예약 승인 관리 라우터 (cms.vehicleReservations)
 */

import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { adminPermissionProcedure, router } from "../../_core/trpc";
import { optionalTextSchema, requiredTextSchema } from "../../_core/contentValidation";
import {
  deleteVehicleReservationById,
  getAllVehicleReservations,
  getVehicleReservationById,
  updateVehicleReservationStatus,
} from "../../db";

const idSchema = z.number().int().positive();
const vehicleReservationProcedure = adminPermissionProcedure("content:vehicles");

export const vehicleReservationsRouter = router({
  list: vehicleReservationProcedure
    .input(z.object({ vehicleId: idSchema.optional() }))
    .query(({ input }) => getAllVehicleReservations(input.vehicleId)),

  get: vehicleReservationProcedure
    .input(z.object({ id: idSchema }))
    .query(({ input }) => getVehicleReservationById(input.id)),

  approve: vehicleReservationProcedure
    .input(z.object({
      id: idSchema,
      comment: optionalTextSchema(20000),
    }))
    .mutation(({ input, ctx }) =>
      updateVehicleReservationStatus(input.id, "approved", input.comment, ctx.user.id)
    ),

  reject: vehicleReservationProcedure
    .input(z.object({
      id: idSchema,
      comment: requiredTextSchema(20000, "거절 사유를 입력해주세요."),
    }))
    .mutation(({ input, ctx }) =>
      updateVehicleReservationStatus(input.id, "rejected", input.comment, ctx.user.id)
    ),

  cancel: vehicleReservationProcedure
    .input(z.object({
      id: idSchema,
      comment: optionalTextSchema(20000),
    }))
    .mutation(({ input, ctx }) =>
      updateVehicleReservationStatus(input.id, "cancelled", input.comment, ctx.user.id)
    ),

  delete: vehicleReservationProcedure
    .input(z.object({ id: idSchema }))
    .mutation(async ({ input }) => {
      const deleted = await deleteVehicleReservationById(input.id);
      if (!deleted) {
        throw new TRPCError({ code: "NOT_FOUND", message: "차량 예약을 찾을 수 없습니다." });
      }
      return { success: true };
    }),
});
