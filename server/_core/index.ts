import "dotenv/config";
import express from "express";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);

  // ── 보안 헤더 (helmet) ────────────────────────────────────────────────
  app.use(helmet({
    // Content-Security-Policy: 유튜브 iframe, CDN 이미지, 구글 폰트 허용
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'",   // Vite HMR 및 인라인 스크립트
          "'unsafe-eval'",     // Vite dev 모드
          "https://cdnjs.cloudflare.com",
          "https://www.youtube.com",
          "https://s.ytimg.com",
        ],
        styleSrc: [
          "'self'",
          "'unsafe-inline'",
          "https://fonts.googleapis.com",
          "https://cdnjs.cloudflare.com",
        ],
        fontSrc: [
          "'self'",
          "https://fonts.gstatic.com",
          "https://cdnjs.cloudflare.com",
        ],
        imgSrc: [
          "'self'",
          "data:",
          "blob:",
          "https:",   // CDN 이미지 전체 허용
        ],
        mediaSrc: [
          "'self'",
          "https:",   // S3 / CDN 영상
          "blob:",
        ],
        frameSrc: [
          "'self'",
          "https://www.youtube.com",
          "https://youtube.com",
        ],
        connectSrc: [
          "'self'",
          "https:",
          "wss:",     // Vite HMR WebSocket
        ],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: [],
      },
    },
    // X-Frame-Options: SAMEORIGIN (클릭재킹 방어)
    frameguard: { action: "sameorigin" },
    // X-Content-Type-Options: nosniff
    noSniff: true,
    // Referrer-Policy
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    // X-Powered-By 숨기기 (서버 정보 노출 방지)
    hidePoweredBy: true,
    // HSTS (배포 환경에서 HTTPS 강제)
    hsts: {
      maxAge: 31536000,       // 1년
      includeSubDomains: true,
      preload: true,
    },
  }));

  // Permissions-Policy 헤더 (카메라/마이크/위치 등 권한 제한)
  app.use((_req, res, next) => {
    res.setHeader(
      "Permissions-Policy",
      "camera=(), microphone=(), geolocation=(), payment=(), usb=()"
    );
    next();
  });

  // HTTP → HTTPS 리다이렉트 (프록시 환경: X-Forwarded-Proto 헤더 확인)
  app.use((req, res, next) => {
    const proto = req.headers["x-forwarded-proto"];
    if (proto && proto !== "https") {
      return res.redirect(301, `https://${req.headers.host}${req.url}`);
    }
    next();
  });
  // ─────────────────────────────────────────────────────────────────────

  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // 쿠키 파싱 미들웨어 (req.cookies 사용 가능하게)
  app.use(cookieParser());

  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
