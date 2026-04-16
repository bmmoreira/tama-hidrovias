## TiTiler integration and Next.js proxy (tama-hidrovias)

This document explains how the Next.js app (`web`) integrates with a local TiTiler instance (`hfs-titiler`), the proxy patterns used, helper utilities, and recommended practices for building dashboard pages that call TiTiler.

Sections
- Overview
- Key files
- Proxy behaviour
- Environment variables
- URL patterns and examples
- Server vs client usage
- CORS, preflight and Range
- Troubleshooting & logs
- Next steps / optional improvements

## Overview

The `web` Next app proxies client requests to the TiTiler service via a catch-all route at `web/src/app/api/titiler/[...path]/route.ts`. This keeps TiTiler tokens and internal network visibility server-side, and protects browser clients from leaking internal secrets.

The proxy implements a whitelist of allowed request headers, normalizes paths (avoids duplicate `/map/map/...` forwards), injects an internal TiTiler token as `Authorization: Bearer <token>` and as an `access_token` query parameter, and strips forwarded `Content-Length` on responses to avoid ERR_CONTENT_LENGTH_MISMATCH problems on the browser.

There are also helper utilities in `web/src/lib/titiler.ts` to fetch `/map/cog/info` and to build tile/preview URLs that pages can reuse.

## Key files

- `web/src/app/api/titiler/[...path]/route.ts` — catch-all Next API route which forwards requests to TiTiler. Handles OPTIONS/HEAD, header whitelisting, token injection, response header sanitization and CORS.
- `web/src/lib/titiler.ts` — helper functions for building tile URLs and fetching/formatting TiTiler metadata (used by server components and pages).
- `web/src/app/dashboard/tiffs/` — dashboard pages/components that use TiTiler info: `page.tsx`, `MetadataPanel.tsx`, `LoadBestTile.tsx`, `MapViewer`.

## Proxy behaviour (high level)

- Incoming client requests under `/api/titiler/*` are normalized and proxied to the internal `TITILER_INTERNAL_URL` (default `http://hfs-titiler:8000`).
- If `TITILER_INTERNAL_TOKEN` is set, the proxy appends `?access_token=<token>` to upstream URLs when the client didn't include `access_token`, and adds `Authorization: Bearer <token>` in request headers.
- The proxy strips/limits request headers to a safe whitelist. Notably, it does NOT forward `content-length` (to avoid mismatches) and only forwards these request headers: `accept`, `accept-language`, `accept-encoding`, `cache-control`, `if-none-match`, `if-modified-since`, `range`, `content-type`, `referer`, `user-agent`, `x-requested-with`.
- On the response, the proxy forwards safe response headers like `content-type`, `cache-control`, `expires`, `etag`, `last-modified`, and any `x-titiler-cache-status`. It adds CORS `Access-Control-Allow-Origin` mirroring the request Origin when present.

## Environment variables

- `TITILER_INTERNAL_URL` (default `http://hfs-titiler:8000`) — base URL for the internal TiTiler service.
- `TITILER_INTERNAL_TOKEN` (optional) — if set, the proxy will inject this token server-side into upstream requests and will not expose it in logs. Keep it secret.
- `LOG_LEVEL` — logging level used by `pino` for server-side logs (e.g., `debug`, `info`, `warn`). The proxy logs `titiler-proxy.forward` events with a sanitized target and request headers (authorization redacted).

## URL patterns and examples

TiTiler `map` endpoints commonly used by the app:

- Info: `/map/cog/info?url=<encoded-url>`
  - Returns metadata like bounds, width/height, bands, overviews and dataset statistics.
- Tiles: `/map/cog/tiles/{TileMatrixSet}/{z}/{x}/{y}?url=<encoded-url>&format=png&bidx=1&rescale=min,max&colormap_name=viridis`
  - Important: include the TileMatrixSet (e.g., `WebMercatorQuad`) in the path. Mapbox `raster` sources require tile templates like `/api/titiler/map/cog/tiles/WebMercatorQuad/{z}/{x}/{y}?url=...`
- Preview: `/map/cog/preview?url=<encoded-url>&width=512&height=512&bidx=1&colormap_name=gray`

Example proxied URL (browser -> Next -> TiTiler):

GET /api/titiler/map/cog/info?url=file%3A%2F%2F%2Fapp%2Fimages%2FFloodplains_Interfluvial_cog.tif

The proxy will forward that to something like:

http://hfs-titiler:8000/map/cog/info?url=file:///app/images/Floodplains_Interfluvial_cog.tif&access_token=<REDACTED>

(If internal base already includes `/map` the proxy normalizes and ensures only a single `/map` prefix appears.)

## Server vs client usage patterns

