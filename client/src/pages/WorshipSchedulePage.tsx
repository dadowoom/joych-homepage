import { useAuth } from "@/_core/hooks/useAuth";
import { WorshipScheduleCards } from "@/components/worship/WorshipScheduleCards";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";

export default function WorshipSchedulePage() {
  const { user } = useAuth();
  const scheduleQuery = trpc.cms.worshipSchedule.getPublished.useQuery(
    undefined,
    {
      staleTime: 0,
      refetchOnMount: "always",
      refetchOnWindowFocus: true,
    },
  );
  const isAdmin = user?.role === "admin";

  return (
    <div className="min-h-screen bg-[#F7F7F5]">
      <header className="bg-[#1B5E20] py-10 text-white sm:py-14">
        <div className="container">
          <nav className="mb-3 flex items-center gap-2 text-xs text-green-200 sm:text-sm">
            <Link href="/" className="transition-colors hover:text-white">
              홈
            </Link>
            <i
              className="fas fa-chevron-right text-[10px] text-green-400"
              aria-hidden="true"
            />
            <span>교회소개</span>
            <i
              className="fas fa-chevron-right text-[10px] text-green-400"
              aria-hidden="true"
            />
            <span className="text-white">예배 안내</span>
          </nav>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1
                className="text-2xl font-bold sm:text-3xl md:text-4xl"
                style={{ fontFamily: "'Noto Serif KR', serif" }}
              >
                예배 안내
              </h1>
              <p className="mt-3 break-keep text-sm leading-6 text-green-100 sm:text-base">
                기쁨의교회 예배 시간과 장소를 확인하세요.
              </p>
            </div>
            {isAdmin ? (
              <Link
                href="/admin_joych_2026?tab=worshipScheduleDraft"
                className="inline-flex min-h-11 w-fit items-center justify-center rounded-lg border border-white/40 bg-white/10 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-white/20"
              >
                <i className="fas fa-pen mr-2" aria-hidden="true" />
                예배 안내 수정
              </Link>
            ) : null}
          </div>
        </div>
      </header>

      <main className="container py-7 sm:py-10">
        {scheduleQuery.isLoading ? (
          <div className="flex min-h-64 items-center justify-center rounded-xl border border-gray-200 bg-white">
            <div className="text-center">
              <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-[#1B5E20] border-t-transparent" />
              <p className="text-sm text-gray-500">
                예배 안내를 불러오고 있습니다.
              </p>
            </div>
          </div>
        ) : scheduleQuery.error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
            <p className="font-bold">예배 안내를 불러오지 못했습니다.</p>
            <p className="mt-1">{scheduleQuery.error.message}</p>
            <button
              type="button"
              onClick={() => void scheduleQuery.refetch()}
              className="mt-4 min-h-10 rounded-lg border border-red-300 bg-white px-4 py-2 font-semibold"
            >
              다시 시도
            </button>
          </div>
        ) : scheduleQuery.data ? (
          <WorshipScheduleCards content={scheduleQuery.data.content} />
        ) : null}
      </main>
    </div>
  );
}
