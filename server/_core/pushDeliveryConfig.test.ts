import { describe, expect, it } from "vitest";
import { getPushDeliveryConfig } from "./pushDeliveryConfig";

describe("push delivery configuration", () => {
  it("uses bounded parallel delivery without skipping queued subscriptions", () => {
    expect(getPushDeliveryConfig({})).toEqual({
      concurrency: 100,
      timeoutMs: 5_000,
    });
  });

  it("accepts supported environment overrides", () => {
    expect(getPushDeliveryConfig({
      PUSH_DELIVERY_CONCURRENCY: "25",
      PUSH_DELIVERY_TIMEOUT_MS: "8000",
    })).toEqual({
      concurrency: 25,
      timeoutMs: 8_000,
    });
  });

  it.each([
    ["PUSH_DELIVERY_CONCURRENCY", "101"],
    ["PUSH_DELIVERY_TIMEOUT_MS", "999"],
  ] as const)("rejects an unsafe %s override", (name, value) => {
    expect(() => getPushDeliveryConfig({ [name]: value })).toThrow(name);
  });
});
