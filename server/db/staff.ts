/**
 * 섬기는 분 / 교역자 DB 함수
 * 관리자가 분류를 추가하고, 분류별 정렬 순서를 유지합니다.
 */

import { and, asc, eq, sql } from "drizzle-orm";
import { customAlphabet } from "nanoid";
import {
  churchStaff,
  churchStaffCategories,
  churchStaffTitleOptions,
  type InsertChurchStaff,
} from "../../drizzle/schema";
import { getDb } from "./connection";

export type StaffCategory = string;
type StaffMember = typeof churchStaff.$inferSelect;
type StaffCategoryRow = typeof churchStaffCategories.$inferSelect;
type StaffTitleOptionRow = typeof churchStaffTitleOptions.$inferSelect;
type StaffOrderExecutor = Pick<NonNullable<Awaited<ReturnType<typeof getDb>>>, "select" | "update">;
type StaffCategoryOrderExecutor = Pick<NonNullable<Awaited<ReturnType<typeof getDb>>>, "select" | "update">;

export const DEFAULT_STAFF_CATEGORIES = [
  { categoryKey: "senior", label: "담임목사", sortOrder: 1, isBuiltIn: true, isVisible: true },
  { categoryKey: "associate", label: "부교역자", sortOrder: 2, isBuiltIn: true, isVisible: true },
  { categoryKey: "education", label: "교회학교 교역자", sortOrder: 3, isBuiltIn: true, isVisible: true },
  { categoryKey: "cooperation", label: "협력사역자", sortOrder: 4, isBuiltIn: true, isVisible: true },
  { categoryKey: "elder", label: "장로", sortOrder: 5, isBuiltIn: true, isVisible: true },
  { categoryKey: "office", label: "교회직원", sortOrder: 6, isBuiltIn: true, isVisible: true },
  { categoryKey: "other", label: "사회복지법인 기쁨의복지재단", sortOrder: 7, isBuiltIn: true, isVisible: true },
] as const;

export const DEFAULT_STAFF_TITLE_OPTIONS = [
  { categoryKey: "elder", label: "시무장로", sortOrder: 1, isBuiltIn: true, isVisible: true },
  { categoryKey: "elder", label: "휴무장로", sortOrder: 2, isBuiltIn: true, isVisible: true },
  { categoryKey: "elder", label: "원로장로", sortOrder: 3, isBuiltIn: true, isVisible: true },
  { categoryKey: "elder", label: "은퇴장로", sortOrder: 4, isBuiltIn: true, isVisible: true },
  { categoryKey: "cooperation", label: "협력사역자", sortOrder: 1, isBuiltIn: true, isVisible: true },
  { categoryKey: "cooperation", label: "파송선교사", sortOrder: 2, isBuiltIn: true, isVisible: true },
  { categoryKey: "cooperation", label: "협력선교사", sortOrder: 3, isBuiltIn: true, isVisible: true },
  { categoryKey: "other", label: "이사장", sortOrder: 1, isBuiltIn: true, isVisible: true },
  { categoryKey: "other", label: "감사", sortOrder: 2, isBuiltIn: true, isVisible: true },
  { categoryKey: "other", label: "이사", sortOrder: 3, isBuiltIn: true, isVisible: true },
  { categoryKey: "other", label: "법인사무처", sortOrder: 4, isBuiltIn: true, isVisible: true },
  { categoryKey: "other", label: "창포종합사회복지관", sortOrder: 5, isBuiltIn: true, isVisible: true },
  { categoryKey: "other", label: "경북동부 노인보호전문기관", sortOrder: 6, isBuiltIn: true, isVisible: true },
  { categoryKey: "other", label: "경상북도학대피해 노인전용쉼터", sortOrder: 7, isBuiltIn: true, isVisible: true },
  { categoryKey: "other", label: "경북남부 노인보호전문기관", sortOrder: 8, isBuiltIn: true, isVisible: true },
  { categoryKey: "other", label: "은빛빌리지", sortOrder: 9, isBuiltIn: true, isVisible: true },
  { categoryKey: "other", label: "시립창포어린이집", sortOrder: 10, isBuiltIn: true, isVisible: true },
  { categoryKey: "other", label: "기쁨의지역아동센터", sortOrder: 11, isBuiltIn: true, isVisible: true },
  { categoryKey: "other", label: "창포지역아동센터", sortOrder: 12, isBuiltIn: true, isVisible: true },
  { categoryKey: "other", label: "포항시가족센터", sortOrder: 13, isBuiltIn: true, isVisible: true },
] as const;

