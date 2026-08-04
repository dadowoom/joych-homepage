import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import dotenv from "dotenv";
import mysql from "mysql2/promise";

dotenv.config({ quiet: true });

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_MINIMUM_AGE_DAYS = 7;
const DEFAULT_BATCH_SIZE = 250;
const MAX_BATCH_SIZE = 2_000;
const HUMAN_PREVIEW_LIMIT = 100;
export const UPLOAD_REFERENCE_LIKE_PATTERN = "%uploads%";

/**
 * Only columns that can legitimately contain a public upload URL, rendered
 * rich text, or JSON used by the public site are scanned. Keeping this list
 * explicit prevents the audit from loading unrelated private/free-form data.
 */
export const UPLOAD_REFERENCE_TARGETS = Object.freeze([
  { table: "menus", columns: ["href"] },
  { table: "menu_items", columns: ["href", "pageImageUrl"] },
  { table: "menu_sub_items", columns: ["href", "pageImageUrl"] },
  { table: "quick_menus", columns: ["href"] },
  {
    table: "hero_slides",
    columns: ["videoUrl", "posterUrl", "btn1Href", "btn2Href", "buttonsJson"],
  },
  { table: "notices", columns: ["content", "thumbnailUrl", "attachmentUrl"] },
  {
    table: "dynamic_board_posts",
    columns: ["content", "thumbnail_url", "attachment_url"],
  },
  { table: "free_board_posts", columns: ["content"] },
  { table: "notice_popups", columns: ["content", "image_url", "link_href"] },
  { table: "history_items", columns: ["content"] },
  {
    table: "gallery_items",
    columns: ["imageUrl", "albumDescription", "caption"],
  },
  { table: "gallery_albums", columns: ["description"] },
  { table: "affiliates", columns: ["href"] },
  { table: "sermons", columns: ["youtubeId"] },
  { table: "site_settings", columns: ["settingValue"] },
  { table: "church_staff", columns: ["description", "profile", "image_url"] },
  { table: "member_social_accounts", columns: ["profile_image_url"] },
  { table: "subtitle_requests", columns: ["attachment_url"] },
  { table: "bulletins", columns: ["file_url"] },
  { table: "bulletin_images", columns: ["file_url"] },
  { table: "bulletin_ad_requests", columns: ["attachment_url"] },
  {
    table: "facilities",
    columns: [
      "description",
      "contactText",
      "notice",
      "externalNotice",
      "caution",
    ],
  },
  { table: "facility_images", columns: ["imageUrl"] },
  { table: "vehicles", columns: ["description", "notice", "caution"] },
  { table: "vehicle_images", columns: ["image_url"] },
  {
    table: "courses",
    columns: [
      "summary",
      "imageUrl",
      "description",
      "pageHref",
      "applicationFields",
      "applicationNotice",
    ],
  },
  { table: "course_room_managers", columns: ["pageHref"] },
  { table: "course_applications", columns: ["customAnswers"] },
  {
    table: "pastor_books",
    columns: ["summary", "content_html", "external_url"],
  },
  { table: "pastor_book_images", columns: ["image_url"] },
  { table: "missionaries", columns: ["profileImage", "description"] },
  { table: "mission_reports", columns: ["summary", "content", "thumbnailUrl"] },
  { table: "mission_report_images", columns: ["imageUrl"] },
  { table: "mission_report_files", columns: ["fileUrl"] },
  { table: "mission_report_prayer_topics", columns: ["content"] },
  { table: "testimony_posts", columns: ["content", "thumbnail_url"] },
  { table: "testimony_post_images", columns: ["image_url"] },
  { table: "testimony_comments", columns: ["content"] },
  {
    table: "school_departments",
    columns: [
      "description",
      "educationGoals",
      "prayerTopics",
      "staffInfo",
      "imageUrl",
    ],
  },
  { table: "school_posts", columns: ["content"] },
  { table: "school_post_files", columns: ["fileUrl"] },
  { table: "page_blocks", columns: ["content"] },
  { table: "youtube_playlists", columns: ["description"] },
  {
    table: "youtube_videos",
    columns: ["videoUrl", "thumbnailUrl", "description"],
  },
]);

