import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";
import BirthDateInput, { isCompleteBirthDate } from "@/components/BirthDateInput";
import {
  formatMemberPhoneInput,
  MEMBER_PHONE_ERROR_MESSAGE,
  normalizeMemberPhone,
} from "@shared/memberPhone";
import { trpc } from "@/lib/trpc";
import {
  MEMBER_REGISTER_FIELD_CONFIG_KEY,
  parseMemberRegisterFieldConfig,
} from "@shared/memberRegisterFields";

type SignupContext = {
  provider: "google" | "kakao";
  providerLabel: string;
  email: string | null;
  displayName: string | null;
};

const EMAIL_MAX_LENGTH = 128;

export default function MemberSocialComplete() {
  const [, navigate] = useLocation();
  const [context, setContext] = useState<SignupContext | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    name: "",
    phone: "",
    birthDate: "",
    gender: "" as "남" | "여" | "",
    position: "",
    email: "",
    agreePrivacy: false,
  });
  const { data: positionOptions = [] } = trpc.members.fieldOptions.useQuery({ fieldType: "position" });
  const { data: settings } = trpc.home.settings.useQuery();
  const fieldConfig = parseMemberRegisterFieldConfig(settings?.[MEMBER_REGISTER_FIELD_CONFIG_KEY]);

  useEffect(() => {
    let active = true;
    fetch("/api/member-oauth/signup-context", { credentials: "same-origin" })
      .then(async (response) => {
        if (!response.ok) throw new Error("expired");
        return response.json() as Promise<SignupContext>;
      })
      .then((data) => {
        if (!active) return;
        setContext(data);
        setForm((prev) => ({
          ...prev,
          name: data.displayName ?? "",
          email: data.email ?? "",
        }));
      })
      .catch(() => {
        toast.error("간편가입 정보가 만료되었습니다. 다시 시도해주세요.");
        navigate("/member/register");
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [navigate]);

  const update = (field: keyof typeof form, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: "" }));
  };

  const validate = () => {
    const nextErrors: Record<string, string> = {};
    if (!form.name.trim()) nextErrors.name = "이름을 입력해주세요.";
    if (!form.phone.trim()) {
      nextErrors.phone = "연락처를 입력해주세요.";
    } else if (!normalizeMemberPhone(form.phone)) {
      nextErrors.phone = MEMBER_PHONE_ERROR_MESSAGE;
    }
    if (!form.birthDate.trim()) {
      nextErrors.birthDate = "생년월일을 입력해주세요.";
    } else if (!isCompleteBirthDate(form.birthDate)) {
      nextErrors.birthDate = "YYYY-MM-DD 형식으로 입력해주세요.";
    }
    if (!form.gender) {
      nextErrors.gender = "성별을 선택해주세요.";
    }
    if (!form.position.trim()) {
      nextErrors.position = "직분을 선택해주세요.";
    }
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      nextErrors.email = "올바른 이메일 형식이 아닙니다.";
    } else if (form.email.trim().length > EMAIL_MAX_LENGTH) {
      nextErrors.email = "이메일은 128자 이하로 입력해주세요.";
    }
    if (!form.agreePrivacy) {
      nextErrors.agreePrivacy = "개인정보 수집 및 이용에 동의해주세요.";
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    const phone = normalizeMemberPhone(form.phone);
    if (!phone) return;
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/member-oauth/complete-signup", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          phone,
          birthDate: form.birthDate,
          gender: form.gender,
          position: form.position,
          email: form.email || undefined,
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.message || "간편가입에 실패했습니다.");
      }
      toast.success("회원가입 신청이 접수되었습니다. 관리자 승인 후 로그인하실 수 있습니다.");
      navigate("/member/login?social=registered");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "간편가입에 실패했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputClass = (field: keyof typeof form) =>
    `w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B5E20]/30 ${
      errors[field] ? "border-red-400" : "border-gray-300"
    }`;

  if (isLoading || !context) {
    return (
      <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center" style={{ fontFamily: "'Noto Sans KR', sans-serif" }}>
        <p className="text-sm text-gray-500">확인 중...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAF8]" style={{ fontFamily: "'Noto Sans KR', sans-serif" }}>
      <header className="bg-white border-b border-gray-200 px-4 py-4">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <Link href="/" className="flex flex-col leading-tight">
            <span className="text-lg font-bold text-[#1B5E20]" style={{ fontFamily: "'Noto Serif KR', serif" }}>
              기쁨의교회
            </span>
            <span className="text-[10px] text-gray-400 tracking-widest uppercase">The Joyful Church</span>
          </Link>
          <Link href="/member/login" className="text-sm text-gray-500 hover:text-[#1B5E20]">
            로그인
          </Link>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: "'Noto Serif KR', serif" }}>
            간편가입 정보 입력
          </h1>
          <p className="text-sm text-gray-500 mt-2">
            {context.providerLabel} 계정 확인이 완료되었습니다.
          </p>
        </div>

        <div className="mb-6 rounded-2xl border border-[#D8E8DA] bg-[#F8FCF8] px-4 py-4 text-sm leading-6 text-[#1B5E20]">
          <p className="font-semibold">기쁨의교회 등록 성도 전용 가입 안내</p>
          <p className="mt-1 text-[#356046]">
            간편가입도 기쁨의교회 성도만 신청할 수 있습니다. 방문자나 외부인은 회원가입 대신 교회 안내 또는 사무실로 문의해 주세요.
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
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
              className={inputClass("name")}
            />
            {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              연락처 <span className="text-red-500">*</span>
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
              className={inputClass("phone")}
            />
            {errors.phone && <p className="text-xs text-red-500 mt-1">{errors.phone}</p>}
            {!errors.phone && <p className="text-xs text-gray-400 mt-1">010 휴대전화번호만 입력할 수 있습니다.</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              생년월일 <span className="text-red-500">*</span>
            </label>
            <BirthDateInput
              value={form.birthDate}
              onChange={(value) => update("birthDate", value)}
              className={inputClass("birthDate")}
              required
              aria-invalid={Boolean(errors.birthDate)}
            />
            {errors.birthDate && <p className="text-xs text-red-500 mt-1">{errors.birthDate}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              성별 <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-2">
              {(["남", "여"] as const).map((gender) => (
                <button
                  key={gender}
                  type="button"
                  onClick={() => update("gender", gender)}
                  className={`flex-1 rounded-lg border py-2.5 text-sm font-medium transition-colors ${
                    form.gender === gender
                      ? "border-[#1B5E20] bg-[#1B5E20] text-white"
                      : "border-gray-300 bg-white text-gray-600 hover:border-[#1B5E20]"
                  }`}
                >
                  {gender}
                </button>
              ))}
            </div>
            {errors.gender && <p className="text-xs text-red-500 mt-1">{errors.gender}</p>}
          </div>

          {fieldConfig.position.visible && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                직분 {fieldConfig.position.required && <span className="text-red-500">*</span>}
              </label>
              {positionOptions.length > 0 ? (
                <select
                  value={form.position}
                  onChange={(e) => update("position", e.target.value)}
                  className={inputClass("position")}
                >
                  <option value="">직분 선택</option>
                  {positionOptions.map((option) => (
                    <option key={option.id} value={option.label}>{option.label}</option>
                  ))}
                </select>
              ) : (
                <p className={`py-2 text-sm ${fieldConfig.position.required ? "font-medium text-red-500" : "text-gray-400"}`}>
                  등록된 직분이 없습니다. 관리자에게 문의하세요.
                </p>
              )}
              {errors.position && <p className="text-xs text-red-500 mt-1">{errors.position}</p>}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">이메일</label>
            <input
              type="email"
              autoComplete="email"
              maxLength={EMAIL_MAX_LENGTH}
              value={form.email}
              onChange={(e) => update("email", e.target.value)}
              placeholder="example@email.com"
              disabled={Boolean(context.email)}
              className={`${inputClass("email")} disabled:bg-gray-50 disabled:text-gray-500`}
            />
            {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
          </div>

          <label className="flex items-start gap-2 p-3 bg-gray-50 rounded-lg cursor-pointer">
            <input
              type="checkbox"
              checked={form.agreePrivacy}
              onChange={(e) => update("agreePrivacy", e.target.checked)}
              className="mt-0.5"
            />
            <span className="text-xs text-gray-600">
              개인정보 수집 및 이용에 동의합니다.
            </span>
          </label>
          {errors.agreePrivacy && <p className="text-xs text-red-500">{errors.agreePrivacy}</p>}

          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="w-full py-3 bg-[#1B5E20] text-white rounded-lg font-medium hover:bg-[#154a18] transition-colors disabled:opacity-50"
          >
            {isSubmitting ? "신청 중..." : "가입 신청"}
          </button>
        </div>
      </div>
    </div>
  );
}
