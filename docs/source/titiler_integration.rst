TiTiler integration and Next.js proxy
=====================================

This page documents how the Next.js frontend (`web`) integrates with a local
TiTiler instance (`hfs-titiler`), the server-side proxy pattern used to keep
internal tokens secret, helper utilities, and recommended practices for
building dashboard pages that call TiTiler.

Overview
--------

The `web` Next app proxies client requests to the TiTiler service via a
catch-all route at ``web/src/app/api/titiler/[...path]/route.ts``. This keeps
TiTiler tokens and internal network visibility server-side, and avoids
exposing secrets in the browser.

The proxy implements a whitelist of allowed request headers, normalizes
paths (avoids duplicate ``/map/map/...`` forwards), injects an internal
TiTiler token as ``Authorization: Bearer <token>`` and as an
``access_token`` query parameter when necessary, and strips forwarded
``Content-Length`` on responses to avoid ``ERR_CONTENT_LENGTH_MISMATCH`` in
the browser.

Helper functions for fetching ``/map/cog/info`` and building tile/preview
URLs live in ``web/src/lib/titiler.ts`` and are recommended for server-side
usage in Next server components.

Key files
---------

- ``web/src/app/api/titiler/[...path]/route.ts`` — catch-all proxy route that
  forwards requests to TiTiler. Handles CORS, header whitelisting, token
  injection and response header sanitization.
- ``web/src/lib/titiler.ts`` — helpers to fetch and format TiTiler metadata,
  and to build tile/preview URL templates.
- ``web/src/app/dashboard/tiffs/`` — dashboard pages/components that use
  TiTiler info: ``page.tsx``, ``MetadataPanel.tsx``, ``LoadBestTile.tsx``,
  and ``MapViewer``.

Proxy behaviour (summary)
------------------------

- Client calls under ``/api/titiler/*`` are proxied to the internal
  ``TITILER_INTERNAL_URL`` (default ``http://hfs-titiler:8000``).
- If ``TITILER_INTERNAL_TOKEN`` is configured, the proxy will append
  ``access_token=<token>`` to upstream URLs when the client did not already
  provide ``access_token``, and it will add ``Authorization: Bearer <token>``
  on the proxied request.
- Request headers are limited to a safe whitelist; notably, ``content-length``
  is not forwarded from the client.
- Response headers forwarded to browsers are restricted to safe values
  (``content-type``, ``cache-control``, ``expires``, ``etag``,
  ``last-modified``) and any ``x-titiler-cache-status`` values. CORS
  headers are mirrored from the incoming ``Origin`` header when present.

Environments & variables
------------------------

- ``TITILER_INTERNAL_URL`` — base URL for TiTiler inside the Docker network
  (default: ``http://hfs-titiler:8000``).
- ``TITILER_INTERNAL_TOKEN`` — optional server-only token used to access
  protected TiTiler endpoints from the Next server.
- ``LOG_LEVEL`` — pino logging level used by the server proxy (e.g.
  ``debug``, ``info``).

URL patterns and examples
-------------------------

Common TiTiler endpoints used by the app:

- ``/map/cog/info?url=<encoded-url>`` — returns metadata: bounds, width/height,
  bands, overviews, statistics, etc.
- ``/map/cog/tiles/{TileMatrixSet}/{z}/{x}/{y}?url=<encoded-url>`` — tile
  endpoint; include the TileMatrixSet (for example ``WebMercatorQuad``).
- ``/map/cog/preview?url=<encoded-url>&width=512&height=512`` — small preview
  image.

Server vs client usage
----------------------

- Server-side (Next server components): call ``fetchCogInfo()`` from
  ``web/src/lib/titiler.ts`` to keep tokens internal and render pages with
  metadata pre-populated.
- Client-side: use the proxied endpoints under ``/api/titiler/...`` for
  interactive controls; the Next proxy will inject internal tokens when
  needed.

Handling out-of-bounds tile requests
-----------------------------------

Mapbox often requests tiles outside a dataset's bounds which results in
404 responses from TiTiler ("Tile(...) is outside bounds"). Strategies to
reduce these requests:

- Provide ``bounds`` and sensible ``minzoom``/``maxzoom`` for Mapbox raster
  sources. The dashboard's ``MapViewer`` already forwards these when
  available.
- Optional improvement: implement server-side clamping in the proxy. The
  proxy can fetch ``/map/cog/info`` and compute allowed x/y ranges per
  zoom, returning 204 or an empty tile for clearly out-of-bounds requests.

Logging & troubleshooting
-------------------------

- Look for ``titiler-proxy.forward`` debug events in the ``web`` logs to
  inspect sanitized forwarded targets.
- TiTiler logs show requests to ``/map/cog/tiles/...`` and their response
  codes; 404s usually indicate OOB tile requests.

Example component
-----------------

A server-side example component exists at
``web/src/components/examples/TiffExampleCard.tsx`` which demonstrates how
to call ``fetchCogInfo()``, compute ``center``/``fitBounds``, and wire the
``MapViewer`` component with ``tileUrl``, ``minZoom`` and ``maxZoom``.

Next steps
----------

- Consider caching ``/map/cog/info`` results to reduce repeated probes.
- Optionally add server-side tile clamping to reduce TiTiler 404s.
- Add unit tests for the small helper functions in
  ``web/src/lib/titiler.ts``.
