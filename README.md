# 기쁨의교회 홈페이지 (joych-homepage)

> **관리 주체:** 기쁨의교회 (The Joyful Church)  
> **운영 도메인:** [dadowoomtest.co.kr](https://dadowoomtest.co.kr) / [joychome-kastcrbz.manus.space](https://joychome-kastcrbz.manus.space)  
> **최초 개발:** 2026년 4월 | **기술 플랫폼:** Manus Web App (tRPC + React + MySQL)

---

## 목차

1. [프로젝트 개요](#1-프로젝트-개요)
2. [기술 스택](#2-기술-스택)
3. [폴더 구조](#3-폴더-구조)
4. [로컬 개발 환경 설정](#4-로컬-개발-환경-설정)
5. [주요 명령어](#5-주요-명령어)
6. [환경변수 목록](#6-환경변수-목록)
7. [인증 시스템](#7-인증-시스템)
8. [API 구조 (tRPC)](#8-api-구조-trpc)
9. [데이터베이스 구조](#9-데이터베이스-구조)
10. [관리자 접근 방법](#10-관리자-접근-방법)
11. [배포 방법](#11-배포-방법)
12. [알려진 이슈 및 미완료 기능](#12-알려진-이슈-및-미완료-기능)

---

## 1. 프로젝트 개요

기쁨의교회 공식 홈페이지입니다. 성도 약 3,000명 규모의 교회를 위해 제작되었으며, 다음 기능을 제공합니다.

| 기능 영역 | 설명 |
|---|---|
| **홈페이지** | 히어로 영상 슬라이드, 퀵메뉴, 조이풀TV, 교회소식, 비전, 갤러리, 관련기관 |
| **동적 메뉴 시스템** | 관리자가 메뉴 구조(1단/2단/3단)를 직접 편집, 각 페이지 타입별 콘텐츠 표시 |
| **블록 에디터** | 텍스트, 이미지, 유튜브, 버튼 등 블록 단위로 페이지 콘텐츠 편집 |
| **예배영상(조이풀TV)** | 플레이리스트별 영상 목록, 유튜브 및 직접 URL 재생 지원 |
| **시설 예약** | 시설 목록/상세/달력/시간 슬롯 선택/예약 신청/내 예약 현황 |
| **성도 회원 시스템** | 성도 회원가입/로그인/마이페이지/교적부 관리 |
| **관리자 CMS** | 공지사항, 메뉴, 슬라이드, 갤러리, 시설, 예약, 예배영상 통합 관리 |

---

## 2. 기술 스택

| 영역 | 기술 | 버전 |
|---|---|---|
| **프론트엔드** | React | 19.x |
| **언어** | TypeScript | 5.9.x |
| **스타일링** | Tailwind CSS | 4.x |
| **UI 컴포넌트** | shadcn/ui (Radix UI 기반) | 최신 |
| **클라이언트 라우팅** | Wouter | 최신 |
| **백엔드** | Express.js | 4.x |
| **API 계층** | tRPC | 11.x |
| **데이터베이스** | MySQL (TiDB 호환) | — |
| **ORM** | Drizzle ORM | 0.44.x |
| **파일 저장** | AWS S3 (Manus CDN) | — |
| **빌드 도구** | Vite | 7.x |
| **런타임** | Node.js | 22.x |
| **패키지 매니저** | pnpm | — |

---

## 3. 폴더 구조

```
joych-homepage/
│
├── client/                         # 프론트엔드 (React)
│   ├── public/                     # 정적 파일 (favicon 등 소형 파일만)
│   └── src/
│       ├── App.tsx                 # 전체 라우팅 구조
│       ├── main.tsx                # 앱 진입점 (tRPC 클라이언트 설정)
│       ├── index.css               # 전역 스타일 (CSS 변수, 테마)
│       ├── const.ts                # 공통 상수 (로그인 URL 등)
│       ├── pages/                  # 페이지 컴포넌트 (라우트 1:1 대응)
│       ├── components/             # 재사용 UI 컴포넌트
│       │   └── ui/                 # shadcn/ui 기본 컴포넌트 (수정 금지)
│       ├── contexts/               # React Context (테마 등)
│       ├── hooks/                  # 커스텀 훅
│       └── lib/                    # 유틸리티 함수 및 정적 데이터
│
├── server/                         # 백엔드 (Express + tRPC)
│   ├── _core/                      # 프레임워크 코어 (수정 금지)
│   │   ├── index.ts                # 서버 진입점
│   │   ├── trpc.ts                 # procedure 정의 (public/protected/admin/member)
│   │   ├── context.ts              # 요청 컨텍스트 (ctx.user, ctx.memberId)
│   │   ├── env.ts                  # 환경변수 접근
│   │   └── ...                     # OAuth, 쿠키, LLM, 스토리지 헬퍼
│   ├── routers/                    # tRPC 라우터 (기능별 분리)
│   │   ├── index.ts                # AppRouter 통합 (전체 API 구조 한눈에 확인)
│   │   ├── auth.ts                 # 관리자 로그인/로그아웃
│   │   ├── home.ts                 # 홈페이지 공개 데이터
│   │   ├── members.ts              # 성도 회원 시스템
│   │   ├── youtube.ts              # 예배영상 관리
│   │   └── cms/                    # 관리자 전용 CMS API
│   │       ├── index.ts            # CMS 라우터 통합
│   │       ├── notices.ts          # 공지사항 관리
│   │       ├── content.ts          # 슬라이드/갤러리/퀵메뉴/설정
│   │       ├── menus.ts            # 메뉴 구조 관리
│   │       ├── facilities.ts       # 시설 관리
│   │       ├── reservations.ts     # 예약 승인/거절
│   │       ├── blocks.ts           # 블록 에디터
│   │       └── upload.ts           # 파일 업로드 (S3)
│   ├── db/                         # DB 쿼리 헬퍼 (기능별 분리)
│   │   ├── index.ts                # 전체 DB 함수 통합 export
│   │   ├── connection.ts           # DB 연결 (Drizzle 인스턴스)
│   │   ├── user.ts                 # 관리자 사용자
│   │   ├── notice.ts               # 공지사항
│   │   ├── content.ts              # 슬라이드/갤러리/퀵메뉴/설정
│   │   ├── menu.ts                 # 메뉴 구조
│   │   ├── facility.ts             # 시설/예약
│   │   ├── member.ts               # 성도 회원
│   │   ├── blocks.ts               # 블록 에디터
│   │   └── youtube.ts              # 예배영상
│   ├── db.ts                       # db/index.ts re-export (하위 호환용)
│   ├── routers.ts                  # routers/index.ts re-export (하위 호환용)
│   └── storage.ts                  # S3 파일 업로드 헬퍼
│
├── drizzle/                        # 데이터베이스
│   ├── schema.ts                   # 전체 테이블 스키마 정의
│   ├── relations.ts                # 테이블 관계 정의
│   └── migrations/                 # 마이그레이션 파일
│
├── shared/                         # 프론트/백 공유 타입 및 상수
│   ├── types.ts
│   └── const.ts
│
├── docs/                           # 참고 문서 (상세 설계/규칙)
│   ├── DEVELOPMENT_RULES.md        # 개발 규칙 및 코딩 컨벤션
│   ├── DEPLOYMENT.md               # 외부 서버 이전 단계별 가이드
│   ├── ENV_SETUP.md                # 환경변수 설정 가이드
│   ├── DB_DESIGN.md                # DB 설계 문서
│   ├── CMS_DESIGN.md               # CMS 설계 문서
│   ├── REFACTOR_GUIDE.md           # 리팩토링 가이드
│   ├── auth-system.md              # 인증 시스템 상세 설명
│   └── work-rules.md               # 작업 규칙 (구버전)
│
├── README.md                       # 이 파일 (첫 번째로 읽어야 함)
├── WORK_SESSION.md                 # 세션 인수인계 (다음 작업자용)
├── PROJECT_DIRECTION.md            # 방향성 및 기능 현황
├── HANDOVER.md                     # 외부 업체 인수인계 전용
├── todo.md                         # 작업 현황 (완료/미완료 목록)
├── drizzle.config.ts               # Drizzle 설정
├── vite.config.ts                  # Vite 설정
├── tsconfig.json                   # TypeScript 설정
└── package.json                    # 의존성 및 스크립트
```

---

## 4. 로컬 개발 환경 설정

> **주의:** 이 프로젝트는 Manus 플랫폼에서 운영됩니다. 로컬 개발 시 환경변수를 별도로 설정해야 합니다.

```bash
# 1. 의존성 설치
pnpm install

# 2. 환경변수 설정 (.env 파일 생성)
cp .env.example .env
# .env 파일에 아래 환경변수 목록을 참고하여 값 입력

# 3. 데이터베이스 마이그레이션
pnpm db:push

# 4. 개발 서버 실행
pnpm dev
# → http://localhost:3000 에서 확인
```

---

## 5. 주요 명령어

| 명령어 | 설명 |
|---|---|
| `pnpm dev` | 개발 서버 실행 (Hot Reload 포함) |
| `pnpm build` | 프로덕션 빌드 |
| `pnpm start` | 프로덕션 서버 실행 |
| `pnpm check` | TypeScript 타입 오류 검사 |
| `pnpm test` | 단위 테스트 실행 (Vitest) |
| `pnpm db:push` | DB 스키마 변경사항 마이그레이션 |
| `pnpm format` | 코드 포맷팅 (Prettier) |

---

## 6. 환경변수 목록

| 변수명 | 용도 | 필수 여부 |
|---|---|---|
| `DATABASE_URL` | MySQL 연결 문자열 | ✅ 필수 |
| `JWT_SECRET` | 세션 쿠키 서명 키 | ✅ 필수 |
| `VITE_APP_ID` | Manus OAuth 앱 ID | ✅ 필수 |
| `OAUTH_SERVER_URL` | Manus OAuth 서버 URL | ✅ 필수 |
| `VITE_OAUTH_PORTAL_URL` | Manus 로그인 포털 URL | ✅ 필수 |
| `OWNER_OPEN_ID` | 오너 계정 식별자 | ✅ 필수 |
| `OWNER_NAME` | 오너 이름 | 선택 |
| `BUILT_IN_FORGE_API_URL` | Manus 내장 API URL (서버) | ✅ 필수 |
| `BUILT_IN_FORGE_API_KEY` | Manus 내장 API 키 (서버) | ✅ 필수 |
| `VITE_FRONTEND_FORGE_API_URL` | Manus 내장 API URL (프론트) | ✅ 필수 |
| `VITE_FRONTEND_FORGE_API_KEY` | Manus 내장 API 키 (프론트) | ✅ 필수 |
| `VITE_APP_TITLE` | 사이트 제목 | 선택 |
| `VITE_APP_LOGO` | 사이트 로고 URL | 선택 |

> **보안 주의:** 환경변수는 절대 코드에 직접 입력하지 않습니다. `server/_core/env.ts`를 통해서만 접근합니다.

---

## 7. 인증 시스템

이 프로젝트는 **두 가지 독립적인 인증 시스템**을 사용합니다.

### 관리자 인증 (Manus OAuth)

- **방식:** Manus OAuth 2.0 (외부 로그인 서버)
- **접근 경로:** `/admin_joych_2026` (보안을 위해 `/admin`은 404 처리)
- **서버 코드:** `server/routers/auth.ts`
- **프론트 코드:** `useAuth()` 훅 (`client/src/_core/hooks/useAuth.ts`)
- **보호 방법:** `adminProcedure` (서버), `ctx.user` 확인 (서버)

### 성도 회원 인증 (자체 세션)

- **방식:** 이메일/비밀번호 + `church_member_session` 쿠키
- **접근 경로:** `/member/login`, `/member/register`
- **서버 코드:** `server/routers/members.ts`
- **보호 방법:** `memberProtectedProcedure` (서버), `ctx.memberId` 확인 (서버)

> **중요:** 두 인증 시스템은 완전히 분리되어 있습니다. 관리자 기능에는 `adminProcedure`를, 성도 기능에는 `memberProtectedProcedure`를 사용해야 합니다.

---

## 8. API 구조 (tRPC)

모든 API는 tRPC를 통해 타입 안전하게 호출됩니다. `server/routers/index.ts`에서 전체 구조를 확인할 수 있습니다.

| 라우터 키 | 파일 | 접근 권한 | 설명 |
|---|---|---|---|
| `auth.*` | `routers/auth.ts` | 공개/관리자 | 관리자 로그인/로그아웃 |
| `system.*` | `_core/systemRouter.ts` | 관리자 | 시스템 알림 |
| `home.*` | `routers/home.ts` | 공개/성도 | 홈페이지 공개 데이터 |
| `cms.*` | `routers/cms/` | **관리자 전용** | CMS 전체 관리 |
| `members.*` | `routers/members.ts` | 공개/성도 | 성도 회원 시스템 |
| `youtube.*` | `routers/youtube.ts` | 공개/관리자 | 예배영상 관리 |

### 프론트엔드에서 API 호출 방법

```typescript
// 데이터 조회
const { data, isLoading } = trpc.home.heroSlides.useQuery();

// 데이터 변경
const mutation = trpc.cms.notices.create.useMutation({
  onSuccess: () => utils.cms.notices.invalidate(),
});
```

> **주의:** `trpc.admin.*`는 존재하지 않습니다. 관리자 기능은 반드시 `trpc.cms.*`를 사용해야 합니다.

---

## 9. 데이터베이스 구조

전체 스키마는 `drizzle/schema.ts`에 정의되어 있습니다. 상세 설계는 `DB_DESIGN.md`를 참조하세요.

| 테이블 | 역할 |
|---|---|
| `users` | 관리자 계정 (Manus OAuth) |
| `menus` | 1단 메뉴 |
| `menu_items` | 2단 메뉴 (페이지 타입 포함) |
| `menu_sub_items` | 3단 메뉴 |
| `hero_slides` | 히어로 영상/이미지 슬라이드 |
| `notices` | 교회 소식/공지사항 |
| `gallery_items` | 갤러리 사진 |
| `affiliates` | 관련기관 |
| `quick_menus` | 홈 퀵메뉴 |
| `site_settings` | 사이트 설정 (key-value) |
| `page_blocks` | 블록 에디터 콘텐츠 |
| `church_members` | 성도 회원 정보 |
| `member_field_options` | 직분/부서/구역 선택지 |
| `facilities` | 시설 정보 |
| `facility_images` | 시설 사진 |
| `facility_hours` | 시설 운영 시간 |
| `facility_blocked_dates` | 시설 휴무일 |
| `reservations` | 시설 예약 신청 |
| `youtube_playlists` | 예배영상 플레이리스트 |
| `youtube_videos` | 예배영상 목록 |

### 스키마 변경 방법

```bash
# 1. drizzle/schema.ts 수정
# 2. 마이그레이션 생성 및 적용
pnpm db:push
```

---

## 10. 관리자 접근 방법

| 항목 | 내용 |
|---|---|
| **관리자 페이지 URL** | `/admin_joych_2026` |
| **로그인 방식** | Manus OAuth (별도 계정 필요) |
| **편집 모드 진입** | 관리자 로그인 후 홈페이지 상단에 편집 바 표시 |

> **보안:** `/admin` 경로는 의도적으로 404 처리됩니다. 관리자 페이지 URL을 외부에 공개하지 마세요.

---

## 11. 배포 방법

이 프로젝트는 **Manus 플랫폼**에서 운영됩니다. 배포는 Manus 관리 UI의 **Publish 버튼**을 통해 진행합니다.

```bash
# 프로덕션 빌드 확인 (선택사항)
pnpm build
```

외부 서버(Railway, Vercel 등)로 이전 시 다음 사항을 확인해야 합니다.

1. 환경변수 전체 이전 (위 목록 참조)
2. MySQL 데이터베이스 연결 정보 변경 (`DATABASE_URL`)
3. Manus OAuth 설정 변경 또는 자체 인증 시스템으로 교체
4. S3 파일 스토리지 설정 변경

---

## 12. 알려진 이슈 및 미완료 기능

상세 내용은 `HANDOVER.md`를 참조하세요.

### 알려진 버그

현재 확인된 미해결 버그 없음.

| 항목 | 상태 | 설명 |
|---|---|---|
| 블록 에디터 자동 갱신 | ✅ 해결 | invalidate 처리 완료 |
| 갤러리 편집 자동 갱신 | ✅ 해결 | invalidate 처리 완료 |
| 로그인 후 상단 바 이름 미표시 | ✅ 해결 | invalidate 처리 완료 |

### 주요 미완료 기능

| 기능 | 우선순위 | GitHub Issue |
|---|---|---|
| 성도 세션 JWT 보안 정리 | 높음 (보안) | #2 |
| DB 스키마 정합성 점검 | 높음 (안정성) | #3 |
| 성도 비밀번호 찾기/재설정 | 중간 | #4 |
| 성도 회원탈퇴 | 중간 | #5 |
| 블록 에디터 고급 기능 (정렬, 색상, 표 등) | 낮음 | - |
| 카카오 소셜 로그인 | 낮음 | - |

---

## 문의

프로젝트 관련 문의는 기쁨의교회 담당자에게 연락하시기 바랍니다.
