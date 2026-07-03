import express, {
  type Express,
  type NextFunction,
  type Request,
  type Response,
} from "express";
import fs from "fs";
import { type Server } from "http";
import { nanoid } from "nanoid";
import path from "path";
import { isSafeHref } from "./contentValidation";
import { injectSeoMeta } from "./seo";
import {
  getVisibleMenuItemByHref,
  getVisibleMenuItemById,
  getVisibleMenuSubItemByHref,
  getVisibleMenuSubItemById,
} from "../db/menu";

const ADMIN_PUBLIC_ROUTE_REDIRECTS: Array<[string, string]> = [
  ["/admin/offering", "/support/offering"],
  ["/admin/vehicle", "/support/vehicle"],
  ["/admin/new-member", "/support/new-member"],
  ["/admin/store", "/support/store"],
  ["/admin/subtitle", "/support/subtitle"],
  ["/admin/office", "/support/office"],
  ["/admin/tour", "/support/tour"],
  ["/admin/donation", "/support/donation"],
];

const LEGACY_PAGE_ROUTE_REDIRECTS: Array<[string, string]> = [
  ["/page/교회소개-담임목사-소개", "/about/pastor"],
  ["/page/교회소개-3대-비전", "/about/vision"],
  ["/page/교회소개-섬기는-분", "/about/staff"],
  ["/page/교회소개-부교역자", "/about/staff/associate"],
  ["/page/교회소개-교회백서", "/about/whitebook"],
  ["/page/조이풀tv-주일예배", "/worship/tv/sunday"],
  ["/page/행정지원-공지사항", "/community/news"],
  ["/page/커뮤니티-최근-행사-사진", "/community/photo"],
];

const CODE_BACKED_PAGE_ROUTES = new Set([
  "/page/교회소개-담임목사-저서",
  "/page/교회소개-섬기는-분",
  "/page/교회소개-부교역자",
]);

const PUBLIC_ROUTE_REDIRECTS = new Map<string, string>([
  ...ADMIN_PUBLIC_ROUTE_REDIRECTS,
  ...LEGACY_PAGE_ROUTE_REDIRECTS,
]);

function normalizeRoutePath(pathname: string) {
  if (pathname.length <= 1) return "/";
  return pathname.replace(/\/+$/, "");
}

function decodeRoutePath(pathname: string) {
  try {
    return decodeURIComponent(pathname);
  } catch {
    return pathname;
  }
}

function appendOriginalSearch(target: string, originalUrl: string) {
  const searchStart = originalUrl.indexOf("?");
  return searchStart >= 0
    ? `${target}${originalUrl.slice(searchStart)}`
    : target;
}

function isHtmlNavigation(req: Request) {
  return req.method === "GET" || req.method === "HEAD";
}

function sendRouteNotFound(res: Response, indexHtmlPath?: string) {
  if (indexHtmlPath) {
    return res.status(404).sendFile(indexHtmlPath);
  }
  return res.status(404).type("text/plain").send("Not found");
}

async function sendIndexHtml(
  req: Request,
  res: Response,
  next: NextFunction,
  indexHtmlPath: string,
  status = 200
) {
  try {
    const template = await fs.promises.readFile(indexHtmlPath, "utf-8");
    const page = injectSeoMeta(template, req);
    res.status(status).type("html").setHeader("Cache-Control", "no-cache");
    res.send(page);
  } catch (error) {
    next(error);
  }
}