const createCategorySuffix = customAlphabet("0123456789abcdefghijklmnopqrstuvwxyz", 8);

function normalizeSortOrder(value: number | null | undefined, fallback: number) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 1) return fallback;
  return Math.floor(numeric);
}

function clampSortOrder(value: number, max: number) {
  return Math.min(Math.max(value, 1), Math.max(max, 1));
}

function normalizeCategoryLabel(label: string) {
  return label.trim().replace(/\s+/g, " ");
}

function normalizeTitleLabel(label: string) {
  return label.trim().replace(/\s+/g, " ");
}

function toDefaultCategoryRows(): StaffCategoryRow[] {
  const now = new Date();
  return DEFAULT_STAFF_CATEGORIES.map((category, index) => ({
    id: index + 1,
    categoryKey: category.categoryKey,
    label: category.label,
    sortOrder: category.sortOrder,
    isBuiltIn: category.isBuiltIn,
    isVisible: category.isVisible,
    createdAt: now,
    updatedAt: now,
  }));
}

function toDefaultTitleOptionRows(): StaffTitleOptionRow[] {
  const now = new Date();
  return DEFAULT_STAFF_TITLE_OPTIONS.map((option, index) => ({
    id: index + 1,
    categoryKey: option.categoryKey,
    label: option.label,
    sortOrder: option.sortOrder,
    isBuiltIn: option.isBuiltIn,
    isVisible: option.isVisible,
    createdAt: now,
    updatedAt: now,
  }));
}

export function orderStaffRowsByTarget<T extends { id: number; sortOrder: number }>(
  rows: T[],
  movingId?: number,
  targetSortOrder?: number
) {
  let orderedRows: T[] = rows;
  if (movingId) {
    const movingRow = rows.find((row) => row.id === movingId);
    if (movingRow) {
      const remainingRows = rows.filter((row) => row.id !== movingId);
      const target = clampSortOrder(
        normalizeSortOrder(targetSortOrder, remainingRows.length + 1),
        remainingRows.length + 1
      );
      orderedRows = [
        ...remainingRows.slice(0, target - 1),
        movingRow,
        ...remainingRows.slice(target - 1),
      ];
    }
  }

  return orderedRows;
}

async function renumberStaffCategory(
  db: StaffOrderExecutor,
  category: StaffCategory,
  movingId?: number,
  targetSortOrder?: number
) {
  const rows = await db.select().from(churchStaff)
    .where(eq(churchStaff.category, category))
    .orderBy(asc(churchStaff.sortOrder), asc(churchStaff.id));

  const orderedRows = orderStaffRowsByTarget(rows, movingId, targetSortOrder);

  for (let index = 0; index < orderedRows.length; index += 1) {
    const row = orderedRows[index];
    const nextSortOrder = index + 1;
    if (row.sortOrder !== nextSortOrder) {
      await db.update(churchStaff)
        .set({ sortOrder: nextSortOrder })
        .where(eq(churchStaff.id, row.id));
    }
  }
}

