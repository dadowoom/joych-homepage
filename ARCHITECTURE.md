# 기쁨의교회 홈페이지 - 시스템 아키텍처

## 📋 목차
1. [전체 시스템 구조](#전체-시스템-구조)
2. [기술 스택](#기술-스택)
3. [데이터베이스 설계](#데이터베이스-설계)
4. [API 구조](#api-구조)
5. [인증 및 권한](#인증-및-권한)
6. [배포 구조](#배포-구조)

---

## 전체 시스템 구조

```
┌─────────────────────────────────────────────────────────────────┐
│                         클라이언트 (Browser)                      │
│  React 19 + Tailwind CSS 4 + TypeScript                         │
│  - 방문자 페이지 (공개)                                           │
│  - 관리자 대시보드 (인증 필요)                                     │
└────────────────────────┬────────────────────────────────────────┘
                         │ HTTP/HTTPS
                         │ tRPC + JSON
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Express.js 백엔드 서버                         │
│  - tRPC 라우터 (RPC 엔드포인트)                                   │
│  - OAuth 2.0 콜백 핸들러                                         │
│  - 파일 업로드 처리 (S3)                                         │
│  - LLM 통합 (이미지 생성, 음성 인식)                             │
└────────────────────────┬────────────────────────────────────────┘
                         │ SQL
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                  MySQL / TiDB 데이터베이스                        │
│  - 사용자 (users)                                               │
│  - 메뉴 및 네비게이션 (menus, menuItems, menuSubItems)          │
│  - 콘텐츠 (notices, heroSlides, galleryItems)                   │
│  - 시설 예약 (facilities, reservations, blockedDates)           │
│  - 교회학교 (schoolDepartments, schoolPosts)                    │
│  - 블록 에디터 (pageBlocks)                                     │
│  - 유튜브 (youtubePlaylists, youtubeVideos)                     │
└─────────────────────────────────────────────────────────────────┘
                         │
                         ├─ S3 스토리지 (이미지, 영상)
                         ├─ Manus OAuth (인증)
                         ├─ LLM API (이미지 생성)
                         └─ Notification API (알림)
```

---

## 기술 스택

### 프론트엔드
| 항목 | 기술 | 버전 |
|------|------|------|
| 프레임워크 | React | 19 |
| 스타일링 | Tailwind CSS | 4 |
| 번들러 | Vite | 최신 |
| 언어 | TypeScript | 5.9 |
| 상태관리 | React Query | 5.90 |
| RPC 클라이언트 | tRPC | 11.6 |
| UI 컴포넌트 | shadcn/ui | - |
| 라우팅 | wouter | - |
| 드래그앤드롭 | dnd-kit | - |
| 마크다운 렌더링 | streamdown | - |

### 백엔드
| 항목 | 기술 | 버전 |
|------|------|------|
| 런타임 | Node.js | 22 |
| 웹 프레임워크 | Express.js | 4 |
| RPC 프레임워크 | tRPC | 11.6 |
| ORM | Drizzle ORM | 0.44 |
| 데이터베이스 | MySQL / TiDB | - |
| 인증 | Manus OAuth | - |
| 파일 스토리지 | AWS S3 / Cloudflare R2 | - |
| 테스트 | Vitest | - |

---

## 데이터베이스 설계

### 테이블 분류

#### 1. 사용자 관리
- **users**: 로그인한 사용자 정보 (role: user/admin)

#### 2. 네비게이션 & 메뉴
- **menus**: 상단 GNB 1단 메뉴
- **menuItems**: 2단 메뉴 (드롭다운)
- **menuSubItems**: 3단 메뉴 (세부 항목)
- **quickMenus**: 히어로 아래 빠른 접근 메뉴

#### 3. 홈페이지 콘텐츠
- **sections**: 섹션 마스터 (표시/숨김 관리)
- **heroSlides**: 히어로 슬라이드 (영상/이미지)
- **notices**: 공지사항 (카테고리, 고정글)
- **galleryItems**: 갤러리 사진
- **affiliates**: 관련 기관 링크

#### 4. 시설 예약 시스템
- **facilities**: 시설 정보 (예: 예배당, 세미나실)
- **facilityHours**: 시설 운영 시간
- **facilityImages**: 시설 사진
- **reservations**: 예약 신청 (상태: pending/approved/rejected)
- **blockedDates**: 시설 예약 불가 날짜

#### 5. 교회학교
- **schoolDepartments**: 부서 (영아부, 청년부 등)
- **schoolPosts**: 게시글
- **schoolPostFiles**: 첨부파일

#### 6. 블록 에디터
- **pageBlocks**: 동적 페이지 콘텐츠 (텍스트, 이미지, 버튼 등)

#### 7. 유튜브 영상
- **youtubePlaylists**: 플레이리스트 (예: 주일예배, 수요예배)
- **youtubeVideos**: 영상 항목 (유튜브 ID 또는 직접 URL)

#### 8. 기타
- **siteSettings**: 교회 정보 (key-value 설정)
- **members**: 성도 정보 (이름, 전화, 부서 등)

---

## API 구조

### tRPC 라우터 계층

```
trpc
├── auth
│   ├── me                    # 현재 사용자 정보
│   └── logout                # 로그아웃
│
├── home (공개)
│   ├── menus                 # GNB 메뉴 조회 (isVisible=true만)
│   ├── heroSlides            # 히어로 슬라이드
│   ├── notices               # 공지사항 목록
│   ├── facilities            # 시설 목록
│   ├── myReservations        # 내 예약 목록
│   └── menuItemByHref        # href로 메뉴 조회
│
├── cms (관리자 전용)
│   ├── menus
│   │   ├── list              # 전체 메뉴 (비공개 포함)
│   │   ├── create            # 메뉴 생성
│   │   ├── update            # 메뉴 수정
│   │   ├── delete            # 메뉴 삭제
│   │   ├── createItem        # 2단 메뉴 생성
│   │   ├── updateItem        # 2단 메뉴 수정
│   │   ├── deleteItem        # 2단 메뉴 삭제
│   │   ├── reorder           # 메뉴 순서 변경
│   │   └── ...
│   │
│   ├── blocks
│   │   ├── list              # 페이지 블록 조회
│   │   ├── create            # 블록 생성
│   │   ├── update            # 블록 수정
│   │   ├── delete            # 블록 삭제
│   │   └── reorder           # 순서 변경
│   │
│   ├── facilities
│   │   ├── list              # 시설 목록
│   │   ├── create            # 시설 생성
│   │   ├── update            # 시설 수정
│   │   ├── delete            # 시설 삭제
│   │   ├── addBlockedDate    # 예약 불가 날짜 추가
│   │   └── ...
│   │
│   ├── reservations
│   │   ├── list              # 예약 목록
│   │   ├── approve           # 예약 승인
│   │   ├── reject            # 예약 거절
│   │   └── delete            # 예약 삭제
│   │
│   ├── upload
│   │   └── presignedUrl      # S3 업로드 URL 발급
│   │
│   └── ...
│
├── youtube (공개/관리자)
│   ├── playlists             # 플레이리스트 목록
│   ├── videos                # 영상 목록
│   ├── create                # 영상 추가 (관리자)
│   └── ...
│
└── system (관리자)
    └── notifyOwner           # 소유자 알림 전송
```

### 주요 API 엔드포인트

#### 공개 API (인증 불필요)
```
GET  /api/trpc/home.menus              # GNB 메뉴
GET  /api/trpc/home.heroSlides         # 히어로 슬라이드
GET  /api/trpc/home.notices            # 공지사항
GET  /api/trpc/home.facilities         # 시설 목록
GET  /api/trpc/home.myReservations     # 내 예약 (쿠키 기반)
GET  /api/trpc/youtube.playlists       # 유튜브 플레이리스트
```

#### 관리자 API (인증 필수)
```
POST /api/trpc/cms.menus.create        # 메뉴 생성
PUT  /api/trpc/cms.menus.update        # 메뉴 수정
POST /api/trpc/cms.blocks.create       # 블록 생성
POST /api/trpc/cms.facilities.create   # 시설 생성
POST /api/trpc/cms.reservations.approve # 예약 승인
```

---

## 인증 및 권한

### OAuth 2.0 흐름
```
1. 사용자가 "로그인" 클릭
   ↓
2. Manus OAuth 포털로 리다이렉트
   ↓
3. 사용자 인증 (이메일/소셜 로그인)
   ↓
4. 콜백: /api/oauth/callback?code=...&state=...
   ↓
5. 백엔드에서 토큰 교환 및 사용자 정보 조회
   ↓
6. 세션 쿠키 발급 (httpOnly, Secure)
   ↓
7. 클라이언트로 리다이렉트
   ↓
8. 이후 모든 요청에 쿠키 자동 포함
```

### 권한 체계
| 역할 | 권한 |
|------|------|
| **user** | 예약 신청, 내 정보 조회 |
| **admin** | 모든 CMS 기능 (메뉴, 콘텐츠, 예약 관리) |

### 보호된 프로시저
```typescript
// adminProcedure: admin 역할만 접근 가능
// protectedProcedure: 로그인한 모든 사용자 접근 가능
// publicProcedure: 누구나 접근 가능
```

---

## 배포 구조

### 개발 환경
```
로컬 머신
├── 프론트엔드 (Vite dev server: http://localhost:5173)
├── 백엔드 (Express: http://localhost:3000)
└── 데이터베이스 (로컬 MySQL)
```

### 프로덕션 환경 (Manus 호스팅)
```
Manus 플랫폼
├── 프론트엔드 (CDN)
├── 백엔드 (Node.js 런타임)
├── 데이터베이스 (MySQL / TiDB)
└── S3 스토리지 (이미지, 영상)
```

### 외부 서버 이전 (선택사항)
```
예: AWS / Railway / Render
├── 프론트엔드 (Vercel / Netlify)
├── 백엔드 (EC2 / Railway / Render)
├── 데이터베이스 (RDS / 자체 MySQL)
└── 스토리지 (S3 / Cloudflare R2)
```

---

## 보안 고려사항

### 구현된 보안 기능
- ✅ HTTPS 자동 전환
- ✅ Content-Security-Policy (XSS 방어)
- ✅ X-Frame-Options (클릭재킹 방어)
- ✅ X-Content-Type-Options (MIME 스니핑 방어)
- ✅ Referrer-Policy (리퍼러 정보 제한)
- ✅ Permissions-Policy (카메라/마이크 권한 제한)
- ✅ httpOnly 쿠키 (XSS 방어)
- ✅ CSRF 토큰 (tRPC 자동 처리)

### 환경변수 보안
모든 민감한 정보는 환경변수로 관리:
- `DATABASE_URL`: 데이터베이스 연결 문자열
- `JWT_SECRET`: 세션 서명 키
- `VITE_APP_ID`: OAuth 애플리케이션 ID
- `BUILT_IN_FORGE_API_KEY`: LLM/Storage API 키

---

## 성능 최적화

### 데이터베이스
- 인덱스: `createdAt`, `isVisible`, `sortOrder`
- 페이지네이션: 공지사항 등 대량 데이터는 커서 기반 페이지네이션

### 프론트엔드
- React Query: 자동 캐싱 및 백그라운드 동기화
- Vite: 번들 최적화 및 코드 스플리팅
- Tailwind CSS: 사용하지 않는 스타일 제거

### 백엔드
- tRPC 배칭: 여러 요청을 한 번에 처리
- Superjson: Date 등 복잡한 타입 자동 직렬화

---

## 확장성

### 새로운 기능 추가 흐름
1. **DB 스키마 추가** (`drizzle/schema.ts`)
2. **마이그레이션** (`pnpm db:push`)
3. **DB 함수 작성** (`server/db/*.ts`)
4. **tRPC 라우터 추가** (`server/routers/*.ts`)
5. **프론트엔드 구현** (`client/src/pages/*.tsx`)

### 모듈화 구조
- `server/routers/cms/`: CMS 기능별 라우터
- `server/db/`: 데이터베이스 함수별 파일
- `client/src/components/`: 재사용 가능한 UI 컴포넌트
- `client/src/pages/`: 페이지 컴포넌트

---

## 모니터링 및 로깅

### 개발 환경
- `.manus-logs/devserver.log`: 서버 시작, HMR 업데이트
- `.manus-logs/browserConsole.log`: 클라이언트 console.log/error
- `.manus-logs/networkRequests.log`: HTTP 요청 추적
- `.manus-logs/sessionReplay.log`: 사용자 상호작용 기록

### 프로덕션 환경
- 애플리케이션 로그: 서버 표준 출력
- 에러 추적: tRPC 에러 자동 처리
- 성능 모니터링: 응답 시간 추적

---

## 참고 문서
- [API 명세서](./API_SPEC.md)
- [데이터베이스 ERD](./DATABASE_ERD.md)
- [배포 가이드](./DEPLOYMENT.md)
- [환경 설정](./ENV_SETUP.md)
