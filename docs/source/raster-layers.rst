Raster Layers
==============

Quick Summary
-------------

``RasterLayer`` is a Strapi collection that stores spatial metadata and
colormap-stretch statistics for the hydrological GeoTIFFs served from
``assets/tiles`` (the same files listed on the
``dashboard/forecast-tiffs`` page and rendered by the public
``ForecastDrawer``).

High-level flow:

1. An analyst uploads a ``.tif``/``.tiff`` file on
   ``/dashboard/forecast-tiffs``.
2. Clicking the per-file **sync** button calls
   ``POST /api/raster-layers/sync`` with the file's relative path.
3. The Next.js route parses the filename, asks TiTiler for ``/cog/info``
   and ``/cog/statistics``, and upserts a matching ``RasterLayer`` entry in
   Strapi via ``POST /api/raster-layers/sync`` on the CMS.
4. ``/dashboard/forecast-tiffs`` and the public ``ForecastDrawer`` both read
   the resulting entries through ``GET /api/raster-layers`` and match them to
   on-disk files by filename.
5. ``ForecastDrawer`` uses the matched entry's ``computed_min`` /
   ``computed_max`` as the default colormap rescale range for that frame.

Schema
------

The collection lives at
``cms/src/api/raster-layer/content-types/raster-layer/schema.json``
(``collectionName: raster_layers``, singular ``raster-layer`` / plural
``raster-layers``, ``draftAndPublish`` enabled).

Core identifier and file reference:

- ``layer_id`` (string, unique, required) -- a slug derived from the
  filename, used as the upsert key for ``sync``.
- ``display_name`` (string, required) -- human-readable label for the UI.
- ``file_url`` (string, required) -- the relative path (or S3 URL) of the
  GeoTIFF. Only the basename is used when matching against files on disk.

Parsed from the filename:

- ``area_name`` (string, required)
- ``hydrology_variable`` (string, required)
- ``acquisition_date`` (date)
- ``acquisition_time`` (time)
- ``file_projection`` (string)

Rendering and statistics, from TiTiler ``/cog/statistics``:

- ``computed_min`` (decimal, required) -- typically the 2nd percentile.
- ``computed_max`` (decimal, required) -- typically the 98th percentile.
- ``colormap_name`` (enumeration, default ``viridis``) -- one of
  ``rainbow``, ``viridis``, ``plasma``, ``inferno``, ``magma``, ``cividis``,
  ``turbo``, ``terrain``, ``spectral``, ``blues``.

Spatial metadata, from TiTiler ``/cog/info``:

