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
export type BulletinEditableFields = Partial<
  Pick<InsertBulletin, "title" | "bulletinDate" | "status">
>;
export type BulletinPageUpdate =
  | { existingImageId: number }
  | {
      image: Omit<InsertBulletinImage, "id" | "bulletinId" | "createdAt" | "sortOrder">;
    };
export type UpdateBulletinWithImagesResult =
  | { status: "updated"; deletedFileUrls: string[] }
  | { status: "not_found"; deletedFileUrls: [] }
  | { status: "invalid_image_ids"; invalidImageIds: number[]; deletedFileUrls: [] };

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
  data: BulletinEditableFields
) {
  const db = await requireDb();
  await db.update(bulletins).set(data).where(eq(bulletins.id, id));
}

/**
 * Replaces a bulletin's page layout atomically.
 *
 * Existing page ids are scoped to the target bulletin inside the transaction.
 * A legacy bulletin without bulletin_images may refer to its synthetic list id
 * (0); retaining that page materializes a real child row during this update.
 */
export async function updateBulletinWithImages(
  id: number,
  data: BulletinEditableFields,
  pages: BulletinPageUpdate[],
): Promise<UpdateBulletinWithImagesResult> {
  if (pages.length < 1 || pages.length > 12) {
    throw new Error("A bulletin must contain between 1 and 12 pages.");
  }

  const db = await requireDb();
  return db.transaction(async (tx) => {
    await tx.execute(sql`
      SELECT ${bulletins.id}
      FROM ${bulletins}
      WHERE ${bulletins.id} = ${id}
      FOR UPDATE
    `);

    const [bulletin] = await tx
      .select()
      .from(bulletins)
      .where(eq(bulletins.id, id))
      .limit(1);

    if (!bulletin || bulletin.status === "archived") {
      return { status: "not_found", deletedFileUrls: [] };
    }

    const storedImages = await tx
      .select()
      .from(bulletinImages)
      .where(eq(bulletinImages.bulletinId, id))
      .orderBy(asc(bulletinImages.sortOrder), asc(bulletinImages.id));

    const currentImages: BulletinWithImages["images"] = storedImages.length > 0
      ? storedImages
      : [{
          id: 0,
          bulletinId: bulletin.id,
          fileName: bulletin.fileName,
          fileUrl: bulletin.fileUrl,
          fileSize: bulletin.fileSize,
          fileMime: bulletin.fileMime,
          sortOrder: 0,
          createdAt: bulletin.createdAt,
        }];
    const currentImagesById = new Map(currentImages.map((image) => [image.id, image]));
    const referencedIds = pages.flatMap((page) =>
      "existingImageId" in page ? [page.existingImageId] : []
    );
    const duplicateIds = referencedIds.filter((imageId, index) =>
      referencedIds.indexOf(imageId) !== index
    );
    const invalidImageIds = Array.from(new Set([
      ...referencedIds.filter((imageId) => !currentImagesById.has(imageId)),
      ...duplicateIds,
    ]));

    if (invalidImageIds.length > 0) {
      return { status: "invalid_image_ids", invalidImageIds, deletedFileUrls: [] };
    }

    const retainedIds = new Set(referencedIds);
    const finalImages = pages.map((page, sortOrder) => {
      if ("existingImageId" in page) {
        const existing = currentImagesById.get(page.existingImageId)!;
        return {
          id: existing.id,
          fileName: existing.fileName,
          fileUrl: existing.fileUrl,
          fileSize: existing.fileSize,
          fileMime: existing.fileMime,
          sortOrder,
        };
      }

      return {
        id: null,
        ...page.image,
        sortOrder,
      };
    });

    const removedStoredImageIds = storedImages
      .filter((image) => !retainedIds.has(image.id))
      .map((image) => image.id);
    if (removedStoredImageIds.length > 0) {
      await tx
        .delete(bulletinImages)
        .where(inArray(bulletinImages.id, removedStoredImageIds));
    }

    for (const image of finalImages) {
      if (image.id && retainedIds.has(image.id)) {
        await tx
          .update(bulletinImages)
          .set({ sortOrder: image.sortOrder })
          .where(and(
            eq(bulletinImages.id, image.id),
            eq(bulletinImages.bulletinId, id),
          ));
        continue;
      }

      await tx.insert(bulletinImages).values({
        bulletinId: id,
        fileName: image.fileName,
        fileUrl: image.fileUrl,
        fileSize: image.fileSize,
        fileMime: image.fileMime,
        sortOrder: image.sortOrder,
      });
    }

    const firstImage = finalImages[0]!;
    await tx
      .update(bulletins)
      .set({
        ...data,
        fileName: firstImage.fileName,
        fileUrl: firstImage.fileUrl,
        fileSize: firstImage.fileSize,
        fileMime: firstImage.fileMime,
      })
      .where(and(eq(bulletins.id, id), ne(bulletins.status, "archived")));

    const retainedFileUrls = new Set(finalImages.map((image) => image.fileUrl));
    const deletedFileUrls = currentImages
      .filter((image) => !retainedIds.has(image.id) && !retainedFileUrls.has(image.fileUrl))
      .map((image) => image.fileUrl);

    return { status: "updated", deletedFileUrls };
  });
}

export async function archiveBulletin(id: number) {
  const db = await requireDb();
  await db.update(bulletins).set({ status: "archived" }).where(eq(bulletins.id, id));
}
