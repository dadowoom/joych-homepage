import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readMigrationFiles } from "drizzle-orm/migrator";

const DRIZZLE_BREAKPOINT = "--> statement-breakpoint";
const MYSQL_SAFE_BREAKPOINT_LINE = /^\s*-- --> statement-breakpoint\s*$/;

function fail(message) {
  throw new Error(`Drizzle migration ledger verification failed: ${message}`);
}

export function isSqlCodePresent(source) {
  let state = "normal";

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];

    if (state === "line-comment") {
      if (char === "\n" || char === "\r") state = "normal";
      continue;
    }

    if (state === "block-comment") {
      if (char === "*" && next === "/") {
        state = "normal";
        index += 1;
      }
      continue;
    }

    if (state === "single-quote" || state === "double-quote" || state === "backtick") {
      const delimiter =
        state === "single-quote" ? "'" : state === "double-quote" ? '"' : "`";

      if (char === "\\" && state !== "backtick") {
        index += 1;
        continue;
      }

      if (char === delimiter) {
        if (next === delimiter) {
          index += 1;
        } else {
          state = "normal";
        }
      }
      continue;
    }

    if (char === "#") {
      state = "line-comment";
      continue;
    }
    if (char === "-" && next === "-" && /\s/.test(source[index + 2] ?? "")) {
      state = "line-comment";
      index += 1;
      continue;
    }
    if (char === "/" && next === "*") {
      state = "block-comment";
      index += 1;
      continue;
    }
    if (char === "'") {
      state = "single-quote";
      continue;
    }
    if (char === '"') {
      state = "double-quote";
      continue;
    }
    if (char === "`") {
      state = "backtick";
      continue;
    }
    if (!/\s/.test(char) && char !== ";") return true;
  }

  return false;
}

export function findTopLevelSemicolons(source) {
  const positions = [];
  let state = "normal";

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];

    if (state === "line-comment") {
      if (char === "\n" || char === "\r") state = "normal";
      continue;
    }

    if (state === "block-comment") {
      if (char === "*" && next === "/") {
        state = "normal";
        index += 1;
      }
      continue;
    }

    if (state === "single-quote" || state === "double-quote" || state === "backtick") {
      const delimiter =
        state === "single-quote" ? "'" : state === "double-quote" ? '"' : "`";

      if (char === "\\" && state !== "backtick") {
        index += 1;
        continue;
      }

      if (char === delimiter) {
        if (next === delimiter) {
          index += 1;
        } else {
          state = "normal";
        }
      }
      continue;
    }

    if (char === "#") {
      state = "line-comment";
      continue;
    }
    if (char === "-" && next === "-" && /\s/.test(source[index + 2] ?? "")) {
      state = "line-comment";
      index += 1;
      continue;
    }
    if (char === "/" && next === "*") {
      state = "block-comment";
      index += 1;
      continue;
    }
    if (char === "'") {
      state = "single-quote";
      continue;
    }
    if (char === '"') {
      state = "double-quote";
      continue;
    }
    if (char === "`") {
      state = "backtick";
      continue;
    }
    if (char === ";") positions.push(index);
  }

  return positions;
}

function assertSafeBreakpointLines(tag, source) {
  const markerCount = source.split(DRIZZLE_BREAKPOINT).length - 1;
  if (markerCount === 0) return;

  const safeLineCount = source
    .split(/\r?\n/)
    .filter((line) => MYSQL_SAFE_BREAKPOINT_LINE.test(line)).length;

  if (markerCount !== safeLineCount) {
    fail(
      `${tag}.sql contains a Drizzle breakpoint that is not a MySQL-safe ` +
        "`-- --> statement-breakpoint` comment line",
    );
  }
}

function assertOneStatementPerPart(tag, source) {
  const parts = source.split(DRIZZLE_BREAKPOINT);

  parts.forEach((part, partIndex) => {
    if (!isSqlCodePresent(part)) {
      fail(`${tag}.sql has an empty statement around breakpoint ${partIndex + 1}`);
    }

    const semicolons = findTopLevelSemicolons(part);
    if (semicolons.length > 1) {
      fail(
        `${tag}.sql statement ${partIndex + 1} contains ${semicolons.length} top-level ` +
          "statements without Drizzle breakpoints",
      );
    }

    if (
      semicolons.length === 1 &&
      isSqlCodePresent(part.slice(semicolons[0] + 1))
    ) {
      fail(`${tag}.sql statement ${partIndex + 1} contains SQL after its terminator`);
    }
  });

  return parts;
}

