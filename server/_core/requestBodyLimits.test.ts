import { describe, expect, it } from "vitest";
import {
  CONTENT_UPLOAD_BODY_LIMIT_BYTES,
  STANDARD_BODY_LIMIT_BYTES,
  VIDEO_UPLOAD_BODY_LIMIT_BYTES,
  getTrpcBodyLimitBytes,
  getTrpcProcedurePaths,
  isTrpcLargeBodyRequestUrl,
} from "./requestBodyLimits";

const admin = { role: "admin", contentPermissions: [] };
const bulletinManager = {
  role: "user",
  contentPermissions: ["content:bulletins"],
};
const unrelatedManager = {
  role: "user",
  contentPermissions: ["content:notices"],
};

describe("tRPC request body limits", () => {
  it("keeps every large procedure on the standard limit without authorization", () => {
    expect(getTrpcBodyLimitBytes("/api/trpc/cms.upload.video", null)).toBe(
      STANDARD_BODY_LIMIT_BYTES,
    );
    expect(
      getTrpcBodyLimitBytes("/api/trpc/cms.bulletins.create", unrelatedManager),
    ).toBe(STANDARD_BODY_LIMIT_BYTES);
  });

  it("uses 150MB only for an administrator uploading a 100MB video", () => {
    expect(getTrpcBodyLimitBytes("/api/trpc/cms.upload.video", admin)).toBe(
      VIDEO_UPLOAD_BODY_LIMIT_BYTES,
    );
    expect(
      getTrpcBodyLimitBytes("/api/trpc/cms.upload.video", bulletinManager),
    ).toBe(STANDARD_BODY_LIMIT_BYTES);
  });

  it("uses 20MB for administrator-only 10MB page image procedures", () => {
    expect(getTrpcBodyLimitBytes("/api/trpc/cms.upload.pageImage", admin)).toBe(
      CONTENT_UPLOAD_BODY_LIMIT_BYTES,
    );
    expect(getTrpcBodyLimitBytes("/api/trpc/cms.blocks.uploadImage", admin)).toBe(
      CONTENT_UPLOAD_BODY_LIMIT_BYTES,
    );
    expect(
      getTrpcBodyLimitBytes("/api/trpc/cms.blocks.uploadImage", bulletinManager),
    ).toBe(STANDARD_BODY_LIMIT_BYTES);
  });

  it("uses 20MB for delegated bulletin managers but not unrelated managers", () => {
    expect(
      getTrpcBodyLimitBytes("/api/trpc/cms.bulletins.create", bulletinManager),
    ).toBe(CONTENT_UPLOAD_BODY_LIMIT_BYTES);
    expect(
      getTrpcBodyLimitBytes("/api/trpc/cms.bulletins.update", bulletinManager),
    ).toBe(CONTENT_UPLOAD_BODY_LIMIT_BYTES);
    expect(
      getTrpcBodyLimitBytes("/api/trpc/cms.bulletins.create", unrelatedManager),
    ).toBe(STANDARD_BODY_LIMIT_BYTES);
  });

  it("keeps all 1MB image and attachment procedures on the 5MB parser", () => {
    const standardProcedures = [
      "cms.upload.image",
      "cms.upload.attachment",
      "cms.upload.galleryImage",
      "cms.facilities.images.upload",
      "cms.pastorBooks.images.upload",
      "cms.missionReports.uploadImage",
      "cms.missionReports.uploadFile",
      "mission.uploadImage",
      "mission.uploadFile",
      "testimony.uploadImage",
      "support.submitSubtitle",
      "support.submitBulletinAd",
    ];

    for (const procedure of standardProcedures) {
      expect(getTrpcBodyLimitBytes(`/api/trpc/${procedure}`, admin)).toBe(
        STANDARD_BODY_LIMIT_BYTES,
      );
      expect(isTrpcLargeBodyRequestUrl(`/api/trpc/${procedure}`)).toBe(false);
    }
  });

  it("matches exact procedure names instead of attacker-controlled substrings", () => {
    expect(
      isTrpcLargeBodyRequestUrl("/api/trpc/not-cms.upload.video-suffix"),
    ).toBe(false);
    expect(
      getTrpcBodyLimitBytes("/api/trpc/not-cms.upload.video-suffix", admin),
    ).toBe(STANDARD_BODY_LIMIT_BYTES);
  });

  it("calculates the largest authorized tier in a tRPC batch", () => {
    const adminUrl =
      "/api/trpc/cms.bulletins.create%2Ccms.upload.video%2Cauth.me?batch=1";
    expect(getTrpcProcedurePaths(adminUrl)).toEqual([
      "cms.bulletins.create",
      "cms.upload.video",
      "auth.me",
    ]);
    expect(getTrpcBodyLimitBytes(adminUrl, admin)).toBe(
      VIDEO_UPLOAD_BODY_LIMIT_BYTES,
    );

    const delegatedUrl =
      "/api/trpc/cms.bulletins.create%2Ccms.upload.video?batch=1";
    expect(getTrpcBodyLimitBytes(delegatedUrl, bulletinManager)).toBe(
      CONTENT_UPLOAD_BODY_LIMIT_BYTES,
    );
  });

  it("does not let an unauthorized large route raise a batch tier", () => {
    const url = "/api/trpc/auth.me%2Ccms.upload.video?batch=1";
    expect(getTrpcBodyLimitBytes(url, bulletinManager)).toBe(
      STANDARD_BODY_LIMIT_BYTES,
    );
    expect(getTrpcBodyLimitBytes(url, null)).toBe(STANDARD_BODY_LIMIT_BYTES);
  });

  it("fails closed for malformed encoded paths", () => {
    expect(isTrpcLargeBodyRequestUrl("/api/trpc/cms.upload.video%ZZ")).toBe(false);
    expect(
      getTrpcBodyLimitBytes("/api/trpc/cms.upload.video%ZZ", admin),
    ).toBe(STANDARD_BODY_LIMIT_BYTES);
  });
});
