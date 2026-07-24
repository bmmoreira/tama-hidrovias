Changelog
=========

Upcoming
--------

Station and SWOT gauge clustering
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

- Added Mapbox GL clustering for the public map's station points, extracted
  into a new ``web/src/components/maps/stationClusterLayer.ts`` module
  (source, layers, and interactions) so ``MapboxMap.tsx`` no longer manages
  station rendering inline.
- Added the same clustering approach for SWOT gauges
  (``web/src/components/maps/swotGaugeClusterLayer.ts``), replacing the
  previous DOM-marker-based rendering (which could only be hidden below a
  fixed zoom level, not clustered) with a real clustered layer. A single
  symbol layer handles both clusters and individual gauges: two SDF
  triangle images generated once on an offscreen canvas, tinted per-feature
  to reproduce the original SVG marker's color scale exactly. A cluster
  renders as the same triangle as an individual gauge, sized up for bigger
  clusters.
- Reworked SWOT gauge clustering to drive a ``supercluster`` index
  directly (``SwotGaugeClusterLayer`` class) instead of Mapbox's native
  ``cluster: true``/``clusterProperties``, and to aggregate cluster values
  by **median** rather than average -- extreme outlier gauges no longer
  skew a cluster's displayed value. This was necessary because
  ``clusterProperties`` can only express incrementally-combinable
  aggregates (sum/max/min); an exact median needs the cluster's full set
  of raw values, which ``supercluster``'s ``getLeaves()`` provides.
  Color/shape/label are now precomputed per feature in plain JS rather
  than as Mapbox style expressions, which also removed the need for the
  old "no-data sentinel number" workaround around Mapbox's expression
  type-checker.
- Added a "Métrica visualizada" selector to ``SwotFilterDrawer`` letting
  users pick which property drives both individual gauges and cluster
  aggregates: **Change** (variação, default), **std** (desvio padrão), or
  **median** (mediana). Cluster aggregation is always by median regardless
  of which metric is selected. The same signed color scale (red↔green,
  down/up triangle) is reused for all three metrics.
- Cluster radius is independently configurable for each layer via
  ``NEXT_PUBLIC_STATION_CLUSTER_RADIUS`` and
  ``NEXT_PUBLIC_SWOT_CLUSTER_RADIUS`` (both default ``65``), wired through
  ``.env``, ``web/Dockerfile``, ``docker-compose.yml`` build args, and the
  google deployment's env template.
- Fixed a pre-existing stale-closure bug in the station double-click
  handler (it read the ``stations`` prop from mount time instead of the
  latest value) while extracting the handler into the new module.
- Fixed a pre-existing bug where stations could fail to render at *any*
  zoom level: the effect pushing station data into the Mapbox source
  checked ``map.isStyleLoaded()`` with no retry (the same bug class
  already fixed for rivers/basins/the raster overlay), so data arriving
  before the map's ``'load'`` event fired was silently dropped. Fixed by
  depending on the reactive ``mapLoaded`` state instead; confirmed via an
  actual headless-browser render.
- Station point circles/clusters are now off by default
  (``NEXT_PUBLIC_SHOW_STATION_MARKERS=false``), since the underlying
  ``Station`` records are currently mock/placeholder data, unlike SWOT
  gauges (real data, always on). The stations fetch itself is skipped
  entirely on the client when the flag is off, not just its rendering.
- See ``station-clustering.rst`` for the full technical writeup.

Map layers drawer, mock rain heatmap, and SWOT spatial filter
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

- Added a mobile-first "Camadas" drawer (``LayersDrawer.tsx``) to the public
  ``/map`` route for toggling rivers and ANA sub-basins on/off and selecting
  individual features, modeled on the existing SWOT filter drawer.
- Moved ``rivers.geojson`` and ``subbacias.geojson`` to ``web/public/geojson/``
  so they are served as static assets and fetched at runtime.
- Added a deterministic mock rainfall choropleth for the basins layer
  (``useMockRainHeatmap.ts``) as groundwork for a future real per-basin
  rainfall data source.
- Added hover highlighting and click popups for both the rivers and basins
  Mapbox layers in ``MapboxMap.tsx``.
- Added a "hide all stations" visibility switch to ``SwotFilterDrawer``.
- Added a spatial filter to ``SwotFilterDrawer`` that restricts visible SWOT
  gauge stations to those near the currently visible rivers, or inside the
  currently visible basins, reusing the Camadas drawer's own selection
  (``spatialFilter.ts``, dependency-free point-to-line and
  point-in-polygon helpers).
- Fixed a data race where sub-basins could load with an empty default
  selection, a stale ``isStyleLoaded()`` check that could silently drop the
  first render of river/basin data, a toggle-switch knob CSS overflow bug,
  and a drawer-overlap bug between the Camadas and forecast ("Medições")
  panels on desktop.
- See ``map-layers.rst`` for the full technical writeup.

Authentication and dashboard authorization
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

- Added explicit application role handling for ``viewer`` and ``analyst``.
- Fixed NextAuth session role resolution so the web app reads the populated
  Strapi role instead of collapsing custom users into ``authenticated``.
- Added a Strapi Users & Permissions extension that bootstraps custom roles and
  returns role data from ``GET /api/users/me``.
- Added unit coverage for pure session-role resolution logic in the web app.

Dashboard customization
~~~~~~~~~~~~~~~~~~~~~~~

- Added reusable ``ProtectedActionButton`` for visible-but-disabled protected
  actions.
- Added reusable ``ReadOnlyBadge`` and viewer-mode messaging across the
  dashboard.
- Added reusable toast-style feedback for station mutation success and error states.
- Replaced the native delete confirmation with a custom dashboard confirmation modal.
- Extracted a reusable confirmation modal component and wired destructive dashboard flows to use it directly.
- Added a read-only banner for viewer sessions in the dashboard layout.
- Kept restricted actions visible for unauthorized users while enforcing
  analyst-only execution where required.

Protected write flow
~~~~~~~~~~~~~~~~~~~~

- Enforced analyst-only station creation in the internal Next.js API route.
- Added analyst-only station update and deletion through internal Next.js API routes.
- Added edit and delete controls to the dashboard stations list.
- Added row-level loading and disabled states while station edit or delete mutations are running.
- Kept UI restrictions aligned with server-side authorization for the virtual
  station and station-management flows.
- Added unit coverage for station mutation helpers and analyst-only API guards.
- Added render-level coverage for station-row busy states across edit and delete flows.

Documentation
~~~~~~~~~~~~~

- Added project documentation for role levels, dashboard customization, and
  Strapi-specific authorization behavior.
- Added Sphinx documentation for the public map forecast overlay flow and the
  TiTiler-backed forecast API routes.
- Expanded TypeDoc-facing comments for the public forecast drawer, forecast
  tile discovery helpers, and raster overlay map props.
- Added frontend and CMS project notes describing the custom auth and role
  model.

Forecast overlay defaults and rendering
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

- Added global app settings for forecast palette, opacity, min/max range, and
  animation interval.
- Restricted public forecast styling controls to analysts and moved them into a
  dedicated reusable component.
- Reduced redundant public-map raster rerenders by skipping identical overlay
  updates and avoiding raster source recreation for opacity-only changes.
- Changed the forecast tile proxy to return a transparent PNG for missing tiles
  so browser image decode errors do not surface during map panning.