function stripLeadingSqlComments(source) {
  let remaining = source.trimStart();

  while (remaining) {
    if (remaining.startsWith("#") || /^--\s/.test(remaining)) {
      const newlineIndex = remaining.search(/[\r\n]/);
      if (newlineIndex === -1) return "";
      remaining = remaining.slice(newlineIndex + 1).trimStart();
      continue;
    }
    if (remaining.startsWith("/*")) {
      const commentEnd = remaining.indexOf("*/", 2);
      if (commentEnd === -1) return remaining;
      remaining = remaining.slice(commentEnd + 2).trimStart();
      continue;
    }
    return remaining;
  }

  return remaining;
}

function assertTableDependencyOrder(statements) {
  const knownTables = new Set();
  const createTablePattern = /^CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?`?([a-z0-9_]+)`?/i;
  const referencePatterns = [
    /^ALTER\s+TABLE\s+`?([a-z0-9_]+)`?/i,
    /^CREATE\s+(?:UNIQUE\s+)?INDEX\s+`?[a-z0-9_]+`?\s+ON\s+`?([a-z0-9_]+)`?/i,
    /^INSERT\s+(?:IGNORE\s+)?INTO\s+`?([a-z0-9_]+)`?/i,
    /^UPDATE\s+`?([a-z0-9_]+)`?/i,
    /^DELETE\s+FROM\s+`?([a-z0-9_]+)`?/i,
    /^DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?`?([a-z0-9_]+)`?/i,
    /^TRUNCATE\s+TABLE\s+`?([a-z0-9_]+)`?/i,
  ];

  for (const statement of statements) {
    const executableSql = stripLeadingSqlComments(statement.sql);
    const createMatch = executableSql.match(createTablePattern);
    if (createMatch) {
      knownTables.add(createMatch[1].toLowerCase());
      continue;
    }

    for (const pattern of referencePatterns) {
      const referenceMatch = executableSql.match(pattern);
      if (!referenceMatch) continue;
      const table = referenceMatch[1].toLowerCase();
      if (!knownTables.has(table)) {
        fail(
          `${statement.tag}.sql statement ${statement.statementIndex} references table ` +
            `${table} before the ledger creates it`,
        );
      }
      break;
    }
  }
}

function assertSnapshotChain(resolvedFolder, journal) {
  if (journal.entries.length === 0) return;

  const snapshotFiles = fs
    .readdirSync(path.join(resolvedFolder, "meta"), { withFileTypes: true })
    .filter((entry) => entry.isFile() && /^\d{4}_snapshot\.json$/.test(entry.name))
    .map((entry) => entry.name)
    .sort();
  const latestJournalIndex = journal.entries.at(-1).idx;
  const expectedLatestSnapshot = `${String(latestJournalIndex).padStart(4, "0")}_snapshot.json`;

  if (!snapshotFiles.includes(expectedLatestSnapshot)) {
    fail(
      `latest journal entry idx ${latestJournalIndex} requires baseline snapshot ` +
        expectedLatestSnapshot,
    );
  }

  let previousId = "";
  const ids = new Set();
  for (const filename of snapshotFiles) {
    const snapshotPath = path.join(resolvedFolder, "meta", filename);
    let snapshot;
    try {
      snapshot = JSON.parse(fs.readFileSync(snapshotPath, "utf8"));
    } catch (error) {
      fail(`cannot parse ${filename}: ${error instanceof Error ? error.message : error}`);
    }

    if (snapshot.dialect !== "mysql") fail(`${filename} must use mysql dialect`);
    if (typeof snapshot.id !== "string" || !snapshot.id) fail(`${filename} has no id`);
    if (ids.has(snapshot.id)) fail(`${filename} duplicates snapshot id ${snapshot.id}`);
    ids.add(snapshot.id);
    const expectedPreviousIds = previousId
      ? [previousId]
      : ["", "00000000-0000-0000-0000-000000000000"];
    if (!expectedPreviousIds.includes(snapshot.prevId)) {
      fail(
        `${filename} prevId ${snapshot.prevId || "<empty>"} does not match ` +
          `previous snapshot id ${previousId || "<empty>"}`,
      );
    }
    previousId = snapshot.id;
  }
}

