import { hasAdminContentPermission } from "./adminPermissions";

type PermissionUser = {
  role?: string | null;
  contentPermissions?: string[] | null;
} | null | undefined;

export type SecretPostViewer = {
  user?: PermissionUser;
  memberId?: number | null;
};

export const SECRET_POST_MASK_TITLE = "비밀글입니다.";
export const SECRET_POST_MASK_CONTENT = "";

export function canViewSecretPost(
  viewer: SecretPostViewer | undefined,
  permissionKey: string,
  authorMemberId?: number | null,
) {
  if (authorMemberId && viewer?.memberId === authorMemberId) {
    return true;
  }

  return hasAdminContentPermission(
    (viewer?.user ?? null) as Parameters<typeof hasAdminContentPermission>[0],
    permissionKey,
  );
}

export function isSecretPostHidden(
  isSecret: boolean,
  viewer: SecretPostViewer | undefined,
  permissionKey: string,
  authorMemberId?: number | null,
) {
  if (!isSecret) return false;
  return !canViewSecretPost(viewer, permissionKey, authorMemberId);
}
