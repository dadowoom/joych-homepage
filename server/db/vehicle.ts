/**
 * 차량 예약 DB 함수
 * 시설예약과 별도 테이블을 사용합니다. 차량은 별도 휴무/차단일 없이
 * 차량별 운영 시간 안에서 기존 예약 시간만 중복 방지합니다.
 */

import { and, asc, desc, eq, gt, inArray, lt, ne, notInArray, or, sql } from "drizzle-orm";
import type { ResultSetHeader } from "mysql2";
import {
  churchMembers,
  InsertVehicle,
  InsertVehicleImage,
  InsertVehicleReservation,
  InsertVehicleReservationAccessRule,
  type Vehicle,
  vehicleImages,
  vehicleReservationAccessRules,
  vehicleReservations,
  vehicles,
} from "../../drizzle/schema";
import { getDb } from "./connection";

export class VehicleReservationOverlapError extends Error {
  constructor(public readonly startTime: string, public readonly endTime: string) {
    super(`해당 시간대(${startTime}~${endTime})에 이미 차량 예약이 있습니다. 다른 시간을 선택해 주세요.`);
  }
}

export class VehicleReservationLockError extends Error {
  constructor() {
    super("차량 예약 처리 중입니다. 잠시 후 다시 시도해주세요.");
  }
}

export class VehicleReservationGroupValidationError extends Error {
  constructor(message: string) {
    super(message);
  }
}

type InsertVehicleReservationData = Omit<InsertVehicleReservation, "id" | "createdAt" | "updatedAt" | "userId"> & {
  userId: number | null;
};

type MemberLike = {
  status?: string | null;
  position?: string | null;
  department?: string | null;
  district?: string | null;
  baptismType?: string | null;
};

function extractMysqlScalar(result: unknown) {
  const rows = Array.isArray(result) ? result[0] : result;
  const firstRow = Array.isArray(rows) ? rows[0] : rows;
  if (!firstRow || typeof firstRow !== "object") return null;
  return Object.values(firstRow as Record<string, unknown>)[0] ?? null;
}

function getMemberFieldValue(member: MemberLike, fieldType: string) {
  if (fieldType === "position") return member.position ?? "";
  if (fieldType === "department") return member.department ?? "";
  if (fieldType === "district") return member.district ?? "";
  if (fieldType === "baptism") return member.baptismType ?? "";
  return "";
}

// ─── 차량 CRUD ───────────────────────────────────────────────────────────────

export async function getVehicles(onlyVisible = true) {
  const db = await getDb();
  if (!db) return [];
  const query = db.select().from(vehicles).orderBy(asc(vehicles.sortOrder), asc(vehicles.id));
  const rows = onlyVisible ? await query.where(eq(vehicles.isVisible, true)) : await query;

  const vehicleIds = rows.map((vehicle) => vehicle.id);
  if (vehicleIds.length === 0) {
    return rows.map((vehicle) => ({ ...vehicle, thumbnailUrl: null as string | null }));
  }

  const images = await db
    .select({
      id: vehicleImages.id,
      vehicleId: vehicleImages.vehicleId,
      imageUrl: vehicleImages.imageUrl,
    })
    .from(vehicleImages)
    .where(inArray(vehicleImages.vehicleId, vehicleIds))
    .orderBy(desc(vehicleImages.isThumbnail), asc(vehicleImages.sortOrder), asc(vehicleImages.id));
  const thumbnailByVehicle = new Map<number, string>();
  for (const image of images) {
    if (!thumbnailByVehicle.has(image.vehicleId)) {
      thumbnailByVehicle.set(image.vehicleId, image.imageUrl);
    }
  }

  return rows.map((vehicle) => ({
    ...vehicle,
    thumbnailUrl: thumbnailByVehicle.get(vehicle.id) ?? null,
  }));
}

export async function getVehicleById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(vehicles).where(eq(vehicles.id, id)).limit(1);
  const vehicle = rows[0] ?? null;
  if (!vehicle) return null;

  // 목록 화면과 상세/신청 화면이 같은 대표 사진을 쓰도록 단건 조회에도 썸네일을 붙입니다.
  const images = await db
    .select({ imageUrl: vehicleImages.imageUrl })
    .from(vehicleImages)
    .where(eq(vehicleImages.vehicleId, id))
    .orderBy(desc(vehicleImages.isThumbnail), asc(vehicleImages.sortOrder), asc(vehicleImages.id))
    .limit(1);

  return {
    ...vehicle,
    thumbnailUrl: images[0]?.imageUrl ?? null,
  };
}

export async function createVehicle(data: Omit<InsertVehicle, "id" | "createdAt" | "updatedAt">) {
  const db = await getDb();
  if (!db) return null;
  const [result] = await db.insert(vehicles).values(data).$returningId();
  return result?.id ?? null;
}

export async function updateVehicle(id: number, data: Partial<InsertVehicle>) {
  const db = await getDb();
  if (!db) return;
  await db.update(vehicles).set(data).where(eq(vehicles.id, id));
}

export async function reorderVehicles(items: Array<{ id: number; sortOrder: number }>) {
  const db = await getDb();
  if (!db || items.length === 0) return;
  await db.transaction(async (tx) => {
    for (const item of items) {
      await tx.update(vehicles).set({ sortOrder: item.sortOrder }).where(eq(vehicles.id, item.id));
    }
  });
}

export async function deleteVehicle(id: number) {
  const db = await getDb();
  if (!db) return;
  const existingReservations = await db
    .select({ id: vehicleReservations.id })
    .from(vehicleReservations)
    .where(eq(vehicleReservations.vehicleId, id))
    .limit(1);
  if (existingReservations.length > 0) {
    throw new Error("예약 내역이 있는 차량은 삭제할 수 없습니다. 숨김 처리로 운영 중단해 주세요.");
  }
  await db.delete(vehicles).where(eq(vehicles.id, id));
}

// ─── 차량 이미지 ─────────────────────────────────────────────────────────────

