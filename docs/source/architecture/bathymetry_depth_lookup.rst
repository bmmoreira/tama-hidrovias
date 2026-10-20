Bathymetry Depth Lookup
=========================

Given a map coordinate, this flow answers "how deep is the river right
here" from a real hydraulic-model snapshot -- as opposed to
``CrossSectionModal``'s profile charts (:doc:`cross_section_flow`), which
show an entire cross-section's shape at ~377/476 fixed survey points, not
an arbitrary clicked coordinate.

Data
-----

Source data is a HEC-RAS-style hydraulic model run, exported as one
``.parquet`` file per modeled timestep under ``assets/parquet/`` -- e.g.
``madeira_depth_2022-10-01T00h00_UTM.parquet``: one row per 100m raster
cell, with a projected (``SIRGAS 2000 / UTM zone 20S``, EPSG:31980) point
geometry plus ``depth_m``/``wse_m`` (water-surface elevation) at that
fixed point in time. Unlike the GeoTIFF rasters the Camadas de Previsão
drawer renders as map tiles, this data is loaded into Postgres/PostGIS
instead -- a raster/tile pipeline isn't useful here, since the actual
product is "the nearest measured value to an arbitrary click," which is
a point query, not an image.

PostGIS
--------

The ``postgres`` service runs ``postgis/postgis:15-3.4-alpine`` instead
of plain ``postgres:15-alpine`` -- the exact same Postgres 15 underneath
(safe to swap on an existing data volume; Strapi's own tables are
untouched), just with the PostGIS extension's binaries available so
``CREATE EXTENSION postgis`` works. The extension itself isn't bootstrapped
by a ``docker-entrypoint-initdb.d`` script (those only run once, against a
brand-new empty volume, and this stack's volume already has Strapi's data
in it) -- instead, ``scripts/load_bathymetry_parquet.py`` runs
``CREATE EXTENSION IF NOT EXISTS postgis;`` itself, every time, so it
works identically on a fresh or an existing database.

Loading the Data
-------------------

.. code-block:: bash

    pipeline/venv/bin/python scripts/load_bathymetry_parquet.py \
        assets/parquet/madeira_depth_2022-10-01T00h00_UTM.parquet

The script:

1. Reads the parquet with ``geopandas`` (which recovers the file's own
   embedded CRS automatically) and reprojects every point to WGS84
   (``EPSG:4326``) -- the endpoint receives plain lng/lat from a map
   click, not UTM coordinates, so storing data pre-reprojected avoids a
   transform on every query.
