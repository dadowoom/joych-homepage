import type {
  WorshipScheduleContent,
  WorshipScheduleIcon,
  WorshipScheduleTheme,
} from "@shared/worshipSchedule";

const THEME_STYLES: Record<
  WorshipScheduleTheme,
  { card: string; icon: string }
> = {
  green: { card: "bg-[#E8F5E9]", icon: "text-[#1B5E20]" },
  blue: { card: "bg-blue-50", icon: "text-blue-600" },
  amber: { card: "bg-amber-50", icon: "text-amber-600" },
  rose: { card: "bg-rose-50", icon: "text-rose-600" },
  purple: { card: "bg-purple-50", icon: "text-purple-600" },
  slate: { card: "bg-slate-100", icon: "text-slate-600" },
};

const ICON_CLASSES: Record<WorshipScheduleIcon, string> = {
  sun: "fa-sun",
  church: "fa-church",
  moon: "fa-moon",
  fire: "fa-fire",
  cross: "fa-cross",
  heart: "fa-heart",
  users: "fa-users",
  bell: "fa-bell",
};

type WorshipScheduleCardsProps = {
  content: WorshipScheduleContent;
  forceMobile?: boolean;
  forceDesktop?: boolean;
};

export function WorshipScheduleCards({
  content,
  forceMobile = false,
  forceDesktop = false,
}: WorshipScheduleCardsProps) {
  const useCompactLayout = forceMobile && !forceDesktop;

  return (
    <div>
      <div
        className={
          useCompactLayout
            ? "grid grid-cols-1 gap-4"
            : forceDesktop
              ? "grid grid-cols-2 gap-6"
            : "grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6"
        }
      >
        {content.sections.map(section => {
          const theme = THEME_STYLES[section.theme] ?? THEME_STYLES.green;
          return (
            <section
              key={section.id}
              className={`rounded-lg shadow-sm ${
                useCompactLayout ? "p-5" : forceDesktop ? "p-7" : "p-5 sm:p-7"
              } ${theme.card}`}
            >
              <div
                className={`flex items-center gap-3 ${
                  useCompactLayout
                    ? "mb-4"
                    : forceDesktop
                      ? "mb-6"
                      : "mb-4 sm:mb-6"
                }`}
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white shadow-sm">
                  <i
                    className={`fas ${ICON_CLASSES[section.icon] ?? ICON_CLASSES.church} ${theme.icon}`}
                    aria-hidden="true"
                  />
                </div>
                <h3
                  className={`break-keep font-bold text-gray-800 ${
                    useCompactLayout
                      ? "text-base"
                      : forceDesktop
                        ? "text-lg"
                        : "text-base sm:text-lg"
                  }`}
                  style={{ fontFamily: "'Noto Serif KR', serif" }}
                >
                  {section.title || "제목 없는 예배 블록"}
                </h3>
              </div>

              <div>
                {section.entries.map(entry => (
                  <div
                    key={entry.id}
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 border-b border-black/5 py-3 last:border-0"
                  >
                    <div className="min-w-0">
                      <span className="block break-keep text-sm font-medium text-gray-700">
                        {entry.label || "예배 이름"}
                      </span>
                      {entry.note && useCompactLayout ? (
                        <p className="mt-1 break-keep text-xs leading-5 text-gray-500">
                          {entry.note}
                        </p>
                      ) : entry.note && !forceDesktop ? (
                        <p className="mt-1 break-keep text-xs leading-5 text-gray-500 sm:hidden">
                          {entry.note}
                        </p>
                      ) : null}
                    </div>
                    <div className="shrink-0 text-right">
                      <span
                        className={`block whitespace-nowrap font-bold text-gray-900 ${
                          useCompactLayout
                            ? "text-sm"
                            : forceDesktop
                              ? "text-base"
                              : "text-sm sm:text-base"
                        }`}
                      >
                        {entry.time || "시간"}
                      </span>
                      {entry.note && !useCompactLayout ? (
                        <p
                          className={`mt-0.5 max-w-52 break-keep text-xs leading-5 text-gray-500 ${
                            forceDesktop ? "block" : "hidden sm:block"
                          }`}
                        >
                          {entry.note}
                        </p>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </div>

      {content.notice ? (
        <div
          className={`flex gap-2 rounded-lg bg-[#E8F5E9] text-sm leading-6 text-[#1B5E20] ${
            useCompactLayout
              ? "mt-6 p-4"
              : forceDesktop
                ? "mt-8 p-6"
                : "mt-6 p-4 sm:mt-8 sm:p-6"
          }`}
        >
          <i className="fas fa-info-circle mt-1 shrink-0" aria-hidden="true" />
          <span className="break-keep">{content.notice}</span>
        </div>
      ) : null}
    </div>
  );
}
