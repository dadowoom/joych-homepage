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

if [[ -f "${APP_DIR}/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  . "${APP_DIR}/.env"
  set +a
fi

node --input-type=module <<'NODE'
import crypto from "node:crypto";

const required = ["VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY", "VAPID_SUBJECT"];
const missing = required.filter((key) => !process.env[key]?.trim());
if (missing.length > 0) {
  console.warn(`[deploy] push VAPID env missing: ${missing.join(", ")}; push notifications will be disabled until configured`);
} else {
  const fingerprint = crypto
    .createHash("sha256")
    .update(process.env.VAPID_PUBLIC_KEY)
    .digest("hex")
    .slice(0, 12);
  console.log(`[deploy] push VAPID publicKeyFingerprint=${fingerprint}`);
}
NODE

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
if [[ -d "${BACKUP_DIR}/dist/public/assets" ]]; then
  echo "[deploy] preserve previous browser asset chunks"
  mkdir -p "${APP_DIR}/dist/public/assets"
  find "${BACKUP_DIR}/dist/public/assets" -maxdepth 1 -type f -exec cp -n {} "${APP_DIR}/dist/public/assets/" \;
fi

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

MIGRATION_0047="${APP_DIR}/drizzle/0047_seed_staria_vehicle.sql"
if [[ -f "${MIGRATION_0047}" ]]; then
  echo "[deploy] database seed: staria vehicle"
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
  throw new Error("DATABASE_URL is required for seed 0047.");
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
    ["0047_seed_staria_vehicle"],
  );

  if (rows.length > 0) {
    console.log("[deploy] seed 0047 already applied");
  } else {
    const sql = await fs.readFile("drizzle/0047_seed_staria_vehicle.sql", "utf8");
    for (const statement of sql.split(";").map((part) => part.trim()).filter(Boolean)) {
      await connection.query(statement);
    }
    await connection.query(
      "INSERT INTO app_migrations (id) VALUES (?)",
      ["0047_seed_staria_vehicle"],
    );
    console.log("[deploy] seed 0047 applied");
  }
} finally {
  await connection.end();
}
NODE
fi

MIGRATION_0048="${APP_DIR}/drizzle/0048_vehicle_reservation_24h.sql"
if [[ -f "${MIGRATION_0048}" ]]; then
  echo "[deploy] database migration: vehicle reservation 24h window"
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
  throw new Error("DATABASE_URL is required for migration 0048.");
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
    ["0048_vehicle_reservation_24h"],
  );

  if (rows.length > 0) {
    console.log("[deploy] migration 0048 already applied");
  } else {
    const sql = await fs.readFile("drizzle/0048_vehicle_reservation_24h.sql", "utf8");
    for (const statement of sql.split(";").map((part) => part.trim()).filter(Boolean)) {
      await connection.query(statement);
    }
    await connection.query(
      "INSERT INTO app_migrations (id) VALUES (?)",
      ["0048_vehicle_reservation_24h"],
    );
    console.log("[deploy] migration 0048 applied");
  }
} finally {
  await connection.end();
}
NODE
fi

MIGRATION_0049="${APP_DIR}/drizzle/0049_external_facility_reservations.sql"
if [[ -f "${MIGRATION_0049}" ]]; then
  echo "[deploy] database migration: external facility reservations"
  node --input-type=module <<'NODE'
import fs from "node:fs/promises";
import mysql from "mysql2/promise";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for migration 0049.");
}

const connection = await mysql.createConnection(databaseUrl);
try {
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS app_migrations (
      id varchar(100) PRIMARY KEY,
      applied_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  const [rows] = await connection.execute(
    "SELECT id FROM app_migrations WHERE id = ? LIMIT 1",
    ["0049_external_facility_reservations"],
  );
  if (Array.isArray(rows) && rows.length > 0) {
    console.log("[deploy] migration 0049 already applied");
  } else {
    const sql = await fs.readFile("drizzle/0049_external_facility_reservations.sql", "utf8");
    const statements = sql.split(/;\s*(?:\r?\n|$)/).map((statement) => statement.trim()).filter(Boolean);
    for (const statement of statements) {
      await connection.query(statement);
    }
    await connection.execute(
      "INSERT INTO app_migrations (id) VALUES (?)",
      ["0049_external_facility_reservations"],
    );
    console.log("[deploy] migration 0049 applied");
  }
} finally {
  await connection.end();
}
NODE
fi

MIGRATION_0050="${APP_DIR}/drizzle/0050_admin_notification_read_states.sql"
if [[ -f "${MIGRATION_0050}" ]]; then
  echo "[deploy] database migration: admin notification read states"
  node --input-type=module <<'NODE'
import fs from "node:fs/promises";
import mysql from "mysql2/promise";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for migration 0050.");
}

const connection = await mysql.createConnection(databaseUrl);
try {
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS app_migrations (
      id varchar(100) PRIMARY KEY,
      applied_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  const [rows] = await connection.execute(
    "SELECT id FROM app_migrations WHERE id = ? LIMIT 1",
    ["0050_admin_notification_read_states"],
  );
  if (Array.isArray(rows) && rows.length > 0) {
    console.log("[deploy] migration 0050 already applied");
  } else {
    const sql = await fs.readFile("drizzle/0050_admin_notification_read_states.sql", "utf8");
    const statements = sql.split(/;\s*(?:\r?\n|$)/).map((statement) => statement.trim()).filter(Boolean);
    for (const statement of statements) {
      await connection.query(statement);
    }
    await connection.execute(
      "INSERT INTO app_migrations (id) VALUES (?)",
      ["0050_admin_notification_read_states"],
    );
    console.log("[deploy] migration 0050 applied");
  }
} finally {
  await connection.end();
}
NODE
fi

MIGRATION_0051="${APP_DIR}/drizzle/0051_course_facility_reservations.sql"
if [[ -f "${MIGRATION_0051}" ]]; then
  echo "[deploy] database migration: course facility reservations"
  node --input-type=module <<'NODE'
import fs from "node:fs/promises";
import mysql from "mysql2/promise";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for migration 0051.");
}

const connection = await mysql.createConnection(databaseUrl);
try {
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS app_migrations (
      id varchar(100) PRIMARY KEY,
      applied_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  const [rows] = await connection.execute(
    "SELECT id FROM app_migrations WHERE id = ? LIMIT 1",
    ["0051_course_facility_reservations"],
  );
  if (Array.isArray(rows) && rows.length > 0) {
    console.log("[deploy] migration 0051 already applied");
  } else {
    const sql = await fs.readFile("drizzle/0051_course_facility_reservations.sql", "utf8");
    const statements = sql.split(/;\s*(?:\r?\n|$)/).map((statement) => statement.trim()).filter(Boolean);
    for (const statement of statements) {
      await connection.query(statement);
    }
    await connection.execute(
      "INSERT INTO app_migrations (id) VALUES (?)",
      ["0051_course_facility_reservations"],
    );
    console.log("[deploy] migration 0051 applied");
  }
} finally {
  await connection.end();
}
NODE
fi

MIGRATION_0052="${APP_DIR}/drizzle/0052_seed_course_sample_image.sql"
if [[ -f "${MIGRATION_0052}" ]]; then
  echo "[deploy] database seed: course sample image"
  node --input-type=module <<'NODE'
import fs from "node:fs/promises";
import mysql from "mysql2/promise";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for migration 0052.");
}

