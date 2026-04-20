# 기쁨의교회 홈페이지 — 작업 현황 (TODO)

> 마지막 업데이트: 2026년 4월 20일

---

## 현황 요약 (외부 업체 인수인계용)

| 항목 | 완료 | 미완료 |
|---|---|---|
| 전체 작업 | 176개 ✅ | 41개 ⬜ |
| 알려진 버그 | 9개 수정 ✅ | 2개 미해결 ⚠️ |

### 즉시 처리 필요 (보안)
- ⚠️ `server/routers/auth.ts` 46~48번 줄 — 관리자 ID/PW 하드코딩 → 환경변수 이전 필요

### 미해결 버그
- ⚠️ 갤러리 사진 교체 안 됨 (CDN URL 확인 필요)
- ⚠️ 블록 에디터 저장 후 자동 갱신 안 됨 (invalidate 처리 필요)

### 주요 미완료 기능
- 카카오 소셜 로그인, 성도 비밀번호 찾기/재설정, 성도 회원탈퇴
- 블록 에디터 고급 기능 (텍스트 정렬, 색상, 표 블록 등)
- 갤러리/비전/사이트설정 편집 패널
- DB 스키마 정합성 검증 (church_members 중복 컬럼 정리)

---
## 완료된 작업

### 기초 구축
- [x] 기쁨의교회 홈페이지 기본 UI 완성 (TopBar, GNB, Hero, 퀵메뉴, 조이풀TV, 교회소식, 비전, 갤러리, 관련기관, Footer)
- [x] 모든 서브 페이지 라우팅 완성 (교회소개, 예배, 양육/훈련, 교회학교, 선교보고, 커뮤니티, 행정지원, 시설예약)
- [x] 백엔드 서버 + DB 기능 추가 (web-db-user: tRPC + MySQL + Drizzle ORM)
- [x] CMS DB 테이블 11개 생성 (schema.ts + pnpm db:push)
- [x] 초기 데이터 입력 (seed.mjs)
- [x] CMS 백엔드 API 라우터 추가 (server/routers.ts)
- [x] DB 쿼리 헬퍼 추가 (server/db.ts)
- [x] 홈페이지 데이터를 DB에서 읽어오도록 연결 (Home.tsx)

### 관리자 대시보드 (/admin)
- [x] 관리자 대시보드 페이지 구현 (/admin)
- [x] 교회 소식 CRUD (등록/수정/삭제/게시토글)
- [x] 관련 기관 관리 (수정/표시토글)
- [x] 교회 기본 정보 설정 (12개 항목)
- [x] 히어로 슬라이드 관리 탭 추가 (관리자 대시보드)
- [x] /admin 라우트 등록 (App.tsx)
- [x] 실제 교회 소식 DB 입력 (기존 더미 데이터 교체)
- [x] 교회 기본 정보 DB 업데이트 (주소, 전화번호, SNS 링크 등)
- [x] 중복 데이터 정리 (gallery_items, quick_menus, affiliates, menus, hero_slides)

### 관리자 로그인 방식
- [x] 관리자 로그인을 Manus OAuth에서 아이디/비밀번호 방식으로 교체
- [x] 서버에 adminLogin API 추가 (아이디/비밀번호 검증 + 세션 쿠키)
- [x] Admin.tsx 로그인 화면을 아이디/비밀번호 폼으로 교체
- [x] 관리자 대시보드 헤더에 로그아웃 버튼 추가

### 홈페이지 인라인 편집 (편집 바)
- [x] 홈페이지 상단에 관리자 편집 바 추가 (관리자 로그인 시만 표시)
- [x] 메뉴 편집 패널 구현 (MenuEditPanel.tsx) — 드래그 앤 드롭 순서 변경, 이름/링크 수정, 추가/삭제
- [x] 교회 소식 편집 패널 구현 (NoticeEditPanel.tsx) — 표시/숨김, 수정
- [x] 히어로 슬라이드 편집 패널 구현 (HeroEditPanel.tsx) — 텍스트/버튼 수정, 표시/숨김
- [x] 퀵메뉴 편집 패널 구현 (QuickMenuEditPanel.tsx) — 이름/링크/아이콘 수정, 표시/숨김
- [x] 관련기관 편집 패널 구현 (AffiliateEditPanel.tsx) — 이름/링크/아이콘 수정, 표시/숨김
- [x] 편집 바에 로그아웃 버튼 추가 (tRPC auth.logout mutation 사용)

