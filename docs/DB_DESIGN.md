# 기쁨의교회 홈페이지 DB 설계 문서

> 작성일: 2026-04-16  
> 대상 규모: 성도 약 3,000명  
> DB 엔진: MySQL (TiDB 호환)  
> ORM: Drizzle ORM

---

## 1. 설계 원칙

3,000명이 사용하는 교회 시스템은 단순한 웹사이트가 아닙니다. 성도의 개인정보, 직분, 세례 기록 등 민감한 데이터를 장기간 안전하게 보관해야 하며, 관리자가 언제든지 정확하게 조회·수정할 수 있어야 합니다. 이를 위해 다음 원칙을 적용합니다.

**컬럼명 규칙**: 모든 DB 컬럼은 `snake_case`(소문자 + 언더스코어)로 통일합니다. Drizzle ORM이 TypeScript에서는 camelCase로 자동 변환하므로, 코드와 DB 양쪽에서 혼란 없이 사용할 수 있습니다.

**타임스탬프 규칙**: 모든 테이블에 `created_at`(생성일시), `updated_at`(수정일시)을 포함합니다. 데이터 추적과 감사(audit)에 필수적입니다.

**소프트 삭제(Soft Delete)**: 성도 데이터는 실제로 삭제하지 않습니다. `status` 컬럼으로 상태를 관리하여 탈퇴 후에도 이력을 보존합니다.

**인덱스 전략**: 자주 검색하는 컬럼(이메일, 이름, 상태, 부서)에 인덱스를 추가하여 3,000명 데이터에서도 빠른 조회를 보장합니다.

---

## 2. 테이블 목록 및 역할

| 테이블명 | 역할 | 예상 레코드 수 |
|---------|------|-------------|
| `church_members` | 성도 회원 정보 (핵심 테이블) | ~3,000 |
| `member_field_options` | 직분/부서/구역/세례 선택지 목록 | ~50 |
| `facilities` | 시설 정보 (본당, 소강당 등) | ~20 |
| `facility_images` | 시설 사진 | ~100 |
| `facility_hours` | 시설별 운영 시간 | ~100 |
| `facility_blocked_dates` | 시설 휴무/차단 날짜 | ~200/년 |
| `reservations` | 시설 예약 신청 | ~5,000/년 |
| `users` | 관리자 계정 (Manus OAuth) | ~10 |

---

## 3. 핵심 테이블 상세 설계

### 3-1. `church_members` — 성도 회원 테이블

이 테이블이 전체 시스템의 핵심입니다. 성도가 직접 입력하는 정보와 관리자가 입력하는 교회 공식 정보를 명확히 구분하여 설계합니다.

| 컬럼명 | 타입 | 필수 | 기본값 | 설명 | 입력자 |
|--------|------|------|--------|------|--------|
| `id` | INT AUTO_INCREMENT | ✓ | — | 고유 식별자 (PK) | 자동 |
| `email` | VARCHAR(128) UNIQUE | — | NULL | 로그인 이메일 | 성도 |
| `password_hash` | VARCHAR(256) | — | NULL | bcrypt 암호화 비밀번호 | 성도 |
| `name` | VARCHAR(64) | ✓ | — | 성도 실명 | 성도 |
| `phone` | VARCHAR(32) | — | NULL | 연락처 (010-XXXX-XXXX) | 성도 |
| `birth_date` | VARCHAR(16) | — | NULL | 생년월일 (YYYY-MM-DD) | 성도 |
| `gender` | VARCHAR(8) | — | NULL | 성별 (남/여) | 성도 |
| `address` | VARCHAR(256) | — | NULL | 주소 | 성도 |
| `emergency_phone` | VARCHAR(32) | — | NULL | 비상연락처 | 성도 |
| `join_path` | VARCHAR(64) | — | NULL | 가입 경로 | 성도 |
| `position` | VARCHAR(64) | — | NULL | 직분 (집사/권사/장로 등) | 관리자 |
| `department` | VARCHAR(64) | — | NULL | 소속 부서 (청년부/아동부 등) | 관리자 |
| `district` | VARCHAR(64) | — | NULL | 구역/순 | 관리자 |
| `baptism_type` | VARCHAR(32) | — | NULL | 세례 구분 (세례/학습/미세례) | 관리자 |
| `baptism_date` | VARCHAR(16) | — | NULL | 세례일 (YYYY-MM-DD) | 관리자 |
| `registered_at` | VARCHAR(16) | — | NULL | 교회 등록일 (YYYY-MM-DD) | 관리자 |
| `pastor` | VARCHAR(64) | — | NULL | 담당 교역자 | 관리자 |
| `admin_memo` | TEXT | — | NULL | 관리자 전용 메모 (성도에게 비공개) | 관리자 |
| `status` | ENUM | ✓ | 'pending' | 가입 상태 | 관리자 |
| `faith_plus_user_id` | INT | — | NULL | 믿음PLUS 앱 연동 ID | 시스템 |
| `created_at` | TIMESTAMP | ✓ | NOW() | 가입 신청일시 | 자동 |
| `updated_at` | TIMESTAMP | ✓ | NOW() | 최종 수정일시 | 자동 |