const connection = await mysql.createConnection(databaseUrl);
try {
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS app_migrations (
      id varchar(100) PRIMARY KEY,
      applied_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  const [rows] = await connection.execute(
    "SELECT id FROM app_migrations WHERE id = ? LIMIT 1",
    ["0052_seed_course_sample_image"],
  );
  if (Array.isArray(rows) && rows.length > 0) {
    console.log("[deploy] migration 0052 already applied");
  } else {
    const sql = await fs.readFile("drizzle/0052_seed_course_sample_image.sql", "utf8");
    const statements = sql.split(/;\s*(?:\r?\n|$)/).map((statement) => statement.trim()).filter(Boolean);
    for (const statement of statements) {
      await connection.query(statement);
    }
    await connection.execute(
      "INSERT INTO app_migrations (id) VALUES (?)",
      ["0052_seed_course_sample_image"],
    );
    console.log("[deploy] migration 0052 applied");
  }
} finally {
  await connection.end();
}
NODE
fi

MIGRATION_0053="${APP_DIR}/drizzle/0053_course_poster_sample_image.sql"
if [[ -f "${MIGRATION_0053}" ]]; then
  echo "[deploy] database seed: course poster sample image"
  node --input-type=module <<'NODE'
import fs from "node:fs/promises";
import mysql from "mysql2/promise";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for migration 0053.");
}

const connection = await mysql.createConnection(databaseUrl);
try {
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS app_migrations (
      id varchar(100) PRIMARY KEY,
      applied_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  const [rows] = await connection.execute(
    "SELECT id FROM app_migrations WHERE id = ? LIMIT 1",
    ["0053_course_poster_sample_image"],
  );
  if (Array.isArray(rows) && rows.length > 0) {
    console.log("[deploy] migration 0053 already applied");
  } else {
    const sql = await fs.readFile("drizzle/0053_course_poster_sample_image.sql", "utf8");
    const statements = sql.split(/;\s*(?:\r?\n|$)/).map((statement) => statement.trim()).filter(Boolean);
    for (const statement of statements) {
      await connection.query(statement);
    }
    await connection.execute(
      "INSERT INTO app_migrations (id) VALUES (?)",
      ["0053_course_poster_sample_image"],
    );
    console.log("[deploy] migration 0053 applied");
  }
} finally {
  await connection.end();
}
NODE
fi

MIGRATION_0054="${APP_DIR}/drizzle/0054_dynamic_boards.sql"
if [[ -f "${MIGRATION_0054}" ]]; then
  echo "[deploy] database migration: dynamic boards"
  node --input-type=module <<'NODE'
import fs from "node:fs/promises";
import mysql from "mysql2/promise";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for migration 0054.");
}

const connection = await mysql.createConnection(databaseUrl);
try {
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS app_migrations (
      id varchar(100) PRIMARY KEY,
      applied_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  const [rows] = await connection.execute(
    "SELECT id FROM app_migrations WHERE id = ? LIMIT 1",
    ["0054_dynamic_boards"],
  );
  if (Array.isArray(rows) && rows.length > 0) {
    console.log("[deploy] migration 0054 already applied");
  } else {
    const sql = await fs.readFile("drizzle/0054_dynamic_boards.sql", "utf8");
    const statements = sql.split(/;\s*(?:\r?\n|$)/).map((statement) => statement.trim()).filter(Boolean);
    for (const statement of statements) {
      await connection.query(statement);
    }
    await connection.execute(
      "INSERT INTO app_migrations (id) VALUES (?)",
      ["0054_dynamic_boards"],
    );
    console.log("[deploy] migration 0054 applied");
  }
} finally {
  await connection.end();
}
NODE
fi

MIGRATION_0055="${APP_DIR}/drizzle/0055_external_facility_hours.sql"
if [[ -f "${MIGRATION_0055}" ]]; then
  echo "[deploy] database migration: external facility hours"
  node --input-type=module <<'NODE'
import fs from "node:fs/promises";
import mysql from "mysql2/promise";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for migration 0055.");
}

const connection = await mysql.createConnection(databaseUrl);
try {
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS app_migrations (
      id varchar(100) PRIMARY KEY,
      applied_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  const [rows] = await connection.execute(
    "SELECT id FROM app_migrations WHERE id = ? LIMIT 1",
    ["0055_external_facility_hours"],
  );
  if (Array.isArray(rows) && rows.length > 0) {
    console.log("[deploy] migration 0055 already applied");
  } else {
    const sql = await fs.readFile("drizzle/0055_external_facility_hours.sql", "utf8");
    const statements = sql.split(/;\s*(?:\r?\n|$)/).map((statement) => statement.trim()).filter(Boolean);
    for (const statement of statements) {
      await connection.query(statement);
    }
    await connection.execute(
      "INSERT INTO app_migrations (id) VALUES (?)",
      ["0055_external_facility_hours"],
    );
    console.log("[deploy] migration 0055 applied");
  }
} finally {
  await connection.end();
}
NODE
fi

MIGRATION_0056="${APP_DIR}/drizzle/0056_pastor_books.sql"
if [[ -f "${MIGRATION_0056}" ]]; then
  echo "[deploy] database migration: pastor books"
  node --input-type=module <<'NODE'
import fs from "node:fs/promises";
import mysql from "mysql2/promise";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for migration 0056.");
}

const connection = await mysql.createConnection(databaseUrl);
try {
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS app_migrations (
      id varchar(100) PRIMARY KEY,
      applied_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  const [rows] = await connection.execute(
    "SELECT id FROM app_migrations WHERE id = ? LIMIT 1",
    ["0056_pastor_books"],
  );
  if (Array.isArray(rows) && rows.length > 0) {
    console.log("[deploy] migration 0056 already applied");
  } else {
    const sql = await fs.readFile("drizzle/0056_pastor_books.sql", "utf8");
    const statements = sql.split(/;\s*(?:\r?\n|$)/).map((statement) => statement.trim()).filter(Boolean);
    for (const statement of statements) {
      await connection.query(statement);
    }
    await connection.execute(
      "INSERT INTO app_migrations (id) VALUES (?)",
      ["0056_pastor_books"],
    );
    console.log("[deploy] migration 0056 applied");
  }
} finally {
  await connection.end();
}
NODE
fi

MIGRATION_0057="${APP_DIR}/drizzle/0057_menu_default_view_mode.sql"
if [[ -f "${MIGRATION_0057}" ]]; then
  echo "[deploy] database migration: menu default view mode"
  node --input-type=module <<'NODE'
import fs from "node:fs/promises";
import mysql from "mysql2/promise";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for migration 0057.");
}

