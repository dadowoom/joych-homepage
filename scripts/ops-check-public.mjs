import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_READINESS_URL = "https://www.joych.org/api/readyz";
const DEFAULT_TIMEOUT_MS = 10_000;
const MAX_RESPONSE_BYTES = 4_096;

function parsePositiveInteger(value, label, defaultValue) {
  const raw = value === undefined || value === "" ? defaultValue : value;
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`${label} must be a positive integer.`);
  }
  return parsed;
}

export function parseReadinessUrl(value = DEFAULT_READINESS_URL) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Readiness URL is invalid.");
  }

  if (url.protocol !== "https:") {
    throw new Error("Readiness URL must use HTTPS.");
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error(
      "Readiness URL must not contain credentials, a query, or a fragment."
    );
  }

  return url;
}

export function validateReadinessPayload(payload) {
  if (
    typeof payload !== "object" ||
    payload === null ||
    payload.ok !== true ||
    typeof payload.checks !== "object" ||
    payload.checks === null ||
    payload.checks.database !== "ok"
  ) {
    throw new Error(
      "Readiness response did not confirm database availability."
    );
  }
}

export async function checkPublicReadiness({
  url = process.env.JOYCH_PUBLIC_READINESS_URL || DEFAULT_READINESS_URL,
  timeoutMs = process.env.JOYCH_OPS_HTTP_TIMEOUT_MS,
  fetchImpl = globalThis.fetch,
} = {}) {
  const readinessUrl = parseReadinessUrl(url);
  const safeTimeoutMs = parsePositiveInteger(
    timeoutMs,
    "JOYCH_OPS_HTTP_TIMEOUT_MS",
    DEFAULT_TIMEOUT_MS
  );

  let response;
  try {
    response = await fetchImpl(readinessUrl, {
      headers: { accept: "application/json" },
      redirect: "error",
      signal: AbortSignal.timeout(safeTimeoutMs),
    });
  } catch {
    throw new Error("Public readiness request failed.");
  }

  if (!response.ok || response.status !== 200) {
    throw new Error(`Public readiness returned HTTP ${response.status}.`);
  }

  let text;
  try {
    text = await response.text();
  } catch {
    throw new Error("Public readiness response could not be read.");
  }
  if (Buffer.byteLength(text, "utf8") > MAX_RESPONSE_BYTES) {
    throw new Error("Public readiness response was unexpectedly large.");
  }

  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error("Public readiness response was not valid JSON.");
  }
  validateReadinessPayload(payload);

  return {
    checkedAt: new Date().toISOString(),
    endpoint: `${readinessUrl.origin}${readinessUrl.pathname}`,
  };
}

async function main() {
  try {
    const result = await checkPublicReadiness();
    console.log(
      `[ops] public readiness: OK endpoint=${result.endpoint} checkedAt=${result.checkedAt}`
    );
  } catch (error) {
    console.error(`[ops] public readiness: FAIL ${error.message}`);
    process.exitCode = 1;
  }
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invokedPath && invokedPath === fileURLToPath(import.meta.url)) {
  await main();
}
