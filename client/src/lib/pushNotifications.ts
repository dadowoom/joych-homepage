export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export function getNotificationPermission(): NotificationPermission {
  if (typeof window === "undefined" || !("Notification" in window)) return "denied";
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof window === "undefined" || !("Notification" in window)) return false;
  const result = await Notification.requestPermission();
  return result === "granted";
}

function urlBase64ToArrayBuffer(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const buffer = new ArrayBuffer(rawData.length);
  const outputArray = new Uint8Array(buffer);

  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return buffer;
}

export async function ensureServiceWorkerRegistration(): Promise<ServiceWorkerRegistration> {
  if (!isPushSupported()) {
    throw new Error("Push notifications are not supported in this browser.");
  }

  const existing = await navigator.serviceWorker.getRegistration("/");
  if (existing) return existing;

  return navigator.serviceWorker.register("/sw.js");
}

export async function getCurrentPushSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null;

  const registration = await ensureServiceWorkerRegistration();
  return registration.pushManager.getSubscription();
}

export async function subscribeToPush(vapidPublicKey: string): Promise<PushSubscriptionJSON> {
  if (!vapidPublicKey) {
    throw new Error("VAPID public key is missing.");
  }

  const registration = await ensureServiceWorkerRegistration();
  const existing = await registration.pushManager.getSubscription();
  const subscription = existing ?? await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToArrayBuffer(vapidPublicKey),
  });

  return subscription.toJSON();
}

export async function unsubscribeFromPush(): Promise<string | null> {
  const subscription = await getCurrentPushSubscription();
  if (!subscription) return null;

  const endpoint = subscription.endpoint;
  await subscription.unsubscribe();
  return endpoint;
}

export function isIosDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

export function isStandalonePwa(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches || ("standalone" in navigator && Boolean(navigator.standalone));
}
