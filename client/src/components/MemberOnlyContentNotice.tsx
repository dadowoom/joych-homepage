import { Link } from "wouter";

function getMemberLoginHref(fallbackPath: string) {
  const nextPath = typeof window === "undefined"
    ? fallbackPath
    : `${window.location.pathname}${window.location.search}` || fallbackPath;
  return `/member/login?next=${encodeURIComponent(nextPath)}`;
}

export default function MemberOnlyContentNotice({
  resourceLabel = "이 페이지",
  fallbackPath,
}: {
  resourceLabel?: string;
  fallbackPath: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center border-2 border-dashed border-[#D8E8DA] bg-[#F8FCF8] px-5 py-20 text-center">
      <i className="fas fa-lock mb-4 text-4xl text-[#1B5E20]" />
      <h2
        className="text-xl font-bold text-gray-800"
        style={{ fontFamily: "'Noto Serif KR', serif" }}
      >
        성도 로그인 후 이용할 수 있습니다
      </h2>
      <p className="mt-3 max-w-md text-sm leading-6 text-gray-500">
        {resourceLabel}는 성도 공개 메뉴입니다. 로그인한 성도만 볼 수 있으니 성도 로그인 후 다시 확인해 주세요.
      </p>
      <Link
        href={getMemberLoginHref(fallbackPath)}
        className="mt-6 inline-flex h-10 items-center justify-center border border-[#1B5E20] bg-[#1B5E20] px-5 text-sm font-semibold text-white hover:bg-[#2E7D32]"
      >
        성도 로그인
      </Link>
    </div>
  );
}
