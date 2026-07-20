import { useMemo, useState, type FormEvent } from "react";
import { ArrowLeft, CheckCircle2, KeyRound, ShieldCheck } from "lucide-react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";

export default function MemberPasswordReset() {
  const token = useMemo(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("token")?.trim() ?? "";
  }, []);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [localError, setLocalError] = useState("");

  const resetMutation = trpc.members.completePasswordReset.useMutation();

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setLocalError("");
    if (!token) {
      setLocalError("재설정 링크가 올바르지 않습니다. 관리자에게 새 링크를 요청해주세요.");
      return;
    }
    if (newPassword.length < 8 || !/[A-Za-z]/.test(newPassword) || !/\d/.test(newPassword)) {
      setLocalError("새 비밀번호는 영문과 숫자를 포함하여 8자 이상 입력해주세요.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setLocalError("새 비밀번호와 확인 값이 일치하지 않습니다.");
      return;
    }
    resetMutation.mutate({ token, newPassword });
  };

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
            새 비밀번호 설정
          </h1>
          <p className="mt-2 text-sm leading-6 text-gray-500">
            관리자 본인 확인이 완료되었습니다. 링크는 24시간 동안 한 번만 사용할 수 있습니다.
          </p>
        </div>

        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
          {resetMutation.isSuccess ? (
            <div className="space-y-4 text-center">
              <CheckCircle2 className="mx-auto h-12 w-12 text-[#1B5E20]" />
              <div>
                <p className="font-bold text-gray-900">비밀번호가 변경되었습니다.</p>
                <p className="mt-1 text-sm leading-6 text-gray-500">기존 로그인은 안전하게 해제됐습니다. 새 비밀번호로 로그인해주세요.</p>
              </div>
              <Link href="/member/login" className="block rounded-lg bg-[#1B5E20] py-3 text-sm font-semibold text-white hover:bg-[#154a18]">
                성도 로그인
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">새 비밀번호</label>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-[#1B5E20] focus:ring-2 focus:ring-[#1B5E20]/25"
                  placeholder="영문·숫자 포함 8자 이상"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">새 비밀번호 확인</label>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-[#1B5E20] focus:ring-2 focus:ring-[#1B5E20]/25"
                  placeholder="같은 비밀번호를 다시 입력"
                />
              </div>

              {(localError || resetMutation.error) && (
                <p className="rounded-lg bg-red-50 px-3 py-2.5 text-sm leading-6 text-red-600">
                  {localError || resetMutation.error?.message}
                </p>
              )}

              <button
                type="submit"
                disabled={resetMutation.isPending || !token}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#1B5E20] py-3 text-sm font-semibold text-white hover:bg-[#154a18] disabled:opacity-50"
              >
                <ShieldCheck className="h-4 w-4" />
                {resetMutation.isPending ? "변경 중..." : "새 비밀번호 저장"}
              </button>
            </form>
          )}
        </section>

        <div className="mt-5 rounded-xl border border-gray-200 bg-white px-4 py-3 text-center text-xs leading-5 text-gray-500">
          링크가 만료됐거나 이미 사용했다면 비밀번호 재설정을 다시 요청해주세요.<br />
          교회 사무실 054-270-1000
        </div>
      </main>
    </div>
  );
}