const connection = await mysql.createConnection(databaseUrl);
try {
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS app_migrations (
      id varchar(100) PRIMARY KEY,
      applied_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  const [rows] = await connection.execute(
    "SELECT id FROM app_migrations WHERE id = ? LIMIT 1",
    ["0057_menu_default_view_mode"],
  );
  if (Array.isArray(rows) && rows.length > 0) {
    console.log("[deploy] migration 0057 already applied");
  } else {
    const sql = await fs.readFile("drizzle/0057_menu_default_view_mode.sql", "utf8");
    const statements = sql.split(/;\s*(?:\r?\n|$)/).map((statement) => statement.trim()).filter(Boolean);
    for (const statement of statements) {
      await connection.query(statement);
    }
    await connection.execute(
      "INSERT INTO app_migrations (id) VALUES (?)",
      ["0057_menu_default_view_mode"],
    );
    console.log("[deploy] migration 0057 applied");
  }
} finally {
  await connection.end();
}
NODE
fi

MIGRATION_0058="${APP_DIR}/drizzle/0058_external_reservation_advance_days.sql"
if [[ -f "${MIGRATION_0058}" ]]; then
  echo "[deploy] database migration: external reservation advance days"
  node --input-type=module <<'NODE'
import fs from "node:fs/promises";
import mysql from "mysql2/promise";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for migration 0058.");
}

const connection = await mysql.createConnection(databaseUrl);
try {
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS app_migrations (
      id varchar(100) PRIMARY KEY,
      applied_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  const [rows] = await connection.execute(
    "SELECT id FROM app_migrations WHERE id = ? LIMIT 1",
    ["0058_external_reservation_advance_days"],
  );
  if (Array.isArray(rows) && rows.length > 0) {
    console.log("[deploy] migration 0058 already applied");
  } else {
    const sql = await fs.readFile("drizzle/0058_external_reservation_advance_days.sql", "utf8");
    const statements = sql.split(/;\s*(?:\r?\n|$)/).map((statement) => statement.trim()).filter(Boolean);
    for (const statement of statements) {
      await connection.query(statement);
    }
    await connection.execute(
      "INSERT INTO app_migrations (id) VALUES (?)",
      ["0058_external_reservation_advance_days"],
    );
    console.log("[deploy] migration 0058 applied");
  }
} finally {
  await connection.end();
}
NODE
fi

MIGRATION_0059="${APP_DIR}/drizzle/0059_pastor_books_summary_text.sql"
if [[ -f "${MIGRATION_0059}" ]]; then
  echo "[deploy] database migration: pastor books summary text"
  node --input-type=module <<'NODE'
import fs from "node:fs/promises";
import mysql from "mysql2/promise";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for migration 0059.");
}

const connection = await mysql.createConnection(databaseUrl);
try {
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS app_migrations (
      id varchar(100) PRIMARY KEY,
      applied_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  const [rows] = await connection.execute(
    "SELECT id FROM app_migrations WHERE id = ? LIMIT 1",
    ["0059_pastor_books_summary_text"],
  );
  if (Array.isArray(rows) && rows.length > 0) {
    console.log("[deploy] migration 0059 already applied");
  } else {
    const sql = await fs.readFile("drizzle/0059_pastor_books_summary_text.sql", "utf8");
    const statements = sql.split(/;\s*(?:\r?\n|$)/).map((statement) => statement.trim()).filter(Boolean);
    for (const statement of statements) {
      await connection.query(statement);
    }
    await connection.execute(
      "INSERT INTO app_migrations (id) VALUES (?)",
      ["0059_pastor_books_summary_text"],
    );
    console.log("[deploy] migration 0059 applied");
  }
} finally {
  await connection.end();
}
NODE
fi

MIGRATION_0060="${APP_DIR}/drizzle/0060_external_facility_rules_notice.sql"
if [[ -f "${MIGRATION_0060}" ]]; then
  echo "[deploy] database migration: external facility rules and notice"
  node --input-type=module <<'NODE'
import fs from "node:fs/promises";
import mysql from "mysql2/promise";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for migration 0060.");
}

const connection = await mysql.createConnection(databaseUrl);
try {
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS app_migrations (
      id varchar(100) PRIMARY KEY,
      applied_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  const [rows] = await connection.execute(
    "SELECT id FROM app_migrations WHERE id = ? LIMIT 1",
    ["0060_external_facility_rules_notice"],
  );
  if (Array.isArray(rows) && rows.length > 0) {
    console.log("[deploy] migration 0060 already applied");
  } else {
    const sql = await fs.readFile("drizzle/0060_external_facility_rules_notice.sql", "utf8");
    const statements = sql.split(/;\s*(?:\r?\n|$)/).map((statement) => statement.trim()).filter(Boolean);
    for (const statement of statements) {
      await connection.query(statement);
    }
    await connection.execute(
      "INSERT INTO app_migrations (id) VALUES (?)",
      ["0060_external_facility_rules_notice"],
    );
    console.log("[deploy] migration 0060 applied");
  }
} finally {
  await connection.end();
}
NODE
fi

MIGRATION_0061="${APP_DIR}/drizzle/0061_dynamic_board_post_attachments.sql"
if [[ -f "${MIGRATION_0061}" ]]; then
  echo "[deploy] database migration: dynamic board post attachments"
  node --input-type=module <<'NODE'
import fs from "node:fs/promises";
import mysql from "mysql2/promise";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for migration 0061.");
}

const connection = await mysql.createConnection(databaseUrl);
try {
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS app_migrations (
      id varchar(100) PRIMARY KEY,
      applied_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  const [rows] = await connection.execute(
    "SELECT id FROM app_migrations WHERE id = ? LIMIT 1",
    ["0061_dynamic_board_post_attachments"],
  );
  if (Array.isArray(rows) && rows.length > 0) {
    console.log("[deploy] migration 0061 already applied");
  } else {
    const sql = await fs.readFile("drizzle/0061_dynamic_board_post_attachments.sql", "utf8");
    const statements = sql.split(/;\s*(?:\r?\n|$)/).map((statement) => statement.trim()).filter(Boolean);
    for (const statement of statements) {
      await connection.query(statement);
    }
    await connection.execute(
      "INSERT INTO app_migrations (id) VALUES (?)",
      ["0061_dynamic_board_post_attachments"],
    );
    console.log("[deploy] migration 0061 applied");
  }
} finally {
  await connection.end();
}
NODE
fi

MIGRATION_0062="${APP_DIR}/drizzle/0062_push_subscriptions.sql"
if [[ -f "${MIGRATION_0062}" ]]; then
  echo "[deploy] database migration: push subscriptions"
  node --input-type=module <<'NODE'
import fs from "node:fs/promises";
import mysql from "mysql2/promise";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for migration 0062.");
}

const connection = await mysql.createConnection(databaseUrl);
try {
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS app_migrations (
      id varchar(100) PRIMARY KEY,
      applied_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  const [rows] = await connection.execute(
    "SELECT id FROM app_migrations WHERE id = ? LIMIT 1",
    ["0062_push_subscriptions"],
  );
  if (Array.isArray(rows) && rows.length > 0) {
    console.log("[deploy] migration 0062 already applied");
  } else {
    const sql = await fs.readFile("drizzle/0062_push_subscriptions.sql", "utf8");
    const statements = sql.split(/;\s*(?:\r?\n|$)/).map((statement) => statement.trim()).filter(Boolean);
    for (const statement of statements) {
      await connection.query(statement);
    }
    await connection.execute(
      "INSERT INTO app_migrations (id) VALUES (?)",
      ["0062_push_subscriptions"],
    );
    console.log("[deploy] migration 0062 applied");
  }
} finally {
  await connection.end();
}
NODE
fi

MIGRATION_0063="${APP_DIR}/drizzle/0063_push_subscriptions_admin_users.sql"
if [[ -f "${MIGRATION_0063}" ]]; then
  echo "[deploy] database migration: push subscriptions admin users"
  node --input-type=module <<'NODE'
import fs from "node:fs/promises";
import mysql from "mysql2/promise";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for migration 0063.");
}

