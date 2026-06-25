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
rm -rf "${APP_DIR}/dist"
tar -xzf "${ARTIFACT}" -C "${APP_DIR}"

echo "[deploy] install production dependencies"
if command -v pnpm >/dev/null 2>&1; then
  CI=true pnpm install --prod --frozen-lockfile
else
  CI=true npm install --omit=dev
fi

MIGRATION_0041="${APP_DIR}/drizzle/0041_facility_reservation_member_gate.sql"
if [[ -f "${MIGRATION_0041}" ]]; then
  echo "[deploy] database migration: facility reservation member gate"
  if [[ -f "${APP_DIR}/.env" ]]; then
    set -a
    # shellcheck disable=SC1091
    . "${APP_DIR}/.env"
    set +a
  fi
  node --input-type=module <<'NODE'
import fs from "node:fs/promises";
import mysql from "mysql2/promise";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for migration 0041.");
}

const url = new URL(databaseUrl);
const databaseName = url.pathname.replace(/^\//, "");
if (!databaseName) {
  throw new Error("DATABASE_URL must include a database name.");
}

const connection = await mysql.createConnection(databaseUrl);
try {
  const [columns] = await connection.execute(
    "SELECT COUNT(*) AS count FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'church_members' AND COLUMN_NAME = 'can_reserve_facility'",
    [databaseName],
  );
  const count = Number(columns?.[0]?.count ?? 0);
  if (count === 0) {
    const sql = await fs.readFile("drizzle/0041_facility_reservation_member_gate.sql", "utf8");
    for (const statement of sql.split(";").map((part) => part.trim()).filter(Boolean)) {
      await connection.query(statement);
    }
    console.log("[deploy] migration 0041 applied");
  } else {
    console.log("[deploy] migration 0041 already applied");
  }
} finally {
  await connection.end();
}
NODE
fi

MIGRATION_0042="${APP_DIR}/drizzle/0042_block_external_facility_reservations.sql"
if [[ -f "${MIGRATION_0042}" ]]; then
  echo "[deploy] database cleanup: block external facility reservations"
  if [[ -f "${APP_DIR}/.env" ]]; then
    set -a
    # shellcheck disable=SC1091
    . "${APP_DIR}/.env"
    set +a
  fi
  node --input-type=module <<'NODE'
import fs from "node:fs/promises";
import mysql from "mysql2/promise";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for migration 0042.");
}

const connection = await mysql.createConnection(databaseUrl);
try {
  const sql = await fs.readFile("drizzle/0042_block_external_facility_reservations.sql", "utf8");
  for (const statement of sql.split(";").map((part) => part.trim()).filter(Boolean)) {
    await connection.query(statement);
  }
  console.log("[deploy] migration 0042 applied");
} finally {
  await connection.end();
}
NODE
fi

MIGRATION_0043="${APP_DIR}/drizzle/0043_reset_facility_reservation_override.sql"
if [[ -f "${MIGRATION_0043}" ]]; then
  echo "[deploy] database migration: reset facility reservation override flag"
  if [[ -f "${APP_DIR}/.env" ]]; then
    set -a
    # shellcheck disable=SC1091
    . "${APP_DIR}/.env"
    set +a
  fi
  node --input-type=module <<'NODE'
import fs from "node:fs/promises";
import mysql from "mysql2/promise";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for migration 0043.");
}

const connection = await mysql.createConnection(databaseUrl);
try {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS app_migrations (
      id VARCHAR(128) PRIMARY KEY,
      applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const [rows] = await connection.query(
    "SELECT id FROM app_migrations WHERE id = ? LIMIT 1",
    ["0043_reset_facility_reservation_override"],
  );

  if (rows.length > 0) {
    console.log("[deploy] migration 0043 already applied");
  } else {
    const sql = await fs.readFile("drizzle/0043_reset_facility_reservation_override.sql", "utf8");
    for (const statement of sql.split(";").map((part) => part.trim()).filter(Boolean)) {
      await connection.query(statement);
    }
    await connection.query(
      "INSERT INTO app_migrations (id) VALUES (?)",
      ["0043_reset_facility_reservation_override"],
    );
    console.log("[deploy] migration 0043 applied");
  }
} finally {
  await connection.end();
}
NODE
fi

MIGRATION_0044="${APP_DIR}/drizzle/0044_board_view_counts.sql"
if [[ -f "${MIGRATION_0044}" ]]; then
  echo "[deploy] database migration: board view counts"
  if [[ -f "${APP_DIR}/.env" ]]; then
    set -a
    # shellcheck disable=SC1091
    . "${APP_DIR}/.env"
    set +a
  fi
  node --input-type=module <<'NODE'
import mysql from "mysql2/promise";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for migration 0044.");
}