async function renumberStaffCategories(
  db: StaffCategoryOrderExecutor,
  movingCategoryKey?: string,
  direction?: "up" | "down"
) {
  const rows = await db.select().from(churchStaffCategories)
    .orderBy(asc(churchStaffCategories.sortOrder), asc(churchStaffCategories.id));

  let orderedRows = rows;
  if (movingCategoryKey && direction) {
    const currentIndex = rows.findIndex((row) => row.categoryKey === movingCategoryKey);
    const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (currentIndex >= 0 && targetIndex >= 0 && targetIndex < rows.length) {
      orderedRows = [...rows];
      const [movingRow] = orderedRows.splice(currentIndex, 1);
      if (movingRow) {
        orderedRows.splice(targetIndex, 0, movingRow);
      }
    }
  }

  for (let index = 0; index < orderedRows.length; index += 1) {
    const row = orderedRows[index];
    const nextSortOrder = index + 1;
    if (row.sortOrder !== nextSortOrder) {
      await db.update(churchStaffCategories)
        .set({ sortOrder: nextSortOrder })
        .where(eq(churchStaffCategories.id, row.id));
    }
  }
}

export async function getVisibleStaffCategories() {
  const db = await getDb();
  if (!db) return toDefaultCategoryRows();

  const rows = await db.select().from(churchStaffCategories)
    .where(eq(churchStaffCategories.isVisible, true))
    .orderBy(asc(churchStaffCategories.sortOrder), asc(churchStaffCategories.id));

  return rows.length > 0 ? rows : toDefaultCategoryRows();
}

export async function getAllStaffCategories() {
  const db = await getDb();
  if (!db) return toDefaultCategoryRows();

  const rows = await db.select().from(churchStaffCategories)
    .orderBy(asc(churchStaffCategories.sortOrder), asc(churchStaffCategories.id));

  return rows.length > 0 ? rows : toDefaultCategoryRows();
}

export async function getAllStaffTitleOptions() {
  const db = await getDb();
  if (!db) return toDefaultTitleOptionRows();

  try {
    const rows = await db.select().from(churchStaffTitleOptions)
      .where(eq(churchStaffTitleOptions.isVisible, true))
      .orderBy(
        asc(churchStaffTitleOptions.categoryKey),
        asc(churchStaffTitleOptions.sortOrder),
        asc(churchStaffTitleOptions.id)
      );

    return rows.length > 0 ? rows : toDefaultTitleOptionRows();
  } catch (error) {
    console.error("[Staff] Failed to fetch title options", {
      message: error instanceof Error ? error.message : String(error),
    });
    return toDefaultTitleOptionRows();
  }
}

export async function createStaffTitleOption(categoryKey: string, label: string) {
  const db = await getDb();
  if (!db) return null;

  const normalizedLabel = normalizeTitleLabel(label);
  if (!categoryKey || !normalizedLabel) return null;

  return db.transaction(async (tx) => {
    const [existing] = await tx.select().from(churchStaffTitleOptions)
      .where(and(
        eq(churchStaffTitleOptions.categoryKey, categoryKey),
        eq(churchStaffTitleOptions.label, normalizedLabel)
      ))
      .limit(1);

    if (existing) {
      await tx.update(churchStaffTitleOptions)
        .set({ isVisible: true })
        .where(eq(churchStaffTitleOptions.id, existing.id));
      return { ...existing, isVisible: true };
    }

    const rows = await tx.select().from(churchStaffTitleOptions)
      .where(eq(churchStaffTitleOptions.categoryKey, categoryKey));
    const nextSortOrder = rows.reduce((max, row) => Math.max(max, Number(row.sortOrder) || 0), 0) + 1;
    const [result] = await tx.insert(churchStaffTitleOptions)
      .values({
        categoryKey,
        label: normalizedLabel,
        sortOrder: nextSortOrder,
        isBuiltIn: false,
        isVisible: true,
      })
      .$returningId();

    const id = result?.id ?? null;
    if (!id) return null;

    const [created] = await tx.select().from(churchStaffTitleOptions)
      .where(eq(churchStaffTitleOptions.id, id))
      .limit(1);

    return created ?? null;
  });
}

