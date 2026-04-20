# 작업 세션 인수인계 문서

> **이 문서의 목적:** AI 세션이 초기화되거나 새로운 작업자(개발자/AI)가 투입될 때, 현재 상태와 다음 작업을 즉시 파악할 수 있도록 한다.
>
> **업데이트 규칙:** 매 작업 세션 종료 전 반드시 이 문서를 갱신한다.
>
> **최종 업데이트:** 2026-04-20

---

## 현재 프로젝트 상태 (한 줄 요약)

> **"기능 구현 70% 완료, 코드 품질 54점. 긴급 개선 항목 3개 남음."**

---

## 즉시 파악해야 할 핵심 사항

### 1. 프로젝트 성격

이 프로젝트는 기쁨의교회(경기도 소재) 공식 홈페이지다. 단순 정보 제공 사이트가 아니라 **성도 관리, 시설 예약, 콘텐츠 관리가 통합된 플랫폼**이다. 향후 믿음PLUS 모바일 앱과 연동 예정이다.

### 2. 두 가지 인증 시스템이 공존한다

이 프로젝트에는 **완전히 독립된 두 개의 인증 시스템**이 있다. 혼동하면 안 된다.

| 시스템 | 대상 | 인증 방식 | 쿠키 이름 | 코드 위치 |
|---|---|---|---|---|
| **Manus OAuth** | 관리자 | Manus 플랫폼 OAuth | `manus_session` | `server/_core/oauth.ts` |
| **자체 관리자 로그인** | 관리자 | ID/PW (환경변수) | `manus_session` | `server/routers/auth.ts` |
| **성도 자체 로그인** | 교인 | 이메일 + 비밀번호 | `church_member_session` | `server/routers/members.ts` |

> **주의:** 관리자는 Manus OAuth 또는 자체 ID/PW 중 하나로 로그인한다. 성도는 완전히 별개의 `church_members` 테이블을 사용하며 `church_member_session` 쿠키를 사용한다.

### 3. 권한 체계 (4단계)

```
publicProcedure          → 누구나 접근 가능
memberProtectedProcedure → 승인된 성도만 접근 가능 (church_member_session 쿠키)
protectedProcedure       → Manus OAuth 로그인 사용자
adminProcedure           → 관리자만 접근 가능 (users.role = 'admin')
```

### 4. 환경변수 (외부 서버 이전 시 필수)

| 변수명 | 설명 | 필수 여부 |
|---|---|---|
| `DATABASE_URL` | MySQL 연결 문자열 | ✅ 필수 |
| `JWT_SECRET` | 세션 서명 키 | ✅ 필수 |
| `ADMIN_USERNAME` | 관리자 로그인 ID | ✅ 필수 |
| `ADMIN_PASSWORD` | 관리자 로그인 PW | ✅ 필수 |
| `ADMIN_OPEN_ID` | 관리자 DB 식별자 | ✅ 필수 |
| `VITE_APP_ID` | Manus OAuth App ID | Manus 플랫폼 전용 |
| `OAUTH_SERVER_URL` | Manus OAuth 서버 URL | Manus 플랫폼 전용 |

자세한 내용은 `ENV_SETUP.md` 참조.

---

## 코드베이스 구조 (핵심 파일만)

```
server/
  routers/
    auth.ts          ← 관리자 로그인 (ID/PW, Manus OAuth)
    members.ts       ← 성도 회원가입/로그인/관리 (352줄)
    home.ts          ← 홈페이지 공개 데이터 API
    youtube.ts       ← 예배영상 API
    cms/             ← 관리자 CMS API (콘텐츠, 메뉴, 시설, 예약 등)
  db/
    user.ts          ← 사용자 DB 함수
    member.ts        ← 성도 DB 함수
    facility.ts      ← 시설 예약 DB 함수
    content.ts       ← 히어로/갤러리/설정 DB 함수
    menu.ts          ← 메뉴 구조 DB 함수
    notice.ts        ← 공지사항 DB 함수
    blocks.ts        ← 블록 에디터 DB 함수
    youtube.ts       ← 예배영상 DB 함수
  _core/
    trpc.ts          ← 권한 체계 정의 (4단계)
    env.ts           ← 환경변수 중앙 관리

client/src/
  pages/
    Home.tsx         ← 메인 홈페이지 (747줄)
    Admin.tsx        ← 관리자 페이지 (338줄)
    DynamicPage.tsx  ← CMS 동적 페이지 (203줄)
    FaithData.tsx    ← 성도 명부 (교인 전용)
    FacilityApply.tsx← 시설 예약 신청
  components/
    menu-edit/       ← 메뉴 편집 패널 서브 컴포넌트 (6개)
    dynamic-page/    ← 동적 페이지 서브 컴포넌트 (7개)
    admin/           ← 관리자 탭 서브 컴포넌트
    SiteHeader.tsx   ← 사이트 헤더 + GNB
    SubPageLayout.tsx← 서브페이지 공통 레이아웃

drizzle/
  schema.ts          ← DB 테이블 정의 전체 (695줄)
```

---

## 다음 세션에서 할 작업 (우선순위 순)

### 🔴 1순위: `as any` 34개 제거 (코드 품질)

**왜 급한가:** TypeScript를 쓰는 의미가 없어진다. 런타임 오류의 온상이다.

