import "dotenv/config";

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import mysql, {
  type PoolConnection,
  type ResultSetHeader,
  type RowDataPacket,
} from "mysql2/promise";

export type RunMode = "dry-run" | "apply";
export type LegacyArchiveKey =
  | "hebron"
  | "friday"
  | "hayoungin"
  | "testimony"
  | "praise-shalom"
  | "praise-hosanna"
  | "praise-zion"
  | "praise-joyance"
  | "praise-disciples"
  | "praise-charis"
  | "praise-rebuild"
  | "praise-special";

export type LegacyListRow = Readonly<{
  date: string;
  num: string;
  title: string;
  scripture: string;
  preacher: string;
}>;

export type LegacyVideo = Readonly<{
  pageCode: string;
  vodType: string;
  num: string;
  videoUrl: string;
  title: string;
  preacher: string;
  scripture: string;
  sermonDate: string;
}>;

interface YoutubeVideoRow extends RowDataPacket {
  id: number;
  playlistId: number;
  videoId: string | null;
  videoUrl: string | null;
  title: string;
  preacher: string | null;
  scripture: string | null;
  sermonDate: string | null;
  thumbnailUrl: string | null;
  description: string | null;
  sortOrder: number;
  isVisible: number | boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
}

interface NamedLockRow extends RowDataPacket {
  locked: number | null;
}

interface CountRow extends RowDataPacket {
  count: number;
}

interface CompletedImportInvariantRow extends RowDataPacket {
  count: number;
  uniqueUrlCount: number;
  minDate: string | null;
  maxDate: string | null;
  invalidTitleCount: number;
}

interface MigrationRow extends RowDataPacket {
  id: string;
}

interface TableEngineRow extends RowDataPacket {
  ENGINE: string | null;
}

export type ExcludedLegacySource = Readonly<{
  date: string;
  title: string;
}>;

export type LegacyArchiveConfig = Readonly<{
  key: LegacyArchiveKey;
  label: string;
  pageCode: string;
  vodType: string;
  playlistId: number;
  expectedListCount: number;
  expectedVideoCount: number;
  newestDate: string;
  oldestDate: string;
  expectedVideoNewestDate?: string;
  expectedVideoOldestDate?: string;
  migrationId: string;
  namedLock: string;
  sourceConcurrency: number;
  fastVerification: "exact-range" | "minimum-range";
  allowedMp4Url: RegExp;
  fastUrlLikePatterns: readonly string[];
  requiredSourceNums: readonly string[];
  excludedSources: Readonly<Record<string, ExcludedLegacySource>>;
  videoUrlOverrides: Readonly<Record<string, Readonly<{
    expectedOriginal: string;
    replacement: string;
  }>>>;
}>;

