import { useAuth } from "@/_core/hooks/useAuth";
import AdminWorshipScheduleDraftTab from "@/components/admin/AdminWorshipScheduleDraftTab";
import NotFound from "@/pages/NotFound";
import { Link } from "wouter";

export default function WorshipScheduleBeta() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center bg-[#F7F7F5]">
        <div className="text-center">
          <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-[#1B5E20] border-t-transparent" />
          <p className="text-sm text-gray-500">예배시간을 불러오고 있습니다.</p>
        </div>
      </div>
    );
  }

  if (!user || user.role !== "admin") {
    return <NotFound />;
  }

  return (
    <div className="min-h-screen bg-[#F7F7F5]">
      <header className="bg-[#1B5E20] py-10 text-white sm:py-14">
        <div className="container">
          <nav className="mb-3 flex items-center gap-2 text-xs text-green-200 sm:text-sm">
            <Link href="/" className="transition-colors hover:text-white">
              홈
            </Link>
            <i className="fas fa-chevron-right text-[10px] text-green-400" />
            <span className="text-white">예배시간(beta)</span>
          </nav>
          <div className="flex flex-wrap items-center gap-3">
            <h1
              className="text-2xl font-bold sm:text-3xl md:text-4xl"
              style={{ fontFamily: "'Noto Serif KR', serif" }}
            >
              예배시간(beta)
            </h1>
            <span className="rounded-full border border-white/30 bg-white/15 px-3 py-1 text-xs font-bold">
              관리자 전용
            </span>
          </div>
          <p className="mt-3 max-w-2xl break-keep text-sm leading-6 text-green-100 sm:text-base">
            관리자페이지에 저장한 예배시간을 실제 메뉴 화면에서 확인하고 바로
            수정할 수 있습니다.
          </p>
        </div>
      </header>

      <main className="container py-7 sm:py-10">
        <AdminWorshipScheduleDraftTab pageMode />
      </main>
    </div>
  );
}
