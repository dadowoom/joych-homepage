// 로컬 파일시스템 기반 스토리지 헬퍼
// 외부 서버(iwinv) 배포 시 사용: /var/www/joych-homepage/uploads/ 에 저장
// 외부 접근 URL: https://www.joych.org/uploads/파일명

import fs from "fs";
import path from "path";
import { PRIMARY_SITE_ORIGIN, isSiteHostname } from "@shared/siteHosts";

// 업로드 디렉토리: 환경변수 UPLOAD_DIR 또는 기본값
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads");
// OAuth callback 기준(PUBLIC_URL_BASE)이 기존 도메인으로 남아 있더라도,
// 새로 저장되는 공개 파일 주소는 대표 도메인을 사용합니다.
export function getStoragePublicUrlBase(
  configured = process.env.PUBLIC_URL_BASE || "http://localhost:3000"
) {
  const trimmed = configured.replace(/\/+$/, "");

  try {
    if (isSiteHostname(new URL(trimmed).hostname)) {
      return PRIMARY_SITE_ORIGIN;
    }
  } catch {
    // 기존 동작처럼 잘못된/상대 형식은 문자열 그대로 사용합니다.
  }

  return trimmed;
}

/**
 * 업로드 디렉토리 초기화 (없으면 생성)
 */
function ensureUploadDir(relKey: string): string {
  const normalizedKey = path.normalize(relKey);
  if (path.isAbsolute(normalizedKey) || normalizedKey.startsWith("..") || normalizedKey.includes(`${path.sep}..${path.sep}`)) {
    throw new Error("Invalid upload path");
  }
  const uploadRoot = path.resolve(UPLOAD_DIR);
  const filePath = path.resolve(uploadRoot, normalizedKey);
  if (!filePath.startsWith(`${uploadRoot}${path.sep}`) && filePath !== uploadRoot) {
    throw new Error("Invalid upload path");
  }
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return filePath;
}

/**
 * 파일을 로컬 저장소에 업로드
 * @param relKey 상대 경로 (예: "hero/video-abc123.mp4")
 * @param data 파일 데이터 (Buffer | Uint8Array | string)
 * @param contentType MIME 타입 (사용하지 않지만 인터페이스 호환용)
 * @returns { key, url } — key는 상대 경로, url은 공개 접근 URL
 */
export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream"
): Promise<{ key: string; url: string }> {
  const key = path.normalize(relKey.replace(/^\/+/, "")).replace(/\\/g, "/");
  const filePath = ensureUploadDir(key);

  if (typeof data === "string") {
    fs.writeFileSync(filePath, data, "utf-8");
  } else {
    fs.writeFileSync(filePath, Buffer.from(data));
  }

  const url = `${getStoragePublicUrlBase()}/uploads/${key}`;
  return { key, url };
}

/**
 * 파일의 공개 접근 URL 반환
 * @param relKey 상대 경로
 * @returns { key, url }
 */
export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  const key = path.normalize(relKey.replace(/^\/+/, "")).replace(/\\/g, "/");
  const url = `${getStoragePublicUrlBase()}/uploads/${key}`;
  return { key, url };
}