const JOYCH_MP4_URL = /^https?:\/\/sermon\.joych\.org\/mp4\/[^?#]+\.mp4$/i;
const JOYCH_FAST_URL_PATTERNS = [
  "http://sermon.joych.org/mp4/%.mp4",
  "https://sermon.joych.org/mp4/%.mp4",
] as const;
const HAYOUNGIN_MP4_URL = /^https?:\/\/sermon\.joych\.org\/mp4\/special\/[^?#]+\.mp4$/i;
const HAYOUNGIN_FAST_URL_PATTERNS = [
  "http://sermon.joych.org/mp4/special/%.mp4",
  "https://sermon.joych.org/mp4/special/%.mp4",
] as const;
const TESTIMONY_MP4_URL = /^https?:\/\/sermon\.joych\.org\/mp4\/(?:special|etc)\/[^?#]+\.mp4$/i;
const TESTIMONY_FAST_URL_PATTERNS = [
  "http://sermon.joych.org/mp4/special/%.mp4",
  "https://sermon.joych.org/mp4/special/%.mp4",
  "http://sermon.joych.org/mp4/etc/%.mp4",
  "https://sermon.joych.org/mp4/etc/%.mp4",
] as const;

export const PRAISE_ARCHIVE_KEYS = [
  "praise-shalom",
  "praise-hosanna",
  "praise-zion",
  "praise-joyance",
  "praise-disciples",
  "praise-charis",
  "praise-rebuild",
  "praise-special",
] as const satisfies readonly LegacyArchiveKey[];

export const LEGACY_ARCHIVE_CONFIGS: Record<LegacyArchiveKey, LegacyArchiveConfig> = {
  hebron: {
    key: "hebron",
    label: "Hebron Wednesday-worship",
    pageCode: "423",
    vodType: "237",
    playlistId: 90001,
    expectedListCount: 263,
    expectedVideoCount: 263,
    newestDate: "2026-07-15",
    oldestDate: "2021-02-17",
    migrationId: "0093_import_legacy_hebron_videos_20210217_20260715",
    namedLock: "joych:import-legacy-hebron-videos:90001",
    sourceConcurrency: 5,
    fastVerification: "exact-range",
    allowedMp4Url: /^https?:\/\/sermon\.joych\.org\/mp4\/wed\/[^?#]+\.mp4$/i,
    fastUrlLikePatterns: [
      "http://sermon.joych.org/mp4/wed/%.mp4",
      "https://sermon.joych.org/mp4/wed/%.mp4",
    ],
    requiredSourceNums: [],
    excludedSources: {},
    videoUrlOverrides: {},
  },
  friday: {
    key: "friday",
    label: "Shekinah Friday-prayer",
    pageCode: "424",
    vodType: "238",
    playlistId: 90002,
    expectedListCount: 245,
    expectedVideoCount: 245,
    newestDate: "2026-07-10",
    oldestDate: "2021-04-02",
    migrationId: "0094_import_legacy_friday_videos_20210402_20260710",
    namedLock: "joych:import-legacy-friday-videos:90002",
    sourceConcurrency: 5,
    fastVerification: "exact-range",
    allowedMp4Url: /^https?:\/\/sermon\.joych\.org\/mp4\/(?:friday_night\/[^?#]+|special\/251205_2)\.mp4$/i,
    fastUrlLikePatterns: [
      "http://sermon.joych.org/mp4/friday_night/%.mp4",
      "https://sermon.joych.org/mp4/friday_night/%.mp4",
      "http://sermon.joych.org/mp4/special/251205_2.mp4",
      "https://sermon.joych.org/mp4/special/251205_2.mp4",
    ],
    requiredSourceNums: ["12579", "8902"],
    excludedSources: {},
    videoUrlOverrides: {
      // The legacy XML for 2022-06-17 incorrectly repeats the 2022-06-10 URL.
      // The correctly dated source file exists and has been verified as video/mp4.
      "9529": {
        expectedOriginal: "http://sermon.joych.org/mp4/friday_night/220610_fri.mp4",
        replacement: "http://sermon.joych.org/mp4/friday_night/220617_fri.mp4",
      },
    },
  },
  hayoungin: {
    key: "hayoungin",
    label: "HaYoungIn dawn-prayer sermons",
    pageCode: "242",
    vodType: "40",
    playlistId: 90003,
    expectedListCount: 111,
    expectedVideoCount: 111,
    newestDate: "2026-04-25",
    oldestDate: "2018-05-14",
    migrationId: "0103_import_legacy_hayoungin_videos_20180514_20260425",
    namedLock: "joych:import-legacy-hayoungin-videos:90003",
    sourceConcurrency: 5,
    fastVerification: "minimum-range",
    allowedMp4Url: HAYOUNGIN_MP4_URL,
    fastUrlLikePatterns: HAYOUNGIN_FAST_URL_PATTERNS,
    requiredSourceNums: ["12423", "6854"],
    excludedSources: {},
    videoUrlOverrides: {},
  },
  testimony: {
    key: "testimony",
    label: "Testimony videos",
    pageCode: "359",
    vodType: "69",
    playlistId: 90004,
    expectedListCount: 210,
    expectedVideoCount: 204,
    newestDate: "2026-06-26",
    oldestDate: "2018-05-06",
    expectedVideoNewestDate: "2026-06-26",
    expectedVideoOldestDate: "2018-07-20",
    migrationId: "0104_import_legacy_testimony_videos_20180506_20260626",
    namedLock: "joych:import-legacy-testimony-videos:90004",
    sourceConcurrency: 5,
    fastVerification: "minimum-range",
    allowedMp4Url: TESTIMONY_MP4_URL,
    fastUrlLikePatterns: TESTIMONY_FAST_URL_PATTERNS,
    requiredSourceNums: ["12552", "6837"],
    excludedSources: {
      "7462": {
        date: "2019-01-02",
        title: "수요예배 - 이스라엘 & 요르단 비전트립 간증",
      },
      "7461": {
        date: "2019-01-02",
        title: "수요예배 - 이스라엘 & 요르단 비전트립 간증",
      },
      "7305": {
        date: "2018-11-02",
        title: "금요아둘람 기도회",
      },
      "7001": {
        date: "2018-07-08",
        title: "주일 2부 간증",
      },
      "6957": {
        date: "2018-06-20",
        title: "호국보훈의 달 수요 특별집회 간증",
      },
      "6837": {
        date: "2018-05-06",
        title: "주일 2부 간증",
      },
    },
    videoUrlOverrides: {},
  },
  "praise-shalom": {
    key: "praise-shalom",
    label: "Sunday first-service Shalom choir",
    pageCode: "192",
    vodType: "19",
    playlistId: 90007,
    expectedListCount: 547,
    expectedVideoCount: 546,
    newestDate: "2026-07-12",
    oldestDate: "2014-01-05",
    migrationId: "0095_import_legacy_praise_shalom_20140105_20260712",
    namedLock: "joych:import-legacy-praise-shalom:90007",
    sourceConcurrency: 5,
    fastVerification: "minimum-range",
    allowedMp4Url: JOYCH_MP4_URL,
    fastUrlLikePatterns: JOYCH_FAST_URL_PATTERNS,
    requiredSourceNums: ["12584", "3229"],
    excludedSources: {
      "5622": {
        date: "2017-01-01",
        title: "시스템 문제로 2017년 1월 1일 영상은 제공되지 않습니다. 양해바랍니다.",
      },
    },
    videoUrlOverrides: {
      "3861": {
        expectedOriginal: "http://sermon.joych.org/mp4/hymn/141123_hymn1.mp4",
        replacement: "http://sermon.joych.org/mp4/hymn/141130_hymn1.mp4",
      },
    },
  },
  "praise-hosanna": {
    key: "praise-hosanna",
    label: "Sunday second-service Hosanna choir",
    pageCode: "193",
    vodType: "32",
    playlistId: 90008,
    expectedListCount: 565,
    expectedVideoCount: 564,
    newestDate: "2026-07-12",
    oldestDate: "2014-01-19",
    migrationId: "0096_import_legacy_praise_hosanna_20140119_20260712",
    namedLock: "joych:import-legacy-praise-hosanna:90008",
    sourceConcurrency: 5,
    fastVerification: "minimum-range",
    allowedMp4Url: JOYCH_MP4_URL,
    fastUrlLikePatterns: JOYCH_FAST_URL_PATTERNS,
    requiredSourceNums: ["12585", "3253"],
    excludedSources: {
      "5038": {
        date: "2016-05-08",
        title: "시스템 문제로 2016년 5월 8일 찬양 영상은 제공되지 않습니다. 양해부탁드립니다.",
      },
    },
    videoUrlOverrides: {},
  },
  "praise-zion": {
    key: "praise-zion",
    label: "Sunday third-service Zion choir",
    pageCode: "194",
    vodType: "33",
    playlistId: 90009,
    expectedListCount: 563,
    expectedVideoCount: 563,
    newestDate: "2026-07-12",
    oldestDate: "2014-01-19",
    migrationId: "0097_import_legacy_praise_zion_20140119_20260712",
    namedLock: "joych:import-legacy-praise-zion:90009",
    sourceConcurrency: 5,
    fastVerification: "minimum-range",
    allowedMp4Url: JOYCH_MP4_URL,
    fastUrlLikePatterns: JOYCH_FAST_URL_PATTERNS,
    requiredSourceNums: ["12586", "3254"],
    excludedSources: {},
    videoUrlOverrides: {},
  },
  "praise-joyance": {
    key: "praise-joyance",
    label: "Sunday Joyance praise team",
    pageCode: "181",
    vodType: "13",
    playlistId: 90010,
    expectedListCount: 668,
    expectedVideoCount: 666,
    newestDate: "2026-07-12",
    oldestDate: "2014-01-05",
    migrationId: "0098_import_legacy_praise_joyance_20140105_20260712",
    namedLock: "joych:import-legacy-praise-joyance:90010",
    sourceConcurrency: 5,
    fastVerification: "minimum-range",
    allowedMp4Url: JOYCH_MP4_URL,
    fastUrlLikePatterns: JOYCH_FAST_URL_PATTERNS,
    requiredSourceNums: ["12583", "3232"],
    excludedSources: {
      "3963": {
        date: "2015-01-25",
        title: "시스템 점검으로 이번주 찬양은 제공되지 않습니다. 양해부탁드립니다.",
      },
      "3522": {
        date: "2014-05-18",
        title: "시스템 점검으로 이번주 찬양은 제공되지 않습니다. 양해부탁드립니다",
      },
    },
    videoUrlOverrides: {
      "8918": {
        expectedOriginal: "http://sermon.joych.org/mp4/praise/210418_praise2.mp4",
        replacement: "http://sermon.joych.org/mp4/praise/210425_praise2.mp4",
      },
    },
  },
  "praise-disciples": {
    key: "praise-disciples",
    label: "Wednesday Disciples praise team",
    pageCode: "319",
    vodType: "55",
    playlistId: 90011,
    expectedListCount: 505,
    expectedVideoCount: 505,
    newestDate: "2026-07-15",
    oldestDate: "2016-05-04",
    migrationId: "0099_import_legacy_praise_disciples_20160504_20260715",
    namedLock: "joych:import-legacy-praise-disciples:90011",
    sourceConcurrency: 5,
    fastVerification: "minimum-range",
    allowedMp4Url: JOYCH_MP4_URL,
    fastUrlLikePatterns: JOYCH_FAST_URL_PATTERNS,
    requiredSourceNums: ["12591", "5033"],
    excludedSources: {},
    videoUrlOverrides: {
      "11716": {
        expectedOriginal: "http://sermon.joych.org/mp4/praise/250528_praise.mp4",
        replacement: "http://sermon.joych.org/mp4/praise/250604_praise.mp4",
      },
    },
  },
  "praise-charis": {
    key: "praise-charis",
    label: "Friday Charis praise team",
    pageCode: "320",
    vodType: "56",
    playlistId: 90015,
    expectedListCount: 407,
    expectedVideoCount: 407,
    newestDate: "2026-07-03",
    oldestDate: "2016-05-06",
    migrationId: "0100_import_legacy_praise_charis_20160506_20260703",
    namedLock: "joych:import-legacy-praise-charis:90015",
    sourceConcurrency: 5,
    fastVerification: "minimum-range",
    allowedMp4Url: JOYCH_MP4_URL,
    fastUrlLikePatterns: JOYCH_FAST_URL_PATTERNS,
    requiredSourceNums: ["12567", "5035"],
    excludedSources: {},
    videoUrlOverrides: {},
  },
  "praise-rebuild": {
    key: "praise-rebuild",
    label: "Youth Rebuild praise team",
    pageCode: "183",
    vodType: "9",
    playlistId: 90016,
    expectedListCount: 584,
    expectedVideoCount: 580,
    newestDate: "2026-07-12",
    oldestDate: "2014-01-19",
    migrationId: "0101_import_legacy_praise_rebuild_20140119_20260712",
    namedLock: "joych:import-legacy-praise-rebuild:90016",
    sourceConcurrency: 5,
    fastVerification: "minimum-range",
    allowedMp4Url: JOYCH_MP4_URL,
    fastUrlLikePatterns: JOYCH_FAST_URL_PATTERNS,
    requiredSourceNums: ["12588", "3264"],
    excludedSources: {
      "5159": {
        date: "2016-06-26",
        title: "시스템 문제로 2016년 6월 26일 찬양 영상은 제공되지 않습니다. 양해부탁드립니다.",
      },
      "4575": {
        date: "2015-10-25",
        title: "내부 시스템 문제로 이번주 찬양 영상은 제공되지 않습니다. 양해부탁드립니다.",
      },
      "3596": {
        date: "2014-06-22",
        title: "이번주 찬양 영상은 제공되지 않습니다. 양해부탁드립니다.",
      },
      "3523": {
        date: "2014-05-18",
        title: "시스템 점검으로 이번주 찬양은 제공되지 않습니다. 양해부탁드립니다",
      },
    },
    videoUrlOverrides: {},
  },
  "praise-special": {
    key: "praise-special",
    label: "Special worship music",
    pageCode: "197",
    vodType: "20",
    playlistId: 90017,
    expectedListCount: 1297,
    expectedVideoCount: 1296,
    newestDate: "2026-07-12",
    oldestDate: "2014-01-05",
    migrationId: "0102_import_legacy_praise_special_20140105_20260712",
    namedLock: "joych:import-legacy-praise-special:90017",
    sourceConcurrency: 5,
    fastVerification: "minimum-range",
    allowedMp4Url: JOYCH_MP4_URL,
    fastUrlLikePatterns: JOYCH_FAST_URL_PATTERNS,
    requiredSourceNums: ["12589", "12582", "3250"],
    excludedSources: {
      "3966": {
        date: "2015-01-18",
        title: "3부 특송 - 내부사정으로 영상이 제공되지 않습니다. 양해부탁드립니다.",
      },
    },
    videoUrlOverrides: {},
  },
};

export function getPraiseArchiveCatalogSummary(
  configs: Readonly<Record<LegacyArchiveKey, LegacyArchiveConfig>> = LEGACY_ARCHIVE_CONFIGS,
) {
  const praiseConfigs = PRAISE_ARCHIVE_KEYS.map(key => configs[key]);
  return {
    archiveCount: praiseConfigs.length,
    expectedListCount: praiseConfigs.reduce((sum, config) => sum + config.expectedListCount, 0),
    expectedVideoCount: praiseConfigs.reduce((sum, config) => sum + config.expectedVideoCount, 0),
    excludedSourceCount: praiseConfigs.reduce(
      (sum, config) => sum + Object.keys(config.excludedSources).length,
      0,
    ),
    uniquePlaylistCount: new Set(praiseConfigs.map(config => config.playlistId)).size,
    uniqueLegacySourceCount: new Set(
      praiseConfigs.map(config => `${config.pageCode}:${config.vodType}`),
    ).size,
  };
}

function assertPraiseArchiveCatalog() {
  const summary = getPraiseArchiveCatalogSummary();
  if (
    summary.archiveCount !== 8
    || summary.expectedListCount !== 5_136
    || summary.expectedVideoCount !== 5_127
    || summary.excludedSourceCount !== 9
    || summary.uniquePlaylistCount !== 8
    || summary.uniqueLegacySourceCount !== 8
  ) {
    throw new Error(`Legacy praise archive catalog invariant failed: ${JSON.stringify(summary)}`);
  }
}

const ARCHIVE_ALIASES: Readonly<Record<string, LegacyArchiveKey>> = {
  shalom: "praise-shalom",
  hosanna: "praise-hosanna",
  zion: "praise-zion",
  joyance: "praise-joyance",
  disciples: "praise-disciples",
  charis: "praise-charis",
  rebuild: "praise-rebuild",
  special: "praise-special",
};

export function parseArchiveKey(args: readonly string[]): LegacyArchiveKey {
  const archiveArguments = args.filter(argument => argument.startsWith("--archive="));
  if (archiveArguments.length > 1) {
    throw new Error("Choose only one --archive=<key> option.");
  }

  const requested = archiveArguments[0]?.slice("--archive=".length).trim();
  if (archiveArguments.length === 1 && !requested) {
    throw new Error("--archive requires a non-empty key.");
  }
  const archiveKey = requested
    ? ARCHIVE_ALIASES[requested] ?? requested
    : args.includes("--friday") ? "friday" : "hebron";
  if (!(archiveKey in LEGACY_ARCHIVE_CONFIGS)) {
    throw new Error(`Unknown legacy archive: ${requested || archiveKey}`);
  }
  if (args.includes("--friday") && archiveKey !== "friday") {
    throw new Error("--friday cannot be combined with a different --archive option.");
  }
  return archiveKey as LegacyArchiveKey;
}

assertPraiseArchiveCatalog();

const CLI_ARGS = process.argv.slice(2);
const ARCHIVE_KEY = parseArchiveKey(CLI_ARGS);
const ARCHIVE = LEGACY_ARCHIVE_CONFIGS[ARCHIVE_KEY];
const PAGE_CODE = ARCHIVE.pageCode;
const VOD_TYPE = ARCHIVE.vodType;
const PLAYLIST_ID = ARCHIVE.playlistId;
const EXPECTED_LIST_COUNT = ARCHIVE.expectedListCount;
const EXPECTED_VIDEO_COUNT = ARCHIVE.expectedVideoCount;
const NEWEST_DATE = ARCHIVE.newestDate;
const OLDEST_DATE = ARCHIVE.oldestDate;
const EXPECTED_VIDEO_NEWEST_DATE = ARCHIVE.expectedVideoNewestDate ?? NEWEST_DATE;
const EXPECTED_VIDEO_OLDEST_DATE = ARCHIVE.expectedVideoOldestDate ?? OLDEST_DATE;
const MAX_LIST_PAGES = 100;
const SOURCE_CONCURRENCY = ARCHIVE.sourceConcurrency;
const REQUEST_TIMEOUT_MS = 20_000;
const REQUEST_ATTEMPTS = 5;
// The media origin rate-limits thousands of consecutive HEAD requests. Apply mode
// validates authoritative XML for every row and probes a spread of real files;
// dry-run mode still performs the exhaustive MP4 check.
const APPLY_MP4_SAMPLE_SIZE = 24;
const LIST_BASE_URL = "http://joych.anyline.kr/main/sub.html";
const VOD_INFO_URL = "http://admin.joych.org/core/xml/vod/vodInfo.xml.html";
const VOD_REFERER_BASE = "http://admin.joych.org/core/module/vod/skin_001/vodIframe.html";
const MIGRATION_ID = ARCHIVE.migrationId;
const NAMED_LOCK = ARCHIVE.namedLock;
const DEFAULT_BACKUP_DIR = resolve("backups");
const ALLOWED_MP4_URL = ARCHIVE.allowedMp4Url;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function parseMode(args: readonly string[]): RunMode | "help" {
  const allowed = new Set(["--apply", "--dry-run", "--friday", "--help", "-h"]);
  const unknown = args.filter(argument =>
    !allowed.has(argument) && !argument.startsWith("--archive=")
  );
  if (unknown.length > 0) {
    throw new Error(`Unknown option(s): ${unknown.join(", ")}`);
  }
  if (args.includes("--help") || args.includes("-h")) return "help";
  if (args.includes("--apply") && args.includes("--dry-run")) {
    throw new Error("Choose either --apply or --dry-run, not both.");
  }
  return args.includes("--apply") ? "apply" : "dry-run";
}

function printHelp() {
  console.log(`Usage: npm run import:legacy-hebron -- [--archive=<key> | --friday] [--dry-run | --apply]

Collects and validates the fixed legacy ${ARCHIVE.label} archive:
  pageCode=${PAGE_CODE}, vodType=${VOD_TYPE}, ${NEWEST_DATE} through ${OLDEST_DATE}
  ${EXPECTED_LIST_COUNT} source rows, ${EXPECTED_VIDEO_COUNT} actual videos

The default is a read-only dry run. --apply requires DATABASE_URL, writes a
JSON backup first, and inserts only missing URLs into playlist ${PLAYLIST_ID}.
Existing youtube_videos rows are never updated or deleted.

Archive keys: ${Object.keys(LEGACY_ARCHIVE_CONFIGS).join(", ")}`);
}

function sleep(milliseconds: number) {
  return new Promise(resolvePromise => setTimeout(resolvePromise, milliseconds));
}

async function fetchWithRetry(
  url: string,
  init: RequestInit,
  description: string,
) {
  let lastError: unknown;
  for (let attempt = 1; attempt <= REQUEST_ATTEMPTS; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(url, { ...init, signal: controller.signal });
      if (!response.ok) {
        throw new Error(`${description} returned HTTP ${response.status}`);
      }
      return response;
    } catch (error) {
      lastError = error;
      if (attempt < REQUEST_ATTEMPTS) await sleep(250 * 2 ** (attempt - 1));
    } finally {
      clearTimeout(timeout);
    }
  }
  throw new Error(`${description} failed after ${REQUEST_ATTEMPTS} attempts`, {
    cause: lastError,
  });
}

export function decodeLegacyHtml(value: string) {
  return value
    .replace(/<br\s*\/?\s*>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_match, digits: string) => String.fromCodePoint(Number(digits)))
    .replace(/&#x([0-9a-f]+);/gi, (_match, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/\s+/g, " ")
    .trim();
}

function decodeXml(value: string) {
  return value
    .replace(/^\s*<!\[CDATA\[/, "")
    .replace(/\]\]>\s*$/, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;|&apos;/g, "'")
    .trim();
}

function getXmlTag(xml: string, tag: string) {
  const match = new RegExp(`<${tag}>\\s*([\\s\\S]*?)\\s*</${tag}>`, "i").exec(xml);
  return match ? decodeXml(match[1] ?? "") : "";
}

export function parseLegacyListRows(html: string) {
  const rows: LegacyListRow[] = [];
  const rowPattern = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch: RegExpExecArray | null;
  while ((rowMatch = rowPattern.exec(html))) {
    const cells = [...rowMatch[1]!.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)]
      .map(match => match[1] ?? "");
    const linkCellIndex = cells.findIndex(cell =>
      /<a\b[^>]*[?&](?:amp;)?num=\d+[^>]*>/i.test(cell)
    );
    if (linkCellIndex < 0) continue;

    const linkMatch = /<a\b[^>]*[?&](?:amp;)?num=(\d+)[^>]*>([\s\S]*?)<\/a>/i
      .exec(cells[linkCellIndex]!);
    const date = cells
      .map(cell => decodeLegacyHtml(cell))
      .find(value => DATE_PATTERN.test(value));
    if (!linkMatch || !date) continue;

    rows.push({
      date,
      num: linkMatch[1]!,
      title: decodeLegacyHtml(linkMatch[2]!),
      scripture: decodeLegacyHtml(cells[linkCellIndex + 1] ?? ""),
      preacher: decodeLegacyHtml(cells[linkCellIndex + 2] ?? ""),
    });
  }
  return rows;
}

export function excludeVerifiedLegacySources(
  rows: readonly LegacyListRow[],
  excludedSources: Readonly<Record<string, ExcludedLegacySource>>,
) {
  const found = new Set<string>();
  const included: LegacyListRow[] = [];

  for (const row of rows) {
    const excluded = excludedSources[row.num];
    if (!excluded) {
      included.push(row);
      continue;
    }
    if (row.date !== excluded.date || row.title !== excluded.title) {
      throw new Error(
        `Excluded legacy source ${row.num} changed: expected ${excluded.date} / ${excluded.title}, `
        + `received ${row.date} / ${row.title}.`,
      );
    }
    found.add(row.num);
  }

  const missing = Object.keys(excludedSources).filter(num => !found.has(num));
  if (missing.length > 0) {
    throw new Error(`Expected excluded legacy sources are missing: ${missing.join(", ")}`);
  }
  return included;
}

export function selectArchiveListRows(
  rows: readonly LegacyListRow[],
  config: LegacyArchiveConfig,
) {
  const duplicateNums = findDuplicates(rows.map(row => row.num));
  if (duplicateNums.length > 0) {
    throw new Error(`Legacy list has duplicate video numbers: ${duplicateNums.join(", ")}`);
  }

  const selected = rows.filter(
    row => row.date >= config.oldestDate && row.date <= config.newestDate,
  );
  if (selected.length !== config.expectedListCount) {
    throw new Error(
      `Expected ${config.expectedListCount} source rows in the fixed date range, found ${selected.length}.`,
    );
  }
  for (const requiredNum of config.requiredSourceNums) {
    if (!selected.some(row => row.num === requiredNum)) {
      throw new Error(`Required legacy source number ${requiredNum} is missing from the fixed range.`);
    }
  }

  const importable = excludeVerifiedLegacySources(selected, config.excludedSources);
  if (importable.length !== config.expectedVideoCount) {
    throw new Error(
      `Expected ${config.expectedVideoCount} actual videos after exclusions, found ${importable.length}.`,
    );
  }
  return importable;
}

async function collectLegacyList() {
  const rows: LegacyListRow[] = [];
  const seenPageSignatures = new Set<string>();
  let reachedEmptyPage = false;

  for (let page = 1; page <= MAX_LIST_PAGES; page += 1) {
    const url = new URL(LIST_BASE_URL);
    url.searchParams.set("pageCode", PAGE_CODE);
    if (page > 1) url.searchParams.set("page", String(page));

    const response = await fetchWithRetry(
      url.toString(),
      { headers: { "User-Agent": "Mozilla/5.0" } },
      `legacy list page ${page}`,
    );
    const pageRows = parseLegacyListRows(await response.text());
    if (pageRows.length === 0) {
      reachedEmptyPage = true;
      break;
    }

    const signature = pageRows.map(row => row.num).join(",");
    if (seenPageSignatures.has(signature)) {
      throw new Error(`Legacy list pagination repeated at page ${page}.`);
    }
    seenPageSignatures.add(signature);
    rows.push(...pageRows);
  }

  if (!reachedEmptyPage) {
    throw new Error(`Legacy list did not end within ${MAX_LIST_PAGES} pages.`);
  }

  return selectArchiveListRows(rows, ARCHIVE);
}

async function mapConcurrent<T, R>(
  items: readonly T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>,
) {
  const results = new Array<R>(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      results[index] = await mapper(items[index]!, index);
    }
  });
  await Promise.all(workers);
  return results;
}

async function fetchLegacyVideo(row: LegacyListRow): Promise<LegacyVideo> {
  const body = new URLSearchParams({
    pageCode: PAGE_CODE,
    num: row.num,
    vodType: VOD_TYPE,
  });
  const response = await fetchWithRetry(
    VOD_INFO_URL,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Referer: `${VOD_REFERER_BASE}?pageCode=${PAGE_CODE}&num=${row.num}&vodType=${VOD_TYPE}`,
        "User-Agent": "Mozilla/5.0",
      },
      body,
    },
    `legacy metadata ${PAGE_CODE}:${row.num}:${VOD_TYPE}`,
  );
  const xml = await response.text();
  if (getXmlTag(xml, "code") !== "vodInfo") {
    throw new Error(`Legacy metadata ${row.num} did not return code=vodInfo.`);
  }

  const returnedNum = getXmlTag(xml, "num");
  if (returnedNum && returnedNum !== row.num) {
    throw new Error(`Legacy metadata number mismatch: requested ${row.num}, received ${returnedNum}.`);
  }

  const xmlVideoUrl = getXmlTag(xml, "vodFile");
  const videoUrlOverride = ARCHIVE.videoUrlOverrides[row.num];
  if (videoUrlOverride) {
    let canonicalXmlUrl: string;
    try {
      canonicalXmlUrl = canonicalVideoUrl(xmlVideoUrl);
    } catch {
      throw new Error(`Legacy metadata ${row.num} returned an invalid MP4 URL before override.`);
    }
    const expectedUrls = [videoUrlOverride.expectedOriginal, videoUrlOverride.replacement]
      .map(canonicalVideoUrl);
    if (!expectedUrls.includes(canonicalXmlUrl)) {
      throw new Error(
        `Legacy metadata ${row.num} changed unexpectedly; refusing the configured URL override.`,
      );
    }
  }

  const video: LegacyVideo = {
    pageCode: PAGE_CODE,
    vodType: VOD_TYPE,
    num: row.num,
    videoUrl: videoUrlOverride?.replacement || xmlVideoUrl,
    title: getXmlTag(xml, "subject"),
    preacher: getXmlTag(xml, "preacher"),
    scripture: getXmlTag(xml, "word"),
    sermonDate: getXmlTag(xml, "date"),
  };

  if (!video.title || !DATE_PATTERN.test(video.sermonDate)) {
    throw new Error(`Legacy metadata ${row.num} is missing a title or valid date.`);
  }
  if (video.sermonDate !== row.date) {
    throw new Error(
      `Legacy metadata ${row.num} date mismatch: list=${row.date}, XML=${video.sermonDate}.`,
    );
  }
  if (!ALLOWED_MP4_URL.test(video.videoUrl)) {
    throw new Error(`Legacy metadata ${row.num} returned a disallowed MP4 URL.`);
  }
  if (video.sermonDate < OLDEST_DATE || video.sermonDate > NEWEST_DATE) {
    throw new Error(`Legacy metadata ${row.num} date ${video.sermonDate} is outside the fixed range.`);
  }
  return video;
}