const url = new URL(databaseUrl);
const databaseName = url.pathname.replace(/^\//, "");
if (!databaseName) {
  throw new Error("DATABASE_URL must include a database name.");
}

const connection = await mysql.createConnection(databaseUrl);
try {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS app_migrations (
      id VARCHAR(128) PRIMARY KEY,
      applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const [rows] = await connection.query(
    "SELECT id FROM app_migrations WHERE id = ? LIMIT 1",
    ["0044_board_view_counts"],
  );

  if (rows.length > 0) {
    console.log("[deploy] migration 0044 already applied");
  } else {
    async function hasColumn(tableName, columnName) {
      const [columns] = await connection.execute(
        "SELECT COUNT(*) AS count FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?",
        [databaseName, tableName, columnName],
      );
      return Number(columns?.[0]?.count ?? 0) > 0;
    }

    if (!(await hasColumn("notices", "viewCount"))) {
      await connection.query("ALTER TABLE `notices` ADD COLUMN `viewCount` int NOT NULL DEFAULT 0 AFTER `authorId`");
    }
    if (!(await hasColumn("free_board_posts", "view_count"))) {
      await connection.query("ALTER TABLE `free_board_posts` ADD COLUMN `view_count` int NOT NULL DEFAULT 0 AFTER `status`");
    }
    if (!(await hasColumn("bulletins", "view_count"))) {
      await connection.query("ALTER TABLE `bulletins` ADD COLUMN `view_count` int NOT NULL DEFAULT 0 AFTER `author_id`");
    }

    await connection.query(
      "INSERT INTO app_migrations (id) VALUES (?)",
      ["0044_board_view_counts"],
    );
    console.log("[deploy] migration 0044 applied");
  }
} finally {
  await connection.end();
}
NODE
fi

MIGRATION_0045="${APP_DIR}/drizzle/0045_hero_slide_buttons_json.sql"
if [[ -f "${MIGRATION_0045}" ]]; then
  echo "[deploy] database migration: hero slide button list"
  if [[ -f "${APP_DIR}/.env" ]]; then
    set -a
    # shellcheck disable=SC1091
    . "${APP_DIR}/.env"
    set +a
  fi
  node --input-type=module <<'NODE'
import mysql from "mysql2/promise";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for migration 0045.");
}

const url = new URL(databaseUrl);
const databaseName = url.pathname.replace(/^\//, "");
if (!databaseName) {
  throw new Error("DATABASE_URL must include a database name.");
}

const connection = await mysql.createConnection(databaseUrl);
try {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS app_migrations (
      id VARCHAR(128) PRIMARY KEY,
      applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const [rows] = await connection.query(
    "SELECT id FROM app_migrations WHERE id = ? LIMIT 1",
    ["0045_hero_slide_buttons_json"],
  );

  if (rows.length > 0) {
    console.log("[deploy] migration 0045 already applied");
  } else {
    const [columns] = await connection.execute(
      "SELECT COUNT(*) AS count FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'hero_slides' AND COLUMN_NAME = 'buttonsJson'",
      [databaseName],
    );
    const hasButtonsJson = Number(columns?.[0]?.count ?? 0) > 0;
    if (!hasButtonsJson) {
      await connection.query("ALTER TABLE `hero_slides` ADD COLUMN `buttonsJson` text NULL AFTER `btn2Href`");
    }
    await connection.query(
      "INSERT INTO app_migrations (id) VALUES (?)",
      ["0045_hero_slide_buttons_json"],
    );
    console.log("[deploy] migration 0045 applied");
  }
} finally {
  await connection.end();
}
NODE
fi

MIGRATION_0046="${APP_DIR}/drizzle/0046_vehicle_reservations.sql"
if [[ -f "${MIGRATION_0046}" ]]; then
  echo "[deploy] database migration: vehicle reservations"
  if [[ -f "${APP_DIR}/.env" ]]; then
    set -a
    # shellcheck disable=SC1091
    . "${APP_DIR}/.env"
    set +a
  fi
  node --input-type=module <<'NODE'
import fs from "node:fs/promises";
import mysql from "mysql2/promise";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for migration 0046.");
}

const url = new URL(databaseUrl);
const databaseName = url.pathname.replace(/^\//, "");
if (!databaseName) {
  throw new Error("DATABASE_URL must include a database name.");
}

const connection = await mysql.createConnection(databaseUrl);
try {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS app_migrations (
      id VARCHAR(128) PRIMARY KEY,
      applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const [rows] = await connection.query(
    "SELECT id FROM app_migrations WHERE id = ? LIMIT 1",
    ["0046_vehicle_reservations"],
  );

  if (rows.length > 0) {
    console.log("[deploy] migration 0046 already applied");
  } else {
    const [tables] = await connection.execute(
      "SELECT COUNT(*) AS count FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'vehicles'",
      [databaseName],
    );
    const hasVehiclesTable = Number(tables?.[0]?.count ?? 0) > 0;
    if (!hasVehiclesTable) {
      const sql = await fs.readFile("drizzle/0046_vehicle_reservations.sql", "utf8");
      for (const statement of sql.split(";").map((part) => part.trim()).filter(Boolean)) {
        await connection.query(statement);
      }
    }
    await connection.query(
      "INSERT INTO app_migrations (id) VALUES (?)",
      ["0046_vehicle_reservations"],
    );
    console.log("[deploy] migration 0046 applied");
  }
} finally {
  await connection.end();
}
NODE
fi

echo "[deploy] restart pm2 app"
restart_pm2
sleep 4

echo "[deploy] healthcheck: ${HEALTHCHECK_URL}"
curl -fsS "${HEALTHCHECK_URL}" >/dev/null

rm -f "${ARTIFACT}"

trap - ERR
echo "[deploy] ok backup=${BACKUP_DIR}"
