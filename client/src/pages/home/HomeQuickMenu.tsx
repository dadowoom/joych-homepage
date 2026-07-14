import { Link } from "wouter";
import { isSiteHostname } from "@shared/siteHosts";
import { getUsableHref } from "./_helpers";

function normalizeQuickMenuHref(href: string) {
  if (!href.startsWith("http://") && !href.startsWith("https://")) return href;

  try {
    const url = new URL(href);
    const currentHostname =
      typeof window !== "undefined" ? window.location.hostname : "";
    if (url.hostname === currentHostname || isSiteHostname(url.hostname)) {
      return `${url.pathname}${url.search}${url.hash}` || "/";
    }
  } catch {
    return href;
  }

  return href;
}

type QuickMenuItem = {
  icon: string;
  label: string;
  href?: string | null;
};

type HomeQuickMenuProps = {
  quickMenus: QuickMenuItem[];
};

export default function HomeQuickMenu({ quickMenus }: HomeQuickMenuProps) {
  return (
    <section className="bg-white shadow-md relative z-10">
      <div className="container">
        <ul className="flex flex-wrap justify-center">
          {quickMenus.map((item, i) => {
            const inner = (
              <>
                <div className="w-12 h-12 rounded-full bg-[#E8F5E9] flex items-center justify-center text-[#1B5E20] text-lg group-hover:bg-[#1B5E20] group-hover:text-white transition-colors">
                  <i className={`fas ${item.icon}`}></i>
                </div>
                <span className="text-xs text-gray-600 text-center leading-tight">
                  {item.label}
                </span>
              </>
            );

            const cls =
              "flex flex-col items-center gap-2.5 py-5 px-4 w-28 hover:bg-[#F1F8E9] transition-colors group";

            return (
              <li key={i}>
                {(() => {
                  const href = getUsableHref(item.href, "");
                  if (!href) {
                    return (
                      <span className={`${cls} cursor-default`}>{inner}</span>
                    );
                  }

                  const quickMenuHref = normalizeQuickMenuHref(href);

                  return quickMenuHref.startsWith("/") ? (
                    <Link href={quickMenuHref} className={cls}>
                      {inner}
                    </Link>
                  ) : (
                    <a href={quickMenuHref} className={cls}>
                      {inner}
                    </a>
                  );
                })()}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
