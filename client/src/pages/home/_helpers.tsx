import { useRef, useState, useEffect } from "react";
import {
  isExternalSiteHref,
  normalizeSiteHref,
} from "@/lib/siteHref";

export type HomeSectionConfig = {
  eyebrow: string;
  title: string;
  description: string;
  buttonText?: string;
  buttonHref?: string;
  backgroundImage?: string;
  subtitle?: string;
};

export type HomeFeatureCard = {
  title: string;
  badge: string;
  description: string;
  buttonText: string;
  imageUrl: string;
  href: string;
};

export function useFadeIn() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return { ref, visible };
}

export function FadeIn({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const { ref, visible } = useFadeIn();

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(28px)",
        transition: `opacity 0.6s ease ${delay}ms, transform 0.6s ease ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

export function getUsableHref(
  href: string | null | undefined,
  fallback: string
) {
  const normalized = normalizeSiteHref(href);
  if (normalized) return normalized;

  return normalizeSiteHref(fallback) ?? fallback;
}

export function isExternalHref(href: string) {
  return isExternalSiteHref(href);
}
