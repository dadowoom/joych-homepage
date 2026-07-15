import { asc, eq, inArray, like, or, sql, type SQL } from "drizzle-orm";
import {
  ADMIN_TAB_PERMISSION_KEYS,
  STATIC_ADMIN_PERMISSIONS,
} from "@shared/adminPermissions";
import {
  adminContentPermissions,
  churchMembers,
  users,
  type ChurchMember,
  type User,
} from "../../drizzle/schema";
import { getDb } from "./connection";

const MEMBER_ADMIN_OPEN_ID_PREFIX = "member:";

function getActiveAdminPermissionKeySet() {
  return new Set(STATIC_ADMIN_PERMISSIONS.map((definition) => definition.key));
}

function filterActiveAdminPermissionKeys(permissionKeys: string[]) {
  const activeKeys = getActiveAdminPermissionKeySet();
  return permissionKeys.filter((key) => activeKeys.has(key));
}

export function memberAdminOpenId(memberId: number) {
  return `${MEMBER_ADMIN_OPEN_ID_PREFIX}${memberId}`;
}

export function hasAdminContentPermission(
  user: (User & { contentPermissions?: string[] }) | null | undefined,
  permissionKey: string,
) {
  if (!user) return false;
  if (user.role === "admin") return true;
  return user.contentPermissions?.includes(permissionKey) ?? false;
}

export function getAdminTabPermissionKey(tab: string) {
  return ADMIN_TAB_PERMISSION_KEYS[tab];
}

export async function getAdminPermissionKeysForUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({ permissionKey: adminContentPermissions.permissionKey })
    .from(adminContentPermissions)
    .where(eq(adminContentPermissions.userId, userId))
    .orderBy(asc(adminContentPermissions.permissionKey));
  return filterActiveAdminPermissionKeys(rows.map((row) => row.permissionKey));
}

export async function getAllAdminPermissionDefinitions() {
  return STATIC_ADMIN_PERMISSIONS;
}

export async function getMemberAdminPermissionAssignments(searchTerm = "") {
  const db = await getDb();
  if (!db) return [];

  const keyword = searchTerm.trim();
  if (!keyword) return [];

  const likeKeyword = `%${keyword}%`;
  const normalizedPhoneKeyword = keyword.replace(/\D/g, "");
  const searchConditions: SQL[] = [
    like(churchMembers.name, likeKeyword),
    like(churchMembers.email, likeKeyword),
    like(churchMembers.phone, likeKeyword),
    like(churchMembers.position, likeKeyword),
    like(churchMembers.department, likeKeyword),
    like(churchMembers.district, likeKeyword),
  ];

  if (normalizedPhoneKeyword) {
    searchConditions.push(
      sql`REPLACE(${churchMembers.phone}, '-', '') LIKE ${`%${normalizedPhoneKeyword}%`}`,
    );
  }

  const members = await db
    .select()
    .from(churchMembers)
    .where(or(...searchConditions))
    .orderBy(asc(churchMembers.name), asc(churchMembers.id));
  const openIds = members.map((member) => memberAdminOpenId(member.id));

  const linkedUsers = openIds.length
    ? await db.select().from(users).where(inArray(users.openId, openIds))
    : [];
  const userByOpenId = new Map(linkedUsers.map((user) => [user.openId, user]));
  const userIds = linkedUsers.map((user) => user.id);

  const permissionRows = userIds.length
    ? await db
        .select()
        .from(adminContentPermissions)
        .where(inArray(adminContentPermissions.userId, userIds))
    : [];
  const permissionKeysByUserId = new Map<number, string[]>();
  const activePermissionKeys = getActiveAdminPermissionKeySet();
  for (const permission of permissionRows) {
    if (permission.userId === null) continue;
    if (!activePermissionKeys.has(permission.permissionKey)) continue;
    const list = permissionKeysByUserId.get(permission.userId) ?? [];
    list.push(permission.permissionKey);
    permissionKeysByUserId.set(permission.userId, list);
  }

  return members.map((member) => {
    const linkedUser = userByOpenId.get(memberAdminOpenId(member.id));
    return {
      memberId: member.id,
      userId: linkedUser?.id ?? null,
      name: member.name,
      email: member.email,
      phone: member.phone,
      status: member.status,
      position: member.position,
      department: member.department,
      permissionKeys: linkedUser ? (permissionKeysByUserId.get(linkedUser.id) ?? []) : [],
    };
  });
}

