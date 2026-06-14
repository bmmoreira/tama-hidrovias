#!/usr/bin/env bash
set -euo pipefail

# Run from project root: ./scripts/backup_and_push.sh
cd "$(dirname "$0")/.."
PROJECT_ROOT="$PWD"

echo "Project root: $PROJECT_ROOT"

# Ensure .env has HOST_UID / HOST_GID for mounts
if ! grep -q '^HOST_UID=' .env 2>/dev/null; then
  printf "\nHOST_UID=%s\nHOST_GID=%s\n" "$(id -u)" "$(id -g)" >> .env
  echo "Added HOST_UID/HOST_GID to .env"
fi

# Bring dev stack down/up and start
docker compose -f docker-compose.dev.yml down --remove-orphans || true
docker compose -f docker-compose.dev.yml up --build -d

# Wait for postgres readiness (best-effort)
echo "Waiting for postgres..."
for i in {1..30}; do
  if docker compose -f docker-compose.dev.yml exec -T postgres pg_isready -U "${POSTGRES_USER:-strapi}" >/dev/null 2>&1; then
    echo "Postgres is ready"
    break
  fi
  sleep 2
done

# Prepare backups dir
mkdir -p backups
timestamp=$(date +%Y%m%d_%H%M)

# Dump database (plain SQL and custom format)
echo "Dumping database to backups/db.sql and backups/db.dump ..."
docker compose -f docker-compose.dev.yml exec -T postgres \
  pg_dump -U "${POSTGRES_USER:-strapi}" "${POSTGRES_DB:-tama_hidrovias}" > backups/db.sql

docker compose -f docker-compose.dev.yml exec -T postgres \
  pg_dump -U "${POSTGRES_USER:-strapi}" -Fc "${POSTGRES_DB:-tama_hidrovias}" > backups/db.dump

# Copy Strapi uploads out of container (if running)
STRAPI_CID=$(docker compose -f docker-compose.dev.yml ps -q strapi || true)
if [ -n "$STRAPI_CID" ]; then
  echo "Copying Strapi uploads from container..."
  rm -rf backups/uploads || true
  docker cp "${STRAPI_CID}":/srv/app/public/uploads backups/uploads || echo "docker cp uploads failed; check path inside container"
else
  echo "strapi container not found; skipping uploads copy"
fi

# Copy GeoTIFFs from host assets if present
if [ -d assets/tiff ]; then
  echo "Copying assets/tiff ..."
  rm -rf backups/tiff || true
  cp -R assets/tiff backups/tiff
else
  echo "assets/tiff not found on host; skipping"
fi

# Save env and nginx config
cp .env backups/.env || true
rm -rf backups/nginx || true
cp -R nginx backups/nginx || true

# Archive backups
archive="backups-${timestamp}.tar.gz"
tar -czf "${archive}" backups
ls -lh "${archive}"
echo "Backup archive created: ${archive}"

# Commit & push legend/code changes (safe: will not fail script if nothing to commit)
git add web/src/components/maps/ForecastLegend.tsx || true
if git diff --staged --quiet; then
  echo "No staged changes to commit."
else
  git commit -m "docs: comment ForecastLegend and document legend/colormap behavior" || true
  git push origin HEAD || echo "git push failed; check credentials/remote"
fi

echo "Finished. Backup archive: ${archive}"
