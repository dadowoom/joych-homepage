import {
  getAcademyCoursePath,
  getCanonicalPublicMenuPath,
  PUBLIC_MENU_PATHS,
} from "@shared/publicMenuRoutes";

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

export const COURSE_ROOT_HREF = PUBLIC_MENU_PATHS.academy;

const FIXED_COURSE_MENU_HREFS: Record<string, string> = {
  "조이아카데미": PUBLIC_MENU_PATHS.academy,
  "제자반": PUBLIC_MENU_PATHS.discipleCourse,
  "리더십반": PUBLIC_MENU_PATHS.leadershipCourse,
  "생선컨퍼런스": PUBLIC_MENU_PATHS.saengseonConference,
};

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

function normalizeComparableHref(path: string | null | undefined) {
  return normalizeHref(getCanonicalPublicMenuPath(path) ?? path);
}

export function isCourseTopMenuLabel(label: string | null | undefined) {
  const normalized = normalizeLabel(label);
  return normalized === "강좌" || normalized === "교육·신청";
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
  const normalizedLabel = normalizeLabel(label);
  const fixedMenuHref = FIXED_COURSE_MENU_HREFS[normalizedLabel];
  if (fixedMenuHref) return fixedMenuHref;

  const slug = getCourseRoomSlug(label, href);
  if (!slug) {
    return COURSE_ROOT_HREF;
  }
  return getAcademyCoursePath(slug);
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
  const normalizedHref = normalizeComparableHref(href);
  const courseMenu = (menus ?? []).find((menu) => isCourseTopMenuLabel(menu.label));
  if (!courseMenu) return false;
  return (courseMenu.items ?? []).some(
    (item) => normalizeComparableHref(item.href) === normalizedHref,
  );
}
