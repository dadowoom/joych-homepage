import crypto from "node:crypto";

const MIN_JWT_SECRET_LENGTH = 32;

let generatedDevelopmentSecret: string | null = null;
let warnedAboutDevelopmentSecret = false;
let warnedAboutShortDevelopmentSecret = false;

function isProduction() {
  return process.env.NODE_ENV === "production";
}

export function getJwtSecretString() {
  const configuredSecret = process.env.JWT_SECRET?.trim();

  if (configuredSecret && configuredSecret.length >= MIN_JWT_SECRET_LENGTH) {
    return configuredSecret;
  }

  if (isProduction()) {
    if (!configuredSecret) {
      throw new Error("[ENV ERROR] JWT_SECRET이 설정되지 않았습니다.");
    }
    throw new Error(
      `[ENV ERROR] JWT_SECRET은 ${MIN_JWT_SECRET_LENGTH}자 이상이어야 합니다.`
    );
  }

  if (configuredSecret) {
    if (!warnedAboutShortDevelopmentSecret) {
      console.warn(
        `[ENV WARN] JWT_SECRET이 ${MIN_JWT_SECRET_LENGTH}자 미만입니다. 개발 환경에서만 허용됩니다.`
      );
      warnedAboutShortDevelopmentSecret = true;
    }
    return configuredSecret;
  }

  if (!generatedDevelopmentSecret) {
    generatedDevelopmentSecret = crypto.randomBytes(48).toString("base64url");
  }
  if (!warnedAboutDevelopmentSecret) {
    console.warn("[ENV WARN] JWT_SECRET이 없어 개발용 임시 세션 키를 사용합니다.");
    warnedAboutDevelopmentSecret = true;
  }
  return generatedDevelopmentSecret;
}

export function getJwtSecretKey() {
  return new TextEncoder().encode(getJwtSecretString());
}
