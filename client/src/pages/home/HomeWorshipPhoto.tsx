import {
  FadeIn,
  getUsableHref,
  type HomeSectionConfig,
} from "./_helpers";

type HomeWorshipPhotoProps = {
  worshipSection: HomeSectionConfig;
};

export default function HomeWorshipPhoto({
  worshipSection,
}: HomeWorshipPhotoProps) {
  return (
    <section className="py-16 bg-white">
      <div className="container">
        <FadeIn>
          <div className="text-center mb-10">
            <p className="text-xs tracking-[0.3em] text-[#1B5E20] mb-2 font-medium">
              {worshipSection.eyebrow}
            </p>
            <h2
              className="text-2xl md:text-3xl font-bold text-gray-900"
              style={{ fontFamily: "'Noto Serif KR', serif" }}
            >
              {worshipSection.title}
            </h2>
            <h2
              className="hidden text-2xl md:text-3xl font-bold text-gray-900"
              style={{ fontFamily: "'Noto Serif KR', serif" }}
            >
              함께 드리는 예배
            </h2>
          </div>
        </FadeIn>
        <FadeIn delay={100}>
          <div
            className="w-full h-64 md:h-96 rounded-2xl bg-cover bg-center overflow-hidden relative"
            style={{ backgroundImage: `url(${worshipSection.backgroundImage})` }}
          >
            <div className="absolute inset-0 bg-black/30 flex items-end p-8">
              <div className="text-white">
                {worshipSection.subtitle ? (
                  <p className="text-sm text-white/80 mb-1">
                    {worshipSection.subtitle}
                  </p>
                ) : null}
                <h3
                  className="text-xl md:text-2xl font-bold"
                  style={{ fontFamily: "'Noto Serif KR', serif" }}
                >
                  {worshipSection.title}
                </h3>
                <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/85 md:text-base">
                  {worshipSection.description}
                </p>
                <a
                  href={getUsableHref(
                    worshipSection.buttonHref,
                    "/worship/schedule"
                  )}
                  className="mt-5 inline-flex rounded bg-white px-5 py-2 text-sm font-semibold text-[#1B5E20] transition-colors hover:bg-[#F1F8E9]"
                >
                  {worshipSection.buttonText}
                </a>
                <p className="hidden text-sm text-white/80 mb-1">
                  매주 일요일 오전 11시
                </p>
                <h3
                  className="hidden text-xl md:text-2xl font-bold"
                  style={{ fontFamily: "'Noto Serif KR', serif" }}
                >
                  주일 예배에 오세요
                </h3>
              </div>
            </div>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
