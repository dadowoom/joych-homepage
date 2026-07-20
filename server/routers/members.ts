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
 *   - updateMyChurchInfo: 내 교회 정보 수정
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
 *   - 성도: searchByName, updateMyInfo, updateMyChurchInfo
 *   - 관리자: adminList, pendingList, updateChurchInfo, adminFieldOptions, 등
 */

import crypto from "node:crypto";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { adminPermissionProcedure, adminProcedure, publicProcedure, memberProtectedProcedure, router } from "../_core/trpc";
import { checkAccountRecoveryRateLimit, checkRateLimit, recordFailure, resetFailures, getClientIp, checkSearchRateLimit, checkRegisterRateLimit } from "../_core/rateLimiter";
import { getSessionCookieOptions } from "../_core/cookies";
import { createDomainLogoutIntent } from "../_core/domainSessionBridge";
import { getJwtSecretKey } from "../_core/jwtSecret";
import { isMemberSessionCurrent, MEMBER_SESSION_COOKIE, setMemberSessionCookie } from "../_core/memberSession";
import {
  memberEmailSchema,
  memberPasswordSchema,
  memberRegisterInputSchema,
  optionalMemberPhone,
  optionalDate,
  optionalText,
  requiredBirthDate,
  requiredMemberPhone,
  requiredText,
} from "../_core/memberValidation";
import {
  MEMBER_APPROVAL_PERMISSION_KEY,
} from "@shared/adminPermissions";
import {
  MEMBER_REGISTER_FIELD_CONFIG_KEY,
  MEMBER_REGISTER_FIELD_DEFINITIONS,
  parseMemberRegisterFieldConfig,
  type MemberRegisterFieldKey,
} from "@shared/memberRegisterFields";
import {
  getMemberFieldOptions,
  getAllMemberFieldOptions,
  createMemberFieldOption,
  updateMemberFieldOption,
  reorderMemberFieldOptions,
  deleteMemberFieldOption,
  getMemberByEmail,
  getMemberById,
  getMembersByNameAndPhone,
  getMemberSocialProviders,
  createMember,
  createMemberPasswordResetRequest,
  approveMemberPasswordResetRequest,
  completeMemberPasswordReset,
  decidePendingMemberRegistration,
  updateMemberBasicInfo,
  updateMemberChurchInfo,
  adminHardDeleteMember,
  adminUpdateMember,
  adminResetMemberPassword,
  updateMemberPasswordHash,
  getAllMembers,
  getPendingMembers,
  getPendingMemberPasswordResetRequests,
  searchMembersByName,
  setMemberDistrictAssignments,
  withdrawMemberAndErasePersonalData,
  getSiteSetting,
} from "../db";
import {
  notifyMemberPasswordResetApproved,
  notifyMemberPasswordResetRequest,
  notifyMemberRegistration,
} from "../_core/pushNotifications";
import {
  MemberRegistrationBusyError,
  withMemberRegistrationIdentityLock,
} from "../_core/memberRegistrationLock";

const idSchema = z.number().int().positive();
const MEMBER_PASSWORD_RESET_LINK_TTL_MS = 24 * 60 * 60 * 1000;

function hashPasswordResetToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}
const fieldTypeSchema = z.enum(["position", "department", "district", "baptism"]);
const registerOptionFieldKeys = ["position", "department", "district"] as const;
const editableChurchDate = z.string()
  .trim()
  .refine((value) => value === "" || /^\d{4}-\d{2}-\d{2}$/.test(value), "날짜 형식은 YYYY-MM-DD여야 합니다.")
  .optional();

type RegisterInputWithConfigurableFields = z.infer<typeof memberRegisterInputSchema>;

function getRegisterFieldValue(input: RegisterInputWithConfigurableFields, key: MemberRegisterFieldKey) {
  return input[key];
}

async function getRegisterFieldConfig() {
  const row = await getSiteSetting(MEMBER_REGISTER_FIELD_CONFIG_KEY);
  return parseMemberRegisterFieldConfig(row?.settingValue);
}

