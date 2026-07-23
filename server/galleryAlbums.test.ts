import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const connectionMocks = vi.hoisted(() => ({
  getDb: vi.fn(),
}));

vi.mock("./db/connection", () => ({
  getDb: connectionMocks.getDb,
}));

import {
  chooseGalleryCoverId,
  deleteGalleryItem,
  setGalleryAlbumCover,
} from "./db/content";
import { appRouter } from "./routers";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createContext(role: "admin" | "user" | null): TrpcContext {
  const user: AuthenticatedUser | null = role
    ? {
        id: 1,
        openId: `gallery-${role}`,
        email: `${role}@example.com`,
        name: role,
        loginMethod: "test",
        role,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      }
    : null;

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
      cookies: {},
    } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

function createTransactionDb(selectResults: unknown[][]) {
  const updateSets: Record<string, unknown>[] = [];
  const deleted = vi.fn();

  const tx = {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => {
          const result = selectResults.shift() ?? [];
          const promise = Promise.resolve(result);
          return Object.assign(promise, {
            limit: vi.fn(async () => result),
          });
        }),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn((data: Record<string, unknown>) => ({
        where: vi.fn(async () => {
          updateSets.push(data);
        }),
      })),
    })),
    delete: vi.fn(() => ({
      where: vi.fn(async () => {
        deleted();
      }),
    })),
  };

  return {
    db: {
      transaction: async <T>(callback: (transaction: typeof tx) => Promise<T>) =>
        callback(tx),
    },
    updateSets,
    deleted,
  };
}

describe("gallery album cover behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    connectionMocks.getDb.mockResolvedValue(null);
  });

  it("keeps a visible explicit cover and falls back deterministically", () => {
    const items = [
      { id: 10, isVisible: true, sortOrder: 2, createdAt: "2026-07-01" },
      { id: 11, isVisible: false, sortOrder: 0, createdAt: "2026-07-03" },
      { id: 12, isVisible: true, sortOrder: 1, createdAt: "2026-07-02" },
    ];

    expect(chooseGalleryCoverId(items, 10)).toBe(10);
    expect(chooseGalleryCoverId(items, 11)).toBe(12);
    expect(chooseGalleryCoverId(items)).toBe(12);
    expect(chooseGalleryCoverId(items.map(item => ({ ...item, isVisible: false })))).toBeNull();
  });

  it("rejects a cover photo that is not in the requested album", async () => {
    const fake = createTransactionDb([
      [{ id: 1 }],
      [],
    ]);
    connectionMocks.getDb.mockResolvedValue(fake.db);

    await expect(setGalleryAlbumCover("event-gallery", "album-a", 99))
      .resolves.toBe(false);
    expect(fake.updateSets).toHaveLength(0);
  });

  it("replaces a deleted explicit cover with the first remaining visible photo", async () => {
    const fake = createTransactionDb([
      [{
        id: 7,
        galleryScopeKey: "event-gallery",
        albumKey: "album-a",
        isHomeGallery: false,
      }],
      [{ coverImageId: 7 }],
      [
        { id: 8, isVisible: true, sortOrder: 3, createdAt: "2026-07-01" },
        { id: 9, isVisible: true, sortOrder: 4, createdAt: "2026-07-02" },
      ],
    ]);
    connectionMocks.getDb.mockResolvedValue(fake.db);

    await deleteGalleryItem(7, "event-gallery");

    expect(fake.deleted).toHaveBeenCalledOnce();
    expect(fake.updateSets).toContainEqual({ coverImageId: 8 });
  });

  it("keeps an empty album and clears its cover when its last photo is deleted", async () => {
    const fake = createTransactionDb([
      [{
        id: 7,
        galleryScopeKey: "event-gallery",
        albumKey: "album-a",
        isHomeGallery: false,
      }],
      [{ coverImageId: 7 }],
      [],
    ]);
    connectionMocks.getDb.mockResolvedValue(fake.db);

    await deleteGalleryItem(7, "event-gallery");

    expect(fake.deleted).toHaveBeenCalledOnce();
    expect(fake.updateSets).toContainEqual({ coverImageId: null });
  });
});

describe("gallery album API boundaries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    connectionMocks.getDb.mockResolvedValue(null);
  });

  it("keeps album management behind gallery-content permission", async () => {
    const caller = appRouter.createCaller(createContext("user"));

    await expect(caller.cms.content.gallery.listAlbums({
      galleryScopeKey: "event-gallery",
    })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("limits one bulk photo request to 100 items", async () => {
    const caller = appRouter.createCaller(createContext("admin"));
    const items = Array.from({ length: 101 }, (_, index) => ({
      imageUrl: `/uploads/gallery-${index}.jpg`,
    }));

    await expect(caller.cms.content.gallery.createMany({
      galleryScopeKey: "event-gallery",
      albumKey: "album-a",
      items,
    })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("does not report success when an album mutation has no target", async () => {
    const caller = appRouter.createCaller(createContext("admin"));
    const albumIdentity = {
      galleryScopeKey: "event-gallery",
      albumKey: "missing-album",
    };

    await expect(caller.cms.content.gallery.updateAlbumRecord({
      ...albumIdentity,
      title: "수정 제목",
    })).rejects.toMatchObject({ code: "NOT_FOUND" });

    await expect(caller.cms.content.gallery.deleteAlbumRecord(albumIdentity))
      .rejects.toMatchObject({ code: "NOT_FOUND" });

    await expect(caller.cms.content.gallery.setAlbumCover({
      ...albumIdentity,
      photoId: 1,
    })).rejects.toMatchObject({ code: "BAD_REQUEST" });

    await expect(caller.cms.content.gallery.createMany({
      ...albumIdentity,
      items: [{ imageUrl: "/uploads/gallery.jpg" }],
    })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("publishes an empty list when the database is unavailable", async () => {
    const caller = appRouter.createCaller(createContext(null));

    await expect(caller.home.galleryAlbums({
      galleryScopeKey: "event-gallery",
    })).resolves.toEqual([]);
  });
});
