import { useEffect, useRef } from "react";
import {
  Building2,
  House,
  ImageIcon,
  LayoutGrid,
  LogOut,
  Menu,
  MonitorPlay,
  Newspaper,
  PencilLine,
  Shield,
  X,
} from "lucide-react";

import { cn } from "@/lib/utils";

const LABEL_EDIT_TOOLS = "\uD3B8\uC9D1 \uB3C4\uAD6C";
const LABEL_HOME_SECTIONS = "\uD648\uC139\uC158 \uD3B8\uC9D1";
const LABEL_MENU = "\uBA54\uB274 \uD3B8\uC9D1";
const LABEL_NOTICE = "\uAD50\uD68C \uC18C\uC2DD \uD3B8\uC9D1";
const LABEL_HERO = "\uC2AC\uB77C\uC774\uB4DC \uD3B8\uC9D1";
const LABEL_QUICK_MENU = "\uD035\uBA54\uB274 \uD3B8\uC9D1";
const LABEL_AFFILIATES = "\uAD00\uB828\uAE30\uAD00 \uD3B8\uC9D1";
const LABEL_GALLERY = "\uAC24\uB7EC\uB9AC \uD3B8\uC9D1";
const LABEL_DASHBOARD = "\uAD00\uB9AC\uC790 \uB300\uC2DC\uBCF4\uB4DC";
const LABEL_LOGOUT = "\uB85C\uADF8\uC544\uC6C3";
const LABEL_LOGGING_OUT = "\uB85C\uADF8\uC544\uC6C3 \uC911";
const LABEL_CLOSE = "\uD3B8\uC9D1 \uB3C4\uAD6C \uB2EB\uAE30";
const LABEL_OPEN = "\uD3B8\uC9D1 \uB3C4\uAD6C \uC5F4\uAE30";
const LABEL_NEW_NOTIFICATION = "\uC0C8 \uC54C\uB9BC";
const LABEL_COUNT_UNIT = "\uAC74";

type HomeAdminDockProps = {
  loggingOut: boolean;
  notificationCount?: number;
  open: boolean;
  onClose: () => void;
  onLogout: () => void;
  onOpenAffiliates: () => void;
  onOpenGallery: () => void;
  onOpenHero: () => void;
  onOpenHomeSections: () => void;
  onOpenMenu: () => void;
  onOpenNotice: () => void;
  onOpenQuickMenu: () => void;
  onToggle: () => void;
};

type ActionButtonProps = {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  href?: string;
  tone?: "default" | "accent";
  featured?: boolean;
};

function formatNotificationCount(count: number) {
  return count > 99 ? "99+" : String(count);
}

function ActionButton({
  icon,
  label,
  onClick,
  href,
  tone = "default",
  featured = false,
}: ActionButtonProps) {
  const baseClassName = cn(
    "group flex items-center gap-3 rounded-2xl border text-left transition-all",
    featured ? "px-4 py-4" : "px-3.5 py-3",
    tone === "default" &&
      "border-[#D7E7D8] bg-[#FAFAF8] text-[#16331A] hover:border-[#B6D2B8] hover:bg-[#EEF6EE]",
    tone === "accent" &&
      "border-[#CDE2CF] bg-[#F3F8F3] text-[#16331A] hover:border-[#A9C9AE] hover:bg-[#E8F3E9]",
    featured &&
      "border-[#1B5E20] bg-[#1B5E20] text-white shadow-[0_16px_40px_rgba(27,94,32,0.24)] hover:bg-[#174D1A]"
  );

  const iconWrapClassName = cn(
    "flex size-10 shrink-0 items-center justify-center rounded-xl border transition-colors",
    featured
      ? "border-white/20 bg-white/10 text-white"
      : "border-[#D6E5D6] bg-white text-[#1B5E20]"
  );

  const content = (
    <>
      <span className={iconWrapClassName}>{icon}</span>
      <span
        className={cn(
          "font-medium leading-tight",
          featured ? "text-sm" : "text-[13px]"
        )}
      >
        {label}
      </span>
    </>
  );

  if (href) {
    return (
      <a href={href} className={baseClassName}>
        {content}
      </a>
    );
  }

  return (
    <button type="button" onClick={onClick} className={baseClassName}>
      {content}
    </button>
  );
}

