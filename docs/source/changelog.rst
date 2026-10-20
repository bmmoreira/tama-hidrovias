Changelog
=========

Upcoming
--------

Madeira flythrough: progressive wireframe streaming + its own pacing
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

- The Madeira riverbed wireframe now streams a sliding window of chunks
  as the camera advances (``createDepthWireframeStreamer``), instead of
  showing one static chunk near the start -- a new chunk fetches every
  2km of travel, up to 4 stay loaded at once (oldest disposed first),
  giving continuous wireframe coverage the whole flight. Practical for
  Madeira specifically since each chunk is one cheap indexed Postgres
  query; Tapajós's raster-crop-and-decode path would need its own
  pacing/step tuning before streaming the same way.
- ``startRiverFlythrough`` gained an ``onProgress`` callback (position +
  distance traveled, fired every frame) that the streamer uses to decide
  when to fetch the next chunk -- not throttled in the camera loop
  itself, since different consumers may want different thresholds.
- Fixed Madeira's flight feeling too fast: it shared ``FLYTHROUGH_DURATION_MS``
  with Tapajós, but Madeira's path is ~3.5x longer (~1014km vs ~292km),
  so the same total duration meant ~3.5x the camera speed. Given its own
  ``NEXT_PUBLIC_MADEIRA_FLYTHROUGH_DURATION_MS`` (default 150s, vs.
  Tapajós's 45s) instead of deriving one from the other's speed, which
  would stretch Madeira's flight to several minutes.
- See ``architecture/river_flythrough.rst``'s "Progressive chunk
  streaming (Madeira)" and "Pacing" sections for the full mechanism.

Madeira river flythrough (separate demo, real PostGIS data)
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

- Added a second, separate "Iniciar navegação pelo rio (Madeira)" demo
  (amber-themed, next to the existing cyan Tapajós one) in the Camadas
  de Previsão drawer -- same camera flight mechanism, but its riverbed
  wireframe is built from real, already-loaded PostGIS depth data
  (``bathymetry_points``) instead of a bathymetry GeoTIFF, since Madeira
  has no such raster but does have real loaded point data.
- New endpoint, ``GET /api/bathymetry/point-grid``, replaces the
  Tapajós path's TiTiler-crop-and-``geotiff``-decode round trip with one
  indexed Postgres query (``geom &&`` against the existing GiST index) --
  cheaper, and returns real measured values instead of ones resampled
  through a raster reprojection.
- Fixed a real distortion risk this surfaced: the point source's grid is
  regular in its *origin UTM projection's* meters, not in lng/lat
  degrees, so interpolating vertex positions from a chunk's bounds (fine
  for a TiTiler raster crop, which genuinely is lng/lat-regular) would
  have quietly warped the mesh over a long, winding river. ``DepthChunk``
  gained an optional ``lngLats`` field carrying real per-point
  coordinates instead.
- See ``architecture/river_flythrough.rst``'s "Madeira flythrough: real
  PostGIS data, not a raster" section for the full mechanism.

River navigation flythrough (Tapajós, test/demo)
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

- Added a "Navegação simulada" section to the Camadas de Previsão
  drawer, shown whenever the Tapajós bathymetry area has frames: one
  click activates the bathymetry raster (if not already active) and
  flies the camera along the whole Tapajós reach, first cross-section
  node to last, tilted and zoomed close to the water.
- The camera is driven by a hand-rolled ``requestAnimationFrame`` loop
  (``riverFlythrough.ts``), not ``flyTo``/``easeTo`` -- distance-weighted
  interpolation along the path (not equal time per node, which would
  visibly vary speed across unevenly-spaced nodes), a look-ahead bearing
  so the camera's heading drifts smoothly around bends, and the map's
  normal interaction handlers (drag/scroll/etc.) temporarily disabled
  so user input can't fight the forced camera updates mid-flight.
- Pitch, zoom ("height"), and total flight duration are tunable via
  ``NEXT_PUBLIC_FLYTHROUGH_PITCH``/``_ZOOM``/``_DURATION_MS``.
