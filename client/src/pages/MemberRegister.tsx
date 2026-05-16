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
import MemberSocialAuthButtons from "@/components/MemberSocialAuthButtons";

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
    department: "",
    district: "",
    faithPlusUserId: "",
    agreePrivacy: false,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const utils = trpc.useUtils();

  // 선택지 불러오기
  const { data: deptOptions = [] } = trpc.members.fieldOptions.useQuery({ fieldType: "department" });
  const { data: districtOptions = [] } = trpc.members.fieldOptions.useQuery({ fieldType: "district" });

  // 회원가입 뮤테이션
  const registerMutation = trpc.members.register.useMutation({
    onSuccess: async () => {
      toast.success("회원가입 신청이 접수되었습니다. 관리자 승인 후 로그인하실 수 있습니다.");
      await utils.members.me.invalidate();
      navigate("/member/login");
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
    if (!form.password) newErrors.password = "비밀번호를 입력해주세요.";
    else if (form.password.length < 8) newErrors.password = "비밀번호는 8자 이상이어야 합니다.";
    if (form.password !== form.passwordConfirm) newErrors.passwordConfirm = "비밀번호가 일치하지 않습니다.";
    if (!form.phone.trim()) newErrors.phone = "연락처를 입력해주세요.";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep1()) setStep(2);
  };

  const handleSubmit = () => {
    if (!form.agreePrivacy) {
      toast.error("개인정보 수집 및 이용에 동의해주세요.");
      return;
    }
    registerMutation.mutate({
      name: form.name,
      email: form.email,
      password: form.password,
      phone: form.phone || undefined,
      birthDate: form.birthDate || undefined,
      gender: (form.gender as "남" | "여") || undefined,
      address: form.address || undefined,
      emergencyPhone: form.emergencyPhone || undefined,
      joinPath: form.joinPath || undefined,
      department: form.department || undefined,
      district: form.district || undefined,
      faithPlusUserId: form.faithPlusUserId || undefined,
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
                  value={form.password}
                  onChange={(e) => update("password", e.target.value)}
                  placeholder="8자 이상 입력해주세요"
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
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  연락처 <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => update("phone", e.target.value)}
                  placeholder="010-0000-0000"
                  className={`w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B5E20]/30 ${
                    errors.phone ? "border-red-400" : "border-gray-300"
                  }`}
                />
                {errors.phone && <p className="text-xs text-red-500 mt-1">{errors.phone}</p>}
              </div>

              {/* 생년월일 + 성별 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">생년월일</label>
                  <input
                    type="date"
                    value={form.birthDate}
                    onChange={(e) => update("birthDate", e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B5E20]/30"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">성별</label>
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
                </div>
              </div>

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
                선택 사항입니다. 모르시면 비워두셔도 됩니다. 관리자가 나중에 입력해드립니다.
              </p>

              {/* 소속 부서 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">소속 부서</label>
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
              </div>

              {/* 구역/순 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">구역 / 순</label>
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
              </div>

              {/* 믿음PLUS 유저 ID */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  믿음PLUS 유저 ID
                  <span className="ml-1 text-xs text-gray-400 font-normal">(선택사항)</span>
                </label>
                <input
                  type="text"
                  value={form.faithPlusUserId}
                  onChange={(e) => update("faithPlusUserId", e.target.value)}
                  placeholder="믿음PLUS 앱에서 확인한 유저 ID를 입력하세요"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B5E20]/30"
                />
                <p className="text-xs text-gray-400 mt-1">
                  믿음PLUS 앱을 사용하신다면 입력해주세요. 나중에 마이페이지에서도 입력하실 수 있습니다.
                </p>
              </div>

              {/* 가입 경로 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">가입 경로</label>
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
              </div>

              {/* 개인정보 동의 */}
              <div className="bg-gray-50 rounded-lg p-4 mt-2">
                <p className="text-xs text-gray-600 mb-3 leading-relaxed">
                  <strong>개인정보 수집 및 이용 동의</strong><br />
                  수집 항목: 이름, 이메일, 연락처, 생년월일, 성별, 주소<br />
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
