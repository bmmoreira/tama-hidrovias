#!/usr/bin/env bash
set -euo pipefail

# Deploys/updates the Next.js frontend (web/) to the "google" host, run
# standalone via pm2 (mirroring the other Next.js sites already on that box:
# maphidro, brunomoreira.dev) instead of Docker Compose like netuno.
#
# Unlike the netuno deployment, this target does NOT run its own Strapi/
# Postgres/TiTiler stack -- it talks to services that already live elsewhere:
#   - Strapi ("strapi-01" pm2 process, already running on this same host,
#     port 1338) via loopback for server-side calls, and the public
#     https://api.hydrologyfromspace.org domain for the client bundle.
#   - TiTiler/tiles and static assets stay on the netuno deployment
#     (https://tiles.brunomoreira.dev), unchanged.
# See scripts/google-env-production.template for the exact env values used.
#
# Usage:
#   ./scripts/deploy-google.sh            # sync + build + (re)start
#   ./scripts/deploy-google.sh --dry-run  # show what would be synced, change nothing
#
# Requires the `google` host to already be configured in ~/.ssh/config, and
# scripts/google-env-production.template to exist locally (gitignored --
# contains the Mapbox token; copy scripts/google-env-production.template.example
# if you need to recreate it).

cd "$(dirname "$0")/.."

REMOTE="google"
REMOTE_DIR="/home/bmmoreira/projects/nextjs/tama"
PM2_NAME="tama"
PORT="3004"
ENV_FILE="scripts/google-env-production.template"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Missing ${ENV_FILE} -- this holds the production env vars for the" >&2
  echo "google deployment (Strapi/TiTiler URLs, Mapbox token, etc.) and is" >&2
  echo "gitignored since it contains secrets. Create it before deploying." >&2
  exit 1
fi

RSYNC_ARGS=(-az --delete
  --exclude='.git/'
  --exclude='node_modules/'
  --exclude='.next/'
  --exclude='.env*'
  --exclude='typedoc/'
)

if [[ "${1:-}" == "--dry-run" ]]; then
  RSYNC_ARGS+=(--dry-run --verbose)
  echo "==> DRY RUN: showing what would sync to ${REMOTE}:${REMOTE_DIR} (nothing will change)"
else
  echo "==> Syncing web/ to ${REMOTE}:${REMOTE_DIR}"
fi

ssh "${REMOTE}" "mkdir -p '${REMOTE_DIR}'"
rsync "${RSYNC_ARGS[@]}" ./web/ "${REMOTE}:${REMOTE_DIR}/"

if [[ "${1:-}" == "--dry-run" ]]; then
  echo "==> Dry run only, not touching the remote process."
  exit 0
fi

echo "==> Pushing production env file"
scp "${ENV_FILE}" "${REMOTE}:${REMOTE_DIR}/.env.production"

echo "==> Installing dependencies and building on ${REMOTE}"
ssh "${REMOTE}" "cd '${REMOTE_DIR}' && npm install --legacy-peer-deps && npm run build"

echo "==> Starting/reloading pm2 process '${PM2_NAME}'"
ssh "${REMOTE}" "cd '${REMOTE_DIR}' && \
  if pm2 describe '${PM2_NAME}' >/dev/null 2>&1; then \
    pm2 reload '${PM2_NAME}'; \
  else \
    pm2 start ./node_modules/next/dist/bin/next --name '${PM2_NAME}' -- start -p ${PORT}; \
  fi && \
  pm2 save"

cat <<EOF

Done. The app is running under pm2 as '${PM2_NAME}' on 127.0.0.1:${PORT}.
Check status: ssh ${REMOTE} "pm2 show ${PM2_NAME}"
View logs:    ssh ${REMOTE} "pm2 logs ${PM2_NAME} --lines 100"

Remaining manual step: point this host's nginx (and eventually Cloudflare
DNS for tama-hidrovias.brunomoreira.dev) at 127.0.0.1:${PORT}, the same way
maphidro/brunomoreira.dev are already wired up.
EOF
