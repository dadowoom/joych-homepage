import { useEffect, useRef, useState } from "react";
import { Bell, BellOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import {
  getCurrentPushSubscription,
  getNotificationPermission,
  isIosDevice,
  isPushSupported,
  isStandalonePwa,
  requestNotificationPermission,
  shouldRefreshPushSubscription,
  subscribeToPush,
  unsubscribeFromPush,
} from "@/lib/pushNotifications";

type PushNotificationToggleProps = {
  title?: string;
  enabledDescription?: string;
  disabledDescription?: string;
  variant?: "card" | "compact";
  hideWhenSubscribed?: boolean;
};

export function PushNotificationToggle({
  title = "예약 알림 받기",
  enabledDescription = "이 기기에서 새 예약 알림을 받을 준비가 되어 있습니다.",
  disabledDescription = "시설/차량 예약 담당자는 이 기기에서 알림을 켤 수 있습니다.",
  variant = "card",
  hideWhenSubscribed = false,
}: PushNotificationToggleProps = {}) {
  const utils = trpc.useUtils();
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const repairAttemptedForState = useRef<string | null>(null);
  const diagnosticReportedForState = useRef<string | null>(null);

  const vapidQuery = trpc.home.getVapidPublicKey.useQuery(undefined, {
    staleTime: Infinity,
  });
  const diagnosticMutation = trpc.push.reportDiagnostic.useMutation();
  const subscribeMutation = trpc.push.subscribe.useMutation();
  const unsubscribeMutation = trpc.push.unsubscribe.useMutation();
  const mySubscriptionsQuery = trpc.push.getMySubscriptions.useQuery(undefined, {
    enabled: supported,
  });

  const saveSubscription = async (subscription: PushSubscriptionJSON) => {
    if (!subscription.endpoint || !subscription.keys?.p256dh || !subscription.keys.auth) {
      throw new Error("Invalid push subscription.");
    }

    await subscribeMutation.mutateAsync({
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      },
      userAgent: navigator.userAgent,
    });
  };

  const saveFreshSubscription = async (vapidPublicKey: string) => {
    const previousEndpoint = (await getCurrentPushSubscription())?.endpoint ?? null;
    const subscription = await subscribeToPush(vapidPublicKey, { forceNew: true });
    await saveSubscription(subscription);

    if (previousEndpoint && subscription.endpoint && previousEndpoint !== subscription.endpoint) {
      await unsubscribeMutation.mutateAsync({ endpoint: previousEndpoint }).catch((error) => {
        console.warn("[Push] stale subscription cleanup failed", error);
      });
    }

    return subscription;
  };

  const getEndpointHost = (endpoint: string | null | undefined) => {
    if (!endpoint) return undefined;
    try {
      return new URL(endpoint).host;
    } catch {
      return "invalid-endpoint";
    }
  };

  const reportDiagnostic = (
    event: string,
    extra: {
      supported?: boolean;
      hasLocalSubscription?: boolean;
      serverSubscriptionCount?: number;
      endpoint?: string | null;
      error?: unknown;
    } = {},
  ) => {
    const error = extra.error;
    void diagnosticMutation.mutateAsync({
      event,
      supported: extra.supported ?? isPushSupported(),
      isIos: isIosDevice(),
      standalone: isStandalonePwa(),
      permission: typeof window !== "undefined" && "Notification" in window
        ? getNotificationPermission()
        : "unsupported",
      hasLocalSubscription: extra.hasLocalSubscription,
      serverSubscriptionCount: extra.serverSubscriptionCount,
      endpointHost: getEndpointHost(extra.endpoint),
      errorName: error instanceof Error ? error.name : undefined,
      errorMessage: error instanceof Error ? error.message : error ? String(error) : undefined,
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
    }).catch(() => undefined);
  };

  useEffect(() => {
    let cancelled = false;

    async function syncState() {
      const canPush = isPushSupported();
      if (cancelled) return;

      setSupported(canPush);
      setPermission(getNotificationPermission());

      if (!canPush) {
        const diagnosticKey = `unsupported:${isIosDevice()}:${isStandalonePwa()}:${getNotificationPermission()}`;
        if (diagnosticReportedForState.current !== diagnosticKey) {
          diagnosticReportedForState.current = diagnosticKey;
          reportDiagnostic("unsupported", { supported: false });
        }
        return;
      }

      try {
        const subscription = await getCurrentPushSubscription();
        if (cancelled) return;

        const serverSubscriptions = mySubscriptionsQuery.data;
        if (!serverSubscriptions) {
          setSubscribed(Boolean(subscription));
          reportDiagnostic("state-loading-server-subscriptions", {
            supported: canPush,
            hasLocalSubscription: Boolean(subscription),
            endpoint: subscription?.endpoint,
          });
          return;
        }

        const serverHasSubscription = Boolean(
          subscription?.endpoint &&
          serverSubscriptions.some((item) => item.endpoint === subscription.endpoint),
        );
        const vapidPublicKey = vapidQuery.data;
        const shouldRefreshSubscription = Boolean(
          subscription &&
          vapidPublicKey &&
          shouldRefreshPushSubscription(subscription, vapidPublicKey),
        );
        const hasGrantedPermission = getNotificationPermission() === "granted";
        const repairStateKey = [
          subscription?.endpoint ?? "missing-local-subscription",
          vapidPublicKey ?? "missing-vapid",
          serverHasSubscription ? "server-present" : "server-missing",
          shouldRefreshSubscription ? "vapid-refresh" : "vapid-ok",
        ].join(":");

        setSubscribed(serverHasSubscription && !shouldRefreshSubscription);

        const diagnosticKey = [
          "state",
          isIosDevice() ? "ios" : "other",
          isStandalonePwa() ? "standalone" : "browser",
          getNotificationPermission(),
          subscription ? "local" : "no-local",
          serverSubscriptions.length,
          serverHasSubscription ? "server-match" : "server-missing",
          shouldRefreshSubscription ? "refresh" : "ok",
        ].join(":");
        if (diagnosticReportedForState.current !== diagnosticKey) {
          diagnosticReportedForState.current = diagnosticKey;
          reportDiagnostic("state", {
            supported: canPush,
            hasLocalSubscription: Boolean(subscription),
            serverSubscriptionCount: serverSubscriptions.length,
            endpoint: subscription?.endpoint,
          });
        }

        if (
          (!subscription || !serverHasSubscription || shouldRefreshSubscription) &&
          hasGrantedPermission &&
          vapidPublicKey &&
          repairAttemptedForState.current !== repairStateKey
        ) {
          repairAttemptedForState.current = repairStateKey;
          await saveFreshSubscription(vapidPublicKey);
          await utils.push.getMySubscriptions.invalidate();
          setSubscribed(true);
          toast.success(shouldRefreshSubscription ? "알림 구독 키를 새로 연결했습니다." : "알림 구독을 다시 연결했습니다.");
        }
      } catch (error) {
        reportDiagnostic("state-error", { supported: canPush, error });
        if (!cancelled) setSubscribed(false);
      }
    }

    syncState();

    return () => {
      cancelled = true;
    };
  }, [mySubscriptionsQuery.data, vapidQuery.data]);

  const enablePush = async () => {
    setLoading(true);
    reportDiagnostic("enable-start");
    try {
      const granted = await requestNotificationPermission();
      setPermission(getNotificationPermission());
      if (!granted) {
        reportDiagnostic("enable-permission-denied");
        toast.error("알림 권한이 거부되었습니다. 브라우저 설정에서 알림을 허용해 주세요.");
        return;
      }

      const vapidPublicKey = vapidQuery.data;
      if (!vapidPublicKey) {
        reportDiagnostic("enable-missing-vapid");
        toast.error("서버 VAPID 공개키가 아직 설정되지 않았습니다.");
        return;
      }

      await saveFreshSubscription(vapidPublicKey);

      await utils.push.getMySubscriptions.invalidate();
      setSubscribed(true);
      reportDiagnostic("enable-success", { supported: true });
      toast.success("이 기기에서 알림 받기가 켜졌습니다.");
    } catch (error) {
      console.error("[Push] subscribe failed", error);
      reportDiagnostic("enable-error", { error });
      toast.error("알림 설정에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const disablePush = async () => {
    setLoading(true);
    reportDiagnostic("disable-start");
    try {
      const endpoint = await unsubscribeFromPush();
      if (endpoint) {
        await unsubscribeMutation.mutateAsync({ endpoint });
      }

      await utils.push.getMySubscriptions.invalidate();
      setSubscribed(false);
      reportDiagnostic("disable-success", { endpoint });
      toast.success("이 기기에서 알림 받기를 껐습니다.");
    } catch (error) {
      console.error("[Push] unsubscribe failed", error);
      reportDiagnostic("disable-error", { error });
      toast.error("알림 해제에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const disabled = loading || vapidQuery.isLoading || subscribeMutation.isPending || unsubscribeMutation.isPending;
  const iosNeedsPwa = isIosDevice() && !isStandalonePwa();
  const iosStatusText = isIosDevice()
    ? iosNeedsPwa
      ? "아이폰은 Safari에서 홈 화면에 추가한 앱으로 열어야 알림 등록이 됩니다."
      : permission === "denied"
        ? "아이폰 설정에서 이 앱의 알림 권한을 다시 허용해야 합니다."
        : subscribed
          ? "이 아이폰 앱은 서버에 알림 기기로 등록되어 있습니다."
          : "이 아이폰 앱은 아직 서버에 알림 기기로 등록되지 않았습니다."
    : "";

  if (!supported) {
    if (variant === "compact") return null;

    return (
      <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 shadow-sm">
        이 브라우저는 푸시 알림을 지원하지 않습니다.
        {isIosDevice() && (
          <p className="mt-1 text-xs">iPhone/iPad는 홈 화면에 추가한 앱에서만 알림을 사용할 수 있습니다.</p>
        )}
      </section>
    );
  }

  if (hideWhenSubscribed && subscribed) return null;

  if (variant === "compact") {
    return (
      <section className="rounded-full border border-[#D7F0D8] bg-white/95 px-3 py-2 shadow-lg backdrop-blur">
        <div className="flex items-center gap-2">
          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
            subscribed ? "bg-[#E8F5E9] text-[#1B5E20]" : "bg-gray-100 text-gray-500"
          }`}>
            {subscribed ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
          </span>
          <div className="min-w-0">
            <p className="truncate text-xs font-bold text-gray-900">{title}</p>
            <p className="truncate text-[11px] text-gray-500">
              {permission === "denied" ? "브라우저 설정에서 알림을 허용해 주세요." : subscribed ? "이 기기에서 알림을 받고 있습니다." : "새 소식과 예약 결과를 받을 수 있습니다."}
            </p>
          </div>
          <button
            type="button"
            onClick={subscribed ? disablePush : enablePush}
            disabled={disabled || permission === "denied" || !vapidQuery.data}
            className={`ml-1 inline-flex h-8 shrink-0 items-center justify-center gap-1 rounded-full px-3 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
              subscribed
                ? "border border-gray-200 bg-white text-gray-700"
                : "bg-[#1B5E20] text-white"
            }`}
          >
            {loading && <Loader2 className="h-3 w-3 animate-spin" />}
            {permission === "denied" ? "거부됨" : subscribed ? "끄기" : "켜기"}
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-[#D7F0D8] bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
            subscribed ? "bg-[#E8F5E9] text-[#1B5E20]" : "bg-gray-100 text-gray-400"
          }`}>
            {subscribed ? <Bell className="h-5 w-5" /> : <BellOff className="h-5 w-5" />}
          </span>
          <div>
            <h3 className="text-sm font-bold text-gray-900">{title}</h3>
            <p className="mt-1 text-xs leading-5 text-gray-500">
              {subscribed ? enabledDescription : disabledDescription}
            </p>
            {iosNeedsPwa && (
              <p className="mt-1 text-xs leading-5 text-amber-700">
                iPhone/iPad는 홈 화면에 추가한 앱으로 접속해야 알림을 켤 수 있습니다.
              </p>
            )}
            {isIosDevice() && (
              <p className={`mt-1 text-xs leading-5 ${subscribed ? "text-green-700" : "text-amber-700"}`}>
                {iosStatusText}
              </p>
            )}
            {!vapidQuery.isLoading && !vapidQuery.data && (
              <p className="mt-1 text-xs leading-5 text-red-600">
                서버 VAPID 환경변수 설정 후 활성화할 수 있습니다.
              </p>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={subscribed ? disablePush : enablePush}
          disabled={disabled || permission === "denied" || !vapidQuery.data}
          className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
            subscribed
              ? "border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
              : "bg-[#1B5E20] text-white hover:bg-[#2E7D32]"
          }`}
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {permission === "denied" ? "권한 거부됨" : subscribed ? "알림 끄기" : "알림 켜기"}
        </button>
      </div>
    </section>
  );
}
