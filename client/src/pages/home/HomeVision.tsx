import { Link } from "wouter";
import {
  FadeIn,
  getUsableHref,
  type HomeSectionConfig,
} from "./_helpers";

type HomeVisionProps = {
  churchIntroSection: HomeSectionConfig;
};

export default function HomeVision({
  churchIntroSection,
}: HomeVisionProps) {
  return (
    <section
      className="py-20 relative overflow-hidden"
      style={{
        backgroundImage: `url(${churchIntroSection.backgroundImage})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <div className="absolute inset-0 bg-[#0F172A]/80" />
      <div className="container relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <FadeIn>
            <div className="text-white">
              <p className="text-xs tracking-[0.3em] text-[#A5D6A7] mb-3 font-medium">
                {churchIntroSection.eyebrow}
              </p>
              <h2
                className="text-3xl md:text-4xl font-bold leading-tight mb-5"
                style={{ fontFamily: "'Noto Serif KR', serif" }}
              >
                {churchIntroSection.title
                  .split("\n")
                  .map((line, index, array) => (
                    <span key={index}>
                      {line}
                      {index < array.length - 1 && <br />}
                    </span>
                  ))}
              </h2>
              <p className="text-white/70 leading-relaxed mb-8 text-sm md:text-base">
                {churchIntroSection.description}
              </p>
              <a
                href={getUsableHref(
                  churchIntroSection.buttonHref,
                  "/about/vision"
                )}
                className="inline-block px-7 py-3 bg-[#1B5E20] hover:bg-[#2E7D32] text-white text-sm font-medium rounded transition-colors"
              >
                {churchIntroSection.buttonText}
              </a>
            </div>
          </FadeIn>
          <FadeIn className="hidden">
            <div className="text-white">
              <p className="text-xs tracking-[0.3em] text-[#A5D6A7] mb-3 font-medium">
                OUR VISION
              </p>
              <h2
                className="text-3xl md:text-4xl font-bold leading-tight mb-5"
                style={{ fontFamily: "'Noto Serif KR', serif" }}
              >
                깊이있는 성장,
                <br />
                위대한 교회
              </h2>
              <p className="text-white/70 leading-relaxed mb-8 text-sm md:text-base">
                기쁨의교회는 복음의 능력으로 한 사람 한 사람을 세우고, 지역
                사회와 열방을 섬기는 교회입니다. 말씀과 기도, 예배와 교제를
                통해 그리스도의 몸을 이루어 가고 있습니다.
              </p>
              <Link
                href="/about/vision"
                className="inline-block px-7 py-3 bg-[#1B5E20] hover:bg-[#2E7D32] text-white text-sm font-medium rounded transition-colors"
              >
                교회 소개 보기
              </Link>
            </div>
          </FadeIn>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              {
                icon: "fa-bible",
                title: "말씀 중심",
                desc: "하나님의 말씀을 삶의 기준으로 삼고 깊이 있게 배웁니다.",
              },
              {
                icon: "fa-heart",
                title: "기도의 교회",
                desc: "새벽기도와 중보기도를 통해 하나님과 깊이 교제합니다.",
              },
              {
                icon: "fa-globe-asia",
                title: "선교하는 교회",
                desc: "국내외 선교를 통해 복음을 땅끝까지 전합니다.",
              },
            ].map((v, i) => (
              <FadeIn key={i} delay={i * 100}>
                <div className="bg-white/10 border border-white/15 rounded-xl p-6 text-center hover:bg-white/15 transition-colors">
                  <div className="text-[#A5D6A7] text-3xl mb-3">
                    <i className={`fas ${v.icon}`}></i>
                  </div>
                  <h3 className="text-white font-semibold mb-2 text-sm">
                    {v.title}
                  </h3>
                  <p className="text-white/60 text-xs leading-relaxed">
                    {v.desc}
                  </p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
