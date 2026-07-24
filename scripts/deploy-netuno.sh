#!/usr/bin/env bash
set -euo pipefail

# Deploys/updates the netuno test environment from the current local working
# tree (uncommitted changes included -- this is a test env, not a release
# pipeline). Rerun this script any time to push the latest local state.
#
# Usage:
#   ./scripts/deploy-netuno.sh            # sync + rebuild + restart
#   ./scripts/deploy-netuno.sh --dry-run  # show what would be synced, change nothing
#
# Requires the `netuno` host to already be configured in ~/.ssh/config.

cd "$(dirname "$0")/.."

REMOTE="netuno"
REMOTE_DIR="/home/hidro/tama"
# netuno already has other containers on host port 8000 (portainer), so this
# stack's nginx publishes a different host port there. Only used for direct
# debugging -- Nginx Proxy Manager reaches the container over the `frontend`
# Docker network, not through this port. See docker-compose.yml/.prod.yml.
NGINX_HOST_PORT="8088"

RSYNC_ARGS=(-az --delete
  --exclude='.git/'
  --exclude='node_modules/'
  --exclude='.next/'
  --exclude='venv/'
  --exclude='__pycache__/'
  --exclude='build/'
  --exclude='web/typedoc/'
  --exclude='backups/'
  --exclude='restore_tmp_*/'
  --exclude='*.tar.gz'
  --exclude='.DS_Store'
  # Server-owned state: Strapi media uploads and forecast GeoTIFFs can be
  # added directly on netuno (admin uploads, pipeline output) without ever
  # existing locally. `--delete` would erase them the moment they diverge
  # from the local tree, so routine code deploys must never touch these --
  # use scripts/backup_and_push.sh / restore_from_backup.sh to sync them
  # deliberately instead.
  --exclude='cms/public/uploads/'
  --exclude='assets/tiff/'
)

if [[ "${1:-}" == "--dry-run" ]]; then
  RSYNC_ARGS+=(--dry-run --verbose)
  echo "==> DRY RUN: showing what would sync to ${REMOTE}:${REMOTE_DIR} (nothing will change)"
else
  echo "==> Syncing project files to ${REMOTE}:${REMOTE_DIR}"
fi

rsync "${RSYNC_ARGS[@]}" ./ "${REMOTE}:${REMOTE_DIR}/"

if [[ "${1:-}" == "--dry-run" ]]; then
  echo "==> Dry run only, not touching containers on ${REMOTE}."
  exit 0
fi

echo "==> Building and (re)starting the stack on ${REMOTE}"
ssh "${REMOTE}" "cd '${REMOTE_DIR}' && NGINX_HOST_PORT=${NGINX_HOST_PORT} docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build --remove-orphans"

echo "==> Pruning dangling images on ${REMOTE}"
ssh "${REMOTE}" "docker image prune -f"

cat <<EOF

Done. Container status:
EOF
ssh "${REMOTE}" "cd '${REMOTE_DIR}' && docker compose -f docker-compose.yml -f docker-compose.prod.yml ps"

cat <<'EOF'

If this is the first deploy, one-time setup is still needed in Nginx Proxy
Manager (http://146.164.74.29:4081): create a Proxy Host for each of
  tama-hidrovias.brunomoreira.dev / db.brunomoreira.dev / tiles.brunomoreira.dev / assets.brunomoreira.dev
forwarding to "tama-nginx" port 80 on the `frontend` network.
EOF
