import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  findTopLevelSemicolons,
  isSqlCodePresent,
  verifyMigrationLedger,
} from "./verify-drizzle-migrations.mjs";

const SAFE_BREAKPOINT = "-- --> statement-breakpoint";

function canonicalSqlContent(source) {
  const withoutBreakpoints = source
    .replaceAll(SAFE_BREAKPOINT, "")
    .replaceAll("--> statement-breakpoint", "");
  let canonical = "";
  let state = "normal";

  for (let index = 0; index < withoutBreakpoints.length; index += 1) {
    const char = withoutBreakpoints[index];
    const next = withoutBreakpoints[index + 1];

    if (state === "normal") {
      if (/\s/.test(char)) continue;
      if (char === "#") state = "line-comment";
      else if (char === "-" && next === "-" && /\s/.test(withoutBreakpoints[index + 2] ?? "")) {
        state = "line-comment";
      } else if (char === "/" && next === "*") state = "block-comment";
      else if (char === "'") state = "single-quote";
      else if (char === '"') state = "double-quote";
      else if (char === "`") state = "backtick";
      canonical += char;
      continue;
    }

    canonical += char;
    if (state === "line-comment" && (char === "\n" || char === "\r")) {
      state = "normal";
    } else if (state === "block-comment" && char === "*" && next === "/") {
      canonical += next;
      index += 1;
      state = "normal";
    } else if (state === "single-quote" || state === "double-quote" || state === "backtick") {
      const delimiter =
        state === "single-quote" ? "'" : state === "double-quote" ? '"' : "`";
      if (char === "\\" && state !== "backtick") {
        canonical += next ?? "";
        index += 1;
      } else if (char === delimiter) {
        if (next === delimiter) {
          canonical += next;
          index += 1;
        } else {
          state = "normal";
        }
      }
    }
  }

  return canonical;
}

function insertMissingBreakpoints(part) {
  const semicolons = findTopLevelSemicolons(part);
  const insertAt = semicolons.filter((position) =>
    isSqlCodePresent(part.slice(position + 1)),
  );

  let normalized = part;
  for (const position of insertAt.reverse()) {
    const remainder = normalized.slice(position + 1);
    const normalizedRemainder = remainder.replace(/^(?:[\t ]*\r?\n)+/, "");
    normalized =
      normalized.slice(0, position + 1) +
      `\n${SAFE_BREAKPOINT}\n` +
      normalizedRemainder;
  }
  return normalized;
}

export function normalizeMigrationSource(source) {
  const splitSource = source.replaceAll(SAFE_BREAKPOINT, "--> statement-breakpoint");
  const rawParts = splitSource.split("--> statement-breakpoint");
  const existingParts = rawParts.map((part, index) => {
    let normalizedPart = part;
    if (index > 0) normalizedPart = normalizedPart.replace(/^(?:[\t ]*\r?\n)+/, "");
    if (index < rawParts.length - 1) {
      normalizedPart = normalizedPart.replace(/(?:\r?\n[\t ]*)+$/, "");
    }
    return normalizedPart;
  });
  const normalized = existingParts
    .map(insertMissingBreakpoints)
    .join(`\n${SAFE_BREAKPOINT}\n`);

  if (canonicalSqlContent(normalized) !== canonicalSqlContent(source)) {
    throw new Error("normalization changed SQL content instead of breakpoint comments only");
  }

  return normalized;
}

function main() {
  const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const migrationsFolder = path.join(repositoryRoot, "drizzle");
  const shouldWrite = process.argv.includes("--write");
  let changedFileCount = 0;

  const files = fs
    .readdirSync(migrationsFolder, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".sql"))
    .map((entry) => entry.name)
    .sort();

  for (const filename of files) {
    const filePath = path.join(migrationsFolder, filename);
    const source = fs.readFileSync(filePath, "utf8");
    let normalized;
    try {
      normalized = normalizeMigrationSource(source);
    } catch (error) {
      throw new Error(
        `${filename}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    if (source === normalized) continue;

    changedFileCount += 1;
    if (shouldWrite) fs.writeFileSync(filePath, normalized);
  }

  if (!shouldWrite && changedFileCount > 0) {
    throw new Error(
      `${changedFileCount} migration SQL files need breakpoint normalization; rerun with --write`,
    );
  }

  if (shouldWrite) {
    console.log(`Normalized ${changedFileCount} migration SQL files.`);
  }

  verifyMigrationLedger(migrationsFolder);
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
