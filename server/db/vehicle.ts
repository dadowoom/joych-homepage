/**
 * 차량 예약 DB 함수
 * 시설예약과 별도 테이블을 사용합니다. 차량은 별도 휴무/차단일 없이
 * 차량별 운영 시간 안에서 기존 예약 시간만 중복 방지합니다.
 */

import { and, asc, desc, eq, gt, inArray, lt, ne, or, sql } from "drizzle-orm";
import {
  churchMembers,
  InsertVehicle,
  InsertVehicleImage,
  InsertVehicleReservation,
  InsertVehicleReservationAccessRule,
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

export async function createVehicleReservation(data: Omit<InsertVehicleReservation, "id" | "createdAt" | "updatedAt">) {
  const db = await getDb();
  if (!db) return null;
  const [result] = await db.insert(vehicleReservations).values(data).$returningId();
  return result?.id ?? null;
}

export async function createVehicleReservationIfAvailable(
  data: Omit<InsertVehicleReservation, "id" | "createdAt" | "updatedAt">
) {
  const db = await getDb();
  if (!db) return null;
  const lockKey = `vehicle-reservation:${data.vehicleId}:${data.reservationDate}`;

  return db.transaction(async (tx) => {
    const lockResult = await tx.execute(sql`SELECT GET_LOCK(${lockKey}, 5) AS locked`);
    if (Number(extractMysqlScalar(lockResult)) !== 1) {
      throw new VehicleReservationLockError();
    }

    try {
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

      const [result] = await tx.insert(vehicleReservations).values(data).$returningId();
      return result?.id ?? null;
    } finally {
      await tx.execute(sql`SELECT RELEASE_LOCK(${lockKey})`);
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
