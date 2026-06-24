/**
 * 주보 DB 함수 (server/db/bulletin.ts)
 * ─────────────────────────────────────────────────────────────────────────────
 * 담당 기능:
 *   - 관리자 주보 파일 등록/상태 관리
 *   - 공개 주보 목록 조회
 */

import { and, asc, desc, eq, inArray, ne, sql } from "drizzle-orm";
import {
  type Bulletin,
  bulletinImages,
  bulletins,
  InsertBulletin,
  InsertBulletinImage,
} from "../../drizzle/schema";
import { getDb } from "./connection";

export type BulletinStatus = "published" | "hidden" | "archived";
export type BulletinWithImages = Bulletin & {
  images: Array<{
    id: number;
    bulletinId: number;
    fileName: string;
    fileUrl: string;
    fileSize: number | null;
    fileMime: string | null;
    sortOrder: number;
    createdAt: Date;
  }>;
};

async function requireDb() {
  const db = await getDb();
  if (!db) {
    throw new Error("주보 관리를 위한 DB 연결이 설정되지 않았습니다.");
  }
  return db;
}

export async function listPublishedBulletins(limit = 100) {
  const db = await requireDb();
  const rows = await db
    .select()
    .from(bulletins)
    .where(eq(bulletins.status, "published"))
    .orderBy(desc(bulletins.bulletinDate), desc(bulletins.createdAt))
    .limit(limit);
  return attachBulletinImages(rows);
}

export async function listAdminBulletins(limit = 200) {
  const db = await requireDb();
  const rows = await db
    .select()
    .from(bulletins)
    .where(ne(bulletins.status, "archived"))
    .orderBy(desc(bulletins.bulletinDate), desc(bulletins.createdAt))
    .limit(limit);
  return attachBulletinImages(rows);
}

export async function incrementBulletinViewCount(id: number) {
  const db = await requireDb();
  await db.update(bulletins)
    .set({ viewCount: sql`${bulletins.viewCount} + 1` })
    .where(and(eq(bulletins.id, id), eq(bulletins.status, "published")));
}

export async function createBulletin(data: InsertBulletin) {
  const db = await requireDb();
  const [result] = await db.insert(bulletins).values(data).$returningId();
  return result?.id ?? null;
}

export async function createBulletinWithImages(
  data: InsertBulletin,
  images: Array<Omit<InsertBulletinImage, "id" | "bulletinId" | "createdAt">>
) {
  const db = await requireDb();
  return db.transaction(async (tx) => {
    const [result] = await tx.insert(bulletins).values(data).$returningId();
    const bulletinId = result?.id ?? null;
    if (!bulletinId) return null;

    await tx.insert(bulletinImages).values(
      images.map((image) => ({
        ...image,
        bulletinId,
      }))
    );

    return bulletinId;
  });
}

async function attachBulletinImages(rows: Bulletin[]): Promise<BulletinWithImages[]> {
  if (rows.length === 0) return [];
  const db = await requireDb();
  const bulletinIds = rows.map((row) => row.id);
  const imageRows = await db
    .select()
    .from(bulletinImages)
    .where(inArray(bulletinImages.bulletinId, bulletinIds))
    .orderBy(asc(bulletinImages.bulletinId), asc(bulletinImages.sortOrder), asc(bulletinImages.id));

  const imagesByBulletinId = new Map<number, BulletinWithImages["images"]>();
  for (const image of imageRows) {
    const images = imagesByBulletinId.get(image.bulletinId) ?? [];
    images.push(image);
    imagesByBulletinId.set(image.bulletinId, images);
  }

  return rows.map((row) => ({
    ...row,
    images: imagesByBulletinId.get(row.id) ?? [
      {
        id: 0,
        bulletinId: row.id,
        fileName: row.fileName,
        fileUrl: row.fileUrl,
        fileSize: row.fileSize,
        fileMime: row.fileMime,
        sortOrder: 0,
        createdAt: row.createdAt,
      },
    ],
  }));
}

export async function updateBulletin(
  id: number,
  data: Partial<Pick<InsertBulletin, "title" | "bulletinDate" | "status">>
) {
  const db = await requireDb();
  await db.update(bulletins).set(data).where(eq(bulletins.id, id));
}

export async function archiveBulletin(id: number) {
  const db = await requireDb();
  await db.update(bulletins).set({ status: "archived" }).where(eq(bulletins.id, id));
}
