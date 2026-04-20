export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",

  // 관리자 로그인 자격증명 (환경변수로 관리 — 외부 서버 이전 시 반드시 설정 필요)
  adminUsername: process.env.ADMIN_USERNAME ?? "joyfulchurch",
  adminPassword: process.env.ADMIN_PASSWORD ?? "joyfulchurch1!",
  adminOpenId: process.env.ADMIN_OPEN_ID ?? "admin_joyfulchurch",
};
