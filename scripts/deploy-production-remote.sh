#!/usr/bin/env bash
set -Eeuo pipefail

: "${APP_DIR:?APP_DIR is required}"
: "${ARTIFACT:?ARTIFACT is required}"
: "${PM2_APP:?PM2_APP is required}"

HEALTHCHECK_URL="${HEALTHCHECK_URL:-http://127.0.0.1:3000/api/public-config}"
BACKUP_DIR=""

restart_pm2() {
  if [[ -x /usr/local/bin/joych-pm2-restart ]]; then
    sudo -n /usr/local/bin/joych-pm2-restart "${PM2_APP}"
  else
    pm2 restart "${PM2_APP}" --update-env
  fi
}

rollback() {
  if [[ -z "${BACKUP_DIR}" || ! -d "${BACKUP_DIR}" ]]; then
    echo "[deploy] rollback skipped: backup directory was not created"
    return
  fi

  echo "[deploy] rollback: restoring previous dist from ${BACKUP_DIR}"
  if [[ -d "${BACKUP_DIR}/dist" ]]; then
    rm -rf "${APP_DIR}/dist"
    cp -a "${BACKUP_DIR}/dist" "${APP_DIR}/dist"
  fi
  if [[ -f "${BACKUP_DIR}/package.json" ]]; then
    cp "${BACKUP_DIR}/package.json" "${APP_DIR}/package.json"
  fi
  if [[ -f "${BACKUP_DIR}/pnpm-lock.yaml" ]]; then
    cp "${BACKUP_DIR}/pnpm-lock.yaml" "${APP_DIR}/pnpm-lock.yaml"
  fi

  restart_pm2 || true
}

on_error() {
  local exit_code=$?
  trap - ERR
  echo "[deploy] failed with exit code ${exit_code}"
  rollback
  exit "${exit_code}"
}

trap on_error ERR

if [[ ! -d "${APP_DIR}" ]]; then
  echo "[deploy] APP_DIR does not exist: ${APP_DIR}" >&2
  exit 1
fi

if [[ ! -f "${ARTIFACT}" ]]; then
  echo "[deploy] artifact does not exist: ${ARTIFACT}" >&2
  exit 1
fi

cd "${APP_DIR}"

TS="$(date +%Y%m%d_%H%M%S)"
BACKUP_DIR="${APP_DIR}/backups/deploy_${TS}"

echo "[deploy] backup current runtime files"
mkdir -p "${BACKUP_DIR}"
if [[ -d "${APP_DIR}/dist" ]]; then
  cp -a "${APP_DIR}/dist" "${BACKUP_DIR}/dist"
fi
if [[ -f "${APP_DIR}/package.json" ]]; then
  cp "${APP_DIR}/package.json" "${BACKUP_DIR}/package.json"
fi
if [[ -f "${APP_DIR}/pnpm-lock.yaml" ]]; then
  cp "${APP_DIR}/pnpm-lock.yaml" "${BACKUP_DIR}/pnpm-lock.yaml"
fi

echo "[deploy] extract artifact"
tar -xzf "${ARTIFACT}" -C "${APP_DIR}"

echo "[deploy] install production dependencies"
if command -v pnpm >/dev/null 2>&1; then
  pnpm install --prod --frozen-lockfile
else
  npm install --omit=dev
fi

echo "[deploy] restart pm2 app"
restart_pm2
sleep 4

echo "[deploy] healthcheck: ${HEALTHCHECK_URL}"
curl -fsS "${HEALTHCHECK_URL}" >/dev/null

rm -f "${ARTIFACT}"

trap - ERR
echo "[deploy] ok backup=${BACKUP_DIR}"