- Explicitly a test/demo of the concept, not a finished feature yet --
  see ``architecture/river_flythrough.rst``'s "Known limitations"
  section for what a real version would still need (most notably:
  works for Tapajós only, hardcoded).
- Added a step-one prototype of a real 3D riverbed: a single static
  chunk of actual sampled depth data near the flight's starting node,
  rendered as a Three.js wireframe inside a Mapbox custom layer (not yet
  following the camera along the path). A new endpoint,
  ``GET /api/bathymetry/raster-grid``, crops and decodes a small window
  of a bathymetry GeoTIFF into a plain JSON grid of depth values via
  TiTiler + the ``geotiff`` npm package. See
  ``architecture/river_flythrough.rst``'s "3D riverbed wireframe
  (prototype)" section for the full mechanism, including a real bug hit
  on the first pass (copying Mapbox's standard 3D-model rotation, which
  tipped an already-correct flat grid into a vertical wall) and the fix.

Bathymetry depth lookup (PostGIS)
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

- Added PostGIS to the ``postgres`` service (swapped to
  ``postgis/postgis:15-3.4-alpine``, safe on the existing data volume --
  same Postgres 15 underneath) and a new ``bathymetry_points`` table,
  loaded from a HEC-RAS-style depth-grid parquet export via a new script,
  ``scripts/load_bathymetry_parquet.py`` (168,277 points for the one
  Madeira snapshot loaded so far: 2022-10-01).
- Added ``GET /api/bathymetry/depth?lng=&lat=``, a new Next.js route
  querying Postgres directly (no Strapi content type) for the nearest
  loaded point to a clicked coordinate, via a single indexed PostGIS
  nearest-neighbor query. Returns ``{ data: null }`` for a coordinate
  more than 150m from any loaded point, rather than an error.
- The query's ``reference_date`` filter is **temporarily hardcoded** to
  the one snapshot currently loaded, regardless of which forecast
  GeoTIFF frame is selected in the Camadas de Previsão drawer -- there's
  no frame→date matching wired up yet.
- Clicking the map while a forecast overlay is loaded now shows a small
  popup, anchored at the clicked pixel, with the depth/water-surface
  value (or a quiet "no data here" message for a click outside the
  modeled extent). Unlike this app's other map popups (station/SWOT/
  cross-section, all centered full-screen cards), this one has no
  backdrop and closes on the next map pan/zoom instead of requiring an
  explicit dismiss -- probing several spots in a row is the point of
  the feature, and a takeover-style popup would fight that. A click
  that hits another interactive layer (a station, SWOT gauge,
  cross-section point, river, or basin) opens that feature's own popup
  instead, not this one.
- See ``architecture/bathymetry_depth_lookup.rst`` for the full load
  pipeline, schema, endpoint, and click-handler mechanism.

Cross-section circle styling: size, color, and a metric selector
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

- Individual cross-section circles are bigger (``NEXT_PUBLIC_CROSS_SECTION_CIRCLE_RADIUS``,
  default 14px, up from a flat 4-8px dot) and now show a value label
  and a color driven by one of two precomputed metrics: max or mean
  "cota do leito" (bed elevation). Clusters are unchanged -- still just
  a point count, no per-cluster aggregate.
- The two metrics (``cota_leito_maxima``/``cota_leito_media``) are
  precomputed per point by a new script,
  ``scripts/compute_cross_section_stats.py``, rather than fetched or
  aggregated in the browser -- computing them at runtime would mean
  fetching all ~500 profile files just to color map markers, defeating
  ``CrossSectionModal``'s lazy, one-at-a-time profile fetching.
- Color is a two-stop green ramp (``NEXT_PUBLIC_CROSS_SECTION_COLOR_LOW``/
  ``_HIGH``, defaulting to the exact colors the SWOT gauge legend already
  uses for its positive-value ramp), scaled to the selected metric's own
  min/max across the currently loaded data -- not a fixed domain, since
  Madeira and Tapajós have very different elevation ranges.