const DEFAULT_LOCAL_UPLOAD_HOSTS = Object.freeze([
  "joych.org",
  "www.joych.org",
  "m.joych.org",
  "newjoych.co.kr",
  "www.newjoych.co.kr",
]);

function trimReferenceToken(value) {
  return value.trim().replace(/[\],.;:!?)}]+$/g, "");
}

function createAllowedHostSet(additionalHosts = []) {
  return new Set(
    [...DEFAULT_LOCAL_UPLOAD_HOSTS, ...additionalHosts]
      .map(value => String(value).trim().toLowerCase())
      .filter(Boolean)
  );
}

/**
 * Normalize one local `/uploads/` URL or path to the relative filesystem key.
 * Absolute URLs are accepted only for known Joyful Church hosts (plus hosts
 * explicitly supplied by the caller); photo.joych.org and all other external
 * hosts are therefore ignored.
 */
export function normalizeUploadKey(reference, options = {}) {
  if (typeof reference !== "string") return null;

  const token = trimReferenceToken(reference.replaceAll("\\/", "/"));
  if (!token) return null;

  const allowedHosts = createAllowedHostSet(options.allowedHosts);
  let parsed;
  let isRelative = false;

  try {
    if (token.startsWith("/uploads/") && !token.startsWith("//")) {
      parsed = new URL(token, "https://local-upload.invalid");
      isRelative = true;
    } else if (token.startsWith("//")) {
      parsed = new URL(`https:${token}`);
    } else {
      parsed = new URL(token);
    }
  } catch {
    return null;
  }

  if (!isRelative && !allowedHosts.has(parsed.hostname.toLowerCase())) {
    return null;
  }
  if (!parsed.pathname.startsWith("/uploads/")) return null;

  let key;
  try {
    key = decodeURIComponent(parsed.pathname.slice("/uploads/".length));
  } catch {
    return null;
  }

  key = key.replaceAll("\\", "/").replace(/^\/+/, "").normalize("NFC");
  if (!key || key.includes("\0")) return null;

  const segments = key.split("/");
  if (
    segments.some(segment => !segment || segment === "." || segment === "..")
  ) {
    return null;
  }

  return segments.join("/");
}

/** Extract unique local upload keys from a URL, HTML body, JSON string, or text. */
export function extractUploadKeys(value, options = {}) {
  if (typeof value !== "string" || !value.includes("uploads")) return [];

  const normalizedValue = value.replaceAll("\\/", "/");
  const referencePattern =
    /(?:(?:https?:)?\/\/[^\s"'<>\\]+)?\/uploads\/[^\s"'<>\\]+/gi;
  const keys = new Set();

  for (const match of normalizedValue.matchAll(referencePattern)) {
    const key = normalizeUploadKey(match[0], options);
    if (key) keys.add(key);
  }

  return [...keys];
}

/** Normalize a path already known to be relative to UPLOAD_DIR. */
export function normalizeInventoryKey(relativePath) {
  if (typeof relativePath !== "string") return null;
  const value = relativePath
    .replaceAll("\\", "/")
    .replace(/^\/+/, "")
    .normalize("NFC");
  if (!value || value.includes("\0")) return null;
  const segments = value.split("/");
  if (
    segments.some(segment => !segment || segment === "." || segment === "..")
  ) {
    return null;
  }
  return segments.join("/");
}

/** Pure candidate decision used by the inventory walk and unit tests. */
export function isUnreferencedCandidate(
  file,
  referencedKeys,
  { nowMs = Date.now(), minimumAgeDays = DEFAULT_MINIMUM_AGE_DAYS } = {}
) {
  const key = normalizeInventoryKey(file?.key);
  const modifiedAtMs = Number(file?.modifiedAtMs);
  if (!key || !Number.isFinite(modifiedAtMs)) return false;

  const minimumAgeMs = minimumAgeDays * DAY_MS;
  return nowMs - modifiedAtMs >= minimumAgeMs && !referencedKeys.has(key);
}

export function classifyUploadAudit(missingTargets) {
  const auditComplete = Array.isArray(missingTargets) && missingTargets.length === 0;
  return {
    auditComplete,
    candidateClassification: auditComplete
      ? "unreferenced-candidate"
      : "review-only-incomplete-scan",
  };
}

function quoteIdentifier(value) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) {
    throw new Error("Unsafe database identifier in upload audit configuration");
  }
  return `\`${value}\``;
}

