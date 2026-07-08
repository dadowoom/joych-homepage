import type { ReactNode } from "react";
import MemberOnlyContentNotice from "@/components/MemberOnlyContentNotice";
import SubPageLayout from "@/components/SubPageLayout";
import { useAuth } from "@/_core/hooks/useAuth";
import { canManageAnyContent } from "@/lib/contentPermissions";
import {
  findMenuAccessMatchByHref,
  isHiddenMenuNode,
  isMemberOnlyMenuNode,
} from "@/lib/menuAccess";
import { getSideLayoutByHref } from "@/lib/menuSideLayout";
import { trpc } from "@/lib/trpc";
import NotFound from "@/pages/NotFound";

type MenuAccessGateProps = {
  href: string;
  title?: string;
  children: ReactNode;
};

export default function MenuAccessGate({ href, title, children }: MenuAccessGateProps) {
  const { user, loading: authLoading } = useAuth();
  const { data: accessInfo, isLoading } = trpc.home.menuAccessByHref.useQuery({ href });
  const { data: menus, isLoading: menusLoading } = trpc.home.menus.useQuery();
  const hasAdminAccess = canManageAnyContent(user);
  const fallbackMatch = findMenuAccessMatchByHref(menus, href);
  const fallbackNode = fallbackMatch?.node;
  const isSignedIn = Boolean(user);

  if (isLoading || authLoading || menusLoading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center text-sm text-gray-400">
        Loading...
      </div>
    );
  }

  if (hasAdminAccess) {
    return <>{children}</>;
  }

  if (accessInfo?.isReadable || (isSignedIn && isMemberOnlyMenuNode(fallbackNode))) {
    return <>{children}</>;
  }

  if (accessInfo?.allowMember || isMemberOnlyMenuNode(fallbackNode)) {
    const resourceLabel = title ?? accessInfo?.label ?? fallbackNode?.label ?? "페이지";
    const layout = getSideLayoutByHref(menus, href, resourceLabel);

    if (layout) {
      return (
        <SubPageLayout
          pageTitle={layout.pageTitle}
          parentLabel={layout.parentLabel}
          sideMenuItems={layout.sideMenuItems}
        >
          <MemberOnlyContentNotice resourceLabel={resourceLabel} fallbackPath={href} />
        </SubPageLayout>
      );
    }

    return <MemberOnlyContentNotice resourceLabel={resourceLabel} fallbackPath={href} />;
  }

  if (!accessInfo && fallbackMatch && !isHiddenMenuNode(fallbackNode)) {
    return <>{children}</>;
  }

  if (!accessInfo && !fallbackMatch) {
    return <>{children}</>;
  }

  return <NotFound />;
}