const connection = await mysql.createConnection(databaseUrl);
try {
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS app_migrations (
      id varchar(100) PRIMARY KEY,
      applied_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  const [rows] = await connection.execute(
    "SELECT id FROM app_migrations WHERE id = ? LIMIT 1",
    ["0063_push_subscriptions_admin_users"],
  );
  if (Array.isArray(rows) && rows.length > 0) {
    console.log("[deploy] migration 0063 already applied");
  } else {
    const sql = await fs.readFile("drizzle/0063_push_subscriptions_admin_users.sql", "utf8");
    const statements = sql.split(/;\s*(?:\r?\n|$)/).map((statement) => statement.trim()).filter(Boolean);
    for (const statement of statements) {
      await connection.query(statement);
    }
    await connection.execute(
      "INSERT INTO app_migrations (id) VALUES (?)",
      ["0063_push_subscriptions_admin_users"],
    );
    console.log("[deploy] migration 0063 applied");
  }
} finally {
  await connection.end();
}
NODE
fi

MIGRATION_0064="${APP_DIR}/drizzle/0064_member_districts.sql"
if [[ -f "${MIGRATION_0064}" ]]; then
  echo "[deploy] database migration: member district assignments"
  node --input-type=module <<'NODE'
import fs from "node:fs/promises";
import mysql from "mysql2/promise";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for migration 0064.");
}

const connection = await mysql.createConnection(databaseUrl);
try {
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS app_migrations (
      id varchar(100) PRIMARY KEY,
      applied_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  const [rows] = await connection.execute(
    "SELECT id FROM app_migrations WHERE id = ? LIMIT 1",
    ["0064_member_districts"],
  );
  if (Array.isArray(rows) && rows.length > 0) {
    console.log("[deploy] migration 0064 already applied");
  } else {
    const sql = await fs.readFile("drizzle/0064_member_districts.sql", "utf8");
    const statements = sql.split(/;\s*(?:\r?\n|$)/).map((statement) => statement.trim()).filter(Boolean);
    for (const statement of statements) {
      await connection.query(statement);
    }
    await connection.execute(
      "INSERT INTO app_migrations (id) VALUES (?)",
      ["0064_member_districts"],
    );
    console.log("[deploy] migration 0064 applied");
  }
} finally {
  await connection.end();
}
NODE
fi

MIGRATION_0065="${APP_DIR}/drizzle/0065_secret_posts.sql"
if [[ -f "${MIGRATION_0065}" ]]; then
  echo "[deploy] database migration: secret posts"
  node --input-type=module <<'NODE'
import fs from "node:fs/promises";
import mysql from "mysql2/promise";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for migration 0065.");
}

const connection = await mysql.createConnection(databaseUrl);
try {
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS app_migrations (
      id varchar(100) PRIMARY KEY,
      applied_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  const [rows] = await connection.execute(
    "SELECT id FROM app_migrations WHERE id = ? LIMIT 1",
    ["0065_secret_posts"],
  );
  if (Array.isArray(rows) && rows.length > 0) {
    console.log("[deploy] migration 0065 already applied");
  } else {
    const sql = await fs.readFile("drizzle/0065_secret_posts.sql", "utf8");
    const statements = sql.split(/;\s*(?:\r?\n|$)/).map((statement) => statement.trim()).filter(Boolean);
    for (const statement of statements) {
      await connection.query(statement);
    }
    await connection.execute(
      "INSERT INTO app_migrations (id) VALUES (?)",
      ["0065_secret_posts"],
    );
    console.log("[deploy] migration 0065 applied");
  }
} finally {
  await connection.end();
}
NODE
fi

MIGRATION_0066="${APP_DIR}/drizzle/0066_vehicle_reservation_admin_user_nullable.sql"
if [[ -f "${MIGRATION_0066}" ]]; then
  echo "[deploy] database migration: vehicle reservation admin user nullable"
  node --input-type=module <<'NODE'
import fs from "node:fs/promises";
import mysql from "mysql2/promise";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for migration 0066.");
}

const connection = await mysql.createConnection(databaseUrl);
try {
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS app_migrations (
      id varchar(100) PRIMARY KEY,
      applied_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  const [rows] = await connection.execute(
    "SELECT id FROM app_migrations WHERE id = ? LIMIT 1",
    ["0066_vehicle_reservation_admin_user_nullable"],
  );
  if (Array.isArray(rows) && rows.length > 0) {
    console.log("[deploy] migration 0066 already applied");
  } else {
    const sql = await fs.readFile("drizzle/0066_vehicle_reservation_admin_user_nullable.sql", "utf8");
    const statements = sql.split(/;\s*(?:\r?\n|$)/).map((statement) => statement.trim()).filter(Boolean);
    for (const statement of statements) {
      await connection.query(statement);
    }
    await connection.execute(
      "INSERT INTO app_migrations (id) VALUES (?)",
      ["0066_vehicle_reservation_admin_user_nullable"],
    );
    console.log("[deploy] migration 0066 applied");
  }
} finally {
  await connection.end();
}
NODE
fi

MIGRATION_0067="${APP_DIR}/drizzle/0067_notice_multi_attachments.sql"
if [[ -f "${MIGRATION_0067}" ]]; then
  echo "[deploy] database migration: notice multi attachments"
  node --input-type=module <<'NODE'
import fs from "node:fs/promises";
import mysql from "mysql2/promise";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for migration 0067.");
}

const connection = await mysql.createConnection(databaseUrl);
try {
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS app_migrations (
      id varchar(100) PRIMARY KEY,
      applied_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  const [rows] = await connection.execute(
    "SELECT id FROM app_migrations WHERE id = ? LIMIT 1",
    ["0067_notice_multi_attachments"],
  );
  if (Array.isArray(rows) && rows.length > 0) {
    console.log("[deploy] migration 0067 already applied");
  } else {
    const sql = await fs.readFile("drizzle/0067_notice_multi_attachments.sql", "utf8");
    const statements = sql.split(/;\s*(?:\r?\n|$)/).map((statement) => statement.trim()).filter(Boolean);
    for (const statement of statements) {
      await connection.query(statement);
    }
    await connection.execute(
      "INSERT INTO app_migrations (id) VALUES (?)",
      ["0067_notice_multi_attachments"],
    );
    console.log("[deploy] migration 0067 applied");
  }
} finally {
  await connection.end();
}
NODE
fi

MIGRATION_0068="${APP_DIR}/drizzle/0068_facility_contact_text.sql"
if [[ -f "${MIGRATION_0068}" ]]; then
  echo "[deploy] database migration: facility contact text"
  node --input-type=module <<'NODE'
import fs from "node:fs/promises";
import mysql from "mysql2/promise";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for migration 0068.");
}

