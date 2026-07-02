import { Lock } from "lucide-react";
import { Link } from "wouter";

function getMemberLoginHref(fallbackPath: string) {
  const nextPath = typeof window === "undefined"
    ? fallbackPath
    : `${window.location.pathname}${window.location.search}` || fallbackPath;
  return `/member/login?next=${encodeURIComponent(nextPath)}`;
}

type MemberOnlyContentNoticeProps = {
  resourceLabel?: string;
  description?: string;
  fallbackPath: string;
};

export default function MemberOnlyContentNotice({
  resourceLabel = "페이지",
  description,
  fallbackPath,
}: MemberOnlyContentNoticeProps) {
  return (
    <div className="flex min-h-[320px] flex-col items-center justify-center bg-[#FBFFFC] px-4 py-14 text-center sm:min-h-[380px] sm:px-6 sm:py-20">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#EAF6EA] text-[#1B5E20] sm:mb-5 sm:h-16 sm:w-16">
        <Lock className="h-7 w-7 sm:h-8 sm:w-8" />
      </div>
      <h2
        className="text-lg font-bold text-gray-800 sm:text-xl"
        style={{ fontFamily: "'Noto Serif KR', serif" }}
      >
        성도 로그인 후 이용할 수 있습니다
      </h2>
      <p className="mt-3 max-w-md text-xs leading-6 text-gray-500 sm:text-sm">
        {description ?? `${resourceLabel}는 성도 이상 읽기 권한이 필요한 페이지입니다. 성도 로그인 후 다시 확인해 주세요.`}
      </p>
      <Link
        href={getMemberLoginHref(fallbackPath)}
        className="mt-6 inline-flex h-10 items-center justify-center border border-[#1B5E20] bg-[#1B5E20] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#2E7D32]"
      >
        성도 로그인
      </Link>
    </div>
  );
}