export async function getVehicleImages(vehicleId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(vehicleImages)
    .where(eq(vehicleImages.vehicleId, vehicleId))
    .orderBy(desc(vehicleImages.isThumbnail), asc(vehicleImages.sortOrder), asc(vehicleImages.id));
}

export async function addVehicleImage(data: Omit<InsertVehicleImage, "id" | "createdAt">) {
  const db = await getDb();
  if (!db) return null;
  if (data.isThumbnail) {
    const result = await db.transaction(async (tx) => {
      await tx.update(vehicleImages).set({ isThumbnail: false }).where(eq(vehicleImages.vehicleId, data.vehicleId));
      const [insertResult] = await tx.insert(vehicleImages).values({ ...data, isThumbnail: true }).$returningId();
      return insertResult;
    });
    return result?.id ?? null;
  }
  const [result] = await db.insert(vehicleImages).values(data).$returningId();
  return result?.id ?? null;
}

export async function deleteVehicleImage(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(vehicleImages).where(eq(vehicleImages.id, id));
}

export async function setVehicleThumbnail(vehicleId: number, imageId: number) {
  const db = await getDb();
  if (!db) return;
  await db.transaction(async (tx) => {
    await tx.update(vehicleImages).set({ isThumbnail: false }).where(eq(vehicleImages.vehicleId, vehicleId));
    await tx.update(vehicleImages).set({ isThumbnail: true }).where(eq(vehicleImages.id, imageId));
  });
}

// ─── 차량예약 가능 그룹 ──────────────────────────────────────────────────────

export async function getVehicleReservationAccessRules(onlyActive = false) {
  const db = await getDb();
  if (!db) return [];
  const query = db
    .select()
    .from(vehicleReservationAccessRules)
    .orderBy(asc(vehicleReservationAccessRules.fieldType), asc(vehicleReservationAccessRules.sortOrder), asc(vehicleReservationAccessRules.id));
  return onlyActive
    ? query.where(and(eq(vehicleReservationAccessRules.isActive, true), eq(vehicleReservationAccessRules.fieldType, "position")))
    : query.where(eq(vehicleReservationAccessRules.fieldType, "position"));
}

export async function replaceVehicleReservationAccessRules(
  rules: Array<Omit<InsertVehicleReservationAccessRule, "id" | "createdAt" | "updatedAt">>
) {
  const db = await getDb();
  if (!db) return;
  const positionRules = rules.filter((rule) => rule.fieldType === "position");
  await db.transaction(async (tx) => {
    await tx.delete(vehicleReservationAccessRules).where(eq(vehicleReservationAccessRules.fieldType, "position"));
    if (positionRules.length > 0) {
      await tx.insert(vehicleReservationAccessRules).values(positionRules);
    }
  });
}

export async function canMemberUseVehicleReservation(member: MemberLike | null | undefined) {
  if (!member || member.status !== "approved") return false;
  const rules = await getVehicleReservationAccessRules(true);
  if (rules.length === 0) return false;
  return rules.some((rule) => getMemberFieldValue(member, rule.fieldType) === rule.fieldValue);
}

// ─── 차량 예약 ───────────────────────────────────────────────────────────────

export async function getAllVehicleReservations(vehicleId?: number) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({
      id: vehicleReservations.id,
      vehicleId: vehicleReservations.vehicleId,
      userId: vehicleReservations.userId,
      reserverName: vehicleReservations.reserverName,
      reserverPhone: vehicleReservations.reserverPhone,
      reservationDate: vehicleReservations.reservationDate,
      startTime: vehicleReservations.startTime,
      endTime: vehicleReservations.endTime,
      status: vehicleReservations.status,
      purpose: vehicleReservations.purpose,
      department: vehicleReservations.department,
      passengers: vehicleReservations.passengers,
      notes: vehicleReservations.notes,
      recurrenceGroupId: vehicleReservations.recurrenceGroupId,
      recurrenceLabel: vehicleReservations.recurrenceLabel,
      recurrenceSequence: vehicleReservations.recurrenceSequence,
      adminComment: vehicleReservations.adminComment,
      processedBy: vehicleReservations.processedBy,
      processedAt: vehicleReservations.processedAt,
      createdAt: vehicleReservations.createdAt,
      updatedAt: vehicleReservations.updatedAt,
      vehicleName: vehicles.name,
      plateNumber: vehicles.plateNumber,
      userName: churchMembers.name,
      userEmail: churchMembers.email,
      memberPosition: churchMembers.position,
      memberPhone: churchMembers.phone,
    })
    .from(vehicleReservations)
    .leftJoin(vehicles, eq(vehicleReservations.vehicleId, vehicles.id))
    .leftJoin(churchMembers, eq(vehicleReservations.userId, churchMembers.id))
    .orderBy(desc(vehicleReservations.createdAt));

  if (vehicleId !== undefined) {
    return rows.filter((row) => row.vehicleId === vehicleId);
  }
  return rows;
}

export async function getMyVehicleReservations(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      id: vehicleReservations.id,
      vehicleId: vehicleReservations.vehicleId,
      userId: vehicleReservations.userId,
      reserverName: vehicleReservations.reserverName,
      reserverPhone: vehicleReservations.reserverPhone,
      reservationDate: vehicleReservations.reservationDate,
      startTime: vehicleReservations.startTime,
      endTime: vehicleReservations.endTime,
      status: vehicleReservations.status,
      purpose: vehicleReservations.purpose,
      department: vehicleReservations.department,
      passengers: vehicleReservations.passengers,
      notes: vehicleReservations.notes,
      recurrenceGroupId: vehicleReservations.recurrenceGroupId,
      recurrenceLabel: vehicleReservations.recurrenceLabel,
      recurrenceSequence: vehicleReservations.recurrenceSequence,
      adminComment: vehicleReservations.adminComment,
      createdAt: vehicleReservations.createdAt,
      updatedAt: vehicleReservations.updatedAt,
      vehicleName: vehicles.name,
      plateNumber: vehicles.plateNumber,
    })
    .from(vehicleReservations)
    .leftJoin(vehicles, eq(vehicleReservations.vehicleId, vehicles.id))
    .where(eq(vehicleReservations.userId, userId))
    .orderBy(desc(vehicleReservations.createdAt));
}

