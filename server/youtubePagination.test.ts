import type { SQL } from "drizzle-orm";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const connectionMocks = vi.hoisted(() => ({
  getDb: vi.fn(),
}));

vi.mock("./db/connection", () => ({
  getDb: connectionMocks.getDb,
}));

import {
  getVisibleYoutubeVideoById,
  getVisibleYoutubeVideosPage,
  getYoutubeVideosPageByPlaylist,
  normalizeYoutubeVideoSearch,
  resolveYoutubeVideoPageBounds,
} from "./db/youtube";
import { appRouter } from "./routers";

function createGuestContext(): TrpcContext {
  return {
    user: null,
    memberId: null,
    memberName: null,
    req: {
      protocol: "https",
      headers: {},
      cookies: {},
    } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

function makeVideo(id: number) {
  return {
    id,
    playlistId: 7,
    videoId: `video-${id}`,
    videoUrl: null,
    title: `Video ${id}`,
    preacher: "Preacher",
    scripture: "Scripture",
    sermonDate: "2026-08-04",
    thumbnailUrl: null,
    description: null,
    sortOrder: id,
    isVisible: true,
    createdAt: new Date("2026-08-04T00:00:00.000Z"),
    updatedAt: new Date("2026-08-04T00:00:00.000Z"),
  };
}

function createPageDb({
  counts,
  items,
}: {
  counts: number[];
  items: ReturnType<typeof makeVideo>[];
}) {
  let countIndex = 0;
  let dataIndex = 0;
  const limit = vi.fn();
  const offset = vi.fn();
  const orderBy = vi.fn();
  const where = vi.fn();

  const db = {
    select: vi.fn((selection?: Record<string, unknown>) => {
      const isCount = Boolean(selection && "total" in selection);
      const result = dataIndex++ === 0 ? items : [];
      return {
        from: vi.fn(() => ({
          where: vi.fn((condition: unknown) => {
            where(condition);
            if (isCount) {
              dataIndex -= 1;
              return Promise.resolve([{ total: counts[countIndex++] ?? 0 }]);
            }
            return {
              orderBy: (...values: unknown[]) => {
                orderBy(...values);
                return {
                  limit: (value: number) => {
                    limit(value);
                    return {
                      offset: async (offsetValue: number) => {
                        offset(offsetValue);
                        return result;
                      },
                    };
                  },
                };
              },
              limit: async (value: number) => {
                limit(value);
                return result;
              },
            };
          }),
        })),
      };
    }),
  };

  return { db, limit, offset, orderBy, where };
}

describe("YouTube video server pagination", () => {
  beforeEach(() => {
    connectionMocks.getDb.mockReset();
  });

  it("normalizes search text and displayed dotted dates for SQL search", () => {
    expect(normalizeYoutubeVideoSearch("  Pastor  ")).toEqual({
      keyword: "pastor",
      normalizedDateKeyword: "pastor",
    });
    expect(normalizeYoutubeVideoSearch(" 2026.08.04 ")).toEqual({
      keyword: "2026.08.04",
      normalizedDateKeyword: "2026-08-04",
    });
  });

  it("clamps pages and only accepts the supported 20/50/100 sizes", () => {
    expect(resolveYoutubeVideoPageBounds(135, 3, 50)).toEqual({
      page: 3,
      pageSize: 50,
      totalPages: 3,
      offset: 100,
    });
    expect(resolveYoutubeVideoPageBounds(5, 99, 25)).toEqual({
      page: 1,
      pageSize: 20,
      totalPages: 1,
      offset: 0,
    });
  });

  it("returns only the requested admin page and keeps filtered and full totals", async () => {
    const items = Array.from({ length: 20 }, (_, index) => makeVideo(index + 21));
    const { db, limit, offset } = createPageDb({ counts: [45, 60], items });
    connectionMocks.getDb.mockResolvedValue(db);

    const result = await getYoutubeVideosPageByPlaylist({
      playlistId: 7,
      page: 2,
      pageSize: 20,
      search: " Pastor ",
    });

    expect(result).toMatchObject({
      items,
      total: 45,
      unfilteredTotal: 60,
      page: 2,
      pageSize: 20,
      totalPages: 3,
      offset: 20,
      search: "Pastor",
    });
    expect(db.select).toHaveBeenCalledTimes(3);
    expect(limit).toHaveBeenCalledWith(20);
    expect(offset).toHaveBeenCalledWith(20);
  });

  it("keeps the public page query limited to count and the requested rows", async () => {
    const items = Array.from({ length: 20 }, (_, index) => makeVideo(index + 21));
    const { db, limit, offset } = createPageDb({ counts: [45], items });
    connectionMocks.getDb.mockResolvedValue(db);

    const result = await getVisibleYoutubeVideosPage({
      playlistId: 7,
      page: 2,
      pageSize: 20,
    });

    expect(result.items).toEqual(items);
    expect(db.select).toHaveBeenCalledTimes(2);
    expect(limit).toHaveBeenCalledWith(20);
    expect(offset).toHaveBeenCalledWith(20);
  });

  it("applies public visibility, choir date, playlist, id, and search filters to the single-row query", async () => {
    const focused = makeVideo(3);
    const { db, limit, where } = createPageDb({ counts: [], items: [focused] });
    connectionMocks.getDb.mockResolvedValue(db);

    const result = await getVisibleYoutubeVideoById({
      playlistId: 90007,
      id: focused.id,
      search: "Video",
    });

    expect(result).toBe(focused);
    expect(db.select).toHaveBeenCalledTimes(1);
    expect(limit).toHaveBeenCalledWith(1);

    const query = new MySqlDialect().sqlToQuery(where.mock.calls[0][0] as SQL);
    expect(query.sql).toContain("`youtube_videos`.`playlistId` = ?");
    expect(query.sql).toContain("`youtube_videos`.`id` = ?");
    expect(query.sql).toContain("`youtube_videos`.`isVisible` = ?");
    expect(query.sql).toContain("`youtube_videos`.`sermonDate` >= ?");
    expect(query.sql).toContain("locate(");
  });

  it("keeps the paged public endpoint open to guests and the admin endpoint protected", async () => {
    const items = [makeVideo(1)];
    const { db } = createPageDb({ counts: [1], items });
    connectionMocks.getDb.mockResolvedValue(db);
    const caller = appRouter.createCaller(createGuestContext());

    await expect(caller.youtube.getVideosPage({
      playlistId: 7,
      page: 1,
      pageSize: 20,
    })).resolves.toMatchObject({ items, total: 1 });
    await expect(caller.youtube.getVideosAdminPage({
      playlistId: 7,
      page: 1,
      pageSize: 20,
    })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("exposes the filtered single-row endpoint to guests and rejects invalid ids", async () => {
    const focused = makeVideo(3);
    const { db } = createPageDb({ counts: [], items: [focused] });
    connectionMocks.getDb.mockResolvedValue(db);
    const caller = appRouter.createCaller(createGuestContext());

    await expect(caller.youtube.getVisibleVideo({
      playlistId: 7,
      id: focused.id,
    })).resolves.toEqual(focused);
    await expect(caller.youtube.getVisibleVideo({
      playlistId: 7,
      id: 0,
    })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("returns null when the single-row public filters do not match", async () => {
    const { db } = createPageDb({ counts: [], items: [] });
    connectionMocks.getDb.mockResolvedValue(db);

    await expect(getVisibleYoutubeVideoById({
      playlistId: 7,
      id: 999,
    })).resolves.toBeNull();
  });
});
