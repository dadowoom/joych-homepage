import { beforeEach, describe, expect, it, vi } from "vitest";

const connectionMocks = vi.hoisted(() => ({
  getDb: vi.fn(),
}));

vi.mock("./db/connection", () => ({
  getDb: connectionMocks.getDb,
}));

import { updateBulletinWithImages } from "./db/bulletin";

type BulletinRow = {
  id: number;
  title: string;
  bulletinDate: string;
  fileName: string;
  fileUrl: string;
  fileSize: number | null;
  fileMime: string | null;
  status: "published" | "hidden" | "archived";
  authorId: number | null;
  viewCount: number;
  createdAt: Date;
  updatedAt: Date;
};

type ImageRow = {
  id: number;
  bulletinId: number;
  fileName: string;
  fileUrl: string;
  fileSize: number | null;
  fileMime: string | null;
  sortOrder: number;
  createdAt: Date;
};

function bulletin(overrides: Partial<BulletinRow> = {}): BulletinRow {
  const now = new Date("2026-07-20T00:00:00Z");
  return {
    id: 42,
    title: "주보",
    bulletinDate: "2026-07-19",
    fileName: "page-1.jpg",
    fileUrl: "https://www.joych.org/uploads/bulletins/page-1.jpg",
    fileSize: 101,
    fileMime: "image/jpeg",
    status: "published",
    authorId: 1,
    viewCount: 0,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function image(id: number, sortOrder = id - 11): ImageRow {
  return {
    id,
    bulletinId: 42,
    fileName: `page-${sortOrder + 1}.jpg`,
    fileUrl: `https://www.joych.org/uploads/bulletins/page-${sortOrder + 1}.jpg`,
    fileSize: 100 + sortOrder,
    fileMime: "image/jpeg",
    sortOrder,
    createdAt: new Date("2026-07-20T00:00:00Z"),
  };
}

function createTransactionDb(row: BulletinRow | null, storedImages: ImageRow[]) {
  const updateSets: Record<string, unknown>[] = [];
  const insertValues: Record<string, unknown>[] = [];
  const deleteWhere = vi.fn();
  const execute = vi.fn();
  let selectIndex = 0;

  const tx = {
    execute,
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => {
          selectIndex += 1;
          if (selectIndex === 1) {
            return {
              limit: vi.fn(async () => row ? [row] : []),
            };
          }
          return {
            orderBy: vi.fn(async () => storedImages),
          };
        }),
      })),
    })),
    delete: vi.fn(() => ({
      where: vi.fn(async () => {
        deleteWhere();
      }),
    })),
    update: vi.fn(() => ({
      set: vi.fn((data: Record<string, unknown>) => ({
        where: vi.fn(async () => {
          updateSets.push(data);
        }),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(async (data: Record<string, unknown>) => {
        insertValues.push(data);
      }),
    })),
  };
  const transaction = vi.fn(async <T>(callback: (value: typeof tx) => Promise<T>) =>
    callback(tx)
  );

  return {
    db: { transaction },
    transaction,
    execute,
    updateSets,
    insertValues,
    deleteWhere,
  };
}

describe("bulletin page database transaction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retains untouched pages, replaces one in place, and synchronizes the cover", async () => {
    const current = [image(11, 0), image(12, 1), image(13, 2), image(14, 3)];
    const fake = createTransactionDb(bulletin(), current);
    connectionMocks.getDb.mockResolvedValue(fake.db);

    const result = await updateBulletinWithImages(
      42,
      { title: "수정 주보" },
      [
        { existingImageId: 11 },
        { existingImageId: 12 },
        {
          image: {
            fileName: "replacement-page-3.jpg",
            fileUrl: "https://www.joych.org/uploads/bulletins/replacement-page-3.jpg",
            fileSize: 303,
            fileMime: "image/jpeg",
          },
        },
        { existingImageId: 14 },
      ],
    );

    expect(result).toEqual({
      status: "updated",
      deletedFileUrls: [current[2]!.fileUrl],
    });
    expect(fake.transaction).toHaveBeenCalledOnce();
    expect(fake.execute).toHaveBeenCalledOnce();
    expect(fake.deleteWhere).toHaveBeenCalledOnce();
    expect(fake.insertValues).toEqual([{
      bulletinId: 42,
      fileName: "replacement-page-3.jpg",
      fileUrl: "https://www.joych.org/uploads/bulletins/replacement-page-3.jpg",
      fileSize: 303,
      fileMime: "image/jpeg",
      sortOrder: 2,
    }]);
    expect(fake.updateSets).toContainEqual({ sortOrder: 0 });
    expect(fake.updateSets).toContainEqual({ sortOrder: 1 });
    expect(fake.updateSets).toContainEqual({ sortOrder: 3 });
    expect(fake.updateSets).toContainEqual({
      title: "수정 주보",
      fileName: current[0]!.fileName,
      fileUrl: current[0]!.fileUrl,
      fileSize: current[0]!.fileSize,
      fileMime: current[0]!.fileMime,
    });
  });

  it("rejects an image id owned by another bulletin before any write", async () => {
    const fake = createTransactionDb(bulletin(), [image(11, 0)]);
    connectionMocks.getDb.mockResolvedValue(fake.db);

    await expect(updateBulletinWithImages(
      42,
      {},
      [{ existingImageId: 999 }],
    )).resolves.toEqual({
      status: "invalid_image_ids",
      invalidImageIds: [999],
      deletedFileUrls: [],
    });
    expect(fake.updateSets).toHaveLength(0);
    expect(fake.insertValues).toHaveLength(0);
    expect(fake.deleteWhere).not.toHaveBeenCalled();
  });

  it("materializes a retained legacy id 0 page instead of losing it", async () => {
    const legacy = bulletin({
      fileName: "legacy.jpg",
      fileUrl: "https://www.joych.org/uploads/bulletins/legacy.jpg",
      fileSize: 88,
    });
    const fake = createTransactionDb(legacy, []);
    connectionMocks.getDb.mockResolvedValue(fake.db);

    const result = await updateBulletinWithImages(
      42,
      {},
      [{ existingImageId: 0 }],
    );

    expect(result).toEqual({ status: "updated", deletedFileUrls: [] });
    expect(fake.insertValues).toEqual([{
      bulletinId: 42,
      fileName: "legacy.jpg",
      fileUrl: legacy.fileUrl,
      fileSize: 88,
      fileMime: "image/jpeg",
      sortOrder: 0,
    }]);
    expect(fake.updateSets).toContainEqual({
      fileName: "legacy.jpg",
      fileUrl: legacy.fileUrl,
      fileSize: 88,
      fileMime: "image/jpeg",
    });
  });

  it("replaces a legacy id 0 page and reports the old file only after the transaction work", async () => {
    const legacy = bulletin({
      fileName: "legacy.jpg",
      fileUrl: "https://www.joych.org/uploads/bulletins/legacy.jpg",
    });
    const fake = createTransactionDb(legacy, []);
    connectionMocks.getDb.mockResolvedValue(fake.db);
    const replacement = {
      fileName: "replacement.jpg",
      fileUrl: "https://www.joych.org/uploads/bulletins/replacement.jpg",
      fileSize: 200,
      fileMime: "image/jpeg",
    };

    const result = await updateBulletinWithImages(
      42,
      {},
      [{ image: replacement }],
    );

    expect(result).toEqual({
      status: "updated",
      deletedFileUrls: [legacy.fileUrl],
    });
    expect(fake.insertValues).toEqual([{
      bulletinId: 42,
      ...replacement,
      sortOrder: 0,
    }]);
    expect(fake.updateSets).toContainEqual(replacement);
  });
});
