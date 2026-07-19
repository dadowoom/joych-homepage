import { describe, expect, it } from "vitest";
import { selectUniquePushSubscriptions } from "./_core/pushSubscriptionPolicy";

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
});
