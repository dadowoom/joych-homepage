# 기쁨의교회 홈페이지 인증 시스템 구조 문서

> 작성일: 2026-04-17  
> 목적: 인증 시스템 구조 파악 및 안전한 전환 작업을 위한 기준 문서

---

## 1. 인증 시스템 개요

이 프로젝트에는 **두 가지 독립된 인증 시스템**이 공존합니다.

| 구분 | 이름 | 쿠키 이름 | 용도 |
|---|---|---|---|
| **시스템 A** | Manus OAuth | `manus_session` (JWT) | 관리자(어드민) 전용 |
| **시스템 B** | 성도 로그인 | `church_member_session` (JWT) | 교회 성도 전용 |

### 핵심 원칙 (2026-04-17 확정)
- **성도가 사용하는 모든 기능**은 시스템 B(`church_member_session`) 기반으로 동작해야 합니다.
- **관리자 전용 기능**(CMS, 예약 승인/거절 등)은 시스템 A(Manus OAuth) 기반을 유지합니다.
- 두 시스템은 서로 **완전히 분리**되어야 하며, 성도 기능에 Manus OAuth가 개입해서는 안 됩니다.

---

## 2. 시스템 A — Manus OAuth (관리자 전용)

### 동작 방식
1. 관리자가 Manus 계정으로 OAuth 로그인
2. `/api/oauth/callback`에서 세션 쿠키 발급
3. `server/_core/context.ts`의 `sdk.authenticateRequest(req)`로 `ctx.user` 설정
4. `protectedProcedure` / `adminProcedure`로 보호된 API 접근 가능

### 관련 파일
- `server/_core/oauth.ts` — OAuth 콜백 처리
- `server/_core/sdk.ts` — JWT 검증 및 `ctx.user` 설정
- `server/_core/context.ts` — 요청마다 `ctx.user` 주입
- `server/_core/trpc.ts` — `protectedProcedure`, `adminProcedure` 정의

### 사용 범위 (변경 금지)
- `adminProcedure`: CMS 전체 (공지사항, 시설 관리, 갤러리, 메뉴 편집 등)
- `adminProcedure`: 예약 승인/거절/목록 조회 (관리자 대시보드)
- `Admin.tsx` 페이지의 `useAuth()` 훅

---

## 3. 시스템 B — 성도 로그인 (성도 전용)

### 동작 방식
1. 성도가 이메일/비밀번호로 `/member/login` 페이지에서 로그인
2. `server/routers.ts`의 `members.login` 뮤테이션에서 JWT 생성 후 `church_member_session` 쿠키 발급
3. 이후 요청에서 `church_member_session` 쿠키를 직접 파싱하여 성도 정보 추출
4. `members.me` 쿼리로 프론트엔드에서 로그인 상태 확인

### 쿠키 설정 (2026-04-17 변경)
- `maxAge` 없음 (세션 쿠키) → 브라우저 닫으면 자동 삭제
- JWT 만료: 24시간 (열려있는 동안만 유지)

### 관련 파일
- `server/routers.ts` → `members` 라우터
  - `members.register` — 성도 가입
  - `members.login` — 성도 로그인 (쿠키 발급)
  - `members.logout` — 성도 로그아웃 (쿠키 삭제)
  - `members.me` — 현재 로그인 성도 정보 조회
  - `members.updateMyInfo` — 내 정보 수정

### 사용 범위 (성도 기능)
- 헤더 로그인 상태 표시
- 시설 예약 신청 (`FacilityApply.tsx`)
- 내 예약 목록 (`MyReservations.tsx`)
- 내 정보 페이지

---

## 4. DB 테이블 연관 관계

```
church_members (성도 계정)
  id (PK)
  email, passwordHash
  name, phone, department ...

reservations (시설 예약)
  id (PK)
  facilityId → facilities.id
  userId → ⚠️ 현재 users.id 참조 (Manus OAuth 사용자)
             → 변경 필요: church_members.id 참조로 전환
  reserverName, reserverPhone
  reservationDate, startTime, endTime
  status: pending / approved / rejected / cancelled
```

### ⚠️ 현재 문제점
`reservations.userId`가 `users` 테이블(Manus OAuth)을 참조하도록 설계되어 있습니다.  
성도 로그인으로 예약 시 `church_members.id`를 `userId`에 저장해야 하지만,  
서버 프로시저가 `protectedProcedure`(Manus OAuth)로 보호되어 있어 성도 로그인으로는 API 호출 자체가 실패합니다.

---

## 5. 전환 계획 (안전한 단계별 접근)

### 5-1. 새로운 `memberProtectedProcedure` 도입

`server/_core/trpc.ts`에 성도 쿠키 기반 미들웨어를 추가합니다.  
기존 `protectedProcedure`(Manus OAuth)는 **절대 수정하지 않습니다.**

```typescript
// server/_core/trpc.ts에 추가
export const memberProtectedProcedure = t.procedure.use(
  t.middleware(async ({ ctx, next }) => {
    const token = ctx.req.cookies?.['church_member_session'];
    if (!token) throw new TRPCError({ code: 'UNAUTHORIZED', message: '로그인이 필요합니다.' });
    // JWT 검증 → memberId 추출
    // ctx.memberId 주입
    return next({ ctx: { ...ctx, memberId } });
  })
);
```

### 5-2. 시설 예약 API 전환 대상

| 프로시저 | 현재 | 변경 후 |
|---|---|---|
| `home.createReservation` | `protectedProcedure` (Manus) | `memberProtectedProcedure` (성도) |
| `home.myReservations` | `protectedProcedure` (Manus) | `memberProtectedProcedure` (성도) |
| `home.cancelReservation` | `protectedProcedure` (Manus) | `memberProtectedProcedure` (성도) |

### 5-3. reservations.userId 처리 방식

`reservations.userId` 컬럼은 현재 `users.id`(Manus) 참조이지만,  
실제로는 외래키 제약이 없으므로 `church_members.id` 값을 그대로 저장해도 DB 오류는 발생하지 않습니다.  
단, 의미상 혼동을 방지하기 위해 향후 `memberId` 컬럼으로 마이그레이션을 권장합니다.  
**현재 단계에서는 userId에 church_members.id를 저장하는 방식으로 진행합니다.**

### 5-4. 프론트엔드 MyReservations.tsx 전환

`useAuth()`(Manus OAuth) → `trpc.members.me.useQuery()`(성도 로그인)로 변경

---

## 6. 변경하지 않는 영역 (위험 구역)

다음 항목은 **절대 수정하지 않습니다:**

- `server/_core/context.ts` — Manus OAuth ctx.user 설정 로직
- `server/_core/oauth.ts` — OAuth 콜백 처리
- `server/_core/sdk.ts` — Manus JWT 검증
- `adminProcedure` 사용 프로시저 전체 (CMS 기능)
- `Admin.tsx`의 `useAuth()` 사용

---

## 7. 작업 이력

| 날짜 | 내용 |
|---|---|
| 2026-04-17 | 시설 예약 시간 슬롯 드롭다운 → 버튼 방식으로 전환 |
| 2026-04-17 | 예약 불가 슬롯 툴팁 추가 |
| 2026-04-17 | 시간 단위 slotMinutes 연동, 종료 시간 포함 버그 수정 |
| 2026-04-17 | FacilityApply 로그인 체크 → members.me 방식으로 변경 |
| 2026-04-17 | 성도 로그인 쿠키 → 세션 쿠키 방식으로 변경 (브라우저 닫으면 자동 로그아웃) |
| 2026-04-17 | **진행 예정**: 시설 예약 API를 성도 인증 기반으로 전환 |
