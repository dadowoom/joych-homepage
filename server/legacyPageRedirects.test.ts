import { describe, expect, it, vi } from "vitest";
import type { NextFunction, Request, Response } from "express";
import {
  WORSHIP_GUIDE_PATH,
  legacyPageRedirectHandler,
  resolveLegacyPageRedirect,
} from "./_core/legacyPageRedirects";

describe("legacy page redirects", () => {
  it("maps the old pageCode=29 worship guide URL to the current page", () => {
    expect(resolveLegacyPageRedirect("29")).toBe(WORSHIP_GUIDE_PATH);
    expect(resolveLegacyPageRedirect(" 29 ")).toBe(WORSHIP_GUIDE_PATH);
  });

  it("does not intercept unrelated or ambiguous legacy page URLs", () => {
    expect(resolveLegacyPageRedirect("30")).toBeNull();
    expect(resolveLegacyPageRedirect(undefined)).toBeNull();
    expect(resolveLegacyPageRedirect(["29", "30"])).toBeNull();
  });

  it("returns a permanent redirect for pageCode=29", () => {
    const req = { query: { pageCode: "29" } } as unknown as Request;
    const redirect = vi.fn();
    const res = { redirect } as unknown as Response;
    const next = vi.fn() as unknown as NextFunction;

    legacyPageRedirectHandler(req, res, next);

    expect(redirect).toHaveBeenCalledWith(301, WORSHIP_GUIDE_PATH);
    expect(next).not.toHaveBeenCalled();
  });

  it("passes unrelated page codes to the existing application routes", () => {
    const req = { query: { pageCode: "424" } } as unknown as Request;
    const redirect = vi.fn();
    const res = { redirect } as unknown as Response;
    const next = vi.fn() as unknown as NextFunction;

    legacyPageRedirectHandler(req, res, next);

    expect(redirect).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledOnce();
  });
});
