import { FadeIn, getUsableHref, isExternalHref } from "./_helpers";

type Affiliate = {
  icon: string;
  label: string;
  href: string | null;
};

type HomeAffiliatesProps = {
  affiliates: Affiliate[];
};

export default function HomeAffiliates({
  affiliates,
}: HomeAffiliatesProps) {
  return (
    <section className="py-14 bg-[#F7F7F5]">
      <div className="container">
        <FadeIn>
          <h2
            className="text-center text-2xl font-bold text-gray-900 mb-10"
            style={{ fontFamily: "'Noto Serif KR', serif" }}
          >
            관련 기관
          </h2>
        </FadeIn>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {affiliates.map((a, i) => (
            <FadeIn key={i} delay={i * 80}>
              {getUsableHref(a.href, "") ? (
                <a
                  href={getUsableHref(a.href, "")}
                  target={
                    isExternalHref(getUsableHref(a.href, ""))
                      ? "_blank"
                      : undefined
                  }
                  rel={
                    isExternalHref(getUsableHref(a.href, ""))
                      ? "noopener noreferrer"
                      : undefined
                  }
                  className="flex flex-col items-center gap-3 py-8 px-4 bg-white border border-gray-100 rounded-xl text-center hover:border-[#1B5E20] hover:text-[#1B5E20] hover:-translate-y-1 transition-all duration-200 shadow-sm"
                >
                  <div className="text-[#1B5E20] text-3xl">
                    <i className={`fas ${a.icon}`}></i>
                  </div>
                  <span className="text-sm text-gray-600 font-medium">
                    {a.label}
                  </span>
                </a>
              ) : (
                <span className="flex flex-col items-center gap-3 py-8 px-4 bg-white border border-gray-100 rounded-xl text-center transition-all duration-200 shadow-sm">
                  <div className="text-[#1B5E20] text-3xl">
                    <i className={`fas ${a.icon}`}></i>
                  </div>
                  <span className="text-sm text-gray-600 font-medium">
                    {a.label}
                  </span>
                </span>
              )}
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}
