import { TRPCError } from "@trpc/server";

export type FaithPlusProfileResponse = {
  profile: {
    userId: number;
    displayName: string;
    churchName: string | null;
    gender: string;
    age: number;
    profilePhoto: string | null;
    totalScore: number;
    totalBibleDays: number;
    totalPrayerCount: number;
    worshipCount: number;
    lightOfWorldCount: number;
    totalPrayerSec: number;
    monthlyBibleDays: number;
    monthlyPrayerCount: number;
    monthlyWorshipCount: number;
    monthlyLightOfWorldCount: number;
    monthlyPrayerSec: number;
  };
  rank: number | null;
  rankScore: number;
  totalUsers: number;
  faithType:
    | {
        faith_type: string;
        faith_type_code: string;
        bible_score: number;
        prayer_score: number;
        worship_score: number;
        light_score: number;
        salt_score: number;
        ai_analysis: string | null;
        ai_advice: string | null;
        recommended_verse: string | null;
        year_month: string;
      }
    | string
    | null;
  faithHistory: Array<{
    date: string;
    type: string;
    description: string;
    bibleScore: number;
    prayerScore: number;
    worshipScore: number;
    lightScore: number;
    saltScore: number;
  }>;
  recentActivities: Array<{
    date: string;
    type: string;
    description: string;
    points: number;
  }>;
  bibleProgress: { booksRead: number; chaptersRead: number };
  evangelism: { contactCount: number };
  garden: { currentStage: number; totalActivityPoints: number; totalFruits: number };
  monthlyActivity: Array<{ month: string; bible: number; prayer: number; salt: number; total: number }>;
  prayerStats: { totalSessions: number; totalSec: number; avgSec: number; maxSec: number };
  worshipStats: Array<{ worshipType: string; count: number }>;
  lightActivities: Array<{ date: string; content: string; count: number }>;
};

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

function normalizeFaithType(value: unknown): FaithPlusProfileResponse["faithType"] {
  if (typeof value === "string") return value.trim() || null;
  if (!isRecord(value)) return null;

  return {
    faith_type: pickText(value, ["faith_type", "faithType"]) ?? "",
    faith_type_code: pickText(value, ["faith_type_code", "faithTypeCode"]) ?? "",
    bible_score: pickNumber(value, ["bible_score", "bibleScore"]) ?? 0,
    prayer_score: pickNumber(value, ["prayer_score", "prayerScore"]) ?? 0,
    worship_score: pickNumber(value, ["worship_score", "worshipScore"]) ?? 0,
    light_score: pickNumber(value, ["light_score", "lightScore"]) ?? 0,
    salt_score: pickNumber(value, ["salt_score", "saltScore"]) ?? 0,
    ai_analysis: pickText(value, ["ai_analysis", "aiAnalysis"]),
    ai_advice: pickText(value, ["ai_advice", "aiAdvice"]),
    recommended_verse: pickText(value, ["recommended_verse", "recommendedVerse"]),
    year_month: pickText(value, ["year_month", "yearMonth"]) ?? "",
  };
}

function normalizeHistory(value: unknown): FaithPlusProfileResponse["faithHistory"] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!isRecord(item)) return [];
    return [{
      date: pickText(item, ["date", "activityDate", "activity_date", "createdAt", "created_at"]) ?? "",
      type: pickText(item, ["type", "activityType", "activity_type"]) ?? "",
      description: pickText(item, ["description", "memo", "content", "title"]) ?? "",
      bibleScore: pickNumber(item, ["bible_score", "bibleScore"]) ?? 0,
      prayerScore: pickNumber(item, ["prayer_score", "prayerScore"]) ?? 0,
      worshipScore: pickNumber(item, ["worship_score", "worshipScore"]) ?? 0,
      lightScore: pickNumber(item, ["light_score", "lightScore"]) ?? 0,
      saltScore: pickNumber(item, ["salt_score", "saltScore"]) ?? 0,
    }];
  });
}

function normalizeRecentActivities(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!isRecord(item)) return [];
    return [{
      date: pickText(item, ["date", "activityDate", "activity_date", "createdAt", "created_at"]) ?? "",
      type: pickText(item, ["type", "activityType", "activity_type"]) ?? "",
      description: pickText(item, ["description", "memo", "content", "title"]) ?? "",
      points: pickNumber(item, ["points", "score", "value"]) ?? 0,
    }];
  });
}

function normalizeMonthlyActivity(value: unknown): FaithPlusProfileResponse["monthlyActivity"] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!isRecord(item)) return [];
    return [{
      month: pickText(item, ["month", "year_month", "yearMonth"]) ?? "",
      bible: pickNumber(item, ["bible", "bibleCount", "bible_count"]) ?? 0,
      prayer: pickNumber(item, ["prayer", "prayerCount", "prayer_count"]) ?? 0,
      salt: pickNumber(item, ["salt", "saltCount", "salt_count"]) ?? 0,
      total: pickNumber(item, ["total", "totalCount", "total_count"]) ?? 0,
    }];
  });
}

function normalizeWorshipStats(value: unknown): FaithPlusProfileResponse["worshipStats"] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!isRecord(item)) return [];
    return [{
      worshipType: pickText(item, ["worshipType", "worship_type", "type"]) ?? "",
      count: pickNumber(item, ["cnt", "count", "total"]) ?? 0,
    }];
  });
}

function normalizeLightActivities(value: unknown): FaithPlusProfileResponse["lightActivities"] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!isRecord(item)) return [];
    return [{
      date: pickText(item, ["date", "activityDate", "activity_date"]) ?? "",
      content: pickText(item, ["content", "memo", "description", "title"]) ?? "",
      count: pickNumber(item, ["count", "cnt", "total"]) ?? 0,
    }];
  });
}