export async function deleteStaffTitleOption(categoryKey: string, label: string) {
  const db = await getDb();
  if (!db) return;

  const normalizedLabel = normalizeTitleLabel(label);
  if (!categoryKey || !normalizedLabel) return;

  await db.transaction(async (tx) => {
    const [target] = await tx.select().from(churchStaffTitleOptions)
      .where(and(
        eq(churchStaffTitleOptions.categoryKey, categoryKey),
        eq(churchStaffTitleOptions.label, normalizedLabel)
      ))
      .limit(1);

    if (!target) return;

    await tx.update(churchStaffTitleOptions)
      .set({ isVisible: false })
      .where(eq(churchStaffTitleOptions.id, target.id));
  });
}

export async function reorderStaffTitleOptions(categoryKey: string, labels: string[]) {
  const db = await getDb();
  if (!db) return;

  const normalizedLabels = Array.from(
    new Set(labels.map((label) => normalizeTitleLabel(label)).filter(Boolean))
  );
  if (!categoryKey || normalizedLabels.length === 0) return;

  await db.transaction(async (tx) => {
    const rows = await tx.select().from(churchStaffTitleOptions)
      .where(eq(churchStaffTitleOptions.categoryKey, categoryKey))
      .orderBy(asc(churchStaffTitleOptions.sortOrder), asc(churchStaffTitleOptions.id));

    const rowMap = new Map(rows.map((row) => [row.label, row]));
    const orderedRows = normalizedLabels
      .map((label) => rowMap.get(label))
      .filter((row): row is StaffTitleOptionRow => Boolean(row));
    const missingRows = rows.filter((row) => !normalizedLabels.includes(row.label));
    const nextRows = [...orderedRows, ...missingRows];

    for (let index = 0; index < nextRows.length; index += 1) {
      const row = nextRows[index];
      const nextSortOrder = index + 1;
      if (row.sortOrder !== nextSortOrder) {
        await tx.update(churchStaffTitleOptions)
          .set({ sortOrder: nextSortOrder })
          .where(eq(churchStaffTitleOptions.id, row.id));
      }
    }
  });
}

export async function createStaffCategory(label: string) {
  const db = await getDb();
  if (!db) return null;

  const normalizedLabel = normalizeCategoryLabel(label);
  if (!normalizedLabel) return null;

  return db.transaction(async (tx) => {
    const [existing] = await tx.select().from(churchStaffCategories)
      .where(eq(churchStaffCategories.label, normalizedLabel))
      .limit(1);

    if (existing) return existing;

    const rows = await tx.select().from(churchStaffCategories);
    const nextSortOrder = rows.reduce((max, row) => Math.max(max, Number(row.sortOrder) || 0), 0) + 1;
    const categoryKey = `custom-${createCategorySuffix()}`;
    const [result] = await tx.insert(churchStaffCategories)
      .values({
        categoryKey,
        label: normalizedLabel,
        sortOrder: nextSortOrder,
        isBuiltIn: false,
        isVisible: true,
      })
      .$returningId();

    const id = result?.id ?? null;
    if (!id) return null;

    const [created] = await tx.select().from(churchStaffCategories)
      .where(eq(churchStaffCategories.id, id))
      .limit(1);

    return created ?? null;
  });
}

export async function moveStaffCategory(categoryKey: string, direction: "up" | "down") {
  const db = await getDb();
  if (!db) return;

  await db.transaction(async (tx) => {
    await renumberStaffCategories(tx, categoryKey, direction);
  });
}

export async function reorderStaffCategories(categoryKeys: string[]) {
  const db = await getDb();
  if (!db) return;

  const uniqueKeys = Array.from(new Set(categoryKeys));

  await db.transaction(async (tx) => {
    const rows = await tx.select().from(churchStaffCategories)
      .orderBy(asc(churchStaffCategories.sortOrder), asc(churchStaffCategories.id));

    const rowMap = new Map(rows.map((row) => [row.categoryKey, row]));
    const orderedRows = uniqueKeys
      .map((categoryKey) => rowMap.get(categoryKey))
      .filter((row): row is StaffCategoryRow => Boolean(row));
    const missingRows = rows.filter((row) => !uniqueKeys.includes(row.categoryKey));
    const nextRows = [...orderedRows, ...missingRows];

    for (let index = 0; index < nextRows.length; index += 1) {
      const row = nextRows[index];
      const nextSortOrder = index + 1;
      if (row.sortOrder !== nextSortOrder) {
        await tx.update(churchStaffCategories)
          .set({ sortOrder: nextSortOrder })
          .where(eq(churchStaffCategories.id, row.id));
      }
    }
  });
}

