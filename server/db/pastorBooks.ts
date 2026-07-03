import { and, asc, desc, eq, inArray } from "drizzle-orm";
import {
  pastorBookImages,
  pastorBooks,
  InsertPastorBook,
  InsertPastorBookImage,
  type PastorBook,
  type PastorBookImage,
} from "../../drizzle/schema";
import { getDb } from "./connection";

type PastorBookWithCover = PastorBook & {
  coverImageUrl: string | null;
};

type PastorBookWithImages = PastorBookWithCover & {
  images: PastorBookImage[];
};

type PastorBookOrderExecutor = Pick<NonNullable<Awaited<ReturnType<typeof getDb>>>, "select" | "update">;

function normalizeBookImageRows(rows: PastorBookImage[]) {
  return [...rows].sort((a, b) => {
    if (a.isThumbnail !== b.isThumbnail) return a.isThumbnail ? -1 : 1;
    return (a.sortOrder || 0) - (b.sortOrder || 0) || a.id - b.id;
  });
}

function normalizeSortOrder(value: number | null | undefined, fallback = 1) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(1, Math.trunc(numeric));
}

function withDisplaySortOrder<T extends { id: number; sortOrder: number }>(rows: T[]) {
  return rows.map((row, index) => ({
    ...row,
    sortOrder: rows.length - index,
  }));
}

async function renumberPastorBooks(db: PastorBookOrderExecutor, movingId?: number, targetSortOrder?: number) {
  const rows = await db
    .select()
    .from(pastorBooks)
    .orderBy(desc(pastorBooks.sortOrder), desc(pastorBooks.publishedAt), desc(pastorBooks.id));

  let orderedRows = rows;
  if (movingId) {
    const movingRow = rows.find((row) => row.id === movingId);
    if (movingRow) {
      const remainingRows = rows.filter((row) => row.id !== movingId);
      const totalRows = remainingRows.length + 1;
      const safeTargetSortOrder = Math.min(Math.max(normalizeSortOrder(targetSortOrder, totalRows), 1), totalRows);
      const targetIndex = totalRows - safeTargetSortOrder;
      orderedRows = [
        ...remainingRows.slice(0, targetIndex),
        movingRow,
        ...remainingRows.slice(targetIndex),
      ];
    }
  }

  for (let index = 0; index < orderedRows.length; index += 1) {
    const row = orderedRows[index];
    const nextSortOrder = orderedRows.length - index;
    if (row.sortOrder !== nextSortOrder) {
      await db
        .update(pastorBooks)
        .set({ sortOrder: nextSortOrder })
        .where(eq(pastorBooks.id, row.id));
    }
  }
}

async function getDisplaySortOrder(id: number, includeHidden = false) {
  const db = await getDb();
  if (!db) return 1;

  const rows = includeHidden
    ? await db.select().from(pastorBooks).orderBy(desc(pastorBooks.sortOrder), desc(pastorBooks.publishedAt), desc(pastorBooks.id))
    : await db
        .select()
        .from(pastorBooks)
        .where(eq(pastorBooks.isVisible, true))
        .orderBy(desc(pastorBooks.sortOrder), desc(pastorBooks.publishedAt), desc(pastorBooks.id));

  const index = rows.findIndex((row) => row.id === id);
  return index >= 0 ? rows.length - index : 1;
}

async function attachCoverImages(rows: PastorBook[]): Promise<PastorBookWithCover[]> {
  const db = await getDb();
  if (!db || rows.length === 0) {
    return rows.map((book) => ({ ...book, coverImageUrl: null }));
  }

  const ids = rows.map((book) => book.id);
  const imageRows = await db
    .select()
    .from(pastorBookImages)
    .where(inArray(pastorBookImages.bookId, ids))
    .orderBy(asc(pastorBookImages.bookId), desc(pastorBookImages.isThumbnail), asc(pastorBookImages.sortOrder), asc(pastorBookImages.id));

  const imagesByBook = new Map<number, PastorBookImage[]>();
  for (const image of imageRows) {
    const list = imagesByBook.get(image.bookId) ?? [];
    list.push(image);
    imagesByBook.set(image.bookId, list);
  }

  return rows.map((book) => ({
    ...book,
    coverImageUrl: normalizeBookImageRows(imagesByBook.get(book.id) ?? [])[0]?.imageUrl ?? null,
  }));
}

export async function getVisiblePastorBooks() {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select()
    .from(pastorBooks)
    .where(eq(pastorBooks.isVisible, true))
    .orderBy(desc(pastorBooks.sortOrder), desc(pastorBooks.publishedAt), desc(pastorBooks.id));
  return withDisplaySortOrder(await attachCoverImages(rows));
}

export async function getPastorBooksForAdmin() {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select()
    .from(pastorBooks)
    .orderBy(desc(pastorBooks.sortOrder), desc(pastorBooks.publishedAt), desc(pastorBooks.id));
  return withDisplaySortOrder(await attachCoverImages(rows));
}

