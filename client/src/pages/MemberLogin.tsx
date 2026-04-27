/**
 * MemberLogin.tsx
 * 성도 로그인 페이지
 */
import { useState } from "react";
import { Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

export default function MemberLogin() {
  const [, navigate] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const utils = trpc.useUtils();

  const loginMutation = trpc.members.login.useMutation({
    onSuccess: async (data) => {
      if (data.member.status === "pending") {
        toast.info("회원가입 신청이 접수됐습니다. 관리자 승인 후 이용하실 수 있습니다.");
      } else if (data.member.status === "rejected") {
        toast.error("가입이 거절됐습니다. 교회 사무국에 문의해주세요.");
        return;
      } else {
        toast.success(`${data.member.name}님, 환영합니다!`);
        // 로그인 후 memberMe 쿼리 즉시 갱신 → 상단 바에 이름 바로 표시
        await utils.members.me.invalidate();
        navigate("/");
      }
    },
    onError: (e) => {
      if (e.message.includes("이메일 또는 비밀번호")) {
        setErrors({ email: "이메일 또는 비밀번호가 올바르지 않습니다." });
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

          {/* 로그인 폼 */}
          <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
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