---

## 다음 작업 예정

- [ ] 갤러리 편집 패널 추가 (GalleryEditPanel.tsx) — 사진 표시/숨김, 캡션 수정
- [ ] 비전 섹션 편집 패널 — "깊이있는 성장, 위대한 교회" 텍스트 및 3개 카드 DB 관리
- [ ] 사이트 설정 편집 패널 — 교회 주소, 전화번호, SNS 링크 등 푸터 정보 수정
- [ ] 이미지 업로드 기능 (S3 연동) — 갤러리/히어로 이미지 직접 업로드
- [ ] 설교 영상 관리 탭 — 유튜브 URL 연결
- [ ] 관리자 자격증명 환경변수 이동 (현재 routers.ts에 하드코딩)
- [x] 히어로 슬라이드 편집 패널에 추가/삭제 기능 구현 (DB + 서버 API + UI 전체 연결)
- [x] 헤더 GNB에 신앙 데이터 검색창 추가 (로고와 메뉴 사이, PC/모바일 반응형)
- [x] /faith-data 페이지 제작 (faithplus API 연동, 성도 검색 결과 + 상세 신앙 데이터 표시)
- [x] /church-directory 교적부 페이지 제작 (성도 카드 + 신앙 데이터 상세, 하드코딩 → 추후 DB 연동)

- [x] MenuEditPanel에 하위 메뉴(서브메뉴) 추가/수정/삭제 UI 구현 (DB-서버 전체 연결)
- [x] 히어로 영상 교체: 기존 2개 삭제 → 새 영상 4개(01~04.mp4) CDN 업로드 및 DB 등록 (텍스트/버튼은 그대로 유지)
- [x] 조이풀TV 섹션 유튜브 영상 연결: https://www.youtube.com/watch?v=WmFzWf5uEzI (최신 설교 영상 표시)
- [x] [BUG] 헤더 네비게이션 드롭다운 하위 메뉴 안 보이는 문제 수정 (menu_items 53개 삽입, opacity/visibility 방식으로 CSS 변경)
- [ ] [BUG] 갤러리 사진 실제 교체 안 됨 (CDN URL 확인 필요)
- [x] 헤더 로고 교체: 텍스트 → 이미지 로고(베이직-심볼로고조합수정.jpg) 적용
- [x] 파비콘 교체: 01.ico 파일 적용
- [x] 갤러리에 사진 5장 추가(전경 3장 + 내부 2장) 및 메인 표시
- [x] 메인 "함께 드리는 예배" 섹션에 찬양집회 사진(_KSH2171.webp) 적용
- [x] 메인 "깊이있는 성장, 위대한 교회" 비전 섹션 배경 사진을 _MG_1172.webp(파노라마 예배 사진)로 교체
- [x] 담임목사 인사 페이지(/about/pastor): 기존 인사말 레이아웃 그대로 유지, 목사님 사진만 KakaoTalk_20250804_163350120_25.jpg(새 프로필)로 교체
  - 교회전경.webp (개관식 항공뷰)
  - 교회전경2.jpg (주간 항공뷰)
  - 교회전경3.jpg (야경)
  - _KSH2171.webp (찬양 집회 내부)
  - RE_JoyfulChurch_Int_03.jpg (주일예배 내부)

## 교적부 시스템 완성 (진행 중)
- [ ] DB에 성도(members) 테이블 추가 및 마이그레이션
- [ ] 서버 API에 성도 CRUD 추가 (db.ts + routers.ts)
- [ ] 헤더 검색창을 /church-directory?name=이름 으로 변경
- [ ] 교적부 페이지 DB 연동 + 카드 클릭 시 faithplus 랭킹 이동
- [ ] 관리자 대시보드에 성도 등록/수정/삭제 탭 추가
- [x] 담임목사 인사말 페이지: 인사말 이미지 + 새 목사님 프로필 사진으로 교체 완료 (인사말 이미지 내 목사님 사진 합성 교체, 프로필 카드 사진도 교체)
- [x] DB menu_items 테이블에 pageType 컨럼 추가 (image/gallery/board/youtube/editor, 기본값 image)
- [x] 서버 API updateItem에 pageType 필드 추가
- [x] 편집 모드에 하위 메뉴 2단 편집 패널 구현 (왼쪽: 상위 메뉴 목록, 오른쪽: 하위 메뉴 추가/수정/삭제/타입 선택)

