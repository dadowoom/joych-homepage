import type { Express, NextFunction, Request, Response } from "express";
import { PRIMARY_SITE_ORIGIN } from "../../shared/siteHosts";

export const WORSHIP_GUIDE_PATH = "/worship/schedule";
export const SUNDAY_WORSHIP_PATH = "/page/조이풀tv-주일예배";
export const BULLETIN_PATH = "/worship/bulletin";
export const HEBRON_WORSHIP_PATH = "/worship/tv/hebron";
export const FRIDAY_WORSHIP_PATH = "/page/조이풀tv-금요-경배와-용사들";
export const HAYOUNGIN_PATH = "/page/조이풀tv-하영인";
export const TESTIMONY_PATH = "/page/조이풀tv-생선-간증";
export const PRAISE_SHALOM_PATH = "/page/조이풀tv-찬양-샬롬-성가대";
export const PRAISE_HOSANNA_PATH = "/page/조이풀tv-찬양-호산나-찬양대";
export const PRAISE_ZION_PATH = "/page/조이풀tv-찬양-시온-찬양대";
export const PRAISE_JOYANCE_PATH =
  "/page/조이풀tv-찬양-주일-찬양팀-조이언스";
export const PRAISE_DISCIPLES_PATH =
  "/page/조이풀tv-찬양-수요-찬양팀-디사이플스";
export const PRAISE_CHARIS_PATH = "/page/조이풀tv-찬양-금요-찬양팀-카리스";
export const PRAISE_REBUILD_PATH =
  "/page/조이풀tv-찬양-청년부-찬양팀-리빌드";
export const PRAISE_SPECIAL_PATH = "/page/조이풀tv-찬양-특송";

const LEGACY_PAGE_CODE_REDIRECTS: Readonly<Record<string, string>> = {
  "29": WORSHIP_GUIDE_PATH,
  "137": BULLETIN_PATH,
  "181": PRAISE_JOYANCE_PATH,
  "183": PRAISE_REBUILD_PATH,
  "192": PRAISE_SHALOM_PATH,
  "193": PRAISE_HOSANNA_PATH,
  "194": PRAISE_ZION_PATH,
  "197": PRAISE_SPECIAL_PATH,
  "242": HAYOUNGIN_PATH,
  "319": PRAISE_DISCIPLES_PATH,
  "320": PRAISE_CHARIS_PATH,
  "359": TESTIMONY_PATH,
  "423": HEBRON_WORSHIP_PATH,
  "424": FRIDAY_WORSHIP_PATH,
  "425": SUNDAY_WORSHIP_PATH,
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
    return sendLegacyNotFound(res);
  }

  return res.redirect(301, new URL(target, PRIMARY_SITE_ORIGIN).toString());
}

export function sendLegacyNotFound(res: Response) {
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  res.setHeader("Cache-Control", "public, max-age=300");
  return res
    .status(404)
    .type("html")
    .send(`<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <meta name="robots" content="noindex,nofollow" />
    <title>이전 페이지 안내 | 기쁨의교회</title>
  </head>
  <body style="font-family:system-ui,sans-serif;max-width:680px;margin:80px auto;padding:24px;line-height:1.7">
    <h1>이전 페이지의 주소가 변경되었습니다.</h1>
    <p>요청하신 옛 페이지는 더 이상 제공되지 않습니다. 기쁨의교회 새 홈페이지에서 원하는 내용을 찾아주세요.</p>
    <p><a href="/">기쁨의교회 홈으로 이동</a> · <a href="/sitemap">사이트맵 보기</a></p>
  </body>
</html>`);
}

export function registerLegacyPageRedirects(app: Express) {
  app.get("/main/sub.html", legacyPageRedirectHandler);
  app.get("/core/anyboard/content.html", (_req, res) =>
    sendLegacyNotFound(res)
  );
}
