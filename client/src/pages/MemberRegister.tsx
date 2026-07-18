/**
 * MemberRegister.tsx
 * 성도 회원가입 페이지
 * - 기본 정보 입력 (이름, 이메일, 비밀번호, 연락처, 생년월일, 성별)
 * - 교회 정보 선택 (부서, 구역 - 관리자가 미리 등록한 선택지에서 선택)
 * - 개인정보 수집 동의
 */
import { useState } from "react";
import { Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import BirthDateInput, { isCompleteBirthDate } from "@/components/BirthDateInput";
import MemberSocialAuthButtons from "@/components/MemberSocialAuthButtons";
import {
  MEMBER_REGISTER_FIELD_CONFIG_KEY,
  parseMemberRegisterFieldConfig,
  type MemberRegisterFieldKey,
} from "@shared/memberRegisterFields";
import {
  formatMemberPhoneInput,
  MEMBER_PHONE_ERROR_MESSAGE,
  normalizeMemberPhone,
} from "@shared/memberPhone";

const PASSWORD_HAS_LETTER = /[A-Za-z]/;
const PASSWORD_HAS_NUMBER = /\d/;
const EMAIL_MAX_LENGTH = 128;
const MEMBER_REGISTER_GUIDE_TITLE_KEY = "member_register_guide_title";
const MEMBER_REGISTER_GUIDE_TEXT_KEY = "member_register_guide_text";
const DEFAULT_MEMBER_REGISTER_GUIDE_TITLE = "기쁨의교회 등록 성도 전용 가입 안내";
const DEFAULT_MEMBER_REGISTER_GUIDE_TEXT =
  "이 회원가입은 기쁨의교회 성도만 신청할 수 있습니다. 방문자나 외부인의 회원가입 관련 문의는 교회 안내 또는 사무실로 문의해 주세요.";

export default function MemberRegister() {
  const [, navigate] = useLocation();
  const [step, setStep] = useState<1 | 2>(1); // 1: 기본정보, 2: 교회정보

  // 폼 상태
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    passwordConfirm: "",
    phone: "",
    birthDate: "",
    gender: "" as "남" | "여" | "",
    address: "",
    emergencyPhone: "",
    joinPath: "",
    position: "",
    department: "",
    district: "",
    faithPlusUserId: "",
    agreePrivacy: false,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const utils = trpc.useUtils();

  // 선택지 불러오기
  const { data: positionOptions = [] } = trpc.members.fieldOptions.useQuery({ fieldType: "position" });
  const { data: deptOptions = [] } = trpc.members.fieldOptions.useQuery({ fieldType: "department" });
  const { data: districtOptions = [] } = trpc.members.fieldOptions.useQuery({ fieldType: "district" });
  const { data: settings } = trpc.home.settings.useQuery();
  const guideTitle = settings?.[MEMBER_REGISTER_GUIDE_TITLE_KEY] || DEFAULT_MEMBER_REGISTER_GUIDE_TITLE;
  const guideText = settings?.[MEMBER_REGISTER_GUIDE_TEXT_KEY] || DEFAULT_MEMBER_REGISTER_GUIDE_TEXT;
  const fieldConfig = parseMemberRegisterFieldConfig(settings?.[MEMBER_REGISTER_FIELD_CONFIG_KEY]);
  const isFieldVisible = (field: MemberRegisterFieldKey) => fieldConfig[field].visible;
  const isFieldRequired = (field: MemberRegisterFieldKey) => fieldConfig[field].visible && fieldConfig[field].required;

  // 회원가입 뮤테이션
  const registerMutation = trpc.members.register.useMutation({
    onSuccess: async () => {
      toast.success("회원가입 신청이 접수되었습니다. 관리자 승인 후 로그인하실 수 있습니다.");
      await utils.members.me.invalidate();
      navigate("/member/login?social=pending");
    },
    onError: (e) => {
      if (e.message.includes("이미 사용 중인")) {
        setErrors(prev => ({ ...prev, email: "이미 사용 중인 이메일입니다." }));
      } else {
        toast.error(e.message || "회원가입에 실패했습니다.");
      }
    },
  });

  const update = (field: string, value: string | boolean) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setErrors(prev => ({ ...prev, [field]: "" }));
  };

  const validateStep1 = () => {
    const newErrors: Record<string, string> = {};
    if (!form.name.trim()) newErrors.name = "이름을 입력해주세요.";
    if (!form.email.trim()) newErrors.email = "이메일을 입력해주세요.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) newErrors.email = "올바른 이메일 형식이 아닙니다.";
    else if (form.email.trim().length > EMAIL_MAX_LENGTH) newErrors.email = "이메일은 128자 이하로 입력해주세요.";
    if (!form.password) newErrors.password = "비밀번호를 입력해주세요.";
    else if (form.password.length < 8) newErrors.password = "비밀번호는 8자 이상이어야 합니다.";
    else if (!PASSWORD_HAS_LETTER.test(form.password) || !PASSWORD_HAS_NUMBER.test(form.password)) {
      newErrors.password = "비밀번호는 영문과 숫자를 모두 포함해야 합니다.";
    }
    if (form.password !== form.passwordConfirm) newErrors.passwordConfirm = "비밀번호가 일치하지 않습니다.";
    if (isFieldRequired("phone") && !form.phone.trim()) {
      newErrors.phone = "연락처를 입력해주세요.";
    } else if (form.phone.trim() && !normalizeMemberPhone(form.phone)) {
      newErrors.phone = MEMBER_PHONE_ERROR_MESSAGE;
    }
    if (form.birthDate && !isCompleteBirthDate(form.birthDate)) {
      newErrors.birthDate = "생년월일은 YYYY-MM-DD 형식으로 입력해주세요.";
    }
    if (isFieldRequired("birthDate") && !form.birthDate) newErrors.birthDate = "생년월일을 입력해주세요.";
    if (isFieldRequired("gender") && !form.gender) newErrors.gender = "성별을 선택해주세요.";
    if (isFieldRequired("address") && !form.address.trim()) newErrors.address = "주소를 입력해주세요.";
    if (isFieldRequired("emergencyPhone") && !form.emergencyPhone.trim()) newErrors.emergencyPhone = "비상연락처를 입력해주세요.";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep2 = () => {
    const newErrors: Record<string, string> = {};
    if (isFieldRequired("position") && !form.position.trim()) newErrors.position = "직분을 선택해주세요.";
    if (isFieldRequired("department") && !form.department.trim()) newErrors.department = "소속 부서를 선택해주세요.";
    if (isFieldRequired("district") && !form.district.trim()) newErrors.district = "구역/순을 선택해주세요.";
    if (isFieldRequired("faithPlusUserId") && !form.faithPlusUserId.trim()) newErrors.faithPlusUserId = "믿음PLUS 사용자 ID를 입력해주세요.";
    if (isFieldRequired("joinPath") && !form.joinPath.trim()) newErrors.joinPath = "가입 경로를 선택해주세요.";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (!validateStep1()) return;
    const phone = normalizeMemberPhone(form.phone);
    if (phone) setForm((prev) => ({ ...prev, phone }));
    setStep(2);
  };

  const handleSubmit = () => {
    if (!validateStep1()) {
      setStep(1);
      return;
    }
    if (!validateStep2()) return;
    if (!form.agreePrivacy) {
      toast.error("개인정보 수집 및 이용에 동의해주세요.");
      return;
    }
    const phone = normalizeMemberPhone(form.phone);
    if (!phone || !form.birthDate || !form.gender) {
      setStep(1);
      return;
    }
    registerMutation.mutate({
      name: form.name,
      email: form.email,
      password: form.password,
      phone,
      birthDate: form.birthDate,
      gender: form.gender,
      address: isFieldVisible("address") ? form.address || undefined : undefined,
      emergencyPhone: isFieldVisible("emergencyPhone") ? form.emergencyPhone || undefined : undefined,
      joinPath: isFieldVisible("joinPath") ? form.joinPath || undefined : undefined,
      position: form.position,
      department: isFieldVisible("department") ? form.department || undefined : undefined,
      district: isFieldVisible("district") ? form.district || undefined : undefined,
      faithPlusUserId: isFieldVisible("faithPlusUserId") ? form.faithPlusUserId || undefined : undefined,
    });
  };

  return (
    <div className="min-h-screen bg-[#FAFAF8]" style={{ fontFamily: "'Noto Sans KR', sans-serif" }}>
      {/* 헤더 */}
      <header className="bg-white border-b border-gray-200 px-4 py-4">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <Link href="/" className="flex flex-col leading-tight">
            <span className="text-lg font-bold text-[#1B5E20]" style={{ fontFamily: "'Noto Serif KR', serif" }}>
              기쁨의교회
            </span>
            <span className="text-[10px] text-gray-400 tracking-widest uppercase">The Joyful Church</span>
          </Link>
          <Link href="/member/login" className="text-sm text-gray-500 hover:text-[#1B5E20]">
            이미 계정이 있으신가요? <span className="font-medium text-[#1B5E20]">로그인</span>
          </Link>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-8">
        {/* 제목 */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: "'Noto Serif KR', serif" }}>
            성도 회원가입
          </h1>
          <p className="text-sm text-gray-500 mt-2">
            기쁨의교회 온라인 서비스를 이용하시려면 회원가입이 필요합니다.
          </p>
        </div>

        <div className="mb-6 rounded-2xl border border-[#D8E8DA] bg-[#F8FCF8] px-4 py-4 text-sm leading-6 text-[#1B5E20] [&>p:nth-of-type(n+3)]:hidden">
          <p className="font-semibold">{guideTitle}</p>
          <p className="mt-1 whitespace-pre-line text-[#356046]">{guideText}</p>
          <p className="font-semibold">기쁨의교회 등록 성도 전용 가입 안내</p>
          <p className="mt-1 text-[#356046]">
            이 회원가입은 기쁨의교회 성도만 신청할 수 있습니다. 방문자나 외부인은 회원가입 대신 교회 안내 또는 사무실로 문의해 주세요.
          </p>
        </div>

        <div className="mb-8">
          <MemberSocialAuthButtons mode="register" />
        </div>

        {/* 진행 단계 표시 */}
        <div className="flex items-center justify-center mb-8">
          <div className="flex items-center gap-3">
            <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${
              step >= 1 ? "bg-[#1B5E20] text-white" : "bg-gray-200 text-gray-500"
            }`}>1</div>
            <span className={`text-sm ${step === 1 ? "text-[#1B5E20] font-medium" : "text-gray-400"}`}>기본 정보</span>
            <div className="w-8 h-0.5 bg-gray-300"></div>
            <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${
              step >= 2 ? "bg-[#1B5E20] text-white" : "bg-gray-200 text-gray-500"
            }`}>2</div>
            <span className={`text-sm ${step === 2 ? "text-[#1B5E20] font-medium" : "text-gray-400"}`}>교회 정보</span>
          </div>
        </div>

        {/* 폼 카드 */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          {step === 1 ? (
            /* ─── 1단계: 기본 정보 ─── */
            <div className="space-y-4">
              <h2 className="text-base font-bold text-gray-800 mb-4">기본 정보 입력</h2>

              {/* 이름 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  이름 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  autoComplete="name"
                  maxLength={64}
                  value={form.name}
                  onChange={(e) => update("name", e.target.value)}
                  placeholder="실명을 입력해주세요"
                  className={`w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B5E20]/30 ${
                    errors.name ? "border-red-400" : "border-gray-300"
                  }`}
                />
                {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
              </div>

              {/* 이메일 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  이메일 <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  autoComplete="email"
                  maxLength={EMAIL_MAX_LENGTH}
                  value={form.email}
                  onChange={(e) => update("email", e.target.value)}
                  placeholder="example@email.com"
                  className={`w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B5E20]/30 ${
                    errors.email ? "border-red-400" : "border-gray-300"
                  }`}
                />
                {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
              </div>

              {/* 비밀번호 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  비밀번호 <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  autoComplete="new-password"
                  maxLength={128}
                  value={form.password}
                  onChange={(e) => update("password", e.target.value)}
                  placeholder="8자 이상, 영문과 숫자 포함"
                  className={`w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B5E20]/30 ${
                    errors.password ? "border-red-400" : "border-gray-300"
                  }`}
                />
                {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password}</p>}
              </div>

              {/* 비밀번호 확인 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  비밀번호 확인 <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  autoComplete="new-password"
                  maxLength={128}
                  value={form.passwordConfirm}
                  onChange={(e) => update("passwordConfirm", e.target.value)}
                  placeholder="비밀번호를 한 번 더 입력해주세요"
                  className={`w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B5E20]/30 ${
                    errors.passwordConfirm ? "border-red-400" : "border-gray-300"
                  }`}
                />
                {errors.passwordConfirm && <p className="text-xs text-red-500 mt-1">{errors.passwordConfirm}</p>}
              </div>

              {/* 연락처 */}
              {isFieldVisible("phone") && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  연락처 {isFieldRequired("phone") && <span className="text-red-500">*</span>}
                </label>
                <input
                  type="tel"
                  autoComplete="tel"
                  inputMode="numeric"
                  maxLength={32}
                  value={form.phone}
                  onChange={(e) => update("phone", formatMemberPhoneInput(e.target.value))}
                  onBlur={() => {
                    const phone = normalizeMemberPhone(form.phone);
                    if (phone) update("phone", phone);
                  }}
                  placeholder="010-0000-0000"
                  className={`w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B5E20]/30 ${
                    errors.phone ? "border-red-400" : "border-gray-300"
                  }`}
                />
                {errors.phone && <p className="text-xs text-red-500 mt-1">{errors.phone}</p>}
                {!errors.phone && <p className="text-xs text-gray-400 mt-1">010 휴대전화번호만 입력할 수 있습니다.</p>}
              </div>
              )}

              {/* 생년월일 + 성별 */}
              {(isFieldVisible("birthDate") || isFieldVisible("gender")) && (
              <div className="grid grid-cols-2 gap-3">
                {isFieldVisible("birthDate") && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    생년월일 {isFieldRequired("birthDate") && <span className="text-red-500">*</span>}
                  </label>
                  <BirthDateInput
                    value={form.birthDate}
                    onChange={(value) => update("birthDate", value)}
                    className={`w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B5E20]/30 ${
                      errors.birthDate ? "border-red-400" : "border-gray-300"
                    }`}
                    aria-invalid={Boolean(errors.birthDate)}
                  />
                  {errors.birthDate && <p className="text-xs text-red-500 mt-1">{errors.birthDate}</p>}
                </div>
                )}
                {isFieldVisible("gender") && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    성별 {isFieldRequired("gender") && <span className="text-red-500">*</span>}
                  </label>
                  <div className="flex gap-2 mt-1">
                    {(["남", "여"] as const).map((g) => (
                      <button
                        key={g}
                        type="button"
                        onClick={() => update("gender", g)}
                        className={`flex-1 py-2.5 text-sm rounded-lg border font-medium transition-colors ${
                          form.gender === g
                            ? "bg-[#1B5E20] text-white border-[#1B5E20]"
                            : "bg-white text-gray-600 border-gray-300 hover:border-[#1B5E20]"
                        }`}
                      >
                        {g}
                      </button>
                    ))}
                  </div>
                  {errors.gender && <p className="text-xs text-red-500 mt-1">{errors.gender}</p>}
                </div>
                )}
              </div>
              )}

              {isFieldVisible("address") && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    주소 {isFieldRequired("address") && <span className="text-red-500">*</span>}
                  </label>
                  <input
                    type="text"
                    autoComplete="street-address"
                    maxLength={255}
                    value={form.address}
                    onChange={(e) => update("address", e.target.value)}
                    placeholder="주소를 입력해주세요"
                    className={`w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B5E20]/30 ${
                      errors.address ? "border-red-400" : "border-gray-300"
                    }`}
                  />
                  {errors.address && <p className="text-xs text-red-500 mt-1">{errors.address}</p>}
                </div>
              )}

              {isFieldVisible("emergencyPhone") && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    비상연락처 {isFieldRequired("emergencyPhone") && <span className="text-red-500">*</span>}
                  </label>
                  <input
                    type="tel"
                    inputMode="tel"
                    maxLength={32}
                    value={form.emergencyPhone}
                    onChange={(e) => update("emergencyPhone", e.target.value)}
                    placeholder="010-0000-0000"
                    className={`w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B5E20]/30 ${
                      errors.emergencyPhone ? "border-red-400" : "border-gray-300"
                    }`}
                  />
                  {errors.emergencyPhone && <p className="text-xs text-red-500 mt-1">{errors.emergencyPhone}</p>}
                </div>
              )}

              <button
                onClick={handleNext}
                className="w-full py-3 bg-[#1B5E20] text-white rounded-lg font-medium hover:bg-[#154a18] transition-colors mt-2"
              >
                다음 단계 →
              </button>
            </div>
          ) : (
            /* ─── 2단계: 교회 정보 ─── */
            <div className="space-y-4">
              <h2 className="text-base font-bold text-gray-800 mb-1">교회 정보 입력</h2>
              <p className="text-xs text-gray-500 mb-4">
                별표(*) 항목은 필수이며, 나머지는 모르시면 비워두셔도 됩니다.
              </p>

              {/* 직분 */}
              {isFieldVisible("position") && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  직분 {isFieldRequired("position") && <span className="text-red-500">*</span>}
                </label>
                {positionOptions.length > 0 ? (
                  <select
                    value={form.position}
                    onChange={(e) => update("position", e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B5E20]/30"
                  >
                    <option value="">직분 선택</option>
                    {positionOptions.map((opt) => (
                      <option key={opt.id} value={opt.label}>{opt.label}</option>
                    ))}
                  </select>
                ) : (
                  <p className={`py-2 text-sm ${isFieldRequired("position") ? "font-medium text-red-500" : "text-gray-400"}`}>
                    등록된 직분이 없습니다. 관리자에게 문의하세요.
                  </p>
                )}
                {errors.position && <p className="text-xs text-red-500 mt-1">{errors.position}</p>}
              </div>
              )}

              {/* 소속 부서 */}
              {isFieldVisible("department") && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  소속 부서 {isFieldRequired("department") && <span className="text-red-500">*</span>}
                </label>
                {deptOptions.length > 0 ? (
                  <select
                    value={form.department}
                    onChange={(e) => update("department", e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B5E20]/30"
                  >
                    <option value="">선택 안 함</option>
                    {deptOptions.map((opt) => (
                      <option key={opt.id} value={opt.label}>{opt.label}</option>
                    ))}
                  </select>
                ) : (
                  <p className="text-sm text-gray-400 py-2">등록된 부서가 없습니다. 관리자에게 문의하세요.</p>
                )}
                {errors.department && <p className="text-xs text-red-500 mt-1">{errors.department}</p>}
              </div>
              )}

              {/* 구역/순 */}
              {isFieldVisible("district") && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  구역 / 순 {isFieldRequired("district") && <span className="text-red-500">*</span>}
                </label>
                {districtOptions.length > 0 ? (
                  <select
                    value={form.district}
                    onChange={(e) => update("district", e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B5E20]/30"
                  >
                    <option value="">선택 안 함</option>
                    {districtOptions.map((opt) => (
                      <option key={opt.id} value={opt.label}>{opt.label}</option>
                    ))}
                  </select>
                ) : (
                  <p className="text-sm text-gray-400 py-2">등록된 구역이 없습니다. 관리자에게 문의하세요.</p>
                )}
                {errors.district && <p className="text-xs text-red-500 mt-1">{errors.district}</p>}
              </div>
              )}

              {/* 믿음PLUS 유저 ID */}
              {isFieldVisible("faithPlusUserId") && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  믿음PLUS 사용자 ID {isFieldRequired("faithPlusUserId") && <span className="text-red-500">*</span>}
                </label>
                <input
                  type="text"
                  maxLength={128}
                  value={form.faithPlusUserId}
                  onChange={(e) => update("faithPlusUserId", e.target.value)}
                  placeholder="믿음PLUS 앱에서 확인한 유저 ID를 입력하세요"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B5E20]/30"
                />
                <p className="text-xs text-gray-400 mt-1">
                  믿음PLUS 앱을 사용하신다면 입력해주세요. 나중에 마이페이지에서도 입력하실 수 있습니다.
                </p>
                {errors.faithPlusUserId && <p className="text-xs text-red-500 mt-1">{errors.faithPlusUserId}</p>}
              </div>
              )}

              {/* 가입 경로 */}
              {isFieldVisible("joinPath") && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  가입 경로 {isFieldRequired("joinPath") && <span className="text-red-500">*</span>}
                </label>
                <select
                  value={form.joinPath}
                  onChange={(e) => update("joinPath", e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B5E20]/30"
                >
                  <option value="">선택 안 함</option>
                  <option value="지인 소개">지인 소개</option>
                  <option value="인터넷 검색">인터넷 검색</option>
                  <option value="SNS">SNS (유튜브/인스타그램 등)</option>
                  <option value="현수막/전단지">현수막 / 전단지</option>
                  <option value="기타">기타</option>
                </select>
                {errors.joinPath && <p className="text-xs text-red-500 mt-1">{errors.joinPath}</p>}
              </div>
              )}

              {/* 개인정보 동의 */}
              <div className="bg-gray-50 rounded-lg p-4 mt-2">
                <p className="text-xs text-gray-600 mb-3 leading-relaxed">
                  <strong>개인정보 수집 및 이용 동의</strong><br />
                  수집 항목: 이름, 이메일 및 가입 양식에 표시된 기본·교회 정보<br />
                  수집 목적: 교회 회원 관리 및 온라인 서비스 제공<br />
                  보유 기간: 회원 탈퇴 시까지<br />
                  귀하는 개인정보 수집에 동의를 거부할 권리가 있으나, 거부 시 서비스 이용이 제한됩니다.
                </p>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.agreePrivacy}
                    onChange={(e) => update("agreePrivacy", e.target.checked)}
                    className="w-4 h-4 accent-[#1B5E20]"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    개인정보 수집 및 이용에 동의합니다. <span className="text-red-500">*</span>
                  </span>
                </label>
              </div>

              <div className="flex gap-3 mt-2">
                <button
                  onClick={() => setStep(1)}
                  className="flex-1 py-3 border border-gray-300 text-gray-600 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                >
                  ← 이전
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={registerMutation.isPending || !form.agreePrivacy}
                  className="flex-2 flex-grow py-3 bg-[#1B5E20] text-white rounded-lg font-medium hover:bg-[#154a18] transition-colors disabled:opacity-50"
                >
                  {registerMutation.isPending ? "처리 중..." : "회원가입 완료"}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 하단 안내 */}
        <p className="text-center text-xs text-gray-400 mt-6">
          회원가입 후 관리자 승인이 완료되면 로그인하실 수 있습니다.
        </p>
      </div>
    </div>
  );
}