export async function getVehicleReservationsByDate(vehicleId: number, date: string) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(vehicleReservations)
    .where(and(
      eq(vehicleReservations.vehicleId, vehicleId),
      eq(vehicleReservations.reservationDate, date),
    ));
}

export async function getAdminVehicleReservationDetailsByDate(vehicleId: number, date: string) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      id: vehicleReservations.id,
      vehicleId: vehicleReservations.vehicleId,
      userId: vehicleReservations.userId,
      reserverName: vehicleReservations.reserverName,
      reserverPhone: vehicleReservations.reserverPhone,
      reservationDate: vehicleReservations.reservationDate,
      startTime: vehicleReservations.startTime,
      endTime: vehicleReservations.endTime,
      status: vehicleReservations.status,
      purpose: vehicleReservations.purpose,
      department: vehicleReservations.department,
      passengers: vehicleReservations.passengers,
      notes: vehicleReservations.notes,
      recurrenceGroupId: vehicleReservations.recurrenceGroupId,
      recurrenceLabel: vehicleReservations.recurrenceLabel,
      recurrenceSequence: vehicleReservations.recurrenceSequence,
      vehicleName: vehicles.name,
      userName: churchMembers.name,
      memberPosition: churchMembers.position,
      memberPhone: churchMembers.phone,
    })
    .from(vehicleReservations)
    .leftJoin(vehicles, eq(vehicleReservations.vehicleId, vehicles.id))
    .leftJoin(churchMembers, eq(vehicleReservations.userId, churchMembers.id))
    .where(and(
      eq(vehicleReservations.vehicleId, vehicleId),
      eq(vehicleReservations.reservationDate, date),
    ))
    .orderBy(asc(vehicleReservations.startTime), asc(vehicleReservations.id));
}

export async function createVehicleReservation(data: InsertVehicleReservationData) {
  const db = await getDb();
  if (!db) return null;
  const [result] = await db.insert(vehicleReservations).values(data as InsertVehicleReservation).$returningId();
  return result?.id ?? null;
}

export async function createVehicleReservationIfAvailable(
  data: InsertVehicleReservationData
) {
  const ids = await createVehicleReservationsIfAvailable([data]);
  return ids[0] ?? null;
}

type VehicleScheduleRules = Pick<
  Vehicle,
  | "isVisible"
  | "isReservable"
  | "openTime"
  | "closeTime"
  | "slotMinutes"
  | "minSlots"
  | "maxSlots"
  | "capacity"
>;

export type VehicleAvailabilityBusyRange = {
  vehicleId: number;
  reservationDate: string;
  startTime: string;
  endTime: string;
};

export type VehicleAvailabilityConflictSource = VehicleAvailabilityBusyRange & {
  status: string;
  reserverName: string;
  memberPosition: string | null;
  purpose: string;
};

export type VehicleAvailabilityConflictDetail = {
  reservationDate: string;
  startTime: string;
  endTime: string;
  vehicleId: number;
  vehicleName: string;
  reserverName: string;
  memberPosition: string | null;
  purpose: string;
  status: "pending" | "approved";
};

/**
 * 차량예약 가능 권한자에게 보여줄 충돌 정보만 명시적으로 추립니다.
 * 전화번호, 메모, 사용자 ID 같은 개인정보/관리정보는 응답에 포함하지 않습니다.
 */
export function buildVehicleAvailabilityConflictDetails(
  vehiclesForTimeline: Array<{ id: number; name: string }>,
  busyRanges: VehicleAvailabilityConflictSource[],
): VehicleAvailabilityConflictDetail[] {
  const vehicleNameById = new Map(vehiclesForTimeline.map((vehicle) => [vehicle.id, vehicle.name]));

  return busyRanges
    .filter((busyRange): busyRange is VehicleAvailabilityConflictSource & { status: "pending" | "approved" } =>
      busyRange.status === "pending" || busyRange.status === "approved"
    )
    .map((busyRange) => ({
      reservationDate: busyRange.reservationDate,
      startTime: busyRange.startTime,
      endTime: busyRange.endTime,
      vehicleId: busyRange.vehicleId,
      vehicleName: vehicleNameById.get(busyRange.vehicleId) ?? "차량",
      reserverName: busyRange.reserverName,
      memberPosition: busyRange.memberPosition,
      purpose: busyRange.purpose,
      status: busyRange.status,
    }));
}

function parseVehicleTimeMinutes(time: string) {
  const match = /^(?:([01]\d|2[0-3]):([0-5]\d)|24:00)$/.exec(time);
  if (!match) return null;
  if (time === "24:00") return 24 * 60;
  return Number(match[1]) * 60 + Number(match[2]);
}

