import { type FormEvent, useMemo, useState } from "react";
import { Award, ExternalLink, Medal, RefreshCw, Search, Trophy, User, Users } from "lucide-react";
import SubPageLayout from "@/components/SubPageLayout";
import { trpc } from "@/lib/trpc";

type RankingPeriod = "weekly" | "monthly" | "yearly" | "all";
type RankingMetric = "total" | "bible" | "prayer" | "worship" | "light" | "salt" | "heritage";

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
  saltCount: number | null;
  heritageCount: number | null;
};

type FaithPlusUser = {
  userId: number;
  displayName: string;
  churchName: string | null;
  profilePhoto: string | null;
  totalScore: number;
  totalBibleDays: number;
  totalPrayerCount: number;
  worshipCount: number;
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
  { value: "salt", label: "소금" },
  { value: "heritage", label: "유산" },
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
         loading="lazy"/>
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
    <a href={href} className="block h-full">
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
        <table className="min-w-[920px] w-full border-collapse text-sm">
          <thead className="bg-[#F7F8F5] text-xs text-gray-500">
            <tr>
              <th className="w-20 px-4 py-3 text-left font-semibold">순위</th>
              <th className="px-4 py-3 text-left font-semibold">성도</th>
              <th className="w-32 px-4 py-3 text-right font-semibold">{metricLabel}</th>
              <th className="w-24 px-4 py-3 text-right font-semibold">말씀</th>
              <th className="w-24 px-4 py-3 text-right font-semibold">기도</th>
              <th className="w-24 px-4 py-3 text-right font-semibold">예배</th>
              <th className="w-24 px-4 py-3 text-right font-semibold">빛</th>
              <th className="w-24 px-4 py-3 text-right font-semibold">소금</th>
              <th className="w-24 px-4 py-3 text-right font-semibold">유산</th>
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
                  <td className="px-4 py-3 text-right text-gray-600">{formatNumber(entry.saltCount)}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{formatNumber(entry.heritageCount)}</td>
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

function FaithPlusUserSearch() {
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<FaithPlusUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const trpcUtils = trpc.useUtils();

  async function handleSearch(e: FormEvent) {
    e.preventDefault();
    const trimmed = input.trim();
    if (trimmed.length < 2) {
      setError("이름을 2글자 이상 입력해주세요.");
      setUsers([]);
      setQuery(trimmed);
      return;
    }

    setLoading(true);
    setError(null);
    setUsers([]);
    setQuery(trimmed);
    try {
      const data = await trpcUtils.playground.searchUsers.fetch({ name: trimmed });
      const nextUsers = data.users ?? [];
      setUsers(nextUsers);
      if (nextUsers.length === 0) {
        setError("검색된 FaithPlus 이용자가 없습니다.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "FaithPlus 서버에 연결하지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold text-[#1B5E20]">
            <Search className="h-4 w-4" />
            FaithPlus User Search
          </p>
          <h2 className="mt-2 text-2xl font-bold text-gray-900" style={{ fontFamily: "'Noto Serif KR', serif" }}>
            믿음PLUS 이용자 검색
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            이름으로 FaithPlus 이용자를 찾아 신앙 데이터를 확인합니다.
          </p>
        </div>

        <form onSubmit={handleSearch} className="flex w-full gap-2 lg:max-w-md">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="성도 이름 검색"
              className="h-11 w-full rounded-lg border border-gray-200 bg-white pl-10 pr-3 text-sm outline-none transition focus:border-[#1B5E20] focus:ring-2 focus:ring-[#1B5E20]/15"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="h-11 rounded-lg bg-[#1B5E20] px-5 text-sm font-semibold text-white transition hover:bg-[#2E7D32] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "검색 중" : "검색"}
          </button>
        </form>
      </div>

      {(query || loading) && (
        <div className="mt-5 border-t border-gray-100 pt-5">
          {loading ? (
            <div className="flex min-h-32 items-center justify-center text-sm text-gray-400">
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              FaithPlus 이용자를 검색하는 중입니다.
            </div>
          ) : error ? (
            <div className="flex min-h-32 flex-col items-center justify-center rounded-lg border border-dashed border-gray-200 bg-[#FAFAF8] text-center">
              <User className="h-9 w-9 text-gray-300" />
              <p className="mt-3 text-sm font-semibold text-gray-600">{error}</p>
            </div>
          ) : (
            <div>
              <p className="mb-3 text-sm text-gray-500">
                <span className="font-semibold text-[#1B5E20]">{query}</span> 검색 결과 {users.length}명
              </p>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {users.map((user) => (
                  <a
                    key={user.userId}
                    href={`/faith-data?name=${encodeURIComponent(user.displayName)}`}
                    className="group rounded-lg border border-gray-100 bg-[#FAFAF8] p-4 transition hover:border-[#1B5E20]/40 hover:bg-white hover:shadow-sm"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#E8F5E9] text-sm font-bold text-[#1B5E20]">
                        {user.profilePhoto ? (
                          <img src={user.profilePhoto} alt={user.displayName} className="h-full w-full object-cover" loading="lazy" />
                        ) : (
                          user.displayName.charAt(0)
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-bold text-gray-900">{user.displayName}</p>
                        <p className="truncate text-xs text-gray-400">{user.churchName || "교회 미등록"}</p>
                      </div>
                      <ExternalLink className="h-4 w-4 shrink-0 text-gray-300 transition group-hover:text-[#1B5E20]" />
                    </div>
                    <div className="mt-3 grid grid-cols-4 gap-2 text-center">
                      <div className="rounded-md bg-white py-2">
                        <p className="text-xs font-bold text-[#1B5E20]">{user.totalScore?.toLocaleString?.() ?? 0}</p>
                        <p className="text-[10px] text-gray-400">점수</p>
                      </div>
                      <div className="rounded-md bg-white py-2">
                        <p className="text-xs font-bold text-[#1B5E20]">{user.totalBibleDays ?? 0}</p>
                        <p className="text-[10px] text-gray-400">말씀</p>
                      </div>
                      <div className="rounded-md bg-white py-2">
                        <p className="text-xs font-bold text-[#1B5E20]">{user.totalPrayerCount ?? 0}</p>
                        <p className="text-[10px] text-gray-400">기도</p>
                      </div>
                      <div className="rounded-md bg-white py-2">
                        <p className="text-xs font-bold text-[#1B5E20]">{user.worshipCount ?? 0}</p>
                        <p className="text-[10px] text-gray-400">예배</p>
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
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
        <FaithPlusUserSearch />

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
              <div className="flex max-w-full overflow-x-auto rounded-lg border border-gray-200 bg-[#FAFAF8] p-1">
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