## 3단 메뉴 구조 확장
- [x] DB에 menu_sub_items 테이블 추가 (menu_item_id 외래키, 이름/링크/순서/표시여부/pageType)
- [x] 서버 API에 3단 메뉴 CRUD 추가 (getSubItems, createSubItem, updateSubItem, deleteSubItem)
- [x] 헤더 GNB에 3단 드롭다운 표시 (2단 hover 시 3단 옆으로 펼쳐지게)
- [x] 편집 모드 메뉴 편집 패널을 3단 구조로 확장 (2단 항목 클릭 시 3단 편집 가능)
- [x] [BUG] 메뉴 편집 패널 화면 넘침 문제 해결 + UI 직관적으로 재설계 (3컬럼 나란히 배치, 고정 높이 스크롤)
- [x] [BUG] 메뉴 편집 패널 1단 이름 잘림 수정, 3단 컬럼 동작 확인/수정, 상단 설명 텍스트 레이아웃 조정 (컬럼 너비 확대, 패널 900px, 설명 2줄 분리)
- [x] [BUG] 메뉴 편집 패널 위치를 헤더 네비게이션 아래에서 시작하도록 변경, 3단 컬럼 화면 밖 잘림 수정
- [x] [BUG] 모든 편집 패널(교회소식/슬라이드/퀵메뉴/관련기관) 헤더 겹침 문제 수정 (top: 144px 일괄 적용)

## 다음 단계 작업 (승인 후 순차 진행)

### 단계 1: 히어로 영상 파일 업로드 기능
- [x] 서버에 영상 파일 업로드 API 추가 (S3 storagePut 연동)
- [x] HeroEditPanel에 파일 선택 버튼 + 업로드 진행 표시 UI 추가
- [x] 업로드 완료 후 hero_slides DB의 videoUrl 자동 갱신

### 단계 2: 교회소식 썸네일 이미지 파일 업로드 기능
- [x] NoticeEditPanel에 이미지 파일 선택 버튼 + 미리보기 UI 추가
- [x] 업로드 완료 후 notices DB의 thumbnailUrl 자동 갱신

### 단계 3: 하위메뉴 클릭 시 실제 페이지 표시
- [x] pageType별 페이지 컴포넌트 구현 (image/gallery/board/youtube/editor)
- [x] 하위메뉴 링크 클릭 시 해당 pageType 페이지로 라우팅 연결
- [x] 각 페이지에서 메뉴 이름/타입 DB에서 읽어 동적 표시

## 동적 페이지 완성 (진행 중)
- [x] [BUG] href=null인 menu_sub_items DB 업데이트 완료 (담임목사님 저서 → /page/sub/1)
- [x] 공통 SubPageLayout 컴포넌트 제작 (헤더+GNB+푸터+브레드크럼+사이드메뉴)
- [x] DynamicPage.tsx에 SubPageLayout 적용
- [x] pageType별 완성도 향상 (image/gallery/board/youtube/editor)

## 청년 피드백 반영 항목 (추후 처리)
- [ ] 사이트맵 페이지 추가 — 전체 메뉴 구조를 한눈에 볼 수 있는 페이지 (예: /sitemap)
- [ ] GNB 메뉴명 일치 여부 전수 검토 — 홈 퀵메뉴/섹션 이름과 GNB 메뉴명이 다른 항목 정리 (예: "시설사용예약" vs "시설물 안내")
- [ ] GNB에 노출 안 된 메뉴 항목 검토 — 홈에는 있지만 GNB에 없는 항목 파악 및 추가 여부 논의

## 사이트맵 페이지 추가
- [x] Sitemap.tsx 페이지 컴포넌트 제작 (DB에서 전체 메뉴 구조 읽어 표시)
- [x] App.tsx에 /sitemap 라우트 등록
- [x] 홈 페이지 푸터에 사이트맵 링크 추가

## 시설 예약 시스템 (실제 업체 수준)

### 단계 1: DB 스키마 설계
- [x] facilities 테이블 (시설명, 설명, 위치, 수용인원, 요금, 예약단위, 최소/최대시간, 승인방식, 상태)
- [x] facility_images 테이블 (시설 사진 여러 장, 순서, 대표사진 여부)
- [x] facility_hours 테이블 (요일별 운영시간, 점심휴식, 휴무일)
- [x] facility_blocked_dates 테이블 (특정 날짜 휴무/차단)
- [x] reservations 테이블 (예약자, 시설, 날짜, 시작/종료시간, 사용목적, 소속부서, 인원, 상태, 승인/거절사유) — department 컬럼 추가 포함
- [x] pnpm db:push 실행 (마이그레이션 0006 완료)