async function verifyMp4(video: LegacyVideo) {
  const response = await fetchWithRetry(
    video.videoUrl,
    {
      method: "HEAD",
      headers: {
        Referer: "http://www.joych.org/",
        "User-Agent": "Mozilla/5.0",
      },
    },
    `MP4 HEAD ${video.num}`,
  );
  const contentType = (response.headers.get("content-type") ?? "")
    .split(";", 1)[0]
    .trim()
    .toLowerCase();
  if (contentType !== "video/mp4") {
    throw new Error(`MP4 ${video.num} returned Content-Type ${contentType || "(missing)"}.`);
  }
}

export function canonicalVideoUrl(rawUrl: string) {
  const url = new URL(rawUrl);
  return `${url.hostname.toLowerCase()}${url.pathname}`;
}

export function findDuplicates(values: readonly string[]) {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return [...duplicates];
}

export function selectEvenlySpacedVerificationSample<T extends { num: string }>(
  items: readonly T[],
  maximumBaseSize: number,
  requiredNums: readonly string[] = [],
) {
  if (items.length <= maximumBaseSize) return [...items];

  const selectedNums = new Set(requiredNums);
  if (maximumBaseSize > 0) {
    const denominator = Math.max(1, maximumBaseSize - 1);
    for (let index = 0; index < maximumBaseSize; index += 1) {
      const sourceIndex = Math.round(index * (items.length - 1) / denominator);
      selectedNums.add(items[sourceIndex]!.num);
    }
  }
  return items.filter(item => selectedNums.has(item.num));
}

