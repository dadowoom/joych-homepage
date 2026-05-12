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
| 비밀번호 | 운영 환경변수 `ADMIN_PASSWORD` 사용 |
| DB openId | `admin_joyfulchurch` |

> **주의:** 관리자 자격증명은 운영 환경변수로 관리하며, 실제 값은 문서나 저장소에 기록하지 않는다.

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

---

## 9단계: 메뉴 편집 패널 3단 구조 확장 + 버그 수정

완료일: 2026-04-15

**변경 내용:**
- DB에 `menu_sub_items` 테이블 추가 (3단 메뉴 지원)
- 서버 API에 3단 메뉴 CRUD 추가 (getSubItems, createSubItem, updateSubItem, deleteSubItem)
- 헤더 GNB에 3단 드롭다운 표시 (2단 hover 시 3단 옆으로 펼쳐짐)
- 편집 모드 메뉴 편집 패널을 3단 구조로 확장 (3컬럼 나란히 배치)
- 각 메뉴 항목에 `pageType` 설정 가능 (image/gallery/board/youtube/editor)
- DB `menu_items` 테이블에 `pageType` 컬럼 추가

**버그 수정:**
- 메뉴 편집 패널 화면 넘침 문제 해결 (3컬럼 나란히 배치, 고정 높이 스크롤)
- 메뉴 편집 패널 1단 이름 잘림 수정
- 헤더 GNB 드롭다운 하위 메뉴 안 보이는 문제 수정 (opacity/visibility 방식으로 CSS 변경)

---

## 10단계: 콘텐츠 교체 + 신앙 데이터 기능

완료일: 2026-04-15