function safeErrorCode(error) {
  const candidate =
    error && typeof error === "object" && "code" in error
      ? String(error.code ?? "")
      : "";
  return /^[A-Z][A-Z0-9_]{0,63}$/.test(candidate) ? candidate : "UNKNOWN";
}

function configuredAllowedHosts() {
  const hosts = [];
  const publicUrlBase = process.env.PUBLIC_URL_BASE;
  if (publicUrlBase) {
    try {
      hosts.push(new URL(publicUrlBase).hostname);
    } catch {
      // A malformed optional public URL does not broaden the accepted host set.
    }
  }
  return hosts;
}

async function discoverAvailableTargets(connection) {
  const tableNames = [
    ...new Set(UPLOAD_REFERENCE_TARGETS.map(target => target.table)),
  ];
  const placeholders = tableNames.map(() => "?").join(", ");
  const [rows] = await connection.query(
    `SELECT TABLE_NAME AS tableName, COLUMN_NAME AS columnName
       FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME IN (${placeholders})`,
    tableNames
  );

  const availableByTable = new Map();
  for (const row of rows) {
    const tableName = String(row.tableName);
    const columnName = String(row.columnName);
    const columns = availableByTable.get(tableName.toLowerCase()) ?? new Set();
    columns.add(columnName.toLowerCase());
    availableByTable.set(tableName.toLowerCase(), columns);
  }

  const availableTargets = [];
  const missingTargets = [];
  for (const target of UPLOAD_REFERENCE_TARGETS) {
    const availableColumns = availableByTable.get(target.table.toLowerCase());
    if (!availableColumns || !availableColumns.has("id")) {
      missingTargets.push(`${target.table}.*`);
      continue;
    }

    const columns = target.columns.filter(column =>
      availableColumns.has(column.toLowerCase())
    );
    for (const column of target.columns) {
      if (!availableColumns.has(column.toLowerCase())) {
        missingTargets.push(`${target.table}.${column}`);
      }
    }
    if (columns.length > 0)
      availableTargets.push({ table: target.table, columns });
  }

  return { availableTargets, missingTargets };
}

async function scanDatabaseReferences(connection, { batchSize, allowedHosts }) {
  const { availableTargets, missingTargets } =
    await discoverAvailableTargets(connection);
  const referencedKeys = new Set();
  let referenceOccurrences = 0;
  let matchedRowsRead = 0;
  let columnsScanned = 0;

  for (const target of availableTargets) {
    const tableSql = quoteIdentifier(target.table);
    const selectedColumns = target.columns.map(
      (column, index) =>
        `${quoteIdentifier(column)} AS ${quoteIdentifier(`value${index}`)}`
    );
    // JSON may store paths as `\/uploads\/...`; filtering on the broader
    // token keeps those rows in scope before the strict URL extractor runs.
    const whereSql = target.columns
      .map(column => `${quoteIdentifier(column)} LIKE ?`)
      .join(" OR ");
    const likeParameters = target.columns.map(
      () => UPLOAD_REFERENCE_LIKE_PATTERN,
    );
    let lastId = 0;
    columnsScanned += target.columns.length;

    while (true) {
      const [rows] = await connection.query(
        `SELECT ${quoteIdentifier("id")} AS ${quoteIdentifier("rowId")}, ${selectedColumns.join(", ")}
           FROM ${tableSql}
          WHERE ${quoteIdentifier("id")} > ?
            AND (${whereSql})
          ORDER BY ${quoteIdentifier("id")} ASC
          LIMIT ?`,
        [lastId, ...likeParameters, batchSize]
      );

      if (rows.length === 0) break;
      matchedRowsRead += rows.length;

      for (const row of rows) {
        for (let index = 0; index < target.columns.length; index += 1) {
          const value = row[`value${index}`];
          for (const key of extractUploadKeys(value, { allowedHosts })) {
            referencedKeys.add(key);
            referenceOccurrences += 1;
          }
        }
      }

      lastId = Number(rows.at(-1).rowId);
      if (!Number.isSafeInteger(lastId) || rows.length < batchSize) break;
    }
  }

  return {
    referencedKeys,
    referenceOccurrences,
    matchedRowsRead,
    tablesScanned: availableTargets.length,
    columnsScanned,
    missingTargets,
  };
}

