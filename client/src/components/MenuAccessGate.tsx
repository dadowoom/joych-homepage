import MemberOnlyContentNotice from "@/components/MemberOnlyContentNotice";
import { useAuth } from "@/_core/hooks/useAuth";
import { canManageAnyContent } from "@/lib/contentPermissions";
import { trpc } from "@/lib/trpc";
import NotFound from "@/pages/NotFound";
import type { ReactNode } from "react";

type MenuAccessGateProps = {
  href: string;
  title?: string;
  children: ReactNode;
};

export default function MenuAccessGate({ href, title, children }: MenuAccessGateProps) {
  const { user, loading: authLoading } = useAuth();
  const { data: accessInfo, isLoading } = trpc.home.menuAccessByHref.useQuery({ href });
  const hasAdminAccess = canManageAnyContent(user);

  if (isLoading || authLoading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center text-sm text-gray-400">
        불러오는 중...
      </div>
    );
  }

  if (!accessInfo) {
    return <>{children}</>;
  }

  if (accessInfo.isReadable || hasAdminAccess) {
    return <>{children}</>;
  }

  if (accessInfo.allowMember) {
    return <MemberOnlyContentNotice resourceLabel={title ?? accessInfo.label ?? "페이지"} fallbackPath={href} />;
  }

  return <NotFound />;
}