### 단계 2: 서버 API 구현
- [x] db.ts에 시설/예약 관련 쿼리 헬퍼 함수 추가 (getAllReservations에 facilityName JOIN 포함)
- [x] routers.ts에 home.facilities, home.facility, home.facilityImages, home.facilityHours, home.facilityBlockedDates, home.facilityReservationsByDate 추가
- [x] routers.ts에 home.createReservation, home.myReservations, home.cancelReservation 추가 (department 필드 포함)
- [x] routers.ts에 cms.facilities CRUD, cms.reservations (list/approve/reject) 관리자 API 추가
- [x] 파일 업로드 API — 시설 사진 S3 업로드 (AdminFacilitiesTab에서 사용)

### 단계 3: 성도 측 페이지
- [x] FacilityList.tsx — 시설 목록 (사진, 수용인원, 운영시간, 예약가능 뱃지)
- [x] FacilityDetail.tsx — 시설 상세 (사진 갤러리, 설명, 이용안내, 예약 달력)
- [x] FacilityApply.tsx — 예약 신청 (날짜/시간 선택, 소속 부서 입력, 개인정보 동의)
- [x] MyReservations.tsx — 내 예약 목록 (상태별 필터, 취소 기능)

### 단계 4: 관리자 측 페이지
- [x] AdminFacilitiesTab.tsx — 시설 등록/수정/삭제, 사진 업로드, 운영시간/차단일 설정
- [x] AdminReservationsTab.tsx — 예약 목록/달력 뷰, 승인/거절 + 사유 입력, TypeScript 에러 수정
- [x] Admin.tsx — 시설 관리(facilities) + 예약 승인(reservations) 탭 추가
- [ ] Admin 예약 현황 탭 — 월별/주별 달력 (현재 AdminReservationsTab 달력 뷰로 대체)
- [ ] Admin 휴무일 설정 탭 — 특정 날짜 차단/해제 (현재 AdminFacilitiesTab에서 시설별 차단일 설정 가능)

## 교회 회원가입 시스템 (2026-04-16)

- [x] DB: church_members 테이블 확장 (이메일, 비밀번호, 생년월일, 세례정보, 승인상태 등)
- [x] DB: member_field_options 테이블 생성 (직분/부서/구역/세례 선택지 관리)
- [x] DB 마이그레이션 완료 (수동 SQL 스크립트로 처리)
- [x] 기본 선택지 데이터 삽입 (직분 9개, 부서 8개, 구역 3개, 세례 4개)
- [x] 서버 API: 성도 회원가입/로그인/로그아웃/내 정보 조회 (JWT 쿠키 방식)
- [x] 서버 API: 관리자 성도 목록/승인/교회정보 수정
- [x] 서버 API: 선택지 CRUD (추가/수정/삭제)
- [x] /member/register — 성도 회원가입 페이지 (선택지 DB에서 불러옴)
- [x] /member/login — 성도 로그인 페이지
- [x] /member/my-page — 성도 마이페이지 (기본정보 + 관리자 입력 교회정보)
- [x] Admin 선택지 관리 탭 — 직분/부서/구역/세례 선택지 추가/수정/삭제
- [x] Admin 성도 관리 탭 — 가입 승인/거절, 교회 정보 입력/수정

### 추후 추가 예정
- [ ] 카카오 소셜 로그인 연동
- [ ] 성도 비밀번호 찾기/재설정
- [ ] 성도 회원탈퇴 기능

## 로그인 상태 반영 (2026-04-16)
- [x] Home.tsx 상단 유틸 바에 성도 로그인 상태 반영 (로그인 시 이름/마이페이지/로그아웃 표시)
- [x] 회원가입 완료 시 자동 로그인 (JWT 쿠키 발급 + 홈으로 이동)

## 시설 예약 UX 개선 (2026-04-17)
- [x] FacilityDetail.tsx: 날짜 클릭 시 해당 날짜 시간대 현황 패널 표시 (가능/예약됨 구분)
- [x] 헤더: 모든 페이지에서 스크롤해도 상단 고정 (sticky) 처리
- [x] FacilityApply.tsx: URL ?date= 파라미터 읽어서 날짜 자동 적용
- [x] FacilityApply.tsx: 날짜 필드 읽기 전용 처리 + 달력으로 돌아가기 링크
- [x] FacilityApply.tsx: 날짜 자동 적용 시 시간 선택 UI 즉시 표시