export default function HomeAdminDock({
  loggingOut,
  notificationCount = 0,
  open,
  onClose,
  onLogout,
  onOpenAffiliates,
  onOpenGallery,
  onOpenHero,
  onOpenHomeSections,
  onOpenMenu,
  onOpenNotice,
  onOpenQuickMenu,
  onToggle,
}: HomeAdminDockProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const hasNotifications = notificationCount > 0;

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (
        target &&
        !panelRef.current?.contains(target) &&
        !triggerRef.current?.contains(target)
      ) {
        onClose();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, open]);

  return (
    <div className="fixed right-4 bottom-4 z-[120] sm:right-6 sm:bottom-6">
      {open && (
        <div
          ref={panelRef}
          className="absolute right-0 bottom-[calc(100%+14px)] w-[min(380px,calc(100vw-2rem))] overflow-hidden rounded-[24px] border border-[#D6E5D6] bg-white/95 shadow-[0_24px_70px_rgba(15,23,42,0.22)] backdrop-blur supports-[backdrop-filter]:bg-white/90"
        >
          <div className="border-b border-[#E6EEE6] bg-[linear-gradient(135deg,#1B5E20_0%,#2E7D32_100%)] px-5 py-4 text-white">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/70">
                  Admin Mode
                </p>
                <h2 className="mt-1 text-base font-semibold">
                  {LABEL_EDIT_TOOLS}
                </h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex size-9 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white transition hover:bg-white/20"
                aria-label={LABEL_CLOSE}
              >
                <X className="size-4" />
              </button>
            </div>
          </div>

          <div className="space-y-4 p-4">
            <ActionButton
              featured
              icon={<House className="size-4" />}
              label={LABEL_HOME_SECTIONS}
              onClick={onOpenHomeSections}
            />

            <div className="grid grid-cols-2 gap-3">
              <ActionButton
                icon={<Menu className="size-4" />}
                label={LABEL_MENU}
                onClick={onOpenMenu}
              />
              <ActionButton
                icon={<Newspaper className="size-4" />}
                label={LABEL_NOTICE}
                onClick={onOpenNotice}
              />
              <ActionButton
                icon={<MonitorPlay className="size-4" />}
                label={LABEL_HERO}
                onClick={onOpenHero}
              />
              <ActionButton
                icon={<LayoutGrid className="size-4" />}
                label={LABEL_QUICK_MENU}
                onClick={onOpenQuickMenu}
              />
              <ActionButton
                icon={<Building2 className="size-4" />}
                label={LABEL_AFFILIATES}
                onClick={onOpenAffiliates}
              />
              <ActionButton
                icon={<ImageIcon className="size-4" />}
                label={LABEL_GALLERY}
                onClick={onOpenGallery}
              />
            </div>

            <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3">
              <ActionButton
                icon={<Shield className="size-4" />}
                label={
                  hasNotifications
                    ? `${LABEL_DASHBOARD} - ${LABEL_NEW_NOTIFICATION} ${formatNotificationCount(notificationCount)}${LABEL_COUNT_UNIT}`
                    : LABEL_DASHBOARD
                }
                href="/admin_joych_2026?view=notifications"
                tone="accent"
              />
              <button
                type="button"
                onClick={onLogout}
                disabled={loggingOut}
                className="flex items-center justify-center gap-2 rounded-2xl border border-[#F5D0D5] bg-[#FFF5F5] px-4 text-[13px] font-medium text-[#B42318] transition hover:bg-[#FDEBEC] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <LogOut className="size-4" />
                {loggingOut ? LABEL_LOGGING_OUT : LABEL_LOGOUT}
              </button>
            </div>
          </div>
        </div>
      )}

      <button
        ref={triggerRef}
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-label={LABEL_OPEN}
        className={cn(
          "relative flex items-center gap-3 rounded-full border border-[#184D1D]/10 px-4 py-3 text-white shadow-[0_18px_45px_rgba(27,94,32,0.28)] transition-all",
          open
            ? "bg-[#174D1A] hover:bg-[#174D1A]"
            : "bg-[#1B5E20] hover:-translate-y-0.5 hover:bg-[#174D1A]"
        )}
      >
        {hasNotifications && (
          <span className="absolute -right-1 -top-1 flex min-w-6 items-center justify-center rounded-full bg-red-500 px-1.5 py-0.5 text-[11px] font-bold leading-none text-white ring-2 ring-white">
            {formatNotificationCount(notificationCount)}
          </span>
        )}
        <span className="flex size-10 items-center justify-center rounded-full bg-white/12">
          <PencilLine className="size-4" />
        </span>
        <span className="flex flex-col items-start leading-none">
          <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/70">
            Admin
          </span>
          <span className="mt-1 text-sm font-semibold">{LABEL_EDIT_TOOLS}</span>
        </span>
      </button>
    </div>
  );
}
