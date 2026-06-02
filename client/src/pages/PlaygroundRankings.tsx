import { useMemo, useState } from "react";
import { Award, Medal, RefreshCw, Trophy, Users } from "lucide-react";
import SubPageLayout from "@/components/SubPageLayout";
import { trpc } from "@/lib/trpc";

type RankingPeriod = "weekly" | "monthly" | "yearly" | "all";
type RankingMetric = "total" | "bible" | "prayer" | "worship" | "light";

type RankingEntry = {
  rank: number;
  userId: string | null;
  displayName: string;
  churchName: string | null;
  profilePhoto: string | null;
  score: number;
  totalScore: number | null;
  bibleDays: number | null;
  prayerCount: number | null;
  worshipCount: number | null;
  lightCount: number | null;
};

const periodOptions: Array<{ value: RankingPeriod; label: string }> = [
  { value: "weekly", label: "주간" },
  { value: "monthly", label: "월간" },
  { value: "yearly", label: "연간" },
  { value: "all", label: "전체" },
];

const metricOptions: Array<{ value: RankingMetric; label: string }> = [
  { value: "total", label: "종합" },
  { value: "bible", label: "말씀" },
  { value: "prayer", label: "기도" },
  { value: "worship", label: "예배" },
  { value: "light", label: "빛" },
];

const podiumStyles = [
  {
    ring: "ring-[#D6A611]/40",
    badge: "bg-[#D6A611] text-white",
    label: "GOLD",
  },
  {
    ring: "ring-slate-300",
    badge: "bg-slate-500 text-white",
    label: "SILVER",
  },
  {
    ring: "ring-[#B7791F]/35",
    badge: "bg-[#B7791F] text-white",
    label: "BRONZE",
  },
];

function formatNumber(value: number | null | undefined) {
  if (value === null || value === undefined) return "-";
  return Math.round(value).toLocaleString("ko-KR");
}

function getInitial(name: string) {
  return name.trim().charAt(0) || "?";
}

function getProfileHref(userId: string | null) {
  return userId ? `https://faithplus.co.kr/search?user=${encodeURIComponent(userId)}` : null;
}

function RankingAvatar({ entry, size = "md" }: { entry: RankingEntry; size?: "md" | "lg" }) {
  const sizeClass = size === "lg" ? "h-16 w-16 text-xl" : "h-10 w-10 text-sm";
  return (
    <div
      className={`${sizeClass} flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#E8F5E9] font-semibold text-[#1B5E20] ring-1 ring-[#D9EAD3]`}
    >
      {entry.profilePhoto ? (
        <img
          src={entry.profilePhoto}
          alt={entry.displayName}
          className="h-full w-full object-cover"
        />
      ) : (
        getInitial(entry.displayName)
      )}
    </div>
  );
}

function PodiumCard({
  entry,
  index,
  metricLabel,
}: {
  entry: RankingEntry;
  index: number;
  metricLabel: string;
}) {
  const style = podiumStyles[index] ?? podiumStyles[0];
  const href = getProfileHref(entry.userId);
  const content = (
    <div
      className={`flex h-full flex-col items-center rounded-lg border border-gray-100 bg-white px-4 py-5 text-center shadow-sm ring-2 ${style.ring}`}
    >
      <div className={`mb-3 rounded-full px-3 py-1 text-[10px] font-bold tracking-[0.14em] ${style.badge}`}>
        {style.label}
      </div>
      <RankingAvatar entry={entry} size="lg" />
      <p className="mt-3 text-lg font-bold text-gray-900">{entry.displayName}</p>
      <p className="mt-1 h-4 text-xs text-gray-400">{entry.churchName ?? "기쁨의교회"}</p>
      <p className="mt-4 text-2xl font-bold text-[#1B5E20]">
        {formatNumber(entry.score)}
      </p>
      <p className="text-xs text-gray-400">{metricLabel} 점수</p>
    </div>
  );

  return href ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className="block h-full">
      {content}
    </a>
  ) : (
    content
  );
}

