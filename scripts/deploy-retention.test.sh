#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
# shellcheck disable=SC1091
. "${SCRIPT_DIR}/deploy-retention.sh"

fail() {
  echo "[deploy-retention-test] $*" >&2
  exit 1
}

assert_exists() {
  [[ -e "$1" ]] || fail "expected path to exist: $1"
}

assert_missing() {
  [[ ! -e "$1" ]] || fail "expected path to be absent: $1"
}

TEMP_BASE="${TMPDIR:-/tmp}"
TEST_ROOT="$(mktemp -d "${TEMP_BASE%/}/joych-deploy-retention.XXXXXX")"
TEMP_BASE="$(cd "${TEMP_BASE}" && pwd -P)"
TEST_ROOT="$(cd "${TEST_ROOT}" && pwd -P)"

cleanup() {
  case "${TEST_ROOT}" in
    "${TEMP_BASE}"/joych-deploy-retention.*) rm -rf -- "${TEST_ROOT}" ;;
    *) echo "[deploy-retention-test] refusing unsafe cleanup path: ${TEST_ROOT}" >&2 ;;
  esac
}
trap cleanup EXIT

DEPLOY_BACKUP_MIN_COUNT=3
DEPLOY_BACKUP_MAX_COUNT=5
DEPLOY_BACKUP_MAX_AGE_DAYS=30
ASSET_PRIOR_RELEASE_MIN_COUNT=2
ASSET_PRIOR_RELEASE_MAX_COUNT=7
ASSET_PRIOR_RELEASE_MAX_AGE_DAYS=14
deploy_retention_validate_config

backup_app="${TEST_ROOT}/backup-app"
mkdir -p "${backup_app}/backups/data-migrations" "${backup_app}/uploads"
echo keep > "${backup_app}/backups/data-migrations/migration-backup.json"
echo keep > "${backup_app}/uploads/production-upload.jpg"

backup_names=(
  deploy_20260101_000001
  deploy_20260102_000001
  deploy_20260103_000001
  deploy_20260104_000001
  deploy_20260105_000001
  deploy_20260106_000001
  deploy_20260107_000001
  deploy_20260108_000001
)
for name in "${backup_names[@]}"; do
  mkdir -p "${backup_app}/backups/${name}"
done
touch -d "45 days ago" \
  "${backup_app}/backups/${backup_names[0]}" \
  "${backup_app}/backups/${backup_names[1]}"

current_backup="${backup_app}/backups/${backup_names[7]}"
deploy_retention_prune_backups "${backup_app}" "${current_backup}"

assert_missing "${backup_app}/backups/${backup_names[0]}"
assert_missing "${backup_app}/backups/${backup_names[1]}"
assert_missing "${backup_app}/backups/${backup_names[2]}"
for name in "${backup_names[@]:3}"; do
  assert_exists "${backup_app}/backups/${name}"
done
assert_exists "${backup_app}/backups/data-migrations/migration-backup.json"
assert_exists "${backup_app}/uploads/production-upload.jpg"

asset_app="${TEST_ROOT}/asset-app"
asset_root="${asset_app}/dist/public/assets"
mkdir -p "${asset_root}" "${asset_app}/backups"
echo current > "${asset_root}/current-hash.js"

prior_one="${asset_app}/backups/deploy_20260203_000001"
prior_two="${asset_app}/backups/deploy_20260202_000001"
prior_old="${asset_app}/backups/deploy_20260101_000001"
for backup in "${prior_one}" "${prior_two}" "${prior_old}"; do
  mkdir -p "${backup}/dist/public/assets"
done

printf '%s\n' prior-entry.js prior-lazy.js > "${prior_one}/.deploy-assets-manifest"
echo one > "${prior_one}/dist/public/assets/prior-entry.js"
echo lazy > "${prior_one}/dist/public/assets/prior-lazy.js"
echo stale > "${prior_one}/dist/public/assets/unlisted-stale.js"

echo prior-two.js > "${prior_two}/.deploy-assets-manifest"
echo two > "${prior_two}/dist/public/assets/prior-two.js"

echo too-old.js > "${prior_old}/.deploy-assets-manifest"
echo old > "${prior_old}/dist/public/assets/too-old.js"
touch -d "45 days ago" "${prior_old}"

deploy_retention_preserve_assets "${asset_app}" "${prior_one}"

assert_exists "${asset_root}/current-hash.js"
assert_exists "${asset_root}/prior-entry.js"
assert_exists "${asset_root}/prior-lazy.js"
assert_exists "${asset_root}/prior-two.js"
assert_missing "${asset_root}/unlisted-stale.js"
assert_missing "${asset_root}/too-old.js"
[[ "$(cat "${asset_app}/.deploy-assets-manifest")" == "current-hash.js" ]] || \
  fail "current release manifest included a preserved asset"

fallback_app="${TEST_ROOT}/fallback-app"
fallback_assets="${fallback_app}/dist/public/assets"
fallback_backup="${fallback_app}/backups/deploy_20260204_000001"
mkdir -p "${fallback_assets}" "${fallback_backup}/dist/public/assets"
echo current > "${fallback_assets}/current.js"
echo previous > "${fallback_backup}/dist/public/assets/previous.js"
deploy_retention_preserve_assets "${fallback_app}" "${fallback_backup}"
assert_exists "${fallback_assets}/previous.js"
[[ "$(cat "${fallback_app}/.deploy-assets-manifest")" == "current.js" ]] || \
  fail "fallback assets leaked into the current release manifest"
deploy_retention_restore_asset_manifest "${fallback_app}" "${fallback_backup}"
assert_missing "${fallback_app}/.deploy-assets-manifest"

echo previous.js > "${fallback_backup}/.deploy-assets-manifest"
echo replacement.js > "${fallback_app}/.deploy-assets-manifest"
deploy_retention_restore_asset_manifest "${fallback_app}" "${fallback_backup}"
[[ "$(cat "${fallback_app}/.deploy-assets-manifest")" == "previous.js" ]] || \
  fail "rollback did not restore the previous release manifest"

failure_app="${TEST_ROOT}/failure-app"
mkdir -p "${failure_app}/backups"
for index in 1 2 3 4 5 6; do
  mkdir -p "${failure_app}/backups/deploy_2026030${index}_000001"
done
deploy_retention_remove_backup() {
  return 1
}
if deploy_retention_prune_backups \
  "${failure_app}" \
  "${failure_app}/backups/deploy_20260306_000001"; then
  fail "backup prune should propagate a removal failure"
fi

echo "[deploy-retention-test] ok"
