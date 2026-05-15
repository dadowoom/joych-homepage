/**
 * MemberLogin.tsx
 * 성도 로그인 페이지
 */
import { useState } from "react";
import { Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import MemberSocialAuthButtons from "@/components/MemberSocialAuthButtons";

function getSocialMessage(location: string) {
  const search = location.includes("?")
    ? location.slice(location.indexOf("?"))
    : typeof window !== "undefined"
      ? window.location.search
      : "";
  const status = new URLSearchParams(search).get("social");
  const messages: Record<string, { tone: "info" | "error"; text: string }> = {
    registered: {
      tone: "info",
      text: "간편가입 신청이 접수됐습니다. 관리자 승인 후 로그인하실 수 있습니다.",
    },
    pending: {
      tone: "info",
      text: "회원가입 신청이 접수됐습니다. 관리자 승인 후 로그인하실 수 있습니다.",
    },
    rejected: {
      tone: "error",
      text: "가입이 거절된 계정입니다. 교회 사무국에 문의해주세요.",
    },
    withdrawn: {
      tone: "error",
      text: "탈퇴한 계정입니다. 교회 사무국에 문의해주세요.",
    },
    social_cancelled: {
      tone: "info",
      text: "간편로그인이 취소됐습니다.",
    },
    social_email_required: {
      tone: "error",
      text: "이메일 제공 동의가 필요합니다. 카카오 계정 이메일 동의 후 다시 시도해주세요.",
    },
    social_email_unverified: {
      tone: "error",
      text: "인증되지 않은 이메일입니다. 소셜 계정의 이메일 인증 후 다시 시도해주세요.",
    },
    social_email_too_long: {
      tone: "error",
      text: "소셜 계정 이메일이 너무 깁니다. 교회 사무국에 문의해주세요.",
    },
    social_account_conflict: {
      tone: "error",
      text: "이미 다른 소셜 계정과 연결된 이메일입니다. 교회 사무국에 문의해주세요.",
    },
    not_configured: {
      tone: "error",
      text: "간편로그인 설정이 아직 완료되지 않았습니다. 관리자에게 문의해주세요.",
    },
    error: {
      tone: "error",
      text: "간편로그인 처리 중 문제가 발생했습니다. 잠시 후 다시 시도해주세요.",
    },
  };
  return status ? messages[status] : null;
}

export default function MemberLogin() {
  const [location, navigate] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const utils = trpc.useUtils();
  const socialMessage = getSocialMessage(location);

  const loginMutation = trpc.members.login.useMutation({
    onSuccess: async (data) => {
      toast.success(`${data.member.name}님, 환영합니다!`);
      // 로그인 후 memberMe 쿼리 즉시 갱신 → 상단 바에 이름 바로 표시
      await utils.members.me.invalidate();
      navigate("/");
    },
    onError: (e) => {
      if (e.message.includes("이메일 또는 비밀번호")) {
        setErrors({ email: "이메일 또는 비밀번호가 올바르지 않습니다." });
      } else if (e.message.includes("승인")) {
        toast.info(e.message);
      } else {
        toast.error(e.message);
      }
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: typeof errors = {};
    if (!email.trim()) newErrors.email = "이메일을 입력해주세요.";
    if (!password) newErrors.password = "비밀번호를 입력해주세요.";
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    loginMutation.mutate({ email, password });
  };

  return (
    <div className="min-h-screen bg-[#FAFAF8] flex flex-col" style={{ fontFamily: "'Noto Sans KR', sans-serif" }}>
      {/* 헤더 */}
      <header className="bg-white border-b border-gray-200 px-4 py-4">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <Link href="/" className="flex flex-col leading-tight">
            <span className="text-lg font-bold text-[#1B5E20]" style={{ fontFamily: "'Noto Serif KR', serif" }}>
              기쁨의교회
            </span>
            <span className="text-[10px] text-gray-400 tracking-widest uppercase">The Joyful Church</span>
          </Link>
        </div>
      </header>

      {/* 본문 */}
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          {/* 제목 */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-[#E8F5E9] rounded-full flex items-center justify-center mx-auto mb-4">
              <i className="fas fa-user text-[#1B5E20] text-2xl"></i>
            </div>
            <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: "'Noto Serif KR', serif" }}>
              성도 로그인
            </h1>
            <p className="text-sm text-gray-500 mt-2">기쁨의교회 온라인 서비스</p>
          </div>

          {socialMessage && (
            <div className={`mb-4 rounded-lg border px-4 py-3 text-sm ${
              socialMessage.tone === "info"
                ? "border-[#1B5E20]/20 bg-[#E8F5E9] text-[#1B5E20]"
                : "border-red-200 bg-red-50 text-red-600"
            }`}>
              {socialMessage.text}
            </div>
          )}

          {/* 로그인 폼 */}
          <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
            <MemberSocialAuthButtons mode="login" />

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">이메일</label>
              <input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setErrors({}); }}
                placeholder="example@email.com"
                autoComplete="email"
                className={`w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B5E20]/30 ${
                  errors.email ? "border-red-400" : "border-gray-300"
                }`}
              />
              {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">비밀번호</label>
              <input
                type="password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setErrors({}); }}
                placeholder="비밀번호를 입력해주세요"
                autoComplete="current-password"
                className={`w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B5E20]/30 ${
                  errors.password ? "border-red-400" : "border-gray-300"
                }`}
              />
              {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password}</p>}
            </div>

            <button
              type="submit"
              disabled={loginMutation.isPending}
              className="w-full py-3 bg-[#1B5E20] text-white rounded-lg font-medium hover:bg-[#154a18] transition-colors disabled:opacity-50 mt-2"
            >
              {loginMutation.isPending ? "로그인 중..." : "로그인"}
            </button>
          </form>

          {/* 하단 링크 */}
          <div className="text-center mt-6 space-y-2">
            <p className="text-sm text-gray-500">
              아직 회원이 아니신가요?{" "}
              <Link href="/member/register" className="text-[#1B5E20] font-medium hover:underline">
                회원가입
              </Link>
            </p>
            <Link href="/" className="text-xs text-gray-400 hover:text-gray-600 block">
              ← 홈페이지로 돌아가기
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
