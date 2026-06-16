import { ADMIN_TAB_PERMISSION_KEYS } from "@shared/adminPermissions";

type ContentUser = {
  role?: string | null;
  contentPermissions?: string[] | null;
} | null | undefined;

export function hasContentPermission(user: ContentUser, permissionKey: string) {
  if (!user) return false;
  if (user.role === "admin") return true;
  return user.contentPermissions?.includes(permissionKey) ?? false;
}

export function canManageBoardContent(user: ContentUser, permissionKey = "content:gallery") {
  return hasContentPermission(user, permissionKey);
}

export function canManageFullAdmin(user: ContentUser) {
  return user?.role === "admin";
}

export function canManageAnyContent(user: ContentUser) {
  return user?.role === "admin" || Boolean(user?.contentPermissions?.length);
}

export function canManageAdminTab(user: ContentUser, tab: string) {
  if (user?.role === "admin") return true;
  const permissionKey = ADMIN_TAB_PERMISSION_KEYS[tab];
  return permissionKey ? hasContentPermission(user, permissionKey) : false;
}
