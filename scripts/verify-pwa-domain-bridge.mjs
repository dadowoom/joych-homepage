import crypto from "node:crypto";

const legacyOrigin = (process.env.PWA_LEGACY_ORIGIN || "https://newjoych.co.kr").replace(/\/$/, "");
const primaryOrigin = (process.env.PWA_PRIMARY_ORIGIN || "https://www.joych.org").replace(/\/$/, "");
const origins = [legacyOrigin, primaryOrigin];

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function fetchDirect(origin, pathname) {
  const url = `${origin}${pathname}`;
  let lastError;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        redirect: "manual",
        cache: "no-store",
        signal: AbortSignal.timeout(10_000),
        headers: { "user-agent": "joych-pwa-domain-bridge-check/1.0" },
      });

      if (response.status !== 200 || response.headers.get("location")) {
        throw new Error(
          `${url} must respond directly with 200 (status=${response.status}, location=${response.headers.get("location") || "none"})`,
        );
      }

      return response;
    } catch (error) {
      lastError = error;
      if (attempt < 3) await delay(1_000 * attempt);
    }
  }

  throw lastError;
}

async function fetchText(origin, pathname) {
  return (await fetchDirect(origin, pathname)).text();
}

async function fetchVapidKey(origin) {
  const response = await fetchDirect(origin, "/api/trpc/home.getVapidPublicKey");
  const payload = await response.json();
  const key = payload?.result?.data?.json;
  if (typeof key !== "string" || key.length < 20) {
    throw new Error(`${origin} returned an invalid VAPID public key`);
  }
  return key;
}

function fingerprint(value) {
  return crypto.createHash("sha256").update(value).digest("hex").slice(0, 12);
}

const [legacySw, primarySw, legacyManifest, primaryManifest, legacyVapid, primaryVapid] =
  await Promise.all([
    fetchText(legacyOrigin, "/sw.js"),
    fetchText(primaryOrigin, "/sw.js"),
    fetchText(legacyOrigin, "/manifest.webmanifest"),
    fetchText(primaryOrigin, "/manifest.webmanifest"),
    fetchVapidKey(legacyOrigin),
    fetchVapidKey(primaryOrigin),
  ]);

await Promise.all(
  origins.flatMap((origin) => [
    // 기존 설치 앱은 legacy origin의 SPA 자체도 계속 직접 열 수 있어야 합니다.
    fetchDirect(origin, "/"),
    fetchDirect(origin, "/pwa-icon-192.png"),
    fetchDirect(origin, "/pwa-icon-512.png"),
  ]),
);

if (legacySw !== primarySw) {
  throw new Error("Newjoych and Joych service worker files do not match");
}
if (legacyManifest !== primaryManifest) {
  throw new Error("Newjoych and Joych manifests do not match");
}
if (legacyVapid !== primaryVapid) {
  throw new Error("Newjoych and Joych VAPID public keys do not match");
}

const manifest = JSON.parse(legacyManifest);
if (manifest.id !== "/" || manifest.start_url !== "/" || manifest.scope !== "/") {
  throw new Error("PWA manifest id, start_url and scope must remain origin-relative root paths");
}
if (!legacySw.includes('self.addEventListener("push"')) {
  throw new Error("Service worker no longer contains the push event handler");
}

console.log(
  `[pwa-bridge] ok legacy=${legacyOrigin} primary=${primaryOrigin} sw=${fingerprint(legacySw)} manifest=${fingerprint(legacyManifest)} vapid=${fingerprint(legacyVapid)}`,
);