function RankingTable({
  rankings,
  metricLabel,
}: {
  rankings: RankingEntry[];
  metricLabel: string;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
      <div className="overflow-x-auto">
        <table className="min-w-[760px] w-full border-collapse text-sm">
          <thead className="bg-[#F7F8F5] text-xs text-gray-500">
            <tr>
              <th className="w-20 px-4 py-3 text-left font-semibold">순위</th>
              <th className="px-4 py-3 text-left font-semibold">성도</th>
              <th className="w-32 px-4 py-3 text-right font-semibold">{metricLabel}</th>
              <th className="w-24 px-4 py-3 text-right font-semibold">말씀</th>
              <th className="w-24 px-4 py-3 text-right font-semibold">기도</th>
              <th className="w-24 px-4 py-3 text-right font-semibold">예배</th>
              <th className="w-24 px-4 py-3 text-right font-semibold">빛</th>
            </tr>
          </thead>
          <tbody>
            {rankings.map((entry) => {
              const href = getProfileHref(entry.userId);
              return (
                <tr key={`${entry.rank}-${entry.userId ?? entry.displayName}`} className="border-t border-gray-100">
                  <td className="px-4 py-3">
                    <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-[#EEF4ED] px-2 text-xs font-bold text-[#1B5E20]">
                      {entry.rank}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <RankingAvatar entry={entry} />
                      <div className="min-w-0">
                        {href ? (
                          <a
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block truncate font-semibold text-gray-800 hover:text-[#1B5E20]"
                          >
                            {entry.displayName}
                          </a>
                        ) : (
                          <span className="block truncate font-semibold text-gray-800">
                            {entry.displayName}
                          </span>
                        )}
                        <span className="block truncate text-xs text-gray-400">
                          {entry.churchName ?? "기쁨의교회"}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-[#1B5E20]">
                    {formatNumber(entry.score)}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-600">{formatNumber(entry.bibleDays)}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{formatNumber(entry.prayerCount)}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{formatNumber(entry.worshipCount)}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{formatNumber(entry.lightCount)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RankingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {[0, 1, 2].map((item) => (
          <div key={item} className="h-64 animate-pulse rounded-lg bg-gray-100" />
        ))}
      </div>
      <div className="h-72 animate-pulse rounded-lg bg-gray-100" />
    </div>
  );
}

export default function PlaygroundRankings() {
  const [period, setPeriod] = useState<RankingPeriod>("weekly");
  const [metric, setMetric] = useState<RankingMetric>("total");
  const metricLabel = useMemo(
    () => metricOptions.find((option) => option.value === metric)?.label ?? "종합",
    [metric]
  );

  const rankingQuery = trpc.playground.rankings.useQuery(
    { period, metric, limit: 30 },
    { staleTime: 60_000 }
  );
  const rankings = rankingQuery.data?.rankings ?? [];
  const podium = rankings.slice(0, 3);

  return (
    <SubPageLayout pageTitle="플레이 그라운드" parentLabel="커뮤니티">
      <div className="space-y-6">
        <section className="rounded-lg border border-gray-200 bg-white p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="flex items-center gap-2 text-sm font-semibold text-[#1B5E20]">
                <Trophy className="h-4 w-4" />
                FaithPlus Ranking
              </p>
              <h2
                className="mt-2 text-2xl font-bold text-gray-900"
                style={{ fontFamily: "'Noto Serif KR', serif" }}
              >
                기쁨의교회 활동 랭킹
              </h2>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="flex rounded-lg border border-gray-200 bg-[#FAFAF8] p-1">
                {periodOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setPeriod(option.value)}
                    className={`h-8 min-w-12 rounded-md px-3 text-xs font-semibold transition-colors ${
                      period === option.value
                        ? "bg-[#1B5E20] text-white"
                        : "text-gray-500 hover:text-[#1B5E20]"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <div className="flex rounded-lg border border-gray-200 bg-[#FAFAF8] p-1">
                {metricOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setMetric(option.value)}
                    className={`h-8 min-w-12 rounded-md px-3 text-xs font-semibold transition-colors ${
                      metric === option.value
                        ? "bg-[#1B5E20] text-white"
                        : "text-gray-500 hover:text-[#1B5E20]"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {rankingQuery.isLoading ? (
          <RankingSkeleton />
        ) : rankingQuery.error ? (
          <section className="flex min-h-[320px] items-center justify-center rounded-lg border border-dashed border-gray-200 bg-white p-6 text-center">
            <div>
              <Award className="mx-auto h-10 w-10 text-gray-300" />
              <p className="mt-4 text-base font-semibold text-gray-700">
                랭킹 데이터를 불러오지 못했습니다.
              </p>
              <p className="mt-2 text-sm text-gray-400">{rankingQuery.error.message}</p>
              <button
                type="button"
                onClick={() => rankingQuery.refetch()}
                className="mt-5 inline-flex h-9 items-center gap-2 rounded-lg bg-[#1B5E20] px-4 text-sm font-semibold text-white hover:bg-[#2E7D32]"
              >
                <RefreshCw className="h-4 w-4" />
                다시 불러오기
              </button>
            </div>
          </section>
        ) : rankings.length === 0 ? (
          <section className="flex min-h-[320px] items-center justify-center rounded-lg border border-dashed border-gray-200 bg-white p-6 text-center">
            <div>
              <Users className="mx-auto h-10 w-10 text-gray-300" />
              <p className="mt-4 text-base font-semibold text-gray-700">
                표시할 랭킹 데이터가 없습니다.
              </p>
            </div>
          </section>
        ) : (
          <>
            <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {podium.map((entry, index) => (
                <PodiumCard
                  key={`${entry.rank}-${entry.userId ?? entry.displayName}`}
                  entry={entry}
                  index={index}
                  metricLabel={metricLabel}
                />
              ))}
            </section>

            <section>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-base font-bold text-gray-800">
                  <Medal className="h-4 w-4 text-[#1B5E20]" />
                  순위표
                </h3>
                {rankingQuery.data?.updatedAt && (
                  <span className="text-xs text-gray-400">
                    {rankingQuery.data.updatedAt}
                  </span>
                )}
              </div>
              <RankingTable rankings={rankings} metricLabel={metricLabel} />
            </section>
          </>
        )}
      </div>
    </SubPageLayout>
  );
}
