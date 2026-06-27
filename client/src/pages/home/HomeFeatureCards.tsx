import {
  getUsableHref,
  isExternalHref,
  type HomeFeatureCard,
} from "./_helpers";

type HomeFeatureCardsProps = {
  homeFeatureCards: HomeFeatureCard[];
};

export default function HomeFeatureCards({
  homeFeatureCards,
}: HomeFeatureCardsProps) {
  return (
    <section className="bg-[#F7F8F5] py-14">
      <div className="container mb-10 text-center">
        <p className="text-[#1B5E20] text-xs tracking-[0.3em] uppercase font-semibold mb-2">
          FEATURED MINISTRY
        </p>
        <h2
          className="text-2xl md:text-3xl font-bold text-[#1A1A1A]"
          style={{ fontFamily: "'Noto Serif KR', serif" }}
        >
          주요 사역
        </h2>
        <div className="mt-3 mx-auto w-12 h-[3px] bg-[#1B5E20] rounded-full" />
      </div>

      <div className="container">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {homeFeatureCards.map((card, index) => (
            <a
              key={`${card.title}-${index}`}
              href={getUsableHref(card.href, "#")}
              target={isExternalHref(card.href) ? "_blank" : undefined}
              rel={
                isExternalHref(card.href) ? "noopener noreferrer" : undefined
              }
              className="group block overflow-hidden rounded-2xl bg-white shadow-md transition-shadow duration-300 hover:shadow-xl"
            >
              <div className="relative h-96 overflow-hidden">
                <div
                  className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-105"
                  style={{ backgroundImage: `url('${card.imageUrl}')` }}
                />
                <div className="absolute inset-0 bg-black/20 transition-colors duration-300 group-hover:bg-black/10" />
                <div className="absolute left-4 top-4">
                  <span className="rounded-full bg-[#1B5E20] px-3 py-1 text-[10px] font-medium uppercase tracking-widest text-white">
                    {card.badge}
                  </span>
                </div>
              </div>
              <div className="p-6">
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#1B5E20]">
                  {card.badge}
                </p>
                <h3
                  className="mb-2 text-xl font-bold text-[#1A1A1A]"
                  style={{ fontFamily: "'Noto Serif KR', serif" }}
                >
                  {card.title}
                </h3>
                <p className="text-sm leading-relaxed text-gray-500">
                  {card.description}
                </p>
                <div className="mt-4 flex items-center gap-1 text-sm font-semibold text-[#1B5E20]">
                  <span>{card.buttonText || "View more"}</span>
                  <span className="transition-transform duration-300 group-hover:translate-x-1">
                    →
                  </span>
                </div>
              </div>
            </a>
          ))}
        </div>
        <div className="hidden grid-cols-1 md:grid-cols-3 gap-6">
          <a
            href="/community/testimony"
            className="group block rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition-shadow duration-300 bg-white"
          >
            <div className="relative h-96 overflow-hidden">
              <div
                className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-105"
                style={{
                  backgroundImage: `url('https://d2xsxph8kpxj0f.cloudfront.net/310519663470178900/KASTcRBzh5rwhJEekrJN6E/church-worship-praise_d34c61eb.webp')`,
                }}
              />
              <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors duration-300" />
              <div className="absolute top-4 left-4">
                <span className="bg-[#1B5E20] text-white text-[10px] tracking-widest uppercase px-3 py-1 rounded-full font-medium">
                  생선 콘퍼런스
                </span>
              </div>
            </div>
            <div className="p-6">
              <p className="text-[#1B5E20] text-[11px] tracking-[0.2em] uppercase font-semibold mb-1">
                SAENGSEON CONFERENCE
              </p>
              <h3
                className="text-xl font-bold text-[#1A1A1A] mb-2"
                style={{ fontFamily: "'Noto Serif KR', serif" }}
              >
                생선 간증
              </h3>
              <p className="text-gray-500 text-sm leading-relaxed">
                생선제자훈련 수료자들의 은혜로운 간증을 나눕니다
              </p>
              <div className="mt-4 flex items-center gap-1 text-[#1B5E20] text-sm font-semibold">
                <span>자세히 보기</span>
                <span className="transition-transform duration-300 group-hover:translate-x-1">
                  →
                </span>
              </div>
            </div>
          </a>

          <a
            href="/mission"
            className="group block rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition-shadow duration-300 bg-white"
          >
            <div className="relative h-96 overflow-hidden">
              <div
                className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-105"
                style={{
                  backgroundImage: `url('https://d2xsxph8kpxj0f.cloudfront.net/310519663470178900/KASTcRBzh5rwhJEekrJN6E/church-worship-sunday_f599f896.jpg')`,
                }}
              />
              <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors duration-300" />
              <div className="absolute top-4 left-4">
                <span className="bg-[#1B5E20] text-white text-[10px] tracking-widest uppercase px-3 py-1 rounded-full font-medium">
                  선교 보고
                </span>
              </div>
            </div>
            <div className="p-6">
              <p className="text-[#1B5E20] text-[11px] tracking-[0.2em] uppercase font-semibold mb-1">
                MISSION REPORT
              </p>
              <h3
                className="text-xl font-bold text-[#1A1A1A] mb-2"
                style={{ fontFamily: "'Noto Serif KR', serif" }}
              >
                선교보고
              </h3>
              <p className="text-gray-500 text-sm leading-relaxed">
                세계 곳곳에서 전해오는 선교 현장의 이야기
              </p>
              <div className="mt-4 flex items-center gap-1 text-[#1B5E20] text-sm font-semibold">
                <span>자세히 보기</span>
                <span className="transition-transform duration-300 group-hover:translate-x-1">
                  →
                </span>
              </div>
            </div>
          </a>

          <a
            href="/playground"
            className="group block rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition-shadow duration-300 bg-white"
          >
            <div className="relative h-96 overflow-hidden">
              <div
                className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-105"
                style={{
                  backgroundImage: `url('https://d2xsxph8kpxj0f.cloudfront.net/310519663470178900/KASTcRBzh5rwhJEekrJN6E/church-exterior-3_82fdf499.jpg')`,
                }}
              />
              <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors duration-300" />
              <div className="absolute top-4 left-4">
                <span className="bg-[#1B5E20] text-white text-[10px] tracking-widest uppercase px-3 py-1 rounded-full font-medium">
                  커뮤니티
                </span>
              </div>
            </div>
            <div className="p-6">
              <p className="text-[#1B5E20] text-[11px] tracking-[0.2em] uppercase font-semibold mb-1">
                PLAY GROUND
              </p>
              <h3
                className="text-xl font-bold text-[#1A1A1A] mb-2"
                style={{ fontFamily: "'Noto Serif KR', serif" }}
              >
                플레이 그라운드
              </h3>
              <p className="text-gray-500 text-sm leading-relaxed">
                기쁨의교회 FaithPlus 활동 랭킹
              </p>
              <div className="mt-4 flex items-center gap-1 text-[#1B5E20] text-sm font-semibold">
                <span>자세히 보기</span>
                <span className="transition-transform duration-300 group-hover:translate-x-1">
                  →
                </span>
              </div>
            </div>
          </a>
        </div>
      </div>
    </section>
  );
}
