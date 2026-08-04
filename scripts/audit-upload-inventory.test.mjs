import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyUploadAudit,
  extractUploadKeys,
  isUnreferencedCandidate,
  normalizeInventoryKey,
  normalizeUploadKey,
  UPLOAD_REFERENCE_LIKE_PATTERN,
} from "./audit-upload-inventory.mjs";

test("database prefilter keeps escaped JSON upload paths in scope", () => {
  assert.equal(UPLOAD_REFERENCE_LIKE_PATTERN, "%uploads%");
  assert.equal(String.raw`https:\/\/www.joych.org\/uploads\/one.jpg`.includes("uploads"), true);
});

test("incomplete database coverage is clearly classified as review-only", () => {
  assert.deepEqual(classifyUploadAudit([]), {
    auditComplete: true,
    candidateClassification: "unreferenced-candidate",
  });
  assert.deepEqual(classifyUploadAudit(["example_table.image_url"]), {
    auditComplete: false,
    candidateClassification: "review-only-incomplete-scan",
  });
});

test("normalizeUploadKey accepts relative and known Joyful Church upload URLs", () => {
  assert.equal(
    normalizeUploadKey("/uploads/page-images/intro.jpg?version=2"),
    "page-images/intro.jpg"
  );
  assert.equal(
    normalizeUploadKey(
      "https://www.joych.org/uploads/%EC%B0%AC%EC%96%91/%ED%91%9C%EC%A7%80.jpg#top"
    ),
    "찬양/표지.jpg"
  );
  assert.equal(
    normalizeUploadKey("https://assets.example.org/uploads/custom.png", {
      allowedHosts: ["assets.example.org"],
    }),
    "custom.png"
  );
});

test("normalizeUploadKey ignores external/photo servers and unsafe paths", () => {
  assert.equal(
    normalizeUploadKey("https://photo.joych.org/uploads/2026/photo.jpg"),
    null
  );
  assert.equal(
    normalizeUploadKey("https://files.example.org/uploads/private.pdf"),
    null
  );
  assert.equal(normalizeUploadKey("/uploads/%2e%2e/secret.txt"), null);
  assert.equal(normalizeUploadKey("/uploads/folder/%5C..%5Csecret.txt"), null);
  assert.equal(normalizeUploadKey("/uploads/"), null);
});

test("extractUploadKeys finds unique local references in HTML and JSON", () => {
  const value = String.raw`{
    "image": "https:\/\/www.joych.org\/uploads\/gallery-images\/one.jpg?size=large",
    "body": "<img src='/uploads/gallery-images/two.png'>",
    "duplicate": "/uploads/gallery-images/two.png",
    "external": "https://photo.joych.org/uploads/gallery-images/remote.jpg"
  }`;

  assert.deepEqual(extractUploadKeys(value).sort(), [
    "gallery-images/one.jpg",
    "gallery-images/two.png",
  ]);
});

test("normalizeInventoryKey produces portable keys and rejects traversal", () => {
  assert.equal(
    normalizeInventoryKey("page-images\\menu\\hero.jpg"),
    "page-images/menu/hero.jpg"
  );
  assert.equal(normalizeInventoryKey("../outside.txt"), null);
  assert.equal(normalizeInventoryKey("folder//file.txt"), null);
});

test("isUnreferencedCandidate requires both minimum age and no DB reference", () => {
  const nowMs = Date.UTC(2026, 7, 4, 0, 0, 0);
  const referencedKeys = new Set(["notice-images/used.jpg"]);

  assert.equal(
    isUnreferencedCandidate(
      {
        key: "notice-images/unused.jpg",
        modifiedAtMs: nowMs - 7 * 24 * 60 * 60 * 1000,
      },
      referencedKeys,
      { nowMs, minimumAgeDays: 7 }
    ),
    true
  );
  assert.equal(
    isUnreferencedCandidate(
      {
        key: "notice-images/used.jpg",
        modifiedAtMs: nowMs - 30 * 24 * 60 * 60 * 1000,
      },
      referencedKeys,
      { nowMs, minimumAgeDays: 7 }
    ),
    false
  );
  assert.equal(
    isUnreferencedCandidate(
      {
        key: "notice-images/new.jpg",
        modifiedAtMs: nowMs - 6 * 24 * 60 * 60 * 1000,
      },
      referencedKeys,
      { nowMs, minimumAgeDays: 7 }
    ),
    false
  );
});
