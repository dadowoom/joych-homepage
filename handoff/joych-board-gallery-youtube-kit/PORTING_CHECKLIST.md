# 이식 체크리스트

## 1. 시작 전 확인

- 대상 프로젝트의 `git status`를 먼저 확인한다.
- 기존 사용자 변경사항을 되돌리지 않는다.
- 대상 프로젝트의 라우팅 방식, 인증 방식, DB ORM, 업로드 저장소를 확인한다.
- 이 키트의 파일은 참고용이다. 대상 프로젝트에 무작정 덮어쓰지 않는다.

## 2. 필요한 DB 테이블

게시판:
- `notices`
- `free_board_posts`
- `bulletins`
- `bulletin_images`
- `bulletin_ad_requests`
- `subtitle_requests`
- `visit_requests`
- `prayer_requests`

갤러리:
- `gallery_items`
- 주요 필드: `imageUrl`, `caption`, `isVisible`, `sortOrder`, `gridSpan`, `albumKey`, `albumTitle`, `albumSortOrder`

유튜브:
- `youtube_playlists`
- `youtube_videos`
- 주요 필드: `playlistId`, `title`, `description`, `videoId`, `videoUrl`, `thumbnailUrl`, `preacher`, `scripture`, `sermonDate`, `sortOrder`, `isVisible`

메뉴:
- `menus`
- `menu_items`
- `menu_sub_items`
- 메뉴 타입에 `board`, `gallery`, `youtube`, `image`, `editor`가 필요하다.

참고 마이그레이션:
- `0001_magenta_lily_hollister.sql`: 초기 공지/갤러리
- `0007_dear_apocalypse.sql`: 유튜브 플레이리스트/영상
- `0008_plain_master_chief.sql`: 유튜브 URL 필드
- `0017_red_master_chief.sql`: 설교자/본문/일자
- `0019_groovy_chimera.sql`: 자유게시판
- `0021_visit_requests.sql`: 탐방 신청
- `0022_subtitle_requests.sql`: 자막 신청
- `0023_bulletins_and_ads.sql`: 주보/주보 광고신청
- `0024_bulletin_images.sql`: 주보 여러 이미지
- `0025_gallery_albums.sql`: 갤러리 앨범
- `0026_gallery_album_sort_order.sql`: 갤러리 앨범 순서

## 3. 권한 기준

기쁨의교회 기준:
- 공개 조회: 비로그인 가능
- 자유게시판 작성: 성도 로그인 필요
- 주보 광고신청/자막 신청: 성도 로그인 필요
- 탐방 신청: 비로그인 가능
- 갤러리/주보/공지/유튜브 등록과 수정: 관리자 또는 별도 권한 필요

대상 프로젝트에서 결정할 것:
- 관리자만 업로드할지
- 세부 관리자 권한을 둘지
- 게시판별 권한을 나눌지
- 작성자 본인 수정/삭제를 허용할지

## 4. 업로드 구조

현재 기쁨의교회 기준:
- 갤러리 이미지: `gallery-images/...`
- 주보 이미지: `bulletins/...`
- 주보 광고 첨부: `bulletin-ad-requests/...`
- 자막 신청 첨부: 대상 프로젝트에서 별도 폴더 지정 가능

대상 프로젝트에서 바꿔야 할 수 있는 부분:
- S3 호환 저장소 사용 여부
- 로컬 `/uploads` 저장 여부
- 파일 크기 제한
- 허용 MIME 타입
- 이미지 URL의 도메인 또는 CDN 경로

## 5. 화면별 이식 순서

게시판:
1. 공개 목록/상세 UI를 먼저 붙인다.
2. 작성/수정/삭제 권한을 붙인다.
3. 관리자 상태 변경과 검색/필터를 붙인다.
4. 주보는 여러 장 이미지를 하나의 게시물에 묶는다.

갤러리:
1. 공개 앨범 목록을 만든다.
2. 앨범 클릭 시 상세 페이지로 이동한다.
3. 상세에서 이미지가 세로로 자연스럽게 나열되게 한다.
4. 관리자에게만 사진 업로드 버튼을 보이게 한다.
5. 업로드 시 여러 장을 하나의 앨범으로 묶는다.
6. 관리자에게만 앨범 순서/사진 순서 변경 UI를 보이게 한다.

유튜브:
1. 메뉴 타입 `youtube`를 추가한다.
2. 메뉴 생성 시 플레이리스트를 연결하거나 자동 생성한다.
3. 관리자에서 유튜브 URL을 입력하면 `videoId`를 추출한다.
4. 공개 페이지에서 iframe/embed 또는 썸네일 목록을 표시한다.

## 6. 검증

필수:
- 타입 체크
- 테스트가 있으면 관련 테스트
- 빌드
- 브라우저 확인

브라우저 확인 항목:
- 게시판 목록/상세가 열린다.
- 로그인 필요 기능은 비로그인에서 작성 차단된다.
- 탐방 신청은 비로그인에서도 작성 가능하다.
- 주보 여러 이미지가 순서대로 보인다.
- 갤러리 앨범이 최신순으로 보인다.
- 앨범 상세에서 사진을 클릭하면 크게 열린다.
- 관리자/권한자에게만 업로드 버튼이 보인다.
- 유튜브 URL 등록 후 공개 페이지에서 영상이 재생된다.
- 모바일에서 표, 갤러리, 주보 이미지가 화면 밖으로 깨지지 않는다.
