import { Link } from "wouter";
import DirectVideoPlayer from "@/components/DirectVideoPlayer";
import { trpc } from "@/lib/trpc";
import { FadeIn } from "./_helpers";

const FALLBACK_SERMONS = [
  {
    key: "sunday",
    badge: "주일예배",
    title: "주일예배 말씀 영상",
    date: "조이풀TV",
    href: "/page/조이풀tv-주일예배",
  },
  {
    key: "wednesday",
    badge: "수요예배",
    title: "헤브론 수요예배",
    date: "조이풀TV",
    href: "/worship/tv/hebron",
  },
  {
    key: "friday",
    badge: "금요예배",
    title: "금요 경배의 용사들",
    date: "조이풀TV",
    href: "/page/조이풀tv-금요-경배와-용사들",
  },
];

function formatSermonDate(value?: string | null) {
  const trimmed = value?.trim();
  if (!trimmed) return "조이풀TV";
  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[1]}.${match[2]}.${match[3]}` : trimmed;
}

function buildSermonHref(href: string, videoId?: number | null) {
  if (!videoId) return href;
  return `${href}${href.includes("?") ? "&" : "?"}video=${videoId}`;
}

const BADGE_COLORS: Record<string, string> = {
  공지: "bg-blue-100 text-blue-700",
  행사: "bg-amber-100 text-amber-700",
  찬양: "bg-green-100 text-green-700",
};

type NoticeItem = {
  title: string;
  category: string;
  thumbnailUrl?: string | null;
  createdAt: string | Date;
};

type HomeNewsProps = {
  dbNotices: NoticeItem[];
};

export default function HomeNews({ dbNotices }: HomeNewsProps) {
  const {
    data: latestSermons,
    isLoading: latestSermonsLoading,
  } = trpc.youtube.getHomeLatest.useQuery(undefined, {
    staleTime: 60_000,
  });
  const fallbackByKey = new Map(
    FALLBACK_SERMONS.map(sermon => [sermon.key, sermon])
  );
  const sermons =
    latestSermons?.map(item => {
      const fallback = fallbackByKey.get(item.key);
      return {
        key: item.key,
        badge: item.badge,
        title: item.video?.title || fallback?.title || `${item.badge} 최신 영상`,
        date: formatSermonDate(item.video?.sermonDate),
        href: buildSermonHref(item.href, item.video?.id),
        videoId: item.video?.videoId ?? null,
        videoUrl: item.video?.videoUrl ?? null,
      };
    }) ??
    FALLBACK_SERMONS.map(sermon => ({
      ...sermon,
      videoId: null,
      videoUrl: null,
    }));
  const featuredSermon =
    sermons.find(sermon => sermon.key === "sunday") ?? sermons[0];

  return (
    <section className="py-16 bg-white">
      <div className="container">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
          <FadeIn className="h-full">
            <div className="bg-white rounded-xl shadow-sm p-6 h-full">
              <div className="flex justify-between items-center mb-5 pb-3 border-b-2 border-[#1B5E20]">
                <h2
                  className="text-lg font-bold text-gray-900"
                  style={{ fontFamily: "'Noto Serif KR', serif" }}
                >
                  조이풀 TV
                </h2>
                <Link
                  href="/page/조이풀tv-주일예배"
                  className="text-xs text-gray-400 hover:text-[#1B5E20] flex items-center gap-1 transition-colors"
                >
                  전체보기 <i className="fas fa-arrow-right text-[10px]"></i>
                </Link>
              </div>
              <div className="relative mb-4 rounded-lg overflow-hidden bg-gray-900">
                <div className="aspect-video">
                  {latestSermonsLoading ? (
                    <div
                      className="h-full w-full animate-pulse bg-gray-800"
                      aria-label="최신 설교 영상을 불러오는 중"
                    />
                  ) : featuredSermon?.videoId ? (
                    <iframe
                      className="h-full w-full"
                      src={`https://www.youtube.com/embed/${featuredSermon.videoId}?rel=0`}
                      title={featuredSermon.title}
                      loading="lazy"
                      frameBorder="0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  ) : featuredSermon?.videoUrl ? (
                    <DirectVideoPlayer
                      src={featuredSermon.videoUrl}
                      title={featuredSermon.title}
                      className="h-full w-full"
                    />
                  ) : (
                    <Link
                      href={featuredSermon?.href ?? FALLBACK_SERMONS[0].href}
                      className="flex h-full w-full flex-col items-center justify-center gap-3 text-white"
                    >
                      <i className="fas fa-play-circle text-5xl text-white/80" />
                      <span className="text-sm font-medium">
                        최신 영상 준비 중
                      </span>
                    </Link>
                  )}
                </div>
                {!latestSermonsLoading && (featuredSermon?.videoId || featuredSermon?.videoUrl) && (
                  <div className="absolute top-3 left-3 bg-red-600 text-white text-xs px-2 py-1 rounded flex items-center gap-1">
                    <i
                      className={
                        featuredSermon.videoId
                          ? "fab fa-youtube"
                          : "fas fa-play-circle"
                      }
                    />
                    최신 설교
                  </div>
                )}
              </div>
              <div className="divide-y divide-gray-50">
                {sermons.map(s => (
                  <Link
                    key={s.key}
                    href={s.href}
                    className="flex items-center gap-3 py-3 hover:text-[#1B5E20] transition-colors group"
                  >
                    <span className="shrink-0 bg-[#E8F5E9] text-[#1B5E20] text-xs px-2 py-0.5 rounded font-medium">
                      {s.badge}
                    </span>
                    <span className="flex-1 text-sm text-gray-700 truncate group-hover:text-[#1B5E20]">
                      {s.title}
                    </span>
                    <span className="shrink-0 text-xs text-gray-400">
                      {s.date}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </FadeIn>

          <FadeIn delay={100} className="h-full">
            <div className="bg-white rounded-xl shadow-sm p-6 h-full">
              <div className="flex justify-between items-center mb-5 pb-3 border-b-2 border-[#1B5E20]">
                <h2
                  className="text-lg font-bold text-gray-900"
                  style={{ fontFamily: "'Noto Serif KR', serif" }}
                >
                  교회 소식
                </h2>
                <Link
                  href="/page/행정지원-공지사항"
                  className="text-xs text-gray-400 hover:text-[#1B5E20] flex items-center gap-1 transition-colors"
                >
                  전체보기 <i className="fas fa-arrow-right text-[10px]"></i>
                </Link>
              </div>
              <div className="divide-y divide-gray-50">
                {dbNotices.map((n, i) => (
                  <Link
                    key={i}
                    href="/page/행정지원-공지사항"
                    className="flex items-center gap-3 py-3 hover:text-[#1B5E20] transition-colors group"
                  >
                    {n.thumbnailUrl && (
                      <div
                        className="w-16 h-12 rounded-md bg-cover bg-center shrink-0"
                        style={{
                          backgroundImage: `url(${n.thumbnailUrl})`,
                        }}
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <span
                        className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                          BADGE_COLORS[n.category] ??
                          "bg-gray-100 text-gray-700"
                        } inline-block mb-1`}
                      >
                        {n.category}
                      </span>
                      <p className="text-sm text-gray-700 truncate group-hover:text-[#1B5E20]">
                        {n.title}
                      </p>
                      <span className="text-xs text-gray-400">
                        {new Date(n.createdAt).toLocaleDateString("ko-KR")}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </FadeIn>
        </div>
      </div>
    </section>
  );
}