export async function getPastorBookById(id: number, includeHidden = false): Promise<PastorBookWithImages | null> {
  const db = await getDb();
  if (!db) return null;
  const conditions = includeHidden
    ? eq(pastorBooks.id, id)
    : and(eq(pastorBooks.id, id), eq(pastorBooks.isVisible, true));
  const rows = await db.select().from(pastorBooks).where(conditions).limit(1);
  const book = rows[0];
  if (!book) return null;

  const images = await getPastorBookImages(id);
  return {
    ...book,
    sortOrder: await getDisplaySortOrder(id, includeHidden),
    coverImageUrl: normalizeBookImageRows(images)[0]?.imageUrl ?? null,
    images,
  };
}

export async function createPastorBook(data: Omit<InsertPastorBook, "id" | "createdAt" | "updatedAt">) {
  const db = await getDb();
  if (!db) return null;
  return db.transaction(async (tx) => {
    const maxRows = await tx
      .select({ maxSort: pastorBooks.sortOrder })
      .from(pastorBooks)
      .orderBy(desc(pastorBooks.sortOrder))
      .limit(1);
    const nextSortOrder = (maxRows[0]?.maxSort ?? 0) + 1;
    const targetSortOrder = data.sortOrder && data.sortOrder > 0
      ? normalizeSortOrder(data.sortOrder)
      : nextSortOrder;

    const [result] = await tx
      .insert(pastorBooks)
      .values({
        ...data,
        sortOrder: targetSortOrder,
      })
      .$returningId();
    const id = result?.id ?? null;
    if (!id) return null;
    await renumberPastorBooks(tx, id, targetSortOrder);
    return id;
  });
}

export async function updatePastorBook(id: number, data: Partial<Omit<InsertPastorBook, "id" | "createdAt" | "updatedAt">>) {
  const db = await getDb();
  if (!db) return null;
  await db.transaction(async (tx) => {
    const [existing] = await tx.select().from(pastorBooks).where(eq(pastorBooks.id, id)).limit(1);
    if (!existing) return;
    const hasSortOrder = Object.prototype.hasOwnProperty.call(data, "sortOrder");

    await tx
      .update(pastorBooks)
      .set({
        ...data,
        sortOrder: hasSortOrder
          ? normalizeSortOrder(data.sortOrder)
          : existing.sortOrder,
      })
      .where(eq(pastorBooks.id, id));

    if (hasSortOrder) {
      await renumberPastorBooks(tx, id, data.sortOrder ?? existing.sortOrder);
    }
  });
  return getPastorBookById(id, true);
}

export async function reorderPastorBooks(items: { id: number; sortOrder: number }[]) {
  const db = await getDb();
  if (!db || items.length === 0) return;
  await db.transaction(async (tx) => {
    const orderedItems = [...items].sort((a, b) => b.sortOrder - a.sortOrder || a.id - b.id);
    for (let index = 0; index < orderedItems.length; index += 1) {
      const item = orderedItems[index];
      await tx
        .update(pastorBooks)
        .set({ sortOrder: orderedItems.length - index })
        .where(eq(pastorBooks.id, item.id));
    }
  });
}

export async function deletePastorBook(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.transaction(async (tx) => {
    await tx.delete(pastorBookImages).where(eq(pastorBookImages.bookId, id));
    await tx.delete(pastorBooks).where(eq(pastorBooks.id, id));
    await renumberPastorBooks(tx);
  });
}

export async function getPastorBookImages(bookId: number) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select()
    .from(pastorBookImages)
    .where(eq(pastorBookImages.bookId, bookId))
    .orderBy(desc(pastorBookImages.isThumbnail), asc(pastorBookImages.sortOrder), asc(pastorBookImages.id));
  return normalizeBookImageRows(rows);
}

export async function addPastorBookImage(data: Omit<InsertPastorBookImage, "id" | "createdAt">) {
  const db = await getDb();
  if (!db) return null;
  const [result] = await db.insert(pastorBookImages).values(data).$returningId();
  const id = result?.id ?? null;
  if (id && data.isThumbnail) {
    await setPastorBookThumbnail(data.bookId, id);
  }
  return id;
}

export async function deletePastorBookImage(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(pastorBookImages).where(eq(pastorBookImages.id, id));
}

export async function setPastorBookThumbnail(bookId: number, imageId: number) {
  const db = await getDb();
  if (!db) return;
  await db.transaction(async (tx) => {
    await tx
      .update(pastorBookImages)
      .set({ isThumbnail: false })
      .where(eq(pastorBookImages.bookId, bookId));
    await tx
      .update(pastorBookImages)
      .set({ isThumbnail: true })
      .where(and(eq(pastorBookImages.bookId, bookId), eq(pastorBookImages.id, imageId)));
  });
}
