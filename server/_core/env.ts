/**
 * 환경변수 검증 및 내보내기
 *
 * 운영 환경(NODE_ENV=production)에서 JWT_SECRET이 없거나 32자 미만이면 서버가 시작되지 않습니다.
 *
 * ⚠️ ADMIN_USERNAME / ADMIN_PASSWORD는 "선택적 필수" 처리:
 *   - 설정되어 있으면 해당 값을 사용합니다.
 *   - 설정되어 있지 않으면 경고를 출력하고 관리자 로그인 기능이 비활성화됩니다.
 *   - Manus 시크릿 설정에서 등록하면 즉시 활성화됩니다.
 */

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(
      `[ENV ERROR] 필수 환경변수 "${key}"가 설정되지 않았습니다. 서버를 시작할 수 없습니다.`
    );
  }
  return value;
}

function validateEnv() {
  const isProduction = process.env.NODE_ENV === "production";

  if (isProduction) {
    const jwtSecret = process.env.JWT_SECRET ?? "";
    if (!jwtSecret) {
      throw new Error("[ENV ERROR] JWT_SECRET이 설정되지 않았습니다. 서버를 시작할 수 없습니다.");
    } else if (jwtSecret.length < 32) {
      throw new Error(
        `[ENV ERROR] JWT_SECRET은 32자 이상이어야 합니다. 현재 ${jwtSecret.length}자입니다.`
      );
    }

    // ADMIN_USERNAME / ADMIN_PASSWORD는 미설정 시 경고만 출력 (서버 시작은 허용)
    if (!process.env.ADMIN_USERNAME) {
      console.warn(
        "[ENV WARN] ADMIN_USERNAME이 설정되지 않았습니다. 관리자 로그인 기능이 비활성화됩니다. " +
        "Manus 시크릿 설정에서 ADMIN_USERNAME을 등록해 주세요."
      );
    }
    if (!process.env.ADMIN_PASSWORD) {
      console.warn(
        "[ENV WARN] ADMIN_PASSWORD가 설정되지 않았습니다. 관리자 로그인 기능이 비활성화됩니다. " +
        "Manus 시크릿 설정에서 ADMIN_PASSWORD를 등록해 주세요."
      );
    }
  } else {
    // 개발 환경에서는 경고만 출력
    if (!process.env.ADMIN_USERNAME) {
      console.warn("[ENV WARN] ADMIN_USERNAME이 설정되지 않았습니다. 개발 환경 기본값을 사용합니다.");
    }
    if (!process.env.ADMIN_PASSWORD) {
      console.warn("[ENV WARN] ADMIN_PASSWORD가 설정되지 않았습니다. 개발 환경 기본값을 사용합니다.");
    }
    const jwtSecret = process.env.JWT_SECRET ?? "";
    if (jwtSecret.length > 0 && jwtSecret.length < 32) {
      console.warn(`[ENV WARN] JWT_SECRET이 32자 미만입니다 (현재 ${jwtSecret.length}자). 운영 환경에서는 반드시 32자 이상으로 설정하세요.`);
    }
  }
}

// 서버 시작 시 검증 실행
validateEnv();

export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",

  // 관리자 로그인 자격증명
  // ⚠️ 운영 환경에서는 반드시 환경변수로 설정해야 합니다 (기본값 없음)
  // 개발 환경에서만 임시 기본값 사용
  adminUsername: process.env.ADMIN_USERNAME ?? (process.env.NODE_ENV !== "production" ? "joyfulchurch_dev" : ""),
  adminPassword: process.env.ADMIN_PASSWORD ?? (process.env.NODE_ENV !== "production" ? "dev_only_password!" : ""),
  adminOpenId: process.env.ADMIN_OPEN_ID ?? (process.env.NODE_ENV !== "production" ? "local-admin" : ""),
};
