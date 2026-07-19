import { lazy, Suspense, useState } from "react";
import { PencilLine } from "lucide-react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import HomeAdminDock from "@/components/HomeAdminDock";
import { finishDomainLogout } from "@/lib/mainHomepageDomain";

const MenuEditPanel = lazy(() => import("@/components/MenuEditPanel"));
const NoticeEditPanel = lazy(() => import("@/components/NoticeEditPanel"));
const HeroEditPanel = lazy(() => import("@/components/HeroEditPanel"));
const QuickMenuEditPanel = lazy(() =>
  import("@/components/QuickMenuEditPanel")
);
const AffiliateEditPanel = lazy(() =>
  import("@/components/AffiliateEditPanel")
);
const GalleryEditPanel = lazy(() => import("@/components/GalleryEditPanel"));
const HomeSectionsEditPanel = lazy(() =>
  import("@/components/HomeSectionsEditPanel")
);

const LABEL_OPEN_ADMIN_TOOLS = "\uD604\uC7AC \uD3B8\uC9D1 \uD328\uB110\uC744 \uB2EB\uACE0 \uC5B4\uB4DC\uBBFC \uBA54\uB274 \uC5F4\uAE30";

function formatNotificationCount(count: number) {
  return count > 99 ? "99+" : String(count);
}

export default function SitewideAdminEditor() {
  const { user } = useAuth();
  const [location] = useLocation();
  const isAdmin = user?.role === "admin";
  const isHomePage = location === "/" || location === "/home";

  const [menuPanelOpen, setMenuPanelOpen] = useState(false);
  const [noticePanelOpen, setNoticePanelOpen] = useState(false);
  const [heroPanelOpen, setHeroPanelOpen] = useState(false);
  const [quickMenuPanelOpen, setQuickMenuPanelOpen] = useState(false);
  const [affiliatePanelOpen, setAffiliatePanelOpen] = useState(false);
  const [galleryPanelOpen, setGalleryPanelOpen] = useState(false);
  const [homeSectionsPanelOpen, setHomeSectionsPanelOpen] = useState(false);
  const [adminToolsOpen, setAdminToolsOpen] = useState(false);
  const utils = trpc.useUtils();

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: (data) => {
      finishDomainLogout("/", data.domainLogoutIntent);
    },
  });
  const { data: notificationSummary } = trpc.cms.notifications.summary.useQuery(undefined, {
    enabled: isAdmin,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
  const notificationCount = notificationSummary?.totalCount ?? 0;
  const hasOpenPanel =
    menuPanelOpen ||
    noticePanelOpen ||
    heroPanelOpen ||
    quickMenuPanelOpen ||
    affiliatePanelOpen ||
    galleryPanelOpen ||
    homeSectionsPanelOpen;

  const refreshAfterPanelClose = () => {
    if (menuPanelOpen) void utils.home.menus.invalidate();
    if (noticePanelOpen) void utils.home.notices.invalidate();
    if (heroPanelOpen) void utils.home.heroSlides.invalidate();
    if (quickMenuPanelOpen) void utils.home.quickMenus.invalidate();
    if (affiliatePanelOpen) void utils.home.affiliates.invalidate();
    if (galleryPanelOpen) void utils.home.homeGallery.invalidate();
    if (homeSectionsPanelOpen) void utils.home.settings.invalidate();
  };

  const closeEditPanels = () => {
    refreshAfterPanelClose();
    setMenuPanelOpen(false);
    setNoticePanelOpen(false);
    setHeroPanelOpen(false);
    setQuickMenuPanelOpen(false);
    setAffiliatePanelOpen(false);
    setGalleryPanelOpen(false);
    setHomeSectionsPanelOpen(false);
  };

  const openAdminToolsFromPanel = () => {
    closeEditPanels();
    setAdminToolsOpen(true);
  };

  if (!isAdmin || isHomePage) {
    return null;
  }

  return (
    <>
      {!hasOpenPanel && (
        <HomeAdminDock
          loggingOut={logoutMutation.isPending}
          notificationCount={notificationCount}
          open={adminToolsOpen}
          onClose={() => setAdminToolsOpen(false)}
          onLogout={() => logoutMutation.mutate()}
          onOpenAffiliates={() => {
            setAdminToolsOpen(false);
            setAffiliatePanelOpen(true);
          }}
          onOpenHero={() => {
            setAdminToolsOpen(false);
            setHeroPanelOpen(true);
          }}
          onOpenHomeSections={() => {
            setAdminToolsOpen(false);
            setHomeSectionsPanelOpen(true);
          }}
          onOpenMenu={() => {
            setAdminToolsOpen(false);
            setMenuPanelOpen(true);
          }}
          onOpenQuickMenu={() => {
            setAdminToolsOpen(false);
            setQuickMenuPanelOpen(true);
          }}
          onToggle={() => setAdminToolsOpen(prev => !prev)}
        />
      )}

      {hasOpenPanel && (
        <button
          type="button"
          onClick={openAdminToolsFromPanel}
          aria-label={LABEL_OPEN_ADMIN_TOOLS}
          className="fixed bottom-4 left-4 z-[130] flex size-16 items-center justify-center rounded-full border border-[#184D1D]/10 bg-[#1B5E20] text-white shadow-[0_14px_36px_rgba(27,94,32,0.26)] transition hover:-translate-y-0.5 hover:bg-[#174D1A] sm:bottom-6 sm:left-6"
        >
          {notificationCount > 0 && (
            <span className="absolute -right-1 -top-1 flex min-w-6 items-center justify-center rounded-full bg-red-500 px-1.5 py-0.5 text-[11px] font-bold leading-none text-white ring-2 ring-white">
              {formatNotificationCount(notificationCount)}
            </span>
          )}
          <span className="flex size-8 items-center justify-center rounded-full bg-white/12 sm:size-9">
            <PencilLine className="size-4" />
          </span>
        </button>
      )}

      <Suspense fallback={null}>
        {menuPanelOpen && (
          <MenuEditPanel
            open={menuPanelOpen}
            onClose={() => {
              setMenuPanelOpen(false);
              void utils.home.menus.invalidate();
            }}
          />
        )}
        {noticePanelOpen && (
          <NoticeEditPanel
            open={noticePanelOpen}
            onClose={() => {
              setNoticePanelOpen(false);
              void utils.home.notices.invalidate();
            }}
          />
        )}
        {heroPanelOpen && (
          <HeroEditPanel
            open={heroPanelOpen}
            onClose={() => {
              setHeroPanelOpen(false);
              void utils.home.heroSlides.invalidate();
            }}
          />
        )}
        {quickMenuPanelOpen && (
          <QuickMenuEditPanel
            open={quickMenuPanelOpen}
            onClose={() => {
              setQuickMenuPanelOpen(false);
              void utils.home.quickMenus.invalidate();
            }}
          />
        )}
        {affiliatePanelOpen && (
          <AffiliateEditPanel
            open={affiliatePanelOpen}
            onClose={() => {
              setAffiliatePanelOpen(false);
              void utils.home.affiliates.invalidate();
            }}
          />
        )}
        {homeSectionsPanelOpen && (
          <HomeSectionsEditPanel
            open={homeSectionsPanelOpen}
            onClose={() => {
              setHomeSectionsPanelOpen(false);
              void utils.home.settings.invalidate();
            }}
          />
        )}
        {galleryPanelOpen && (
          <GalleryEditPanel
            open={galleryPanelOpen}
            onClose={() => {
              setGalleryPanelOpen(false);
              void utils.home.homeGallery.invalidate();
            }}
          />
        )}
      </Suspense>
    </>
  );
}
