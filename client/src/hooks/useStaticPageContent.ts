import { trpc } from "@/lib/trpc";

export function useStaticPageContent<T>(href: string, fallback: T): T {
  const { data } = trpc.home.staticPageContent.useQuery(
    { href },
    {
      staleTime: 30_000,
      retry: false,
    },
  );

  if (data && typeof data === "object" && !Array.isArray(data)) {
    return data as T;
  }

  return fallback;
}
