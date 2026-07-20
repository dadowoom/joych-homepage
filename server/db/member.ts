/**
 * 교회 회원(교적부) DB 함수 (server/db/member.ts)
 * ─────────────────────────────────────────────────────────────────────────────
 * 담당 기능:
 *   - 선택지 관리: getMemberFieldOptions, getAllMemberFieldOptions,
 *                 createMemberFieldOption, updateMemberFieldOption, deleteMemberFieldOption
 *   - 성도 조회: getMemberByEmail, getMemberById, getAllMembers, getPendingMembers
 *   - 성도 등록/수정: createMember, updateMemberBasicInfo, updateMemberChurchInfo
 *   - 관리자 전용: adminUpdateMember, adminResetMemberPassword
 */

import { and, eq, asc, desc, gte, inArray, sql } from "drizzle-orm";
import type { ResultSetHeader } from "mysql2";
import { normalizeLegacyMemberPhone, normalizeMemberPhone } from "@shared/memberPhone";
import {
  bulletinAdRequests,
  churchMembers,
  courseApplications,
  freeBoardPosts,
  memberDistricts,
  memberFieldOptions,
  memberPasswordResetRequests,
  memberSocialAccounts,
  missionReportAuthors,
  missionReports,
  reservations,
  schoolPosts,
  subtitleRequests,
  testimonyComments,
  testimonyPosts,
} from "../../drizzle/schema";
import { getDb } from "./connection";

export type MemberSocialProvider = "google" | "kakao";

type MemberAlertSummaryItem = {
  id: number;
  name: string;
  position: string | null;
  department: string | null;
  district: string | null;
  birthDate?: string | null;
  registeredAt?: string | null;
  createdAt?: Date | null;
  effectiveRegisteredAt?: string | null;
  status: string;
};

function getKstTodayParts() {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value ?? "";
  const month = parts.find((part) => part.type === "month")?.value ?? "";
  const day = parts.find((part) => part.type === "day")?.value ?? "";
  return {
    today: `${year}-${month}-${day}`,
    monthDay: `${month}-${day}`,
  };
}

function extractMonthDay(value: string | null | undefined) {
  const raw = value?.trim();
  if (!raw) return null;

  const dashed = raw.match(/^(\d{4})[-/.](\d{2})[-/.](\d{2})$/);
  if (dashed) return `${dashed[2]}-${dashed[3]}`;

  const shortDashed = raw.match(/^(\d{2})[-/.](\d{2})$/);
  if (shortDashed) return `${shortDashed[1]}-${shortDashed[2]}`;

  const compactLong = raw.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (compactLong) return `${compactLong[2]}-${compactLong[3]}`;

  const compactShort = raw.match(/^(\d{2})(\d{2})$/);
  if (compactShort) return `${compactShort[1]}-${compactShort[2]}`;

  return null;
}

function normalizeDateKey(value: string | Date | null | undefined) {
  if (!value) return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  const raw = value.trim();
  if (!raw) return null;

  const dashed = raw.match(/^(\d{4})[-/.](\d{2})[-/.](\d{2})$/);
  if (dashed) return `${dashed[1]}-${dashed[2]}-${dashed[3]}`;

  const compact = raw.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (compact) return `${compact[1]}-${compact[2]}-${compact[3]}`;

  return null;
}

function getRecentWindowStart(days: number) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - (days - 1));
  return date;
}

function formatIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function toSummaryItem(member: {
  id: number;
  name: string;
  position: string | null;
  department: string | null;
  district: string | null;
  birthDate?: string | null;
  registeredAt?: string | null;
  createdAt?: Date | null;
  status: string;
}): MemberAlertSummaryItem {
  return {
    id: member.id,
    name: member.name,
    position: member.position ?? null,
    department: member.department ?? null,
    district: member.district ?? null,
    birthDate: member.birthDate ?? null,
    registeredAt: member.registeredAt ?? null,
    createdAt: member.createdAt ?? null,
    effectiveRegisteredAt: normalizeDateKey(member.registeredAt) ?? normalizeDateKey(member.createdAt),
    status: member.status,
  };
}

// ─── 선택지 관리 (직분, 부서, 구역 등 드롭다운 옵션) ─────────────────────────

