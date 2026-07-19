import { describe, expect, it } from "vitest";

import {
  PRIMARY_PUBLIC_SITE_ORIGIN,
  PUBLIC_SITE_URL_MIGRATION_TARGETS,
  replaceLegacyPublicSiteOrigins,
} from "../scripts/publicSiteUrlMigrationPlan";

describe("replaceLegacyPublicSiteOrigins", () => {
  it("migrates both legacy origins while preserving paths, queries, and fragments", () => {
    const input = [
      "https://newjoych.co.kr/worship/bulletin?year=2026#latest",
      "https://www.newjoych.co.kr/page/about",
    ].join(" ");

    expect(replaceLegacyPublicSiteOrigins(input)).toEqual({
      value: [
        `${PRIMARY_PUBLIC_SITE_ORIGIN}/worship/bulletin?year=2026#latest`,
        `${PRIMARY_PUBLIC_SITE_ORIGIN}/page/about`,
      ].join(" "),
      replacements: 2,
    });
  });

  it("preserves JSON and HTML formatting around migrated URLs", () => {
    const input = JSON.stringify({
      image: "https://newjoych.co.kr/uploads/hero.jpg",
      html: '<a href="https://www.newjoych.co.kr/member/my-page">내 정보</a>',
    });

    expect(replaceLegacyPublicSiteOrigins(input)).toEqual({
      value: JSON.stringify({
        image: `${PRIMARY_PUBLIC_SITE_ORIGIN}/uploads/hero.jpg`,
        html: `<a href="${PRIMARY_PUBLIC_SITE_ORIGIN}/member/my-page">내 정보</a>`,
      }),
      replacements: 2,
    });
  });

  it("normalizes HTTP, protocol-relative, alias, and case variants", () => {
    const input = [
      "HTTP://NEWJOYCH.CO.KR/page/one",
      "//www.newjoych.co.kr/page/two",
      "https://joych.org/page/three",
      "http://m.joych.org/page/four",
      "http://www.joych.org/page/five",
    ].join(" ");

    expect(replaceLegacyPublicSiteOrigins(input)).toEqual({
      value: [
        `${PRIMARY_PUBLIC_SITE_ORIGIN}/page/one`,
        `${PRIMARY_PUBLIC_SITE_ORIGIN}/page/two`,
        `${PRIMARY_PUBLIC_SITE_ORIGIN}/page/three`,
        `${PRIMARY_PUBLIC_SITE_ORIGIN}/page/four`,
        `${PRIMARY_PUBLIC_SITE_ORIGIN}/page/five`,
      ].join(" "),
      replacements: 5,
    });
  });

  it("does not touch canonical, excluded, or lookalike hosts", () => {
    const unchanged = [
      "https://www.joych.org/page/test",
      "https://sermon.joych.org/mp4/sun/video.mp4",
      "https://admin.joych.org/dashboard",
      "https://newjoych.co.kr.example.com/phishing",
      "https://www.newjoych.co.kr.evil.test/phishing",
    ].join(" ");

    expect(replaceLegacyPublicSiteOrigins(unchanged)).toEqual({
      value: unchanged,
      replacements: 0,
    });
  });

  it("is idempotent", () => {
    const once = replaceLegacyPublicSiteOrigins(
      "https://newjoych.co.kr/page/test https://www.newjoych.co.kr/image.png",
    );
    const twice = replaceLegacyPublicSiteOrigins(once.value);

    expect(once.replacements).toBe(2);
    expect(twice).toEqual({ value: once.value, replacements: 0 });
  });

  it("keeps push subscription endpoints out of the migration target plan", () => {
    const pushTarget = PUBLIC_SITE_URL_MIGRATION_TARGETS.find(
      target => target.table === "push_subscriptions",
    );

    expect(pushTarget).toBeUndefined();
  });
});