- A new "Seção Transversal" section in the Filtros drawer
  (``SwotFilterDrawer.tsx``) lets visitors switch between máxima
  (default, ``NEXT_PUBLIC_CROSS_SECTION_DEFAULT_METRIC``) and média
  live; a matching legend section was added to ``ForecastLegend.tsx``.
  Fixed a latent bug this surfaced: the Filtros drawer previously
  returned ``null`` whenever there were zero SWOT gauges, which would
  have hidden the entire drawer (including the new cross-section
  section) on any map with cross-section data but no SWOT gauges.
- See ``architecture/cross_section_flow.rst``'s "Circle Styling" section
  for the full mechanism.

Tapajós river cross-section points
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

- Added 99 Tapajós river cross-section points, merged into the existing
  ``output_points_water_level.geojson`` (now 476 points total) rather
  than shipped as a second file -- the clustering layer and modal have
  no notion of "which river," so one merged source means zero app code
  changes.
- The raw Tapajós export needed two fixes before merging: its ~30-field
  raw SWORD join was normalized down to the existing 6-property schema
  (and was missing a ``file`` field entirely, derived from
  ``sword_node_id``/``sword_dist_out``), and its coordinates were
  reprojected from UTM 21S (EPSG:32721) to WGS84 -- the source export
  was in a different CRS than Madeira's existing file, which would have
  silently plotted every new point in the wrong place (large UTM
  easting/northing values interpreted as lon/lat) if merged as-is.
- See ``architecture/cross_section_flow.rst``'s "Adding Another River"
  section for the full checklist this follows for the next river.

River cross-section (transversal section) points
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

- Added a third clustered point layer to the public map:
  ``crossSectionClusterLayer.ts``, showing 377 SWORD-derived river
  cross-section points along the Madeira basin (mirrors
  ``stationClusterLayer.ts``'s plain Mapbox-native clustering -- no
  per-cluster aggregate is needed, just a point count).
- Source data (``output_points_water_level.geojson`` +
  ``secoes_transversais/*.txt`` elevation profiles) is static reference
  data served from ``web/public/geojson/``, the same convention already
  used for rivers/basins.
- Clicking an individual point shows a popup styled like the SWOT gauge
  popup, with a "Ver perfil da seção" button opening the new
  ``CrossSectionModal``: a lazily-fetched elevation profile chart for that
  point's transversal section. Both axes use ``domain={['dataMin',
  'dataMax']}`` -- Recharts' own implicit default still pads a numeric
  axis even with no ``domain`` prop at all, so this was needed to get
  true tight bounds: no forced zero on the Y axis (the deepest channel
  point correctly sits at the bottom) and no gap after the last point on
  the X axis. A water-surface reference line is drawn at the station's
  actual measured ``water_level`` (not a constant), with a boat floating
  on it, and the area under the profile is filled in two colors -- amber
  for the riverbed/banks, blue layered on top wherever the channel is
  actually submerged (terrain below ``water_level``) -- plus max/mean
  elevation ("cota do leito") and measured-width summary stats.
- The boat now anchors horizontally at the profile's own deepest point
  (lowest bed-elevation value) instead of the chart's fixed horizontal
  center, so it floats over the actual channel instead of a riverbank on
  lopsided sections. Its pixel position is read back from a second,
  invisible ``ReferenceLine`` at that distance -- the same "read back
  Recharts' own rendered position" technique already used for the water
  line's vertical offset -- with each line scoped by its own
  ``className`` so the two measurements can't collide.
- Below the ``sm`` breakpoint, the modal goes fullscreen (edge-to-edge,
  unrounded) instead of the centered card used elsewhere, and the chart
  grows to fill the available space instead of sitting at a fixed
  height; the Y-axis label is also dropped on narrow screens (via a
  ``matchMedia`` hook, since Recharts' ``label`` is SVG, not a DOM
  element toggleable with a responsive class) with the chart title
  stating both axes' units instead, and the chart's own side margins
  tighten to reclaim that freed-up space.
- See ``station-clustering.rst`` and the new
  ``architecture/cross_section_flow.rst`` diagrams for details.

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
  down/up triangle) is reused for all three metrics. The selector is off
  by default (``NEXT_PUBLIC_SWOT_METRIC_SELECTOR_ENABLED=false``); while
  off, the metric stays fixed at Change with no UI to change it.
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