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
  faithHistory: Array<{ date: string; type: string; description: string }>;
  recentActivities: Array<{
    date: string;
    type: string;
    description: string;
    points: number;
  }>;
  bibleProgress: { booksRead: number; chaptersRead: number };
  evangelism: { contactCount: number };
  garden: { currentStage: number; totalActivityPoints: number; totalFruits: number };
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

function normalizeHistory(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!isRecord(item)) return [];
    return [{
      date: pickText(item, ["date", "activityDate", "activity_date", "createdAt", "created_at"]) ?? "",
      type: pickText(item, ["type", "activityType", "activity_type"]) ?? "",
      description: pickText(item, ["description", "memo", "content", "title"]) ?? "",
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
