import { afterEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";
import { appRouter } from "./routers";

function createContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("믿음PLUS 플레이그라운드 프록시", () => {
  it("이용자 검색 결과를 홈페이지에 필요한 공개 필드로 정규화한다", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          users: [
            {
              userId: 474,
              displayName: "테스트 성도",
              churchName: "기쁨의교회",
              totalScore: "1,240",
              totalBibleDays: 15,
              totalPrayerCount: 7,
              worshipCount: 4,
              privateField: "노출되면 안 됨",
            },
          ],
        }),
        { status: 200 }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const caller = appRouter.createCaller(createContext());
    const result = await caller.playground.searchUsers({ name: "테스트" });

    expect(result.users).toEqual([
      {
        userId: 474,
        displayName: "테스트 성도",
        churchName: "기쁨의교회",
        profilePhoto: null,
        totalScore: 1240,
        totalBibleDays: 15,
        totalPrayerCount: 7,
        worshipCount: 4,
      },
    ]);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/api/search?name=");
  });

  it("신앙 데이터 상세를 서버에서 가져와 안전한 형태로 정규화한다", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          profile: {
            userId: 474,
            displayName: "테스트 성도",
            churchName: "기쁨의교회",
            totalScore: 220,
            totalBibleDays: 12,
            totalPrayerCount: 3,
            worshipCount: 2,
            monthlyBibleDays: 4,
          },
          rank: 8,
          faithType: {
            faith_type: "말씀형",
            faith_type_code: "bible",
            bible_score: 70,
            prayer_score: 62,
            worship_score: 56,
            light_score: 65,
            salt_score: 63,
          },
          recentActivities: [
            {
              date: "2026-07-11",
              type: "bible",
              description: "성경읽기",
              points: 5,
            },
          ],
          bibleProgress: { booksRead: 10, chaptersRead: 120 },
          garden: { currentStage: 2, totalActivityPoints: 80, totalFruits: 3 },
          evangelism: { contactCount: 1 },
          monthlyActivity: [{ month: "2026-07", bible: 4, prayer: 3, salt: 2, total: 9 }],
          prayerStats: { totalSessions: 12, totalSec: 7200, avgSec: 600, maxSec: 1200 },
          worshipStats: [{ worshipType: "sunday", cnt: 2 }],
          lightActivities: [{ activityDate: "2026-07-10", content: "이웃 섬김", count: 1 }],
        }),
        { status: 200 }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const caller = appRouter.createCaller(createContext());
    const result = await caller.playground.profile({ userId: 474 });

    expect(String(fetchMock.mock.calls[0]?.[0])).toMatch(
      /\/api\/search\/profile\/474$/
    );
    expect(result.profile.displayName).toBe("테스트 성도");
    expect(result.profile.monthlyBibleDays).toBe(4);
    expect(result.bibleProgress).toEqual({ booksRead: 10, chaptersRead: 120 });
    expect(result.recentActivities).toHaveLength(1);
    expect(result.garden.totalFruits).toBe(3);
    expect(result.monthlyActivity).toEqual([{ month: "2026-07", bible: 4, prayer: 3, salt: 2, total: 9 }]);
    expect(result.prayerStats.maxSec).toBe(1200);
    expect(result.worshipStats).toEqual([{ worshipType: "sunday", count: 2 }]);
    expect(result.lightActivities[0]).toMatchObject({ date: "2026-07-10", content: "이웃 섬김" });
  });
});