const connection = await mysql.createConnection(databaseUrl);
try {
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS app_migrations (
      id varchar(100) PRIMARY KEY,
      applied_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  const [rows] = await connection.execute(
    "SELECT id FROM app_migrations WHERE id = ? LIMIT 1",
    ["0068_facility_contact_text"],
  );
  if (Array.isArray(rows) && rows.length > 0) {
    console.log("[deploy] migration 0068 already applied");
  } else {
    const [columns] = await connection.execute(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'facilities' AND COLUMN_NAME = 'contactText' LIMIT 1",
    );
    if (!Array.isArray(columns) || columns.length === 0) {
      const sql = await fs.readFile("drizzle/0068_facility_contact_text.sql", "utf8");
      const statements = sql.split(/;\s*(?:\r?\n|$)/).map((statement) => statement.trim()).filter(Boolean);
      for (const statement of statements) {
        await connection.query(statement);
      }
    }
    await connection.execute(
      "INSERT INTO app_migrations (id) VALUES (?)",
      ["0068_facility_contact_text"],
    );
    console.log("[deploy] migration 0068 applied");
  }
} finally {
  await connection.end();
}
NODE
fi

MIGRATION_0069="${APP_DIR}/drizzle/0069_notice_popup_size_percent.sql"
if [[ -f "${MIGRATION_0069}" ]]; then
  echo "[deploy] database migration: notice popup size percent"
  node --input-type=module <<'NODE'
import fs from "node:fs/promises";
import mysql from "mysql2/promise";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for migration 0069.");
}

const connection = await mysql.createConnection(databaseUrl);
try {
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS app_migrations (
      id varchar(100) PRIMARY KEY,
      applied_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  const [rows] = await connection.execute(
    "SELECT id FROM app_migrations WHERE id = ? LIMIT 1",
    ["0069_notice_popup_size_percent"],
  );
  if (Array.isArray(rows) && rows.length > 0) {
    console.log("[deploy] migration 0069 already applied");
  } else {
    const [columns] = await connection.execute(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notice_popups' AND COLUMN_NAME = 'size_percent' LIMIT 1",
    );
    if (!Array.isArray(columns) || columns.length === 0) {
      const sql = await fs.readFile("drizzle/0069_notice_popup_size_percent.sql", "utf8");
      const statements = sql.split(/;\s*(?:\r?\n|$)/).map((statement) => statement.trim()).filter(Boolean);
      for (const statement of statements) {
        await connection.query(statement);
      }
    }
    await connection.execute(
      "INSERT INTO app_migrations (id) VALUES (?)",
      ["0069_notice_popup_size_percent"],
    );
    console.log("[deploy] migration 0069 applied");
  }
} finally {
  await connection.end();
}
NODE
fi

MIGRATION_0070="${APP_DIR}/drizzle/0070_top_menu_read_permissions.sql"
if [[ -f "${MIGRATION_0070}" ]]; then
  echo "[deploy] database migration: top menu read permissions"
  node --input-type=module <<'NODE'
import fs from "node:fs/promises";
import mysql from "mysql2/promise";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for migration 0070.");
}

const connection = await mysql.createConnection(databaseUrl);
try {
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS app_migrations (
      id varchar(100) PRIMARY KEY,
      applied_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  const [rows] = await connection.execute(
    "SELECT id FROM app_migrations WHERE id = ? LIMIT 1",
    ["0070_top_menu_read_permissions"],
  );
  if (Array.isArray(rows) && rows.length > 0) {
    console.log("[deploy] migration 0070 already applied");
  } else {
    const [columns] = await connection.execute(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'menus' AND COLUMN_NAME = 'allowGuest' LIMIT 1",
    );
    if (!Array.isArray(columns) || columns.length === 0) {
      const sql = await fs.readFile("drizzle/0070_top_menu_read_permissions.sql", "utf8");
      const statements = sql.split(/;\s*(?:\r?\n|$)/).map((statement) => statement.trim()).filter(Boolean);
      for (const statement of statements) {
        await connection.query(statement);
      }
    }
    await connection.execute(
      "INSERT INTO app_migrations (id) VALUES (?)",
      ["0070_top_menu_read_permissions"],
    );
    console.log("[deploy] migration 0070 applied");
  }
} finally {
  await connection.end();
}
NODE
fi

MIGRATION_0071="${APP_DIR}/drizzle/0071_member_district_education_community.sql"
if [[ -f "${MIGRATION_0071}" ]]; then
  echo "[deploy] database migration: member district education community"
  node --input-type=module <<'NODE'
import fs from "node:fs/promises";
import mysql from "mysql2/promise";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for migration 0071.");
}

const connection = await mysql.createConnection(databaseUrl);
try {
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS app_migrations (
      id varchar(100) PRIMARY KEY,
      applied_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  const [rows] = await connection.execute(
    "SELECT id FROM app_migrations WHERE id = ? LIMIT 1",
    ["0071_member_district_education_community"],
  );
  if (Array.isArray(rows) && rows.length > 0) {
    console.log("[deploy] migration 0071 already applied");
  } else {
    const sql = await fs.readFile("drizzle/0071_member_district_education_community.sql", "utf8");
    const statements = sql.split(/;\s*(?:\r?\n|$)/).map((statement) => statement.trim()).filter(Boolean);
    for (const statement of statements) {
      await connection.query(statement);
    }
    await connection.execute(
      "INSERT INTO app_migrations (id) VALUES (?)",
      ["0071_member_district_education_community"],
    );
    console.log("[deploy] migration 0071 applied");
  }
} finally {
  await connection.end();
}
NODE
fi

MIGRATION_0072="${APP_DIR}/drizzle/0072_member_district_label_cleanup.sql"
if [[ -f "${MIGRATION_0072}" ]]; then
  echo "[deploy] database migration: member district label cleanup"
  node --input-type=module <<'NODE'
import fs from "node:fs/promises";
import mysql from "mysql2/promise";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for migration 0072.");
}

const connection = await mysql.createConnection(databaseUrl);
try {
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS app_migrations (
      id varchar(100) PRIMARY KEY,
      applied_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  const [rows] = await connection.execute(
    "SELECT id FROM app_migrations WHERE id = ? LIMIT 1",
    ["0072_member_district_label_cleanup"],
  );
  if (Array.isArray(rows) && rows.length > 0) {
    console.log("[deploy] migration 0072 already applied");
  } else {
    const sql = await fs.readFile("drizzle/0072_member_district_label_cleanup.sql", "utf8");
    const statements = sql.split(/;\s*(?:\r?\n|$)/).map((statement) => statement.trim()).filter(Boolean);
    for (const statement of statements) {
      await connection.query(statement);
    }
    await connection.execute(
      "INSERT INTO app_migrations (id) VALUES (?)",
      ["0072_member_district_label_cleanup"],
    );
    console.log("[deploy] migration 0072 applied");
  }
} finally {
  await connection.end();
}
NODE
fi

MIGRATION_0073="${APP_DIR}/drizzle/0073_mission_report_files.sql"
if [[ -f "${MIGRATION_0073}" ]]; then
  echo "[deploy] database migration: mission report files"
  node --input-type=module <<'NODE'
import fs from "node:fs/promises";
import mysql from "mysql2/promise";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for migration 0073.");
}

