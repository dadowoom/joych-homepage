import { describe, expect, it } from "vitest";
import {
  selectUniquePushSubscriptions,
  settleWithConcurrency,
} from "./_core/pushSubscriptionPolicy";

describe("PWA push subscription continuity", () => {
  it("keeps different Newjoych and Joych endpoints for the same member", () => {
    const legacy = { id: 1, endpoint: "https://push.example/newjoych-device" };
    const primary = { id: 2, endpoint: "https://push.example/joych-device" };

    expect(selectUniquePushSubscriptions([legacy, primary])).toEqual([legacy, primary]);
  });

  it("sends only once when the exact same endpoint is accidentally repeated", () => {
    const first = { id: 1, endpoint: "https://push.example/same-device" };
    const duplicate = { id: 2, endpoint: "https://push.example/same-device" };

    expect(selectUniquePushSubscriptions([first, duplicate])).toEqual([first]);
  });

  it("bounds concurrent delivery without making later work wait for a slow batch", async () => {
    let active = 0;
    let maximumActive = 0;
    const results = await settleWithConcurrency([1, 2, 3, 4, 5], 2, async value => {
      active += 1;
      maximumActive = Math.max(maximumActive, active);
      await new Promise(resolve => setTimeout(resolve, value === 1 ? 15 : 1));
      active -= 1;
      if (value === 4) throw new Error("failed");
      return value * 10;
    });

    expect(maximumActive).toBe(2);
    expect(results.map(result => result.status)).toEqual([
      "fulfilled",
      "fulfilled",
      "fulfilled",
      "rejected",
      "fulfilled",
    ]);
    expect(results[0]).toEqual({ status: "fulfilled", value: 10 });
    await expect(settleWithConcurrency([1], 0, async value => value)).rejects.toThrow(
      "positive integer"
    );
  });
});