## 시설 예약 시스템 완성 (2026-04-17)
- [x] DB: facilities 테이블에 openTime, closeTime 컬럼 추가
- [x] DB: 기존 더미 대예배실 3개 데이터 삭제
- [x] 서버: 시설 CRUD API에 openTime/closeTime 필드 추가
- [ ] 관리자 대시보드: 시설 등록/수정 폼에 운영 시간 입력 필드 추가
- [x] FacilityDetail: openTime~closeTime 기준 시간 슬롯 표시 연동
- [x] FacilityDetail: 요일별 운영시간(facility_hours) 연동하여 시간 슬롯 생성
- [x] FacilityDetail: 이미 예약된 시간 슬롯 회색 비활성화(클릭 불가) 처리
- [x] FacilityDetail: 가능/예약됨/선택됨 색상 구분 범례 표시

## DB 구조 정리 (2026-04-16)
- [ ] church_members 테이블 중복 컬럼 제거 및 정규화
- [ ] drizzle/schema.ts와 실제 DB 완전 일치
- [ ] 회원가입 정상 동작 확인

## UI 버그 수정 (2026-04-17)
- [x] 관리자 대시보드: 탭 클릭 시 404 오류 수정
- [x] 편집 모드 메뉴바: 스크롤 시 상단 sticky 고정 처리

## 시설 예약 시간 선택 UX 개선 (2026-04-17)
- [x] FacilityDetail: 시간 슬롯 클릭으로 시작/종료 시간 선택 기능 추가 (드롭다운 없음)
- [x] FacilityDetail: 예약 신청 버튼에 날짜+시작시간+종료시간 URL 파라미터 연동
- [x] FacilityDetail: 예약 버튼 라벨에 선택된 날짜/시간 실시간 반영
- [x] FacilityApply: 드롭다운 완전 제거, 슬롯 버튼 방식으로 시간 선택 전면 교체
- [x] FacilityApply: URL 파라미터(startTime, endTime) 자동 적용 + 슬롯 클릭으로 수정 가능

## 이미지 전체화면 페이지 개선 (2026-04-17)
- [x] DynamicPage.tsx ImageContent: 이미지를 페이지 너비에 꽉 차게 표시 (object-cover, 가로 100%)
- [x] DynamicPage.tsx ImageContent: 이미지 클릭 시 라이트박스(원본 크기 확대 보기) 기능 추가
- [x] DynamicPage.tsx ImageContent: 이미지 없을 때 안내 문구 개선

## 블록 에디터 시스템 구축 (2026-04-17)
### 단계 1: DB 설계
- [x] page_blocks 테이블 설계 (menu_item_id / menu_sub_item_id, 블록타입, 순서, 내용 JSON)
- [x] 블록 타입 정의: text-h1 / text-h2 / text-h3 / text-body / image-single / image-double / image-triple / youtube / button
- [x] pnpm db:push 실행 (마이그레이션) — SQL 직접 실행 방식으로 완료

### 단계 2: 서버 API
- [x] db.ts에 블록 쿼리 헬퍼 추가 (getBlocks, createBlock, updateBlock, deleteBlock, reorderBlocks)
- [x] routers.ts에 home.pageBlocks (공개 조회), cms.blocks CRUD (관리자) 추가

### 단계 3: 뷰어 UI
- [x] DynamicPage.tsx EditorContent: 블록 목록 조회 및 타입별 렌더링 구현
- [x] 텍스트 블록: H1/H2/H3/본문 스타일 적용
- [x] 이미지 블록: 1장/2장 나란히/3장 나란히 레이아웃
- [x] 유튜브 블록: iframe 임베드
- [x] 버튼 블록: 링크 버튼 표시

### 단계 4: 관리자 편집 UI
- [x] 관리자 모드에서 DynamicPage에 편집 버튼 표시
- [x] 블록 추가 (타입 선택 → 내용 입력)
- [x] 블록 수정 (인라인 편집)
- [x] 블록 삭제
- [x] 블록 순서 변경 (위/아래 버튼 방식으로 구현)

## 버그 수정 (2026-04-17)
- [x] SubPage 헤더 2중 표시 버그 수정 (SubPageLayout에서 자체 헤더 제거, SiteHeader 재사용)