const connection = await mysql.createConnection(databaseUrl);
try {
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS app_migrations (
      id varchar(100) PRIMARY KEY,
      applied_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  const [rows] = await connection.execute(
    "SELECT id FROM app_migrations WHERE id = ? LIMIT 1",
    ["0073_mission_report_files"],
  );
  if (Array.isArray(rows) && rows.length > 0) {
    console.log("[deploy] migration 0073 already applied");
  } else {
    const sql = await fs.readFile("drizzle/0073_mission_report_files.sql", "utf8");
    const statements = sql.split(/;\s*(?:\r?\n|$)/).map((statement) => statement.trim()).filter(Boolean);
    for (const statement of statements) {
      await connection.query(statement);
    }
    await connection.execute(
      "INSERT INTO app_migrations (id) VALUES (?)",
      ["0073_mission_report_files"],
    );
    console.log("[deploy] migration 0073 applied");
  }
} finally {
  await connection.end();
}
NODE
fi

MIGRATION_0074="${APP_DIR}/drizzle/0074_course_application_guest.sql"
if [[ -f "${MIGRATION_0074}" ]]; then
  echo "[deploy] database migration: guest course applications"
  node --input-type=module <<'NODE'
import fs from "node:fs/promises";
import mysql from "mysql2/promise";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for migration 0074.");
}

const connection = await mysql.createConnection(databaseUrl);
try {
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS app_migrations (
      id varchar(100) PRIMARY KEY,
      applied_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  const [rows] = await connection.execute(
    "SELECT id FROM app_migrations WHERE id = ? LIMIT 1",
    ["0074_course_application_guest"],
  );
  if (Array.isArray(rows) && rows.length > 0) {
    console.log("[deploy] migration 0074 already applied");
  } else {
    const sql = await fs.readFile("drizzle/0074_course_application_guest.sql", "utf8");
    const statements = sql.split(/;\s*(?:\r?\n|$)/).map((statement) => statement.trim()).filter(Boolean);
    for (const statement of statements) {
      await connection.query(statement);
    }
    await connection.execute(
      "INSERT INTO app_migrations (id) VALUES (?)",
      ["0074_course_application_guest"],
    );
    console.log("[deploy] migration 0074 applied");
  }
} finally {
  await connection.end();
}
NODE
fi

MIGRATION_0075="${APP_DIR}/drizzle/0075_gallery_menu_scopes.sql"
if [[ -f "${MIGRATION_0075}" ]]; then
  echo "[deploy] database migration: gallery menu scopes"
  node --input-type=module <<'NODE'
import fs from "node:fs/promises";
import mysql from "mysql2/promise";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for migration 0075.");
}

const connection = await mysql.createConnection(databaseUrl);
try {
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS app_migrations (
      id varchar(100) PRIMARY KEY,
      applied_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  const [rows] = await connection.execute(
    "SELECT id FROM app_migrations WHERE id = ? LIMIT 1",
    ["0075_gallery_menu_scopes"],
  );
  if (Array.isArray(rows) && rows.length > 0) {
    console.log("[deploy] migration 0075 already applied");
  } else {
    const sql = await fs.readFile("drizzle/0075_gallery_menu_scopes.sql", "utf8");
    const statements = sql.split(/;\s*(?:\r?\n|$)/).map((statement) => statement.trim()).filter(Boolean);
    for (const statement of statements) {
      await connection.query(statement);
    }
    await connection.execute(
      "INSERT INTO app_migrations (id) VALUES (?)",
      ["0075_gallery_menu_scopes"],
    );
    console.log("[deploy] migration 0075 applied");
  }
} finally {
  await connection.end();
}
NODE
fi

MIGRATION_0076="${APP_DIR}/drizzle/0076_normalize_legacy_dynamic_menu_hrefs.sql"
if [[ -f "${MIGRATION_0076}" ]]; then
  echo "[deploy] database migration: normalize legacy CMS menu hrefs"
  node --input-type=module <<'NODE'
import fs from "node:fs/promises";
import mysql from "mysql2/promise";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for migration 0076.");
}

const connection = await mysql.createConnection(databaseUrl);
try {
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS app_migrations (
      id varchar(100) PRIMARY KEY,
      applied_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  const [rows] = await connection.execute(
    "SELECT id FROM app_migrations WHERE id = ? LIMIT 1",
    ["0076_normalize_legacy_dynamic_menu_hrefs"],
  );
  if (Array.isArray(rows) && rows.length > 0) {
    console.log("[deploy] migration 0076 already applied");
  } else {
    const sql = await fs.readFile("drizzle/0076_normalize_legacy_dynamic_menu_hrefs.sql", "utf8");
    const statements = sql.split(/;\s*(?:\r?\n|$)/).map((statement) => statement.trim()).filter(Boolean);
    for (const statement of statements) {
      await connection.query(statement);
    }
    await connection.execute(
      "INSERT INTO app_migrations (id) VALUES (?)",
      ["0076_normalize_legacy_dynamic_menu_hrefs"],
    );
    console.log("[deploy] migration 0076 applied");
  }
} finally {
  await connection.end();
}
NODE
fi

MIGRATION_0077="${APP_DIR}/drizzle/0077_course_room_managers.sql"
if [[ -f "${MIGRATION_0077}" ]]; then
  echo "[deploy] database migration: course room managers"
  node --input-type=module <<'NODE'
import mysql from "mysql2/promise";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for migration 0077.");
}

const connection = await mysql.createConnection(databaseUrl);
try {
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS app_migrations (
      id varchar(100) PRIMARY KEY,
      applied_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  const [rows] = await connection.execute(
    "SELECT id FROM app_migrations WHERE id = ? LIMIT 1",
    ["0077_course_room_managers"],
  );
  if (Array.isArray(rows) && rows.length > 0) {
    console.log("[deploy] migration 0077 already applied");
  } else {
    // The deploy can be retried after a partially applied schema change, so
    // create the table and index independently instead of replaying the file.
    await connection.query(`
      CREATE TABLE IF NOT EXISTS course_room_managers (
        id int AUTO_INCREMENT NOT NULL,
        memberId int NOT NULL,
        pageHref varchar(255) NOT NULL,
        canManage boolean NOT NULL DEFAULT true,
        createdBy int,
        createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY course_room_managers_member_page_unique (memberId, pageHref)
      )
    `);
    const [indexes] = await connection.query(
      "SHOW INDEX FROM course_room_managers WHERE Key_name = ?",
      ["course_room_managers_page_access_idx"],
    );
    if (!Array.isArray(indexes) || indexes.length === 0) {
      await connection.query(
        "CREATE INDEX course_room_managers_page_access_idx ON course_room_managers (pageHref, canManage)",
      );
    }
    await connection.execute(
      "INSERT INTO app_migrations (id) VALUES (?)",
      ["0077_course_room_managers"],
    );
    console.log("[deploy] migration 0077 applied");
  }
} finally {
  await connection.end();
}
NODE
fi

MIGRATION_0078="${APP_DIR}/drizzle/0078_visit_request_details.sql"
if [[ -f "${MIGRATION_0078}" ]]; then
  echo "[deploy] database migration: visit request details"
  node --input-type=module <<'NODE'
import mysql from "mysql2/promise";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for migration 0078.");
}