function formatVehicleTimeMinutes(minutes: number) {
  if (minutes === 24 * 60) return "24:00";
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

export function isVehicleCompatibleWithSchedule(
  vehicle: VehicleScheduleRules,
  startTime: string,
  endTime: string,
  passengers = 1,
) {
  if (!vehicle.isVisible || !vehicle.isReservable || passengers < 1 || passengers > vehicle.capacity) {
    return false;
  }

  const startMinutes = parseVehicleTimeMinutes(startTime);
  const endMinutes = parseVehicleTimeMinutes(endTime);
  const openMinutes = parseVehicleTimeMinutes(vehicle.openTime);
  const closeMinutes = parseVehicleTimeMinutes(vehicle.closeTime);
  if (startMinutes === null || endMinutes === null || openMinutes === null || closeMinutes === null) {
    return false;
  }
  if (startMinutes >= endMinutes || startMinutes < openMinutes || endMinutes > closeMinutes) {
    return false;
  }

  const slotMinutes = vehicle.slotMinutes > 0 ? vehicle.slotMinutes : 60;
  if ((startMinutes - openMinutes) % slotMinutes !== 0 || (endMinutes - openMinutes) % slotMinutes !== 0) {
    return false;
  }
  const selectedSlots = (endMinutes - startMinutes) / slotMinutes;
  return selectedSlots >= vehicle.minSlots && selectedSlots <= vehicle.maxSlots;
}

/**
 * 차량을 고르기 전 공통 시간 막대에 사용할 가용 시작/종료 시각을 계산합니다.
 * 각 범위는 반드시 동일 차량 한 대가 모든 반복 날짜에 비어 있을 때만 가능 처리합니다.
 */
export function buildVehicleAvailabilityTimeline(
  vehiclesForTimeline: Array<VehicleScheduleRules & { id: number }>,
  busyRanges: VehicleAvailabilityBusyRange[],
  reservationDates: string[],
  passengers = 1,
  selectedStartTime?: string | null,
  minimumStartTime?: string | null,
) {
  const candidates = vehiclesForTimeline.filter((vehicle) =>
    vehicle.isVisible && vehicle.isReservable && passengers >= 1 && passengers <= vehicle.capacity
  );
  const busyByVehicleDate = new Map<string, Array<{ startMinutes: number; endMinutes: number }>>();
  for (const busyRange of busyRanges) {
    const startMinutes = parseVehicleTimeMinutes(busyRange.startTime);
    const endMinutes = parseVehicleTimeMinutes(busyRange.endTime);
    if (startMinutes === null || endMinutes === null || startMinutes >= endMinutes) continue;
    const key = `${busyRange.vehicleId}:${busyRange.reservationDate}`;
    const list = busyByVehicleDate.get(key) ?? [];
    list.push({ startMinutes, endMinutes });
    busyByVehicleDate.set(key, list);
  }

  const minimumStartMinutes = minimumStartTime ? parseVehicleTimeMinutes(minimumStartTime) : null;
  const selectedStartMinutes = selectedStartTime ? parseVehicleTimeMinutes(selectedStartTime) : null;
  const timePointMinutes = new Set<number>();
  const theoreticalStartMinutes = new Set<number>();
  const pastStartMinutes = new Set<number>();
  const startOptions = new Map<number, { defaultEndMinutes: number; vehicleIds: Set<number> }>();
  const theoreticalEndMinutes = new Set<number>();
  const endOptions = new Map<number, Set<number>>();

  const isRangeFreeForEveryDate = (vehicleId: number, startMinutes: number, endMinutes: number) =>
    reservationDates.every((reservationDate) =>
      !(busyByVehicleDate.get(`${vehicleId}:${reservationDate}`) ?? []).some((busyRange) =>
        busyRange.startMinutes < endMinutes && busyRange.endMinutes > startMinutes
      )
    );

  for (const vehicle of candidates) {
    const openMinutes = parseVehicleTimeMinutes(vehicle.openTime);
    const closeMinutes = parseVehicleTimeMinutes(vehicle.closeTime);
    const slotMinutes = vehicle.slotMinutes > 0 ? vehicle.slotMinutes : 60;
    if (openMinutes === null || closeMinutes === null || openMinutes >= closeMinutes) continue;

    for (let point = openMinutes; point <= closeMinutes; point += slotMinutes) {
      timePointMinutes.add(point);
    }

    for (let startMinutes = openMinutes; startMinutes < closeMinutes; startMinutes += slotMinutes) {
      if (minimumStartMinutes !== null && startMinutes <= minimumStartMinutes) {
        pastStartMinutes.add(startMinutes);
        continue;
      }

      const theoreticalEnds: number[] = [];
      for (let selectedSlots = vehicle.minSlots; selectedSlots <= vehicle.maxSlots; selectedSlots += 1) {
        const endMinutes = startMinutes + selectedSlots * slotMinutes;
        if (endMinutes > closeMinutes) break;
        theoreticalEnds.push(endMinutes);
      }
      if (theoreticalEnds.length === 0) continue;

      theoreticalStartMinutes.add(startMinutes);
      if (selectedStartMinutes === startMinutes) {
        theoreticalEnds.forEach((endMinutes) => theoreticalEndMinutes.add(endMinutes));
      }

      for (const endMinutes of theoreticalEnds) {
        // 짧은 범위가 충돌하면 그 범위를 포함하는 더 긴 종료 시각도 모두 충돌합니다.
        if (!isRangeFreeForEveryDate(vehicle.id, startMinutes, endMinutes)) break;

        const currentStartOption = startOptions.get(startMinutes);
        if (!currentStartOption || endMinutes < currentStartOption.defaultEndMinutes) {
          startOptions.set(startMinutes, {
            defaultEndMinutes: endMinutes,
            vehicleIds: new Set([vehicle.id]),
          });
        } else if (endMinutes === currentStartOption.defaultEndMinutes) {
          currentStartOption.vehicleIds.add(vehicle.id);
        }

        if (selectedStartMinutes === startMinutes) {
          const vehicleIds = endOptions.get(endMinutes) ?? new Set<number>();
          vehicleIds.add(vehicle.id);
          endOptions.set(endMinutes, vehicleIds);
        } else {
          // 시작 막대에는 이 차량의 가장 짧은 가능 범위만 필요합니다.
          break;
        }
      }
    }
  }

  const sortedTimePoints = Array.from(timePointMinutes).sort((left, right) => left - right);
  const selectAllStartMinutes = sortedTimePoints[0];
  const selectAllEndMinutes = sortedTimePoints[sortedTimePoints.length - 1];
  const selectAllStartTime = selectAllStartMinutes === undefined
    ? null
    : formatVehicleTimeMinutes(selectAllStartMinutes);
  const selectAllEndTime = selectAllEndMinutes === undefined
    ? null
    : formatVehicleTimeMinutes(selectAllEndMinutes);
  const selectAllVehicleCount =
    reservationDates.length > 0 &&
    selectAllStartMinutes !== undefined &&
    selectAllEndMinutes !== undefined &&
    selectAllStartMinutes < selectAllEndMinutes &&
    (minimumStartMinutes === null || selectAllStartMinutes > minimumStartMinutes) &&
    selectAllStartTime &&
    selectAllEndTime
      ? candidates.filter((vehicle) =>
          isVehicleCompatibleWithSchedule(vehicle, selectAllStartTime, selectAllEndTime, passengers) &&
          isRangeFreeForEveryDate(vehicle.id, selectAllStartMinutes, selectAllEndMinutes)
        ).length
      : 0;

  return {
    selectedStartTime: selectedStartTime ?? null,
    timePoints: sortedTimePoints.map(formatVehicleTimeMinutes),
    selectAllOption: selectAllVehicleCount > 0 && selectAllStartTime && selectAllEndTime
      ? {
          startTime: selectAllStartTime,
          endTime: selectAllEndTime,
          availableVehicleCount: selectAllVehicleCount,
        }
      : null,
    startOptions: Array.from(startOptions.entries())
      .sort(([left], [right]) => left - right)
      .map(([startMinutes, option]) => ({
        startTime: formatVehicleTimeMinutes(startMinutes),
        defaultEndTime: formatVehicleTimeMinutes(option.defaultEndMinutes),
        availableVehicleCount: option.vehicleIds.size,
      })),
    blockedStartTimes: Array.from(theoreticalStartMinutes)
      .filter((startMinutes) => !startOptions.has(startMinutes))
      .sort((left, right) => left - right)
      .map(formatVehicleTimeMinutes),
    pastStartTimes: Array.from(pastStartMinutes)
      .sort((left, right) => left - right)
      .map(formatVehicleTimeMinutes),
    endOptions: Array.from(endOptions.entries())
      .sort(([left], [right]) => left - right)
      .map(([endMinutes, vehicleIds]) => ({
        endTime: formatVehicleTimeMinutes(endMinutes),
        availableVehicleCount: vehicleIds.size,
      })),
    blockedEndTimes: Array.from(theoreticalEndMinutes)
      .filter((endMinutes) => !endOptions.has(endMinutes))
      .sort((left, right) => left - right)
      .map(formatVehicleTimeMinutes),
  };
}

export async function getVehicleAvailabilityTimeline(
  reservationDates: string[],
  passengers = 1,
  selectedStartTime?: string | null,
  minimumStartTime?: string | null,
) {
  const allVehicles = await getVehicles(true);
  const candidates = allVehicles.filter((vehicle) =>
    vehicle.isVisible && vehicle.isReservable && passengers >= 1 && passengers <= vehicle.capacity
  );
  if (candidates.length === 0 || reservationDates.length === 0) {
    return {
      ...buildVehicleAvailabilityTimeline(candidates, [], reservationDates, passengers, selectedStartTime, minimumStartTime),
      conflicts: [] as VehicleAvailabilityConflictDetail[],
    };
  }

  const db = await getDb();
  if (!db) {
    // 예약 현황을 확인할 수 없을 때 가능 상태로 열지 않습니다.
    return {
      ...buildVehicleAvailabilityTimeline([], [], reservationDates, passengers, selectedStartTime, minimumStartTime),
      conflicts: [] as VehicleAvailabilityConflictDetail[],
    };
  }
  const busyRanges = await db
    .select({
      vehicleId: vehicleReservations.vehicleId,
      reservationDate: vehicleReservations.reservationDate,
      startTime: vehicleReservations.startTime,
      endTime: vehicleReservations.endTime,
      status: vehicleReservations.status,
      reserverName: vehicleReservations.reserverName,
      memberPosition: churchMembers.position,
      purpose: vehicleReservations.purpose,
    })
    .from(vehicleReservations)
    .leftJoin(churchMembers, eq(vehicleReservations.userId, churchMembers.id))
    .where(and(
      inArray(vehicleReservations.vehicleId, candidates.map((vehicle) => vehicle.id)),
      inArray(vehicleReservations.reservationDate, reservationDates),
      or(
        eq(vehicleReservations.status, "pending"),
        eq(vehicleReservations.status, "approved"),
      ),
    ));

  return {
    ...buildVehicleAvailabilityTimeline(
      candidates,
      busyRanges,
      reservationDates,
      passengers,
      selectedStartTime,
      minimumStartTime,
    ),
    conflicts: buildVehicleAvailabilityConflictDetails(candidates, busyRanges),
  };
}

/** 선택한 모든 날짜와 시간에 실제로 비어 있는 차량만 반환합니다. */
export async function getAvailableVehiclesForSchedule(
  reservationDates: string[],
  startTime: string,
  endTime: string,
  passengers = 1,
) {
  const allVehicles = await getVehicles(true);
  const candidates = allVehicles.filter((vehicle) =>
    isVehicleCompatibleWithSchedule(vehicle, startTime, endTime, passengers)
  );
  if (candidates.length === 0 || reservationDates.length === 0) return [];

  const db = await getDb();
  if (!db) return [];
  const candidateIds = candidates.map((vehicle) => vehicle.id);
  const conflicts = await db
    .select({ vehicleId: vehicleReservations.vehicleId })
    .from(vehicleReservations)
    .where(and(
      inArray(vehicleReservations.vehicleId, candidateIds),
      inArray(vehicleReservations.reservationDate, reservationDates),
      or(
        eq(vehicleReservations.status, "pending"),
        eq(vehicleReservations.status, "approved"),
      ),
      lt(vehicleReservations.startTime, endTime),
      gt(vehicleReservations.endTime, startTime),
    ));
  const unavailableVehicleIds = new Set(conflicts.map((row) => row.vehicleId));
  return candidates.filter((vehicle) => !unavailableVehicleIds.has(vehicle.id));
}

/**
 * Repeating vehicle reservations must be checked and stored together. This
 * avoids leaving only part of a requested series behind when a later date is
 * already occupied.
 */
export async function createVehicleReservationsIfAvailable(
  dataList: InsertVehicleReservationData[],
) {
  const db = await getDb();
  if (!db || dataList.length === 0) return [];
  const lockKeys = Array.from(new Set(dataList
    .map(data => `vehicle-reservation:${data.vehicleId}:${data.reservationDate}`)
  )).sort();

  return db.transaction(async (tx) => {
    const acquiredLocks: string[] = [];
    try {
      for (const lockKey of lockKeys) {
        const lockResult = await tx.execute(sql`SELECT GET_LOCK(${lockKey}, 5) AS locked`);
        if (Number(extractMysqlScalar(lockResult)) !== 1) {
          throw new VehicleReservationLockError();
        }
        acquiredLocks.push(lockKey);
      }

      const ids: number[] = [];
      for (const data of dataList) {
        const overlapping = await tx
          .select({
            startTime: vehicleReservations.startTime,
            endTime: vehicleReservations.endTime,
          })
          .from(vehicleReservations)
          .where(and(
            eq(vehicleReservations.vehicleId, data.vehicleId),
            eq(vehicleReservations.reservationDate, data.reservationDate),
            or(
              eq(vehicleReservations.status, "pending"),
              eq(vehicleReservations.status, "approved"),
            ),
            lt(vehicleReservations.startTime, data.endTime),
            gt(vehicleReservations.endTime, data.startTime),
          ))
          .limit(1);

        if (overlapping[0]) {
          throw new VehicleReservationOverlapError(overlapping[0].startTime, overlapping[0].endTime);
        }

        const [result] = await tx.insert(vehicleReservations).values(data as InsertVehicleReservation).$returningId();
        if (!result?.id) throw new Error("차량 예약 신청 저장에 실패했습니다.");
        ids.push(result.id);
      }
      return ids;
    } finally {
      for (const lockKey of acquiredLocks.reverse()) {
        await tx.execute(sql`SELECT RELEASE_LOCK(${lockKey})`);
      }
    }
  });
}

export type VehicleReservationDetailsUpdate = {
  reservationDate?: string;
  startTime?: string;
  endTime?: string;
};

export async function updateVehicleReservationDetails(id: number, data: VehicleReservationDetailsUpdate) {
  const db = await getDb();
  if (!db) return false;
  const current = await db.select().from(vehicleReservations).where(eq(vehicleReservations.id, id)).limit(1);
  const reservation = current[0];
  if (!reservation) return false;

  const nextReservationDate = data.reservationDate ?? reservation.reservationDate;
  const nextStartTime = data.startTime ?? reservation.startTime;
  const nextEndTime = data.endTime ?? reservation.endTime;

  const overlapping = await db
    .select({ startTime: vehicleReservations.startTime, endTime: vehicleReservations.endTime })
    .from(vehicleReservations)
    .where(and(
      eq(vehicleReservations.vehicleId, reservation.vehicleId),
      eq(vehicleReservations.reservationDate, nextReservationDate),
      ne(vehicleReservations.id, id),
      or(
        eq(vehicleReservations.status, "pending"),
        eq(vehicleReservations.status, "approved"),
      ),
      lt(vehicleReservations.startTime, nextEndTime),
      gt(vehicleReservations.endTime, nextStartTime),
    ))
    .limit(1);

  if (overlapping[0]) {
    throw new VehicleReservationOverlapError(overlapping[0].startTime, overlapping[0].endTime);
  }

  await db.update(vehicleReservations).set(data).where(eq(vehicleReservations.id, id));
  return true;
}

export async function getVehicleReservationsByGroupId(recurrenceGroupId: string) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      id: vehicleReservations.id,
      vehicleId: vehicleReservations.vehicleId,
      userId: vehicleReservations.userId,
      reserverName: vehicleReservations.reserverName,
      reserverPhone: vehicleReservations.reserverPhone,
      reservationDate: vehicleReservations.reservationDate,
      startTime: vehicleReservations.startTime,
      endTime: vehicleReservations.endTime,
      status: vehicleReservations.status,
      purpose: vehicleReservations.purpose,
      department: vehicleReservations.department,
      passengers: vehicleReservations.passengers,
      notes: vehicleReservations.notes,
      recurrenceGroupId: vehicleReservations.recurrenceGroupId,
      recurrenceLabel: vehicleReservations.recurrenceLabel,
      recurrenceSequence: vehicleReservations.recurrenceSequence,
      adminComment: vehicleReservations.adminComment,
      createdAt: vehicleReservations.createdAt,
      vehicleName: vehicles.name,
      plateNumber: vehicles.plateNumber,
      userName: churchMembers.name,
      userEmail: churchMembers.email,
      memberPosition: churchMembers.position,
      memberPhone: churchMembers.phone,
    })
    .from(vehicleReservations)
    .leftJoin(vehicles, eq(vehicleReservations.vehicleId, vehicles.id))
    .leftJoin(churchMembers, eq(vehicleReservations.userId, churchMembers.id))
    .where(eq(vehicleReservations.recurrenceGroupId, recurrenceGroupId))
    .orderBy(
      asc(vehicleReservations.reservationDate),
      asc(vehicleReservations.recurrenceSequence),
      asc(vehicleReservations.startTime),
      asc(vehicleReservations.id),
    );
}

