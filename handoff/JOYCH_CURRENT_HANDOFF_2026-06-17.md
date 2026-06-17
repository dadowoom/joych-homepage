# 기쁨의교회 홈페이지 인수인계 메모

작성일: 2026-06-17

## 현재 기준

- 레포: https://github.com/dadowoom/joych-homepage
- 작업 브랜치: `codex/signup-hardening`
- 운영 도메인: https://newjoych.co.kr
- 관리자 주소: https://newjoych.co.kr/admin_joych_2026
- 운영 서버 앱: `joych-homepage`
- 운영 서버 경로: `/var/www/joych-homepage`

민감정보는 이 문서와 Git에 남기지 않는다. 서버, DB, OAuth 키, 비밀번호는 별도 보안 채널로만 확인한다.

## 다른 PC에서 이어받기

```powershell
git clone https://github.com/dadowoom/joych-homepage.git
cd joych-homepage
git fetch origin --prune
git switch codex/signup-hardening
git pull --ff-only origin codex/signup-hardening
npx pnpm@10.33.4 install
```

검증:

```powershell
npx pnpm@10.33.4 check
npx pnpm@10.33.4 test
npx pnpm@10.33.4 build
git diff --check
```

## 이번 작업 묶음

### 게시판/공지/접수 화면

- 공지사항, 행정자료, 탐방신청, 자막신청 등 게시판형 화면을 같은 게시판 구조로 맞추는 작업이 포함되어 있다.
- 공지사항은 공지/부고/결혼 분류를 사용한다.
- 공지사항/행정자료는 권한 받은 성도만 글 작성이 가능하도록 정리하는 흐름이다.
- 탐방신청은 비로그인 사용자도 작성 가능해야 한다.
- 게시판 본문 편집을 위해 공통 rich text editor 컴포넌트가 추가되어 있다.

### 갤러리

- 최근 행사 사진은 앨범 단위로 묶어 표시한다.
- 앨범 목록에서 클릭하면 별도 상세 화면으로 들어가고, 상세에서 사진이 세로로 이어진다.
- 사진 업로드 후 자동으로 상세 화면으로 이동하지 않고 목록에 남는 흐름을 목표로 한다.
- 앨범 설명/본문 작성 기능을 위한 DB 필드와 화면 코드가 추가되어 있다.
- 앨범 순서, 앨범 내부 사진 순서 변경 흐름을 유지한다.

### 유튜브/영상 관리

- 영상 관리 권한을 받은 사용자가 공개 화면에서 영상 패널을 열고 영상을 관리하는 흐름이 들어 있다.
- 우측 패널은 영상 화면에서만 동작하도록 계속 확인해야 한다.

### 예약

- 반복 예약은 개별 날짜 52개가 아니라 신청 1건 단위로 묶어서 보이도록 정리되어 있다.
- 반복 옵션은 종료일 기준으로 매일/매주/매월 계열을 처리하는 방향이다.
- 예약 승인 관리에서 묶음 예약을 펼쳐 보고 승인/거절/취소/수정할 수 있는지 확인해야 한다.

### 메뉴/권한

- 하위 메뉴별 읽기 권한을 최소 접근 등급 방식으로 관리하는 작업이 포함되어 있다.
- 기준은 타교인부터, 성도부터 같은 단순 등급 구조다.
- 메뉴가 추가되면 권한 관리에도 자동 반영되는 방향으로 구성한다.

### 섬기는 분/장로/복지재단

- 섬기는 분 정렬 순서는 신규 등록 시 다음 번호가 자동으로 들어가고, 중간 번호 수정 시 뒤 번호가 밀리는 흐름이다.
- 장로는 원로장로/은퇴장로/시무장로/휴무장로 구분이 유지되어야 한다.
- 장로 정렬은 전체 1번부터가 아니라 각 구분 안에서 1번부터 정렬되는 것이 목표다.
- 사회복지법인 기쁨의복지재단도 사역 구분을 관리하고, 구분별 정렬이 동작해야 한다.

## 새 DB 마이그레이션 확인

운영 반영 시 아래 파일 적용 여부를 확인한다.

- `drizzle/0035_menu_read_permissions.sql`
- `drizzle/0036_gallery_album_description.sql`
- `drizzle/0037_restore_elder_title_order.sql`

이미 운영 DB에 적용된 마이그레이션은 중복 적용하지 않는다. 적용 전에는 서버에서 현재 마이그레이션 상태를 확인한다.

## 운영 확인 체크리스트

- Google/Kakao 로그인: 새 도메인 `newjoych.co.kr`, `www.newjoych.co.kr`의 OAuth redirect URI 등록 상태 확인
- 카카오맵: 기쁨의교회 명칭과 지도 표시 위치 확인
- 공지사항: 권한 있는 계정으로 글 작성/수정/삭제 확인
- 탐방신청: 비로그인 작성 가능 확인
- 행정자료: 비로그인은 글 작성 불가, 권한 계정은 작성 가능 확인
- 자막신청/주보 광고신청: 로그인 성도 작성 및 관리자 접수 확인
- 갤러리: 사진 업로드, 앨범 설명 작성, 앨범 상세 진입, 사진 순서 변경 확인
- 영상: 영상 관리 권한 계정으로 공개 화면 관리 패널 동작 확인
- 예약: 반복 예약 1건 묶음 표시, 승인/거절/취소/수정 버튼 확인
- 섬기는 분: 장로 구분 복구, 구분별 정렬, 중간 정렬 번호 삽입 확인

## 다른 교회 이식용 자료

아래 폴더는 다른 작업자가 게시판/갤러리/유튜브 기능을 참고하거나 이식할 때 쓰는 자료다.

- `handoff/joych-board-gallery-youtube-kit/`
- `handoff/joych-board-gallery-youtube-kit-20260612/`
- `handoff/joych-cms-copy-kit/`

각 폴더의 `README.md`, `FILE_MAP.md`, `PORTING_CHECKLIST.md`, `CODEX_PROMPT.md`를 먼저 읽고 이식한다.