async function publicRouteGuard(
  req: Request,
  res: Response,
  next: NextFunction,
  indexHtmlPath?: string
) {
  if (!isHtmlNavigation(req)) return next();

  const normalizedPath = normalizeRoutePath(decodeRoutePath(req.path));
  const redirectTarget = PUBLIC_ROUTE_REDIRECTS.get(normalizedPath);
  if (redirectTarget) {
    return res.redirect(
      301,
      appendOriginalSearch(redirectTarget, req.originalUrl)
    );
  }

  if (normalizedPath === "/admin") {
    return sendRouteNotFound(res, indexHtmlPath);
  }

  const numericMenuMatch = normalizedPath.match(/^\/page\/item\/(\d+)$/);
  if (numericMenuMatch) {
    const item = await getVisibleMenuItemById(Number(numericMenuMatch[1]));
    if (item?.href && isSafeHref(item.href) && item.href.startsWith("/")) {
      return res.redirect(
        301,
        appendOriginalSearch(item.href, req.originalUrl)
      );
    }
    return sendRouteNotFound(res, indexHtmlPath);
  }

  const numericSubMenuMatch = normalizedPath.match(/^\/page\/sub\/(\d+)$/);
  if (numericSubMenuMatch) {
    const item = await getVisibleMenuSubItemById(
      Number(numericSubMenuMatch[1])
    );
    if (item?.href && isSafeHref(item.href) && item.href.startsWith("/")) {
      return res.redirect(
        301,
        appendOriginalSearch(item.href, req.originalUrl)
      );
    }
    return sendRouteNotFound(res, indexHtmlPath);
  }

  if (normalizedPath.startsWith("/page/")) {
    if (CODE_BACKED_PAGE_ROUTES.has(normalizedPath)) {
      return next();
    }

    const [item, subItem] = await Promise.all([
      getVisibleMenuItemByHref(normalizedPath),
      getVisibleMenuSubItemByHref(normalizedPath),
    ]);
    if (!item && !subItem) {
      return sendRouteNotFound(res, indexHtmlPath);
    }
  }

  return next();
}

export async function setupVite(app: Express, server: Server) {
  const dynamicImport = new Function(
    "specifier",
    "return import(specifier)"
  ) as <T>(specifier: string) => Promise<T>;
  const [{ createServer: createViteServer }, { default: viteConfig }] =
    await Promise.all([
      dynamicImport<typeof import("vite")>("vite"),
      dynamicImport<{ default: typeof import("../../vite.config").default }>(
        new URL("../../vite.config.ts", import.meta.url).href
      ),
    ]);
  const resolvedViteConfig =
    typeof viteConfig === "function"
      ? await viteConfig({
          command: "serve",
          mode: process.env.NODE_ENV ?? "development",
          isSsrBuild: false,
          isPreview: false,
        })
      : viteConfig;

  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...resolvedViteConfig,
    configFile: false,
    server: serverOptions,
    appType: "custom",
  });

  app.use((req, res, next) => {
    publicRouteGuard(req, res, next).catch(next);
  });
  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "../..",
        "client",
        "index.html"
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      template = injectSeoMeta(template, req);
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  const distPath =
    process.env.NODE_ENV === "development"
      ? path.resolve(import.meta.dirname, "../..", "dist", "public")
      : path.resolve(import.meta.dirname, "public");
  if (!fs.existsSync(distPath)) {
    console.error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }

  const indexHtmlPath = path.resolve(distPath, "index.html");
  app.use((req, res, next) => {
    publicRouteGuard(req, res, next, indexHtmlPath).catch(next);
  });
  app.use(
    express.static(distPath, {
      index: false,
      setHeaders(res, filePath) {
        const normalized = filePath.split(path.sep).join("/");
        if (normalized.endsWith("/index.html")) {
          res.setHeader("Cache-Control", "no-cache");
          return;
        }
        if (normalized.includes("/assets/")) {
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
          return;
        }
        res.setHeader("Cache-Control", "public, max-age=3600");
      },
    })
  );

  // Missing built assets must stay 404. If we return index.html here, the
  // browser tries to parse HTML as a JS chunk and shows a confusing module
  // loading error after deployments.
  app.use("/assets", (_req, res) => {
    res.status(404).type("text/plain").send("Asset not found");
  });

  // fall through to index.html if the client route doesn't exist
  app.use("*", (req, res, next) => {
    sendIndexHtml(req, res, next, indexHtmlPath);
  });
}
