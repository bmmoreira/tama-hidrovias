#!/usr/bin/env bash

set -euo pipefail

echo "Checking Tama Hidrovias gateway endpoints with curl..."
echo

check() {
  local name="$1"
  local url="$2"

  printf '→ %-30s %s\n' "$name" "$url"

  if curl --silent --show-error --fail "$url" > /dev/null; then
    echo "   OK"
  else
    echo "   FAILED" >&2
    exit 1
  fi

  echo
}

# App (Next.js) via Nginx gateway
check "App (Next.js)" "http://app.local/"

# Strapi CMS admin
check "Strapi CMS" "http://db.local/admin/"

# Static assets (repo assets/ mounted into Nginx)
check "Assets (logo5.png)" "http://assets.local/logo5.png"

# TileServer root UI
check "TileServer" "http://tiles.local/"

echo "All gateway checks passed."