**변경 내용:**
- 히어로 영상 4개 교체 (CDN 업로드: church-video-01~04.mp4)
- 조이풀TV 섹션 유튜브 영상 연결 (https://www.youtube.com/watch?v=WmFzWf5uEzI)
- 헤더 로고 이미지 교체 (베이직-심볼로고조합수정.jpg)
- 파비콘 교체 (01.ico)
- 갤러리 사진 5장 추가 (전경 3장 + 내부 2장)
- 비전 섹션 배경 사진 교체 (_MG_1172.webp)
- 담임목사 프로필 사진 교체 (KakaoTalk_20250804_163350120_25.jpg)
- 헤더 GNB에 신앙 데이터 검색창 추가 (로고와 메뉴 사이, PC/모바일 반응형)
- /faith-data 페이지 제작 (faithplus API 연동)
- /church-directory 교적부 페이지 제작

---

## 11단계: 모든 편집 패널 헤더 겹침 문제 수정

완료일: 2026-04-16 | 체크포인트: 53f57de1

**문제:** 모든 편집 패널이 헤더(편집바+헤더)에 겹쳐서 상단 내용이 가려지는 문제

**원인 분석:**
- 편집바 높이: 40px (position: sticky, z-index: 100)
- 헤더 높이: 72px (position: sticky, top: 0, z-index: 150)
- 헤더는 sticky top-0이므로 편집바 아래 72px 지점에서 시작
- 실제 헤더 하단 위치: 40 + 32(sticky offset) + 72 = 144px
- 기존 패널 top 값: 112px → 헤더에 32px 가려짐

**수정 내용:**
- 모든 편집 패널 SheetContent에 `top: 144px`, `height: calc(100vh - 144px)` 일괄 적용
  - MenuEditPanel.tsx (메뉴 편집)
  - NoticeEditPanel.tsx (교회 소식 편집)
  - HeroEditPanel.tsx (슬라이드 편집)
  - QuickMenuEditPanel.tsx (퀵메뉴 편집)
  - AffiliateEditPanel.tsx (관련기관 편집)

---

## 다음 단계 작업 계획 (2026-04-16 기준)

### 단계 1: 히어로 영상 파일 업로드 기능 (진행 예정)
- 서버에 영상 파일 업로드 API 추가 (S3 storagePut 연동, multipart/form-data)
- HeroEditPanel에 파일 선택 버튼 + 업로드 진행률 표시 UI 추가
- 업로드 완료 후 hero_slides DB의 videoUrl 자동 갱신

### 단계 2: 교회소식 썸네일 이미지 파일 업로드 기능 (진행 예정)
- NoticeEditPanel에 이미지 파일 선택 버튼 + 미리보기 UI 추가
- 업로드 완료 후 notices DB의 thumbnailUrl 자동 갱신

### 단계 3: 하위메뉴 클릭 시 실제 페이지 표시 (진행 예정)
- pageType별 페이지 컴포넌트 구현 (image/gallery/board/youtube/editor)
- 하위메뉴 링크 클릭 시 `/page/:menuId` 형태로 라우팅
- 각 페이지에서 menuId로 DB 조회 → pageType에 맞는 UI 렌더링

---

## 패널 top 값 기준 (중요)

편집바(40px) + 헤더 sticky offset(32px) + 헤더 높이(72px) = **144px**

모든 편집 패널의 SheetContent에 반드시 아래 스타일을 적용해야 합니다:
```tsx
style={{ top: "144px", height: "calc(100vh - 144px)" }}
```

새 편집 패널을 추가할 때도 동일하게 적용해야 합니다.

---

## 12단계: 히어로 영상/교회소식 이미지 파일 업로드 + 하위메뉴 동적 페이지 연결

완료일: 2026-04-16 | 체크포인트: ca4d7156

**변경 내용:**

| 항목 | 파일 | 내용 |
|---|---|---|
| 영상 업로드 API | server/routers.ts | Base64 방식으로 영상 파일 수신 → S3 업로드 → CDN URL 반환 |
| 히어로 영상 업로드 UI | HeroEditPanel.tsx | 파일 선택 버튼 + 업로드 진행 표시 + 완료 후 DB 갱신 |
| 이미지 업로드 UI | NoticeEditPanel.tsx | 이미지 파일 선택 + 미리보기 + 업로드 후 thumbnailUrl 갱신 |
| 동적 페이지 라우팅 | DynamicPage.tsx | pageType별 페이지 표시 (image/gallery/board/youtube/editor) |
| 자동 href 생성 | server/routers.ts | 메뉴 추가 시 /page/item/:id 또는 /page/sub/:id 자동 설정 |
| DB href 일괄 업데이트 | node 스크립트 | href=null인 기존 항목 → /page/sub/:id 형태로 업데이트 |

---

## 13단계: 동적 페이지 공통 레이아웃 (헤더+푸터+사이드메뉴+브레드크럼)

완료일: 2026-04-16 | 체크포인트: 2f46d393

**변경 내용:**

| 항목 | 파일 | 내용 |
|---|---|---|
| 공통 레이아웃 | SubPageLayout.tsx | 헤더(로고+GNB+검색)+브레드크럼+사이드메뉴+푸터 |
| 동적 페이지 개편 | DynamicPage.tsx | SubPageLayout 적용, DB에서 메뉴 구조 읽어 사이드메뉴 자동 구성 |

**SubPageLayout 주요 기능:**
- 로고 클릭 시 홈으로 이동
- GNB 드롭다운 메뉴 (DB에서 실시간 로드)
- 브레드크럼: 홈 > 상위메뉴 > 현재메뉴
- 좌측 사이드 메뉴: 같은 카테고리 항목 목록, 현재 페이지 강조
- 푸터: 주소/전화/SNS

---

## 14단계: 사이트맵 페이지 추가

완료일: 2026-04-16 | 체크포인트: e4221045

**변경 내용:**
- `/sitemap` 페이지 추가 (Sitemap.tsx)
- DB에서 전체 메뉴 구조 읽어 카드 형태로 표시
- 홈 푸터에 사이트맵 링크 추가
- 자주 찾는 페이지 빠른 링크 섹션 추가

---

## 15단계: 시설 예약 시스템 DB 설계 및 서버 API 구현

완료일: 2026-04-16

**DB 스키마 추가 (drizzle/schema.ts):**

| 테이블 | 용도 |
|---|---|
| facilities | 시설 기본 정보 (이름, 설명, 수용인원, 위치, 예약단위, 요금 등) |
| facility_images | 시설 사진 (여러 장, 썸네일 지정) |
| facility_hours | 요일별 운영 시간 (오픈/마감/휴식시간/휴무일) |
| facility_blocked_dates | 예약 불가 날짜 (공휴일, 교회 행사 등) |
| reservations | 예약 신청 (신청자 정보, 날짜, 시간, 상태) |
| reservation_slots | 예약 시간 슬롯 (1시간 단위) |

**서버 API (routers.ts):**
- 관리자: 시설 CRUD, 이미지 업로드, 운영시간 설정, 예약 승인/거절/취소
- 성도: 시설 목록/상세/이미지/운영시간/예약 가능 날짜 조회, 예약 신청

**성도 측 페이지 현황:**
- FacilityList.tsx — 실제 DB API 연결 완료 ✅
- FacilityDetail.tsx — 실제 DB API 연결 완료 (달력, 운영시간, 이미지 갤러리) ✅
- FacilityApply.tsx — ⚠️ 아직 목 데이터 사용 중 (다음 작업)
- MyReservations.tsx — ⚠️ 미구현

**관리자 측 페이지:**
- FacilityAdmin.tsx — ⚠️ 미구현
- ReservationAdmin.tsx — ⚠️ 미구현

---

## 현재 진행 중인 작업 (2026-04-16)

### 시설 예약 시스템 완성

**남은 작업 순서:**
1. FacilityApply.tsx — 실제 DB API 연결 (시간 슬롯 동적 생성, 예약 신청 저장)
2. MyReservations.tsx — 내 예약 현황 페이지 (/facility/my-reservations)
3. 관리자 시설 관리 페이지 — 시설 등록/수정/이미지 업로드/운영시간 설정
4. 관리자 예약 승인/거절 페이지 — 예약 목록, 달력 현황

---

## 청년 피드백 (미처리 항목)

1. **GNB 메뉴명 일치 검토** — 홈 화면 퀵메뉴와 GNB 메뉴명이 다른 항목 정리
   - 예: "시설사용예약" (퀵메뉴) vs "시설물 안내" (GNB)
2. **사이트맵 추가** — ✅ 완료 (14단계)

---

## 주요 파일 구조 (최신)

```
client/src/
  pages/
    Home.tsx              ← 메인 홈페이지
    DynamicPage.tsx       ← 동적 하위메뉴 페이지 (pageType별)
    Sitemap.tsx           ← 사이트맵 페이지
    FacilityList.tsx      ← 시설 목록 (DB 연결 완료)
    FacilityDetail.tsx    ← 시설 상세+달력 (DB 연결 완료)
    FacilityApply.tsx     ← 예약 신청 폼 (⚠️ 목 데이터)
    admin/
      AdminPage.tsx       ← 관리자 메인 대시보드
  components/
    SubPageLayout.tsx     ← 하위 페이지 공통 레이아웃
    MenuEditPanel.tsx     ← 메뉴 편집 패널
    HeroEditPanel.tsx     ← 히어로 슬라이드 편집 패널
    NoticeEditPanel.tsx   ← 교회소식 편집 패널
    QuickMenuEditPanel.tsx← 퀵메뉴 편집 패널
    AffiliateEditPanel.tsx← 관련기관 편집 패널

server/
  routers.ts             ← tRPC API (cms, home, facility, admin 라우터)
  db.ts                  ← DB 쿼리 헬퍼 함수

drizzle/
  schema.ts              ← DB 테이블 스키마 전체
```