export function validateArchiveVideos(
  videos: readonly LegacyVideo[],
  config: LegacyArchiveConfig,
) {
  if (videos.length !== config.expectedVideoCount) {
    throw new Error(
      `Expected ${config.expectedVideoCount} validated videos, found ${videos.length}.`,
    );
  }

  const dates = videos.map(video => video.sermonDate).sort();
  const expectedOldestDate = config.expectedVideoOldestDate ?? config.oldestDate;
  const expectedNewestDate = config.expectedVideoNewestDate ?? config.newestDate;
  if (dates[0] !== expectedOldestDate || dates.at(-1) !== expectedNewestDate) {
    throw new Error(
      `Archive boundary mismatch: ${dates[0] ?? "none"} through ${dates.at(-1) ?? "none"}.`,
    );
  }

  const duplicateSources = findDuplicates(
    videos.map(video => `${video.pageCode}:${video.num}:${video.vodType}`),
  );
  if (duplicateSources.length > 0) {
    throw new Error(`Duplicate legacy source references: ${duplicateSources.join(", ")}`);
  }

  const duplicateUrls = findDuplicates(videos.map(video => canonicalVideoUrl(video.videoUrl)));
  if (duplicateUrls.length > 0) {
    throw new Error(`Duplicate legacy MP4 URLs: ${duplicateUrls.join(", ")}`);
  }
}