export async function deleteStaffCategory(categoryKey: string) {
  const db = await getDb();
  if (!db) return;

  await db.transaction(async (tx) => {
    const [category] = await tx.select().from(churchStaffCategories)
      .where(eq(churchStaffCategories.categoryKey, categoryKey))
      .limit(1);

    if (!category) return;

    const members = await tx.select({ id: churchStaff.id }).from(churchStaff)
      .where(eq(churchStaff.category, categoryKey))
      .limit(1);

    if (members.length > 0) {
      throw new Error("이 분류에 등록된 사람이 있어 삭제할 수 없습니다. 먼저 해당 인원을 다른 분류로 옮겨주세요.");
    }

    await tx.delete(churchStaffCategories)
      .where(eq(churchStaffCategories.categoryKey, categoryKey));
    await renumberStaffCategories(tx);
  });
}

export async function getVisibleStaffMembers(category?: StaffCategory) {
  const db = await getDb();
  if (!db) return [];

  const visibleOnly = sql`${churchStaff.isVisible} = 1`;
  const where = category
    ? and(visibleOnly, eq(churchStaff.category, category))
    : visibleOnly;

  try {
    return await db.select().from(churchStaff)
      .where(where)
      .orderBy(asc(churchStaff.category), asc(churchStaff.sortOrder), asc(churchStaff.id));
  } catch (error) {
    const cause = error instanceof Error && "cause" in error ? error.cause : undefined;
    console.error("[Staff] Failed to fetch visible staff members", {
      message: error instanceof Error ? error.message : String(error),
      cause: cause instanceof Error ? cause.message : cause,
    });
    throw error;
  }
}

export async function getAllStaffMembers() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(churchStaff)
    .orderBy(asc(churchStaff.category), asc(churchStaff.sortOrder), asc(churchStaff.id));
}

export async function createStaffMember(data: InsertChurchStaff) {
  const db = await getDb();
  if (!db) return null;
  return db.transaction(async (tx) => {
    const category = data.category ?? "associate";
    const [result] = await tx.insert(churchStaff)
      .values({
        ...data,
        category,
        sortOrder: normalizeSortOrder(data.sortOrder, 0),
      })
      .$returningId();
    const id = result?.id ?? null;
    if (!id) return null;

    await renumberStaffCategory(tx, category, id, data.sortOrder);
    return id;
  });
}

export async function updateStaffMember(id: number, data: Partial<InsertChurchStaff>) {
  const db = await getDb();
  if (!db) return;
  await db.transaction(async (tx) => {
    const [existing] = await tx.select().from(churchStaff).where(eq(churchStaff.id, id)).limit(1);
    if (!existing) return;

    const previousCategory = existing.category as StaffCategory;
    const nextCategory = (data.category ?? previousCategory) as StaffCategory;
    await tx.update(churchStaff).set(data).where(eq(churchStaff.id, id));

    if (previousCategory !== nextCategory) {
      await renumberStaffCategory(tx, previousCategory);
    }
    await renumberStaffCategory(
      tx,
      nextCategory,
      id,
      data.sortOrder ?? existing.sortOrder
    );
  });
}

export async function deleteStaffMember(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.transaction(async (tx) => {
    const [existing] = await tx.select().from(churchStaff).where(eq(churchStaff.id, id)).limit(1);
    if (!existing) return;
    await tx.delete(churchStaff).where(eq(churchStaff.id, id));
    await renumberStaffCategory(tx, existing.category as StaffCategory);
  });
}