async function assertConfiguredRegisterOptions(
  input: RegisterInputWithConfigurableFields,
  config: Awaited<ReturnType<typeof getRegisterFieldConfig>>,
) {
  const submitted = registerOptionFieldKeys
    .map((fieldType) => ({
      fieldType,
      value: visibleRegisterValue(input, config, fieldType),
    }))
    .filter((item): item is { fieldType: typeof registerOptionFieldKeys[number]; value: string } =>
      typeof item.value === "string" && Boolean(item.value)
    );
  if (submitted.length === 0) return;

  const activeOptions = await getMemberFieldOptions();
  for (const item of submitted) {
    if (!activeOptions.some((option) => option.fieldType === item.fieldType && option.label === item.value)) {
      const label = MEMBER_REGISTER_FIELD_DEFINITIONS.find((field) => field.key === item.fieldType)?.label ?? "선택 항목";
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `현재 사용할 수 없는 ${label}입니다. 목록에서 다시 선택해주세요.`,
      });
    }
  }
}

async function assertRequiredPositionOptionRemains(id: number) {
  const options = await getAllMemberFieldOptions();
  const target = options.find((option) => option.id === id);
  if (target?.fieldType !== "position" || !target.isActive) return;

  const activePositionCount = options.filter(
    (option) => option.fieldType === "position" && option.isActive,
  ).length;
  if (activePositionCount <= 1) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "직분은 회원가입 필수 항목이므로 활성 선택지를 최소 1개 유지해주세요.",
    });
  }
}

function assertRequiredRegisterFields(
  input: RegisterInputWithConfigurableFields,
  config: Awaited<ReturnType<typeof getRegisterFieldConfig>>,
) {
  for (const field of MEMBER_REGISTER_FIELD_DEFINITIONS) {
    const setting = config[field.key];
    if (!setting.visible || !setting.required) continue;
    const value = getRegisterFieldValue(input, field.key);
    if (typeof value !== "string" || !value.trim()) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `${field.label} 항목을 입력해주세요.`,
      });
    }
  }
}

function visibleRegisterValue(
  input: RegisterInputWithConfigurableFields,
  config: Awaited<ReturnType<typeof getRegisterFieldConfig>>,
  key: MemberRegisterFieldKey,
) {
  return config[key].visible ? getRegisterFieldValue(input, key) : undefined;
}

function sanitizeMemberForSelf<T extends Record<string, unknown>>(member: T) {
  const {
    passwordHash: _passwordHash,
    sessionVersion: _sessionVersion,
    adminMemo: _adminMemo,
    ...safeData
  } = member;
  return {
    ...safeData,
    hasPassword: Boolean(_passwordHash),
  };
}

function sanitizeMemberForAdmin<T extends Record<string, unknown>>(member: T) {
  const { passwordHash: _passwordHash, sessionVersion: _sessionVersion, ...safeData } = member;
  return safeData;
}

function sanitizeMemberForDirectoryManager<T extends Record<string, unknown>>(member: T) {
  const {
    passwordHash: _passwordHash,
    sessionVersion: _sessionVersion,
    adminMemo: _adminMemo,
    assignedDistricts: _assignedDistricts,
    ...safeData
  } = member;
  return safeData;
}

function sanitizeMemberForApproval<T extends Record<string, unknown>>(member: T) {
  return {
    id: member.id as number,
    name: member.name as string,
    email: (member.email as string | null | undefined) ?? null,
    phone: (member.phone as string | null | undefined) ?? null,
    birthDate: (member.birthDate as string | null | undefined) ?? null,
    gender: (member.gender as string | null | undefined) ?? null,
    position: (member.position as string | null | undefined) ?? null,
    department: (member.department as string | null | undefined) ?? null,
    district: (member.district as string | null | undefined) ?? null,
    status: member.status as string,
    createdAt: member.createdAt as Date,
  };
}

const memberApprovalProcedure = adminPermissionProcedure(MEMBER_APPROVAL_PERMISSION_KEY);

