import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const publicDirectory = path.resolve(import.meta.dirname, "../../public");

describe("legacy PWA domain bridge contract", () => {
  it("keeps the manifest installed on the origin that served it", () => {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(publicDirectory, "manifest.webmanifest"), "utf8"),
    ) as { id?: string; start_url?: string; scope?: string };

    expect(manifest).toMatchObject({
      id: "/",
      start_url: "/",
      scope: "/",
    });
  });

  it("keeps the old service worker subscribed and opens relative links on its own origin", () => {
    const serviceWorker = fs.readFileSync(path.join(publicDirectory, "sw.js"), "utf8");

    expect(serviceWorker).toContain('self.addEventListener("push"');
    expect(serviceWorker).toContain("new URL(rawUrl, self.location.origin)");
    expect(serviceWorker).not.toContain("registration.unregister(");
    expect(serviceWorker).not.toContain("subscription.unsubscribe(");
  });
});
