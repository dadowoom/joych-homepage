# 기쁨의교회 홈페이지 — 코드 리팩토링 가이드 & 인수인계 문서

> 작성일: 2026-04-20  
> 목적: 세션 초기화 후에도 다음 세션이 동일한 기준으로 작업을 이어받을 수 있도록 작성된 인수인계 문서입니다.

---

## 1. 프로젝트 기본 정보

| 항목 | 내용 |
|------|------|
| 프로젝트명 | joych-homepage (기쁨의교회 홈페이지) |
| 경로 | `/home/ubuntu/joych-homepage` |
| 기술 스택 | React 19 + Tailwind 4 + Express 4 + tRPC 11 + MySQL (Drizzle ORM) |
| 관리자 계정 | 운영 환경변수 `ADMIN_USERNAME`, `ADMIN_PASSWORD` 사용 |
| 도메인 | `dadowoomtest.co.kr`, `joychome-kastcrbz.manus.space` |

---

## 2. 리팩토링 목표

**"10년차 전문가가 봐도 잘 짰다"는 평가를 받을 수 있는 코드 구조**

- 각 파일은 **150줄 이하**로 유지
- 기능별로 폴더를 나눠 **역할이 명확**하게 구분
- 모든 함수/라우터에 **한국어 주석** 필수
- 파일 이름만 봐도 어떤 기능인지 바로 알 수 있도록

---

## 3. 현재 파일 크기 현황 (리팩토링 전)

| 파일 | 줄 수 | 상태 |
|------|-------|------|
| `server/routers.ts` | 1,125줄 | 분리 필요 |
| `client/src/components/MenuEditPanel.tsx` | 1,113줄 | 분리 필요 |
| `server/db.ts` | 1,095줄 | 분리 필요 |
| `client/src/pages/DynamicPage.tsx` | 976줄 | 분리 필요 |
| `client/src/pages/Admin.tsx` | 765줄 | 분리 필요 |
| `client/src/pages/Home.tsx` | 747줄 | 분리 필요 |
| `client/src/pages/FacilityApply.tsx` | 678줄 | 분리 필요 |
| `client/src/pages/FacilityDetail.tsx` | 636줄 | 분리 필요 |

---

## 4. 목표 폴더 구조

### 서버 (server/)

```
server/
  routers/                    ← 기존 routers.ts를 기능별로 분리
    auth.ts                   ← 로그인/로그아웃/관리자 인증
    home.ts                   ← 홈페이지 공개 데이터 (메뉴, 슬라이드, 시설 등)
    cms/                      ← 관리자 전용 CMS API
      notices.ts              ← 공지사항 관리
      menus.ts                ← 메뉴/서브메뉴 관리
      facilities.ts           ← 시설 관리 (이미지, 운영시간, 차단날짜, 예약)
      content.ts              ← 슬라이드, 갤러리, 퀵메뉴, 관련기관, 사이트설정
      blocks.ts               ← 블록 에디터
      upload.ts               ← 파일 업로드
      index.ts                ← cms 라우터 묶음
    members.ts                ← 교회 회원 시스템 (가입, 로그인, 교적부)
    youtube.ts                ← 예배영상 플레이리스트 & 영상 관리
    index.ts                  ← 전체 라우터 묶음 (appRouter export)
  db/                         ← 기존 db.ts를 기능별로 분리
    menu.ts                   ← 메뉴/서브메뉴 DB 함수
    notice.ts                 ← 공지사항 DB 함수
    slide.ts                  ← 히어로 슬라이드 DB 함수
    gallery.ts                ← 갤러리 DB 함수
    affiliate.ts              ← 관련기관 DB 함수
    quickmenu.ts              ← 퀵메뉴 DB 함수
    setting.ts                ← 사이트 설정 DB 함수
    facility.ts               ← 시설/예약 DB 함수
    block.ts                  ← 블록 에디터 DB 함수
    member.ts                 ← 교회 회원 DB 함수
    youtube.ts                ← 유튜브 플레이리스트/영상 DB 함수
    user.ts                   ← 시스템 사용자(관리자) DB 함수
    index.ts                  ← 전체 DB 함수 묶음 (기존 db.ts 역할 유지)
  routers.ts                  ← routers/index.ts를 re-export (하위 호환)
  db.ts                       ← db/index.ts를 re-export (하위 호환)
```

### 클라이언트 (client/src/)

