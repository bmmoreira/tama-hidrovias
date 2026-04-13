#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEFAULT_BACKUP_DIR="$ROOT_DIR/backups/strapi"
UPLOADS_DIR="$ROOT_DIR/cms/public/uploads"

USE_DEV_COMPOSE=0
COMMAND=""
ARCHIVE_PATH=""

usage() {
  cat <<'EOF'
Usage:
  ./strapi-data-transfer.sh [--dev] export [archive-path]
  ./strapi-data-transfer.sh [--dev] import <archive-path>

What gets transferred:
  - PostgreSQL database dump for the Strapi app data, users, roles, and content
  - cms/public/uploads media files used by the local Strapi upload provider

Examples:
  ./strapi-data-transfer.sh export
  ./strapi-data-transfer.sh export backups/strapi/my-backup.tar.gz
  ./strapi-data-transfer.sh --dev import backups/strapi/strapi-data-20260412-153000.tar.gz

Notes:
  - Run this from the project root.
  - The import command restores the database and replaces cms/public/uploads.
  - The --dev flag makes the script use docker-compose.dev.yml in addition to docker-compose.yml.
EOF
}

log() {
  printf '[strapi-transfer] %s\n' "$*"
}

die() {
  printf '[strapi-transfer] ERROR: %s\n' "$*" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || die "Missing required command: $1"
}

compose_cmd() {
  local args=()
  args=(-f "$ROOT_DIR/docker-compose.yml")

  if [[ "$USE_DEV_COMPOSE" == "1" ]]; then
    args+=(-f "$ROOT_DIR/docker-compose.dev.yml")
  fi

  docker compose "${args[@]}" "$@"
}

wait_for_postgres() {
  local retries=30

  while (( retries > 0 )); do
    if compose_cmd exec -T postgres sh -lc 'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"' >/dev/null 2>&1; then
      return 0
    fi

    retries=$((retries - 1))
    sleep 2
  done

  die 'PostgreSQL did not become ready in time.'
}

export_data() {
  local archive_path="$1"
  local work_dir
  local timestamp

  timestamp="$(date +%Y%m%d-%H%M%S)"

  if [[ -z "$archive_path" ]]; then
    mkdir -p "$DEFAULT_BACKUP_DIR"
    archive_path="$DEFAULT_BACKUP_DIR/strapi-data-$timestamp.tar.gz"
  else
    mkdir -p "$(dirname "$archive_path")"
  fi

  work_dir="$(mktemp -d)"
  trap 'rm -rf "$work_dir"' RETURN

  log 'Ensuring PostgreSQL container is running.'
  compose_cmd up -d postgres >/dev/null
  wait_for_postgres

  log 'Dumping PostgreSQL data from the dockerized Strapi database.'
  compose_cmd exec -T postgres sh -lc '
    export PGPASSWORD="$POSTGRES_PASSWORD"
    pg_dump \
      -U "$POSTGRES_USER" \
      -d "$POSTGRES_DB" \
      --clean \
      --if-exists \
      --no-owner \
      --no-privileges
  ' > "$work_dir/postgres.sql"

  log 'Archiving Strapi uploads.'
  mkdir -p "$UPLOADS_DIR"
  tar -czf "$work_dir/uploads.tar.gz" -C "$ROOT_DIR/cms/public" uploads

  cat > "$work_dir/manifest.txt" <<EOF
created_at=$timestamp
compose_mode=$([[ "$USE_DEV_COMPOSE" == "1" ]] && echo dev || echo base)
database_service=postgres
strapi_service=strapi
uploads_path=cms/public/uploads
EOF

  tar -czf "$archive_path" -C "$work_dir" postgres.sql uploads.tar.gz manifest.txt

  log "Backup created at: $archive_path"
}

import_data() {
  local archive_path="$1"
  local work_dir

  [[ -f "$archive_path" ]] || die "Archive not found: $archive_path"

  work_dir="$(mktemp -d)"
  trap 'rm -rf "$work_dir"' RETURN

  log 'Extracting backup archive.'
  tar -xzf "$archive_path" -C "$work_dir"

  [[ -f "$work_dir/postgres.sql" ]] || die 'Archive is missing postgres.sql'
  [[ -f "$work_dir/uploads.tar.gz" ]] || die 'Archive is missing uploads.tar.gz'

  log 'Ensuring PostgreSQL container is running.'
  compose_cmd up -d postgres >/dev/null
  wait_for_postgres

  log 'Stopping Strapi and web during restore to avoid concurrent writes.'
  compose_cmd stop strapi web >/dev/null 2>&1 || true

  log 'Restoring PostgreSQL dump.'
  compose_cmd exec -T postgres sh -lc '
    export PGPASSWORD="$POSTGRES_PASSWORD"
    psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"
  ' < "$work_dir/postgres.sql"

  log 'Replacing Strapi uploads directory.'
  rm -rf "$UPLOADS_DIR"
  mkdir -p "$ROOT_DIR/cms/public"
  tar -xzf "$work_dir/uploads.tar.gz" -C "$ROOT_DIR/cms/public"

  log 'Starting Strapi and web again.'
  compose_cmd up -d strapi web >/dev/null

  log 'Restore completed successfully.'
}

while (($# > 0)); do
  case "$1" in
    --dev)
      USE_DEV_COMPOSE=1
      shift
      ;;
    export|import)
      COMMAND="$1"
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      if [[ -z "$ARCHIVE_PATH" ]]; then
        ARCHIVE_PATH="$1"
        shift
      else
        die "Unexpected argument: $1"
      fi
      ;;
  esac
done

[[ -n "$COMMAND" ]] || {
  usage
  exit 1
}

require_command docker
require_command tar

case "$COMMAND" in
  export)
    export_data "$ARCHIVE_PATH"
    ;;
  import)
    [[ -n "$ARCHIVE_PATH" ]] || die 'Import requires an archive path.'
    import_data "$ARCHIVE_PATH"
    ;;
  *)
    die "Unsupported command: $COMMAND"
    ;;
esac