/** 선택지 목록 조회 (fieldType별, 활성만) */
export async function getMemberFieldOptions(fieldType?: string) {
  const db = await getDb();
  if (!db) return [];
  if (fieldType) {
    return db.select().from(memberFieldOptions)
      .where(and(
        eq(memberFieldOptions.fieldType, fieldType),
        eq(memberFieldOptions.isActive, true),
      ))
      .orderBy(asc(memberFieldOptions.sortOrder));
  }
  return db.select().from(memberFieldOptions)
    .where(eq(memberFieldOptions.isActive, true))
    .orderBy(asc(memberFieldOptions.fieldType), asc(memberFieldOptions.sortOrder));
}

/** 선택지 전체 조회 (관리자용 - 비활성 포함) */
export async function getAllMemberFieldOptions() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(memberFieldOptions)
    .orderBy(asc(memberFieldOptions.fieldType), asc(memberFieldOptions.sortOrder));
}

/** 선택지 추가 */
export async function createMemberFieldOption(data: { fieldType: string; label: string; sortOrder?: number }) {
  const db = await getDb();
  if (!db) throw new Error('DB not available');
  const [result] = await db.insert(memberFieldOptions).values({
    fieldType: data.fieldType,
    label: data.label,
    sortOrder: data.sortOrder ?? 0,
  });
  return (result as ResultSetHeader).insertId;
}

/** 선택지 수정 */
export async function updateMemberFieldOption(id: number, data: Partial<{ label: string; sortOrder: number; isActive: boolean }>) {
  const db = await getDb();
  if (!db) throw new Error('DB not available');
  await db.update(memberFieldOptions).set(data).where(eq(memberFieldOptions.id, id));
}

/** 선택지 순서 일괄 수정 */
export async function reorderMemberFieldOptions(items: { id: number; sortOrder: number }[]) {
  const db = await getDb();
  if (!db) throw new Error('DB not available');
  if (items.length === 0) return;

  await Promise.all(
    items.map((item) =>
      db.update(memberFieldOptions)
        .set({ sortOrder: item.sortOrder })
        .where(eq(memberFieldOptions.id, item.id))
    )
  );
}

/** 선택지 삭제 */
export async function deleteMemberFieldOption(id: number) {
  const db = await getDb();
  if (!db) throw new Error('DB not available');
  await db.delete(memberFieldOptions).where(eq(memberFieldOptions.id, id));
}

// ─── 성도 조회 ────────────────────────────────────────────────────────────────

/** 이메일로 성도 조회 */
export async function getMemberByEmail(email: string) {
  const db = await getDb();
  if (!db) return null;
  const normalizedEmail = email.trim().toLowerCase();
  const rows = await db.select().from(churchMembers).where(eq(churchMembers.email, normalizedEmail)).limit(1);
  return rows[0] ?? null;
}

/** ID로 성도 조회 */
export async function getMemberById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(churchMembers).where(eq(churchMembers.id, id)).limit(1);
  return rows[0] ?? null;
}

/**
 * 이름과 연락처가 모두 같은 기존 가입 정보를 조회합니다.
 * 신규 표준 번호뿐 아니라 안전하게 변환할 수 있는 기존 +82 번호도 같은 번호로 봅니다.
 */
export async function getMembersByNameAndPhone(name: string, phone: string) {
  const db = await getDb();
  if (!db) return [];

  const normalizedName = name.trim();
  const normalizedPhone = normalizeMemberPhone(phone);
  if (!normalizedName || !normalizedPhone) return [];

  const rows = await db
    .select()
    .from(churchMembers)
    .where(eq(churchMembers.name, normalizedName))
    .orderBy(desc(churchMembers.createdAt));

  return rows.filter((member) =>
    member.status !== "withdrawn" &&
    normalizeLegacyMemberPhone(member.phone) === normalizedPhone
  );
}

/** 소셜 제공자 계정으로 성도 연결 정보 조회 */
export async function getMemberSocialAccount(provider: MemberSocialProvider, providerUserId: string) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(memberSocialAccounts)
    .where(and(
      eq(memberSocialAccounts.provider, provider),
      eq(memberSocialAccounts.providerUserId, providerUserId),
    ))
    .limit(1);
  return rows[0] ?? null;
}