export function verifyMigrationLedger(migrationsFolder) {
  const resolvedFolder = path.resolve(migrationsFolder);
  const journalPath = path.join(resolvedFolder, "meta", "_journal.json");
  if (!fs.existsSync(journalPath)) fail(`missing ${journalPath}`);

  let journal;
  try {
    journal = JSON.parse(fs.readFileSync(journalPath, "utf8"));
  } catch (error) {
    fail(`cannot parse ${journalPath}: ${error instanceof Error ? error.message : error}`);
  }

  if (journal.dialect !== "mysql") fail(`expected mysql dialect, received ${journal.dialect}`);
  if (!Array.isArray(journal.entries)) fail("journal entries must be an array");

  const tags = new Set();
  const timestamps = new Set();
  let previousWhen = -1;
  let statementCount = 0;
  const orderedStatements = [];

  journal.entries.forEach((entry, entryIndex) => {
    if (entry.idx !== entryIndex) {
      fail(`entry ${entryIndex} has idx ${entry.idx}; idx values must be contiguous`);
    }
    if (typeof entry.tag !== "string" || !/^\d{4}_[a-z0-9_]+$/.test(entry.tag)) {
      fail(`entry ${entryIndex} has an invalid tag: ${entry.tag}`);
    }
    if (tags.has(entry.tag)) fail(`duplicate tag ${entry.tag}`);
    tags.add(entry.tag);

    if (!Number.isSafeInteger(entry.when) || entry.when <= previousWhen) {
      fail(`entry ${entry.tag} has a non-increasing timestamp ${entry.when}`);
    }
    if (timestamps.has(entry.when)) fail(`duplicate timestamp ${entry.when}`);
    timestamps.add(entry.when);
    previousWhen = entry.when;

    const migrationPath = path.join(resolvedFolder, `${entry.tag}.sql`);
    if (!fs.existsSync(migrationPath)) fail(`journal tag ${entry.tag} has no SQL file`);

    const source = fs.readFileSync(migrationPath, "utf8");
    if (!source.trim()) fail(`${entry.tag}.sql is empty`);
    assertSafeBreakpointLines(entry.tag, source);
    const statements = assertOneStatementPerPart(entry.tag, source);
    statementCount += statements.length;
    statements.forEach((sql, statementIndex) => {
      orderedStatements.push({ tag: entry.tag, statementIndex: statementIndex + 1, sql });
    });
  });

  const sqlTags = fs
    .readdirSync(resolvedFolder, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".sql"))
    .map((entry) => entry.name.slice(0, -4))
    .sort();

  const untrackedSqlFiles = sqlTags.filter((tag) => !tags.has(tag));
  if (untrackedSqlFiles.length > 0) {
    fail(`SQL files missing from journal: ${untrackedSqlFiles.join(", ")}`);
  }
  if (sqlTags.length !== journal.entries.length) {
    fail(`journal has ${journal.entries.length} entries but found ${sqlTags.length} SQL files`);
  }

  assertSnapshotChain(resolvedFolder, journal);
  assertTableDependencyOrder(orderedStatements);

  const drizzleMigrations = readMigrationFiles({ migrationsFolder: resolvedFolder });
  const drizzleStatementCount = drizzleMigrations.reduce(
    (total, migration) => total + migration.sql.length,
    0,
  );
  if (drizzleMigrations.length !== journal.entries.length) {
    fail(
      `Drizzle loaded ${drizzleMigrations.length} migrations but journal has ` +
        `${journal.entries.length}`,
    );
  }
  if (drizzleStatementCount !== statementCount) {
    fail(
      `Drizzle loaded ${drizzleStatementCount} statements but verifier found ${statementCount}`,
    );
  }

  return {
    migrationCount: journal.entries.length,
    statementCount,
    firstTag: journal.entries[0]?.tag ?? null,
    lastTag: journal.entries.at(-1)?.tag ?? null,
  };
}

function isExecutedDirectly() {
  const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
  return invokedPath === fileURLToPath(import.meta.url);
}

if (isExecutedDirectly()) {
  const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const migrationsFolder = process.argv[2]
    ? path.resolve(process.argv[2])
    : path.join(repositoryRoot, "drizzle");

  try {
    const result = verifyMigrationLedger(migrationsFolder);
    console.log(
      `Verified ${result.migrationCount} Drizzle migrations ` +
        `(${result.statementCount} statements): ${result.firstTag} -> ${result.lastTag}`,
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
