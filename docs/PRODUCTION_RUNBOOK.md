# 기쁨의교회 홈페이지 운영 체크리스트

이 문서는 운영 서버에서 반복 확인해야 하는 기본 항목만 정리합니다. 비밀번호, DB 접속 문자열, 관리자 계정 정보는 이 문서나 저장소에 기록하지 않습니다.

## 배포 후 확인

- `pm2 status`에서 `joych-homepage`가 `online`인지 확인합니다.
- `https://dadowoomtest.co.kr/`가 `200 OK`인지 확인합니다.
- `https://dadowoomtest.co.kr/robots.txt`가 `text/plain`으로 내려오는지 확인합니다.
- `https://dadowoomtest.co.kr/sitemap.xml`가 `application/xml` 또는 XML 본문으로 내려오는지 확인합니다.
- `https://dadowoomtest.co.kr/__manus__/debug-collector.js`가 노출되지 않는지 확인합니다.
- `nginx -t`에서 `syntax is ok`와 `test is successful`이 출력되는지 확인합니다. `conflicting server name` 경고가 있으면 중복 설정 파일을 정리합니다.

## 백업

운영 서버에서는 `scripts/backup-joych-production.mjs`를 주기 실행합니다.

예시:

```bash
cd /var/www/joych-homepage
set -a
. /var/www/joych-homepage/.env
set +a
JOYCH_APP_DIR=/var/www/joych-homepage \
JOYCH_BACKUP_DIR=/var/backups/joych-homepage \
JOYCH_BACKUP_KEEP_DAYS=30 \
node scripts/backup-joych-production.mjs
```

권장 크론:

```cron
27 4 * * * cd /var/www/joych-homepage && set -a && . /var/www/joych-homepage/.env && set +a && JOYCH_APP_DIR=/var/www/joych-homepage JOYCH_BACKUP_DIR=/var/backups/joych-homepage JOYCH_BACKUP_KEEP_DAYS=30 node scripts/backup-joych-production.mjs >> /var/log/joych-homepage-backup.log 2>&1
```

백업 결과는 `/var/backups/joych-homepage/joych-YYYYMMDD.../` 아래에 저장됩니다.

백업은 MySQL 연결 기반 전용 잠금과 파일 잠금으로 중복 실행을 이중 차단하고, 디스크 여유 검사를 거친 뒤 `.partial-*` 디렉터리에서 만듭니다. DB·업로드·manifest가 모두 완성된 경우에만 최종 디렉터리로 전환합니다. 서버나 프로세스가 비정상 종료되면 MySQL 잠금은 연결 종료와 함께 자동 해제되며, 이 잠금을 획득한 단 하나의 백업만 오래된 파일 잠금을 복구할 수 있습니다. 새 환경변수의 기본값과 의미는 다음과 같습니다.

- `UPLOAD_DIR=uploads`: 실제 업로드 루트입니다. 상대 경로는 웹 서버와 동일하게 실행 작업 디렉터리(`process.cwd()`) 기준으로 해석합니다. 운영에서는 혼동을 막기 위해 절대 경로 사용을 권장합니다.
- `JOYCH_BACKUP_MIN_SAFE_COUNT=2`: 공간 정리 중에도 남겨 둘 완전한 기존 백업의 최소 개수입니다.
- `JOYCH_BACKUP_MIN_FREE_BYTES=1073741824`: 백업을 시작한 뒤에도 남겨 둘 디스크 여유 공간(기본 1 GiB)입니다.
- `JOYCH_BACKUP_ALLOW_SPACE_PRUNE=0`: 기본값은 보존 기간이 지난 백업만 정리합니다. 공간 부족 시 보존 기간 안의 오래된 완전 백업까지 정리하려면 명시적으로 `1`을 설정해야 하며, 어느 경우에도 위의 최소 안전 개수 아래로 삭제하지 않습니다.
- `JOYCH_BACKUP_LOCK_STALE_HOURS=36`: 실행 중인 백업은 잠금에 주기적으로 생존 표시를 남깁니다. 같은 서버에서 잠금 소유 프로세스가 종료된 것이 확인되면 즉시, 그 밖의 경우에는 이 표시가 기본 36시간 이상 멈췄을 때만 오래된 잠금으로 복구합니다.
- `JOYCH_BACKUP_ABORT_EXIT_SECONDS=30`: 백업 도중 DB 전용 잠금 연결이 끊긴 뒤 정리가 이 시간 안에 끝나지 않으면, 홈페이지 서버가 아닌 해당 백업 프로세스만 종료해 멈춘 파일 작업과 잠금이 다음 실행을 영구 차단하지 않게 합니다.

## 운영 DB 마이그레이션 안전 규칙

운영 DB에서는 `drizzle-kit migrate`, `pnpm exec drizzle-kit migrate`, `pnpm db:push`를 직접 실행하지 않습니다. 기존 운영 DB는 과거 SQL이 별도 배포 기록으로 이미 반영되어 있어, 검증 없이 일반 Drizzle 마이그레이션을 실행하면 같은 변경이 다시 적용될 수 있습니다. 안전 래퍼도 빈 신규 DB이거나, 현재 스키마가 기준 마이그레이션까지 반영되었음을 별도로 검증한 뒤 Drizzle의 시간과 해시가 일치하는 baseline이 승인·기록된 DB에서만 실행을 허용하며 baseline을 자동으로 만들지 않습니다.

## 파일 권한

- `/var/www/joych-homepage/.env`: `600`
- `/var/www/joych-homepage/ecosystem.config.cjs`: 비밀값이 포함되어 있으면 `600`
- `/root/.pm2/dump.pm2`: PM2 환경변수가 저장될 수 있으므로 `600`
- `/var/backups/joych-homepage`: `700`

## 보안 운영 메모

- 운영 편의를 위해 공유했던 서버, DB, 관리자 비밀번호는 납품 전 반드시 교체합니다.
- SSH는 장기적으로 root 비밀번호 로그인을 끄고, 별도 배포 계정 + SSH 키 방식으로 운영합니다.
- DB 포트는 공개 인터넷 전체에 열지 않습니다. 필요한 출발지 IP만 허용하거나 내부망/방화벽으로 제한합니다.
- 관리자 주소를 숨기는 것은 보조 수단입니다. 실제 보안은 서버 API 권한 검사와 강한 비밀번호, 실패 제한, 세션 보안으로 유지합니다.