export type VehicleReservationGroupDetailsUpdate = {
  startTime: string;
  endTime: string;
};

/** 반복 차량예약의 모든 회차 시간을 사전 검증 후 한 트랜잭션으로 변경합니다. */
export async function updateVehicleReservationGroupDetails(
  recurrenceGroupId: string,
  data: VehicleReservationGroupDetailsUpdate,
) {
  const db = await getDb();
  if (!db) return 0;
  if (data.startTime >= data.endTime) {
    throw new VehicleReservationGroupValidationError("시작 시간은 종료 시간보다 빨라야 합니다.");
  }

  return db.transaction(async (tx) => {
    await tx.execute(sql`
      SELECT ${vehicleReservations.id}
      FROM ${vehicleReservations}
      WHERE ${vehicleReservations.recurrenceGroupId} = ${recurrenceGroupId}
      FOR UPDATE
    `);

    const rows = await tx
      .select({
        id: vehicleReservations.id,
        vehicleId: vehicleReservations.vehicleId,
        reservationDate: vehicleReservations.reservationDate,
        vehicleName: vehicles.name,
        openTime: vehicles.openTime,
        closeTime: vehicles.closeTime,
      })
      .from(vehicleReservations)
      .leftJoin(vehicles, eq(vehicleReservations.vehicleId, vehicles.id))
      .where(eq(vehicleReservations.recurrenceGroupId, recurrenceGroupId))
      .orderBy(asc(vehicleReservations.reservationDate), asc(vehicleReservations.id));

    if (rows.length === 0) return 0;

    const groupIds = rows.map((row) => row.id);
    const lockKeys = Array.from(new Set(rows.map((row) =>
      `vehicle-reservation:${row.vehicleId}:${row.reservationDate}`
    ))).sort();
    const acquiredLocks: string[] = [];

    try {
      for (const lockKey of lockKeys) {
        const lockResult = await tx.execute(sql`SELECT GET_LOCK(${lockKey}, 5) AS locked`);
        if (Number(extractMysqlScalar(lockResult)) !== 1) {
          throw new VehicleReservationLockError();
        }
        acquiredLocks.push(lockKey);
      }

      for (const row of rows) {
        if (!row.openTime || !row.closeTime) {
          throw new VehicleReservationGroupValidationError(
            `${row.reservationDate} 회차에 연결된 차량 정보를 찾을 수 없습니다.`,
          );
        }
        if (data.startTime < row.openTime || data.endTime > row.closeTime) {
          throw new VehicleReservationGroupValidationError(
            `${row.reservationDate} ${row.vehicleName ?? "차량"} 운영 시간(${row.openTime}~${row.closeTime}) 안에서만 수정할 수 있습니다.`,
          );
        }

        const overlapping = await tx
          .select({
            startTime: vehicleReservations.startTime,
            endTime: vehicleReservations.endTime,
          })
          .from(vehicleReservations)
          .where(and(
            eq(vehicleReservations.vehicleId, row.vehicleId),
            eq(vehicleReservations.reservationDate, row.reservationDate),
            notInArray(vehicleReservations.id, groupIds),
            inArray(vehicleReservations.status, ["pending", "approved"]),
            lt(vehicleReservations.startTime, data.endTime),
            gt(vehicleReservations.endTime, data.startTime),
          ))
          .limit(1);

        if (overlapping[0]) {
          throw new VehicleReservationOverlapError(
            overlapping[0].startTime,
            overlapping[0].endTime,
          );
        }
      }

      await tx
        .update(vehicleReservations)
        .set({ startTime: data.startTime, endTime: data.endTime })
        .where(eq(vehicleReservations.recurrenceGroupId, recurrenceGroupId));
      return rows.length;
    } finally {
      for (const lockKey of acquiredLocks.reverse()) {
        await tx.execute(sql`SELECT RELEASE_LOCK(${lockKey})`);
      }
    }
  });
}

