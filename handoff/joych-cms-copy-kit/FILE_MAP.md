# 파일 지도

## 프론트엔드 핵심

- `client/src/pages/Admin.tsx`: 관리자 페이지 전체 탭 구성
- `client/src/pages/DynamicPage.tsx`: 메뉴 기반 동적 페이지 렌더링
- `client/src/components/SiteHeader.tsx`: 상단 메뉴/검색/로그인 헤더
- `client/src/components/SubPageLayout.tsx`: 좌측 패널형 서브페이지 레이아웃
- `client/src/components/MenuEditPanel.tsx`: 관리자 메뉴 추가/수정/정렬
- `client/src/components/menu-edit/*`: 메뉴 편집 세부 컴포넌트

## 동적 콘텐츠/게시판

- `client/src/components/dynamic-page/BoardContent.tsx`: 일반 게시판형 목록/상세
- `client/src/components/dynamic-page/FreeBoardContent.tsx`: 성도 자유게시판
- `client/src/components/dynamic-page/GalleryContent.tsx`: 최근행사사진/갤러리
- `client/src/components/dynamic-page/Lightbox.tsx`: 이미지 크게 보기
- `client/src/components/GalleryEditPanel.tsx`: 관리자 갤러리 등록/관리
- `client/src/components/NoticeEditPanel.tsx`: 관리자 공지 등록/관리

## 관리자 탭

- `client/src/components/AdminSupportRequestsTab.tsx`: 주보 광고신청, 자막 신청, 탐방 신청, 기도 요청 접수 관리
- `client/src/components/AdminBulletinsTab.tsx`: 주보 이미지 여러 장 등록/관리
- `client/src/components/AdminMembersTab.tsx`: 성도 관리
- `client/src/components/AdminPopupsTab.tsx`: 팝업 관리
- `client/src/components/AdminCoursesTab.tsx`: 강좌/강의 관리
- `client/src/components/AdminFreeBoardTab.tsx`: 자유게시판 관리

## 서버/DB

- `server/routers/home.ts`: 공개 홈페이지 데이터 API
- `server/routers/cms/menus.ts`: 메뉴 CMS API
- `server/routers/cms/content.ts`: 콘텐츠 CMS API
- `server/routers/cms/upload.ts`: 업로드 API
- `server/routers/members.ts`: 성도 기능 API
- `server/db/content.ts`: 메뉴/콘텐츠/게시판 DB 접근
- `server/db/member.ts`: 성도 DB 접근
- `drizzle/schema.ts`: DB 스키마 기준