- ``bounds`` (json, required) -- ``[minX, minY, maxX, maxY]``.
- ``crs`` (string, default
  ``http://www.opengis.net/def/crs/EPSG/0/4326``)
- ``dtype`` (string)
- ``nodata_value`` (decimal)
- ``width`` / ``height`` (integer)
- ``band_count`` (integer) -- mapped from TiTiler's ``count``.

Filename Parsing Conventions
-----------------------------

``web/src/lib/raster-layer-filename.ts`` parses ``area_name``,
``hydrology_variable``, ``acquisition_date``, ``acquisition_time``, and
``file_projection`` directly from the GeoTIFF filename. Two acquisition
timestamp conventions are supported:

- ``AREA_VARIABLE_YYYYMMDD_HHMMSS[_PROJECTION].tif`` -- for example
  ``AMAZON_SURFACE_RUNOFF_20230601_000000_wgs84.tif``.
- ``AREA_VARIABLE_YYYY-MM-DDThhHmm[_PROJECTION].tif`` -- for example
  ``TAPAJOS_BATHYMETRY_2023-12-05T00h00_wgs84.tif``.

For both formats, the first underscore-separated token of the filename
prefix becomes ``area_name`` and the remaining tokens (joined and
lowercased) become ``hydrology_variable``. An optional trailing suffix
after the timestamp (for example ``wgs84``) becomes ``file_projection``.
``layer_id`` is a slugified version of the full filename (without
extension), and ``display_name`` joins the title-cased area, the
title-cased variable, and the acquisition date using a ``·`` separator.

``getRasterLayerFileBaseName()`` extracts the filename from a relative path
or full URL and is used everywhere a ``RasterLayer.file_url`` needs to be
matched against an on-disk file, regardless of any directory prefix.

Strapi Routes
-------------

Implemented in ``cms/src/api/raster-layer/``:

- ``GET /api/raster-layers/current/list`` -- returns all ``RasterLayer``
  entries (including drafts, via ``publicationState: 'preview'``), sorted by
  ``display_name:asc``. Requires a valid JWT for a user with role
  ``admin``, ``analyst``, ``viewer``, or ``super-admin``.
- ``POST /api/raster-layers/sync`` -- creates or updates a ``RasterLayer``
  entry, keyed on ``layer_id``. Requires a valid JWT for a user with role
  ``admin``, ``analyst``, or ``super-admin``. Validates that
  ``layer_id``, ``display_name``, ``file_url``, ``area_name``,
  ``hydrology_variable``, ``computed_min``, ``computed_max``, and ``bounds``
  are present, then publishes the entry immediately
  (``publishedAt: new Date().toISOString()``).
- Standard CRUD admin routes are also registered via
  ``createCoreRouter('api::raster-layer.raster-layer')`` for use from the
  Strapi admin panel.

Both custom routes use ``auth: false`` at the route level and instead verify
the bearer token manually inside the controller (the same pattern used by
``climate-layer``), so they can apply role checks that differ from Strapi's
default permission model.

Next.js Proxy Routes
---------------------

- ``GET /api/raster-layers``
  (``web/src/app/api/raster-layers/route.ts``) -- proxies to
  ``GET /api/raster-layers/current/list`` on the CMS, forwarding the
  caller's Strapi JWT. Requires an authenticated session.
- ``POST /api/raster-layers/sync``
  (``web/src/app/api/raster-layers/sync/route.ts``) -- accepts
  ``{ "path": "<relative-file-path>" }``, requires an ``analyst``/``admin``
  session (via ``canAccessAdmin``) and a Strapi access token. It:

  1. Parses the filename with ``parseRasterLayerFilename()``.
  2. Builds the TiTiler source URL as ``/data/geotiffs/<path>``.
  3. Calls TiTiler ``/cog/info`` and ``/cog/statistics`` in parallel.
  4. Builds the ``RasterLayer`` payload (``computed_min``/``computed_max``
     from the band's ``percentile_2``/``percentile_98``, falling back to
     ``min``/``max``; ``colormap_name: 'viridis'``; spatial fields copied
     from ``/cog/info``).
  5. POSTs that payload to ``${STRAPI_INTERNAL_URL}/api/raster-layers/sync``
     with the caller's bearer token and relays Strapi's response.

Frontend Usage
--------------

``web/src/lib/strapi.ts`` exposes:

- ``RasterLayer`` -- the typed shape of a Strapi entry, including all schema
  attributes described above.
- ``getRasterLayers()`` -- fetches all entries from
  ``GET /api/raster-layers``.
- ``syncRasterLayer(filePath)`` -- calls ``POST /api/raster-layers/sync``
  for a given relative file path.

Forecast TIFFs Dashboard
^^^^^^^^^^^^^^^^^^^^^^^^

``/dashboard/forecast-tiffs``
(``web/src/app/dashboard/forecast-tiffs/page.tsx``) lists the GeoTIFF files
under ``assets/tiles`` grouped by directory. For each file, it looks up a
matching ``RasterLayer`` entry (by comparing
``getRasterLayerFileBaseName(layer.attributes.file_url)`` against the file
name) and, when found, displays:

- ``display_name`` and the original filename
- ``area_name`` and ``hydrology_variable``
- ``acquisition_date`` / ``acquisition_time``
- ``colormap_name`` with ``computed_min`` / ``computed_max``
- ``width`` x ``height``, ``band_count``, and ``dtype``
- ``file_projection`` or ``crs``
- ``bounds``

Each file row also has a refresh button (visible to ``analyst``/``admin``
roles via ``ProtectedActionButton``) that calls ``syncRasterLayer(file.path)``
and then revalidates the ``RasterLayer`` list, so newly uploaded or changed
files can be (re)synced on demand.

ForecastDrawer Integration
^^^^^^^^^^^^^^^^^^^^^^^^^^^

``web/src/components/maps/ForecastDrawer.tsx`` also fetches
``getRasterLayers()`` and indexes the results by
``getRasterLayerFileBaseName(layer.attributes.file_url)``. For the active
forecast frame, it looks up the entry whose basename matches
``activeFrame.fileName`` and, when ``computed_min``/``computed_max`` are
finite numbers, uses them as the colormap rescale range for that frame.

The resolved min/max follow this priority order:

1. an explicit environment override (``envMin``/``envMax``), if configured
2. the matched ``RasterLayer``'s ``computed_min`` / ``computed_max``
3. TiTiler's ``recommendedMin`` / ``recommendedMax`` (percentile-based)
4. TiTiler's raw ``min`` / ``max`` statistics

This lets curated, reviewed stretch values from the ``RasterLayer``
collection take precedence over the on-the-fly statistics computed by
TiTiler for the same file, while still falling back gracefully when no
matching entry has been synced yet. See ``public-map.rst`` for the rest of
the ``ForecastDrawer`` rendering flow.

TypeScript API Reference
-------------------------

The low-level TypeScript exports for the raster layer flow are documented in
the generated TypeDoc output under ``web/typedoc``. Most relevant entries
include:

- ``RasterLayer``
- ``getRasterLayers()`` and ``syncRasterLayer()``
- ``parseRasterLayerFilename()`` and ``ParsedRasterLayerFilename``
- ``getRasterLayerFileBaseName()``
