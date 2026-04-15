# 기쁨의교회 홈페이지 작업 진행 기록

> 이 문서는 세션이 초기화되어도 연속성을 유지하기 위한 작업 기록입니다.
> 새 세션 시작 시 반드시 이 문서를 먼저 읽고 진행 상황을 파악하세요.
> 마지막 업데이트: 2026년 4월 15일

---

## 프로젝트 기본 정보

| 항목 | 내용 |
|---|---|
| 프로젝트명 | joych-homepage (기쁨의교회 홈페이지) |
| 경로 | /home/ubuntu/joych-homepage |
| 기술 스택 | React 19 + Tailwind 4 + Express + tRPC 11 + MySQL (Drizzle ORM) |
| 주요 도메인 | joychome-kastcrbz.manus.space / dadowoomtest.co.kr |
| 관리자 접근 | /admin (아이디/비밀번호 로그인) |
| 최신 체크포인트 | dece67be |

---

## 관리자 계정 정보

| 항목 | 값 |
|---|---|
| 아이디 | `joyfulchurch` |
| 비밀번호 | `joyfulchurch1!` |
| DB openId | `admin_joyfulchurch` |

> **주의:** 관리자 자격증명은 server/routers.ts에 하드코딩되어 있음. 향후 환경변수로 이동 권장.

---

## 완료된 작업 이력

### 1단계: 기본 홈페이지 UI 완성

완료일: 2026-04-14 이전

기쁨의교회 홈페이지 전체 UI를 구현했습니다. TopBar, Header(GNB), Hero(영상 슬라이드), 퀵메뉴, 조이풀TV, 교회소식, 비전, 갤러리, 관련기관, Footer 섹션이 모두 포함됩니다. 모든 서브 페이지 라우팅(교회소개, 예배, 양육/훈련, 교회학교, 선교보고, 커뮤니티, 행정지원, 시설예약)도 완성했습니다. Noto Serif KR / Noto Sans KR 폰트와 녹색 계열 컬러 테마를 적용했습니다.

---

### 2단계: 백엔드 + DB 기능 추가

완료일: 2026-04-14 | 체크포인트: 12f48fe5

web-db-user 기능을 추가하여 tRPC + MySQL + Manus OAuth 구조를 갖췄습니다. CMS DB 테이블 11개를 생성하고(drizzle/schema.ts + pnpm db:push) 초기 데이터를 입력했습니다(seed.mjs 실행).

**생성된 DB 테이블:**

| 테이블 | 용도 |
|---|---|
| hero_slides | 히어로 영상 슬라이드 |
| notices | 교회 소식 |
| affiliates | 관련 기관 |
| quick_menus | 퀵메뉴 항목 |
| gallery_items | 갤러리 사진 |
| menus | GNB 메뉴 |
| menu_items | 메뉴 하위 항목 |
| sections | 페이지 섹션 |
| sermons | 설교 목록 |
| site_settings | 사이트 기본 정보 |
| users | 사용자 |

---

### 3단계: CMS 백엔드 API + 관리자 대시보드

완료일: 2026-04-14 | 체크포인트: 40d6bf63

server/db.ts에 CMS 쿼리 헬퍼를 추가하고, server/routers.ts에 home.*(공개 API)와 cms.*(관리자 전용 API) 라우터를 추가했습니다. client/src/pages/Home.tsx를 DB 데이터에 연결했으며(trpc.home.* 쿼리 사용, 폴백 데이터 포함), client/src/pages/Admin.tsx에 관리자 대시보드(/admin)를 구현했습니다.

**관리자 대시보드 기능:**
- 교회 소식 CRUD (등록/수정/삭제/게시토글)
- 관련 기관 관리 (수정/표시토글)
- 교회 기본 정보 설정 (12개 항목)

server/cms.test.ts에 CMS 권한 테스트 6개를 작성하여 모두 통과했습니다.

---

### 4단계: 실제 데이터 입력 + 중복 데이터 정리

완료일: 2026-04-14

교회 소식 5개를 실제 데이터로 교체하고, 교회 기본 정보 12개 항목을 업데이트했습니다. seed 스크립트 2회 실행으로 발생한 중복 데이터를 정리했습니다.

**정리된 중복 데이터:**

