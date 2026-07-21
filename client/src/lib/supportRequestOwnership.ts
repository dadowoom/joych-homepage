const VISIT_MANAGEMENT_STORAGE_KEY = "joych.visitRequestManagement.v1";

export type VisitManagementToken = {
  id: number;
  token: string;
};

export function getVisitManagementTokens(): VisitManagementToken[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(VISIT_MANAGEMENT_STORAGE_KEY) || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => Number.isInteger(item?.id) && item.id > 0 && typeof item?.token === "string" && item.token.length >= 32)
      .slice(-50);
  } catch {
    return [];
  }
}

export function saveVisitManagementToken(id: number, token: string) {
  if (typeof window === "undefined") return getVisitManagementTokens();
  const next = [
    ...getVisitManagementTokens().filter((item) => item.id !== id),
    { id, token },
  ].slice(-50);
  window.localStorage.setItem(VISIT_MANAGEMENT_STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function removeVisitManagementToken(id: number) {
  if (typeof window === "undefined") return getVisitManagementTokens();
  const next = getVisitManagementTokens().filter((item) => item.id !== id);
  window.localStorage.setItem(VISIT_MANAGEMENT_STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function findVisitManagementToken(tokens: VisitManagementToken[], id: number) {
  return tokens.find((item) => item.id === id)?.token;
}