const connection = await mysql.createConnection(databaseUrl);
try {
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS app_migrations (
      id varchar(100) PRIMARY KEY,
      applied_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  const [rows] = await connection.execute(
    "SELECT id FROM app_migrations WHERE id = ? LIMIT 1",
    ["0078_visit_request_details"],
  );
  if (Array.isArray(rows) && rows.length > 0) {
    console.log("[deploy] migration 0078 already applied");
  } else {
    const hasColumn = async (columnName) => {
      const [columns] = await connection.execute(
        "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'visit_requests' AND COLUMN_NAME = ? LIMIT 1",
        [columnName],
      );
      return Array.isArray(columns) && columns.length > 0;
    };

    if (!(await hasColumn("region"))) {
      await connection.query("ALTER TABLE `visit_requests` ADD COLUMN `region` varchar(128)");
    }
    if (!(await hasColumn("denomination"))) {
      await connection.query("ALTER TABLE `visit_requests` ADD COLUMN `denomination` varchar(128)");
    }
    await connection.execute(
      "INSERT INTO app_migrations (id) VALUES (?)",
      ["0078_visit_request_details"],
    );
    console.log("[deploy] migration 0078 applied");
  }
} finally {
  await connection.end();
}
NODE
fi

MIGRATION_0079="${APP_DIR}/drizzle/0079_vehicle_reservation_recurrence.sql"
if [[ -f "${MIGRATION_0079}" ]]; then
  echo "[deploy] database migration: vehicle reservation recurrence"
  node --input-type=module <<'NODE'
import mysql from "mysql2/promise";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for migration 0079.");
}

const migrationId = "0079_vehicle_reservation_recurrence";
const connection = await mysql.createConnection(databaseUrl);
try {
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS app_migrations (
      id varchar(100) PRIMARY KEY,
      applied_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  const [rows] = await connection.execute(
    "SELECT id FROM app_migrations WHERE id = ? LIMIT 1",
    [migrationId],
  );
  const alreadyRecorded = Array.isArray(rows) && rows.length > 0;
  const hasColumn = async (columnName) => {
    const [columns] = await connection.execute(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'vehicle_reservations' AND COLUMN_NAME = ? LIMIT 1",
      [columnName],
    );
    return Array.isArray(columns) && columns.length > 0;
  };

  if (!(await hasColumn("recurrence_group_id"))) {
    await connection.query("ALTER TABLE `vehicle_reservations` ADD COLUMN `recurrence_group_id` varchar(64)");
  }
  if (!(await hasColumn("recurrence_label"))) {
    await connection.query("ALTER TABLE `vehicle_reservations` ADD COLUMN `recurrence_label` varchar(160)");
  }
  if (!(await hasColumn("recurrence_sequence"))) {
    await connection.query("ALTER TABLE `vehicle_reservations` ADD COLUMN `recurrence_sequence` int NOT NULL DEFAULT 0");
  }

  const [indexes] = await connection.query(
    "SHOW INDEX FROM `vehicle_reservations` WHERE Key_name = ?",
    ["vehicle_reservations_recurrence_group_idx"],
  );
  if (!Array.isArray(indexes) || indexes.length === 0) {
    await connection.query(
      "CREATE INDEX `vehicle_reservations_recurrence_group_idx` ON `vehicle_reservations` (`recurrence_group_id`)",
    );
  }

  if (!alreadyRecorded) {
    await connection.execute(
      "INSERT INTO app_migrations (id) VALUES (?)",
      [migrationId],
    );
    console.log("[deploy] migration 0079 applied");
  } else {
    console.log("[deploy] migration 0079 already applied and schema verified");
  }
} finally {
  await connection.end();
}
NODE
fi

MIGRATION_0080="${APP_DIR}/dist/scripts/backfillLegacyVehicleReservations.js"
if [[ -f "${MIGRATION_0080}" ]]; then
  echo "[deploy] database migration: backfill legacy vehicle reservation recurrence"
  node "${MIGRATION_0080}"
else
  echo "[deploy] missing migration runner: ${MIGRATION_0080}" >&2
  exit 1
fi

MIGRATION_0081="${APP_DIR}/dist/scripts/normalizeMemberPhones.js"
if [[ -f "${MIGRATION_0081}" ]]; then
  echo "[deploy] database migration: normalize member phone numbers"
  node "${MIGRATION_0081}"
else
  echo "[deploy] missing migration runner: ${MIGRATION_0081}" >&2
  exit 1
fi

MIGRATION_0082="${APP_DIR}/drizzle/0082_member_session_version.sql"
if [[ -f "${MIGRATION_0082}" ]]; then
  echo "[deploy] database migration: member session version"
  node --input-type=module <<'NODE'
import fs from "node:fs/promises";
import mysql from "mysql2/promise";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for migration 0082.");
}

const migrationId = "0082_member_session_version";
const connection = await mysql.createConnection(databaseUrl);
try {
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS app_migrations (
      id varchar(100) PRIMARY KEY,
      applied_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  const [rows] = await connection.execute(
    "SELECT id FROM app_migrations WHERE id = ? LIMIT 1",
    [migrationId],
  );
  const alreadyRecorded = Array.isArray(rows) && rows.length > 0;
  const [columns] = await connection.execute(
    "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'church_members' AND COLUMN_NAME = 'session_version' LIMIT 1",
  );

  if (!Array.isArray(columns) || columns.length === 0) {
    const sql = await fs.readFile("drizzle/0082_member_session_version.sql", "utf8");
    await connection.query(sql);
  }

  if (!alreadyRecorded) {
    await connection.execute(
      "INSERT INTO app_migrations (id) VALUES (?)",
      [migrationId],
    );
    console.log("[deploy] migration 0082 applied");
  } else {
    console.log("[deploy] migration 0082 already applied and schema verified");
  }
} finally {
  await connection.end();
}
NODE
else
  echo "[deploy] missing migration file: ${MIGRATION_0082}" >&2
  exit 1
fi

MIGRATION_0083="${APP_DIR}/drizzle/0083_course_application_checks.sql"
if [[ -f "${MIGRATION_0083}" ]]; then
  echo "[deploy] database migration: course application checks"
  node --input-type=module <<'NODE'
import mysql from "mysql2/promise";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for migration 0083.");
}

const migrationId = "0083_course_application_checks";
const connection = await mysql.createConnection(databaseUrl);
try {
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS app_migrations (
      id varchar(100) PRIMARY KEY,
      applied_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  const [rows] = await connection.execute(
    "SELECT id FROM app_migrations WHERE id = ? LIMIT 1",
    [migrationId],
  );
  const alreadyRecorded = Array.isArray(rows) && rows.length > 0;
  const hasColumn = async (columnName) => {
    const [columns] = await connection.execute(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'course_applications' AND COLUMN_NAME = ? LIMIT 1",
      [columnName],
    );
    return Array.isArray(columns) && columns.length > 0;
  };

  if (!(await hasColumn("feePaid"))) {
    await connection.query(
      "ALTER TABLE `course_applications` ADD COLUMN `feePaid` boolean NOT NULL DEFAULT false AFTER `customAnswers`",
    );
  }
  if (!(await hasColumn("documentsSubmitted"))) {
    await connection.query(
      "ALTER TABLE `course_applications` ADD COLUMN `documentsSubmitted` boolean NOT NULL DEFAULT false AFTER `feePaid`",
    );
  }

  if (!alreadyRecorded) {
    await connection.execute(
      "INSERT INTO app_migrations (id) VALUES (?)",
      [migrationId],
    );
    console.log("[deploy] migration 0083 applied");
  } else {
    console.log("[deploy] migration 0083 already applied and schema verified");
  }
} finally {
  await connection.end();
}
NODE
else
  echo "[deploy] missing migration file: ${MIGRATION_0083}" >&2
  exit 1
fi

MIGRATION_0084="${APP_DIR}/drizzle/0084_course_application_checklist_items.sql"
if [[ -f "${MIGRATION_0084}" ]]; then
  echo "[deploy] database migration: configurable course application checklist"
  node --input-type=module <<'NODE'
import mysql from "mysql2/promise";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for migration 0084.");
}

