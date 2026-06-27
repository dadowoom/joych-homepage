import { Link } from "wouter";
import { FadeIn } from "./_helpers";

const SERMONS = [
  {
    badge: "주일예배",
    title: "주일예배 말씀 영상",
    date: "조이풀TV",
    href: "/page/조이풀tv-주일예배",
  },
  {
    badge: "수요예배",
    title: "수요예배 영상",
    date: "조이풀TV",
    href: "/worship/tv/hebron",
  },
  {
    badge: "새벽기도",
    title: "새벽기도회 영상",
    date: "조이풀TV",
    href: "/worship/tv/gloria",
  },
];

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
                  <iframe
                    className="w-full h-full"
                    src="https://www.youtube.com/embed/WmFzWf5uEzI?rel=0"
                    title="조이풀TV 최신 설교 영상"
                    loading="lazy"
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
                <div className="absolute top-3 left-3 bg-red-600 text-white text-xs px-2 py-1 rounded flex items-center gap-1">
                  <i className="fab fa-youtube"></i> 최신 설교
                </div>
              </div>
              <div className="divide-y divide-gray-50">
                {SERMONS.map((s, i) => (
                  <Link
                    key={i}
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
