# 기쁨의교회 홈페이지 작업 진행 기록

> 이 문서는 세션이 초기화되어도 연속성을 유지하기 위한 작업 기록입니다.
> 새 세션 시작 시 반드시 이 문서를 먼저 읽고 진행 상황을 파악하세요.

---

## 프로젝트 기본 정보

| 항목 | 내용 |
|---|---|
| 프로젝트명 | joych-homepage (기쁨의교회 홈페이지) |
| 경로 | /home/ubuntu/joych-homepage |
| 기술 스택 | React 19 + Tailwind 4 + Express + tRPC 11 + MySQL (Drizzle ORM) |
| 주요 도메인 | joychome-kastcrbz.manus.space / dadowoomtest.co.kr |
| 관리자 접근 | /admin (Manus 로그인 후 admin 권한 필요) |

---

## 완료된 작업 이력

### 1단계: 기본 홈페이지 UI 완성
- 완료일: 2026-04-14 이전
- 내용: 기쁨의교회 홈페이지 전체 UI 구현
  - TopBar, Header(GNB), Hero(영상 슬라이드), 퀵메뉴, 조이풀TV, 교회소식, 비전, 갤러리, 관련기관, Footer
  - 모든 서브 페이지 라우팅 완성 (교회소개, 예배, 양육/훈련, 교회학교, 선교보고, 커뮤니티, 행정지원, 시설예약)
  - Noto Serif KR / Noto Sans KR 폰트, 녹색 계열 컬러 테마

### 2단계: 백엔드 + DB 기능 추가
- 완료일: 2026-04-14
- 체크포인트: 12f48fe5
- 내용:
  - web-db-user 기능 추가 (tRPC + MySQL + Manus OAuth)
  - CMS DB 테이블 11개 생성 (drizzle/schema.ts + pnpm db:push)
    - hero_slides, notices, affiliates, quick_menus, gallery_items
    - menus, menu_items, sections, sermons, site_settings, users
  - 초기 데이터 입력 (seed.mjs 실행)

### 3단계: CMS 백엔드 API + 관리자 대시보드
- 완료일: 2026-04-14
- 체크포인트: 40d6bf63
- 내용:
  - server/db.ts: CMS 쿼리 헬퍼 추가 (notices, affiliates, gallery, heroSlides, quickMenus, siteSettings CRUD)
  - server/routers.ts: home.* (공개 API) + cms.* (관리자 전용 API) 라우터 추가
  - client/src/pages/Home.tsx: DB 데이터 연결 (trpc.home.* 쿼리 사용, 폴백 데이터 포함)
  - client/src/pages/Admin.tsx: 관리자 대시보드 (/admin)
    - 교회 소식 CRUD (등록/수정/삭제/게시토글)
    - 관련 기관 관리 (수정/표시토글)
    - 교회 기본 정보 설정 (12개 항목)
  - client/src/App.tsx: /admin 라우트 추가
  - server/cms.test.ts: CMS 권한 테스트 6개 (모두 통과)

### 4단계: 실제 데이터 입력 + 중복 데이터 정리
- 완료일: 2026-04-14
- 내용:
  - 교회 소식 5개 실제 데이터로 교체 (더미 데이터 삭제 후 재입력)
  - 교회 기본 정보 12개 항목 업데이트 (주소, 전화번호, SNS 링크 등)
  - **중복 데이터 정리** (seed 2회 실행으로 발생한 중복 제거)
    - gallery_items: id 7~12 삭제 (6개 → 6개 정상)
    - quick_menus: id 10~18 삭제 (9개 → 9개 정상)
    - affiliates: id 6~10 삭제 (5개 → 5개 정상)
    - menus: id 8~14 삭제 (7개 → 7개 정상)
    - hero_slides: id 3~4 삭제 (2개 → 2개 정상)

### 5단계: 히어로 슬라이드 관리 탭 추가 + 중복 데이터 정리 ✅
- 완료일: 2026-04-14
- 내용:
  - server/db.ts: getAllHeroSlides(), updateHeroSlide() 함수 추가
  - server/routers.ts: cms.heroSlides.list, cms.heroSlides.update 라우터 추가
  - client/src/pages/Admin.tsx: HeroSlidesTab 컴포넌트 추가 (탭 4번째)
    - 슬라이드별 표시/숨김 토글
    - 연도 라벨, 메인 제목, 부제목, 성경 구절, 버튼1/2 텍스트+링크 수정
    - 수정 후 홈페이지 즉시 반영 (trpc invalidate)
  - WORK_LOG.md 작업 기록 문서 생성
  - **동작 확인 완료**: 브라우저에서 탭 클릭 → 슬라이드 2개 표시 → 수정 폼 정상 작동

---

## 현재 DB 상태 (2026-04-14 기준)

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

## 알려진 이슈 및 주의사항

- TypeScript 에러 13개가 표시되지만, 이는 `lib.esnext.d.ts` 파일 누락으로 인한 환경 이슈이며 실제 코드 에러가 아님. 빌드/실행에 영향 없음.
- seed 스크립트를 여러 번 실행하면 데이터가 중복 입력됨. 반드시 실행 전 기존 데이터 확인 필요.
- 관리자 권한: Manus 로그인 후 DB에서 해당 사용자의 role을 'admin'으로 변경해야 함.

---

### 6단계: 관리자 로그인 방식 교체 (2026-04-14)
- 완료일: 2026-04-14
- 내용:
  - server/routers.ts: `auth.adminLogin` 뮤테이션 추가 (아이디/비밀번호 검증 + 세션 쿠키 발급)
  - server/db.ts: `setUserRole` 함수 추가
  - client/src/pages/Admin.tsx: 로그인 화면을 아이디/비밀번호 폼으로 교체
  - 관리자 대시보드 헤더에 로그아웃 버튼 추가
  - **동작 확인 완료**: 로그아웃 → 로그인 폼 표시 → joyfulchurch/joyfulchurch1! 입력 → 관리자 대시보드 접근 성공

**관리자 계정 정보:**
- 아이디: `joyfulchurch`
- 비밀번호: `joyfulchurch1!`
- DB openId: `admin_joyfulchurch`

**주의사항:**
- 관리자 자격증명은 server/routers.ts에 하드코딩됨 (보안상 나중에 환경변수로 이동 권장)
- Manus OAuth 세션이 남아있으면 자동으로 관리자 페이지 접근 가능 (별도 처리 필요시 추가 작업)

---

## 다음 작업 예정

- [ ] 갤러리 관리 탭 추가 (Admin.tsx) - 사진 표시/숨김, 캡션 수정
- [ ] 퀵메뉴 관리 탭 추가 (Admin.tsx) - 메뉴 항목 수정, 순서 변경
- [ ] 이미지 업로드 기능 (S3 연동) - 갤러리/히어로 이미지 직접 업로드
- [ ] 홈페이지 인라인 편집 (관리자 로그인 시 직접 클릭해서 수정)
- [ ] 설교 영상 관리 탭 (유튜브 URL 연결)

## 작업 규칙 (반드시 준수)

1. 각 작업 완료 후 브라우저에서 실제 동작 확인 후 다음 단계 진행
2. seed 스크립트 재실행 금지 (중복 데이터 발생) — 데이터 수정 시 UPDATE 쿼리 사용
3. TypeScript 에러 13개는 환경 이슈 (lib.esnext.d.ts 누락), 실제 코드 에러 아님
4. 작업 완료 시 이 문서(WORK_LOG.md)와 todo.md 반드시 업데이트