async function collectAndValidateArchive(verifyAllMp4Files: boolean) {
  console.log(`Collecting the legacy ${ARCHIVE.label} list...`);
  const listRows = await collectLegacyList();
  console.log(`Validated ${listRows.length} list rows. Loading authoritative XML metadata...`);
  const videos = await mapConcurrent(listRows, SOURCE_CONCURRENCY, fetchLegacyVideo);
  validateArchiveVideos(videos, ARCHIVE);
  if (verifyAllMp4Files) {
    console.log(`Validating all ${videos.length} MP4 files with HEAD requests...`);
    await mapConcurrent(videos, SOURCE_CONCURRENCY, verifyMp4);
  }
  console.log(
    `Source metadata validation passed: ${videos.length} unique videos, `
    + `${EXPECTED_VIDEO_NEWEST_DATE} through ${EXPECTED_VIDEO_OLDEST_DATE}.`,
  );
  return [...videos].sort((left, right) =>
    right.sermonDate.localeCompare(left.sermonDate) || Number(right.num) - Number(left.num)
  );
}

const YOUTUBE_VIDEO_COLUMNS = `
  id, playlistId, videoId, videoUrl, title, preacher, scripture, sermonDate,
  thumbnailUrl, description, sortOrder, isVisible, createdAt, updatedAt
`;

