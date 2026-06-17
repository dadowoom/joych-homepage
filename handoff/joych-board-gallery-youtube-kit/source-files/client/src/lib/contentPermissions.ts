type ContentUser = {
  role?: string | null;
} | null | undefined;

export function canManageBoardContent(user: ContentUser) {
  return user?.role === "admin";
}

export function canManageFullAdmin(user: ContentUser) {
  return user?.role === "admin";
}
