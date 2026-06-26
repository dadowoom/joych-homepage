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

function normalizeBookImageRows(rows: PastorBookImage[]) {
  return [...rows].sort((a, b) => {
    if (a.isThumbnail !== b.isThumbnail) return a.isThumbnail ? -1 : 1;
    return (a.sortOrder || 0) - (b.sortOrder || 0) || a.id - b.id;
  });
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
    .orderBy(asc(pastorBooks.sortOrder), desc(pastorBooks.publishedAt), desc(pastorBooks.id));
  return attachCoverImages(rows);
}

export async function getPastorBooksForAdmin() {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select()
    .from(pastorBooks)
    .orderBy(asc(pastorBooks.sortOrder), desc(pastorBooks.publishedAt), desc(pastorBooks.id));
  return attachCoverImages(rows);
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
    coverImageUrl: normalizeBookImageRows(images)[0]?.imageUrl ?? null,
    images,
  };
}

export async function createPastorBook(data: Omit<InsertPastorBook, "id" | "createdAt" | "updatedAt">) {
  const db = await getDb();
  if (!db) return null;
  const [result] = await db.insert(pastorBooks).values(data).$returningId();
  return result?.id ?? null;
}

export async function updatePastorBook(id: number, data: Partial<Omit<InsertPastorBook, "id" | "createdAt" | "updatedAt">>) {
  const db = await getDb();
  if (!db) return null;
  await db.update(pastorBooks).set(data).where(eq(pastorBooks.id, id));
  return getPastorBookById(id, true);
}

export async function reorderPastorBooks(items: { id: number; sortOrder: number }[]) {
  const db = await getDb();
  if (!db || items.length === 0) return;
  await db.transaction(async (tx) => {
    for (const item of items) {
      await tx
        .update(pastorBooks)
        .set({ sortOrder: item.sortOrder })
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
