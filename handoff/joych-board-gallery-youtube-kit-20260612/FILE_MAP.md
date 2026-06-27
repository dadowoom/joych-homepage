# 파일 지도

## 공통 라우팅/레이아웃

- `source-files/client/src/App.tsx`
  - 주보, 접수, 관리자, 동적 페이지 라우트 연결 참고.
- `source-files/client/src/pages/DynamicPage.tsx`
  - 메뉴의 `pageType`에 따라 `board`, `gallery`, `youtube`, `editor`, `image` 화면을 나누는 핵심 파일.
- `source-files/client/src/components/SubPageLayout.tsx`
  - 좌측 패널형 서브페이지 레이아웃.
- `source-files/client/src/components/SiteHeader.tsx`
  - 특수 메뉴 이동 규칙, 상단 메뉴 처리.
- `source-files/client/src/components/PageTemplates.tsx`
  - 정적 페이지 템플릿과 동적 콘텐츠 표시 패턴.
- `source-files/client/src/lib/contentPermissions.ts`
  - 관리자/권한 받은 사람에게만 글쓰기/업로드 버튼을 보여주는 기준 함수.

## 게시판 기능

- `source-files/client/src/components/dynamic-page/BoardContent.tsx`
  - 일반 공지형 게시판 목록/상세 UI.
- `source-files/client/src/components/dynamic-page/FreeBoardContent.tsx`
  - 성도 로그인 기반 자유게시판 작성/수정/삭제 UI.
- `source-files/client/src/components/AdminFreeBoardTab.tsx`
  - 관리자 자유게시판 상태 관리.
- `source-files/client/src/pages/Worship.tsx`
  - 주보 보기. 여러 장 이미지 주보, 제목 클릭 펼침, 이미지 라이트박스 참고.
- `source-files/client/src/components/AdminBulletinsTab.tsx`
  - 관리자 주보 등록. 여러 이미지 파일 업로드 참고.
- `source-files/client/src/pages/CommunityExtra.tsx`
  - 주보 광고신청, 자막 신청, 탐방 신청, 기도 요청 같은 접수형 페이지 UI.
- `source-files/client/src/components/AdminSupportRequestsTab.tsx`
  - 관리자 접수 관리. 주보 광고신청/자막/탐방/기도 요청을 한 화면에서 필터링하고 처리.
- `source-files/client/src/lib/supportSideMenu.ts`
  - 행정지원 좌측 메뉴와 특수 링크 매핑.

관련 서버:
- `source-files/server/routers/freeBoard.ts`
- `source-files/server/routers/support.ts`
- `source-files/server/routers/cms/freeBoard.ts`
- `source-files/server/routers/cms/bulletins.ts`
- `source-files/server/routers/cms/notices.ts`
- `source-files/server/routers/cms/supportRequests.ts`
- `source-files/server/db/freeBoard.ts`
- `source-files/server/db/notice.ts`
- `source-files/server/db/bulletin.ts`
- `source-files/server/db/support.ts`

## 갤러리 기능

- `source-files/client/src/components/dynamic-page/GalleryContent.tsx`
  - 최근 행사 사진 공개 화면, 앨범 목록, 앨범 상세, 사진 업로드, 앨범 순서 변경, 사진 순서 변경.
- `source-files/client/src/components/dynamic-page/Lightbox.tsx`
  - 이미지 크게 보기.
- `source-files/client/src/components/GalleryEditPanel.tsx`
  - 기존 관리자 패널형 갤러리 관리 참고.
- `source-files/client/src/components/menu-edit/InlineEditForm.tsx`
  - 메뉴 편집 화면에서 갤러리/이미지 업로드 흐름 참고.

관련 서버:
- `source-files/server/routers/home.ts`
- `source-files/server/routers/cms/content.ts`
- `source-files/server/routers/cms/upload.ts`
- `source-files/server/db/content.ts`

## 유튜브 링크/영상 기능

- `source-files/client/src/components/dynamic-page/YoutubeContent.tsx`
  - 공개 유튜브 페이지 렌더링.
- `source-files/client/src/pages/YoutubeListPage.tsx`
  - 유튜브 목록 페이지 참고.
- `source-files/client/src/components/YoutubeAdminTab.tsx`
  - 관리자 예배영상/유튜브 관리 탭.
- `source-files/client/src/components/YoutubeEditPanel.tsx`
  - 패널형 유튜브 편집 UI.
- `source-files/client/src/components/menu-edit/YoutubeVideoManager.tsx`
  - 메뉴 편집 안에서 유튜브 영상 추가/수정/정렬.

관련 서버:
- `source-files/server/routers/youtube.ts`
- `source-files/server/db/youtube.ts`
- `source-files/server/_core/contentValidation.ts`
- `source-files/server/_core/legacyVod.ts`

## 공통 서버/DB

- `source-files/server/routers/index.ts`
  - 전체 tRPC 라우터 통합.
- `source-files/server/routers/cms/index.ts`
  - CMS 하위 라우터 통합.
- `source-files/server/routers/cms/menus.ts`
  - 메뉴 타입 `board`, `gallery`, `youtube` 생성/수정 참고.
- `source-files/server/_core/trpc.ts`
  - `publicProcedure`, `memberProcedure`, `adminProcedure`, `contentProcedure` 권한 기준.
- `source-files/server/_core/index.ts`
  - 보안 헤더/CSP에서 YouTube iframe, 이미지, 업로드 도메인 허용 참고.
- `source-files/server/storage.ts`
  - 업로드 저장소 추상화.
- `source-files/drizzle/schema.ts`
  - 전체 테이블 정의.
- `source-files/drizzle/*.sql`
  - 관련 마이그레이션 참고.