export type UpdateVehicleReservationGroupStatusResult =
  | { status: "not_found"; count: 0; representative: null }
  | { status: "not_pending"; count: 0; representative: null }
  | {
      status: "updated";
      count: number;
      representative: {
        id: number;
        userId: number | null;
        reservationDate: string;
        startTime: string;
        endTime: string;
        vehicleName: string | null;
      };
    };

/** 반복 차량예약의 대기 회차만 한 트랜잭션으로 승인 또는 거절합니다. */
export async function updateVehicleReservationGroupStatus(
  recurrenceGroupId: string,
  status: "approved" | "rejected",
  adminComment?: string,
  adminUserId?: number,
): Promise<UpdateVehicleReservationGroupStatusResult> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  return db.transaction(async (tx) => {
    await tx.execute(sql`
      SELECT ${vehicleReservations.id}
      FROM ${vehicleReservations}
      WHERE ${vehicleReservations.recurrenceGroupId} = ${recurrenceGroupId}
      FOR UPDATE
    `);

    const rows = await tx
      .select({
        id: vehicleReservations.id,
        userId: vehicleReservations.userId,
        reservationDate: vehicleReservations.reservationDate,
        startTime: vehicleReservations.startTime,
        endTime: vehicleReservations.endTime,
        status: vehicleReservations.status,
        vehicleName: vehicles.name,
      })
      .from(vehicleReservations)
      .leftJoin(vehicles, eq(vehicleReservations.vehicleId, vehicles.id))
      .where(eq(vehicleReservations.recurrenceGroupId, recurrenceGroupId))
      .orderBy(asc(vehicleReservations.reservationDate), asc(vehicleReservations.startTime), asc(vehicleReservations.id));

    if (rows.length === 0) {
      return { status: "not_found", count: 0, representative: null };
    }

    const pendingRows = rows.filter((row) => row.status === "pending");
    if (pendingRows.length === 0) {
      return { status: "not_pending", count: 0, representative: null };
    }

    const values: Partial<InsertVehicleReservation> = {
      status,
      adminComment: adminComment ?? null,
    };
    if (adminUserId !== undefined) {
      values.processedBy = adminUserId;
      values.processedAt = new Date();
    }

    const [result] = await tx
      .update(vehicleReservations)
      .set(values)
      .where(and(
        eq(vehicleReservations.recurrenceGroupId, recurrenceGroupId),
        eq(vehicleReservations.status, "pending"),
        inArray(vehicleReservations.id, pendingRows.map((row) => row.id)),
      ));

    const affectedRows = Number((result as ResultSetHeader | undefined)?.affectedRows ?? 0);
    if (affectedRows !== pendingRows.length) {
      throw new Error("반복 차량예약 상태가 변경되어 일괄 처리하지 못했습니다.");
    }

    const first = pendingRows[0]!;
    return {
      status: "updated",
      count: affectedRows,
      representative: {
        id: first.id,
        userId: first.userId,
        reservationDate: first.reservationDate,
        startTime: first.startTime,
        endTime: first.endTime,
        vehicleName: first.vehicleName,
      },
    };
  });
}

