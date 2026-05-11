/**
 * 교회 회원 시스템 라우터 (members)
 * ─────────────────────────────────────────────────────────────────────────────
 * 담당 기능:
 *   - searchByName: 성도 이름 검색 (교적부용)
 *   - fieldOptions: 선택지 목록 조회 (직분, 부서, 구역, 세례 등)
 *   - register: 성도 회원가입
 *   - login: 성도 로그인
 *   - logout: 성도 로그아웃
 *   - me: 내 정보 조회
 *   - updateMyInfo: 내 기본 정보 수정
 *   - adminList: 전체 성도 목록 (관리자)
 *   - pendingList: 승인 대기 성도 목록 (관리자)
 *   - updateChurchInfo: 성도 교회 정보 수정 (관리자)
 *   - adminFieldOptions: 선택지 전체 목록 (관리자)
 *   - addFieldOption / updateFieldOption / deleteFieldOption: 선택지 관리 (관리자)
 *   - adminUpdate: 성도 전체 정보 수정 (관리자)
 *   - resetPassword: 성도 비밀번호 초기화 (관리자)
 *
 * 인증 방식: church_member_session 쿠키 (JWT)
 * 접근 권한:
 *   - 공개: fieldOptions, register, login, logout, me
 *   - 성도: searchByName, updateMyInfo
 *   - 관리자: adminList, pendingList, updateChurchInfo, adminFieldOptions, 등
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { adminProcedure, publicProcedure, memberProtectedProcedure, router } from "../_core/trpc";
import { checkRateLimit, recordFailure, resetFailures, getClientIp, checkSearchRateLimit, checkRegisterRateLimit } from "../_core/rateLimiter";
import { getSessionCookieOptions } from "../_core/cookies";
import { getJwtSecretKey } from "../_core/jwtSecret";
import {
  getMemberFieldOptions,
  getAllMemberFieldOptions,
  createMemberFieldOption,
  updateMemberFieldOption,
  deleteMemberFieldOption,
  getMemberByEmail,
  getMemberById,
  createMember,
  updateMemberBasicInfo,
  updateMemberChurchInfo,
  adminUpdateMember,
  adminResetMemberPassword,
  getAllMembers,
  getPendingMembers,
  searchMembersByName,
} from "../db";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const idSchema = z.number().int().positive();
const fieldTypeSchema = z.enum(["position", "department", "district", "baptism"]);

const requiredText = (max: number, message: string) =>
  z.string().trim().min(1, message).max(max, `${max}자 이하로 입력해주세요.`);

const optionalText = (max: number) =>
  z.string().trim().max(max, `${max}자 이하로 입력해주세요.`).optional();

const optionalDate = z.string().regex(DATE_RE, "날짜 형식은 YYYY-MM-DD여야 합니다.").optional();

const emailSchema = z.string()
  .trim()
  .email("올바른 이메일 형식을 입력해주세요.")
  .max(254, "이메일은 254자 이하로 입력해주세요.")
  .transform(email => email.toLowerCase());

function sanitizeMemberForSelf<T extends Record<string, unknown>>(member: T) {
  const { passwordHash: _passwordHash, adminMemo: _adminMemo, ...safeData } = member;
  return safeData;
}

function sanitizeMemberForAdmin<T extends Record<string, unknown>>(member: T) {
  const { passwordHash: _passwordHash, ...safeData } = member;
  return safeData;
}

export const membersRouter = router({
  // ─── 공개 API ────────────────────────────────────────────────────────────────

  /**
   * 성도 이름 검색 (교회 내부 주소록 전용)
   *
   * [보안]
   * - 비로그인 → 401 UNAUTHORIZED
   * - pending/rejected 성도 → 403 FORBIDDEN (memberProtectedProcedure)
   * - approved 성도만 접근 허용
   *
   * [제한]
   * - 검색어 최소 2글자
   * - 최대 결과 20명
   * - 분당 30회 rate limit (IP 기준)
   *
   * [반환 필드]
   * - 허용: id, name, phone, email, position, department, district, faithPlusUserId
   * - 제외: passwordHash, adminMemo, status, birthDate, emergencyPhone,
   *         baptismDate, baptismType, registeredAt, pastor, gender, address,
   *         joinPath, createdAt, updatedAt
   */
  searchByName: memberProtectedProcedure
    .input(z.object({
      name: requiredText(64, "검색어는 최소 2글자 이상 입력해주세요.").min(2, "검색어는 최소 2글자 이상 입력해주세요."),
    }))
    .query(async ({ input, ctx }) => {
      // Rate limit: IP 기준 분당 30회
      const ip = getClientIp(ctx.req);
      checkSearchRateLimit(`search:${ip}`);

      // DB 쿼리에서 직접 name LIKE 검색 + limit 20 (전체 목록 가져오기 방지)
      return searchMembersByName(input.name, 20);
    }),

  /**
   * 선택지 목록 조회 (공개 — 회원가입 폼에서 사용)
   * - fieldType 미입력 시 전체 선택지 반환
   */
  fieldOptions: publicProcedure
    .input(z.object({ fieldType: fieldTypeSchema.optional() }))
    .query(({ input }) => getMemberFieldOptions(input.fieldType)),

  /**
   * 성도 회원가입
   * - 가입 신청 후 관리자 승인 대기
   * - 이메일 중복 시 CONFLICT 에러 반환
   */
  register: publicProcedure
    .input(z.object({
      email: emailSchema,
      password: z.string().min(8, "비밀번호는 8자 이상이어야 합니다.").max(128, "비밀번호는 128자 이하로 입력해주세요."),
      name: requiredText(64, "이름을 입력해주세요."),
      phone: optionalText(32),
      birthDate: optionalDate,
      gender: z.enum(["남", "여"]).optional(),
      address: optionalText(255),
      emergencyPhone: optionalText(32),
      joinPath: optionalText(64),
      department: optionalText(64),
      district: optionalText(64),
      faithPlusUserId: optionalText(128),
    }))
    .mutation(async ({ input, ctx }) => {
      const clientIp = getClientIp(ctx.req);
      try {
        checkRegisterRateLimit(`register:${clientIp}`);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "회원가입 요청이 너무 많습니다.";
        throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: msg });
      }

      const bcrypt = await import("bcryptjs");

      // 이메일 중복 확인
      const existing = await getMemberByEmail(input.email);
      if (existing) {
        throw new TRPCError({ code: "CONFLICT", message: "이미 사용 중인 이메일입니다." });
      }

      // 비밀번호 해시화 (bcrypt, salt rounds=10)
      const passwordHash = await bcrypt.hash(input.password, 10);

      const id = await createMember({
        email: input.email,
        passwordHash,
        name: input.name,
        phone: input.phone,
        birthDate: input.birthDate,
        gender: input.gender,
        address: input.address,
        emergencyPhone: input.emergencyPhone,
        joinPath: input.joinPath,
        department: input.department,
        district: input.district,
        faithPlusUserId: input.faithPlusUserId,
      });

      ctx.res.clearCookie("church_member_session", {
        ...getSessionCookieOptions(ctx.req),
        maxAge: -1,
      });

      return { success: true, id, autoLoggedIn: false };
    }),

  /**
   * 성도 로그인
   * - 이메일/비밀번호 검증 후 JWT 쿠키 발급
   */
    login: publicProcedure
    .input(z.object({
      email: emailSchema,
      password: z.string().min(1, "비밀번호를 입력해주세요.").max(128, "비밀번호는 128자 이하로 입력해주세요."),
    }))
    .mutation(async ({ input, ctx }) => {
      // ── Rate Limit: IP 및 계정 기준 실패 횟수 제한 ───────────────────────
      const clientIp = getClientIp(ctx.req);
      const ipKey = `ip:${clientIp}`;
      const accountKey = `account:${input.email}`;
      try {
        checkRateLimit(ipKey);
        checkRateLimit(accountKey);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "로그인 시도가 너무 많습니다.";
        throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: msg });
      }
      const bcrypt = await import("bcryptjs");
      const member = await getMemberByEmail(input.email);
      if (!member || !member.passwordHash) {
        // 존재하지 않는 계정도 실패로 기록 (열거 공격 방지)
        recordFailure(ipKey);
        recordFailure(accountKey);
        throw new TRPCError({ code: "UNAUTHORIZED", message: "이메일 또는 비밀번호가 올바르지 않습니다." });
      }
      const valid = await bcrypt.compare(input.password, member.passwordHash);
      if (!valid) {
        recordFailure(ipKey);
        recordFailure(accountKey);
        throw new TRPCError({ code: "UNAUTHORIZED", message: "이메일 또는 비밀번호가 올바르지 않습니다." });
      }
      // 로그인 성공 시 실패 기록 초기화
      resetFailures(ipKey);
      resetFailures(accountKey);

      if (member.status !== "approved") {
        const statusMsg: Record<string, string> = {
          pending: "회원가입 신청이 접수됐습니다. 관리자 승인 후 로그인하실 수 있습니다.",
          rejected: "가입이 거절됐습니다. 교회 사무국에 문의해주세요.",
          withdrawn: "탈퇴한 계정입니다. 교회 사무국에 문의해주세요.",
        };
        throw new TRPCError({
          code: "FORBIDDEN",
          message: statusMsg[member.status] ?? "로그인 권한이 없습니다.",
        });
      }

      const { SignJWT } = await import("jose");
      const secret = getJwtSecretKey();
      const token = await new SignJWT({
        memberId: member.id,
        email: member.email,
        name: member.name,
        type: "church_member",
      })
        .setProtectedHeader({ alg: "HS256" })
        .setExpirationTime("24h")
        .sign(secret);

      ctx.res.cookie("church_member_session", token, {
        ...getSessionCookieOptions(ctx.req),
      });

      return {
        success: true,
        member: {
          id: member.id,
          name: member.name,
          email: member.email,
          status: member.status,
        },
      };
    }),

  /** 성도 로그아웃 (쿠키 삭제) */
  logout: publicProcedure
    .mutation(({ ctx }) => {
      ctx.res.clearCookie("church_member_session", {
        ...getSessionCookieOptions(ctx.req),
        maxAge: -1,
      });
      return { success: true };
    }),

  /**
   * 내 정보 조회 (쿠키 기반)
   * - 쿠키 없거나 만료 시 null 반환
   */
  me: publicProcedure
    .query(async ({ ctx }) => {
      const token = ctx.req.cookies?.["church_member_session"];
      if (!token) return null;

      try {
        const { jwtVerify } = await import("jose");
        const secret = getJwtSecretKey();
        const { payload } = await jwtVerify(token, secret);

        if (payload.type !== "church_member" || !payload.memberId) return null;

        const member = await getMemberById(payload.memberId as number);
        if (!member) return null;
        if (member.status !== "approved") return null;

        // 비밀번호 해시와 관리자 내부 메모 제외
        return sanitizeMemberForSelf(member);
      } catch {
        return null;
      }
    }),

  /**
   * 내 기본 정보 수정
   * - 쿠키 없거나 만료 시 UNAUTHORIZED 에러
   */
  updateMyInfo: memberProtectedProcedure
    .input(z.object({
      name: requiredText(64, "이름을 입력해주세요.").optional(),
      phone: optionalText(32),
      birthDate: optionalDate,
      gender: z.enum(["남", "여"]).optional(),
      address: optionalText(255),
      emergencyPhone: optionalText(32),
      faithPlusUserId: optionalText(128),
    }))
    .mutation(async ({ input, ctx }) => {
      await updateMemberBasicInfo(ctx.memberId, input);
      return { success: true };
    }),

  // ─── 관리자 전용 API ─────────────────────────────────────────────────────────

  /** 전체 성도 목록 (관리자) */
  adminList: adminProcedure.query(async () => (await getAllMembers()).map(sanitizeMemberForAdmin)),

  /** 승인 대기 성도 목록 (관리자) */
  pendingList: adminProcedure.query(async () => (await getPendingMembers()).map(sanitizeMemberForAdmin)),

  /**
   * 성도 교회 정보 수정 (관리자)
   * - 직분, 부서, 구역, 세례 정보, 등록일, 담당 목사, 관리자 메모 등
   */
  updateChurchInfo: adminProcedure
    .input(z.object({
      id: idSchema,
      position: optionalText(64),
      department: optionalText(64),
      district: optionalText(64),
      baptismType: optionalText(32),
      baptismDate: optionalDate,
      registeredAt: optionalDate,
      pastor: optionalText(64),
      adminMemo: optionalText(20000),
      status: z.enum(["pending", "approved", "rejected", "withdrawn"]).optional(),
      faithPlusUserId: optionalText(128),
    }))
    .mutation(({ input }) => {
      const { id, ...data } = input;
      return updateMemberChurchInfo(id, data);
    }),

  /** 선택지 전체 목록 조회 (관리자 — 비활성 포함) */
  adminFieldOptions: adminProcedure.query(() => getAllMemberFieldOptions()),

  /**
   * 선택지 추가 (관리자)
   * - fieldType: 'position'(직분), 'department'(부서), 'district'(구역), 'baptism'(세례)
   */
  addFieldOption: adminProcedure
    .input(z.object({
      fieldType: fieldTypeSchema,
      label: requiredText(64, "선택지 이름을 입력해주세요."),
      sortOrder: z.number().int().min(0).max(10000).optional(),
    }))
    .mutation(({ input }) => createMemberFieldOption(input)),

  /** 선택지 수정 (관리자) */
  updateFieldOption: adminProcedure
    .input(z.object({
      id: idSchema,
      label: requiredText(64, "선택지 이름을 입력해주세요.").optional(),
      sortOrder: z.number().int().min(0).max(10000).optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(({ input }) => {
      const { id, ...data } = input;
      return updateMemberFieldOption(id, data);
    }),

  /** 선택지 삭제 (관리자) */
  deleteFieldOption: adminProcedure
    .input(z.object({ id: idSchema }))
    .mutation(({ input }) => deleteMemberFieldOption(input.id)),

  /**
   * 성도 전체 정보 수정 (관리자)
   * - 기본 정보 + 교회 정보 통합 수정
   */
  adminUpdate: adminProcedure
    .input(z.object({
      id: idSchema,
      name: requiredText(64, "이름을 입력해주세요.").optional(),
      phone: optionalText(32),
      birthDate: optionalDate,
      gender: z.enum(["남", "여"]).optional(),
      address: optionalText(255),
      emergencyPhone: optionalText(32),
      email: emailSchema.optional(),
      position: optionalText(64),
      department: optionalText(64),
      district: optionalText(64),
      baptismType: optionalText(32),
      baptismDate: optionalDate,
      registeredAt: optionalDate,
      pastor: optionalText(64),
      adminMemo: optionalText(20000),
      status: z.enum(["pending", "approved", "rejected", "withdrawn"]).optional(),
      faithPlusUserId: optionalText(128),
    }))
    .mutation(({ input }) => {
      const { id, ...data } = input;
      return adminUpdateMember(id, data);
    }),

  /**
   * 성도 비밀번호 초기화 (관리자)
   * - 임시 비밀번호 6자 이상 필수
   * - 성도에게 임시 비밀번호를 별도로 전달해야 함
   */
  resetPassword: adminProcedure
    .input(z.object({
      id: idSchema,
      tempPassword: z.string()
        .min(6, "임시 비밀번호는 6자 이상이어야 합니다.")
        .max(128, "임시 비밀번호는 128자 이하로 입력해주세요."),
    }))
    .mutation(({ input }) => adminResetMemberPassword(input.id, input.tempPassword)),
});