| 테이블 | 삭제된 ID | 정상 수량 |
|---|---|---|
| gallery_items | id 7~12 삭제 | 6개 |
| quick_menus | id 10~18 삭제 | 9개 |
| affiliates | id 6~10 삭제 | 5개 |
| menus | id 8~14 삭제 | 7개 |
| hero_slides | id 3~4 삭제 | 2개 |

---

### 5단계: 히어로 슬라이드 관리 탭 추가

완료일: 2026-04-14

server/db.ts에 getAllHeroSlides(), updateHeroSlide() 함수를 추가하고, server/routers.ts에 cms.heroSlides.list, cms.heroSlides.update 라우터를 추가했습니다. client/src/pages/Admin.tsx에 HeroSlidesTab 컴포넌트를 추가했습니다.

**HeroSlidesTab 기능:**
- 슬라이드별 표시/숨김 토글
- 연도 라벨, 메인 제목, 부제목, 성경 구절, 버튼1/2 텍스트+링크 수정
- 수정 후 홈페이지 즉시 반영 (trpc invalidate)

WORK_LOG.md 작업 기록 문서도 이 단계에서 최초 생성했습니다.

---

### 6단계: 관리자 로그인 방식 교체

완료일: 2026-04-14

Manus OAuth 방식에서 아이디/비밀번호 방식으로 관리자 로그인을 교체했습니다.

**변경 내용:**
- server/routers.ts: `auth.adminLogin` 뮤테이션 추가 (아이디/비밀번호 검증 + 세션 쿠키 발급)
- server/db.ts: `setUserRole` 함수 추가
- client/src/pages/Admin.tsx: 로그인 화면을 아이디/비밀번호 폼으로 교체
- 관리자 대시보드 헤더에 로그아웃 버튼 추가

---

### 7단계: 메뉴 슬라이드 패널 편집 기능 구현

완료일: 2026-04-14

홈페이지 상단에 관리자 편집 바를 추가하고, 오른쪽에서 슬라이드 방식으로 열리는 메뉴 편집 패널을 구현했습니다.

**변경 내용:**
- dnd-kit 설치 (@dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities) — 드래그 앤 드롭 라이브러리
- client/src/components/MenuEditPanel.tsx 컴포넌트 작성
  - 드래그 앤 드롭으로 메뉴 순서 변경
  - 메뉴 이름/링크 수정
  - 메뉴 추가/삭제/숨기기
  - 변경 즉시 GNB에 실시간 반영
- server/db.ts: createMenu, deleteMenu, reorderMenus 함수 추가
- server/routers.ts: cms.menus.create, cms.menus.delete, cms.menus.reorder API 추가
- Home.tsx 상단에 관리자 편집 바 추가 (관리자 로그인 시만 표시)
  - "메뉴 편집" 버튼 → 오른쪽 슬라이드 패널 열림
  - "관리자 대시보드" 버튼 → /admin 이동

---

### 8단계: 편집 바 로그아웃 버튼 + 4개 편집 패널 추가

완료일: 2026-04-15 | 체크포인트: dece67be

편집 바에 로그아웃 버튼을 추가하고, 나머지 4개 섹션에 대한 인라인 편집 패널을 구현했습니다.

**변경 내용:**

| 항목 | 파일 | 내용 |
|---|---|---|
| 로그아웃 버튼 | Home.tsx | tRPC auth.logout mutation 사용, 편집 바 우측에 빨간 버튼으로 표시 |
| 교회 소식 편집 패널 | NoticeEditPanel.tsx | 소식 목록 표시/숨김 토글, 수정 기능 |
| 슬라이드 편집 패널 | HeroEditPanel.tsx | 히어로 영상 슬라이드 텍스트/버튼 수정, 표시/숨김 토글 |
| 퀵메뉴 편집 패널 | QuickMenuEditPanel.tsx | 9개 퀵메뉴 항목 이름/링크/아이콘 수정, 표시/숨김 토글 |
| 관련기관 편집 패널 | AffiliateEditPanel.tsx | 5개 관련 기관 이름/링크/아이콘 수정, 표시/숨김 토글 |