async function scanUploadDirectory(
  uploadDir,
  referencedKeys,
  { nowMs, minimumAgeDays }
) {
  const root = await fs.realpath(uploadDir);
  const rootStat = await fs.stat(root);
  if (!rootStat.isDirectory()) {
    const error = new Error("UPLOAD_DIR is not a directory");
    error.code = "ENOTDIR";
    throw error;
  }

  const pendingDirectories = [""];
  const presentKeys = new Set();
  const candidates = [];
  let fileCount = 0;
  let totalBytes = 0;
  let candidateBytes = 0;
  let skippedSymlinks = 0;
  let skippedSpecialEntries = 0;
  let oldestModifiedAtMs = null;
  let newestModifiedAtMs = null;

  while (pendingDirectories.length > 0) {
    const relativeDirectory = pendingDirectories.pop();
    const directoryPath = path.join(root, relativeDirectory);
    const directory = await fs.opendir(directoryPath);

    for await (const entry of directory) {
      const relativeEntry = path.join(relativeDirectory, entry.name);
      const absoluteEntry = path.join(root, relativeEntry);
      const stat = await fs.lstat(absoluteEntry);

      if (stat.isSymbolicLink()) {
        skippedSymlinks += 1;
        continue;
      }
      if (stat.isDirectory()) {
        pendingDirectories.push(relativeEntry);
        continue;
      }
      if (!stat.isFile()) {
        skippedSpecialEntries += 1;
        continue;
      }

      const key = normalizeInventoryKey(relativeEntry);
      if (!key) {
        skippedSpecialEntries += 1;
        continue;
      }

      fileCount += 1;
      totalBytes += stat.size;
      presentKeys.add(key);
      oldestModifiedAtMs =
        oldestModifiedAtMs === null
          ? stat.mtimeMs
          : Math.min(oldestModifiedAtMs, stat.mtimeMs);
      newestModifiedAtMs =
        newestModifiedAtMs === null
          ? stat.mtimeMs
          : Math.max(newestModifiedAtMs, stat.mtimeMs);

      const file = { key, sizeBytes: stat.size, modifiedAtMs: stat.mtimeMs };
      if (
        isUnreferencedCandidate(file, referencedKeys, { nowMs, minimumAgeDays })
      ) {
        candidateBytes += stat.size;
        candidates.push({
          key,
          sizeBytes: stat.size,
          modifiedAt: new Date(stat.mtimeMs).toISOString(),
          ageDays: Math.floor(((nowMs - stat.mtimeMs) / DAY_MS) * 100) / 100,
        });
      }
    }
  }

  candidates.sort((left, right) =>
    left.modifiedAt.localeCompare(right.modifiedAt)
  );

  return {
    presentKeys,
    fileCount,
    totalBytes,
    candidates,
    candidateBytes,
    skippedSymlinks,
    skippedSpecialEntries,
    oldestModifiedAt:
      oldestModifiedAtMs === null
        ? null
        : new Date(oldestModifiedAtMs).toISOString(),
    newestModifiedAt:
      newestModifiedAtMs === null
        ? null
        : new Date(newestModifiedAtMs).toISOString(),
  };
}

