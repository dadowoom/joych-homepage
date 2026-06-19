import { and, asc, desc, eq, inArray } from "drizzle-orm";
import {
  historyDecades,
  historyItems,
  type InsertHistoryDecade,
  type InsertHistoryItem,
} from "../../drizzle/schema";
import { getDb } from "./connection";

function normalizeSortOrder(value: number | null | undefined) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function compactUpdate<T extends Record<string, unknown>>(data: T) {
  return Object.fromEntries(
    Object.entries(data).filter(([, value]) => value !== undefined),
  ) as Partial<T>;
}

export async function getAllHistoryDecades() {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(historyDecades)
    .orderBy(asc(historyDecades.sortOrder), desc(historyDecades.startYear), asc(historyDecades.id));
}

export async function getAllHistoryItems() {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(historyItems)
    .orderBy(asc(historyItems.sortOrder), asc(historyItems.year), asc(historyItems.month), asc(historyItems.id));
}

export async function getPublicHistory() {
  const db = await getDb();
  if (!db) return { decades: [], items: [] };

  const decades = await db
    .select()
    .from(historyDecades)
    .where(eq(historyDecades.isVisible, true))
    .orderBy(asc(historyDecades.sortOrder), desc(historyDecades.startYear), asc(historyDecades.id));

  const decadeIds = decades.map((decade) => decade.id);
  if (!decadeIds.length) {
    return { decades, items: [] };
  }

  const items = await db
    .select()
    .from(historyItems)
    .where(and(eq(historyItems.isVisible, true), inArray(historyItems.decadeId, decadeIds)))
    .orderBy(asc(historyItems.sortOrder), asc(historyItems.year), asc(historyItems.month), asc(historyItems.id));

  return { decades, items };
}

export async function createHistoryDecade(data: InsertHistoryDecade) {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured.");

  await db.insert(historyDecades).values({
    ...data,
    sortOrder: normalizeSortOrder(data.sortOrder),
  });
}

export async function updateHistoryDecade(id: number, data: Partial<InsertHistoryDecade>) {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured.");

  const updateData = compactUpdate(data);
  if (!Object.keys(updateData).length) return;

  await db.update(historyDecades).set(updateData).where(eq(historyDecades.id, id));
}

export async function deleteHistoryDecade(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured.");

  await db.delete(historyItems).where(eq(historyItems.decadeId, id));
  await db.delete(historyDecades).where(eq(historyDecades.id, id));
}

export async function reorderHistoryDecades(ids: number[]) {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured.");

  for (let index = 0; index < ids.length; index += 1) {
    const id = ids[index];
    await db.update(historyDecades).set({ sortOrder: index + 1 }).where(eq(historyDecades.id, id));
  }
}

export async function createHistoryItem(data: InsertHistoryItem) {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured.");

  await db.insert(historyItems).values({
    ...data,
    sortOrder: normalizeSortOrder(data.sortOrder),
  });
}

export async function updateHistoryItem(id: number, data: Partial<InsertHistoryItem>) {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured.");

  const updateData = compactUpdate(data);
  if (!Object.keys(updateData).length) return;

  await db.update(historyItems).set(updateData).where(eq(historyItems.id, id));
}

export async function deleteHistoryItem(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured.");

  await db.delete(historyItems).where(eq(historyItems.id, id));
}

export async function reorderHistoryItems(ids: number[]) {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured.");

  for (let index = 0; index < ids.length; index += 1) {
    const id = ids[index];
    await db.update(historyItems).set({ sortOrder: index + 1 }).where(eq(historyItems.id, id));
  }
}
