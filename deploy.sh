#!/bin/bash
# ============================================================
#  기쁨의교회 홈페이지 자동 배포 스크립트
#  사용법: ./deploy.sh
#  서버: 115.68.224.123 (iwinv)
#  경로: /var/www/joych-homepage
# ============================================================

set -e  # 오류 발생 시 즉시 중단

# ── 설정 ────────────────────────────────────────────────────
SERVER_IP="115.68.224.123"
SERVER_USER="${SERVER_USER:-root}"
SERVER_PATH="/var/www/joych-homepage"
PM2_APP="joych-homepage"
PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"

# ── 색상 출력 헬퍼 ──────────────────────────────────────────
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

step() { echo -e "\n${YELLOW}▶ $1${NC}"; }
ok()   { echo -e "${GREEN}✓ $1${NC}"; }
fail() { echo -e "${RED}✗ $1${NC}"; exit 1; }

# ── sshpass 설치 확인 ────────────────────────────────────────
if ! command -v sshpass &> /dev/null; then
  step "sshpass 설치 중..."
  sudo apt-get install -y sshpass -q || fail "sshpass 설치 실패"
fi

if [ -z "${SERVER_PASS:-}" ]; then
  fail "SERVER_PASS 환경변수를 설정한 뒤 실행하세요. 예: SERVER_PASS='...' ./deploy.sh"
fi

SSH="sshpass -p '${SERVER_PASS}' ssh -o StrictHostKeyChecking=no ${SERVER_USER}@${SERVER_IP}"
SCP="sshpass -p '${SERVER_PASS}' scp -o StrictHostKeyChecking=no -r"

echo ""
echo "============================================"
echo "  기쁨의교회 홈페이지 배포 시작"
echo "  $(date '+%Y-%m-%d %H:%M:%S')"
echo "============================================"

# ── 1단계: 빌드 ─────────────────────────────────────────────
step "1단계: 프로젝트 빌드 중..."
cd "$PROJECT_DIR"
pnpm build || fail "빌드 실패"
ok "빌드 완료"

# ── 2단계: 서버에 dist 폴더 전송 ────────────────────────────
step "2단계: 빌드 파일 서버 전송 중..."

# 기존 dist 백업 (서버에서)
eval "$SSH \"cp -r ${SERVER_PATH}/dist ${SERVER_PATH}/dist.bak 2>/dev/null || true\""

# dist 폴더 전송
eval "$SCP ${PROJECT_DIR}/dist/ ${SERVER_USER}@${SERVER_IP}:${SERVER_PATH}/dist/" \
  || fail "파일 전송 실패"
ok "파일 전송 완료"

# ── 3단계: package.json 전송 (의존성 변경 시 필요) ──────────
step "3단계: package.json 전송 중..."
eval "$SCP ${PROJECT_DIR}/package.json ${SERVER_USER}@${SERVER_IP}:${SERVER_PATH}/package.json" \
  || fail "package.json 전송 실패"
ok "package.json 전송 완료"

# ── 4단계: PM2 재시작 ────────────────────────────────────────
step "4단계: 서버 재시작 중..."
eval "$SSH \"pm2 restart ${PM2_APP} --update-env && pm2 save\"" \
  || fail "PM2 재시작 실패"
ok "서버 재시작 완료"

# ── 5단계: 배포 확인 ─────────────────────────────────────────
step "5단계: 배포 확인 중..."
sleep 3  # 서버 시작 대기

HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://dadowoomtest.co.kr/ --max-time 10)

if [ "$HTTP_STATUS" = "200" ]; then
  ok "배포 확인 완료 (HTTP $HTTP_STATUS)"
else
  echo -e "${YELLOW}⚠ HTTP 상태: $HTTP_STATUS (서버가 아직 시작 중일 수 있습니다)${NC}"
fi

# ── 완료 ─────────────────────────────────────────────────────
echo ""
echo "============================================"
echo -e "${GREEN}  배포 완료!${NC}"
echo "  주소: https://dadowoomtest.co.kr"
echo "  시각: $(date '+%Y-%m-%d %H:%M:%S')"
echo "============================================"
echo ""
