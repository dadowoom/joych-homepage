import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";

export function useStaticPageContent<T>(href: string, fallback: T): T {
  const { language } = useLanguage();
  const { data } = trpc.home.staticPageContent.useQuery(
    { href },
    {
      staleTime: 30_000,
      retry: false,
    },
  );
  const { data: translatedData } = trpc.home.staticPageTranslation.useQuery(
    { href, locale: "ja" },
    {
      enabled: language === "ja",
      staleTime: 30_000,
      retry: false,
    },
  );

  if (language === "ja" && translatedData && typeof translatedData === "object" && !Array.isArray(translatedData)) {
    return translatedData as T;
  }

  if (data && typeof data === "object" && !Array.isArray(data)) {
    return data as T;
  }

  return fallback;
}