async function loadPlaylistRows(connection: PoolConnection, forUpdate: boolean) {
  const [rows] = await connection.query<YoutubeVideoRow[]>(
    `SELECT ${YOUTUBE_VIDEO_COLUMNS}
     FROM youtube_videos
     WHERE playlistId = ?
     ORDER BY sermonDate DESC, id DESC${forUpdate ? " FOR UPDATE" : ""}`,
    [PLAYLIST_ID],
  );
  return rows;
}

function analyzeExistingRows(
  videos: readonly LegacyVideo[],
  existingRows: readonly YoutubeVideoRow[],
) {
  const canonicalExisting = new Map<string, YoutubeVideoRow[]>();
  for (const row of existingRows) {
    if (!row.videoUrl) continue;
    let canonical: string;
    try {
      canonical = canonicalVideoUrl(row.videoUrl);
    } catch {
      continue;
    }
    const matching = canonicalExisting.get(canonical) ?? [];
    matching.push(row);
    canonicalExisting.set(canonical, matching);
  }

  const sourceUrls = new Set(videos.map(video => canonicalVideoUrl(video.videoUrl)));
  const duplicateExistingSourceUrls = [...canonicalExisting.entries()]
    .filter(([url, rows]) => sourceUrls.has(url) && rows.length > 1)
    .map(([url]) => url);
  if (duplicateExistingSourceUrls.length > 0) {
    throw new Error(
      `Playlist ${PLAYLIST_ID} already contains duplicate source URLs: ${duplicateExistingSourceUrls.join(", ")}`,
    );
  }

  return {
    matched: videos.filter(video => canonicalExisting.has(canonicalVideoUrl(video.videoUrl))),
    missing: videos.filter(video => !canonicalExisting.has(canonicalVideoUrl(video.videoUrl))),
  };
}

