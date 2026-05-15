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

import { and, eq, asc, desc } from "drizzle-orm";
import type { ResultSetHeader } from "mysql2";
import { churchMembers, memberFieldOptions, memberSocialAccounts } from "../../drizzle/schema";
import { getDb } from "./connection";

export type MemberSocialProvider = "google" | "kakao";

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

/** 전체 성도 목록 조회 (관리자용) */
export async function getAllMembers() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(churchMembers).orderBy(desc(churchMembers.createdAt));
}

/** 승인 대기 성도 목록 */
export async function getPendingMembers() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(churchMembers)
    .where(eq(churchMembers.status, 'pending'))
    .orderBy(desc(churchMembers.createdAt));
}

// ─── 성도 등록/수정 ───────────────────────────────────────────────────────────

/** 성도 회원가입 */
export async function createMember(data: {
  email: string;
  passwordHash?: string | null;
  name: string;
  phone?: string;
  birthDate?: string;
  gender?: string;
  address?: string;
  emergencyPhone?: string;
  joinPath?: string;
  department?: string;
  district?: string;
  faithPlusUserId?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error('DB not available');
  const [result] = await db.insert(churchMembers).values({
    ...data,
    email: data.email.trim().toLowerCase(),
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

/** 성도 교회 정보 수정 (관리자 전용) */
export async function updateMemberChurchInfo(id: number, data: Partial<{
  position: string;
  department: string;
  district: string;
  baptismType: string;
  baptismDate: string;
  registeredAt: string;
  pastor: string;
  adminMemo: string;
  status: 'pending' | 'approved' | 'rejected' | 'withdrawn';
  faithPlusUserId: string;
}>) {
  const db = await getDb();
  if (!db) throw new Error('DB not available');
  await db.update(churchMembers).set({ ...data, updatedAt: new Date() }).where(eq(churchMembers.id, id));
}

// ─── 관리자 전용 ──────────────────────────────────────────────────────────────

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
  status: 'pending' | 'approved' | 'rejected' | 'withdrawn';
  faithPlusUserId: string;
}>) {
  const db = await getDb();
  if (!db) throw new Error('DB not available');
  const normalized = data.email ? { ...data, email: data.email.trim().toLowerCase() } : data;
  await db.update(churchMembers).set({ ...normalized, updatedAt: new Date() }).where(eq(churchMembers.id, id));
}

/** 관리자: 성도 비밀번호 초기화 (임시 비밀번호 설정) */
export async function adminResetMemberPassword(id: number, tempPassword: string) {
  const bcrypt = await import('bcryptjs');
  const hash = await bcrypt.hash(tempPassword, 10);
  const db = await getDb();
  if (!db) throw new Error('DB not available');
  await db.update(churchMembers).set({ passwordHash: hash, updatedAt: new Date() }).where(eq(churchMembers.id, id));
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