/** 성도별 소셜 제공자 연결 정보 조회 */
export async function getMemberSocialAccountByMember(provider: MemberSocialProvider, memberId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(memberSocialAccounts)
    .where(and(
      eq(memberSocialAccounts.provider, provider),
      eq(memberSocialAccounts.memberId, memberId),
    ))
    .limit(1);
  return rows[0] ?? null;
}

/** 계정 찾기 화면에 표시할 간편가입 제공자 목록 */
export async function getMemberSocialProviders(memberIds: number[]) {
  const db = await getDb();
  if (!db || memberIds.length === 0) return [];

  return db
    .select({
      memberId: memberSocialAccounts.memberId,
      provider: memberSocialAccounts.provider,
    })
    .from(memberSocialAccounts)
    .where(inArray(memberSocialAccounts.memberId, memberIds));
}

/** 전체 성도 목록 조회 (관리자용) */
export async function getAllMembers() {
  const db = await getDb();
  if (!db) return [];
  const members = await db.select().from(churchMembers).orderBy(desc(churchMembers.createdAt));
  if (members.length === 0) return [];

  const assignments = await db
    .select({
      memberId: memberDistricts.memberId,
      district: memberDistricts.district,
    })
    .from(memberDistricts)
    .orderBy(asc(memberDistricts.district));
  const districtsByMemberId = new Map<number, string[]>();
  for (const assignment of assignments) {
    const list = districtsByMemberId.get(assignment.memberId) ?? [];
    list.push(assignment.district);
    districtsByMemberId.set(assignment.memberId, list);
  }

  return members.map((member) => ({
    ...member,
    assignedDistricts: districtsByMemberId.get(member.id) ?? [],
  }));
}

/** 승인 대기 성도 목록 */
export async function getPendingMembers() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(churchMembers)
    .where(eq(churchMembers.status, 'pending'))
    .orderBy(desc(churchMembers.createdAt));
}

const MEMBER_PASSWORD_RESET_REQUEST_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * 같은 성도의 동시 요청을 DB 행 잠금으로 직렬화합니다.
 * 24시간 안의 대기 요청은 재사용하고, 오래된 요청은 취소 후 새로 생성합니다.
 */
