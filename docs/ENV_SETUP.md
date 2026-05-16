# 환경변수 설정 가이드 (외부 서버 이전용)

> 이 문서는 기쁨의교회 홈페이지를 외부 서버로 이전할 때 설정해야 하는 모든 환경변수를 설명합니다.

---

## 빠른 시작

외부 서버에서 아래 환경변수들을 설정하면 홈페이지가 정상 작동합니다.

```bash
# 예시: Linux 서버에서 직접 설정
export DATABASE_URL="mysql://user:password@host:3306/joych_homepage"
export JWT_SECRET="랜덤한-32자-이상-문자열"
export ADMIN_USERNAME="joyfulchurch"
export ADMIN_PASSWORD="새로운-강력한-비밀번호"
export ADMIN_OPEN_ID="admin_joyfulchurch"
export PUBLIC_URL_BASE="https://dadowoomtest.co.kr"
```

또는 프로젝트 루트에 `.env` 파일을 만들어 아래 내용을 채워주세요.

---

## 필수 환경변수 목록

### 1. 데이터베이스

| 변수명 | 설명 | 예시 |
|---|---|---|
| `DATABASE_URL` | MySQL 연결 문자열 | `mysql://user:pass@host:3306/db` |

**지원 DB:** MySQL 5.7+, MySQL 8.0+, TiDB, PlanetScale, AWS RDS MySQL, MariaDB

```
DATABASE_URL=mysql://사용자명:비밀번호@호스트:포트/데이터베이스명
```

### 2. 보안 / 인증

| 변수명 | 설명 | 기본값 (변경 필수!) |
|---|---|---|
| `JWT_SECRET` | 세션 쿠키 서명 비밀키 | *(없음 — 반드시 설정)* |
| `ADMIN_USERNAME` | 관리자 로그인 아이디 | `joyfulchurch` |
| `ADMIN_PASSWORD` | 관리자 로그인 비밀번호 | 강력한 운영 비밀번호 |
| `ADMIN_OPEN_ID` | 관리자 계정 내부 식별자 | `admin_joyfulchurch` |
| `PUBLIC_URL_BASE` | OAuth 콜백 생성 기준 URL | `https://dadowoomtest.co.kr` |

> **⚠️ 보안 주의:** `ADMIN_PASSWORD`는 반드시 강력한 비밀번호로 변경하세요.
> `JWT_SECRET`은 아래 명령으로 랜덤 값을 생성하세요:
> ```bash
> node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
> ```

### 3. 성도 간편가입 / 간편로그인

구글과 카카오 성도 간편가입을 사용하려면 아래 값을 서버 환경변수에 추가합니다.

| 변수명 | 설명 | 필수 여부 |
|---|---|---|
| `GOOGLE_OAUTH_CLIENT_ID` | Google OAuth 웹 애플리케이션 클라이언트 ID | 구글 사용 시 필수 |
| `GOOGLE_OAUTH_CLIENT_SECRET` | Google OAuth 클라이언트 보안 비밀 | 구글 사용 시 필수 |
| `KAKAO_REST_API_KEY` | Kakao Developers REST API 키 | 카카오 사용 시 필수 |
| `KAKAO_CLIENT_SECRET` | Kakao REST API client secret | 카카오 설정이 ON이면 필수 |

각 콘솔에 등록할 Redirect URI:

```
https://dadowoomtest.co.kr/api/member-oauth/google/callback
https://dadowoomtest.co.kr/api/member-oauth/kakao/callback
```

> 간편가입으로 새로 들어온 성도는 기존 회원가입과 동일하게 `pending` 상태로 생성됩니다. 관리자가 승인해야 로그인됩니다.

### 4. 파일 저장소 (S3 호환)

이미지, 영상 파일 업로드에 사용됩니다. AWS S3, Cloudflare R2, MinIO 등 S3 호환 서비스를 사용할 수 있습니다.

