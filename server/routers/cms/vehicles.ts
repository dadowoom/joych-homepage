/**
 * 차량 관리 라우터 (cms.vehicles)
 * 차량 등록/수정, 사진, 예약 가능 그룹을 관리합니다.
 */

import { z } from "zod";
import { adminPermissionProcedure, publicProcedure, router } from "../../_core/trpc";
import { optionalTextSchema, requiredTextSchema } from "../../_core/contentValidation";
import { storagePut } from "../../storage";
import { validateImage } from "./upload";
import {
  addVehicleImage,
  createVehicle,
  deleteVehicle,
  deleteVehicleImage,
  getVehicleById,
  getVehicleImages,
  getVehicleReservationAccessRules,
  getVehicles,
  reorderVehicles,
  replaceVehicleReservationAccessRules,
  setVehicleThumbnail,
  updateVehicle,
} from "../../db";

const TIME_RE = /^(([01]\d|2[0-3]):[0-5]\d|24:00)$/;
const idSchema = z.number().int().positive();
const timeSchema = z.string().regex(TIME_RE, "시간은 HH:MM 형식으로 입력해주세요.");
const vehicleProcedure = adminPermissionProcedure("content:vehicles");

function toMinutes(time: string) {
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + minute;
}

function addTimeOrderIssue(ctx: z.RefinementCtx, start: string | undefined, end: string | undefined) {
  if (start && end && TIME_RE.test(start) && TIME_RE.test(end) && toMinutes(start) >= toMinutes(end)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["closeTime"], message: "시작 시간은 종료 시간보다 빨라야 합니다." });
  }
}

const vehicleBaseSchema = z.object({
  name: requiredTextSchema(128, "차량 이름을 입력해주세요."),
  description: optionalTextSchema(5000),
  plateNumber: optionalTextSchema(64),
  location: optionalTextSchema(128),
  driverInfo: optionalTextSchema(128),
  capacity: z.number().int().min(1).max(200).default(5),
  slotMinutes: z.number().int().min(5).max(1440).default(60),
  minSlots: z.number().int().min(1).max(96).default(1),
  maxSlots: z.number().int().min(1).max(96).default(8),
  approvalType: z.enum(["auto", "manual"]).default("manual"),
  isReservable: z.boolean().default(true),
  isVisible: z.boolean().default(true),
  notice: optionalTextSchema(10000),
  caution: optionalTextSchema(10000),
  sortOrder: z.number().int().min(0).max(10000).optional(),
  openTime: timeSchema.default("00:00"),
  closeTime: timeSchema.default("24:00"),
}).superRefine((value, ctx) => {
  if (value.maxSlots < value.minSlots) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["maxSlots"], message: "최대 예약 시간은 최소 예약 시간보다 크거나 같아야 합니다." });
  }
  addTimeOrderIssue(ctx, value.openTime, value.closeTime);
});

const vehicleUpdateSchema = vehicleBaseSchema.partial().extend({
  id: idSchema,
}).superRefine((value, ctx) => {
  if (value.minSlots !== undefined && value.maxSlots !== undefined && value.maxSlots < value.minSlots) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["maxSlots"], message: "최대 예약 시간은 최소 예약 시간보다 크거나 같아야 합니다." });
  }
  addTimeOrderIssue(ctx, value.openTime, value.closeTime);
});

const accessRuleSchema = z.object({
  fieldType: z.literal("position"),
  fieldValue: requiredTextSchema(64, "그룹 값을 선택해주세요."),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().min(0).max(10000).default(0),
});

export const vehiclesRouter = router({
  list: vehicleProcedure.query(() => getVehicles(false)),

  publicList: publicProcedure.query(() => getVehicles(true)),

  get: vehicleProcedure
    .input(z.object({ id: idSchema }))
    .query(({ input }) => getVehicleById(input.id)),

  create: vehicleProcedure
    .input(vehicleBaseSchema)
    .mutation(({ input }) => createVehicle(input)),

  update: vehicleProcedure
    .input(vehicleUpdateSchema)
    .mutation(({ input }) => {
      const { id, ...data } = input;
      return updateVehicle(id, data);
    }),

  reorder: vehicleProcedure
    .input(z.object({
      items: z.array(z.object({
        id: idSchema,
        sortOrder: z.number().int().min(0).max(10000),
      })).min(1).max(200),
    }))
    .mutation(({ input }) => reorderVehicles(input.items)),

  delete: vehicleProcedure
    .input(z.object({ id: idSchema }))
    .mutation(({ input }) => deleteVehicle(input.id)),

  accessRules: router({
    list: vehicleProcedure.query(() => getVehicleReservationAccessRules(false)),

    replace: vehicleProcedure
      .input(z.object({ rules: z.array(accessRuleSchema).max(200) }))
      .mutation(({ input }) => replaceVehicleReservationAccessRules(input.rules)),
  }),

  images: router({
    list: vehicleProcedure
      .input(z.object({ vehicleId: idSchema }))
      .query(({ input }) => getVehicleImages(input.vehicleId)),

    upload: vehicleProcedure
      .input(z.object({
        vehicleId: idSchema,
        base64: z.string(),
        mimeType: z.string(),
        caption: optionalTextSchema(128),
        isThumbnail: z.boolean().default(false),
      }))
      .mutation(async ({ input }) => {
        const { buffer, ext } = validateImage(input.base64, input.mimeType);
        const mimeType = input.mimeType.toLowerCase().trim();
        const key = `vehicle-images/${input.vehicleId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { url } = await storagePut(key, buffer, mimeType);
        const id = await addVehicleImage({
          vehicleId: input.vehicleId,
          imageUrl: url,
          fileKey: key,
          caption: input.caption,
          isThumbnail: input.isThumbnail,
          sortOrder: 0,
        });
        return { id, url };
      }),

    delete: vehicleProcedure
      .input(z.object({ id: idSchema }))
      .mutation(({ input }) => deleteVehicleImage(input.id)),

    setThumbnail: vehicleProcedure
      .input(z.object({ vehicleId: idSchema, imageId: idSchema }))
      .mutation(({ input }) => setVehicleThumbnail(input.vehicleId, input.imageId)),
  }),
});