```
client/src/
  pages/
    Home.tsx                  ← 섹션별 컴포넌트 조합만 담당
    Admin.tsx                 ← 탭 라우팅만 담당
    DynamicPage.tsx           ← 페이지 타입 분기만 담당
    FacilityApply.tsx         ← 단계별 컴포넌트로 분리
    FacilityDetail.tsx        ← 섹션별 컴포넌트로 분리
  components/
    home/                     ← 홈페이지 섹션 컴포넌트
      HeroSection.tsx         ← 히어로 영상 슬라이드
      QuickMenuSection.tsx    ← 퀵메뉴
      TVSection.tsx           ← 조이풀TV 미리보기
      NewsSection.tsx         ← 교회 소식
      VisionSection.tsx       ← 비전 섹션
      GallerySection.tsx      ← 갤러리
      AffiliatesSection.tsx   ← 관련기관
    admin/                    ← 관리자 탭 컴포넌트
      (기존 AdminXxxTab.tsx 파일들 이동)
    menu-edit/                ← 메뉴 편집 패널 분리
      MenuEditPanel.tsx       ← 메인 패널 (탭 라우팅만)
      MenuTreeTab.tsx         ← 메뉴 트리 편집
      MenuItemForm.tsx        ← 메뉴 아이템 폼
      SubItemForm.tsx         ← 서브 아이템 폼
```

---

## 5. 리팩토링 진행 순서 및 현재 상태

| 단계 | 작업 내용 | 상태 |
|------|----------|------|
| 1 | 체크포인트 저장 및 파일 크기 파악 | ✅ 완료 |
| 2 | `server/routers/auth.ts`, `home.ts` 분리 | 🔄 진행 중 |
| 3 | `server/routers/cms/` 분리 (notices, menus, facilities, content, blocks, upload) | ⏳ 대기 |
| 4 | `server/routers/members.ts`, `youtube.ts` 분리 및 `index.ts` 완성 | ⏳ 대기 |
| 5 | `server/db/` 기능별 분리 | ⏳ 대기 |
| 6 | `MenuEditPanel.tsx` 탭별 분리 | ⏳ 대기 |
| 7 | `Admin.tsx`, `DynamicPage.tsx`, `Home.tsx` 분리 | ⏳ 대기 |
| 8 | `FacilityApply.tsx`, `FacilityDetail.tsx` 분리 | ⏳ 대기 |
| 9 | 최종 TypeScript 오류 확인 및 체크포인트 저장 | ⏳ 대기 |

---

## 6. 분리 원칙 (반드시 준수)

### 안전한 분리 방법
1. **기존 파일을 바로 삭제하지 않는다.** 새 파일을 만든 후 기존 파일이 새 파일을 re-export하도록 변경한다.
2. **분리 후 반드시 `npx tsc --noEmit`으로 TypeScript 오류를 확인한다.**
3. **각 단계 완료 후 서버 재시작 및 화면 정상 작동을 확인한다.**
4. **문제 발생 시 즉시 `webdev_rollback_checkpoint`로 롤백한다.**

### 주석 작성 기준
```typescript
// ─── 섹션 구분 주석 (굵은 구분선) ────────────────────────────────────────

/**
 * 함수/라우터 설명 (JSDoc 형식)
 * @param input - 입력값 설명
 * @returns 반환값 설명
 */

// 인라인 주석: 코드 한 줄의 의도가 불명확할 때만 사용
```

---

## 7. 핵심 파일 역할 요약

| 파일 | 역할 |
|------|------|
| `server/_core/trpc.ts` | publicProcedure, protectedProcedure, adminProcedure, memberProtectedProcedure 정의 |
| `server/_core/context.ts` | 요청마다 ctx.user, ctx.memberId 주입 |
| `drizzle/schema.ts` | DB 테이블 스키마 정의 |
| `server/db/index.ts` | 모든 DB 함수 통합 export (기존 db.ts 역할) |
| `server/routers/index.ts` | appRouter 정의 및 export |
| `client/src/lib/trpc.ts` | 프론트엔드 tRPC 클라이언트 |
| `client/src/App.tsx` | 전체 라우팅 구조 |

---

## 8. 다음 세션 인수인계 체크리스트

새 세션 시작 시 반드시 확인할 사항:

1. `cat /home/ubuntu/joych-homepage/REFACTOR_GUIDE.md` — 이 문서 읽기
2. `cat /home/ubuntu/joych-homepage/todo.md` — 현재 진행 상태 확인
3. `find /home/ubuntu/joych-homepage/server/routers -name "*.ts" | sort` — 분리 완료된 파일 확인
4. `find /home/ubuntu/joych-homepage/server/db -name "*.ts" | sort` — DB 분리 완료된 파일 확인
5. `cd /home/ubuntu/joych-homepage && npx tsc --noEmit` — TypeScript 오류 없는지 확인

---

## 9. 주의사항 및 알려진 이슈

- `server/_core/` 폴더는 절대 수정하지 않는다 (프레임워크 코어)
- `drizzle/schema.ts` 수정 시 반드시 `pnpm db:push` 실행
- 관리자 로그인은 Manus OAuth가 아닌 자체 ID/PW 방식이며, 자격증명은 운영 환경변수에서 관리
- 성도 로그인은 `memberProtectedProcedure` 사용 (ctx.memberId 주입)
- 환경변수는 절대 코드에 하드코딩하지 않는다 (`server/_core/env.ts` 참조)