/** 반복 차량예약 묶음을 한 번에 영구 삭제합니다. */
export async function deleteVehicleReservationGroup(recurrenceGroupId: string) {
  const db = await getDb();
  if (!db) return 0;

  return db.transaction(async (tx) => {
    await tx.execute(sql`
      SELECT ${vehicleReservations.id}
      FROM ${vehicleReservations}
      WHERE ${vehicleReservations.recurrenceGroupId} = ${recurrenceGroupId}
      FOR UPDATE
    `);
    const rows = await tx
      .select({ id: vehicleReservations.id })
      .from(vehicleReservations)
      .where(eq(vehicleReservations.recurrenceGroupId, recurrenceGroupId));
    if (rows.length === 0) return 0;

    await tx
      .delete(vehicleReservations)
      .where(eq(vehicleReservations.recurrenceGroupId, recurrenceGroupId));
    return rows.length;
  });
}

export async function updateVehicleReservationStatus(
  id: number,
  status: "pending" | "approved" | "rejected" | "cancelled",
  adminComment?: string,
  adminUserId?: number
) {
  const db = await getDb();
  if (!db) return;
  const values: Partial<InsertVehicleReservation> = {
    status,
    adminComment: adminComment ?? null,
  };
  if (adminUserId !== undefined) {
    values.processedBy = adminUserId;
    values.processedAt = new Date();
  }
  await db.update(vehicleReservations).set(values).where(eq(vehicleReservations.id, id));
}

