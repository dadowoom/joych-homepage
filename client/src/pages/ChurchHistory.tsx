import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import AdminChurchHistoryTab from "@/components/AdminChurchHistoryTab";
import { canManageBoardContent } from "@/lib/contentPermissions";
import { trpc } from "@/lib/trpc";

type HistoryDecade = {
  id: number;
  title: string;
  startYear: number;
  endYear: number;
  sortOrder: number;
};

type HistoryItem = {
  id: number;
  decadeId: number;
  year: number;
  month: number;
  content: string;
  sortOrder: number;
};

function sortDecades(decades: HistoryDecade[]) {
  return [...decades].sort(
    (a, b) =>
      (a.sortOrder || 0) - (b.sortOrder || 0) ||
      b.startYear - a.startYear ||
      a.id - b.id,
  );
}

function sortItems(items: HistoryItem[]) {
  return [...items].sort(
    (a, b) =>
      a.year - b.year ||
      a.month - b.month ||
      (a.sortOrder || 0) - (b.sortOrder || 0) ||
      a.id - b.id,
  );
}

function formatMonth(month: number) {
  return String(month).padStart(2, "0");
}

export default function ChurchHistory() {
  const { user } = useAuth();
  const canManageHistory = canManageBoardContent(user, "content:history");
  const { data, isLoading } = trpc.home.history.useQuery();
  const decades = useMemo(
    () => sortDecades((data?.decades ?? []) as HistoryDecade[]),
    [data?.decades],
  );
  const items = useMemo(
    () => sortItems((data?.items ?? []) as HistoryItem[]),
    [data?.items],
  );
  const [activeDecadeId, setActiveDecadeId] = useState<number | null>(null);
  const [isManagerOpen, setIsManagerOpen] = useState(false);

  useEffect(() => {
    if (!activeDecadeId && decades[0]) {
      setActiveDecadeId(decades[0].id);
    }
  }, [activeDecadeId, decades]);

  const activeItems = useMemo(
    () => items.filter((item) => item.decadeId === activeDecadeId),
    [activeDecadeId, items],
  );

  const yearGroups = useMemo(() => {
    const grouped = new Map<number, HistoryItem[]>();
    for (const item of activeItems) {
      const next = grouped.get(item.year) ?? [];
      next.push(item);
      grouped.set(item.year, next);
    }
    return Array.from(grouped.entries())
      .sort(([yearA], [yearB]) => yearA - yearB)
      .map(([year, values]) => ({ year, items: sortItems(values) }));
  }, [activeItems]);

  return (
    <main className="bg-white">
      <section className="mx-auto max-w-6xl px-4 py-14 sm:py-20">
        <div className="text-center">
          <h1 className="font-serif text-4xl font-bold tracking-normal text-gray-950 sm:text-5xl">
            교회 역사
          </h1>
          <div className="mx-auto mt-5 h-1 w-16 bg-[#0b4f8a]" />
          {canManageHistory && (
            <div className="mt-7 flex justify-center">
              <button
                type="button"
                onClick={() => setIsManagerOpen((current) => !current)}
                className="rounded-md bg-[#16651f] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0f5018]"
              >
                {isManagerOpen ? "교회연혁 닫기" : "교회연혁 추가/수정"}
              </button>
            </div>
          )}
        </div>

        {canManageHistory && isManagerOpen && (
          <div className="mt-10 rounded-2xl border border-green-100 bg-[#f7fbf7] p-4 sm:p-6">
            <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-serif text-2xl font-bold text-gray-950">교회연혁 등록</h2>
                <p className="mt-1 text-sm text-gray-600">
                  로그인한 관리자는 교회연혁 게시물을 추가/수정할 수 있습니다.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsManagerOpen(false)}
                className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700"
              >
                닫기
              </button>
            </div>
            <AdminChurchHistoryTab />
          </div>
        )}

        {isLoading ? (
          <div className="mt-16 rounded-xl border border-dashed border-gray-300 p-10 text-center text-gray-500">
            교회연혁 정보를 불러오는 중입니다.
          </div>
        ) : decades.length ? (
          <>
            <div className="mt-16 flex flex-wrap justify-center border-b border-gray-200">
              {decades.map((decade) => {
                const isActive = activeDecadeId === decade.id;
                return (
                  <button
                    key={decade.id}
                    type="button"
                    onClick={() => setActiveDecadeId(decade.id)}
                    className={`min-w-28 border border-b-0 px-5 py-4 text-sm font-semibold transition sm:text-base ${
                      isActive
                        ? "border-gray-300 bg-white text-gray-950 shadow-[inset_0_3px_0_#0b4f8a]"
                        : "border-gray-200 bg-gray-50 text-gray-500 hover:bg-white hover:text-gray-900"
                    }`}
                  >
                    {decade.title}
                  </button>
                );
              })}
            </div>

            <div className="mt-8 divide-y divide-gray-200">
              {yearGroups.map((group) => (
                <article
                  key={group.year}
                  className="grid gap-4 py-8 sm:grid-cols-[140px_1fr] sm:gap-8"
                >
                  <div className="font-serif text-4xl font-normal text-[#0b376f] sm:text-5xl">
                    {group.year}
                  </div>
                  <div className="space-y-6">
                    {group.items.map((item) => (
                      <div
                        key={item.id}
                        className="grid grid-cols-[100px_minmax(0,1fr)] items-start gap-3 sm:gap-4"
                      >
                        <div className="text-base font-semibold leading-6 text-[#8aa4c4] sm:text-lg">
                          {formatMonth(item.month)}
                        </div>
                        <p className="whitespace-pre-line text-base leading-8 text-gray-700">
                          {item.content}
                        </p>
                      </div>
                    ))}
                  </div>
                </article>
              ))}
              {!yearGroups.length && (
                <div className="rounded-xl border border-dashed border-gray-300 p-10 text-center text-gray-500">
                  선택한 연도에 등록된 연혁이 없습니다.
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="mt-16 rounded-xl border border-dashed border-gray-300 p-10 text-center text-gray-500">
            등록된 교회연혁이 없습니다.
          </div>
        )}
      </section>
    </main>
  );
}
