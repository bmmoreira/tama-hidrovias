#!/usr/bin/env bash
set -euo pipefail

# Deploys/updates the Strapi backend (cms/) to the "google" host, run
# standalone via pm2 as its own dedicated instance -- separate from the
# pre-existing "strapi-01" process on that host, which serves a different,
# incompatible project (different Strapi version, and a conflicting
# "station" content-type with real production data). Do not merge into it.
#
# This instance uses its own Postgres database ("tama_hidrovias_db") inside
# the shared "postgres-main" Docker container on google, reachable from the
# host at 127.0.0.1:5433. See scripts/google-strapi-env-production.template
# for the exact env values used (gitignored -- contains DB password and
# Strapi secrets).
#
# Usage:
#   ./scripts/deploy-google-strapi.sh            # sync + build + (re)start
#   ./scripts/deploy-google-strapi.sh --dry-run  # show what would sync, change nothing
#
# Requires the `google` host to already be configured in ~/.ssh/config.

cd "$(dirname "$0")/.."

REMOTE="google"
REMOTE_DIR="/home/bmmoreira/projects/cms/tama"
PM2_NAME="strapi-tama"
ENV_FILE="scripts/google-strapi-env-production.template"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Missing ${ENV_FILE} -- this holds the production env vars for the" >&2
  echo "google Strapi deployment (DB password, app secrets) and is" >&2
  echo "gitignored since it contains secrets. Create it before deploying." >&2
  exit 1
fi

RSYNC_ARGS=(-az --delete
  --exclude='.git/'
  --exclude='node_modules/'
  --exclude='.cache/'
  --exclude='build/'
  --exclude='.tmp/'
  --exclude='.env*'
  # Media uploads are server-owned state (see docs/deploy-netuno notes on
  # this exact issue) -- never let a routine code deploy delete them.
  --exclude='public/uploads/'
)

if [[ "${1:-}" == "--dry-run" ]]; then
  RSYNC_ARGS+=(--dry-run --verbose)
  echo "==> DRY RUN: showing what would sync to ${REMOTE}:${REMOTE_DIR} (nothing will change)"
else
  echo "==> Syncing cms/ to ${REMOTE}:${REMOTE_DIR}"
fi

ssh "${REMOTE}" "mkdir -p '${REMOTE_DIR}'"
rsync "${RSYNC_ARGS[@]}" ./cms/ "${REMOTE}:${REMOTE_DIR}/"

if [[ "${1:-}" == "--dry-run" ]]; then
  echo "==> Dry run only, not touching the remote process."
  exit 0
fi

echo "==> Pushing production env file"
scp "${ENV_FILE}" "${REMOTE}:${REMOTE_DIR}/.env"

echo "==> Installing dependencies and building admin panel on ${REMOTE}"
ssh "${REMOTE}" "cd '${REMOTE_DIR}' && npm install --legacy-peer-deps && npm run build"

echo "==> Starting/reloading pm2 process '${PM2_NAME}'"
ssh "${REMOTE}" "cd '${REMOTE_DIR}' && \
  if pm2 describe '${PM2_NAME}' >/dev/null 2>&1; then \
    pm2 reload '${PM2_NAME}'; \
  else \
    pm2 start npm --name '${PM2_NAME}' --cwd '${REMOTE_DIR}' -- run start; \
  fi && \
  pm2 save"

cat <<EOF

Done. Strapi is running under pm2 as '${PM2_NAME}' on 127.0.0.1:1339.
Check status: ssh ${REMOTE} "pm2 show ${PM2_NAME}"
View logs:    ssh ${REMOTE} "pm2 logs ${PM2_NAME} --lines 100"

Remaining manual step: point this host's nginx (and eventually Cloudflare
DNS for db.brunomoreira.dev) at 127.0.0.1:1339.
EOF
