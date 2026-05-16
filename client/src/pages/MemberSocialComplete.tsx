import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";

type SignupContext = {
  provider: "google" | "kakao";
  providerLabel: string;
  email: string | null;
  displayName: string | null;
};

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
    email: "",
    agreePrivacy: false,
  });

  useEffect(() => {
    let active = true;
    fetch("/api/member-oauth/signup-context")
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
    if (!form.phone.trim()) nextErrors.phone = "연락처를 입력해주세요.";
    if (!form.birthDate.trim()) {
      nextErrors.birthDate = "생년월일을 입력해주세요.";
    } else if (!/^\d{4}-\d{2}-\d{2}$/.test(form.birthDate)) {
      nextErrors.birthDate = "YYYY-MM-DD 형식으로 입력해주세요.";
    }
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      nextErrors.email = "올바른 이메일 형식이 아닙니다.";
    }
    if (!form.agreePrivacy) {
      nextErrors.agreePrivacy = "개인정보 수집 및 이용에 동의해주세요.";
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/member-oauth/complete-signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          phone: form.phone,
          birthDate: form.birthDate,
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

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              이름 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
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
              value={form.phone}
              onChange={(e) => update("phone", e.target.value)}
              placeholder="010-0000-0000"
              className={inputClass("phone")}
            />
            {errors.phone && <p className="text-xs text-red-500 mt-1">{errors.phone}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              생년월일 <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={form.birthDate}
              onChange={(e) => update("birthDate", e.target.value)}
              className={inputClass("birthDate")}
            />
            {errors.birthDate && <p className="text-xs text-red-500 mt-1">{errors.birthDate}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">이메일</label>
            <input
              type="email"
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
