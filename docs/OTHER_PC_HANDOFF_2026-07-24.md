# 기쁨의교회 홈페이지 다른 PC 작업 인수인계

작성일: 2026-07-24

저장소: `https://github.com/dadowoom/joych-homepage.git`

기본 브랜치: `main`

운영 대표 주소: `https://www.joych.org`

## 1. 확인된 기준 상태

- 인수인계 직전 기능 커밋: `2d98539 fix: move worship beta menu under church intro`
- 작성 시점의 `main`과 `origin/main`은 완전히 동기화되어 있었다.
- 해당 기능 커밋의 GitHub Actions `CI`와 `Deploy Production`은 모두 성공했다.
- 추적된 미커밋 소스 변경은 없었다.
- 이 문서가 추가된 뒤에는 커밋 번호를 고정값으로 믿지 말고 항상 `origin/main`의 최신 커밋을 기준으로 작업한다.

최근 주요 작업:

1. 관리자 전용 `예배시간(beta)`를 `교회소개` 2단 메뉴로 이동
2. 팝업에 유튜브 등 외부 URL 연결 지원
3. 관리자 전용 예배시간 beta 페이지와 인라인 편집 추가
4. 공개 개인정보처리방침과 가입 화면 연결
5. 카카오 간편가입 시 카카오 계정 이름 사전 입력
6. 주보 페이지별 이미지 삭제·교체
7. 비밀번호 초기화 전에 가입 이메일 전체 확인
8. 행사사진 앨범 생성·대표사진 선택 방식 추가
9. 탐방·주보광고·자막 신청자가 본인 글에서 수정·삭제 가능
10. 구 미디어 사진 프록시 및 여러 이미지 주소 일괄 입력
11. 구 간증·하영인·찬양 영상 자료 이관
12. 강좌 임의 일정 선택 권한 제한

## 2. 다른 PC에서 처음 준비할 때

PowerShell에서 실행한다.

```powershell
git clone https://github.com/dadowoom/joych-homepage.git
cd joych-homepage
git switch main
git fetch --prune origin
git pull --ff-only
git status --short --branch
git log -1 --oneline
```

권장 개발 환경:

- Node.js 22
- pnpm 10.33.4

의존성이 설치되어 있지 않을 때만 실행한다.

```powershell
corepack enable
corepack prepare pnpm@10.33.4 --activate
pnpm install --frozen-lockfile
```

로컬 실행에는 별도의 `.env`가 필요할 수 있다. `.env` 값은 GitHub에 없으므로 기존의 안전한 비밀 저장소에서 별도로 전달받는다.

- `.env.example`에는 필요한 환경변수 이름만 있다.
- 비밀번호, DB 접속정보, SSH 키, OAuth 비밀값을 채팅·코드·문서·커밋에 기록하지 않는다.
- 운영 서버의 `.env`, 업로드 파일, DB 데이터는 Git 배포로 덮어쓰거나 삭제하지 않는다.

## 3. 새 작업에 그대로 붙여 넣을 지시문