export type CancelVehicleReservationGroupResult =
  | { status: "not_found"; count: 0; representative: null }
  | { status: "not_cancellable"; count: 0; representative: null }
  | {
      status: "cancelled";
      count: number;
      representative: {
        id: number;
        userId: number | null;
        reservationDate: string;
        startTime: string;
        endTime: string;
        vehicleName: string | null;
      };
    };

/** 관리자: 반복 차량예약의 승인/대기 회차만 한 트랜잭션으로 일괄 취소합니다. */
export async function cancelVehicleReservationGroup(
  recurrenceGroupId: string,
  adminUserId: number,
  adminComment?: string,
): Promise<CancelVehicleReservationGroupResult> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  return db.transaction(async (tx) => {
    await tx.execute(sql`
      SELECT ${vehicleReservations.id}
      FROM ${vehicleReservations}
      WHERE ${vehicleReservations.recurrenceGroupId} = ${recurrenceGroupId}
      FOR UPDATE
    `);

    const rows = await tx
      .select({
        id: vehicleReservations.id,
        userId: vehicleReservations.userId,
        reservationDate: vehicleReservations.reservationDate,
        startTime: vehicleReservations.startTime,
        endTime: vehicleReservations.endTime,
        status: vehicleReservations.status,
        vehicleName: vehicles.name,
      })
      .from(vehicleReservations)
      .leftJoin(vehicles, eq(vehicleReservations.vehicleId, vehicles.id))
      .where(eq(vehicleReservations.recurrenceGroupId, recurrenceGroupId))
      .orderBy(asc(vehicleReservations.reservationDate), asc(vehicleReservations.startTime), asc(vehicleReservations.id));

    if (rows.length === 0) {
      return { status: "not_found", count: 0, representative: null };
    }

    const cancellableRows = rows.filter((row) => row.status === "pending" || row.status === "approved");
    if (cancellableRows.length === 0) {
      return { status: "not_cancellable", count: 0, representative: null };
    }

    const [result] = await tx
      .update(vehicleReservations)
      .set({
        status: "cancelled",
        adminComment: adminComment ?? null,
        processedBy: adminUserId,
        processedAt: new Date(),
      })
      .where(and(
        eq(vehicleReservations.recurrenceGroupId, recurrenceGroupId),
        inArray(vehicleReservations.id, cancellableRows.map((row) => row.id)),
        inArray(vehicleReservations.status, ["pending", "approved"]),
      ));

    const affectedRows = Number((result as ResultSetHeader | undefined)?.affectedRows ?? 0);
    if (affectedRows !== cancellableRows.length) {
      throw new Error("반복 차량예약 상태가 변경되어 일괄 취소하지 못했습니다.");
    }

    const first = cancellableRows[0]!;
    return {
      status: "cancelled",
      count: affectedRows,
      representative: {
        id: first.id,
        userId: first.userId,
        reservationDate: first.reservationDate,
        startTime: first.startTime,
        endTime: first.endTime,
        vehicleName: first.vehicleName,
      },
    };
  });
}

export async function getVehicleReservationById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select({
      id: vehicleReservations.id,
      vehicleId: vehicleReservations.vehicleId,
      userId: vehicleReservations.userId,
      reserverName: vehicleReservations.reserverName,
      reserverPhone: vehicleReservations.reserverPhone,
      reservationDate: vehicleReservations.reservationDate,
      startTime: vehicleReservations.startTime,
      endTime: vehicleReservations.endTime,
      status: vehicleReservations.status,
      purpose: vehicleReservations.purpose,
      department: vehicleReservations.department,
      passengers: vehicleReservations.passengers,
      notes: vehicleReservations.notes,
      recurrenceGroupId: vehicleReservations.recurrenceGroupId,
      recurrenceLabel: vehicleReservations.recurrenceLabel,
      recurrenceSequence: vehicleReservations.recurrenceSequence,
      adminComment: vehicleReservations.adminComment,
      createdAt: vehicleReservations.createdAt,
      vehicleName: vehicles.name,
      userName: churchMembers.name,
      userEmail: churchMembers.email,
    })
    .from(vehicleReservations)
    .leftJoin(vehicles, eq(vehicleReservations.vehicleId, vehicles.id))
    .leftJoin(churchMembers, eq(vehicleReservations.userId, churchMembers.id))
    .where(eq(vehicleReservations.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export async function deleteVehicleReservationById(id: number) {
  const db = await getDb();
  if (!db) return false;
  const existing = await db.select({ id: vehicleReservations.id }).from(vehicleReservations).where(eq(vehicleReservations.id, id)).limit(1);
  if (!existing[0]) return false;
  await db.delete(vehicleReservations).where(eq(vehicleReservations.id, id));
  return true;
}
