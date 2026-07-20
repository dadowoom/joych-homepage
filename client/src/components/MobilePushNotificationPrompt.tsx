import { PushNotificationToggle } from "@/components/PushNotificationToggle";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";

const HIDDEN_PATH_PREFIXES = [
  "/admin_joych_2026",
  "/member/login",
  "/member/register",
  "/member/account-recovery",
  "/member/password-reset",
  "/member/social-complete",
];

export default function MobilePushNotificationPrompt() {
  const [location] = useLocation();
  const { user: adminUser, loading: adminLoading } = useAuth();
  const { data: memberMe, isLoading: memberLoading } = trpc.members.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const shouldHideByPath = HIDDEN_PATH_PREFIXES.some((prefix) => location.startsWith(prefix));
  const isLoggedIn = Boolean(adminUser || memberMe);

  if (shouldHideByPath || adminLoading || memberLoading || !isLoggedIn) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[120] flex justify-center px-4 pb-[env(safe-area-inset-bottom)] md:hidden">
      <div className="pointer-events-auto w-full max-w-sm">
        <PushNotificationToggle
          title="알림 켜기"
          variant="compact"
          hideWhenSubscribed
        />
      </div>
    </div>
  );
}