- Server-side (Next Server Components): Use `web/src/lib/titiler.ts` to call `fetchCogInfo()` from within server components/pages. This keeps tokens and internal endpoints server-only and is ideal for rendering the TIFF list with metadata on the server.
- Client-side: For interactive controls (Refresh, LoadBestTile probes), call the proxied endpoints under `/api/titiler/...` from client components. The proxy injects tokens server-side so the browser never directly sees TiTiler credentials.

Notes:
- Use GET for tile probes. HEAD was unreliable across the chain during development; TiTiler and the proxy may behave differently for HEAD requests.
- Prefer server-side fetching for stable metadata used in initial page render; fall back to client-side refresh when needed for live updates.

## CORS, preflight and Range

- The proxy answers `OPTIONS` preflight requests with permissive but safe CORS headers mirroring the `Origin` header when present.
- `Range` requests are allowed through the request header whitelist; however, the proxy will already sanitize response headers and avoids forwarding `content-length`.

## Handling out-of-bounds (OOB) tile requests

Mapbox will often request tiles outside a dataset's bounds. TiTiler returns 404 with messages like `Tile(x=..., y=..., z=...) is outside bounds`. Strategies:

- Provide `bounds` and sensible `minzoom`/`maxzoom` when creating Mapbox raster sources (the dashboard's `MapViewer` already forwards these when available). This reduces OOB requests.
- Optional improvement: Server-side clamping in the proxy. The proxy can fetch `/map/cog/info` and compute allowed x/y ranges for requested z, and return a 204/empty tile for obviously OOB requests without forwarding. This reduces TiTiler 404 noise and unnecessary CPU work.

## Logging and observability

- Server-side logs use `pino`. The proxy emits `titiler-proxy.forward` debug events with `target` and sanitized headers. Look for this key to track proxied forwards.
- TiTiler logs show `GET /map/cog/tiles/...` entries and return codes (200, 404). 404s often indicate OOB requests.

Quick troubleshooting commands (run from repo root):

```bash
# Tail web + titiler logs (use the absolute compose file if you run outside the project folder):
cd /Users/bmmoreira/tama/tama-hidrovias
docker compose -f docker-compose.yml logs --no-color --follow web hfs-titiler

# Show only titiler-proxy logs from the web container (useful when debugging forwards):
docker compose -f docker-compose.yml logs --no-color --tail 200 web | grep -Ei "titiler-proxy.forward|upstream_fetch_failed|titiler-proxy" || true

# Rebuild the web container after code changes:
docker compose -f docker-compose.yml up -d --build web
```

## Troubleshooting

- ERR_CONTENT_LENGTH_MISMATCH: Ensure the proxy is NOT forwarding upstream `content-length`. The proxy intentionally strips `content-length` on responses and no longer forwards `content-length` from the request headers.
- 404s for `/map/map/...`: This was caused by duplicate `/map` prefixes during forwarding — the proxy includes normalization logic to avoid producing duplicated `/map/map/...` paths.
- If metadata fails to appear in the UI, open browser devtools network tab and look for `/api/titiler/map/cog/info` and check the response code and JSON detail. Also tail `web` logs and look for `titiler-proxy.forward` and corresponding TiTiler log lines.

## Next steps and recommendations

- Consider implementing server-side tile clamping in the proxy to eliminate many OOB forwards.
- Add caching for `/map/cog/info` results (either in-memory LRU on the Next server or a small Redis/HTTP cache) since this metadata is relatively static and reduces repeated probes.
- Replace any temporary `any` typings in server pages (some were relaxed to unblock builds) once the Next.js version is finalized.
- Add unit tests around `web/src/lib/titiler.ts` helpers. They are small and pure enough to test formatting logic.

### Example component

There's a small server-side example component included in the repository to demonstrate best practices:

- `web/src/components/examples/TiffExampleCard.tsx` — a server component that calls `fetchCogInfo(filename)`, computes `center`/`fitBounds`, builds a proxied `tileUrl` template (`/api/titiler/map/cog/tiles/WebMercatorQuad/{z}/{x}/{y}?url=...`) and renders the client `MapViewer` component with `minZoom`/`maxZoom` hints.

Use this component as a template when building new dashboard pages that need to surface COG metadata and embed a live map preview.

## Recent code changes that affect TiTiler integration

- Proxy header whitelist tightened and `content-length` removed from forwarded request headers.
- Proxy normalizes `map/` path segments to avoid `/map/map/...` duplication.
- MetadataPanel client and server helpers were added so the dashboard surfaces `/map/cog/info` metadata and can refresh it from the UI.
- Tile templates now include the `TileMatrixSet` identifier (e.g. `WebMercatorQuad`) which TiTiler requires for the `/tiles` endpoint.

---

If you want, I can:
- Add a short example component (TSX) demonstrating server-side `fetchCogInfo()` usage and how to wire MapViewer with the returned bounds/minZoom/maxZoom.
- Implement server-side clamping logic in the proxy and add tests.
