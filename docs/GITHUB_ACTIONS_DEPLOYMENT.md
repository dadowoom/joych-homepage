# GitHub Actions 자동배포 설정

이 문서는 기쁨의교회 홈페이지의 GitHub Actions 자동배포 설정 방법을 정리합니다.

## 구성

- `CI`: PR 또는 브랜치 push 시 `pnpm check`, `pnpm test`, `pnpm build` 실행
- `Deploy Production`: `main` 브랜치 push 또는 수동 실행 시 운영 서버 배포

배포 흐름은 다음과 같습니다.

1. GitHub Actions에서 의존성 설치
2. 타입 체크
3. 테스트
4. 프로덕션 빌드
5. `dist`, `package.json`, `pnpm-lock.yaml`, `patches`를 tar 파일로 묶음
6. SSH로 운영 서버 `/tmp`에 업로드
7. 서버에서 기존 `dist` 백업
8. 새 빌드 산출물 반영
9. 프로덕션 의존성 설치
10. PM2 앱 재시작
11. 헬스체크

## GitHub Secrets

GitHub 저장소의 `Settings > Secrets and variables > Actions`에서 아래 값을 등록합니다.

### 필수 Secrets

- `JOYCH_SSH_HOST`: 운영 서버 IP 또는 호스트명
- `JOYCH_SSH_USER`: 배포용 SSH 사용자
- `JOYCH_SSH_PRIVATE_KEY`: 배포용 SSH private key

### 선택 Secrets

- `JOYCH_SSH_PORT`: SSH 포트. 미설정 시 `22`

## GitHub Variables

필요하면 `Settings > Secrets and variables > Actions > Variables`에 아래 값을 등록할 수 있습니다.

- `JOYCH_APP_DIR`: 운영 서버 앱 경로. 기본값 `/var/www/joych-homepage`
- `JOYCH_PM2_APP`: PM2 앱 이름. 기본값 `joych-homepage`
- `JOYCH_HEALTHCHECK_URL`: 배포 후 확인 URL. 기본값 `https://dadowoomtest.co.kr/api/public-config`

## SSH Key 권장 방식

운영 서버 비밀번호를 GitHub에 저장하는 방식보다 SSH key 방식이 안전합니다.

1. 로컬 또는 서버에서 배포용 key 생성
2. public key를 서버 배포 계정의 `~/.ssh/authorized_keys`에 등록
3. private key를 GitHub Secret `JOYCH_SSH_PRIVATE_KEY`에 등록

운영 서버 root 비밀번호는 GitHub Secrets에 넣지 않는 것을 권장합니다.

## 배포 정책

- `main` 브랜치에 반영되면 자동 배포됩니다.
- 수동 배포가 필요하면 GitHub Actions의 `Deploy Production`에서 `Run workflow`를 실행합니다.
- 배포 실패 시 서버의 이전 `dist` 백업으로 자동 복구를 시도합니다.

## 주의사항

- DB 스키마 변경은 자동 배포에 포함하지 않았습니다.
- DB 변경이 필요한 작업은 별도 마이그레이션 계획과 백업 후 진행해야 합니다.
- 업로드 파일과 `.env`는 배포 산출물에 포함하지 않습니다.