export function maskMemberLoginEmail(email: string | null | undefined) {
  const normalized = email?.trim().toLowerCase();
  if (!normalized) return null;
  const atIndex = normalized.indexOf("@");
  if (atIndex <= 0) return null;

  const local = normalized.slice(0, atIndex);
  const domain = normalized.slice(atIndex + 1);
  const visibleLength = Math.min(2, Math.max(1, local.length - 1));
  return `${local.slice(0, visibleLength)}${"*".repeat(Math.max(3, local.length - visibleLength))}@${domain}`;
}

const MEMBER_SOCIAL_PROVIDER_LABELS = {
  google: "Google",
  kakao: "카카오",
} as const;

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

  /** 이름·연락처·생년월일 대조 후 로그인 이메일을 마스킹해서 안내합니다. */
  findLoginId: publicProcedure
    .input(z.object({
      name: requiredText(64, "이름을 입력해주세요."),
      phone: requiredMemberPhone,
      birthDate: requiredBirthDate,
    }))
    .mutation(async ({ input, ctx }) => {
      const clientIp = getClientIp(ctx.req);
      try {
        checkAccountRecoveryRateLimit(`find-id:${clientIp}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : "계정 찾기 요청이 너무 많습니다.";
        throw new TRPCError({ code: "TOO_MANY_REQUESTS", message });
      }

      const identityMatches = await getMembersByNameAndPhone(input.name, input.phone);
      const matches = identityMatches.filter((member) => member.birthDate === input.birthDate);
      const providers = await getMemberSocialProviders(matches.map((member) => member.id));
      const providerMap = new Map<number, (keyof typeof MEMBER_SOCIAL_PROVIDER_LABELS)[]>();
      for (const account of providers) {
        const list = providerMap.get(account.memberId) ?? [];
        if (!list.includes(account.provider)) list.push(account.provider);
        providerMap.set(account.memberId, list);
      }

      return {
        found: matches.length > 0,
        accounts: matches.map((member) => ({
          maskedEmail: maskMemberLoginEmail(member.email),
          hasPassword: Boolean(member.passwordHash),
          socialProviders: (providerMap.get(member.id) ?? []).map(
            (provider) => MEMBER_SOCIAL_PROVIDER_LABELS[provider],
          ),
        })),
      };
    }),

  /**
   * 비밀번호 원문은 복구하지 않습니다. 일치하는 일반가입 계정의 재설정 요청만
   * 최고관리자에게 전달하고, 성공 여부와 관계없이 같은 응답을 반환합니다.
   */
  requestPasswordReset: publicProcedure
    .input(z.object({
      name: requiredText(64, "이름을 입력해주세요."),
      phone: requiredMemberPhone,
      birthDate: requiredBirthDate,
    }))
    .mutation(async ({ input, ctx }) => {
      const clientIp = getClientIp(ctx.req);
      try {
        checkAccountRecoveryRateLimit(`password-reset:${clientIp}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : "재설정 요청이 너무 많습니다.";
        throw new TRPCError({ code: "TOO_MANY_REQUESTS", message });
      }

      const identityMatches = await getMembersByNameAndPhone(input.name, input.phone);
      const matches = identityMatches.filter(
        (member) => member.birthDate === input.birthDate && Boolean(member.passwordHash),
      );
      for (const member of matches) {
        const request = await createMemberPasswordResetRequest(member.id);
        if (request.created) {
          void notifyMemberPasswordResetRequest({
            requestId: request.id,
            name: member.name,
            position: member.position,
          });
        }
      }

      return {
        accepted: true,
        message: "입력하신 정보와 일치하는 일반가입 계정이 있으면 관리자에게 재설정 요청이 전달됩니다.",
      };
    }),

  /** 관리자 확인 후 발급된 24시간짜리 일회용 링크로 새 비밀번호를 설정합니다. */
  completePasswordReset: publicProcedure
    .input(z.object({
      token: z.string().trim().min(32).max(256),
      newPassword: memberPasswordSchema,
    }))
    .mutation(async ({ input, ctx }) => {
      const clientIp = getClientIp(ctx.req);
      try {
        checkAccountRecoveryRateLimit(`password-reset-complete:${clientIp}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : "비밀번호 재설정 시도가 너무 많습니다.";
        throw new TRPCError({ code: "TOO_MANY_REQUESTS", message });
      }

      const bcrypt = await import("bcryptjs");
      const passwordHash = await bcrypt.hash(input.newPassword, 10);
      const result = await completeMemberPasswordReset(hashPasswordResetToken(input.token), passwordHash);
      if (result.status === "expired") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "재설정 링크의 24시간 유효기간이 지났습니다. 다시 요청해주세요.",
        });
      }
      if (result.status !== "completed") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "이미 사용했거나 올바르지 않은 재설정 링크입니다.",
        });
      }

      return { success: true };
    }),

  /**
   * 성도 회원가입
   * - 가입 신청 후 관리자 승인 대기
   * - 이메일 중복 시 CONFLICT 에러 반환
   */
  register: publicProcedure
    .input(memberRegisterInputSchema)
    .mutation(async ({ input, ctx }) => {
      const clientIp = getClientIp(ctx.req);
      try {
        checkRegisterRateLimit(`register:${clientIp}`);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "회원가입 요청이 너무 많습니다.";
        throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: msg });
      }

      const fieldConfig = await getRegisterFieldConfig();
      assertRequiredRegisterFields(input, fieldConfig);
      await assertConfiguredRegisterOptions(input, fieldConfig);

      try {
        return await withMemberRegistrationIdentityLock(input.name, input.phone, async () => {
          const identityMatches = await getMembersByNameAndPhone(input.name, input.phone);
          if (identityMatches.length > 0) {
            throw new TRPCError({
              code: "CONFLICT",
              message: "이미 가입 신청된 이름과 연락처입니다. 로그인 또는 아이디·비밀번호 찾기를 이용해주세요.",
            });
          }

          const existing = await getMemberByEmail(input.email);
          if (existing) {
            throw new TRPCError({ code: "CONFLICT", message: "이미 사용 중인 이메일입니다." });
          }

          const bcrypt = await import("bcryptjs");
          const passwordHash = await bcrypt.hash(input.password, 10);
          const id = await createMember({
            email: input.email,
            passwordHash,
            name: input.name,
            phone: input.phone,
            birthDate: input.birthDate,
            gender: input.gender,
            address: visibleRegisterValue(input, fieldConfig, "address"),
            emergencyPhone: visibleRegisterValue(input, fieldConfig, "emergencyPhone"),
            joinPath: visibleRegisterValue(input, fieldConfig, "joinPath"),
            position: visibleRegisterValue(input, fieldConfig, "position"),
            department: visibleRegisterValue(input, fieldConfig, "department"),
            district: visibleRegisterValue(input, fieldConfig, "district"),
            faithPlusUserId: visibleRegisterValue(input, fieldConfig, "faithPlusUserId"),
          });

          ctx.res.clearCookie(MEMBER_SESSION_COOKIE, {
            ...getSessionCookieOptions(ctx.req),
          });
          void notifyMemberRegistration({
            memberId: id,
            name: input.name,
            position: visibleRegisterValue(input, fieldConfig, "position"),
          });

          return { success: true, id, autoLoggedIn: false };
        });
      } catch (error) {
        if (error instanceof MemberRegistrationBusyError) {
          throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: error.message });
        }
        throw error;
      }
    }),

  /**
   * 성도 로그인
   * - 이메일/비밀번호 검증 후 JWT 쿠키 발급
   */
    login: publicProcedure
    .input(z.object({
      email: memberEmailSchema,
      password: z.string().min(1, "비밀번호를 입력해주세요.").max(128, "비밀번호는 128자 이하로 입력해주세요."),
      autoLogin: z.boolean().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      // ── Rate Limit: IP 및 계정 기준 실패 횟수 제한 ───────────────────────
      const clientIp = getClientIp(ctx.req);
      const ipKey = `ip:${clientIp}`;
      const accountKey = `account:${input.email.toLowerCase()}`;
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

      await setMemberSessionCookie(ctx.req, ctx.res, {
        id: member.id,
        email: member.email,
        name: member.name,
        sessionVersion: member.sessionVersion,
      }, {
        persistent: input.autoLogin !== false,
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
    .mutation(async ({ ctx }) => {
      const domainLogoutIntent = await createDomainLogoutIntent(ctx.req, ctx.res, {
        memberId: ctx.memberId,
      });
      ctx.res.clearCookie(MEMBER_SESSION_COOKIE, {
        ...getSessionCookieOptions(ctx.req),
      });
      return { success: true, domainLogoutIntent };
    }),

  /**
   * 내 정보 조회 (쿠키 기반)
   * - 쿠키 없거나 만료 시 null 반환
   */
  me: publicProcedure
    .query(async ({ ctx }) => {
      const token = ctx.req.cookies?.[MEMBER_SESSION_COOKIE];
      if (!token) return null;

      try {
        const { jwtVerify } = await import("jose");
        const secret = getJwtSecretKey();
        const { payload } = await jwtVerify(token, secret);

        if (payload.type !== "church_member" || !payload.memberId) return null;

        const member = await getMemberById(payload.memberId as number);
        if (!member) return null;
        if (member.status !== "approved") return null;
        if (!isMemberSessionCurrent(payload, member.sessionVersion)) return null;

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
      phone: optionalMemberPhone,
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

  /**
   * 내 교회 정보 수정
   * - 승인된 성도 본인만 자기 교회 정보 필드를 수정할 수 있음
   * - status/adminMemo/소셜 연결 등 관리자 전용 필드는 제외
   */
  updateMyChurchInfo: memberProtectedProcedure
    .input(z.object({
      position: optionalText(64),
      department: optionalText(64),
      district: optionalText(64),
      baptismType: optionalText(32),
      baptismDate: editableChurchDate,
      registeredAt: editableChurchDate,
      pastor: optionalText(64),
    }))
    .mutation(async ({ input, ctx }) => {
      await updateMemberChurchInfo(ctx.memberId, input);
      return { success: true };
    }),

  /**
   * 내 비밀번호 변경
   * - 승인된 성도 본인만 변경할 수 있음
   * - 현재 비밀번호 확인 후 회원가입과 동일한 정책으로 새 비밀번호 저장
   */
  changeMyPassword: memberProtectedProcedure
    .input(z.object({
      currentPassword: z.string()
        .min(1, "현재 비밀번호를 입력해주세요.")
        .max(128, "현재 비밀번호는 128자 이하로 입력해주세요."),
      newPassword: memberPasswordSchema,
    }))
    .mutation(async ({ input, ctx }) => {
      const clientIp = getClientIp(ctx.req);
      const ipKey = `ip:password-change:${clientIp}`;
      const accountKey = `account:password-change:${ctx.memberId}`;

      try {
        checkRateLimit(ipKey);
        checkRateLimit(accountKey);
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : "비밀번호 확인 시도가 너무 많습니다.";
        throw new TRPCError({ code: "TOO_MANY_REQUESTS", message });
      }

      const member = await getMemberById(ctx.memberId);
      if (!member?.passwordHash) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "간편가입 계정은 연결된 계정으로 로그인하며 변경할 비밀번호가 없습니다.",
        });
      }

      const bcrypt = await import("bcryptjs");
      const currentPasswordMatches = await bcrypt.compare(input.currentPassword, member.passwordHash);
      if (!currentPasswordMatches) {
        recordFailure(ipKey);
        recordFailure(accountKey);
        throw new TRPCError({ code: "UNAUTHORIZED", message: "현재 비밀번호가 올바르지 않습니다." });
      }

      resetFailures(ipKey);
      resetFailures(accountKey);

      const passwordIsUnchanged = await bcrypt.compare(input.newPassword, member.passwordHash);
      if (passwordIsUnchanged) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "새 비밀번호는 현재 비밀번호와 다르게 입력해주세요." });
      }

      const passwordHash = await bcrypt.hash(input.newPassword, 10);
      await updateMemberPasswordHash(ctx.memberId, passwordHash);
      ctx.res.clearCookie(MEMBER_SESSION_COOKIE, {
        ...getSessionCookieOptions(ctx.req),
      });
      return { success: true, requiresLogin: true };
    }),

  /**
   * 성도 본인 탈퇴
   * - 개인정보/소셜 연결 삭제 또는 익명화
   * - 작성한 간증글/댓글은 삭제 상태로 전환
   */
  withdraw: memberProtectedProcedure
    .input(z.object({
      confirm: z.literal("탈퇴"),
    }))
    .mutation(async ({ ctx }) => {
      await withdrawMemberAndErasePersonalData(ctx.memberId);
      ctx.res.clearCookie(MEMBER_SESSION_COOKIE, {
        ...getSessionCookieOptions(ctx.req),
      });
      return { success: true };
    }),

  // ─── 관리자 전용 API ─────────────────────────────────────────────────────────

  /** 전체 성도 목록 (최고관리자 또는 회원가입 승인/교적부 권한자) */
  adminList: memberApprovalProcedure.query(async ({ ctx }) => {
    const members = await getAllMembers();
    return ctx.user.role === "admin"
      ? members.map(sanitizeMemberForAdmin)
      : members.map(sanitizeMemberForDirectoryManager);
  }),

  /** 승인 대기 성도 목록 (관리자) */
  pendingList: adminProcedure.query(async () => (await getPendingMembers()).map(sanitizeMemberForAdmin)),

  /** 최고관리자용 비밀번호 재설정 요청 목록 */
  passwordResetRequests: adminProcedure.query(() => getPendingMemberPasswordResetRequests()),

  /** 등록 연락처로 본인 확인을 마친 요청에 일회용 링크를 발급하고 성도 푸시로 전달합니다. */
  approvePasswordResetRequest: adminProcedure
    .input(z.object({ requestId: idSchema }))
    .mutation(async ({ input, ctx }) => {
      const resetToken = crypto.randomBytes(32).toString("base64url");
      const resetTokenHash = hashPasswordResetToken(resetToken);
      const resetTokenExpiresAt = new Date(Date.now() + MEMBER_PASSWORD_RESET_LINK_TTL_MS);
      const request = await approveMemberPasswordResetRequest(
        input.requestId,
        ctx.user.id,
        resetTokenHash,
        resetTokenExpiresAt,
      );
      if (!request) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "이미 처리됐거나 만료된 비밀번호 재설정 요청입니다.",
        });
      }

      const resetPath = `/member/password-reset?token=${encodeURIComponent(resetToken)}`;
      const pushResult = await notifyMemberPasswordResetApproved({
        memberId: request.memberId,
        resetPath,
        expiresAt: resetTokenExpiresAt,
      });

      return {
        success: true,
        resetPath,
        expiresAt: resetTokenExpiresAt,
        pushSentCount: pushResult.sentCount,
      };
    }),

  /** 회원가입 승인 권한 담당자용 승인 대기 목록 */
  approvalList: memberApprovalProcedure.query(async () =>
    (await getPendingMembers()).map(sanitizeMemberForApproval)
  ),

  /** 회원가입 승인 권한 담당자용 승인/거절 처리 */
  updateApprovalStatus: memberApprovalProcedure
    .input(z.object({
      id: idSchema,
      status: z.enum(["approved", "rejected"]),
    }))
    .mutation(async ({ input }) => {
      const updated = await decidePendingMemberRegistration(input.id, input.status);
      if (!updated) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "이미 처리됐거나 승인 대기 상태가 아닌 회원가입 신청입니다.",
        });
      }
      return { success: true };
    }),

  /** 회원가입 승인/교적부 권한자용 성도 정보 수정 (민감한 관리자 항목 제외) */
  directoryUpdate: memberApprovalProcedure
    .input(z.object({
      id: idSchema,
      name: requiredText(64, "이름을 입력해주세요.").optional(),
      phone: optionalMemberPhone,
      birthDate: optionalDate,
      gender: z.enum(["남", "여"]).optional(),
      address: optionalText(255),
      emergencyPhone: optionalText(32),
      email: memberEmailSchema.optional(),
      position: optionalText(64),
      department: optionalText(64),
      district: optionalText(64),
      baptismType: optionalText(32),
      baptismDate: optionalDate,
      registeredAt: optionalDate,
      pastor: optionalText(64),
      faithPlusUserId: optionalText(128),
    }))
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      await adminUpdateMember(id, data);
      return { success: true };
    }),

  /** 회원가입 승인/교적부 권한자용 일반 삭제 (복구 가능한 탈퇴 보관) */
  archiveMember: memberApprovalProcedure
    .input(z.object({ id: idSchema }))
    .mutation(async ({ input }) => {
      await updateMemberChurchInfo(input.id, { status: "withdrawn" });
      return { success: true };
    }),

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

  /** 성도 완전삭제 (관리자: 탈퇴 상태이며 연결 기록이 없는 경우만) */
  hardDelete: adminProcedure
    .input(z.object({ id: idSchema }))
    .mutation(async ({ input }) => {
      const result = await adminHardDeleteMember(input.id);

      if (result.deleted) return { success: true };

      if (result.reason === "not_found") {
        throw new TRPCError({ code: "NOT_FOUND", message: "이미 삭제되었거나 존재하지 않는 성도입니다." });
      }

      if (result.reason === "not_withdrawn") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "완전삭제는 탈퇴 상태 성도에게만 사용할 수 있습니다." });
      }

      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `연결된 기록이 있어 완전삭제할 수 없습니다. 탈퇴 보관으로 유지해주세요. (${result.related?.join(", ")})`,
      });
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
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      if (data.isActive === false) {
        await assertRequiredPositionOptionRemains(id);
      }
      return updateMemberFieldOption(id, data);
    }),

  /** 선택지 순서 변경 (관리자) */
  reorderFieldOptions: adminProcedure
    .input(z.array(z.object({
      id: idSchema,
      sortOrder: z.number().int().min(0).max(10000),
    })).min(1).max(500))
    .mutation(({ input }) => reorderMemberFieldOptions(input)),

  /** 선택지 삭제 (관리자) */
  deleteFieldOption: adminProcedure
    .input(z.object({ id: idSchema }))
    .mutation(async ({ input }) => {
      await assertRequiredPositionOptionRemains(input.id);
      return deleteMemberFieldOption(input.id);
    }),

  /**
   * 성도 전체 정보 수정 (관리자)
   * - 기본 정보 + 교회 정보 통합 수정
   */
  adminUpdate: adminProcedure
    .input(z.object({
      id: idSchema,
      name: requiredText(64, "이름을 입력해주세요.").optional(),
      phone: optionalMemberPhone,
      birthDate: optionalDate,
      gender: z.enum(["남", "여"]).optional(),
      address: optionalText(255),
      emergencyPhone: optionalText(32),
      email: memberEmailSchema.optional(),
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
      assignedDistricts: z.array(z.string().trim().max(64)).max(200).optional(),
    }))
    .mutation(async ({ input }) => {
      const { id, assignedDistricts, ...data } = input;
      await adminUpdateMember(id, data);
      if (assignedDistricts) {
        await setMemberDistrictAssignments(id, assignedDistricts);
      }
      return { success: true };
    }),

  /**
   * 성도 비밀번호 초기화 (관리자)
   * - 임시 비밀번호 8자 이상 필수
   * - 성도에게 임시 비밀번호를 별도로 전달해야 함
   */
  resetPassword: adminProcedure
    .input(z.object({
      id: idSchema,
      tempPassword: memberPasswordSchema,
    }))
    .mutation(({ input }) => adminResetMemberPassword(input.id, input.tempPassword)),
});
