import { describe, expect, it } from "vitest";
import { getDatabasePoolConfig } from "./poolConfig";

describe("database pool configuration", () => {
  it("uses bounded production-safe defaults", () => {
    expect(getDatabasePoolConfig({})).toEqual({
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 500,
      connectTimeout: 10_000,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0,
    });
  });

  it("accepts explicit values within the supported bounds", () => {
    expect(getDatabasePoolConfig({
      DB_POOL_CONNECTION_LIMIT: "20",
      DB_POOL_QUEUE_LIMIT: "1000",
      DB_CONNECT_TIMEOUT_MS: "15000",
    })).toMatchObject({
      connectionLimit: 20,
      queueLimit: 1000,
      connectTimeout: 15_000,
    });
  });

  it.each([
    ["DB_POOL_CONNECTION_LIMIT", "0"],
    ["DB_POOL_QUEUE_LIMIT", "unlimited"],
    ["DB_CONNECT_TIMEOUT_MS", "999"],
  ] as const)("rejects an unsafe %s value", (name, value) => {
    expect(() => getDatabasePoolConfig({ [name]: value })).toThrow(name);
  });
});