```text
기쁨의교회 홈페이지 작업을 이어서 진행한다.

프로젝트:
- GitHub: https://github.com/dadowoom/joych-homepage.git
- 기본 브랜치: main
- 운영 대표 주소: https://www.joych.org
- newjoych.co.kr은 기존 PWA와 소셜 로그인 호환을 위해 일부 코드와 환경설정에서 유지될 수 있으므로 임의로 제거하지 않는다.

작업 시작 전 반드시:
1. git fetch --prune origin
2. git status --short --branch
3. git pull --ff-only
4. git log -1 --oneline
5. 실제 코드, 현재 라우트, 웹·모바일 운영 화면을 먼저 확인한다.

작업 방식:
1. 한 번에 최대 2개 요청만 처리한다.
2. 요청번호가 있으면 완료 답변에 “몇 번 완료”인지 반드시 명시한다.
3. 추측으로 수정하지 말고 실제 코드와 현재 화면을 확인한 뒤 작업한다.
4. 분석·확인만 요청받으면 읽기 전용으로 원인과 영향 범위만 보고하고, 소스 수정이나 배포는 하지 않는다.
5. 실제 소스 변경 요청은 구현, 검증, 커밋, origin/main push, GitHub Actions 운영 배포 확인까지 마무리한다.
6. 로그인, 권한, 예약, 메뉴, 게시판, 라우팅 변경은 서버 권한 검사와 웹·모바일 영향 범위를 함께 확인한다.
7. 기존 사용자 변경사항과 미추적 파일은 삭제하거나 되돌리지 않는다.
8. git reset --hard, git clean, 무분별한 git checkout 사용은 금지한다.
9. 비전공자가 이해할 수 있는 쉬운 말로 결과를 설명한다.

기존 운영 원칙:
- GitHub 최신 상태와 실제 운영 서버 배포 상태는 별개로 확인한다.
- 내부 joych 주소는 현재 창 이동, 외부 URL은 새 창 이동이 원칙이다.
- 메뉴 읽기권한이 성도 공개이면 비로그인 사용자는 메뉴를 볼 수 있어야 하고, 페이지에서는 성도 로그인 안내가 떠야 한다.
- 운영 대표 도메인은 www.joych.org이다.
- newjoych.co.kr은 기존 PWA·OAuth 호환 영향이 있으므로 PUBLIC_URL_BASE나 도메인 관련 코드를 추측으로 바꾸지 않는다.
- 예배시간(beta)는 관리자에게만 교회소개의 2단 메뉴로 보여야 한다.
- 공식 예배시간 공개 페이지와 beta 페이지를 혼동하지 않는다.

검증:
- 실제 소스 변경 후 npm.cmd run check
- 관련 테스트 또는 npm.cmd test
- npm.cmd run build
- git diff --check
- git status --short --branch
- 변경 기능은 가능한 범위에서 실제 브라우저로 웹·모바일 동작을 확인한다.
- 실패 상태로 커밋하거나 배포하지 않는다.

커밋:
- git add . 또는 git add -A를 사용하지 않는다.
- 실제로 수정한 소스 파일만 경로를 명시해 stage한다.
- 커밋 전에 git diff, git diff --cached, git status를 확인한다.
- 간결한 영문 Conventional Commit 형식을 사용한다.
- push 직전 git fetch --prune origin을 다시 실행하고 origin/main과 충돌이 없는지 확인한다.

커밋에서 제외하고 보존할 것:
- handoff/ 전체
- 감사용 ZIP, 감사 폴더, 전달용 이미지
- tmp-*.tar.gz
- .codex_tmp*, .codex_status*
- 기존 미추적 감사 문서와 임시 산출물
- .env* 및 모든 비밀번호·DB·SSH·OAuth 비밀값
이 파일은 커밋하지 않을 뿐 아니라 삭제·이동·되돌리지도 않는다.

배포:
- main push 시 GitHub Actions의 CI와 Deploy Production이 자동 실행된다.
- 두 워크플로가 모두 success인지 확인한 뒤 운영 화면도 확인한다.
- 운영 배포는 GitHub Actions를 기본으로 사용하고 서버 파일을 직접 덮어쓰지 않는다.
- 새 DB 변경은 drizzle SQL과 scripts/deploy-production-remote.sh의 배포 마이그레이션 흐름을 함께 확인한다.
- pnpm db:push, 임의 SQL, 운영 DB 수정은 사용자 명시 승인 없이 실행하지 않는다.
- Nginx, DNS, SSL 인증서, 방화벽은 사용자가 명시하지 않으면 절대 변경하지 않는다.
- 배포 실패 시 서버나 DB를 무작정 건드리지 말고 로그, 원인, 영향 범위를 먼저 확인한다.

완료 답변:
- 완료 항목
- 확인 방법
- 검증 결과
- 배포 여부와 커밋 해시
중심으로 짧게 보고한다.
```

## 4. 검증과 배포의 실제 기준

로컬 검증:

```powershell
npm.cmd run check
npm.cmd test
npm.cmd run build
git diff --check
```

GitHub Actions의 실제 CI 순서:

1. Node.js 22와 pnpm 10.33.4 준비
2. `pnpm install --frozen-lockfile`
3. `pnpm check`
4. `pnpm test`
5. `pnpm build`

`main`에 push하면 다음 워크플로가 자동 실행된다.

- `CI`
- `Deploy Production`

운영 배포 워크플로는 빌드 산출물 생성, SSH 업로드, 기존 `dist` 백업, 운영 의존성 설치, 등록된 마이그레이션, PM2 재시작, 헬스체크, PWA 도메인 브리지 확인을 수행한다. 일반 작업에서는 오래된 수동 배포 스크립트보다 GitHub Actions를 우선한다.

GitHub Actions에서 사용하는 Secret과 Variable의 실제 값은 저장소에 기록하지 않는다. 필요한 이름과 현재 배포 절차는 아래 파일을 기준으로 확인한다.

- `.github/workflows/ci.yml`
- `.github/workflows/deploy-production.yml`
- `scripts/deploy-production-remote.sh`
- `.env.example`

## 5. 주의 사항

- `README.md`에는 오래된 설명과 인코딩이 깨진 부분이 있으므로 단독 인수인계 문서로 사용하지 않는다.
- 배포 방법은 실제 `.github/workflows/deploy-production.yml`을 최우선 기준으로 삼는다.
- 새 DB 변경이 자동 반영되는지는 `scripts/deploy-production-remote.sh`를 반드시 확인한다.
- 관리자 기능은 관리자 권한 상태에서, 공개 기능은 비로그인 상태에서도 확인한다.
- 캐시 문제로 단정하기 전에 배포 커밋, HTTP 상태, 라우트, 권한, 브라우저 콘솔과 네트워크를 순서대로 확인한다.