**추가된 서버 API (server/db.ts + server/routers.ts):**
- `getAllQuickMenus()` — 퀵메뉴 전체 조회 (관리자용)
- `updateQuickMenu()` — 퀵메뉴 항목 수정
- `reorderQuickMenus()` — 퀵메뉴 순서 변경
- `getAllAffiliates()` — 관련 기관 전체 조회 (관리자용)
- `updateAffiliate()` — 관련 기관 수정

**현재 편집 바 버튼 목록 (7개):**

| 버튼 | 기능 |
|---|---|
| 메뉴 편집 | GNB 메뉴 순서/이름/링크 수정 (드래그 앤 드롭) |
| 교회 소식 편집 | 홈페이지 소식 섹션 관리 |
| 슬라이드 편집 | 히어로 영상 슬라이드 텍스트 수정 |
| 퀵메뉴 편집 | 퀵메뉴 9개 항목 수정 |
| 관련기관 편집 | 하단 관련 기관 5개 수정 |
| 관리자 대시보드 | /admin 페이지 이동 |
| 로그아웃 | 관리자 세션 종료 |

---

## 현재 DB 상태 (2026-04-15 기준)

| 테이블 | 데이터 수 | 상태 |
|---|---|---|
| hero_slides | 2개 | 정상 |
| notices | 5개 | 실제 데이터 |
| affiliates | 5개 | 정상 |
| quick_menus | 9개 | 정상 |
| gallery_items | 6개 | 정상 |
| menus | 7개 | 정상 |
| site_settings | 12개 | 실제 데이터 |

---

## 현재 편집 패널 컴포넌트 목록

| 파일 | 위치 | 용도 |
|---|---|---|
| MenuEditPanel.tsx | client/src/components/ | GNB 메뉴 편집 (드래그 앤 드롭) |
| NoticeEditPanel.tsx | client/src/components/ | 교회 소식 편집 |
| HeroEditPanel.tsx | client/src/components/ | 히어로 슬라이드 편집 |
| QuickMenuEditPanel.tsx | client/src/components/ | 퀵메뉴 편집 |
| AffiliateEditPanel.tsx | client/src/components/ | 관련 기관 편집 |

---

## 알려진 이슈 및 주의사항

**TypeScript 에러 13개** — `lib.esnext.d.ts` 파일 누락으로 인한 환경 이슈이며 실제 코드 에러가 아닙니다. 빌드/실행에 영향 없습니다.

**seed 스크립트 중복 실행 금지** — seed 스크립트를 여러 번 실행하면 데이터가 중복 입력됩니다. 반드시 실행 전 기존 데이터를 확인해야 합니다. 데이터 수정 시 UPDATE 쿼리를 사용하세요.

**관리자 자격증명 하드코딩** — 현재 관리자 아이디/비밀번호가 server/routers.ts에 하드코딩되어 있습니다. 향후 환경변수로 이동이 권장됩니다.

---

## 다음 작업 예정

- [ ] 갤러리 편집 패널 추가 (GalleryEditPanel.tsx) — 사진 표시/숨김, 캡션 수정
- [ ] 비전 섹션 편집 패널 — "깊이있는 성장, 위대한 교회" 텍스트 및 3개 카드 DB 관리
- [ ] 사이트 설정 편집 패널 — 교회 주소, 전화번호, SNS 링크 등 푸터 정보 수정
- [ ] 이미지 업로드 기능 (S3 연동) — 갤러리/히어로 이미지 직접 업로드
- [ ] 설교 영상 관리 탭 — 유튜브 URL 연결

---

## 작업 규칙 (반드시 준수)

1. 각 작업 완료 후 브라우저에서 실제 동작을 확인한 뒤 다음 단계를 진행합니다.
2. seed 스크립트 재실행 금지 — 데이터 수정 시 UPDATE 쿼리를 사용합니다.
3. TypeScript 에러 13개는 환경 이슈(lib.esnext.d.ts 누락)이며 실제 코드 에러가 아닙니다.
4. 작업 완료 시 이 문서(WORK_LOG.md)와 todo.md를 반드시 업데이트합니다.
5. 큰 작업 전에는 반드시 체크포인트를 저장합니다.
6. 문제가 발생하면 즉시 이전 체크포인트로 롤백하고 원인을 파악한 뒤 진행합니다.