## 버그/기능 추가 (2026-04-17 오후)
- [ ] 블록 에디터: 저장 후 자동 화면 갱신 안 되는 문제 수정 (invalidate 처리)
- [ ] 블록 에디터: 텍스트 정렬 기능 추가 (왼쪽/가운데/오른쪽)
- [ ] 블록 에디터: 메뉴 편집 패널(MenuEditPanel) 안에서 블록 편집 탭 추가
- [ ] 블록 에디터: 텍스트 글씨 크기 조절 (10~100, 숫자 입력 + 슬라이더)
- [ ] 블록 에디터: 텍스트 정렬 기능 (왼쪽/가운데/오른쪽)

## 편집 모드 최상위 기능 구현 (2026-04-17)
- [ ] 텍스트 블록: 글자 색상 선택 (색상 팔레트)
- [ ] 텍스트 블록: 굵게/기울임 토글
- [ ] 텍스트 블록: 줄간격 조절 (1.0~3.0)
- [ ] 신규 블록: 강조 박스 (노란/파란/초록/빨간 배경)
- [ ] 신규 블록: 이미지 크기 조절 (너비 % 입력)
- [ ] 신규 블록: 파일 첨부 (PDF/한글 다운로드 링크)
- [ ] 신규 블록: 2단 레이아웃 (텍스트+이미지 나란히)
- [ ] 신규 블록: 배경색 구역 + 여백 조절
- [ ] 신규 블록: 표 블록 (행/열/너비/높이/테두리)
- [ ] 페이지 타입명 변경: "텍스트+이미지" → "편집 모드"
- [ ] 메뉴 편집 패널 안에서 블록 편집 탭 추가
- [x] MenuEditPanel: 2단 메뉴 드래그로 순서 변경 기능 추가
- [x] MenuEditPanel: 3단 메뉴 드래그로 순서 변경 기능 추가

## 블록 에디터 자동 갱신 수정 (2026-04-17)
- [ ] DynamicPage.tsx: 블록 추가/수정/삭제/순서변경 후 invalidate 처리 추가 (새로고침 없이 즉시 반영)

## 구분선 블록 개선 (2026-04-17)
- [x] 구분선 블록: 두께 조절 기능 추가 (1px ~ 10px)
- [x] 구분선 블록: 스타일 선택 기능 추가 (실선/점선/파선)

## 메뉴 링크 개선 (2026-04-17)
- [x] 담임목사 소개 메뉴 href를 /about/pastor로 수정 (DB 직접 업데이트)
- [x] 메뉴 편집 패널 InlineEditForm: 링크 타입 탭 UI 추가 (기존 페이지 선택 / 외부 URL / 직접 입력)

## 모바일 메뉴 버그 수정 (2026-04-17)
- [x] [BUG] 모바일에서 GNB 메뉴 클릭/터치 안 되는 문제 수정 (SiteHeader.tsx 모바일 메뉴 터치 이벤트)

## 유튜브 목록 페이지 구현 (2026-04-17)
- [x] DB: youtube_playlists, youtube_videos 테이블 추가 및 마이그레이션
- [x] Server: youtube CRUD 프로시저 추가 (목록 조회/영상 추가/삭제/순서변경)
- [x] YoutubeListPage.tsx: 최신 영상 크게 + 나머지 카드 슬라이드 표시
- [x] YoutubeEditPanel.tsx: 관리자 패널 유튜브 영상 관리 UI (링크 추가/삭제/순서변경/썸네일 자동 추출)
- [x] 메뉴 편집 패널: '유튜브 목록' 페이지 타입 추가 및 라우팅 연결
- [x] MenuEditPanel.tsx: '텍스트+이미지' → '편집 모드' 이름 변경

## 예배영상 편집 UI 개선 (2026-04-17)
- [x] Home.tsx: 편집 바 '유튜브 편집' → '예배영상 편집'으로 이름 변경
- [x] Admin.tsx: 예배영상 관리 탭 추가 (YoutubeAdminTab 컴포넌트 신규 제작, 인라인 표시)

