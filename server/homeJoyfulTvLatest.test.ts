import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const connectionMocks = vi.hoisted(() => ({
  getDb: vi.fn(),
}));

const menuMocks = vi.hoisted(() => ({
  getVisibleMenuItemByHref: vi.fn(),
  getVisibleMenuSubItemByHref: vi.fn(),
}));

vi.mock("./db/connection", () => ({
  getDb: connectionMocks.getDb,
}));

vi.mock("./db/menu", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db/menu")>();
  return {
    ...actual,
    getVisibleMenuItemByHref: menuMocks.getVisibleMenuItemByHref,
    getVisibleMenuSubItemByHref: menuMocks.getVisibleMenuSubItemByHref,
  };
});

import {
  getHomeJoyfulTvLatestVideos,
  HOME_JOYFUL_TV_TARGETS,
} from "./db/youtube";
import { appRouter } from "./routers";

type HomeVideo = {
  id: number;
  playlistId: number;
  videoId: string | null;
  videoUrl: string | null;
  title: string;
  preacher: string | null;
  scripture: string | null;
  sermonDate: string | null;
  thumbnailUrl: string | null;
};

function createContext(): TrpcContext {
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

function createHomeLatestDb(videoResults: HomeVideo[][]) {
  const selectResults = [...videoResults];
  const orderBy = vi.fn();
  const limit = vi.fn();

  return {
    select: vi.fn(() => {
      const result = selectResults.shift() ?? [];

      return {
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            orderBy: (...values: unknown[]) => {
              orderBy(...values);
              return {
                limit: async (value: number) => {
                  limit(value);
                  return result;
                },
              };
            },
          })),
        })),
      };
    }),
    orderBy,
    limit,
  };
}

function makeVideo(
  id: number,
  playlistId: number,
  title: string,
  sermonDate: string,
): HomeVideo {
  return {
    id,
    playlistId,
    videoId: `video-${id}`,
    videoUrl: null,
    title,
    preacher: "Preacher",
    scripture: "Scripture",
    sermonDate,
    thumbnailUrl: `https://img.youtube.com/vi/video-${id}/hqdefault.jpg`,
  };
}

describe("home Joyful TV latest videos", () => {
  beforeEach(() => {
    connectionMocks.getDb.mockReset();
    menuMocks.getVisibleMenuItemByHref.mockReset();
    menuMocks.getVisibleMenuSubItemByHref.mockReset();
    menuMocks.getVisibleMenuItemByHref.mockResolvedValue(null);
    menuMocks.getVisibleMenuSubItemByHref.mockResolvedValue(null);
  });

  it("maps each target menu href to its playlist and keeps the newest public row", async () => {
    const [sunday, wednesday, friday] = HOME_JOYFUL_TV_TARGETS;
    menuMocks.getVisibleMenuItemByHref.mockImplementation(async (href: string) => {
      if (href === sunday.href) return { playlistId: 101 };
      // The 3rd-level link below must take precedence over this 2nd-level link.
      if (href === wednesday.href) return { playlistId: 999 };
      return null;
    });
    menuMocks.getVisibleMenuSubItemByHref.mockImplementation(async (href: string) => {
      if (href === wednesday.href) return { playlistId: 202 };
      if (href === friday.href) return { playlistId: 303 };
      return null;
    });
    const db = createHomeLatestDb([
      [
        makeVideo(15, 101, "Newest Sunday sermon", "2026-07-19"),
        makeVideo(14, 101, "Older Sunday sermon", "2026-07-12"),
      ],
      [
        makeVideo(22, 202, "Newest Wednesday sermon", "2026-07-15"),
      ],
      [
        makeVideo(31, 303, "Newest Friday sermon", "2026-07-17"),
      ],
    ]);
    connectionMocks.getDb.mockResolvedValue(db);

    const result = await getHomeJoyfulTvLatestVideos();

    expect(result).toHaveLength(3);
    expect(result.map(({ key, href, playlistId, video }) => ({
      key,
      href,
      playlistId,
      videoId: video?.id ?? null,
      title: video?.title ?? null,
    }))).toEqual([
      {
        key: "sunday",
        href: sunday.href,
        playlistId: 101,
        videoId: 15,
        title: "Newest Sunday sermon",
      },
      {
        key: "wednesday",
        href: wednesday.href,
        playlistId: 202,
        videoId: 22,
        title: "Newest Wednesday sermon",
      },
      {
        key: "friday",
        href: friday.href,
        playlistId: 303,
        videoId: 31,
        title: "Newest Friday sermon",
      },
    ]);
    expect(db.select).toHaveBeenCalledTimes(3);
    expect(db.orderBy).toHaveBeenCalledTimes(3);
    expect(db.limit).toHaveBeenCalledTimes(3);
    expect(db.limit).toHaveBeenCalledWith(1);
    expect(menuMocks.getVisibleMenuItemByHref).toHaveBeenCalledWith(
      sunday.href,
      "guest",
    );
    expect(menuMocks.getVisibleMenuSubItemByHref).toHaveBeenCalledWith(
      friday.href,
      "guest",
    );
  });

  it("keeps an unconnected home target with null playlist and video", async () => {
    const [sunday] = HOME_JOYFUL_TV_TARGETS;
    menuMocks.getVisibleMenuItemByHref.mockImplementation(async (href: string) =>
      href === sunday.href ? { playlistId: 101 } : null
    );
    const db = createHomeLatestDb([[
      makeVideo(15, 101, "Newest Sunday sermon", "2026-07-19"),
    ]]);
    connectionMocks.getDb.mockResolvedValue(db);

    const result = await getHomeJoyfulTvLatestVideos();

    expect(result.find(item => item.key === "sunday")).toMatchObject({
      playlistId: 101,
      video: expect.objectContaining({ id: 15 }),
    });
    expect(result.find(item => item.key === "wednesday")).toMatchObject({
      playlistId: null,
      video: null,
    });
    expect(result.find(item => item.key === "friday")).toMatchObject({
      playlistId: null,
      video: null,
    });
    expect(db.select).toHaveBeenCalledTimes(1);
  });

  it("exposes getHomeLatest to guests and returns stable null fallbacks without a DB", async () => {
    connectionMocks.getDb.mockResolvedValue(null);
    const caller = appRouter.createCaller(createContext());

    await expect(caller.youtube.getHomeLatest()).resolves.toEqual(
      HOME_JOYFUL_TV_TARGETS.map(target => ({
        ...target,
        playlistId: null,
        video: null,
      })),
    );
  });
});