export async function createMemberPasswordResetRequest(memberId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT id FROM church_members WHERE id = ${memberId} FOR UPDATE`);

    const existing = await tx
      .select({
        id: memberPasswordResetRequests.id,
        status: memberPasswordResetRequests.status,
        requestedAt: memberPasswordResetRequests.requestedAt,
      })
      .from(memberPasswordResetRequests)
      .where(and(
        eq(memberPasswordResetRequests.memberId, memberId),
        inArray(memberPasswordResetRequests.status, ["pending", "approved"]),
      ))
      .orderBy(desc(memberPasswordResetRequests.requestedAt))
      .limit(1);
    const cutoff = Date.now() - MEMBER_PASSWORD_RESET_REQUEST_TTL_MS;
    if (existing[0]?.status === "pending" && existing[0].requestedAt.getTime() >= cutoff) {
      return { id: existing[0].id, created: false };
    }

    if (existing[0]) {
      await tx
        .update(memberPasswordResetRequests)
        .set({ status: "cancelled", resetTokenHash: null, resolvedAt: new Date() })
        .where(eq(memberPasswordResetRequests.id, existing[0].id));
    }

    const [result] = await tx.insert(memberPasswordResetRequests).values({ memberId });
    return { id: (result as ResultSetHeader).insertId, created: true };
  });
}

/** 최고관리자 화면에 표시할 미처리 비밀번호 재설정 요청 */
export async function getPendingMemberPasswordResetRequests() {
  const db = await getDb();
  if (!db) return [];
  const cutoff = new Date(Date.now() - MEMBER_PASSWORD_RESET_REQUEST_TTL_MS);

  return db
    .select({
      id: memberPasswordResetRequests.id,
      memberId: churchMembers.id,
      name: churchMembers.name,
      email: churchMembers.email,
      phone: churchMembers.phone,
      position: churchMembers.position,
      requestedAt: memberPasswordResetRequests.requestedAt,
    })
    .from(memberPasswordResetRequests)
    .innerJoin(churchMembers, eq(memberPasswordResetRequests.memberId, churchMembers.id))
    .where(and(
      eq(memberPasswordResetRequests.status, "pending"),
      gte(memberPasswordResetRequests.requestedAt, cutoff),
    ))
    .orderBy(desc(memberPasswordResetRequests.requestedAt));
}

/**
 * 최고관리자가 등록 연락처로 본인 확인을 마친 뒤 일회용 재설정 링크를 승인합니다.
 * 토큰 원문은 저장하지 않고 SHA-256 해시만 저장합니다.
 */
export async function approveMemberPasswordResetRequest(
  requestId: number,
  approvedBy: number,
  resetTokenHash: string,
  resetTokenExpiresAt: Date,
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  return db.transaction(async (tx) => {
    await tx.execute(sql`
      SELECT id
      FROM member_password_reset_requests
      WHERE id = ${requestId} AND status = 'pending'
      FOR UPDATE
    `);

    const rows = await tx
      .select({
        id: memberPasswordResetRequests.id,
        memberId: churchMembers.id,
        name: churchMembers.name,
        phone: churchMembers.phone,
        position: churchMembers.position,
      })
      .from(memberPasswordResetRequests)
      .innerJoin(churchMembers, eq(memberPasswordResetRequests.memberId, churchMembers.id))
      .where(and(
        eq(memberPasswordResetRequests.id, requestId),
        eq(memberPasswordResetRequests.status, "pending"),
      ))
      .limit(1);
    const request = rows[0];
    if (!request) return null;

    const approvedAt = new Date();
    await tx
      .update(memberPasswordResetRequests)
      .set({
        status: "approved",
        resetTokenHash,
        resetTokenExpiresAt,
        approvedBy,
        approvedAt,
      })
      .where(eq(memberPasswordResetRequests.id, requestId));

    return { ...request, approvedAt, resetTokenExpiresAt };
  });
}

export type CompleteMemberPasswordResetResult =
  | { status: "completed"; memberId: number }
  | { status: "invalid" }
  | { status: "expired" };

/** 일회용 링크로 새 비밀번호를 저장하고 링크와 기존 로그인 세션을 폐기합니다. */
export async function completeMemberPasswordReset(
  resetTokenHash: string,
  passwordHash: string,
): Promise<CompleteMemberPasswordResetResult> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  return db.transaction(async (tx) => {
    await tx.execute(sql`
      SELECT id
      FROM member_password_reset_requests
      WHERE reset_token_hash = ${resetTokenHash} AND status = 'approved'
      FOR UPDATE
    `);

    const rows = await tx
      .select({
        id: memberPasswordResetRequests.id,
        memberId: memberPasswordResetRequests.memberId,
        resetTokenExpiresAt: memberPasswordResetRequests.resetTokenExpiresAt,
      })
      .from(memberPasswordResetRequests)
      .where(and(
        eq(memberPasswordResetRequests.resetTokenHash, resetTokenHash),
        eq(memberPasswordResetRequests.status, "approved"),
      ))
      .limit(1);
    const request = rows[0];
    if (!request) return { status: "invalid" };

    const completedAt = new Date();
    if (!request.resetTokenExpiresAt || request.resetTokenExpiresAt.getTime() <= completedAt.getTime()) {
      await tx
        .update(memberPasswordResetRequests)
        .set({
          status: "cancelled",
          resetTokenHash: null,
          resolvedAt: completedAt,
        })
        .where(eq(memberPasswordResetRequests.id, request.id));
      return { status: "expired" };
    }

    await tx
      .update(churchMembers)
      .set({
        passwordHash,
        sessionVersion: sql`${churchMembers.sessionVersion} + 1`,
        updatedAt: completedAt,
      })
      .where(eq(churchMembers.id, request.memberId));
    await tx
      .update(memberPasswordResetRequests)
      .set({
        status: "resolved",
        resetTokenHash: null,
        resolvedAt: completedAt,
      })
      .where(eq(memberPasswordResetRequests.id, request.id));

    return { status: "completed", memberId: request.memberId };
  });
}

// ─── 성도 등록/수정 ───────────────────────────────────────────────────────────

/** 성도 회원가입 */
export async function createMember(data: {
  email?: string | null;
  passwordHash?: string | null;
  name: string;
  phone: string;
  birthDate: string;
  gender: string;
  address?: string;
  emergencyPhone?: string;
  joinPath?: string;
  position?: string;
  department?: string;
  district?: string;
  faithPlusUserId?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error('DB not available');
  const [result] = await db.insert(churchMembers).values({
    ...data,
    email: data.email?.trim().toLowerCase() || null,
    status: 'pending',
  });
  return (result as ResultSetHeader).insertId;
}

/** 구글/카카오 계정을 성도 계정에 연결 */
export async function createMemberSocialAccount(data: {
  memberId: number;
  provider: MemberSocialProvider;
  providerUserId: string;
  email?: string | null;
  displayName?: string | null;
  profileImageUrl?: string | null;
}) {
  const db = await getDb();
  if (!db) throw new Error('DB not available');
  const [result] = await db.insert(memberSocialAccounts).values({
    memberId: data.memberId,
    provider: data.provider,
    providerUserId: data.providerUserId,
    email: data.email?.trim().toLowerCase() || null,
    displayName: data.displayName || null,
    profileImageUrl: data.profileImageUrl || null,
  });
  return (result as ResultSetHeader).insertId;
}

/** 성도 간편가입: 회원 생성과 소셜 계정 연결을 하나의 트랜잭션으로 처리 */
export async function createMemberWithSocialAccount(memberData: {
  email?: string | null;
  passwordHash?: string | null;
  name: string;
  phone: string;
  birthDate: string;
  gender: string;
  position?: string;
  joinPath?: string;
}, socialData: {
  provider: MemberSocialProvider;
  providerUserId: string;
  email?: string | null;
  displayName?: string | null;
  profileImageUrl?: string | null;
}) {
  const db = await getDb();
  if (!db) throw new Error('DB not available');

  return db.transaction(async (tx) => {
    const [memberResult] = await tx.insert(churchMembers).values({
      ...memberData,
      email: memberData.email?.trim().toLowerCase() || null,
      status: 'pending',
    });
    const memberId = (memberResult as ResultSetHeader).insertId;

    await tx.insert(memberSocialAccounts).values({
      memberId,
      provider: socialData.provider,
      providerUserId: socialData.providerUserId,
      email: socialData.email?.trim().toLowerCase() || null,
      displayName: socialData.displayName || null,
      profileImageUrl: socialData.profileImageUrl || null,
    });

    return memberId;
  });
}

/** 성도 기본 정보 수정 (성도 본인) */
export async function updateMemberBasicInfo(id: number, data: Partial<{
  name: string;
  phone: string;
  birthDate: string;
  gender: string;
  address: string;
  emergencyPhone: string;
  faithPlusUserId: string;
}>) {
  const db = await getDb();
  if (!db) throw new Error('DB not available');
  await db.update(churchMembers).set({ ...data, updatedAt: new Date() }).where(eq(churchMembers.id, id));
}

/** 성도 교회 정보 수정 */
export async function updateMemberChurchInfo(id: number, data: Partial<{
  position: string;
  department: string;
  district: string;
  baptismType: string;
  baptismDate: string;
  registeredAt: string;
  pastor: string;
  adminMemo: string;
  canReserveFacility: boolean;
  status: 'pending' | 'approved' | 'rejected' | 'withdrawn';
  faithPlusUserId: string;
}>) {
  const db = await getDb();
  if (!db) throw new Error('DB not available');
  await db.update(churchMembers).set({ ...data, updatedAt: new Date() }).where(eq(churchMembers.id, id));
}

/** 회원가입 승인 담당자: 아직 대기 중인 신청만 승인 또는 거절합니다. */
export async function decidePendingMemberRegistration(
  id: number,
  status: "approved" | "rejected",
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [result] = await db
    .update(churchMembers)
    .set({ status, updatedAt: new Date() })
    .where(and(eq(churchMembers.id, id), eq(churchMembers.status, "pending")));
  return (result as ResultSetHeader).affectedRows > 0;
}

/** 성도 본인 탈퇴: 개인정보 삭제/익명화 및 소셜 연결 해제 */
export async function withdrawMemberAndErasePersonalData(id: number) {
  const db = await getDb();
  if (!db) throw new Error('DB not available');

  const anonymizedName = "탈퇴 성도";
  const now = new Date();

  await db.transaction(async (tx) => {
    await tx.delete(memberDistricts).where(eq(memberDistricts.memberId, id));

    await tx.delete(memberSocialAccounts).where(eq(memberSocialAccounts.memberId, id));

    await tx.update(testimonyPosts)
      .set({ status: "deleted", updatedAt: now })
      .where(eq(testimonyPosts.authorMemberId, id));

    await tx.update(testimonyComments)
      .set({ status: "deleted", updatedAt: now })
      .where(eq(testimonyComments.authorMemberId, id));

    await tx.update(missionReports)
      .set({ authorMemberId: null, updatedAt: now })
      .where(eq(missionReports.authorMemberId, id));

    await tx.update(missionReportAuthors)
      .set({ canWrite: false, updatedAt: now })
      .where(eq(missionReportAuthors.memberId, id));

    await tx.update(schoolPosts)
      .set({ memberId: null, authorName: anonymizedName, updatedAt: now })
      .where(eq(schoolPosts.memberId, id));

    await tx.update(reservations)
      .set({ reserverName: anonymizedName, reserverPhone: null, updatedAt: now })
      .where(eq(reservations.userId, id));

    await tx.update(churchMembers)
      .set({
        email: null,
        passwordHash: null,
        name: anonymizedName,
        phone: null,
        birthDate: null,
        gender: null,
        address: null,
        emergencyPhone: null,
        joinPath: null,
        position: null,
        department: null,
        district: null,
        baptismType: null,
        baptismDate: null,
        registeredAt: null,
        pastor: null,
        adminMemo: null,
        canReserveFacility: false,
        status: "withdrawn",
        faithPlusUserId: null,
        updatedAt: now,
      })
      .where(eq(churchMembers.id, id));
  });
}

// ─── 관리자 전용 ──────────────────────────────────────────────────────────────

export type AdminHardDeleteMemberResult =
  | { deleted: true }
  | {
      deleted: false;
      reason: "not_found" | "not_withdrawn" | "has_related_records";
      related?: string[];
    };

/** 관리자: 탈퇴 상태이며 연결 기록이 없는 성도만 완전삭제 */
export async function adminHardDeleteMember(id: number): Promise<AdminHardDeleteMemberResult> {
  const db = await getDb();
  if (!db) throw new Error('DB not available');

  return db.transaction(async (tx) => {
    const [member] = await tx
      .select({ id: churchMembers.id, status: churchMembers.status })
      .from(churchMembers)
      .where(eq(churchMembers.id, id))
      .limit(1);

    if (!member) return { deleted: false, reason: "not_found" };
    if (member.status !== "withdrawn") return { deleted: false, reason: "not_withdrawn" };

    const related: string[] = [];

    if ((await tx.select({ id: freeBoardPosts.id }).from(freeBoardPosts).where(eq(freeBoardPosts.authorMemberId, id)).limit(1))[0]) {
      related.push("자유게시판");
    }
    if ((await tx.select({ id: subtitleRequests.id }).from(subtitleRequests).where(eq(subtitleRequests.memberId, id)).limit(1))[0]) {
      related.push("자막신청");
    }
    if ((await tx.select({ id: bulletinAdRequests.id }).from(bulletinAdRequests).where(eq(bulletinAdRequests.memberId, id)).limit(1))[0]) {
      related.push("주보 광고신청");
    }
    if ((await tx.select({ id: courseApplications.id }).from(courseApplications).where(eq(courseApplications.memberId, id)).limit(1))[0]) {
      related.push("강좌 신청");
    }
    if ((await tx.select({ id: reservations.id }).from(reservations).where(eq(reservations.userId, id)).limit(1))[0]) {
      related.push("시설 예약");
    }
    if ((await tx.select({ id: missionReportAuthors.id }).from(missionReportAuthors).where(eq(missionReportAuthors.memberId, id)).limit(1))[0]) {
      related.push("선교보고 권한");
    }
    if ((await tx.select({ id: missionReports.id }).from(missionReports).where(eq(missionReports.authorMemberId, id)).limit(1))[0]) {
      related.push("선교보고");
    }
    if ((await tx.select({ id: testimonyPosts.id }).from(testimonyPosts).where(eq(testimonyPosts.authorMemberId, id)).limit(1))[0]) {
      related.push("간증 게시글");
    }
    if ((await tx.select({ id: testimonyComments.id }).from(testimonyComments).where(eq(testimonyComments.authorMemberId, id)).limit(1))[0]) {
      related.push("간증 댓글");
    }
    if ((await tx.select({ id: schoolPosts.id }).from(schoolPosts).where(eq(schoolPosts.memberId, id)).limit(1))[0]) {
      related.push("교회학교 게시글");
    }

    if (related.length > 0) {
      return { deleted: false, reason: "has_related_records", related };
    }

    await tx.delete(memberDistricts).where(eq(memberDistricts.memberId, id));
    await tx.delete(memberSocialAccounts).where(eq(memberSocialAccounts.memberId, id));
    await tx.delete(churchMembers).where(eq(churchMembers.id, id));

    return { deleted: true };
  });
}

/** 관리자: 성도 전체 정보 수정 (기본정보 + 교회정보 통합) */
export async function adminUpdateMember(id: number, data: Partial<{
  name: string;
  phone: string;
  birthDate: string;
  gender: string;
  address: string;
  emergencyPhone: string;
  email: string;
  position: string;
  department: string;
  district: string;
  baptismType: string;
  baptismDate: string;
  registeredAt: string;
  pastor: string;
  adminMemo: string;
  canReserveFacility: boolean;
  status: 'pending' | 'approved' | 'rejected' | 'withdrawn';
  faithPlusUserId: string;
}>) {
  const db = await getDb();
  if (!db) throw new Error('DB not available');
  const normalized = data.email ? { ...data, email: data.email.trim().toLowerCase() } : data;
  await db.update(churchMembers).set({ ...normalized, updatedAt: new Date() }).where(eq(churchMembers.id, id));
}

function normalizeDistrictAssignments(districts: string[]) {
  return Array.from(
    new Set(
      districts
        .map((district) => district.trim())
        .filter((district) => district.length > 0 && district.length <= 64),
    ),
  );
}

export async function getMemberDistrictAssignments(memberId: number) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({ district: memberDistricts.district })
    .from(memberDistricts)
    .where(eq(memberDistricts.memberId, memberId))
    .orderBy(asc(memberDistricts.district));
  return rows.map((row) => row.district);
}

export async function setMemberDistrictAssignments(memberId: number, districts: string[]) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const normalized = normalizeDistrictAssignments(districts);
  await db.transaction(async (tx) => {
    await tx.delete(memberDistricts).where(eq(memberDistricts.memberId, memberId));
    if (normalized.length === 0) return;

    await tx.insert(memberDistricts).values(
      normalized.map((district) => ({
        memberId,
        district,
      })),
    );
  });
  return normalized;
}

export async function getMembersAssignedToDistrict(district: string) {
  const db = await getDb();
  if (!db) return [];
  const normalizedDistrict = district.trim();
  if (!normalizedDistrict) return [];

  return db
    .select({
      id: churchMembers.id,
      name: churchMembers.name,
      email: churchMembers.email,
      phone: churchMembers.phone,
      position: churchMembers.position,
      department: churchMembers.department,
      district: churchMembers.district,
      status: churchMembers.status,
    })
    .from(memberDistricts)
    .innerJoin(churchMembers, eq(memberDistricts.memberId, churchMembers.id))
    .where(and(
      eq(memberDistricts.district, normalizedDistrict),
      eq(churchMembers.status, "approved"),
    ))
    .orderBy(asc(churchMembers.name));
}

/** 관리자: 성도 비밀번호 초기화 (임시 비밀번호 설정) */
export async function adminResetMemberPassword(id: number, tempPassword: string) {
  const bcrypt = await import('bcryptjs');
  const hash = await bcrypt.hash(tempPassword, 10);
  const db = await getDb();
  if (!db) throw new Error('DB not available');
  const changedAt = new Date();
  await db.transaction(async (tx) => {
    await tx.update(churchMembers).set({
      passwordHash: hash,
      sessionVersion: sql`${churchMembers.sessionVersion} + 1`,
      updatedAt: changedAt,
    }).where(eq(churchMembers.id, id));
    await tx
      .update(memberPasswordResetRequests)
      .set({ status: "resolved", resetTokenHash: null, resolvedAt: changedAt })
      .where(and(
        eq(memberPasswordResetRequests.memberId, id),
        inArray(memberPasswordResetRequests.status, ["pending", "approved"]),
      ));
  });
}

/** 성도 본인: 검증이 끝난 새 비밀번호 해시 저장 */
export async function updateMemberPasswordHash(id: number, passwordHash: string) {
  const db = await getDb();
  if (!db) throw new Error('DB not available');
  const changedAt = new Date();
  await db
    .update(churchMembers)
    .set({
      passwordHash,
      sessionVersion: sql`${churchMembers.sessionVersion} + 1`,
      updatedAt: changedAt,
    })
    .where(eq(churchMembers.id, id));
}

// ─── 성도 검색 (내부 주소록 전용) ─────────────────────────────────────────────
/**
 * 이름으로 성도 검색 (DB 쿼리 레벨에서 필터링)
 * - approved 상태인 성도만 검색
 * - 최대 20명 반환
 * - 내부 주소록에 필요한 필드만 반환 (민감 정보 제외)
 */
export async function searchMembersByName(name: string, limit = 20) {
  const db = await getDb();
  if (!db) return [];
  const { like, and, eq: eqOp } = await import("drizzle-orm");
  const results = await db
    .select({
      id: churchMembers.id,
      name: churchMembers.name,
      phone: churchMembers.phone,
      email: churchMembers.email,
      position: churchMembers.position,
      department: churchMembers.department,
      district: churchMembers.district,
      faithPlusUserId: churchMembers.faithPlusUserId,
    })
    .from(churchMembers)
    .where(
      and(
        eqOp(churchMembers.status, "approved"),
        like(churchMembers.name, `%${name}%`)
      )
    )
    .limit(limit);
  return results;
}

export async function getMemberAlertsSummary() {
  const db = await getDb();
  const { today, monthDay } = getKstTodayParts();
  const empty = {
    today,
    generatedAt: new Date().toISOString(),
    birthdaysToday: [] as MemberAlertSummaryItem[],
    recentMembers: {
      last7Days: [] as MemberAlertSummaryItem[],
      last30Days: [] as MemberAlertSummaryItem[],
    },
  };

  if (!db) return empty;

  const approvedMembers = await db
    .select({
      id: churchMembers.id,
      name: churchMembers.name,
      position: churchMembers.position,
      department: churchMembers.department,
      district: churchMembers.district,
      birthDate: churchMembers.birthDate,
      registeredAt: churchMembers.registeredAt,
      createdAt: churchMembers.createdAt,
      status: churchMembers.status,
    })
    .from(churchMembers)
    .where(eq(churchMembers.status, "approved"))
    .orderBy(desc(churchMembers.createdAt), asc(churchMembers.name));

  const normalized = approvedMembers.map(toSummaryItem);
  const birthdaysToday = normalized
    .filter((member) => extractMonthDay(member.birthDate) === monthDay)
    .sort((a, b) => a.name.localeCompare(b.name, "ko"));

  const start7 = formatIsoDate(getRecentWindowStart(7));
  const start30 = formatIsoDate(getRecentWindowStart(30));

  const recentMembers = normalized
    .filter((member) => Boolean(member.effectiveRegisteredAt))
    .sort((a, b) => {
      const left = a.effectiveRegisteredAt ?? "";
      const right = b.effectiveRegisteredAt ?? "";
      if (left === right) return a.name.localeCompare(b.name, "ko");
      return right.localeCompare(left);
    });

  return {
    today,
    generatedAt: new Date().toISOString(),
    birthdaysToday,
    recentMembers: {
      last7Days: recentMembers.filter((member) => {
        const key = member.effectiveRegisteredAt;
        return Boolean(key && key >= start7 && key <= today);
      }),
      last30Days: recentMembers.filter((member) => {
        const key = member.effectiveRegisteredAt;
        return Boolean(key && key >= start30 && key <= today);
      }),
    },
  };
}
