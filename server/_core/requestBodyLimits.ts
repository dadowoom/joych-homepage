export const MB = 1024 * 1024;

/** Ordinary JSON, including every single-file upload capped at 1MB. */
export const STANDARD_BODY_LIMIT_BYTES = 5 * MB;
/** 10MB page images and a bulletin containing up to twelve 1MB pages. */
export const CONTENT_UPLOAD_BODY_LIMIT_BYTES = 20 * MB;
/** A 100MB video expands to roughly 134MB when encoded as base64. */
export const VIDEO_UPLOAD_BODY_LIMIT_BYTES = 150 * MB;

export type BodyLimitPrincipal = {
  role?: string | null;
  contentPermissions?: readonly string[];
} | null;

type LargeBodyRule = {
  limit: number;
  permission: "admin" | `content:${string}`;
};

/**
 * Keep this list limited to procedures whose validated input can genuinely
 * exceed the standard 5MB JSON allowance. All other image/attachment routes
 * validate files at 1MB and intentionally stay on the standard parser.
 */
const LARGE_BODY_RULES = new Map<string, LargeBodyRule>([
  [
    "cms.upload.video",
    { limit: VIDEO_UPLOAD_BODY_LIMIT_BYTES, permission: "admin" },
  ],
  [
    "cms.upload.pageImage",
    { limit: CONTENT_UPLOAD_BODY_LIMIT_BYTES, permission: "admin" },
  ],
  [
    "cms.blocks.uploadImage",
    { limit: CONTENT_UPLOAD_BODY_LIMIT_BYTES, permission: "admin" },
  ],
  [
    "cms.bulletins.create",
    {
      limit: CONTENT_UPLOAD_BODY_LIMIT_BYTES,
      permission: "content:bulletins",
    },
  ],
  [
    "cms.bulletins.update",
    {
      limit: CONTENT_UPLOAD_BODY_LIMIT_BYTES,
      permission: "content:bulletins",
    },
  ],
]);

function principalCanUseRule(
  principal: BodyLimitPrincipal,
  rule: LargeBodyRule,
) {
  if (!principal) return false;
  if (principal.role === "admin") return true;
  return rule.permission !== "admin"
    && principal.contentPermissions?.includes(rule.permission) === true;
}

export function getTrpcProcedurePaths(requestUrl: string) {
  const rawPath = requestUrl.split("?", 1)[0] ?? "";
  const marker = "/api/trpc/";
  const markerIndex = rawPath.indexOf(marker);
  if (markerIndex < 0) return [];

  let procedurePath = rawPath.slice(markerIndex + marker.length);
  try {
    procedurePath = decodeURIComponent(procedurePath);
  } catch {
    return [];
  }

  return procedurePath
    .split(",")
    .map(path => path.trim())
    .filter(Boolean);
}

export function isTrpcLargeBodyRequestUrl(requestUrl: string) {
  return getTrpcProcedurePaths(requestUrl).some(path =>
    LARGE_BODY_RULES.has(path)
  );
}

/**
 * For a tRPC batch, use the largest tier the current principal is actually
 * allowed to call. An unauthorized large route never raises the batch limit.
 */
export function getTrpcBodyLimitBytes(
  requestUrl: string,
  principal: BodyLimitPrincipal,
) {
  return getTrpcProcedurePaths(requestUrl).reduce((limit, path) => {
    const rule = LARGE_BODY_RULES.get(path);
    if (!rule || !principalCanUseRule(principal, rule)) return limit;
    return Math.max(limit, rule.limit);
  }, STANDARD_BODY_LIMIT_BYTES);
}