export function oldestFirstInsertOrder(videos: readonly LegacyVideo[]) {
  // The public list uses sermonDate DESC, id DESC. Inserting oldest first keeps
  // the source order stable when an archive contains multiple videos on one day.
  return [...videos].reverse();
}

async function writePlaylistBackup(rows: readonly YoutubeVideoRow[]) {
  const backupDir = resolve(
    process.env.LEGACY_VIDEO_IMPORT_BACKUP_DIR?.trim()
      || process.env.HEBRON_IMPORT_BACKUP_DIR?.trim()
      || DEFAULT_BACKUP_DIR,
  );
  await mkdir(backupDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const path = resolve(
    backupDir,
    `youtube-playlist-${PLAYLIST_ID}-before-${ARCHIVE.key}-import-${timestamp}.json`,
  );
  const payload = {
    migrationId: MIGRATION_ID,
    generatedAt: new Date().toISOString(),
    playlistId: PLAYLIST_ID,
    rowCount: rows.length,
    rows,
  };
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(payload, null, 2)}\n`, {
    encoding: "utf8",
    flag: "wx",
    mode: 0o600,
  });
  return path;
}

async function assertYoutubeVideosTransactional(connection: PoolConnection) {
  const [rows] = await connection.query<TableEngineRow[]>(`
    SELECT ENGINE
    FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'youtube_videos'
    LIMIT 1
  `);
  if (rows.length !== 1 || rows[0]!.ENGINE?.toLowerCase() !== "innodb") {
    throw new Error("--apply requires youtube_videos to use the transactional InnoDB engine.");
  }
}

async function ensureMigrationTable(connection: PoolConnection) {
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS app_migrations (
      id varchar(100) PRIMARY KEY,
      applied_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB
  `);
}

async function acquireNamedLock(connection: PoolConnection) {
  const [rows] = await connection.query<NamedLockRow[]>(
    "SELECT GET_LOCK(?, 30) AS locked",
    [NAMED_LOCK],
  );
  if (Number(rows[0]?.locked) !== 1) {
    throw new Error(`Could not acquire the ${ARCHIVE.label} import lock within 30 seconds.`);
  }
}

async function releaseNamedLock(connection: PoolConnection) {
  await connection.query("SELECT RELEASE_LOCK(?)", [NAMED_LOCK]);
}

async function hasMigrationMarker(connection: PoolConnection) {
  const [rows] = await connection.query<MigrationRow[]>(
    "SELECT id FROM app_migrations WHERE id = ? LIMIT 1",
    [MIGRATION_ID],
  );
  return rows.length > 0;
}

async function hasCompletedMigrationMarker(connection: PoolConnection) {
  const [tableRows] = await connection.query<CountRow[]>(`
    SELECT COUNT(*) AS count
    FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'app_migrations'
  `);
  if (Number(tableRows[0]?.count ?? 0) !== 1) return false;
  return hasMigrationMarker(connection);
}

async function verifyCompletedImportFast(connection: PoolConnection) {
  const [playlistRows] = await connection.query<CountRow[]>(
    "SELECT COUNT(*) AS count FROM youtube_playlists WHERE id = ?",
    [PLAYLIST_ID],
  );
  if (Number(playlistRows[0]?.count ?? 0) !== 1) {
    throw new Error(
      `Completed ${ARCHIVE.label} import marker exists, but playlist ${PLAYLIST_ID} is missing.`,
    );
  }

  const fastUrlPredicate = ARCHIVE.fastUrlLikePatterns
    .map(() => "LOWER(videoUrl) LIKE ?")
    .join(" OR ");
  const [rows] = await connection.query<CompletedImportInvariantRow[]>(
    `SELECT
       COUNT(*) AS count,
       COUNT(DISTINCT REPLACE(REPLACE(LOWER(videoUrl), 'https://', ''), 'http://', '')) AS uniqueUrlCount,
       MIN(sermonDate) AS minDate,
       MAX(sermonDate) AS maxDate,
       SUM(CASE WHEN title IS NULL OR TRIM(title) = '' THEN 1 ELSE 0 END) AS invalidTitleCount
     FROM youtube_videos
     WHERE playlistId = ?
       AND sermonDate >= ?
       AND sermonDate <= ?
       AND (${fastUrlPredicate})`,
    [PLAYLIST_ID, OLDEST_DATE, NEWEST_DATE, ...ARCHIVE.fastUrlLikePatterns],
  );
  const invariant = rows[0];
  const count = Number(invariant?.count ?? 0);
  const uniqueUrlCount = Number(invariant?.uniqueUrlCount ?? 0);
  const invalidTitleCount = Number(invariant?.invalidTitleCount ?? 0);
  const countMatches = ARCHIVE.fastVerification === "minimum-range"
    ? count >= EXPECTED_VIDEO_COUNT && uniqueUrlCount >= EXPECTED_VIDEO_COUNT
    : count === EXPECTED_VIDEO_COUNT && uniqueUrlCount === EXPECTED_VIDEO_COUNT;
  if (
    !countMatches
    || invariant?.minDate !== EXPECTED_VIDEO_OLDEST_DATE
    || invariant?.maxDate !== EXPECTED_VIDEO_NEWEST_DATE
    || invalidTitleCount !== 0
  ) {
    throw new Error(
      `Completed ${ARCHIVE.label} import invariant failed: count=${count}, uniqueUrls=${uniqueUrlCount}, `
      + `range=${invariant?.minDate ?? "none"}..${invariant?.maxDate ?? "none"}, `
      + `invalidTitles=${invalidTitleCount}.`,
    );
  }
  console.log(
    `Migration marker and database invariants verified: playlist=${PLAYLIST_ID}, `
    + `videos=${count} (minimum ${EXPECTED_VIDEO_COUNT}), `
    + `range=${EXPECTED_VIDEO_NEWEST_DATE} through ${EXPECTED_VIDEO_OLDEST_DATE}.`,
  );
}

