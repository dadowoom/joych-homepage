export const ADMIN_DASHBOARD_HREF = "/admin_joych_2026";

type ManagementUser = {
  role?: string | null;
  contentPermissions?: string[] | null;
} | null | undefined;

function addManagementMode(href: string) {
  return `${href}${href.includes("?") ? "&" : "?"}manage=1`;
}

export function getManagementPageHref(
  user: ManagementUser,
  courseRoomPageHrefs: string[] | null | undefined,
) {
  if (user?.role === "admin" || (user?.contentPermissions?.length ?? 0) > 0) {
    return ADMIN_DASHBOARD_HREF;
  }

  const courseRoomPageHref = courseRoomPageHrefs?.find(
    href => href.startsWith("/") && !href.startsWith("//"),
  );
  return courseRoomPageHref ? addManagementMode(courseRoomPageHref) : null;
}
