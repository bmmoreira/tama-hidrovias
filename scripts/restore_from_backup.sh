#!/usr/bin/env bash
set -euo pipefail

# Usage:
# ./scripts/restore_from_backup.sh /full/path/to/backups-YYYYMMDD_HHMM.tar.gz
# or without arg to pick the newest backups-*.tar.gz in project root.
cd "$(dirname "$0")/.."
PROJECT_ROOT="$PWD"

ARCHIVE="${1:-}"

if [ -z "$ARCHIVE" ]; then
  ARCHIVE="$(ls -1t backups-*.tar.gz 2>/dev/null | head -n1 || true)"
  if [ -z "$ARCHIVE" ]; then
    echo "No archive provided and no backups-*.tar.gz found in project root."
    exit 1
  fi
fi

if [ ! -f "$ARCHIVE" ]; then
  echo "Archive not found: $ARCHIVE"
  exit 1
fi

echo "Using archive: $ARCHIVE"

# Extract into a temp restore dir
restore_dir="restore_tmp_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$restore_dir"
tar -xzf "$ARCHIVE" -C "$restore_dir"
echo "Extracted archive to $restore_dir"

# Optional: ensure .env in project root is replaced by backed-up version
if [ -f "$restore_dir/backups/.env" ]; then
  echo "Restoring .env from backup (will overwrite local .env)"
  cp "$restore_dir/backups/.env" .env
fi

# Ensure HOST_UID/GID always match the current host, even when restored .env
# came from a different machine.
current_uid="$(id -u)"
current_gid="$(id -g)"

if [ -f .env ]; then
  if grep -q '^HOST_UID=' .env; then
    sed -i "s/^HOST_UID=.*/HOST_UID=${current_uid}/" .env
  else
    printf "\nHOST_UID=%s\n" "$current_uid" >> .env
  fi

  if grep -q '^HOST_GID=' .env; then
    sed -i "s/^HOST_GID=.*/HOST_GID=${current_gid}/" .env
  else
    printf "HOST_GID=%s\n" "$current_gid" >> .env
  fi
else
  printf "HOST_UID=%s\nHOST_GID=%s\n" "$current_uid" "$current_gid" > .env
fi

echo "Set HOST_UID/HOST_GID in .env to ${current_uid}:${current_gid}"

# Start postgres only to perform restore
echo "Starting postgres service..."
docker compose -f docker-compose.dev.yml up -d postgres

# Wait for postgres readiness
echo "Waiting for postgres..."
for i in {1..30}; do
  if docker compose -f docker-compose.dev.yml exec -T postgres pg_isready -U "${POSTGRES_USER:-strapi}" >/dev/null 2>&1; then
    echo "Postgres is ready"
    break
  fi
  sleep 2
done

# Restore DB: prefer plain SQL if present, else custom dump
if [ -f "$restore_dir/backups/db.sql" ]; then
  echo "Restoring plain SQL dump..."
  docker compose -f docker-compose.dev.yml exec -T postgres psql -U "${POSTGRES_USER:-strapi}" -d "${POSTGRES_DB:-tama_hidrovias}" < "$restore_dir/backups/db.sql"
elif [ -f "$restore_dir/backups/db.dump" ]; then
  echo "Restoring custom format dump via pg_restore..."
  # pg_restore via stdin
  docker compose -f docker-compose.dev.yml exec -T postgres pg_restore -U "${POSTGRES_USER:-strapi}" -d "${POSTGRES_DB:-tama_hidrovias}" < "$restore_dir/backups/db.dump"
else
  echo "No DB dump found in archive; skipping DB restore."
fi

# Restore uploads into the host-mounted Strapi public directory if backup present
if [ -d "$restore_dir/backups/uploads" ]; then
  echo "Restoring uploads into cms/public/uploads..."
  rm -rf cms/public/uploads || true
  mkdir -p cms/public
  cp -R "$restore_dir/backups/uploads" cms/public/uploads
  HOST_UID=$(grep '^HOST_UID=' .env | cut -d= -f2 || echo "$current_uid")
  HOST_GID=$(grep '^HOST_GID=' .env | cut -d= -f2 || echo "$current_gid")
  chown -R "${HOST_UID}:${HOST_GID}" cms/public/uploads || true
else
  echo "No uploads backup present; skipping uploads restore"
fi

# Restore GeoTIFFs to host assets/tiff if present in backup
if [ -d "$restore_dir/backups/tiff" ]; then
  echo "Restoring assets/tiff on host..."
  rm -rf assets/tiff || true
  mkdir -p assets
  cp -R "$restore_dir/backups/tiff" assets/tiff
else
  echo "No tiff backup present; skipping"
fi

# Restore nginx config if provided
if [ -d "$restore_dir/backups/nginx" ]; then
  echo "Restoring nginx config (overwriting nginx/)..."
  rm -rf nginx || true
  cp -R "$restore_dir/backups/nginx" nginx
fi

# Start full stack
echo "Starting full stack..."
docker compose -f docker-compose.dev.yml up -d --build

# Show logs tail to help debugging
echo "Tailing key service logs (strapi postgres nginx) for 15s..."
docker compose -f docker-compose.dev.yml logs --tail=200 strapi postgres nginx || true

echo "Restore finished. Clean up: $restore_dir (you may remove it)."
