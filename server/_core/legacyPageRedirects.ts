import type { Express, NextFunction, Request, Response } from "express";

export const WORSHIP_GUIDE_PATH = "/page/교회소개-예배-안내";

const LEGACY_PAGE_CODE_REDIRECTS: Readonly<Record<string, string>> = {
  "29": WORSHIP_GUIDE_PATH,
};

export function resolveLegacyPageRedirect(pageCode: unknown) {
  if (typeof pageCode !== "string") return null;
  return LEGACY_PAGE_CODE_REDIRECTS[pageCode.trim()] ?? null;
}

export function legacyPageRedirectHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const target = resolveLegacyPageRedirect(req.query.pageCode);
  if (!target) {
    next();
    return;
  }

  return res.redirect(301, target);
}

export function registerLegacyPageRedirects(app: Express) {
  app.get("/main/sub.html", legacyPageRedirectHandler);
}
