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
  getVehicleById,
  getVehicleReservationById,
  updateVehicleReservationDetails,
  updateVehicleReservationStatus,
  VehicleReservationOverlapError,
} from "../../db";

const idSchema = z.number().int().positive();
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "날짜 형식이 올바르지 않습니다.");
const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "시간은 HH:MM 형식으로 입력해주세요.");
const vehicleReservationProcedure = adminPermissionProcedure("content:vehicles");

function toMinutes(time: string) {
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + minute;
}

function assertTimeOrder(startTime: string, endTime: string) {
  if (startTime >= endTime) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "시작 시간은 종료 시간보다 빨라야 합니다." });
  }
}

export const vehicleReservationsRouter = router({
  list: vehicleReservationProcedure
    .input(z.object({ vehicleId: idSchema.optional() }))
    .query(({ input }) => getAllVehicleReservations(input.vehicleId)),

  get: vehicleReservationProcedure
    .input(z.object({ id: idSchema }))
    .query(({ input }) => getVehicleReservationById(input.id)),

  updateTime: vehicleReservationProcedure
    .input(z.object({
      id: idSchema,
      reservationDate: dateSchema,
      startTime: timeSchema,
      endTime: timeSchema,
    }))
    .mutation(async ({ input }) => {
      assertTimeOrder(input.startTime, input.endTime);

      const reservation = await getVehicleReservationById(input.id);
      if (!reservation) {
        throw new TRPCError({ code: "NOT_FOUND", message: "차량 예약을 찾을 수 없습니다." });
      }
      const vehicle = await getVehicleById(reservation.vehicleId);
      if (!vehicle) {
        throw new TRPCError({ code: "NOT_FOUND", message: "차량을 찾을 수 없습니다." });
      }
      if (toMinutes(input.startTime) < toMinutes(vehicle.openTime) || toMinutes(input.endTime) > toMinutes(vehicle.closeTime)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `차량 예약은 운영 시간(${vehicle.openTime}~${vehicle.closeTime}) 내에서만 가능합니다.`,
        });
      }

      try {
        const updated = await updateVehicleReservationDetails(input.id, {
          reservationDate: input.reservationDate,
          startTime: input.startTime,
          endTime: input.endTime,
        });
        if (!updated) {
          throw new TRPCError({ code: "NOT_FOUND", message: "차량 예약을 찾을 수 없습니다." });
        }
        return { success: true };
      } catch (error) {
        if (error instanceof VehicleReservationOverlapError) {
          throw new TRPCError({ code: "CONFLICT", message: error.message });
        }
        throw error;
      }
    }),

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