const migrationId = "0084_course_application_checklist_items";
const connection = await mysql.createConnection(databaseUrl);
try {
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS app_migrations (
      id varchar(100) PRIMARY KEY,
      applied_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  const [rows] = await connection.execute(
    "SELECT id FROM app_migrations WHERE id = ? LIMIT 1",
    [migrationId],
  );
  const alreadyRecorded = Array.isArray(rows) && rows.length > 0;

  // Run the table creation on every deploy. This makes an interrupted deploy
  // recoverable even when only one of the two tables was created.
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS course_application_checklist_items (
      id int NOT NULL AUTO_INCREMENT,
      courseId int NOT NULL,
      itemKey varchar(64) NOT NULL,
      label varchar(80) NOT NULL,
      sortOrder int NOT NULL DEFAULT 0,
      isActive boolean NOT NULL DEFAULT true,
      createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY course_checklist_items_course_key_unique (courseId, itemKey),
      KEY course_checklist_items_course_sort_idx (courseId, isActive, sortOrder)
    )
  `);
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS course_application_checklist_values (
      id int NOT NULL AUTO_INCREMENT,
      applicationId int NOT NULL,
      itemKey varchar(64) NOT NULL,
      checked boolean NOT NULL DEFAULT false,
      createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY course_checklist_values_application_key_unique (applicationId, itemKey),
      KEY course_checklist_values_application_idx (applicationId)
    )
  `);

  const hasColumn = async (tableName, columnName) => {
    const [columns] = await connection.execute(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1",
      [tableName, columnName],
    );
    return Array.isArray(columns) && columns.length > 0;
  };
  const hasIndex = async (tableName, indexName) => {
    const [indexes] = await connection.execute(
      "SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ? LIMIT 1",
      [tableName, indexName],
    );
    return Array.isArray(indexes) && indexes.length > 0;
  };

  // Early development versions of this migration could leave the items table
  // without isActive. Repair that exact partial state before recording success.
  if (!(await hasColumn("course_application_checklist_items", "isActive"))) {
    await connection.execute(
      "ALTER TABLE course_application_checklist_items ADD COLUMN isActive boolean NOT NULL DEFAULT true AFTER sortOrder",
    );
  }
  if (!(await hasIndex("course_application_checklist_items", "course_checklist_items_course_key_unique"))) {
    await connection.execute(
      "ALTER TABLE course_application_checklist_items ADD UNIQUE KEY course_checklist_items_course_key_unique (courseId, itemKey)",
    );
  }
  if (!(await hasIndex("course_application_checklist_items", "course_checklist_items_course_sort_idx"))) {
    await connection.execute(
      "ALTER TABLE course_application_checklist_items ADD KEY course_checklist_items_course_sort_idx (courseId, isActive, sortOrder)",
    );
  }
  if (!(await hasIndex("course_application_checklist_values", "course_checklist_values_application_key_unique"))) {
    await connection.execute(
      "ALTER TABLE course_application_checklist_values ADD UNIQUE KEY course_checklist_values_application_key_unique (applicationId, itemKey)",
    );
  }
  if (!(await hasIndex("course_application_checklist_values", "course_checklist_values_application_idx"))) {
    await connection.execute(
      "ALTER TABLE course_application_checklist_values ADD KEY course_checklist_values_application_idx (applicationId)",
    );
  }

  const requiredColumns = {
    course_application_checklist_items: [
      "id", "courseId", "itemKey", "label", "sortOrder", "isActive", "createdAt", "updatedAt",
    ],
    course_application_checklist_values: [
      "id", "applicationId", "itemKey", "checked", "createdAt", "updatedAt",
    ],
  };
  for (const [tableName, columnNames] of Object.entries(requiredColumns)) {
    for (const columnName of columnNames) {
      if (!(await hasColumn(tableName, columnName))) {
        throw new Error(`Migration 0084 schema verification failed: ${tableName}.${columnName} is missing.`);
      }
    }
  }

  // Record only after both tables, the repair, and the schema verification have
  // completed. A failed deploy can therefore safely retry this block.
  if (!alreadyRecorded) {
    await connection.execute(
      "INSERT INTO app_migrations (id) VALUES (?)",
      [migrationId],
    );
    console.log("[deploy] migration 0084 applied");
  } else {
    console.log("[deploy] migration 0084 already applied and schema verified");
  }
} finally {
  await connection.end();
}
NODE
else
  echo "[deploy] missing migration file: ${MIGRATION_0084}" >&2
  exit 1
fi

MIGRATION_0085="${APP_DIR}/drizzle/0085_member_password_reset_requests.sql"
if [[ -f "${MIGRATION_0085}" ]]; then
  echo "[deploy] database migration: member password reset requests"
  node --input-type=module <<'NODE'
import mysql from "mysql2/promise";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for migration 0085.");
}

const migrationId = "0085_member_password_reset_requests";
const connection = await mysql.createConnection(databaseUrl);
try {
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS app_migrations (
      id varchar(100) PRIMARY KEY,
      applied_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS member_password_reset_requests (
      id int NOT NULL AUTO_INCREMENT,
      member_id int NOT NULL,
      status enum('pending','resolved','cancelled') NOT NULL DEFAULT 'pending',
      requested_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      resolved_at timestamp NULL DEFAULT NULL,
      PRIMARY KEY (id),
      KEY member_password_reset_requests_member_idx (member_id),
      KEY member_password_reset_requests_status_requested_idx (status, requested_at)
    )
  `);

  const [columns] = await connection.execute(
    "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'member_password_reset_requests'",
  );
  const columnNames = new Set(Array.isArray(columns) ? columns.map((row) => row.COLUMN_NAME) : []);
  for (const required of ["id", "member_id", "status", "requested_at", "resolved_at"]) {
    if (!columnNames.has(required)) {
      throw new Error(`Migration 0085 schema verification failed: ${required} is missing.`);
    }
  }

  const [rows] = await connection.execute(
    "SELECT id FROM app_migrations WHERE id = ? LIMIT 1",
    [migrationId],
  );
  if (!Array.isArray(rows) || rows.length === 0) {
    await connection.execute("INSERT INTO app_migrations (id) VALUES (?)", [migrationId]);
    console.log("[deploy] migration 0085 applied");
  } else {
    console.log("[deploy] migration 0085 already applied and schema verified");
  }
} finally {
  await connection.end();
}
NODE
else
  echo "[deploy] missing migration file: ${MIGRATION_0085}" >&2
  exit 1
fi

echo "[deploy] restart pm2 app"
restart_pm2
sleep 4

echo "[deploy] healthcheck: ${HEALTHCHECK_URL}"
curl -fsS "${HEALTHCHECK_URL}" >/dev/null

echo "[deploy] verify Newjoych/Joych PWA notification bridge"
node "${APP_DIR}/scripts/verify-pwa-domain-bridge.mjs"

rm -f "${ARTIFACT}"

trap - ERR
echo "[deploy] ok backup=${BACKUP_DIR}"
