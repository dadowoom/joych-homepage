export type NoticeCategoryConfig = {
  label: string;
  isVisible: boolean;
};

export const NOTICE_CATEGORY_SETTINGS_KEY = "notice_categories";
export const NOTICE_BOARD_DESCRIPTION_KEY = "notice_board_description";
export const NOTICE_ALL_CATEGORY_LABEL = "전체";
export const DEFAULT_NOTICE_CATEGORY_LABEL = "공지";
export const ADMIN_RESOURCE_CATEGORY = "행정자료";

export const DEFAULT_NOTICE_CATEGORY_SETTINGS: NoticeCategoryConfig[] = [
  { label: NOTICE_ALL_CATEGORY_LABEL, isVisible: true },
  { label: DEFAULT_NOTICE_CATEGORY_LABEL, isVisible: true },
  { label: "부고", isVisible: true },
  { label: "결혼", isVisible: true },
];

export function cleanNoticeCategoryLabel(value: unknown) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

export function sanitizeNoticePostCategory(category?: string | null, fallback = DEFAULT_NOTICE_CATEGORY_LABEL) {
  const value = cleanNoticeCategoryLabel(category);
  if (!value || value === NOTICE_ALL_CATEGORY_LABEL || value === ADMIN_RESOURCE_CATEGORY) return fallback;
  return value;
}

export function normalizeNoticeCategorySettings(categories: NoticeCategoryConfig[]) {
  const seen = new Set<string>();
  const normalized: NoticeCategoryConfig[] = [];

  for (const category of categories) {
    const label = cleanNoticeCategoryLabel(category.label);
    if (!label || label === ADMIN_RESOURCE_CATEGORY || seen.has(label)) continue;
    seen.add(label);
    normalized.push({ label, isVisible: Boolean(category.isVisible) });
  }

  return normalized.length > 0 ? normalized : [...DEFAULT_NOTICE_CATEGORY_SETTINGS];
}

export function parseNoticeCategorySettings(value?: string | null) {
  if (!value) return [...DEFAULT_NOTICE_CATEGORY_SETTINGS];

  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [...DEFAULT_NOTICE_CATEGORY_SETTINGS];

    const categories = parsed.map((item): NoticeCategoryConfig | null => {
      if (typeof item === "string") return { label: item, isVisible: true };
      if (!item || typeof item !== "object") return null;
      const label = cleanNoticeCategoryLabel((item as { label?: unknown }).label);
      if (!label) return null;
      return {
        label,
        isVisible: (item as { isVisible?: unknown }).isVisible !== false,
      };
    }).filter((item): item is NoticeCategoryConfig => Boolean(item));

    return normalizeNoticeCategorySettings(categories);
  } catch {
    return [...DEFAULT_NOTICE_CATEGORY_SETTINGS];
  }
}

export function getVisibleNoticeFilterCategoryLabels(categories: NoticeCategoryConfig[]) {
  const visible = categories.filter((category) => category.isVisible).map((category) => category.label);
  return visible.length > 0 ? visible : [NOTICE_ALL_CATEGORY_LABEL];
}

export function getNoticeWriteCategoryLabels(categories: NoticeCategoryConfig[]) {
  const labels = categories
    .filter((category) => category.label !== NOTICE_ALL_CATEGORY_LABEL)
    .map((category) => category.label);
  return labels.length > 0 ? labels : [DEFAULT_NOTICE_CATEGORY_LABEL];
}
