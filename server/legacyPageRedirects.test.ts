import { describe, expect, it, vi } from "vitest";
import type { NextFunction, Request, Response } from "express";
import {
  ASSOCIATE_STAFF_PATH,
  BULLETIN_PATH,
  FRIDAY_WORSHIP_PATH,
  HAYOUNGIN_PATH,
  HEBRON_WORSHIP_PATH,
  PRAISE_CHARIS_PATH,
  PRAISE_DISCIPLES_PATH,
  PRAISE_HOSANNA_PATH,
  PRAISE_JOYANCE_PATH,
  PRAISE_REBUILD_PATH,
  PRAISE_SHALOM_PATH,
  PRAISE_SPECIAL_PATH,
  PRAISE_ZION_PATH,
  SUNDAY_WORSHIP_PATH,
  TESTIMONY_PATH,
  WORSHIP_GUIDE_PATH,
  legacyPageRedirectHandler,
  resolveLegacyPageRedirect,
} from "./_core/legacyPageRedirects";

describe("legacy page redirects", () => {
  it("maps the old pageCode=29 worship guide URL to the official schedule", () => {
    expect(resolveLegacyPageRedirect("29")).toBe(WORSHIP_GUIDE_PATH);
    expect(resolveLegacyPageRedirect(" 29 ")).toBe(WORSHIP_GUIDE_PATH);
    expect(WORSHIP_GUIDE_PATH).toBe("/worship/schedule");
  });

  it("maps the old pageCode=425 Sunday worship URL to the current page", () => {
    expect(resolveLegacyPageRedirect("425")).toBe(SUNDAY_WORSHIP_PATH);
    expect(resolveLegacyPageRedirect(" 425 ")).toBe(SUNDAY_WORSHIP_PATH);
  });

  it("maps the old pageCode=137 bulletin URL to the current page", () => {
    expect(resolveLegacyPageRedirect("137")).toBe(BULLETIN_PATH);
    expect(resolveLegacyPageRedirect(" 137 ")).toBe(BULLETIN_PATH);
  });

  it.each([
    ["372", WORSHIP_GUIDE_PATH],
    ["2", SUNDAY_WORSHIP_PATH],
    ["364", ASSOCIATE_STAFF_PATH],
  ])("maps requested old pageCode=%s to the exact current page", (pageCode, target) => {
    expect(resolveLegacyPageRedirect(pageCode)).toBe(target);
    expect(resolveLegacyPageRedirect(` ${pageCode} `)).toBe(target);
  });

  it.each([
    ["372", WORSHIP_GUIDE_PATH],
    ["2", SUNDAY_WORSHIP_PATH],
    ["364", ASSOCIATE_STAFF_PATH],
  ])("permanently redirects requested pageCode=%s to the exact current page", (pageCode, target) => {
    const req = { query: { pageCode } } as unknown as Request;
    const redirect = vi.fn();
    const res = { redirect } as unknown as Response;
    const next = vi.fn() as unknown as NextFunction;

    legacyPageRedirectHandler(req, res, next);

    expect(redirect).toHaveBeenCalledWith(
      301,
      new URL(target, "https://www.joych.org").toString()
    );
    expect(next).not.toHaveBeenCalled();
  });

  it("does not intercept unrelated or ambiguous legacy page URLs", () => {
    expect(resolveLegacyPageRedirect("30")).toBeNull();
    expect(resolveLegacyPageRedirect(undefined)).toBeNull();
    expect(resolveLegacyPageRedirect(["29", "30"])).toBeNull();
  });

  it.each([
    ["423", HEBRON_WORSHIP_PATH],
    ["424", FRIDAY_WORSHIP_PATH],
    ["242", HAYOUNGIN_PATH],
    ["359", TESTIMONY_PATH],
    ["192", PRAISE_SHALOM_PATH],
    ["193", PRAISE_HOSANNA_PATH],
    ["194", PRAISE_ZION_PATH],
    ["181", PRAISE_JOYANCE_PATH],
    ["319", PRAISE_DISCIPLES_PATH],
    ["320", PRAISE_CHARIS_PATH],
    ["183", PRAISE_REBUILD_PATH],
    ["197", PRAISE_SPECIAL_PATH],
  ])("maps old video pageCode=%s to its current category", (pageCode, target) => {
    expect(resolveLegacyPageRedirect(pageCode)).toBe(target);
  });

  it("returns a permanent redirect for pageCode=29", () => {
    const req = { query: { pageCode: "29" } } as unknown as Request;
    const redirect = vi.fn();
    const res = { redirect } as unknown as Response;
    const next = vi.fn() as unknown as NextFunction;

    legacyPageRedirectHandler(req, res, next);

    expect(redirect).toHaveBeenCalledWith(
      301,
      new URL(WORSHIP_GUIDE_PATH, "https://www.joych.org").toString()
    );
    expect(next).not.toHaveBeenCalled();
  });

  it("returns a permanent redirect for pageCode=425", () => {
    const req = { query: { pageCode: "425" } } as unknown as Request;
    const redirect = vi.fn();
    const res = { redirect } as unknown as Response;
    const next = vi.fn() as unknown as NextFunction;

    legacyPageRedirectHandler(req, res, next);

    expect(redirect).toHaveBeenCalledWith(
      301,
      new URL(SUNDAY_WORSHIP_PATH, "https://www.joych.org").toString()
    );
    expect(next).not.toHaveBeenCalled();
  });

  it("returns a permanent redirect for pageCode=137", () => {
    const req = { query: { pageCode: "137" } } as unknown as Request;
    const redirect = vi.fn();
    const res = { redirect } as unknown as Response;
    const next = vi.fn() as unknown as NextFunction;

    legacyPageRedirectHandler(req, res, next);

    expect(redirect).toHaveBeenCalledWith(
      301,
      new URL(BULLETIN_PATH, "https://www.joych.org").toString()
    );
    expect(next).not.toHaveBeenCalled();
  });

  it("returns a real noindex 404 page for an unverified old pageCode", () => {
    const req = { query: { pageCode: "999999" } } as unknown as Request;
    const redirect = vi.fn();
    const send = vi.fn();
    const setHeader = vi.fn();
    const res = {
      redirect,
      send,
      setHeader,
      status: vi.fn(),
      type: vi.fn(),
    } as unknown as Response;
    vi.mocked(res.status).mockReturnValue(res);
    vi.mocked(res.type).mockReturnValue(res);
    const next = vi.fn() as unknown as NextFunction;

    legacyPageRedirectHandler(req, res, next);

    expect(redirect).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
    expect(setHeader).toHaveBeenCalledWith(
      "X-Robots-Tag",
      "noindex, nofollow"
    );
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.type).toHaveBeenCalledWith("html");
    expect(send).toHaveBeenCalledWith(expect.stringContaining("이전 페이지"));
  });
});