2. Creates ``bathymetry_points`` if it doesn't exist yet: ``id``,
   ``reference_date`` (from the file's own ``data_hora`` column),
   ``cell_row``/``cell_col``/``cell_id`` (the source raster cell's
   indices, kept for traceability), ``depth_m``, ``wse_m``, and ``geom``
   -- a PostGIS ``geography(Point, 4326)`` column, not plain
   ``geometry``. ``geography`` computes true great-circle distances in
   meters directly off lng/lat, which is what a "nearest point to this
   click" query needs; ``geometry`` would need an explicit projection
   choice to get metrically correct distances.
3. Adds a ``GIST`` index on ``geom`` -- required for the ``<->``
   nearest-neighbor operator the endpoint uses to actually be fast
   (168,277 rows for the one Madeira file loaded so far; an unindexed
   scan would check all of them on every click).
4. Deletes any existing rows for that file's ``reference_date`` before
   inserting -- idempotent, so re-running after fixing bad source data
   (or re-exporting the same timestep) doesn't duplicate rows.

``reference_date`` is a column on one shared table, not one table per
loaded file/date. Nothing today actually varies that column (see
`Endpoint`_ below), but this keeps the schema ready to hold multiple
snapshots and one shared spatial index across all of them, rather than
needing a migration whenever a second date's file gets loaded.

Endpoint
---------

``GET /api/bathymetry/depth?lng=<lng>&lat=<lat>`` --
``web/src/app/api/bathymetry/depth/route.ts``. Talks to Postgres
directly via a small pooled client (``web/src/lib/db.ts``, server-only,
reusing the same ``DATABASE_*`` env vars Strapi already connects with) --
**no Strapi content type is involved at all**, same reasoning as the
cross-section flow's static files: this data has no editorial/CMS use
case, so routing it through Strapi would add a layer with no benefit.

.. code-block:: text

    SELECT depth_m, wse_m, reference_date,
           ST_Distance(geom, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) AS distance_m
    FROM bathymetry_points
    WHERE reference_date = $3
    ORDER BY geom <-> ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
    LIMIT 1

A single indexed nearest-neighbor query. If the closest point is more
than 150m away (half the source grid's 100m cell spacing, plus slack --
the same constant, kept in sync by comment, lives in both the route and
the load script), the response is ``{ "data": null }`` with a ``200``,
not an error -- the coordinate is just outside the modeled extent,
exactly like the forecast tile route returning ``204`` for an
out-of-bounds tile request (:doc:`../public-map`) rather than treating
every miss as a failure.

Temporarily forced reference date
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

The ``WHERE reference_date = $3`` parameter is **hardcoded** in the route
to the one date currently loaded (``2022-10-01T00:00:00Z``), regardless
of which forecast GeoTIFF frame is actually selected in the Camadas de
Previsão drawer. This is intentional, temporary scaffolding: there is no
mapping yet from "which frame is active" to "which bathymetry snapshot
to query," because ``ForecastOverlayConfig`` (``ForecastDrawer.tsx``)
doesn't carry a frame date at all today, only a tile URL/bounds/opacity.
Wiring that up for real means:

- Adding a date (or matching key) to ``ForecastOverlayConfig``, threaded
  through from whichever frame the drawer has selected.
- Passing that date to this endpoint as a query param instead of the
  hardcoded constant, and loading a ``bathymetry_points`` snapshot for
  every date that needs to be queryable (today, only one is loaded).
- Deciding what to do when no bathymetry snapshot exists for the
  selected frame's exact date -- nearest available date, or no result.

Until that lands, every depth lookup answers "what did the river look
like on 2022-10-01," not "what does the currently selected forecast
frame say" -- acceptable for the current testing/prototyping stage, not
for a release.

Frontend: the click handler and popup
----------------------------------------

``MapboxMap.tsx`` registers a plain ``map.on('click', ...)`` handler
(not scoped to a layer, unlike every other click handler in that file)
that's active **only while a forecast GeoTIFF overlay is loaded**
(``tileLayerUrl`` is set) -- a click with no raster active has nothing
to probe, by design, matching the feature request this implements. The
effect that registers it is keyed on ``[mapLoaded, tileLayerUrl]``, so
toggling the Camadas de Previsão drawer off immediately stops
intercepting clicks instead of silently staying active against a
raster that's no longer shown; a second effect also force-closes an
already-open popup the moment ``tileLayerUrl`` clears, so it can't be
left pointing at stale data.

Layer exclusion
~~~~~~~~~~~~~~~~~

Before querying the depth endpoint, the handler runs
``map.queryRenderedFeatures(e.point, { layers: [...] })`` against every
other interactive point/line/fill layer on the map (stations, SWOT
gauges, cross-section clusters/points/labels, rivers, basins) and bails
out if the click hit any of them -- otherwise a click on, say, a
cross-section circle would both open that feature's own popup *and* a
depth popup, which would be confusing and also just wrong (that circle
already has a real, precise value of its own). The layer id list is
filtered down to layers that actually exist on the map first
(``map.getLayer(id)``), since a disabled layer (stations are off by
default) doesn't exist to query and Mapbox throws if asked about one.

The popup itself
~~~~~~~~~~~~~~~~~~

Unlike every other popup in ``MapboxMap.tsx`` (station, SWOT gauge,
cross-section -- all rendered as a centered, full-screen-backdrop
overlay card the user dismisses before doing anything else), the depth
popup is a small card anchored directly at the clicked **screen pixel**
(``e.point``, not a re-projected lng/lat) and has no backdrop at all.
This was a deliberate departure from the existing pattern: probing
several spots on the raster in quick succession is the whole point of
this feature, and a full-screen takeover the user has to close between
every single click would actively fight that workflow. The popup closes
on the map's ``movestart`` event instead of tracking the view live --
once the user pans or zooms, the screen point it was anchored to is
stale, so it's simpler and just as correct to close it outright rather
than re-project it on every ``move`` event.

The card has four states (``DepthPopupState['status']``): ``loading``
(spinner, while the fetch is in flight), ``found`` (the depth/water-
surface-elevation values, plus a small amber note making the temporarily
forced reference date visible rather than letting the user assume it
matches whatever forecast frame they have selected), ``not-found`` (the
click landed more than the endpoint's 150m threshold from any loaded
point -- a plain, non-alarming message, not an error, since clicking
outside the modeled river extent is an expected, common outcome while
exploring), and ``error`` (the fetch itself failed).
