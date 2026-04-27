// 로컬 파일시스템 기반 스토리지 헬퍼
// 외부 서버(iwinv) 배포 시 사용: /var/www/joych-homepage/uploads/ 에 저장
// 외부 접근 URL: https://dadowoomtest.co.kr/uploads/파일명

import fs from "fs";
import path from "path";

// 업로드 디렉토리: 환경변수 UPLOAD_DIR 또는 기본값
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads");
// 공개 URL 베이스: 환경변수 PUBLIC_URL_BASE 또는 기본값
const PUBLIC_URL_BASE = process.env.PUBLIC_URL_BASE || "http://localhost:3000";

/**
 * 업로드 디렉토리 초기화 (없으면 생성)
 */
function ensureUploadDir(relKey: string): string {
  const filePath = path.join(UPLOAD_DIR, relKey);
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
  const key = relKey.replace(/^\/+/, "");
  const filePath = ensureUploadDir(key);

  if (typeof data === "string") {
    fs.writeFileSync(filePath, data, "utf-8");
  } else {
    fs.writeFileSync(filePath, Buffer.from(data));
  }

  const url = `${PUBLIC_URL_BASE.replace(/\/+$/, "")}/uploads/${key}`;
  return { key, url };
}

/**
 * 파일의 공개 접근 URL 반환
 * @param relKey 상대 경로
 * @returns { key, url }
 */
export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  const key = relKey.replace(/^\/+/, "");
  const url = `${PUBLIC_URL_BASE.replace(/\/+$/, "")}/uploads/${key}`;
  return { key, url };
}