## 유튜브 목록 메뉴 - 플레이리스트 자동 연결 (2026-04-17)
- [x] DB: menuItems 테이블에 playlistId 연결 콜럼 추가 (또는 플레이리스트에 menuItemId 연결)
- [x] 서버: 유튜브 목록 타입 메뉴 저장 시 동일 이름 플레이리스트 자동 생성·연결
- [x] MenuEditPanel.tsx: 유튜브 목록 타입 선택 시 패널 내 영상 추가/관리 섹션 표시
- [x] 기존 플레이리스트 있으면 중복 생성 방지

## 보안 헤더 추가 (2026-04-17)
- [x] Content-Security-Policy 헤더 추가 (XSS 방어)
- [x] X-Frame-Options 헤더 추가 (클릭재킹 방어)
- [x] X-Content-Type-Options 헤더 추가 (MIME 스니핑 방어)
- [x] Referrer-Policy 헤더 추가 (리퍼러 정보 제한)
- [x] Permissions-Policy 헤더 추가 (카메라/마이크 등 권한 제한)
- [x] HTTP → HTTPS 자동 전환 설정 (배포 환경 적용)

## 예배영상 직접 URL(mp4) 지원 (2026-04-17)
- [x] DB: youtubeVideos 테이블에 videoUrl 콜럼 추가 (mp4 등 직접 URL 저장)
- [x] 서버: addVideo 프로시저에서 videoUrl 저장 처리
- [x] 프론트: MenuEditPanel 입력 UI - "유튜브 링크 또는 영상 파일 주소(URL)" 안내로 변경
- [x] 프론트: YoutubeListPage에서 유튜브 vs 직접 URL 재생 방식 분기 처리

## 메뉴 편집 패널 영상 섹션 제거 (2026-04-17)
- [x] MenuEditPanel.tsx: YoutubeVideoManager 컴포넌트 제거 (영상 관리는 관리자 대시보드로 통합)
- [x] 유튜브 목록 타입 메뉴 선택 시 대시보드 안내 메시지로 교체
- [x] 뒤로 가기 버튼이 페이지 히스토리를 따르도록 수정 (window.history.back)
- [x] 전체 브라우저 히스토리 기능 - 이미 구현됨 확인

## 조이풀TV 예배영상 DB 연동 (2026-04-17)
- [x] JoyfulTV.tsx: 하드코딩 더미 데이터 제거 → href 기반 DB 메뉴 조회로 교체
- [x] server/db.ts: getMenuItemByHref, getMenuSubItemByHref 함수 추가
- [x] server/routers.ts: home.menuItemByHref, home.menuSubItemByHref API 추가
- [x] 관리자 대시보드에서 영상 추가 시 조이풀TV 페이지에 즉시 반영

## 코드베이스 정비 (2026-04-20)
- [x] server/db/ 폴더 분리 완료 (9개 파일로 기능별 분리)
- [x] TypeScript 오류 0개 달성
- [x] README.md 신규 작성 (외부 업체 인수인계용)
- [x] HANDOVER.md 신규 작성 (미완료 기능, 알려진 이슈, 보안 주의사항)
- [x] DEVELOPMENT_RULES.md 폴더 구조 섹션 최신화
- [x] todo.md 현황 요약 섹션 추가
- [x] ComponentShowcase.tsx → docs/ 폴더로 이동 (라우팅에서 제거)
- [x] MenuEditPanel.tsx 컴포넌트 분리 (1,113줄 → 542줄 + components/menu-edit/ 6개 파일)
- [x] DynamicPage.tsx 컴포넌트 분리 (976줄 → 203줄 + components/dynamic-page/ 7개 파일)
- [x] Admin.tsx 탭 컴포넌트 분리 (765줄 → 338줄 + components/admin/SettingsTab.tsx)

## 외부 서버/DB 이전 준비 (2026-04-20)
- [x] 관리자 ID/PW 하드코딩 → 환경변수 이전 (ADMIN_USERNAME, ADMIN_PASSWORD, ADMIN_OPEN_ID)
- [x] .env.example 파일 생성 (이전 시 필요한 모든 환경변수 목록)
- [x] ENV_SETUP.md 작성 (환경변수 설정 가이드)
- [x] DEPLOYMENT.md 작성 (외부 서버 이전 단계별 가이드)
- [ ] S3 스토리지 설정을 외부 S3(AWS/Cloudflare R2)로 교체 가능하도록 문서화 (추후 진행)

## 코드 품질 개선 (2026-04-20)
- [x] as any 34개 제거 → 실제 Drizzle 타입으로 교체
- [ ] 블록 에디터 저장 후 자동 갱신 버그 수정 (invalidate 처리)