| 변수명 | 설명 |
|---|---|
| `S3_ENDPOINT` | S3 엔드포인트 URL |
| `S3_REGION` | 리전 (예: `ap-northeast-2`) |
| `S3_BUCKET` | 버킷 이름 |
| `S3_ACCESS_KEY` | 액세스 키 ID |
| `S3_SECRET_KEY` | 시크릿 액세스 키 |

**AWS S3 예시:**
```
S3_ENDPOINT=https://s3.amazonaws.com
S3_REGION=ap-northeast-2
S3_BUCKET=joych-homepage
S3_ACCESS_KEY=AKIAIOSFODNN7EXAMPLE
S3_SECRET_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
```

**Cloudflare R2 예시 (비용 절감 권장):**
```
S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
S3_REGION=auto
S3_BUCKET=joych-homepage
S3_ACCESS_KEY=<R2 Access Key ID>
S3_SECRET_KEY=<R2 Secret Access Key>
```

> **📌 참고:** 현재 Manus 플랫폼에서 운영 중일 때 업로드된 파일들은 Manus CDN에 저장되어 있습니다.
> 외부 이전 시 기존 파일 URL은 그대로 유지되지만, 새로 업로드되는 파일은 위 S3 설정을 사용합니다.
> 기존 파일도 새 스토리지로 옮기려면 별도 마이그레이션 작업이 필요합니다.

---

## 선택 환경변수

| 변수명 | 설명 | 기본값 |
|---|---|---|
| `VITE_APP_TITLE` | 브라우저 탭 제목 | `기쁨의교회` |
| `VITE_APP_LOGO` | 앱 로고 URL | *(없음)* |
| `NODE_ENV` | 실행 환경 | `development` |
| `PORT` | 서버 포트 | `3000` |

---

## S3 스토리지 코드 수정 방법

현재 `server/storage.ts`는 Manus 내장 S3를 사용합니다.
외부 S3로 교체하려면 아래와 같이 수정하세요.

**현재 코드 (`server/storage.ts`):**
```typescript
// Manus 내장 S3 설정 (자동 주입)
const s3Client = new S3Client({ ... });
```

**외부 S3로 교체 시:**
```typescript
import { S3Client } from "@aws-sdk/client-s3";

const s3Client = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION ?? "ap-northeast-2",
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY!,
    secretAccessKey: process.env.S3_SECRET_KEY!,
  },
  forcePathStyle: true, // MinIO 사용 시 필요
});

export const BUCKET_NAME = process.env.S3_BUCKET!;
```

---

## Manus 전용 기능 (외부 이전 시 비활성화 필요)

아래 기능들은 Manus 플랫폼에서만 작동합니다. 외부 이전 시 해당 기능을 비활성화하거나 대체 서비스로 교체해야 합니다.

| 기능 | Manus 전용 여부 | 대체 방법 |
|---|---|---|
| OAuth 로그인 (Manus 계정) | ✅ 전용 | 관리자는 ID/PW 방식으로 대체 완료 |
| 내장 LLM API | ✅ 전용 | OpenAI API 등으로 교체 |
| 내장 알림 (notifyOwner) | ✅ 전용 | 이메일/슬랙 알림으로 교체 |
| 내장 S3 스토리지 | ✅ 전용 | 위 S3 설정으로 교체 |
| 음성 인식 (Whisper) | ✅ 전용 | OpenAI Whisper API로 교체 |

---

## 이전 후 확인 체크리스트

```
□ DATABASE_URL 설정 완료
□ pnpm db:push 실행 (DB 스키마 생성)
□ JWT_SECRET 설정 완료 (랜덤 값 사용)
□ ADMIN_PASSWORD 변경 완료
□ PUBLIC_URL_BASE 설정 완료
□ 구글/카카오 Redirect URI 등록 완료
□ S3 스토리지 설정 완료
□ server/storage.ts S3 설정 교체 완료
□ pnpm build 성공
□ 관리자 로그인 테스트 (/admin_joych_2026)
□ 파일 업로드 테스트 (이미지 업로드)
□ 성도 회원가입/로그인 테스트
```
