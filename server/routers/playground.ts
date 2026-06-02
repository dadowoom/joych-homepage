import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";

const rankingPeriodSchema = z.enum(["weekly", "monthly", "yearly", "all"]);
const rankingMetricSchema = z.enum(["total", "bible", "prayer", "worship", "light", "salt", "heritage"]);

type RankingPeriod = z.infer<typeof rankingPeriodSchema>;
type RankingMetric = z.infer<typeof rankingMetricSchema>;

type RankingEntry = {
  rank: number;
  userId: string | null;
  displayName: string;
  churchName: string | null;
  profilePhoto: string | null;
  score: number;
  totalScore: number | null;
  bibleDays: number | null;
  prayerCount: number | null;
  worshipCount: number | null;
  lightCount: number | null;
  saltCount: number | null;
  heritageCount: number | null;
};

type RankingResponse = {
  churchCode: "joych";
  period: RankingPeriod;
  metric: RankingMetric;
  updatedAt: string | null;
  rankings: RankingEntry[];
};

const FAITHPLUS_BASE_URL =
  process.env.FAITHPLUS_API_BASE_URL?.replace(/\/+$/, "") ||
  "https://faithplus.co.kr";
const CACHE_TTL_MS = 3 * 60 * 1000;
const CACHE = new Map<string, { expiresAt: number; data: RankingResponse }>();

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function toNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const numeric = Number(value.replace(/,/g, "").trim());
    return Number.isFinite(numeric) ? numeric : null;
  }
  return null;
}

function toText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function pickNumber(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = toNumber(record[key]);
    if (value !== null) return value;
  }
  return null;
}

function pickText(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = toText(record[key]);
    if (value) return value;
  }
  return null;
}

function findRankingArray(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (!isRecord(raw)) return [];

  const directKeys = ["rankings", "ranking", "leaderboard", "items", "users", "results"];
  for (const key of directKeys) {
    if (Array.isArray(raw[key])) return raw[key] as unknown[];
  }

  const nestedKeys = ["data", "result"];
  for (const key of nestedKeys) {
    const nested = findRankingArray(raw[key]);
    if (nested.length > 0) return nested;
  }

  return [];
}

function normalizeRankingEntry(
  value: unknown,
  index: number,
  metric: RankingMetric
): RankingEntry | null {
  if (!isRecord(value)) return null;

  const nestedUser = isRecord(value.user)
    ? value.user
    : isRecord(value.member)
      ? value.member
      : {};
  const merged = { ...nestedUser, ...value };
  const rank = pickNumber(merged, ["rank", "ranking", "position", "place"]) ?? index + 1;
  const displayName =
    pickText(merged, ["displayName", "name", "nickname", "userName", "memberName"]) ??
    `성도 ${rank}`;
  const metricScore =
    pickNumber(merged, [
      `${metric}Score`,
      `${metric}_score`,
      "metricValue",
      "value",
      "score",
      "points",
      "totalScore",
      "total_score",
      "total",
    ]) ?? 0;

  return {
    rank,
    userId:
      pickText(merged, ["userId", "user_id", "id", "memberId", "member_id"]) ??
      null,
    displayName,
    churchName:
      pickText(merged, ["churchName", "church_name", "church"]) ?? null,
    profilePhoto:
      pickText(merged, ["profilePhoto", "profile_photo", "photoUrl", "avatarUrl", "imageUrl"]) ??
      null,
    score: metricScore,
    totalScore: pickNumber(merged, ["totalScore", "total_score", "total", "points"]),
    bibleDays: pickNumber(merged, ["totalBibleDays", "bibleDays", "bible_days", "bibleCount"]),
    prayerCount: pickNumber(merged, ["totalPrayerCount", "prayerCount", "prayer_count"]),
    worshipCount: pickNumber(merged, ["totalWorshipCount", "worshipCount", "worship_count"]),
    lightCount: pickNumber(merged, ["totalLightOfWorldCount", "lightOfWorldCount", "lightCount", "light_count"]),
    saltCount: pickNumber(merged, ["totalSaltCount", "saltCount", "salt_count"]),
    heritageCount: pickNumber(merged, ["totalHeritageCount", "heritageCount", "heritage_count"]),
  };
}

function normalizeRankingResponse(
  raw: unknown,
  period: RankingPeriod,
  metric: RankingMetric
): RankingResponse {
  const rankings = findRankingArray(raw)
    .map((entry, index) => normalizeRankingEntry(entry, index, metric))
    .filter((entry): entry is RankingEntry => Boolean(entry))
    .sort((a, b) => a.rank - b.rank);

  const meta = isRecord(raw) ? raw : {};
  const updatedAt =
    pickText(meta, ["updatedAt", "updated_at", "generatedAt", "generated_at"]) ??
    null;

  return {
    churchCode: "joych",
    period,
    metric,
    updatedAt,
    rankings,
  };
}

async function fetchFaithPlusRankings(input: {
  period: RankingPeriod;
  metric: RankingMetric;
  limit: number;
}) {
  const url = new URL("/api/churches/joych/playground/rankings", FAITHPLUS_BASE_URL);
  url.searchParams.set("period", input.period);
  url.searchParams.set("metric", input.metric);
  url.searchParams.set("limit", String(input.limit));

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "joych-homepage/1.0",
      },
      signal: controller.signal,
    });

    const text = await response.text();
    if (!response.ok) {
      throw new TRPCError({
        code: "BAD_GATEWAY",
        message:
          response.status === 404
            ? "FaithPlus 랭킹 API 경로를 찾지 못했습니다."
            : "FaithPlus 랭킹 데이터를 불러오지 못했습니다.",
      });
    }

    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      throw new TRPCError({
        code: "BAD_GATEWAY",
        message: "FaithPlus 랭킹 응답 형식이 올바르지 않습니다.",
      });
    }

    return normalizeRankingResponse(raw, input.period, input.metric);
  } catch (error) {
    if (error instanceof TRPCError) throw error;
    throw new TRPCError({
      code: "BAD_GATEWAY",
      message: "FaithPlus 랭킹 서버에 연결하지 못했습니다.",
    });
  } finally {
    clearTimeout(timeout);
  }
}

export const playgroundRouter = router({
  rankings: publicProcedure
    .input(
      z.object({
        period: rankingPeriodSchema.default("weekly"),
        metric: rankingMetricSchema.default("total"),
        limit: z.number().int().min(3).max(100).default(30),
      })
    )
    .query(async ({ input }) => {
      const cacheKey = `${input.period}:${input.metric}:${input.limit}`;
      const cached = CACHE.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) {
        return cached.data;
      }

      const data = await fetchFaithPlusRankings(input);
      CACHE.set(cacheKey, {
        data,
        expiresAt: Date.now() + CACHE_TTL_MS,
      });
      return data;
    }),
});
