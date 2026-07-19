import { useState, type FormEvent } from "react";
import { ArrowLeft, KeyRound, Search, ShieldCheck } from "lucide-react";
import { Link } from "wouter";
import BirthDateInput, { isCompleteBirthDate } from "@/components/BirthDateInput";
import { trpc } from "@/lib/trpc";
import {
  formatMemberPhoneInput,
  MEMBER_PHONE_ERROR_MESSAGE,
  normalizeMemberPhone,
} from "@shared/memberPhone";

export default function MemberAccountRecovery() {
  const [form, setForm] = useState({ name: "", phone: "", birthDate: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [requestSubmitted, setRequestSubmitted] = useState(false);

  const findMutation = trpc.members.findLoginId.useMutation({
    onSuccess: () => setRequestSubmitted(false),
  });
  const resetRequestMutation = trpc.members.requestPasswordReset.useMutation({
    onSuccess: () => setRequestSubmitted(true),
  });

  const update = (field: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: "", general: "" }));
    findMutation.reset();
    resetRequestMutation.reset();
    setRequestSubmitted(false);
  };

  const getValidatedIdentity = () => {
    const nextErrors: Record<string, string> = {};
    const name = form.name.trim();
    const phone = normalizeMemberPhone(form.phone);
    if (!name) nextErrors.name = "이름을 입력해주세요.";
    if (!form.phone.trim()) nextErrors.phone = "연락처를 입력해주세요.";
    else if (!phone) nextErrors.phone = MEMBER_PHONE_ERROR_MESSAGE;
    if (!form.birthDate) nextErrors.birthDate = "생년월일을 입력해주세요.";
    else if (!isCompleteBirthDate(form.birthDate)) nextErrors.birthDate = "생년월일을 YYYY-MM-DD 형식으로 입력해주세요.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0 || !phone) return null;
    return { name, phone, birthDate: form.birthDate };
  };

  const handleFind = (event: FormEvent) => {
    event.preventDefault();
    const identity = getValidatedIdentity();
    if (!identity) return;
    findMutation.mutate(identity);
  };

  const handleResetRequest = () => {
    const identity = getValidatedIdentity();
    if (!identity) return;
    resetRequestMutation.mutate(identity);
  };

  const accounts = findMutation.data?.accounts ?? [];
  const canRequestPasswordReset = accounts.some((account) => account.hasPassword);
  const inputClass = (field: keyof typeof form) =>
    `w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition focus:ring-2 focus:ring-[#1B5E20]/25 ${
      errors[field] ? "border-red-400" : "border-gray-300 focus:border-[#1B5E20]"
    }`;

  return (
    <div className="min-h-screen bg-[#FAFAF8]" style={{ fontFamily: "'Noto Sans KR', sans-serif" }}>
      <header className="border-b border-gray-200 bg-white px-4 py-4">
        <div className="mx-auto flex max-w-lg items-center justify-between">
          <Link href="/" className="flex flex-col leading-tight">
            <span className="text-lg font-bold text-[#1B5E20]" style={{ fontFamily: "'Noto Serif KR', serif" }}>
              기쁨의교회
            </span>
            <span className="text-[10px] uppercase tracking-widest text-gray-400">The Joyful Church</span>
          </Link>
          <Link href="/member/login" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-[#1B5E20]">
            <ArrowLeft className="h-4 w-4" /> 로그인
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 py-8">
        <div className="mb-7 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#E8F5E9] text-[#1B5E20]">
            <KeyRound className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: "'Noto Serif KR', serif" }}>
            아이디·비밀번호 찾기
          </h1>
          <p className="mt-2 text-sm leading-6 text-gray-500">
            가입할 때 입력한 이름, 연락처, 생년월일로 계정을 확인합니다.
          </p>
        </div>

        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
          <form onSubmit={handleFind} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">이름</label>
              <input
                value={form.name}
                onChange={(event) => update("name", event.target.value)}
                className={inputClass("name")}
                autoComplete="name"
                maxLength={64}
                placeholder="가입자 이름"
              />
              {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name}</p>}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">연락처</label>
              <input
                value={form.phone}
                onChange={(event) => update("phone", formatMemberPhoneInput(event.target.value))}
                className={inputClass("phone")}
                autoComplete="tel"
                inputMode="numeric"
                maxLength={13}
                placeholder="010-0000-0000"
              />
              {errors.phone && <p className="mt-1 text-xs text-red-500">{errors.phone}</p>}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">생년월일</label>
              <BirthDateInput
                value={form.birthDate}
                onChange={(value) => update("birthDate", value)}
                className={inputClass("birthDate")}
                aria-invalid={Boolean(errors.birthDate)}
              />
              {errors.birthDate && <p className="mt-1 text-xs text-red-500">{errors.birthDate}</p>}
            </div>

            <button
              type="submit"
              disabled={findMutation.isPending}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#1B5E20] py-3 text-sm font-semibold text-white transition hover:bg-[#154a18] disabled:opacity-50"
            >
              <Search className="h-4 w-4" />
              {findMutation.isPending ? "확인 중..." : "가입 계정 찾기"}
            </button>
          </form>

          {findMutation.error && (
            <p className="mt-4 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-600">
              {findMutation.error.message}
            </p>
          )}

          {findMutation.data && (
            <div className="mt-5 border-t border-gray-100 pt-5">
              {findMutation.data.found ? (
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-gray-800">확인된 가입 계정</p>
                  {accounts.map((account, index) => (
                    <div key={`${account.maskedEmail ?? "social"}-${index}`} className="rounded-xl border border-[#D8E8DA] bg-[#F8FCF8] p-4">
                      <p className="font-semibold text-[#1B5E20]">
                        {account.maskedEmail ?? "간편가입 계정"}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-gray-500">
                        {account.hasPassword ? "이메일과 비밀번호로 로그인하는 계정입니다." : "비밀번호 없이 간편가입으로 로그인하는 계정입니다."}
                        {account.socialProviders.length > 0 && ` (${account.socialProviders.join(" · ")})`}
                      </p>
                    </div>
                  ))}

                  {canRequestPasswordReset && !requestSubmitted && (
                    <button
                      type="button"
                      onClick={handleResetRequest}
                      disabled={resetRequestMutation.isPending}
                      className="flex w-full items-center justify-center gap-2 rounded-lg border border-amber-300 bg-amber-50 py-3 text-sm font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-50"
                    >
                      <ShieldCheck className="h-4 w-4" />
                      {resetRequestMutation.isPending ? "요청 중..." : "비밀번호 재설정 요청"}
                    </button>
                  )}

                  {resetRequestMutation.error && (
                    <p className="rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-600">
                      {resetRequestMutation.error.message}
                    </p>
                  )}

                  {requestSubmitted && (
                    <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm leading-6 text-green-800">
                      재설정 요청이 접수됐습니다. 관리자가 확인 후 등록된 연락처로 임시 비밀번호를 안내합니다.
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-xl bg-gray-50 px-4 py-4 text-sm leading-6 text-gray-600">
                  입력한 정보와 일치하는 가입 계정을 찾지 못했습니다. 정보를 다시 확인하거나 교회 사무실로 문의해주세요.
                </div>
              )}
            </div>
          )}
        </section>

        <div className="mt-5 rounded-xl border border-gray-200 bg-white px-4 py-3 text-center text-xs leading-5 text-gray-500">
          비밀번호는 보안상 기존 값을 보여드릴 수 없습니다.<br />
          교회 사무실 054-270-1000
        </div>
      </main>
    </div>
  );
}
