# Production monitoring and backup verification

Two GitHub Actions workflows provide a small production safety baseline:

- `Production Operations Monitor` is read-only. It runs every hour at minute 17
  UTC and can also be started manually.
- `Production Backup` runs at 19:27 UTC, which is 04:27 the next day in Korea,
  and can also be started manually.

## What is checked

The public check always requests `https://www.joych.org/api/readyz` over HTTPS.
It passes only when the endpoint returns HTTP 200 and the exact database-ready
contract:

```json
{ "ok": true, "checks": { "database": "ok" } }
```

When the existing deployment SSH secrets are available, the same run also
checks the production host without modifying it:

- every PM2 instance named `joych-homepage` is `online`;
- the application and production-backup filesystems each have at least 15%
  available space;
- at least one structurally complete production backup exists;
- the newest complete backup is no more than 30 hours old.

A backup counts as complete only when its directory is not a symlink or a
partial directory, all three required files are non-empty regular files, and
the manifest says `status: complete` with the expected archive names and exact
archive byte sizes:

- `database.sql.gz`
- `uploads.tar.gz`
- `manifest.json`

The checker does not print the SSH host, credentials, PM2 environment, response
body, database connection data, manifest contents, or filesystem paths.

## Daily backup execution

The backup workflow connects with the existing deployment SSH credential,
changes to `JOYCH_APP_DIR`, loads the production `.env` without printing it, and
runs the already deployed `scripts/backup-joych-production.mjs`. It then requires
a newly completed backup with the structural contract above.

The existing server cron may run at the same 04:27 time. This is safe by design:

- a complete backup less than 12 hours old is accepted without starting a
  duplicate (manual dispatch has a **force** option);
- the production backup script's database and filesystem locks serialize a
  start-time race;
- when another backup owns the lock, the workflow waits up to 90 minutes and
  passes only after that run produces a structurally complete backup;
- non-lock failures are reported immediately with a generic message; captured
  child output is never copied into GitHub logs;
- before reporting success, `gzip -t` validates both compressed streams and
  `tar -tzf` validates the uploads archive structure. Command output is
  discarded so archive or environment details cannot enter the Actions log.

The deployment, daily backup, and remote monitor jobs share the
`joych-production` GitHub concurrency group with cancellation disabled. They do
not intentionally restart, deploy, back up, or inspect the host at the same
time. The group uses the maximum pending queue so a later monitor cannot replace
an already queued deployment or backup. The backup script retains its own
host-side locks for starts outside GitHub Actions.

## SSH secrets and pinned host identity

The workflows reuse the deployment authentication secrets:

- `JOYCH_SSH_HOST`
- `JOYCH_SSH_USER`
- `JOYCH_SSH_PORT`
- `JOYCH_SSH_PRIVATE_KEY` (preferred) or `JOYCH_SSH_PASSWORD`
- `JOYCH_SSH_HOST_ED25519_KEY` (required pinned public host-key blob)

The ED25519 host-key value must be verified by an administrator through the
hosting console before it is stored. The workflows construct `known_hosts`
directly from that pin and the configured host/port. They never trust a key
collected from the same network connection with `ssh-keyscan`, so a host-key
mismatch stops deployment, monitoring, and backup before authentication.

If all SSH secrets are absent, the workflow records that remote checks were
skipped and still checks the public readiness endpoint. A partial SSH
configuration fails loudly instead of silently reducing coverage.

## Optional repository variables

Defaults match the current production deployment. Set these repository
variables only if production actually uses different values:

| Variable                                   | Default                            | Purpose                                            |
| ------------------------------------------ | ---------------------------------- | -------------------------------------------------- |
| `JOYCH_PUBLIC_READINESS_URL`               | `https://www.joych.org/api/readyz` | Public readiness URL                               |
| `JOYCH_APP_DIR`                            | `/var/www/joych-homepage`          | Application directory and disk target              |
| `JOYCH_BACKUP_DIR`                         | `/var/backups/joych-homepage`      | Production backup directory and disk target        |
| `JOYCH_PM2_APP`                            | `joych-homepage`                   | Exact PM2 application name                         |
| `JOYCH_OPS_BACKUP_MAX_AGE_HOURS`           | `30`                               | Maximum completed-backup age                       |
| `JOYCH_OPS_MIN_DISK_FREE_PERCENT`          | `15`                               | Minimum available disk percentage                  |
| `JOYCH_OPS_BACKUP_SKIP_FRESH_HOURS`        | `12`                               | Avoid a duplicate scheduled backup                 |
| `JOYCH_OPS_BACKUP_LOCK_WAIT_MINUTES`       | `90`                               | Wait limit for an overlapping host cron backup     |
| `JOYCH_OPS_BACKUP_POLL_SECONDS`            | `30`                               | Completion polling interval after a lock collision |
| `JOYCH_OPS_BACKUP_COMMAND_TIMEOUT_MINUTES` | `105`                              | Safety timeout for the backup child process        |

The existing production runbook schedules the backup at 04:27 Korea time. A
30-hour threshold allows for a delayed job while still reporting a missed daily
backup later the same day.

## Failure notification and response

GitHub marks any failed scheduled run in red. Scheduled-run notifications go to
the user who created the workflow (or most recently changed its cron). That
account should enable **Settings > Notifications > System > Actions** email or
web notifications and may select failures only. See GitHub's
[workflow notification documentation](https://docs.github.com/en/actions/concepts/workflows-and-actions/notifications-for-workflow-runs).
On a failure:

1. Open **Actions > Production Operations Monitor** and select the failed run.
2. Read the failed step and the job summary. The log contains only sanitized
   status data.
3. For a public readiness failure, check the reverse proxy, PM2, and database.
4. For a stale backup, inspect the backup cron log and run the documented backup
   command only after confirming that no backup is already running.
5. For low disk space, investigate growth before changing retention or deleting
   anything.

GitHub scheduled workflows run only from the default branch and may start later
than the exact cron minute. This workflow is useful baseline monitoring, not a
real-time paging service. For a public repository, GitHub may disable schedules
after 60 days without repository activity, so the Actions page should also be
reviewed periodically.

## Remaining alert-delivery gap

No church-owned Slack, email distribution list, SMS service, or incident tool
was selected for this change, and no credential for one was supplied. GitHub's
scheduled-workflow notification is therefore the current automatic alert. A
deterministic second channel with a named recipient remains a follow-up after
the church chooses that recipient and channel.

## Remaining disaster-recovery gap

This monitor verifies only the completed backup stored on the production host.
It does not copy data off the server. A server or disk loss can therefore still
remove both live data and the local backup. External encrypted backup storage,
retention, and a restore drill remain a separate follow-up; no external-storage
credentials are added by this change.
