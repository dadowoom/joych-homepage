import "dotenv/config";

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import mysql, {
  type PoolConnection,
  type ResultSetHeader,
  type RowDataPacket,
} from "mysql2/promise";

type RunMode = "dry-run" | "apply";

type LegacyListRow = Readonly<{
  date: string;
  num: string;
  title: string;
  scripture: string;
  preacher: string;
}>;

type LegacyVideo = Readonly<{
  pageCode: typeof PAGE_CODE;
  vodType: typeof VOD_TYPE;
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

const PAGE_CODE = "423" as const;
const VOD_TYPE = "237" as const;
const PLAYLIST_ID = 90001;
const EXPECTED_COUNT = 263;
const NEWEST_DATE = "2026-07-15";
const OLDEST_DATE = "2021-02-17";
const MAX_LIST_PAGES = 100;
const SOURCE_CONCURRENCY = 5;
const REQUEST_TIMEOUT_MS = 20_000;
const REQUEST_ATTEMPTS = 3;
const LIST_BASE_URL = "http://joych.anyline.kr/main/sub.html";
const VOD_INFO_URL = "http://admin.joych.org/core/xml/vod/vodInfo.xml.html";
const VOD_REFERER_BASE = "http://admin.joych.org/core/module/vod/skin_001/vodIframe.html";
const MIGRATION_ID = "0093_import_legacy_hebron_videos_20210217_20260715";
const NAMED_LOCK = "joych:import-legacy-hebron-videos:90001";
const DEFAULT_BACKUP_DIR = resolve("backups");
const ALLOWED_MP4_URL = /^https?:\/\/sermon\.joych\.org\/mp4\/wed\/[^?#]+\.mp4$/i;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const LIST_ROW_PATTERN = /<tr>\s*<td[^>]*>(\d{4}-\d{2}-\d{2})<\/td>\s*<td[^>]*>\s*<a[^>]*[?&]num=(\d+)[^>]*>([\s\S]*?)<\/a>\s*<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<\/tr>/gi;

function parseMode(args: readonly string[]): RunMode | "help" {
  const allowed = new Set(["--apply", "--dry-run", "--help", "-h"]);
  const unknown = args.filter(argument => !allowed.has(argument));
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
  console.log(`Usage: npm run import:legacy-hebron -- [--dry-run | --apply]

Collects and validates the fixed legacy Hebron Wednesday-worship archive:
  pageCode=${PAGE_CODE}, vodType=${VOD_TYPE}, ${NEWEST_DATE} through ${OLDEST_DATE}

The default is a read-only dry run. --apply requires DATABASE_URL, writes a
JSON backup first, and inserts only missing URLs into playlist ${PLAYLIST_ID}.
Existing youtube_videos rows are never updated or deleted.`);
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

function decodeHtml(value: string) {
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

function parseListRows(html: string) {
  const rows: LegacyListRow[] = [];
  LIST_ROW_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = LIST_ROW_PATTERN.exec(html))) {
    rows.push({
      date: match[1]!,
      num: match[2]!,
      title: decodeHtml(match[3]!),
      scripture: decodeHtml(match[4]!),
      preacher: decodeHtml(match[5]!),
    });
  }
  return rows;
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
    const pageRows = parseListRows(await response.text());
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

  const duplicateNums = findDuplicates(rows.map(row => row.num));
  if (duplicateNums.length > 0) {
    throw new Error(`Legacy list has duplicate video numbers: ${duplicateNums.join(", ")}`);
  }

  const selected = rows.filter(row => row.date >= OLDEST_DATE && row.date <= NEWEST_DATE);
  if (selected.length !== EXPECTED_COUNT) {
    throw new Error(
      `Expected ${EXPECTED_COUNT} list rows in the fixed date range, found ${selected.length}.`,
    );
  }
  return selected;
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

  const video: LegacyVideo = {
    pageCode: PAGE_CODE,
    vodType: VOD_TYPE,
    num: row.num,
    videoUrl: getXmlTag(xml, "vodFile"),
    title: getXmlTag(xml, "subject"),
    preacher: getXmlTag(xml, "preacher"),
    scripture: getXmlTag(xml, "word"),
    sermonDate: getXmlTag(xml, "date"),
  };

  if (!video.title || !DATE_PATTERN.test(video.sermonDate)) {
    throw new Error(`Legacy metadata ${row.num} is missing a title or valid date.`);
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

function canonicalVideoUrl(rawUrl: string) {
  const url = new URL(rawUrl);
  return `${url.hostname.toLowerCase()}${url.pathname}`;
}

function findDuplicates(values: readonly string[]) {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return [...duplicates];
}

function validateArchive(videos: readonly LegacyVideo[]) {
  if (videos.length !== EXPECTED_COUNT) {
    throw new Error(`Expected ${EXPECTED_COUNT} validated videos, found ${videos.length}.`);
  }

  const dates = videos.map(video => video.sermonDate).sort();
  if (dates[0] !== OLDEST_DATE || dates.at(-1) !== NEWEST_DATE) {
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

async function collectAndValidateArchive() {
  console.log("Collecting the legacy Hebron list...");
  const listRows = await collectLegacyList();
  console.log(`Validated ${listRows.length} list rows. Loading authoritative XML metadata...`);
  const videos = await mapConcurrent(listRows, SOURCE_CONCURRENCY, fetchLegacyVideo);
  validateArchive(videos);
  console.log(`Validating ${videos.length} MP4 files with HEAD requests...`);
  await mapConcurrent(videos, SOURCE_CONCURRENCY, verifyMp4);
  console.log(
    `Source validation passed: ${videos.length} unique videos, ${NEWEST_DATE} through ${OLDEST_DATE}.`,
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

async function writePlaylistBackup(rows: readonly YoutubeVideoRow[]) {
  const backupDir = resolve(process.env.HEBRON_IMPORT_BACKUP_DIR?.trim() || DEFAULT_BACKUP_DIR);
  await mkdir(backupDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const path = resolve(backupDir, `youtube-playlist-${PLAYLIST_ID}-before-hebron-import-${timestamp}.json`);
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
    throw new Error("Could not acquire the Hebron import lock within 30 seconds.");
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
    throw new Error(`Completed Hebron import marker exists, but playlist ${PLAYLIST_ID} is missing.`);
  }

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
       AND (
         LOWER(videoUrl) LIKE 'http://sermon.joych.org/mp4/wed/%.mp4'
         OR LOWER(videoUrl) LIKE 'https://sermon.joych.org/mp4/wed/%.mp4'
       )`,
    [PLAYLIST_ID, OLDEST_DATE, NEWEST_DATE],
  );
  const invariant = rows[0];
  const count = Number(invariant?.count ?? 0);
  const uniqueUrlCount = Number(invariant?.uniqueUrlCount ?? 0);
  const invalidTitleCount = Number(invariant?.invalidTitleCount ?? 0);
  if (
    count !== EXPECTED_COUNT
    || uniqueUrlCount !== EXPECTED_COUNT
    || invariant?.minDate !== OLDEST_DATE
    || invariant?.maxDate !== NEWEST_DATE
    || invalidTitleCount !== 0
  ) {
    throw new Error(
      `Completed Hebron import invariant failed: count=${count}, uniqueUrls=${uniqueUrlCount}, `
      + `range=${invariant?.minDate ?? "none"}..${invariant?.maxDate ?? "none"}, `
      + `invalidTitles=${invalidTitleCount}.`,
    );
  }
  console.log(
    `Migration marker and database invariants verified: playlist=${PLAYLIST_ID}, `
    + `videos=${EXPECTED_COUNT}, range=${NEWEST_DATE} through ${OLDEST_DATE}.`,
  );
}

async function verifyAppliedRows(
  connection: PoolConnection,
  videos: readonly LegacyVideo[],
  originalRows: readonly YoutubeVideoRow[],
) {
  const rows = await loadPlaylistRows(connection, false);
  const analyzed = analyzeExistingRows(videos, rows);
  if (analyzed.missing.length > 0 || analyzed.matched.length !== EXPECTED_COUNT) {
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
  if (countInRange < EXPECTED_COUNT) {
    throw new Error(
      `Post-insert date-range verification found only ${countInRange} rows; expected at least ${EXPECTED_COUNT}.`,
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

    await connection.beginTransaction();
    transactionStarted = true;
    const lockedRows = await loadPlaylistRows(connection, true);
    const analyzed = analyzeExistingRows(videos, lockedRows);
    let inserted = 0;

    for (const video of analyzed.missing) {
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
      `Import committed: ${inserted} inserted, ${analyzed.matched.length} preserved, ${EXPECTED_COUNT} verified.`,
    );
  } catch (error) {
    if (transactionStarted) {
      await connection.rollback();
      console.error("Import failed; every youtube_videos insert and marker change was rolled back.");
    }
    throw error;
  } finally {
    await releaseNamedLock(connection).catch(error => {
      console.error("Warning: failed to release the Hebron import lock", error);
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

      const videos = await collectAndValidateArchive();
      await applyImport(connection, videos);
      return;
    } finally {
      connection.release();
      await pool.end();
    }
  }

  const videos = await collectAndValidateArchive();
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
  const mode = parseMode(process.argv.slice(2));
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