export async function getAssignedMemberAdminPermissionAssignments() {
  const db = await getDb();
  if (!db) return [];

  const activePermissionKeys = getActiveAdminPermissionKeySet();
  const permissionRows = await db
    .select({
      userId: adminContentPermissions.userId,
      permissionKey: adminContentPermissions.permissionKey,
    })
    .from(adminContentPermissions);
  const permissionKeysByUserId = new Map<number, string[]>();
  for (const permission of permissionRows) {
    if (permission.userId === null || !activePermissionKeys.has(permission.permissionKey)) continue;
    const list = permissionKeysByUserId.get(permission.userId) ?? [];
    list.push(permission.permissionKey);
    permissionKeysByUserId.set(permission.userId, list);
  }

  const userIds = Array.from(permissionKeysByUserId.keys());
  if (userIds.length === 0) return [];

  const linkedUsers = await db.select().from(users).where(inArray(users.id, userIds));
  const memberIdByUserId = new Map<number, number>();
  for (const user of linkedUsers) {
    if (!user.openId.startsWith(MEMBER_ADMIN_OPEN_ID_PREFIX)) continue;
    const memberId = Number.parseInt(user.openId.slice(MEMBER_ADMIN_OPEN_ID_PREFIX.length), 10);
    if (Number.isSafeInteger(memberId) && memberId > 0) memberIdByUserId.set(user.id, memberId);
  }

  const memberIds = Array.from(new Set(memberIdByUserId.values()));
  if (memberIds.length === 0) return [];

  const members = await db.select().from(churchMembers).where(inArray(churchMembers.id, memberIds));
  const memberById = new Map(members.map((member) => [member.id, member]));

  return Array.from(memberIdByUserId.entries())
    .map(([userId, memberId]) => {
      const member = memberById.get(memberId);
      if (!member) return null;
      return {
        memberId: member.id,
        userId,
        name: member.name,
        email: member.email,
        phone: member.phone,
        status: member.status,
        position: member.position,
        department: member.department,
        permissionKeys: permissionKeysByUserId.get(userId) ?? [],
      };
    })
    .filter((member): member is NonNullable<typeof member> => member !== null)
    .sort((left, right) => left.name.localeCompare(right.name, "ko") || left.memberId - right.memberId);
}

async function getMemberForPermissionAssignment(memberId: number): Promise<ChurchMember | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(churchMembers).where(eq(churchMembers.id, memberId)).limit(1);
  return rows[0] ?? null;
}

export async function ensureMemberAdminUser(member: ChurchMember) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const openId = memberAdminOpenId(member.id);
  await db.insert(users).values({
    openId,
    name: member.name,
    email: member.email,
    loginMethod: "member-admin",
    role: "user",
  }).onDuplicateKeyUpdate({
    set: {
      name: member.name,
      email: member.email,
      loginMethod: "member-admin",
      updatedAt: new Date(),
    },
  });

  const rows = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  const user = rows[0];
  if (!user) throw new Error("Failed to create permission user");
  return user;
}

export async function setMemberAdminPermissions(memberId: number, permissionKeys: string[]) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const member = await getMemberForPermissionAssignment(memberId);
  if (!member) throw new Error("Member not found");

  const definitions = await getAllAdminPermissionDefinitions();
  const validKeys = new Set(definitions.map((definition) => definition.key));
  const uniquePermissionKeys = Array.from(new Set(permissionKeys)).filter((key) => validKeys.has(key));
  const user = await ensureMemberAdminUser(member);

  await db
    .delete(adminContentPermissions)
    .where(eq(adminContentPermissions.userId, user.id));

  if (uniquePermissionKeys.length > 0) {
    await db.insert(adminContentPermissions).values(
      uniquePermissionKeys.map((permissionKey) => ({
        userId: user.id,
        permissionKey,
      })),
    );
  }

  return {
    memberId,
    userId: user.id,
    permissionKeys: uniquePermissionKeys,
  };
}
