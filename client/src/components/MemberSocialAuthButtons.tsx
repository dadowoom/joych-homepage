type MemberSocialAuthButtonsProps = {
  mode: "login" | "register";
};

const labels = {
  login: {
    title: "간편 로그인",
    google: "Google로 로그인",
    kakao: "카카오로 로그인",
  },
  register: {
    title: "간편 가입",
    google: "Google로 가입",
    kakao: "카카오로 가입",
  },
} as const;

export default function MemberSocialAuthButtons({ mode }: MemberSocialAuthButtonsProps) {
  const text = labels[mode];

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-gray-200" />
        <span className="text-xs text-gray-400">{text.title}</span>
        <div className="h-px flex-1 bg-gray-200" />
      </div>
      <div className="grid grid-cols-1 gap-2">
        <a
          href={`/api/member-oauth/google/start?mode=${mode}`}
          className="flex h-11 items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
        >
          <span className="flex h-5 w-5 items-center justify-center rounded-full border border-gray-200 bg-white text-xs font-bold text-[#4285F4]">
            G
          </span>
          {text.google}
        </a>
        <a
          href={`/api/member-oauth/kakao/start?mode=${mode}`}
          className="flex h-11 items-center justify-center gap-2 rounded-lg border border-[#FEE500] bg-[#FEE500] px-3 text-sm font-medium text-[#191919] transition-colors hover:bg-[#f4dc00]"
        >
          <span className="text-base font-bold">K</span>
          {text.kakao}
        </a>
      </div>
    </div>
  );
}