**`status` 값 정의:**

| 값 | 의미 | 설명 |
|----|------|------|
| `pending` | 대기 | 가입 신청 후 관리자 승인 전 |
| `approved` | 승인 | 정식 성도 등록 완료 |
| `rejected` | 거절 | 관리자가 가입 거절 |
| `withdrawn` | 탈퇴 | 성도 탈퇴 (데이터 보존) |

**인덱스:**
- `email` — UNIQUE INDEX (로그인 시 빠른 조회)
- `name` — INDEX (이름 검색)
- `status` — INDEX (승인 대기 목록 조회)
- `department` — INDEX (부서별 조회)

---

### 3-2. `member_field_options` — 선택지 관리 테이블

관리자가 직접 만드는 직분/부서/구역/세례 선택지 목록입니다. 교회마다 다른 이름을 사용하므로 하드코딩 없이 DB에서 관리합니다.

| 컬럼명 | 타입 | 필수 | 설명 |
|--------|------|------|------|
| `id` | INT AUTO_INCREMENT | ✓ | 고유 식별자 (PK) |
| `field_type` | VARCHAR(32) | ✓ | 분류 (position/department/district/baptism) |
| `label` | VARCHAR(64) | ✓ | 표시 이름 (예: "청년부", "1구역") |
| `sort_order` | INT | ✓ | 정렬 순서 |
| `is_active` | BOOLEAN | ✓ | 활성화 여부 (비활성화 시 선택지에서 숨김) |
| `created_at` | TIMESTAMP | ✓ | 생성일시 |
| `updated_at` | TIMESTAMP | ✓ | 수정일시 |

---

## 4. 현재 문제 및 해결 방안

### 문제 발생 경위

초기 개발 과정에서 마이그레이션이 여러 번 실행되면서 `church_members` 테이블에 다음과 같은 문제가 발생했습니다.

- **중복 컬럼**: `faithPlusUserId`(구버전 camelCase)와 `faith_plus_user_id`(정식 snake_case)가 동시 존재
- **구버전 컬럼**: `age`, `ministry`, `isActive`, `registeredAt` 등 구버전 컬럼이 남아있음
- **타임스탬프 불일치**: `createdAt`(camelCase)와 `created_at`(snake_case)가 동시 존재

이로 인해 Drizzle ORM이 쿼리 실행 시 스키마와 실제 DB 구조 불일치로 에러가 발생했습니다.

### 해결 방안

1단계로 중복/구버전 컬럼을 삭제하고, 2단계로 `pnpm db:push`를 실행하여 `schema.ts`와 DB를 완전히 일치시킵니다. 기존 데이터(이미 저장된 성도 정보)는 보호됩니다.

---

## 5. 향후 확장 계획

현재 구조는 다음 기능을 추가할 때도 무리 없이 확장 가능합니다.

| 기능 | 추가 테이블 | 비고 |
|------|------------|------|
| 헌금 관리 | `offerings` | 성도 ID 외래키 연결 |
| 소그룹(순) 관리 | `small_groups`, `small_group_members` | 다대다 관계 |
| 출석 관리 | `attendance_records` | 날짜 + 성도 ID |
| 공지사항/게시판 | `posts`, `post_categories` | 이미 일부 구현됨 |
| 믿음PLUS 앱 연동 | `faith_plus_user_id` 컬럼 활용 | 이미 설계됨 |

---

## 6. 작업 이력

| 날짜 | 작업 내용 | 담당 |
|------|----------|------|
| 2026-04-15 | 초기 church_members 테이블 생성 | Manus |
| 2026-04-15 | member_field_options 테이블 생성 | Manus |
| 2026-04-16 | 중복 컬럼 발견 및 1차 정리 (age, ministry, isActive, faithPlusUserId, registeredAt 삭제) | Manus |
| 2026-04-16 | DB 구조 심층 재설계 및 문서화 | Manus |
| 2026-04-16 | createdAt/updatedAt → created_at/updated_at 정규화 | Manus |
