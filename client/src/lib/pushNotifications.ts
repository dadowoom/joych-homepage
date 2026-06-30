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

const STORED_VAPID_PUBLIC_KEY = "joych.push.vapidPublicKey";

function normalizeBase64Url(value: string): string {
  return value.replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function arrayBufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }

  return normalizeBase64Url(window.btoa(binary));
}

function getStoredVapidPublicKey(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(STORED_VAPID_PUBLIC_KEY);
  } catch {
    return null;
  }
}

function rememberVapidPublicKey(vapidPublicKey: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORED_VAPID_PUBLIC_KEY, normalizeBase64Url(vapidPublicKey));
  } catch {
    // Ignore private browsing/storage errors. The browser subscription itself is still valid.
  }
}

function forgetVapidPublicKey() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORED_VAPID_PUBLIC_KEY);
  } catch {
    // Ignore private browsing/storage errors.
  }
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
  if (existing) {
    await existing.update().catch(() => undefined);
    return existing;
  }

  return navigator.serviceWorker.register("/sw.js");
}

export async function getCurrentPushSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null;

  const registration = await ensureServiceWorkerRegistration();
  return registration.pushManager.getSubscription();
}

export function shouldRefreshPushSubscription(subscription: PushSubscription, vapidPublicKey: string): boolean {
  const expectedPublicKey = normalizeBase64Url(vapidPublicKey);
  const subscriptionPublicKey = subscription.options?.applicationServerKey
    ? arrayBufferToBase64Url(subscription.options.applicationServerKey)
    : null;

  if (subscriptionPublicKey && subscriptionPublicKey !== expectedPublicKey) {
    return true;
  }

  const storedPublicKey = getStoredVapidPublicKey();
  if (storedPublicKey && storedPublicKey !== expectedPublicKey) {
    return true;
  }

  return !subscriptionPublicKey && !storedPublicKey;
}

export async function subscribeToPush(
  vapidPublicKey: string,
  options: { forceNew?: boolean } = {},
): Promise<PushSubscriptionJSON> {
  if (!vapidPublicKey) {
    throw new Error("VAPID public key is missing.");
  }

  const registration = await ensureServiceWorkerRegistration();
  const existing = await registration.pushManager.getSubscription();
  if (existing && options.forceNew) {
    await existing.unsubscribe().catch(() => undefined);
  }

  const subscription = !options.forceNew && existing ? existing : await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToArrayBuffer(vapidPublicKey),
  });

  rememberVapidPublicKey(vapidPublicKey);
  return subscription.toJSON();
}

export async function unsubscribeFromPush(): Promise<string | null> {
  const subscription = await getCurrentPushSubscription();
  if (!subscription) {
    forgetVapidPublicKey();
    return null;
  }

  const endpoint = subscription.endpoint;
  await subscription.unsubscribe();
  forgetVapidPublicKey();
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