function parsePositiveInteger(
  rawValue,
  flagName,
  { max = Number.MAX_SAFE_INTEGER } = {}
) {
  const value = Number(rawValue);
  if (!Number.isSafeInteger(value) || value <= 0 || value > max) {
    throw new Error(
      `${flagName} must be a positive integer no greater than ${max}`
    );
  }
  return value;
}

function parseArguments(argv) {
  const options = {
    json: false,
    minimumAgeDays: DEFAULT_MINIMUM_AGE_DAYS,
    batchSize: DEFAULT_BATCH_SIZE,
  };

  for (const argument of argv) {
    if (argument === "--json") {
      options.json = true;
      continue;
    }
    if (argument === "--help" || argument === "-h") {
      options.help = true;
      continue;
    }
    if (argument.startsWith("--minimum-age-days=")) {
      options.minimumAgeDays = parsePositiveInteger(
        argument.slice("--minimum-age-days=".length),
        "--minimum-age-days",
        { max: 3650 }
      );
      continue;
    }
    if (argument.startsWith("--batch-size=")) {
      options.batchSize = parsePositiveInteger(
        argument.slice("--batch-size=".length),
        "--batch-size",
        {
          max: MAX_BATCH_SIZE,
        }
      );
      continue;
    }
    throw new Error(`Unknown argument: ${argument}`);
  }

  return options;
}