async function verifyAppliedRows(
  connection: PoolConnection,
  videos: readonly LegacyVideo[],
  originalRows: readonly YoutubeVideoRow[],
) {
  const rows = await loadPlaylistRows(connection, false);
  const analyzed = analyzeExistingRows(videos, rows);
  if (analyzed.missing.length > 0 || analyzed.matched.length !== EXPECTED_VIDEO_COUNT) {
    throw new Error(
      `Post-insert verification failed: matched=${analyzed.matched.length}, missing=${analyzed.missing.length}.`,
    );
  }

  const rowsById = new Map(rows.map(row => [Number(row.id), row]));
  for (const original of originalRows) {
    const current = rowsById.get(Number(original.id));
    if (!current || current.videoUrl !== original.videoUrl) {
      throw new Error(`Existing youtube_videos row ${original.id} changed during import.`);
    }
  }

  const [countRows] = await connection.query<CountRow[]>(
    `SELECT COUNT(*) AS count
     FROM youtube_videos
     WHERE playlistId = ? AND sermonDate >= ? AND sermonDate <= ?`,
    [PLAYLIST_ID, OLDEST_DATE, NEWEST_DATE],
  );
  const countInRange = Number(countRows[0]?.count ?? 0);
  if (countInRange < EXPECTED_VIDEO_COUNT) {
    throw new Error(
      `Post-insert date-range verification found only ${countInRange} rows; `
      + `expected at least ${EXPECTED_VIDEO_COUNT}.`,
    );
  }
}

async function applyImport(connection: PoolConnection, videos: readonly LegacyVideo[]) {
  await assertYoutubeVideosTransactional(connection);
  await ensureMigrationTable(connection);
  await acquireNamedLock(connection);
  let transactionStarted = false;

  try {
    const preflightRows = await loadPlaylistRows(connection, false);
    const preflight = analyzeExistingRows(videos, preflightRows);
    const markerAlreadyPresent = await hasMigrationMarker(connection);
    const backupPath = await writePlaylistBackup(preflightRows);
    console.log(`Pre-apply JSON backup: ${backupPath}`);
    console.log(
      `Pre-apply database state: ${preflightRows.length} playlist rows, `
      + `${preflight.matched.length} matched, ${preflight.missing.length} missing, `
      + `marker=${markerAlreadyPresent ? "present" : "absent"}.`,
    );

    const verificationSample = selectEvenlySpacedVerificationSample(
      preflight.missing,
      APPLY_MP4_SAMPLE_SIZE,
      [...ARCHIVE.requiredSourceNums, ...Object.keys(ARCHIVE.videoUrlOverrides)],
    );
    console.log(
      `Validating ${verificationSample.length} evenly spaced missing MP4 samples `
      + `(${preflight.missing.length} authoritative XML URLs; `
      + `${preflight.matched.length} existing source URLs skipped)...`,
    );
    await mapConcurrent(verificationSample, SOURCE_CONCURRENCY, verifyMp4);

    await connection.beginTransaction();
    transactionStarted = true;
    const lockedRows = await loadPlaylistRows(connection, true);
    const analyzed = analyzeExistingRows(videos, lockedRows);
    let inserted = 0;

    for (const video of oldestFirstInsertOrder(analyzed.missing)) {
      const [result] = await connection.execute<ResultSetHeader>(
        `INSERT INTO youtube_videos (
           playlistId, videoId, videoUrl, title, preacher, scripture, sermonDate,
           thumbnailUrl, description, sortOrder, isVisible
         ) VALUES (?, NULL, ?, ?, ?, ?, ?, NULL, NULL, 0, true)`,
        [
          PLAYLIST_ID,
          video.videoUrl,
          video.title,
          video.preacher || null,
          video.scripture || null,
          video.sermonDate,
        ],
      );
      if (result.affectedRows !== 1) {
        throw new Error(`Expected one insert for legacy video ${video.num}.`);
      }
      inserted += 1;
    }

    await connection.execute(
      `INSERT INTO app_migrations (id) VALUES (?)
       ON DUPLICATE KEY UPDATE applied_at = applied_at`,
      [MIGRATION_ID],
    );
    await verifyAppliedRows(connection, videos, lockedRows);
    await connection.commit();
    transactionStarted = false;
    console.log(
      `Import committed: ${inserted} inserted, ${analyzed.matched.length} preserved, `
      + `${EXPECTED_VIDEO_COUNT} verified.`,
    );
  } catch (error) {
    if (transactionStarted) {
      await connection.rollback();
      console.error("Import failed; every youtube_videos insert and marker change was rolled back.");
    }
    throw error;
  } finally {
    await releaseNamedLock(connection).catch(error => {
      console.error(`Warning: failed to release the ${ARCHIVE.label} import lock`, error);
    });
  }
}

async function compareDatabaseReadOnly(
  connection: PoolConnection,
  videos: readonly LegacyVideo[],
) {
  const existingRows = await loadPlaylistRows(connection, false);
  const analyzed = analyzeExistingRows(videos, existingRows);
  console.log(
    `Database dry run: ${existingRows.length} playlist rows, `
    + `${analyzed.matched.length} matched, ${analyzed.missing.length} would be inserted.`,
  );
}

async function run(mode: RunMode) {
  console.log(`Mode: ${mode === "apply" ? "APPLY" : "DRY RUN"}`);
  const databaseUrl = process.env.DATABASE_URL?.trim();

  if (mode === "apply" && !databaseUrl) {
    throw new Error("DATABASE_URL is required with --apply.");
  }

  if (mode === "apply" && databaseUrl) {
    const pool = mysql.createPool({ uri: databaseUrl, timezone: "+09:00", connectionLimit: 1 });
    const connection = await pool.getConnection();
    try {
      if (await hasCompletedMigrationMarker(connection)) {
        await verifyCompletedImportFast(connection);
        console.log("The completed import marker is present; legacy network collection was skipped.");
        return;
      }

      const videos = await collectAndValidateArchive(false);
      await applyImport(connection, videos);
      return;
    } finally {
      connection.release();
      await pool.end();
    }
  }

  const videos = await collectAndValidateArchive(true);
  if (!databaseUrl) {
    console.log("DATABASE_URL is not set; source validation completed without a database comparison.");
    console.log("No files or database rows were changed.");
    return;
  }

  const pool = mysql.createPool({ uri: databaseUrl, timezone: "+09:00", connectionLimit: 1 });
  const connection = await pool.getConnection();
  try {
    await compareDatabaseReadOnly(connection, videos);
    console.log("No files or database rows were changed. Use --apply only after reviewing the result.");
  } finally {
    connection.release();
    await pool.end();
  }
}

async function main() {
  const mode = parseMode(CLI_ARGS);
  if (mode === "help") {
    printHelp();
    return;
  }
  await run(mode);
}

const entryPath = process.argv[1] ? resolve(process.argv[1]) : null;
if (entryPath && fileURLToPath(import.meta.url) === entryPath) {
  main().catch(error => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
