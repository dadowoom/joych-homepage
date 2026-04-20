# 외부 서버 이전 가이드 (DEPLOYMENT)

> 기쁨의교회 홈페이지를 외부 서버 및 DB로 이전하기 위한 단계별 가이드입니다.
> 이 문서를 따라 진행하면 약 2~4시간 내에 이전을 완료할 수 있습니다.

---

## 사전 준비 사항

이전을 시작하기 전에 아래 항목들을 준비해 주세요.

| 항목 | 설명 |
|---|---|
| 서버 | Node.js 22+ 설치된 Linux 서버 (Ubuntu 22.04 권장) |
| DB | MySQL 8.0+ 또는 MariaDB 10.6+ |
| 스토리지 | AWS S3, Cloudflare R2, 또는 MinIO |
| 도메인 | 홈페이지에 연결할 도메인 (선택) |
| SSL | HTTPS 인증서 (Let's Encrypt 무료 사용 가능) |

---

## 이전 단계

### 1단계: 코드 다운로드

Manus 관리 화면에서 **ZIP 파일로 다운로드** 하거나, GitHub에 연결되어 있다면 `git clone`으로 받습니다.

```bash
# ZIP 다운로드 후 압축 해제
unzip joych-homepage.zip -d joych-homepage
cd joych-homepage

# 또는 GitHub에서 클론
git clone https://github.com/your-org/joych-homepage.git
cd joych-homepage
```

### 2단계: Node.js 및 패키지 설치

```bash
# Node.js 22 설치 (nvm 사용 권장)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 22
nvm use 22

# pnpm 설치
npm install -g pnpm

# 프로젝트 패키지 설치
pnpm install
```

### 3단계: 환경변수 설정

프로젝트 루트에 `.env` 파일을 생성하고 아래 내용을 채워주세요.
자세한 설명은 `ENV_SETUP.md`를 참고하세요.

```bash
# .env 파일 생성
cat > .env << 'EOF'
# 데이터베이스
DATABASE_URL=mysql://사용자명:비밀번호@호스트:3306/데이터베이스명

# 보안
JWT_SECRET=랜덤한-32자-이상-문자열

# 관리자 계정
ADMIN_USERNAME=joyfulchurch
ADMIN_PASSWORD=새로운-강력한-비밀번호
ADMIN_OPEN_ID=admin_joyfulchurch

# S3 스토리지
S3_ENDPOINT=https://s3.amazonaws.com
S3_REGION=ap-northeast-2
S3_BUCKET=joych-homepage
S3_ACCESS_KEY=your-access-key
S3_SECRET_KEY=your-secret-key
EOF
```

> **⚠️ 중요:** `ADMIN_PASSWORD`는 반드시 강력한 비밀번호로 변경하세요.

### 4단계: S3 스토리지 설정 교체

현재 `server/storage.ts`는 Manus 내장 S3를 사용합니다.
외부 S3로 교체하려면 아래와 같이 수정하세요.

`server/storage.ts` 파일을 열어 상단 S3Client 설정 부분을 찾아 교체합니다:

```typescript
// 기존 (Manus 내장 S3)
// const s3Client = new S3Client({ ... Manus 설정 ... });

// 교체 (외부 S3)
import { S3Client } from "@aws-sdk/client-s3";

const s3Client = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION ?? "ap-northeast-2",
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY!,
    secretAccessKey: process.env.S3_SECRET_KEY!,
  },
  forcePathStyle: true, // MinIO 사용 시 필요, AWS S3는 false
});

export const BUCKET_NAME = process.env.S3_BUCKET!;
```

### 5단계: DB 스키마 생성

```bash
# DB 스키마 생성 및 마이그레이션 실행
pnpm db:push
```

> **📌 참고:** 기존 Manus DB의 데이터를 이전하려면 아래 "데이터 마이그레이션" 섹션을 참고하세요.

### 6단계: 빌드

```bash
# TypeScript 오류 확인
pnpm check

# 프로덕션 빌드
pnpm build
```

빌드가 성공하면 `dist/` 폴더에 서버 파일이 생성됩니다.

### 7단계: 서버 실행

**직접 실행 (테스트용):**
```bash
pnpm start
```

**PM2로 실행 (운영 환경 권장):**
```bash
# PM2 설치
npm install -g pm2

# 서버 시작
pm2 start dist/index.js --name joych-homepage

# 서버 재시작 설정 (서버 재부팅 시 자동 시작)
pm2 startup
pm2 save
```

### 8단계: Nginx 설정 (도메인 연결)

```nginx
# /etc/nginx/sites-available/joych-homepage
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# Nginx 설정 활성화
ln -s /etc/nginx/sites-available/joych-homepage /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx

# SSL 인증서 발급 (Let's Encrypt)
certbot --nginx -d your-domain.com -d www.your-domain.com
```

---

## 데이터 마이그레이션 (기존 데이터 이전)

기존 Manus DB의 데이터를 새 DB로 옮기려면 아래 절차를 따르세요.

### DB 데이터 내보내기 (Manus에서)

Manus 관리 화면 → Database 탭 → 내보내기(Export) 기능을 사용하거나,
Manus DB 연결 정보를 확인하여 `mysqldump`로 내보냅니다.

```bash
# Manus DB에서 내보내기
mysqldump -h [manus-db-host] -u [user] -p [database] > backup.sql
```

### DB 데이터 가져오기 (새 서버에서)

```bash
# 새 DB에 가져오기
mysql -h localhost -u [user] -p [database] < backup.sql
```

### 파일 마이그레이션 (이미지/영상)

현재 Manus CDN에 저장된 파일들은 `d2xsxph8kpxj0f.cloudfront.net` 도메인을 사용합니다.
이 파일들은 Manus 플랫폼이 유지되는 동안 계속 접근 가능합니다.

파일도 새 스토리지로 옮기려면:
1. DB에서 모든 URL 목록을 추출합니다.
2. 각 파일을 다운로드하여 새 S3에 업로드합니다.
3. DB의 URL을 새 URL로 업데이트합니다.

---

## 이전 후 확인 체크리스트

```
□ 홈페이지 메인 페이지 정상 표시
□ 관리자 로그인 (/admin_joych_2026) 정상 작동
□ 메뉴 편집 기능 정상 작동
□ 이미지 업로드 기능 정상 작동
□ 성도 회원가입/로그인 정상 작동
□ 시설 예약 기능 정상 작동
□ 모바일 화면 정상 표시
□ HTTPS 연결 정상 작동
□ 서버 자동 재시작 설정 (PM2 startup)
```

---

## 문제 해결

### DB 연결 실패
```
Error: connect ECONNREFUSED
```
→ `DATABASE_URL` 형식 확인. 호스트, 포트, 사용자명, 비밀번호, DB명을 재확인하세요.

### 파일 업로드 실패
```
Error: S3 upload failed
```
→ `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET` 설정 확인. 버킷 권한(ACL)도 확인하세요.

### 관리자 로그인 실패
```
아이디 또는 비밀번호가 올바르지 않습니다.
```
→ `.env`의 `ADMIN_USERNAME`, `ADMIN_PASSWORD` 설정 확인.

### 빌드 실패
```
TypeScript errors found
```
→ `pnpm check` 실행 후 오류 메시지 확인. 환경변수 누락이 원인인 경우가 많습니다.

---

## 기술 지원

이전 작업 중 문제가 발생하면 아래 정보를 준비하여 담당자에게 문의하세요.

- 오류 메시지 전문
- 서버 OS 및 Node.js 버전 (`node --version`)
- 실행 중인 명령어
- `.env` 파일 내용 (비밀번호 등 민감 정보 제외)
