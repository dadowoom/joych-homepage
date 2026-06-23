import { lazy, Suspense, useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import HomeAdminDock from "@/components/HomeAdminDock";

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

export default function SitewideAdminEditor() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

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
    onSuccess: () => {
      window.location.reload();
    },
  });

  if (!isAdmin) {
    return null;
  }

  return (
    <>
      <HomeAdminDock
        loggingOut={logoutMutation.isPending}
        open={adminToolsOpen}
        onClose={() => setAdminToolsOpen(false)}
        onLogout={() => logoutMutation.mutate()}
        onOpenAffiliates={() => {
          setAdminToolsOpen(false);
          setAffiliatePanelOpen(true);
        }}
        onOpenGallery={() => {
          setAdminToolsOpen(false);
          setGalleryPanelOpen(true);
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
        onOpenNotice={() => {
          setAdminToolsOpen(false);
          setNoticePanelOpen(true);
        }}
        onOpenQuickMenu={() => {
          setAdminToolsOpen(false);
          setQuickMenuPanelOpen(true);
        }}
        onToggle={() => {
          const hasOpenPanel =
            menuPanelOpen ||
            noticePanelOpen ||
            heroPanelOpen ||
            quickMenuPanelOpen ||
            affiliatePanelOpen ||
            galleryPanelOpen ||
            homeSectionsPanelOpen;

          if (hasOpenPanel) {
            setMenuPanelOpen(false);
            setNoticePanelOpen(false);
            setHeroPanelOpen(false);
            setQuickMenuPanelOpen(false);
            setAffiliatePanelOpen(false);
            setGalleryPanelOpen(false);
            setHomeSectionsPanelOpen(false);
            setAdminToolsOpen(true);
            return;
          }

          setAdminToolsOpen(prev => !prev);
        }}
      />

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
        {galleryPanelOpen && (
          <GalleryEditPanel
            open={galleryPanelOpen}
            onClose={() => {
              setGalleryPanelOpen(false);
              void utils.home.homeGallery.invalidate();
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
      </Suspense>
    </>
  );
}
