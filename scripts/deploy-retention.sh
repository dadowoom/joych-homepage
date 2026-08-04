#!/usr/bin/env bash

# Retention helpers for deploy-production-remote.sh. This file is sourced by
# the remote deploy after the new artifact has been extracted.

deploy_retention_require_integer() {
  local name="$1"
  local value="$2"
  local minimum="$3"

  if [[ ! "${value}" =~ ^[0-9]+$ ]] || (( value < minimum )); then
    echo "[deploy] ${name} must be an integer greater than or equal to ${minimum}; got '${value}'" >&2
    return 1
  fi
}

deploy_retention_validate_config() {
  deploy_retention_require_integer "DEPLOY_BACKUP_MIN_COUNT" "${DEPLOY_BACKUP_MIN_COUNT}" 1
  deploy_retention_require_integer "DEPLOY_BACKUP_MAX_COUNT" "${DEPLOY_BACKUP_MAX_COUNT}" 1
  deploy_retention_require_integer "DEPLOY_BACKUP_MAX_AGE_DAYS" "${DEPLOY_BACKUP_MAX_AGE_DAYS}" 1
  deploy_retention_require_integer "ASSET_PRIOR_RELEASE_MIN_COUNT" "${ASSET_PRIOR_RELEASE_MIN_COUNT}" 1
  deploy_retention_require_integer "ASSET_PRIOR_RELEASE_MAX_COUNT" "${ASSET_PRIOR_RELEASE_MAX_COUNT}" 1
  deploy_retention_require_integer "ASSET_PRIOR_RELEASE_MAX_AGE_DAYS" "${ASSET_PRIOR_RELEASE_MAX_AGE_DAYS}" 1

  if (( DEPLOY_BACKUP_MAX_COUNT < DEPLOY_BACKUP_MIN_COUNT )); then
    echo "[deploy] DEPLOY_BACKUP_MAX_COUNT must be greater than or equal to DEPLOY_BACKUP_MIN_COUNT" >&2
    return 1
  fi
  if (( ASSET_PRIOR_RELEASE_MAX_COUNT < ASSET_PRIOR_RELEASE_MIN_COUNT )); then
    echo "[deploy] ASSET_PRIOR_RELEASE_MAX_COUNT must be greater than or equal to ASSET_PRIOR_RELEASE_MIN_COUNT" >&2
    return 1
  fi
}

deploy_retention_is_managed_backup() {
  local backup_root="${1%/}"
  local candidate="$2"
  local name

  name="$(basename -- "${candidate}")"
  [[ "$(dirname -- "${candidate}")" == "${backup_root}" ]] || return 1
  [[ "${name}" =~ ^deploy_[0-9]{8}_[0-9]{6}$ ]] || return 1
  [[ -d "${candidate}" && ! -L "${candidate}" ]]
}

deploy_retention_collect_backups() {
  local backup_root="${1%/}"
  local output_name="$2"
  local candidate
  local -n output_ref="${output_name}"

  output_ref=()
  [[ -d "${backup_root}" ]] || return 0

  # The generated timestamp names sort chronologically. Bash pathname
  # expansion therefore gives us oldest-to-newest order without parsing dates.
  for candidate in "${backup_root}"/deploy_*; do
    [[ -e "${candidate}" ]] || continue
    if deploy_retention_is_managed_backup "${backup_root}" "${candidate}"; then
      output_ref+=("${candidate}")
    fi
  done
}

deploy_retention_is_older_than_days() {
  local candidate="$1"
  local days="$2"
  local match

  match="$(find "${candidate}" -maxdepth 0 -mtime "+${days}" -print -quit)"
  [[ -n "${match}" ]]
}

deploy_retention_remove_backup() {
  local backup_root="$1"
  local candidate="$2"

  if ! deploy_retention_is_managed_backup "${backup_root}" "${candidate}"; then
    echo "[deploy] refusing to remove unmanaged backup path: ${candidate}" >&2
    return 1
  fi

  echo "[deploy] prune deploy backup: ${candidate}"
  rm -rf -- "${candidate}"
}

