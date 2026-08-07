import assert from "node:assert/strict";
import test from "node:test";
import {
  checkPublicReadiness,
  parseReadinessUrl,
  validateReadinessPayload,
} from "./ops-check-public.mjs";

function fakeResponse(status, payload) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () =>
      typeof payload === "string" ? payload : JSON.stringify(payload),
  };
}

test("accepts the exact public readiness contract", async () => {
  const result = await checkPublicReadiness({
    url: "https://www.joych.org/api/readyz",
    fetchImpl: async (_url, options) => {
      assert.equal(options.redirect, "error");
      assert.equal(options.headers.accept, "application/json");
      return fakeResponse(200, {
        ok: true,
        checks: { database: "ok" },
      });
    },
  });

  assert.equal(result.endpoint, "https://www.joych.org/api/readyz");
});

test("rejects unsafe readiness URLs", () => {
  assert.throws(
    () => parseReadinessUrl("http://www.joych.org/api/readyz"),
    /must use HTTPS/
  );
  assert.throws(
    () => parseReadinessUrl("https://user:secret@www.joych.org/api/readyz"),
    /must not contain credentials/
  );
  assert.throws(
    () => parseReadinessUrl("https://www.joych.org/api/readyz?token=secret"),
    /must not contain credentials/
  );
});

test("rejects a non-ready payload or non-200 status", async () => {
  assert.throws(
    () => validateReadinessPayload({ ok: false, checks: { database: "ok" } }),
    /did not confirm database availability/
  );
  assert.throws(
    () =>
      validateReadinessPayload({
        ok: true,
        checks: { database: "unavailable" },
      }),
    /did not confirm database availability/
  );

  await assert.rejects(
    checkPublicReadiness({
      fetchImpl: async () => fakeResponse(503, { ok: false }),
    }),
    /returned HTTP 503/
  );
});

test("does not copy transport errors or oversized bodies into the failure", async () => {
  await assert.rejects(
    checkPublicReadiness({
      fetchImpl: async () => {
        throw new Error("secret transport detail");
      },
    }),
    error => {
      assert.equal(error.message, "Public readiness request failed.");
      assert.equal(error.message.includes("secret"), false);
      return true;
    }
  );

  await assert.rejects(
    checkPublicReadiness({
      fetchImpl: async () => fakeResponse(200, "x".repeat(4_097)),
    }),
    /unexpectedly large/
  );
});
