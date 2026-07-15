/**
 * 차량 예약 승인 관리 라우터 (cms.vehicleReservations)
 */

import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { adminPermissionProcedure, router } from "../../_core/trpc";
import { optionalTextSchema, requiredTextSchema } from "../../_core/contentValidation";
import {
  cancelVehicleReservationGroup,
  deleteVehicleReservationById,
  getAllVehicleReservations,
  getVehicleById,
  getVehicleReservationById,
  updateVehicleReservationDetails,
  updateVehicleReservationStatus,
  VehicleReservationOverlapError,
} from "../../db";
import { notifyVehicleReservationResult } from "../../_core/pushNotifications";

const idSchema = z.number().int().positive();
const groupIdSchema = z.string().trim().min(1).max(64);
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "날짜 형식이 올바르지 않습니다.");
const timeSchema = z.string().regex(/^(([01]\d|2[0-3]):[0-5]\d|24:00)$/, "시간은 HH:MM 형식으로 입력해주세요.");
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

type VehicleResultStatus = "approved" | "rejected" | "cancelled";

async function notifyVehicleResultById(id: number, status: VehicleResultStatus) {
  const reservation = await getVehicleReservationById(id);
  if (!reservation) return;

  void notifyVehicleReservationResult({
    memberId: reservation.userId,
    status,
    vehicleName: reservation.vehicleName,
    date: reservation.reservationDate,
    startTime: reservation.startTime,
    endTime: reservation.endTime,
    reservationId: reservation.id,
  });
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
    .mutation(async ({ input, ctx }) => {
      await updateVehicleReservationStatus(input.id, "approved", input.comment, ctx.user.id);
      await notifyVehicleResultById(input.id, "approved");
      return { success: true };
    }),

  reject: vehicleReservationProcedure
    .input(z.object({
      id: idSchema,
      comment: requiredTextSchema(20000, "거절 사유를 입력해주세요."),
    }))
    .mutation(async ({ input, ctx }) => {
      await updateVehicleReservationStatus(input.id, "rejected", input.comment, ctx.user.id);
      await notifyVehicleResultById(input.id, "rejected");
      return { success: true };
    }),

  cancel: vehicleReservationProcedure
    .input(z.object({
      id: idSchema,
      comment: optionalTextSchema(20000),
    }))
    .mutation(async ({ input, ctx }) => {
      await updateVehicleReservationStatus(input.id, "cancelled", input.comment, ctx.user.id);
      await notifyVehicleResultById(input.id, "cancelled");
      return { success: true };
    }),

  /** 반복 차량예약의 승인/대기 회차 일괄 취소 (관리자) */
  cancelGroup: vehicleReservationProcedure
    .input(z.object({
      groupId: groupIdSchema,
      comment: optionalTextSchema(20000),
    }))
    .mutation(async ({ input, ctx }) => {
      const result = await cancelVehicleReservationGroup(input.groupId, ctx.user.id, input.comment);
      if (result.status === "not_found") {
        throw new TRPCError({ code: "NOT_FOUND", message: "반복 차량예약 묶음을 찾을 수 없습니다." });
      }
      if (result.status === "not_cancellable") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "일괄 취소할 수 있는 승인 또는 대기 회차가 없습니다." });
      }

      void notifyVehicleReservationResult({
        memberId: result.representative.userId,
        status: "cancelled",
        vehicleName: result.representative.vehicleName,
        date: result.representative.reservationDate,
        startTime: result.representative.startTime,
        endTime: result.representative.endTime,
        reservationId: result.representative.id,
        extraCount: Math.max(0, result.count - 1),
      });
      return { success: true, count: result.count };
    }),

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