**방법:**
```bash
# 위치 확인
grep -rn "as any" client/src/ --include="*.tsx" | grep -v "node_modules"
```

주요 위치:
- `AdminFacilitiesTab.tsx` — `facilities: any[]`, `reservations: any[]`
- `AdminReservationsTab.tsx` — 예약 데이터 타입 없음
- `FacilityApply.tsx` — 폼 데이터 타입 없음

**수정 방법:** 각 위치에서 실제 Drizzle 타입(`ChurchMember`, `Reservation`, `Facility` 등)을 import하여 교체.

### 🔴 2순위: 파일 업로드 서버 검증 추가 (보안)

**왜 급한가:** 현재 어떤 파일이든 업로드 가능하다.

**위치:** `server/routers/cms/upload.ts`

**수정 방법:**
```typescript
// 허용 MIME 타입 검증 추가
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm'];
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_VIDEO_SIZE = 500 * 1024 * 1024; // 500MB
```

### 🟡 3순위: 빈 catch 블록 수정 (코드 품질)

**위치 확인:**
```bash
grep -rn "catch.*{}" server/ client/src/ --include="*.ts" --include="*.tsx"
```

**수정 방법:** 최소한 `console.error(e)` 또는 적절한 TRPCError throw로 교체.

### 🟡 4순위: 갤러리 사진 교체 버그 수정

**증상:** 관리자 패널에서 갤러리 사진 교체 후 반영이 안 됨.

**원인 추정:** `trpc.cms.content.gallery.update` 성공 후 `invalidate` 누락.

**위치:** `client/src/components/admin/` 또는 `HeroEditPanel.tsx` 관련 갤러리 탭

### 🟡 5순위: 블록 에디터 저장 후 자동 갱신

**증상:** 블록 에디터에서 저장 후 페이지가 자동으로 갱신되지 않음.

**위치:** `client/src/components/dynamic-page/BlockEditDialog.tsx`

**수정 방법:** 저장 성공 후 `utils.home.menuItemByHref.invalidate()` 또는 `utils.home.invalidate()` 호출.

---

## 알려진 버그 목록

| 번호 | 증상 | 원인 추정 | 위치 | 우선순위 |
|---|---|---|---|---|
| BUG-01 | 갤러리 사진 교체 안 됨 | invalidate 누락 | 관리자 갤러리 탭 | 🟡 중요 |
| BUG-02 | 블록 에디터 저장 후 미갱신 | invalidate 누락 | BlockEditDialog.tsx | 🟡 중요 |

---

## 미완성 기능 목록

| 기능 | 상태 | 예상 작업량 |
|---|---|---|
| 카카오 소셜 로그인 | ❌ 미구현 | 중간 (카카오 개발자 계정 필요) |
| 비밀번호 찾기/재설정 | ❌ 미구현 | 작음 (이메일 발송 API 필요) |
| 회원 탈퇴 | ❌ 미구현 | 작음 |
| 핵심 라우터 테스트 코드 | ❌ 미구현 | 중간 |
| 포인트/달란트 시스템 | ❌ 미구현 | 큼 (3차 확장 단계) |
| 결제 시스템 (헌금/시설) | ❌ 미구현 | 큼 (PG 연동 필요) |

---

## 작업 이력 요약

| 날짜 | 주요 작업 | 체크포인트 |
|---|---|---|
| 2026-04-20 | server/db/ 폴더 분리 (9개 파일), TypeScript 오류 13개 수정 | `4657e7d8` |
| 2026-04-20 | 문서 정비 (README, HANDOVER, DEPLOYMENT, ENV_SETUP), 보안 강화 (관리자 PW 환경변수 이전), 코드 분리 (MenuEditPanel, DynamicPage, Admin) | `6a38ddd9` |
| 2026-04-20 | PROJECT_DIRECTION.md 작성, WORK_SESSION.md 작성 | (현재 세션) |

---

## 작업 시 주의사항

1. **DB 스키마 변경 시 반드시 `pnpm db:push` 실행** — 스키마 파일만 수정하면 실제 DB에 반영되지 않는다.
2. **환경변수 추가 시 `server/_core/env.ts`에도 추가** — 코드에서 직접 `process.env.*`를 쓰지 않는다.
3. **새 기능 추가 시 `todo.md`에 먼저 기록** — 작업 전 계획 수립이 원칙이다.
4. **큰 작업 전 체크포인트 저장** — 롤백 가능한 상태를 유지한다.
5. **TypeScript 오류 0개 유지** — 작업 후 반드시 `npx tsc --noEmit` 확인.

---

## 관련 문서 목록

| 문서 | 목적 |
|---|---|
| `README.md` | 프로젝트 개요 및 빠른 시작 가이드 |
| `PROJECT_DIRECTION.md` | 방향성 및 기능 현황 (이 문서와 함께 읽어야 함) |
| `HANDOVER.md` | 외부 업체 인수인계 전용 |
| `DEPLOYMENT.md` | 외부 서버 이전 단계별 가이드 |
| `ENV_SETUP.md` | 환경변수 설정 가이드 |
| `DEVELOPMENT_RULES.md` | 개발 규칙 및 코딩 컨벤션 |
| `DB_DESIGN.md` | DB 설계 문서 |
| `todo.md` | 전체 작업 현황 (완료/미완료) |