function normalizeProfile(raw: unknown): FaithPlusProfileResponse {
  if (!isRecord(raw) || !isRecord(raw.profile)) {
    throw new TRPCError({
      code: "BAD_GATEWAY",
      message: "FaithPlus 신앙 데이터 응답 형식이 올바르지 않습니다.",
    });
  }

  const profile = raw.profile;
  const userId = pickNumber(profile, ["userId", "user_id", "id"]);
  const displayName = pickText(profile, ["displayName", "display_name", "name"]);
  if (!userId || !displayName) {
    throw new TRPCError({
      code: "BAD_GATEWAY",
      message: "FaithPlus 신앙 데이터의 성도 정보가 올바르지 않습니다.",
    });
  }

  const bibleProgress = isRecord(raw.bibleProgress) ? raw.bibleProgress : {};
  const evangelism = isRecord(raw.evangelism) ? raw.evangelism : {};
  const garden = isRecord(raw.garden) ? raw.garden : {};
  const prayerStats = isRecord(raw.prayerStats) ? raw.prayerStats : {};

  return {
    profile: {
      userId,
      displayName,
      churchName: pickText(profile, ["churchName", "church_name", "church"]),
      gender: pickText(profile, ["gender"]) ?? "",
      age: pickNumber(profile, ["age"]) ?? 0,
      profilePhoto: pickText(profile, ["profilePhoto", "profile_photo", "photoUrl", "avatarUrl"]),
      totalScore: pickNumber(profile, ["totalScore", "total_score", "score", "points"]) ?? 0,
      totalBibleDays: pickNumber(profile, ["totalBibleDays", "total_bible_days", "bibleDays"]) ?? 0,
      totalPrayerCount: pickNumber(profile, ["totalPrayerCount", "total_prayer_count", "prayerCount"]) ?? 0,
      worshipCount: pickNumber(profile, ["worshipCount", "worship_count", "totalWorshipCount"]) ?? 0,
      lightOfWorldCount: pickNumber(profile, ["lightOfWorldCount", "light_of_world_count", "lightCount"]) ?? 0,
      totalPrayerSec: pickNumber(profile, ["totalPrayerSec", "total_prayer_sec", "prayerSeconds"]) ?? 0,
      monthlyBibleDays: pickNumber(profile, ["monthlyBibleDays", "monthly_bible_days"]) ?? 0,
      monthlyPrayerCount: pickNumber(profile, ["monthlyPrayerCount", "monthly_prayer_count"]) ?? 0,
      monthlyWorshipCount: pickNumber(profile, ["monthlyWorshipCount", "monthly_worship_count"]) ?? 0,
      monthlyLightOfWorldCount: pickNumber(profile, ["monthlyLightOfWorldCount", "monthly_light_of_world_count"]) ?? 0,
      monthlyPrayerSec: pickNumber(profile, ["monthlyPrayerSec", "monthly_prayer_sec"]) ?? 0,
    },
    rank: pickNumber(raw, ["rank", "ranking"]),
    rankScore: pickNumber(raw, ["rankScore", "rank_score"]) ?? 0,
    totalUsers: pickNumber(raw, ["totalUsers", "total_users"]) ?? 0,
    faithType: normalizeFaithType(raw.faithType),
    faithHistory: normalizeHistory(raw.faithHistory),
    recentActivities: normalizeRecentActivities(raw.recentActivities),
    bibleProgress: {
      booksRead: pickNumber(bibleProgress, ["booksRead", "books_read"]) ?? 0,
      chaptersRead: pickNumber(bibleProgress, ["chaptersRead", "chapters_read"]) ?? 0,
    },
    evangelism: {
      contactCount: pickNumber(evangelism, ["contactCount", "contact_count"]) ?? 0,
    },
    garden: {
      currentStage: pickNumber(garden, ["currentStage", "current_stage", "stage"]) ?? 0,
      totalActivityPoints: pickNumber(garden, ["totalActivityPoints", "total_activity_points", "points"]) ?? 0,
      totalFruits: pickNumber(garden, ["totalFruits", "total_fruits", "fruits"]) ?? 0,
    },
    monthlyActivity: normalizeMonthlyActivity(raw.monthlyActivity),
    prayerStats: {
      totalSessions: pickNumber(prayerStats, ["totalSessions", "total_sessions", "count"]) ?? 0,
      totalSec: pickNumber(prayerStats, ["totalSec", "total_sec", "seconds"]) ?? 0,
      avgSec: pickNumber(prayerStats, ["avgSec", "avg_sec", "averageSec"]) ?? 0,
      maxSec: pickNumber(prayerStats, ["maxSec", "max_sec", "maximumSec"]) ?? 0,
    },
    worshipStats: normalizeWorshipStats(raw.worshipStats),
    lightActivities: normalizeLightActivities(raw.lightActivities),
  };
}

export async function fetchFaithPlusProfile(baseUrl: string, userId: number) {
  const url = new URL(`/api/search/profile/${userId}`, baseUrl);
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
        message: "FaithPlus 신앙 데이터를 불러오지 못했습니다.",
      });
    }

    try {
      return normalizeProfile(JSON.parse(text));
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: "BAD_GATEWAY",
        message: "FaithPlus 신앙 데이터 응답 형식이 올바르지 않습니다.",
      });
    }
  } catch (error) {
    if (error instanceof TRPCError) throw error;
    throw new TRPCError({
      code: "BAD_GATEWAY",
      message: "FaithPlus 신앙 데이터 서버에 연결하지 못했습니다.",
    });
  } finally {
    clearTimeout(timeout);
  }
}