function formatBytes(value) {
  if (value < 1024) return `${value} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let amount = value;
  let unitIndex = -1;
  do {
    amount /= 1024;
    unitIndex += 1;
  } while (amount >= 1024 && unitIndex < units.length - 1);
  return `${amount.toFixed(amount >= 10 ? 1 : 2)} ${units[unitIndex]}`;
}

function printHumanReport(report) {
  console.log("업로드 파일 점검 결과 (읽기 전용)");
  if (!report.auditComplete) {
    console.log(
      `- 주의: DB 참조 대상 ${report.references.unavailableTargets.length}개를 확인하지 못해 이번 결과만으로 파일 삭제를 판단할 수 없습니다.`
    );
    for (const target of report.references.unavailableTargets.slice(0, 20)) {
      console.log(`  · 미확인: ${target}`);
    }
    if (report.references.unavailableTargets.length > 20) {
      console.log(
        `  · 나머지 ${report.references.unavailableTargets.length - 20}개는 --json 결과에서 확인하세요.`
      );
    }
  }
  console.log(
    `- 실제 파일: ${report.files.count}개 / ${formatBytes(report.files.totalBytes)}`
  );
  if (report.files.oldestModifiedAt && report.files.newestModifiedAt) {
    console.log(
      `- 파일 수정일 범위: ${report.files.oldestModifiedAt.slice(0, 10)} ~ ${report.files.newestModifiedAt.slice(0, 10)}`
    );
  }
  console.log(`- DB가 참조하는 업로드: ${report.references.uniqueKeys}개`);
  console.log(
    `- ${report.minimumAgeDays}일 이상 미참조 후보: ${report.candidates.count}개 / ${formatBytes(report.candidates.totalBytes)}`
  );
  console.log(
    `- DB 참조는 있으나 파일이 없는 항목: ${report.missingFiles.count}개`
  );
  if (
    report.files.skippedSymlinks > 0 ||
    report.files.skippedSpecialEntries > 0
  ) {
    console.log(
      `- 안전상 건너뜀: 심볼릭 링크 ${report.files.skippedSymlinks}개, 특수 항목 ${report.files.skippedSpecialEntries}개`
    );
  }

  if (report.candidates.count > 0) {
    console.log("\n미참조 후보 (오래된 순):");
    for (const candidate of report.candidates.items.slice(
      0,
      HUMAN_PREVIEW_LIMIT
    )) {
      console.log(
        `- ${candidate.key} | ${formatBytes(candidate.sizeBytes)} | ${candidate.modifiedAt.slice(0, 10)} (${candidate.ageDays}일)`
      );
    }
    if (report.candidates.count > HUMAN_PREVIEW_LIMIT) {
      console.log(
        `- 나머지 ${report.candidates.count - HUMAN_PREVIEW_LIMIT}개는 --json 옵션으로 확인할 수 있습니다.`
      );
    }
  }

  console.log("\n파일 삭제·이동 및 DB 변경은 수행하지 않았습니다.");
}

function printHelp() {
  console.log(`Usage: npm run audit:uploads -- [options]

Options:
  --json                    JSON 형식으로 전체 결과 출력
  --minimum-age-days=N      미참조 후보 최소 경과일 (기본값: 7)
  --batch-size=N            DB 조회 묶음 크기 (기본값: 250, 최대: 2000)
  --help, -h                도움말 출력

Required environment:
  DATABASE_URL              점검할 MySQL 데이터베이스
  UPLOAD_DIR                업로드 루트 (미지정 시 현재 프로젝트의 uploads)

This command is read-only and never deletes or moves files.`);
}

export async function runUploadInventoryAudit({
  uploadDir,
  databaseUrl,
  minimumAgeDays = DEFAULT_MINIMUM_AGE_DAYS,
  batchSize = DEFAULT_BATCH_SIZE,
  nowMs = Date.now(),
} = {}) {
  if (!databaseUrl)
    throw Object.assign(new Error("DATABASE_URL is required"), {
      code: "CONFIG",
    });

  const connection = await mysql.createConnection({
    uri: databaseUrl,
    timezone: "+09:00",
  });

  try {
    const database = await scanDatabaseReferences(connection, {
      batchSize,
      allowedHosts: configuredAllowedHosts(),
    });
    const files = await scanUploadDirectory(
      uploadDir,
      database.referencedKeys,
      {
        nowMs,
        minimumAgeDays,
      }
    );
    const missingFileKeys = [...database.referencedKeys]
      .filter(key => !files.presentKeys.has(key))
      .sort((left, right) => left.localeCompare(right));
    const auditStatus = classifyUploadAudit(database.missingTargets);

    return {
      generatedAt: new Date(nowMs).toISOString(),
      mode: "read-only",
      auditComplete: auditStatus.auditComplete,
      minimumAgeDays,
      files: {
        count: files.fileCount,
        totalBytes: files.totalBytes,
        skippedSymlinks: files.skippedSymlinks,
        skippedSpecialEntries: files.skippedSpecialEntries,
        oldestModifiedAt: files.oldestModifiedAt,
        newestModifiedAt: files.newestModifiedAt,
      },
      references: {
        uniqueKeys: database.referencedKeys.size,
        occurrences: database.referenceOccurrences,
        matchedRowsRead: database.matchedRowsRead,
        tablesScanned: database.tablesScanned,
        columnsScanned: database.columnsScanned,
        unavailableTargets: database.missingTargets,
      },
      candidates: {
        classification: auditStatus.candidateClassification,
        count: files.candidates.length,
        totalBytes: files.candidateBytes,
        items: files.candidates,
      },
      missingFiles: {
        count: missingFileKeys.length,
        keys: missingFileKeys,
      },
    };
  } finally {
    await connection.end();
  }
}

async function main() {
  let options;
  try {
    options = parseArguments(process.argv.slice(2));
  } catch (error) {
    console.error(
      `[upload-audit] 잘못된 실행 옵션입니다 (code=${safeErrorCode(error)}).`
    );
    process.exitCode = 2;
    return;
  }

  if (options.help) {
    printHelp();
    return;
  }

  try {
    const report = await runUploadInventoryAudit({
      uploadDir: process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads"),
      databaseUrl: process.env.DATABASE_URL,
      minimumAgeDays: options.minimumAgeDays,
      batchSize: options.batchSize,
    });
    if (options.json) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      printHumanReport(report);
    }
  } catch (error) {
    // Never print the connection string, SQL row values, error message, or stack.
    console.error(
      `[upload-audit] 점검을 완료하지 못했습니다 (code=${safeErrorCode(error)}).`
    );
    process.exitCode = 1;
  }
}

const entryPoint = process.argv[1]
  ? pathToFileURL(path.resolve(process.argv[1])).href
  : null;
if (entryPoint === import.meta.url) {
  await main();
}
