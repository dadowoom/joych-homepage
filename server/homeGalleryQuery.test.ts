import { MySqlDialect } from "drizzle-orm/mysql-core";
import type { SQL } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";

const connectionMocks = vi.hoisted(() => ({
  getDb: vi.fn(),
}));

vi.mock("./db/connection", () => ({
  getDb: connectionMocks.getDb,
}));

import { getVisibleHomeGalleryItems } from "./db/content";

const EVENT_GALLERY_HREF =
  "/page/%EC%BB%A4%EB%AE%A4%EB%8B%88%ED%8B%B0-%EC%B5%9C%EA%B7%BC-%ED%96%89%EC%82%AC-%EC%82%AC%EC%A7%84";

function galleryItem(data: {
  id: number;
  albumKey: string;
  albumTitle: string;
  imageUrl: string;
  albumSortOrder: number;
  sortOrder: number;
  createdAt: string;
}) {
  const createdAt = new Date(data.createdAt);
  return {
    ...data,
    galleryScopeKey: "event-gallery",
    albumDescription: null,
    caption: data.albumTitle,
    gridSpan: "col-span-1 row-span-1",
    isVisible: true,
    isHomeGallery: false,
    createdAt,
    updatedAt: createdAt,
  };
}

function createHomeGalleryDb() {
  const albumMetadata = [
    {
      albumKey: "album-newest-metadata",
      coverImageId: 101,
      createdAt: new Date("2026-02-01T00:00:00.000Z"),
    },
    {
      albumKey: "album-january",
      coverImageId: 999,
      createdAt: new Date("2026-01-20T00:00:00.000Z"),
    },
  ];
  const legacyCover = galleryItem({
    id: 303,
    albumKey: "legacy-without-album-row",
    albumTitle: "DB 앨범 행이 없는 기존 행사",
    imageUrl: "/api/church-photo/photo/2026/0125/legacy.jpg",
    albumSortOrder: 10,
    sortOrder: 1,
    createdAt: "2026-01-25T00:00:00.000Z",
  });
  const newerCover = galleryItem({
    id: 202,
    albumKey: "album-january",
    albumTitle: "1월 행사",
    imageUrl: "/api/church-photo/photo/2026/0120/january.jpg",
    albumSortOrder: 20,
    sortOrder: 1,
    createdAt: "2026-01-20T00:00:00.000Z",
  });
  const explicitOldCover = galleryItem({
    id: 101,
    albumKey: "album-newest-metadata",
    albumTitle: "앨범 등록일은 최신이지만 표지는 오래된 행사",
    imageUrl: "/api/church-photo/photo/2025/1201/explicit.jpg",
    albumSortOrder: 30,
    sortOrder: 99,
    createdAt: "2025-12-01T00:00:00.000Z",
  });
  const unorderedCovers = [explicitOldCover, legacyCover, newerCover];
  const selectedCoverIds = [legacyCover.id, newerCover.id, explicitOldCover.id];

  let selectCall = 0;
  let executedQuery: SQL | null = null;
  const db = {
    select: vi.fn(() => {
      const call = selectCall++;
      if (call < 2) {
        const rows =
          call === 0
            ? [
                {
                  href: EVENT_GALLERY_HREF,
                  galleryScopeKey: "event-gallery",
                },
              ]
            : [];
        return {
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              orderBy: vi.fn(async () => rows),
            })),
          })),
        };
      }

      return {
        from: vi.fn(() => ({
          where: vi.fn(async () => unorderedCovers),
        })),
      };
    }),
    execute: vi.fn(async (query: SQL) => {
      executedQuery = query;
      return [
        selectedCoverIds.map(coverId => ({ coverId })),
        [],
      ];
    }),
  };

  return {
    db,
    albumMetadata,
    getExecutedQuery: () => executedQuery,
  };
}

describe("home gallery query", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    connectionMocks.getDb.mockResolvedValue(null);
  });

  it("keeps legacy albums and orders all cards by the selected cover rather than album metadata", async () => {
    const fake = createHomeGalleryDb();
    connectionMocks.getDb.mockResolvedValue(fake.db);

    const result = await getVisibleHomeGalleryItems();

    expect(fake.albumMetadata[0].createdAt.getTime()).toBeGreaterThan(
      fake.albumMetadata[1].createdAt.getTime()
    );
    expect(
      fake.albumMetadata.some(
        album => album.albumKey === "legacy-without-album-row"
      )
    ).toBe(false);
    expect(
      result.map(item => ({
        id: item.id,
        title: item.albumTitle,
        albumKey: item.albumKey,
        imageUrl: item.imageUrl,
      }))
    ).toEqual([
      {
        id: 303,
        title: "DB 앨범 행이 없는 기존 행사",
        albumKey: "legacy-without-album-row",
        imageUrl: "/api/church-photo/photo/2026/0125/legacy.jpg",
      },
      {
        id: 202,
        title: "1월 행사",
        albumKey: "album-january",
        imageUrl: "/api/church-photo/photo/2026/0120/january.jpg",
      },
      {
        id: 101,
        title: "앨범 등록일은 최신이지만 표지는 오래된 행사",
        albumKey: "album-newest-metadata",
        imageUrl: "/api/church-photo/photo/2025/1201/explicit.jpg",
      },
    ]);

    const executedQuery = fake.getExecutedQuery();
    expect(executedQuery).not.toBeNull();
    const compiled = new MySqlDialect().sqlToQuery(executedQuery!);
    const normalizedSql = compiled.sql.replace(/\s+/g, " ").toLowerCase();

    expect(normalizedSql).toContain("with visible_item_base as");
    expect(normalizedSql).toContain("legacy_ranked as");
    expect(normalizedSql).toContain("where not exists");
    expect(normalizedSql).toContain(
      "case when photo.id = album.coverimageid then 0 else 1 end"
    );
    expect(normalizedSql).toContain(
      "photo.sortorder asc, photo.createdat desc, photo.id asc"
    );
    expect(normalizedSql).toContain(
      "order by covercreatedat desc, coveralbumsortorder desc"
    );
    expect(compiled.params).toEqual(["event-gallery", "event-gallery", 8]);
  });
});