deploy_retention_prune_backups() {
  local backup_root="${1%/}"
  local current_backup="$2"
  local protected_start candidate index
  local -a backups remaining

  deploy_retention_collect_backups "${backup_root}" backups || return 1
  protected_start=$(( ${#backups[@]} - DEPLOY_BACKUP_MIN_COUNT ))
  if (( protected_start < 0 )); then
    protected_start=0
  fi

  # The newest minimum number of generations are never age-pruned. Older
  # generations remain available until they cross the configured age.
  for (( index = 0; index < protected_start; index++ )); do
    candidate="${backups[index]}"
    [[ "${candidate}" == "${current_backup}" ]] && continue
    if deploy_retention_is_older_than_days "${candidate}" "${DEPLOY_BACKUP_MAX_AGE_DAYS}"; then
      deploy_retention_remove_backup "${backup_root}" "${candidate}" || return 1
    fi
  done

  deploy_retention_collect_backups "${backup_root}" remaining || return 1
  while (( ${#remaining[@]} > DEPLOY_BACKUP_MAX_COUNT )); do
    candidate="${remaining[0]}"
    if [[ "${candidate}" == "${current_backup}" ]]; then
      echo "[deploy] refusing to prune the current rollback backup: ${candidate}" >&2
      return 1
    fi
    deploy_retention_remove_backup "${backup_root}" "${candidate}" || return 1
    deploy_retention_collect_backups "${backup_root}" remaining || return 1
  done

  echo "[deploy] retained ${#remaining[@]} deploy backup generation(s)"
}

deploy_retention_asset_name_is_safe() {
  local name="$1"
  [[ -n "${name}" ]] || return 1
  [[ "${name}" != "." && "${name}" != ".." ]] || return 1
  [[ "${name}" != *"/"* && "${name}" != *$'\r'* && "${name}" != *$'\n'* ]]
}

deploy_retention_write_asset_manifest() {
  local app_dir="${1%/}"
  local asset_dir="${app_dir}/dist/public/assets"
  local manifest="${app_dir}/.deploy-assets-manifest"
  local temporary

  temporary="$(mktemp "${manifest}.tmp.XXXXXX")"
  if [[ -d "${asset_dir}" ]]; then
    (
      cd "${asset_dir}" || exit 1
      find . -mindepth 1 -maxdepth 1 -type f -printf '%f\n' | LC_ALL=C sort
    ) > "${temporary}"
  else
    : > "${temporary}"
  fi
  mv -f -- "${temporary}" "${manifest}"
}

deploy_retention_restore_asset_manifest() {
  local app_dir="${1%/}"
  local backup_dir="$2"
  local manifest="${app_dir}/.deploy-assets-manifest"
  local backup_manifest="${backup_dir}/.deploy-assets-manifest"

  if [[ -f "${backup_manifest}" && ! -L "${backup_manifest}" ]]; then
    cp -- "${backup_manifest}" "${manifest}"
  else
    rm -f -- "${manifest}"
  fi
}

deploy_retention_copy_manifest_assets() {
  local backup_dir="$1"
  local target_dir="$2"
  local manifest="${backup_dir}/.deploy-assets-manifest"
  local source_dir="${backup_dir}/dist/public/assets"
  local name="" source

  [[ -f "${manifest}" && ! -L "${manifest}" && -d "${source_dir}" ]] || return 1

  while IFS= read -r name || [[ -n "${name}" ]]; do
    if ! deploy_retention_asset_name_is_safe "${name}"; then
      echo "[deploy] refusing unsafe asset manifest entry in ${manifest}" >&2
      return 1
    fi
    source="${source_dir}/${name}"
    if [[ -f "${source}" && ! -L "${source}" ]]; then
      cp -p -n -- "${source}" "${target_dir}/"
    fi
  done < "${manifest}"
}

deploy_retention_copy_fallback_assets() {
  local backup_dir="$1"
  local target_dir="$2"
  local source_dir="${backup_dir}/dist/public/assets"
  local source

  [[ -d "${source_dir}" ]] || return 0
  while IFS= read -r -d '' source; do
    cp -p -n -- "${source}" "${target_dir}/"
  done < <(find "${source_dir}" -mindepth 1 -maxdepth 1 -type f -print0)
}

deploy_retention_preserve_assets() {
  local app_dir="${1%/}"
  local backup_root="${2%/}"
  local current_backup="$3"
  local target_dir="${app_dir}/dist/public/assets"
  local candidate index
  local release_count=0
  local preserved_count=0
  local fallback_used=0
  local -a backups

  # Capture only the files shipped by the new artifact before adding any
  # compatibility assets. This manifest follows the release into its backup on
  # the next deploy and prevents old chunks from becoming immortal.
  deploy_retention_write_asset_manifest "${app_dir}"
  mkdir -p "${target_dir}"
  deploy_retention_collect_backups "${backup_root}" backups

  for (( index = ${#backups[@]} - 1; index >= 0; index-- )); do
    candidate="${backups[index]}"

    if [[ -f "${candidate}/.deploy-assets-manifest" && ! -L "${candidate}/.deploy-assets-manifest" ]]; then
      release_count=$(( release_count + 1 ))
      if (( release_count > ASSET_PRIOR_RELEASE_MAX_COUNT )); then
        break
      fi
      if (( release_count > ASSET_PRIOR_RELEASE_MIN_COUNT )) && \
        deploy_retention_is_older_than_days "${candidate}" "${ASSET_PRIOR_RELEASE_MAX_AGE_DAYS}"; then
        continue
      fi
      deploy_retention_copy_manifest_assets "${candidate}" "${target_dir}"
      preserved_count=$(( preserved_count + 1 ))
      continue
    fi

    # On the first deploy with manifests, the immediately previous runtime has
    # no release manifest. Keep its complete assets once so already-open
    # browsers are not broken; subsequent generations use bounded manifests.
    if [[ "${candidate}" == "${current_backup}" && ${fallback_used} -eq 0 ]]; then
      echo "[deploy] previous release has no asset manifest; preserving its assets for this transition"
      deploy_retention_copy_fallback_assets "${candidate}" "${target_dir}"
      fallback_used=1
      release_count=$(( release_count + 1 ))
      preserved_count=$(( preserved_count + 1 ))
    fi
  done

  echo "[deploy] preserved assets from ${preserved_count} prior release generation(s)"
}
