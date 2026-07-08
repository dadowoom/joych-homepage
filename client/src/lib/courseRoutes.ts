type CourseMenuSubItem = {
  id: number;
  label: string;
  href?: string | null;
};

type CourseMenuItem = CourseMenuSubItem & {
  subItems?: CourseMenuSubItem[];
};

type CourseMenu = {
  id: number;
  label: string;
  href?: string | null;
  items?: CourseMenuItem[];
};

export const COURSE_ROOT_HREF = "/education/courses";

function normalizeLabel(value: string | null | undefined) {
  return (value ?? "").replace(/\s+/g, "").trim();
}

function decodePath(path: string) {
  try {
    return decodeURIComponent(path);
  } catch {
    return path;
  }
}

function normalizeHref(path: string | null | undefined) {
  return decodePath(path ?? "").trim();
}

export function isCourseTopMenuLabel(label: string | null | undefined) {
  return normalizeLabel(label) === "강좌";
}

export function isCourseLegacyHref(href: string | null | undefined) {
  return normalizeHref(href).startsWith("/page/강좌-");
}

export function getCourseRoomSlug(label: string | null | undefined, href?: string | null) {
  const normalizedHref = normalizeHref(href);
  if (normalizedHref.startsWith("/page/강좌-")) {
    return normalizedHref.slice("/page/강좌-".length);
  }
  return (label ?? "").trim().replace(/\s+/g, "-");
}

export function getCanonicalCourseHref(label: string | null | undefined, href?: string | null) {
  const slug = getCourseRoomSlug(label, href);
  if (!slug || normalizeLabel(label) === "조이아카데미") {
    return COURSE_ROOT_HREF;
  }
  return `${COURSE_ROOT_HREF}/${encodeURIComponent(slug)}`;
}

export function findCourseRoomBySlug(
  menus: CourseMenu[] | undefined,
  slug: string,
): { label: string; href: string | null } | null {
  const decodedSlug = decodePath(slug).trim();
  if (!decodedSlug) return null;

  const courseMenu = (menus ?? []).find((menu) => isCourseTopMenuLabel(menu.label));
  if (!courseMenu) return null;

  const candidates = courseMenu.items ?? [];
  for (const item of candidates) {
    const itemSlug = getCourseRoomSlug(item.label, item.href);
    if (decodePath(itemSlug) === decodedSlug) {
      return { label: item.label, href: item.href ?? null };
    }
  }

  return null;
}

export function isCourseMenuItemWithinTopMenu(
  menus: CourseMenu[] | undefined,
  href: string | null | undefined,
) {
  const normalizedHref = normalizeHref(href);
  const courseMenu = (menus ?? []).find((menu) => isCourseTopMenuLabel(menu.label));
  if (!courseMenu) return false;
  return (courseMenu.items ?? []).some((item) => normalizeHref(item.href) === normalizedHref);
}
