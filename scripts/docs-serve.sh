#!/usr/bin/env bash
set -euo pipefail

# Serves the Sphinx docs (docs/) locally and rebuilds automatically whenever
# a source file changes -- no need to stop/restart the server or re-run the
# build command by hand while editing docs/source/**/*.rst.
#
# Uses sphinx-autobuild (docs/requirements.txt), which watches docs/source/
# and re-runs the same `sphinx -b html source build` this repo's docs are
# normally built with, then live-reloads any open browser tab via an
# injected script -- no manual refresh needed either.
#
# Usage:
#   ./scripts/docs-serve.sh              # serve on http://localhost:8000
#   DOCS_PORT=8010 ./scripts/docs-serve.sh
#   ./scripts/docs-serve.sh --open       # also open a browser tab on start
#
# Requires docs/venv to already exist (see README.rst's docs section for
# first-time setup: python3 -m venv venv && venv/bin/pip install -r
# requirements.txt, run from docs/). This script installs/updates packages
# from requirements.txt into that venv on every run (cheap no-op if already
# current), so a newly added dependency like sphinx-autobuild itself is
# picked up without a separate manual step.

cd "$(dirname "$0")/../docs"

PORT="${DOCS_PORT:-8000}"
OPEN_BROWSER=false

for arg in "$@"; do
  case "$arg" in
    --open)
      OPEN_BROWSER=true
      ;;
    *)
      echo "Unknown argument: $arg" >&2
      echo "Usage: $0 [--open]" >&2
      exit 1
      ;;
  esac
done

if [ ! -x venv/bin/python ]; then
  echo "docs/venv not found. Set it up first:" >&2
  echo "  cd docs && python3 -m venv venv && venv/bin/pip install -r requirements.txt" >&2
  exit 1
fi

venv/bin/pip install --quiet -r requirements.txt

AUTOBUILD_ARGS=(--host 0.0.0.0 --port "$PORT" source build)
if [ "$OPEN_BROWSER" = true ]; then
  AUTOBUILD_ARGS=(--open-browser "${AUTOBUILD_ARGS[@]}")
fi

echo "Serving docs on http://localhost:${PORT} (rebuilds on every save, Ctrl+C to stop)"
exec venv/bin/sphinx-autobuild "${AUTOBUILD_ARGS[@]}"
