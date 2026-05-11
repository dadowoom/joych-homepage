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
cd /var/www/joych-homepage-src
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
27 4 * * * cd /var/www/joych-homepage-src && set -a && . /var/www/joych-homepage/.env && set +a && JOYCH_APP_DIR=/var/www/joych-homepage JOYCH_BACKUP_DIR=/var/backups/joych-homepage JOYCH_BACKUP_KEEP_DAYS=30 node scripts/backup-joych-production.mjs >> /var/log/joych-homepage-backup.log 2>&1
```

백업 결과는 `/var/backups/joych-homepage/joych-YYYYMMDD.../` 아래에 저장됩니다.

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
