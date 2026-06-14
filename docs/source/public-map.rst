Public Map Forecast Flow
========================

Quick Summary
-------------

High-level data flow for the public ``/map`` forecast overlay:

1. The browser opens ``/map`` and loads stations plus public app settings.
2. ``web/src/components/maps/ForecastDrawer.tsx`` requests
   ``GET /api/forecast-tiles``.
3. ``web/src/app/api/forecast-tiles/route.ts`` reads the shared
   ``assets/tiles`` directory and groups forecast GeoTIFF files by area.
4. When a frame becomes active, the drawer requests
   ``GET /api/forecast-tiles/:slug/metadata`` for bounds and statistics.
5. ``web/src/app/api/forecast-tiles/[slug]/metadata/route.ts`` asks TiTiler
   for ``/cog/info`` and ``/cog/statistics``.
6. The drawer builds a same-origin tile URL pointing at
   ``/api/forecast-tiles/:slug/:z/:x/:y.png``.
7. ``web/src/app/api/forecast-tiles/[slug]/[z]/[x]/[y]/route.ts`` proxies the
   tile request to TiTiler ``/cog/tiles/WebMercatorQuad/...``.
8. ``web/src/components/MapboxMap.tsx`` renders the raster overlay above the
   basemap and optionally fits the map to the forecast bounds.

Overview
--------

The public map now supports a forecast drawer that lets visitors:

- browse grouped forecast GeoTIFF frames by area
- inspect one frame at a time or animate the time sequence
- adjust colormap, opacity, and render range before tiles are requested
- keep forecast rendering on internal Next.js routes instead of calling
  TiTiler directly from the browser

This design keeps the browser on same-origin API routes while allowing the
server layer to translate UI state into TiTiler parameters.

Current Runtime Files
---------------------

Frontend route and component files:

- ``web/src/app/map/page.tsx``
- ``web/src/components/maps/ForecastDrawer.tsx``
- ``web/src/components/MapboxMap.tsx``
- ``web/src/lib/forecast-tiles.ts``

Next.js internal API files:

- ``web/src/app/api/forecast-tiles/route.ts``
- ``web/src/app/api/forecast-tiles/[slug]/metadata/route.ts``
- ``web/src/app/api/forecast-tiles/[slug]/[z]/[x]/[y]/route.ts``

Infrastructure files:

- ``docker-compose.yml``
- ``docker-compose.dev.yml``
- ``nginx/nginx.conf``

Route And Data Flow
-------------------

The public map now combines three data sources:

- ``GET /api/stations`` for station points and explorer metadata
- ``GET /api/app-settings`` for public map defaults
- ``GET /api/forecast-tiles`` plus the metadata and tile routes for the
  forecast overlay

The forecast-specific request flow is:

1. ``/map`` mounts ``ForecastDrawer`` as a child of ``MapboxMap``.
2. The drawer fetches ``/api/forecast-tiles``.
3. The list route scans the mounted GeoTIFF directory and returns grouped
   frames with one metadata URL and one tile URL template per frame.
4. Selecting a frame triggers ``/api/forecast-tiles/:slug/metadata``.
5. The metadata route calls TiTiler ``/cog/info`` for bounds and
   ``/cog/statistics`` for value range suggestions.
6. The drawer uses those values to propose an automatic min/max range.
7. The drawer sends the active tile URL, bounds, and opacity back to the page
   through ``onTileLayerChange``.
8. ``MapboxMap`` registers a Mapbox raster source and layer for the active
   frame.
9. Each tile request flows through the Next.js proxy route into TiTiler.

Current Route List
------------------

- public page route: ``GET /map``
- forecast list route: ``GET /api/forecast-tiles``
- forecast metadata route: ``GET /api/forecast-tiles/:slug/metadata``
- forecast tile route: ``GET /api/forecast-tiles/:slug/:z/:x/:y.png``
- TiTiler info route: ``GET /cog/info``
- TiTiler statistics route: ``GET /cog/statistics``
- TiTiler tile route: ``GET /cog/tiles/WebMercatorQuad/:z/:x/:y.png``

Forecast Tile Discovery
-----------------------

``web/src/lib/forecast-tiles.ts`` is responsible for discovering files and
turning them into UI-friendly frame records. It reads directories recursively
to support aggregating files into logical areas by subfolder.

Current assumptions:

- forecast rasters live under ``assets/tiles`` on the host
- the web container sees the same files under ``/forecast-tiles``
- filenames optionally follow the pattern ``AREA_YYYYMMDD_HHMMSS[_WGS84].tif``
  or a more flexible datetime pattern like ``AREA_YYYY-MM-DDTHHhMM.tif``.

Grouping by Subfolder (The Subfolder Tweak)
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

If a ``.tif`` or ``.tiff`` file is placed inside a subfolder (for example,
``assets/tiles/tapajos/`` or ``assets/tiles/profundidade/``), the name of the
subfolder is automatically used as the target ``area`` (tag) to aggregate the
images. This allows administrators to drop images with custom names into a new
subfolder, and the application will instantly group them into a single playback
sequence in the ``ForecastDrawer`` for animation over the Mapbox map.

Derived frame fields include:

- ``area`` for grouping related frames (derived from the subfolder name, or falls back to the filename prefix)
- ``slug`` for route-safe frame lookup (uses the relative path of the file to prevent clashes)
- ``timestamp`` for ordering
- ``label`` for the drawer UI

Files that do not contain parsable dates will fall back to using extracted
numeric dates to ensure they can still be rendered and animated.

Rendering Controls
------------------

The drawer exposes a small set of rendering controls:

- ``colormap`` becomes TiTiler ``colormap_name``
- ``min`` and ``max`` become TiTiler ``rescale=min,max``
- opacity is applied in the Mapbox raster layer, not in TiTiler
- bounds returned by TiTiler are passed to ``MapboxMap`` for optional
  fit-to-bounds behaviour

Only analysts can see and edit the styling controls in the public drawer. For
other users, the palette, opacity, min, max, and animation interval come from
global app settings managed in the dashboard admin page.

To reduce unnecessary rerendering on the public map:

- ``ForecastDrawer`` avoids re-emitting identical overlay configurations
- ``MapboxMap`` updates raster opacity in place instead of recreating the
   raster source for opacity-only changes
- the forecast tile proxy now serves cacheable tile responses for repeated
   requests using the same tile URL

The metadata route returns:

- ``bounds`` from TiTiler ``/cog/info``
- raw ``min`` and ``max`` statistics
- ``recommendedMin`` and ``recommendedMax`` from percentiles when available

Operational Notes
-----------------

- The public map no longer depends on the removed TileServer GL service.
- The ``tiles.local`` gateway host now points to TiTiler for diagnostics.
- The Next.js tile proxy returns a 1x1 transparent PNG for out-of-bounds tiles
   so Mapbox receives a valid image response instead of an undecodable empty
   body.
- If new forecast files are added to ``assets/tiles``, the drawer will pick
   them up on the next request because the list and metadata routes still use
   ``cache: no-store``.
- Forecast tile responses are cacheable for a short period, which helps reduce
   repeated TiTiler work when the same visible tiles are requested again.

TypeScript API Reference
------------------------

The low-level TypeScript exports for the public forecast flow are documented in
the generated TypeDoc output under ``web/typedoc``.

Most relevant entries include:

- ``ForecastDrawer`` and ``ForecastOverlayConfig``
- ``MapboxMapProps`` raster overlay options
- ``listForecastTileGroups()`` and ``resolveForecastTileSource()``